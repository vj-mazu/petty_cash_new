import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import DateInput from '../components/DateInput';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { ArrowLeft, Save } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { toTitleCase } from '../utils/textUtils';
import { anamathApi, ledgerApi } from '../services/api';
import { directApi } from '../utils/directApi';

// Form data interface
interface AnamathFormData {
  ledgerId?: string;
  amount: number;
  date: string;
  remarks?: string;
}

// Ledger interface
interface Ledger {
  id: string;
  name: string;
}

const EditAnamath: React.FC = () => {
  // Get record ID from URL params
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();


  // Component state
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [record, setRecord] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(false);

  // Initialize form
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AnamathFormData>();

  // Create mock data for testing purposes
  const createMockData = (recordId: string, scenario: string) => {
    const scenarios = {
      'invalid-id': {
        amount: 2500,
        remarks: 'Demo Entry - Invalid ID Format',
      },
      'server-offline': {
        amount: 7500,
        remarks: 'Demo Entry - Server Offline Mode',
      },
      'no-id': {
        amount: 1000,
        remarks: 'Demo Entry - No ID Provided',
      },
      'no-auth': {
        amount: 3000,
        remarks: 'Demo Entry - Authentication Required',
      },
      'auth-failed': {
        amount: 4500,
        remarks: 'Demo Entry - Authentication Failed',
      },
      'default': {
        amount: 5000,
        remarks: 'Demo Entry - Default Mode',
      }
    };

    const scenarioData = scenarios[scenario as keyof typeof scenarios] || scenarios.default;

    return {
      id: recordId || 'demo-id-' + Date.now(),
      amount: scenarioData.amount,
      date: new Date().toISOString().split('T')[0],
      remarks: scenarioData.remarks,
      ledgerId: '',
      ledger: { name: 'Demo Ledger' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  // Load mock data into form
  const loadMockData = (mockData: any, errorMessage: string) => {
    setRecord(mockData);
    setValue('ledgerId', mockData.ledgerId || '');
    setValue('amount', mockData.amount || 0);
    setValue('date', format(new Date(mockData.date), 'yyyy-MM-dd'));
    setValue('remarks', mockData.remarks || '');
    setError(errorMessage);
    setDemoMode(true);
    toast.info(errorMessage);
  };

  // Populate form with real data
  const populateForm = (recordData: any) => {
    setValue('ledgerId', recordData.ledgerId || recordData.ledger_id || '');
    setValue('amount', recordData.amount || 0);
    setValue('date', format(new Date(recordData.date), 'yyyy-MM-dd'));
    setValue('remarks', recordData.remarks || '');
  };

  // Function to fetch the record data - SIMPLIFIED FOR REAL DATA
  const fetchRecord = async () => {

    // Handle missing ID
    if (!id) {
      console.error('❌ No record ID provided');
      const mockData = createMockData('', 'no-id');
      loadMockData(mockData, 'No record ID provided.');
      setLoading(false);
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('❌ Invalid UUID format:', id);
      const mockData = createMockData(id, 'invalid-id');
      loadMockData(mockData, 'Invalid ID format.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {

      // First try the direct API approach
      const directResponse = await directApi.getAnamathById(id);

      if (directResponse.success && directResponse.data) {
        const recordData = directResponse.data;
        setRecord(recordData);
        populateForm(recordData);
        setError(null);
        setDemoMode(false);
        toast.success('Real record loaded successfully!');
        return; // Exit function on success
      }

      // Fallback to regular API
      const response = await anamathApi.getById(id);

      if (response && response.success && response.data) {
        const recordData = response.data;
        setRecord(recordData);
        populateForm(recordData);
        setError(null);
        setDemoMode(false);
        toast.success('Real record loaded successfully!');
        return;
      }

      throw new Error(directResponse?.message || response?.message || 'No data returned from server');

    } catch (err: any) {
      console.error('🚨 API call failed - ERROR DETAILS:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        responseData: err.response?.data,
        fullError: err
      });

      // Show specific error but still load mock data for testing
      let errorMsg = 'Failed to load real data';
      if (err.response?.status === 401) {
        errorMsg = 'Authentication failed - please login';
      } else if (err.response?.status === 404) {
        errorMsg = 'Record not found';
      } else if (err.response?.status === 500) {
        errorMsg = 'Server error';
      } else if (!err.response) {
        errorMsg = 'Network connection failed';
      }

      const mockData = createMockData(id, 'server-offline');
      loadMockData(mockData, `${errorMsg}. Showing test data.`);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch ledgers for dropdown
  const fetchLedgers = async () => {
    try {
      const response = await ledgerApi.getAll({ limit: 100 });

      if (response.success && response.data && response.data.ledgers) {
        setLedgers(response.data.ledgers);
      } else {
        throw new Error('Failed to fetch ledgers');
      }
    } catch (err) {
      console.error('❌ Error fetching ledgers:', err);
      // Create demo ledgers
      const demoLedgers = [
        { id: 'demo-1', name: 'Cash Account' },
        { id: 'demo-2', name: 'Bank Account' },
        { id: 'demo-3', name: 'Petty Cash' }
      ];
      setLedgers(demoLedgers);
    }
  };

  // Load data on component mount
  useEffect(() => {

    // Load ledgers first (non-blocking)
    fetchLedgers();

    // Then load the record
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Handle form submission with bulletproof error handling
  const onSubmit = async (data: AnamathFormData) => {

    // Check if token exists
    const token = sessionStorage.getItem('token');

    if (!token) {
      toast.error('You are not logged in. Please login again.');
      console.error('❌ No authentication token found!');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }

    if (!id) {
      console.error('❌ Cannot submit without record ID');
      toast.error('Cannot save record without valid ID');
      return;
    }

    // Validate form data
    if (!data.amount || data.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    if (!data.date) {
      toast.error('Date is required');
      return;
    }

    setSubmitting(true);
    const submitToast = toast.loading('Saving record...');

    try {
      if (demoMode) {
        // Demo mode - simulate save
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

        toast.update(submitToast, {
          render: 'Demo save completed! (Server is offline)',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });

        // Update local record
        const updatedRecord = {
          ...record,
          ...data,
          updatedAt: new Date().toISOString()
        };
        setRecord(updatedRecord);

        return;
      }

      // Real API call - Try direct API first

      const updateData = {
        amount: Number(data.amount),
        date: data.date, // Should already be in YYYY-MM-DD format from date input
        ledgerId: data.ledgerId && data.ledgerId !== '' ? data.ledgerId : undefined,
        remarks: data.remarks && data.remarks !== '' ? data.remarks : undefined
      };


      const directResponse = await directApi.updateAnamathById(id, updateData);

      if (directResponse.success) {
        toast.update(submitToast, {
          render: 'Record updated successfully with REAL DATA!',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });


        // Navigate back after success
        setTimeout(() => {
          navigate('/anamath');
        }, 2000);
        return;
      }

      // Fallback to regular API
      const response = await anamathApi.update(id, updateData);

      if (response && response.success) {
        toast.update(submitToast, {
          render: 'Record updated successfully!',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });


        // Navigate back after success
        setTimeout(() => {
          navigate('/anamath');
        }, 2000);
      } else {
        throw new Error(directResponse?.message || response?.message || 'Update failed');
      }
    } catch (err: any) {
      console.error('🚨 Save failed - DETAILED ERROR:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        data: err.response?.data,
        fullError: err
      });

      // Show specific error message
      let errorMessage = 'API save failed.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.errors) {
        // Validation errors
        const validationErrors = err.response.data.errors;
        errorMessage = `Validation failed: ${validationErrors.map((e: any) => e.msg).join(', ')}`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      console.error('❌ ERROR MESSAGE:', errorMessage);

      toast.update(submitToast, {
        render: `${errorMessage} - Saved locally for demo.`,
        type: 'warning',
        isLoading: false,
        autoClose: 5000
      });

      // Update local record for demo
      const updatedRecord = {
        ...record,
        ...data,
        updatedAt: new Date().toISOString()
      };
      setRecord(updatedRecord);

    } finally {
      setSubmitting(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/anamath');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Render the form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                disabled={submitting}
              >
                <ArrowLeft size={20} />
                Back to Anamath
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Edit Anamath Entry</h1>
                <p className="text-slate-300">
                  {demoMode ? '🎭 Demo Mode - Server Offline' : 'Modify anamath entry details'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error/Demo Notice */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg ${demoMode ? 'bg-blue-500 bg-opacity-20 border border-blue-400' : 'bg-red-500 bg-opacity-20 border border-red-400'}`}>
            <p className={`${demoMode ? 'text-blue-100' : 'text-red-100'}`}>
              {error}
            </p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Record Info */}
            {record && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-800 bg-opacity-50 rounded-lg">
                <div>
                  <span className="text-slate-400">Record ID:</span>
                  <span className="ml-2 text-white font-mono text-sm">{record.id}</span>
                </div>
                <div>
                  <span className="text-slate-400">Last Updated:</span>
                  <span className="ml-2 text-white">
                    {format(new Date(record.updatedAt), 'dd MMM yyyy, hh:mm a')}
                  </span>
                </div>
              </div>
            )}

            {/* Amount Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Amount <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                {...register('amount', {
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be greater than 0' }
                })}
                className="w-full px-4 py-2 bg-slate-800 bg-opacity-50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                placeholder="Enter amount"
                disabled={submitting}
              />
              {errors.amount && (
                <p className="text-red-400 text-sm">{errors.amount.message}</p>
              )}
            </div>

            {/* Date Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Date <span className="text-red-400">*</span>
              </label>
              <DateInput
                value={watch('date') || ''}
                onChange={(val) => {
                  setValue('date', val);
                  if (errors.date) {
                    // errors cleared on next submit
                  }
                }}
                className="w-full px-4 py-2 bg-slate-800 bg-opacity-50 border border-slate-600 rounded-lg text-white placeholder-slate-400"
              />
              {errors.date && (
                <p className="text-red-400 text-sm">{errors.date.message}</p>
              )}
            </div>

            {/* Ledger Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Ledger
              </label>
              <select
                {...register('ledgerId')}
                className="w-full px-4 py-2 bg-slate-800 bg-opacity-50 border border-slate-600 rounded-lg text-white focus:border-blue-400 focus:outline-none"
                disabled={submitting}
              >
                <option value="">Select a ledger (optional)</option>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {toTitleCase(ledger.name)}
                  </option>
                ))}
              </select>
            </div>

            {/* Remarks Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Remarks
              </label>
              <textarea
                {...register('remarks')}
                rows={3}
                className="w-full px-4 py-2 bg-slate-800 bg-opacity-50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none resize-none"
                placeholder="Enter any remarks or notes"
                disabled={submitting}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-2 border border-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={20} />
                {submitting ? 'Saving...' : (demoMode ? 'Save (Demo)' : 'Save Changes')}
              </button>
            </div>
          </form>
        </div>

        {/* Demo Mode Info */}
        {demoMode && (
          <div className="mt-6 p-4 bg-yellow-500 bg-opacity-20 border border-yellow-400 rounded-lg">
            <h3 className="text-yellow-100 font-semibold mb-2">🎭 Demo Mode Active</h3>
            <p className="text-yellow-200 text-sm">
              The server appears to be offline or the record ID is invalid. All changes are being made locally for demonstration purposes.
              When the server comes back online, you can try editing real records.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditAnamath;