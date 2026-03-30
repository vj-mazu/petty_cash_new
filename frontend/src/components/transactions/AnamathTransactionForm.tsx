import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { anamathApi, ledgerApi, Ledger, CreateAnamathEntryData } from '../../services/api';
import { formatIndianCurrency, formatDisplayAmount } from '../../utils/indianNumberFormat';
import {
  ArrowLeft,
  Save,
  BookOpen,
  Calculator,
  Info,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner';

interface AnamathFormData {
  ledgerId?: string;
  amount: number;
  date: string;
  remarks: string;
}

const AnamathTransactionForm: React.FC = () => {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState(true);
  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);
  const [nextAnamathId, setNextAnamathId] = useState<string | null>(null);
  const [loadingAnamathId, setLoadingAnamathId] = useState(true);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<AnamathFormData>({
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      remarks: ''
    },
    mode: 'onChange'
  });
  
  const watchedLedgerId = watch('ledgerId');
  const watchedAmount = watch('amount') || 0;

  useEffect(() => {
    fetchLedgers();
    fetchNextAnamathId();
  }, []);

  useEffect(() => {
    if (watchedLedgerId) {
      const ledger = ledgers.find(l => l.id === watchedLedgerId);
      setSelectedLedger(ledger || null);
    }
  }, [watchedLedgerId, ledgers]);

  const fetchLedgers = async () => {
    try {
      setLoadingLedgers(true);
      const response = await ledgerApi.getAll({ limit: 100 });
      if (response.success) {
        setLedgers(response.data.ledgers);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch ledgers');
    } finally {
      setLoadingLedgers(false);
    }
  };

  const fetchNextAnamathId = async () => {
    try {
      setLoadingAnamathId(true);
      // Get all anamath entries to find the highest existing ID number
      const response = await anamathApi.getAll({ limit: 1000 });
      if (response.success && response.data) {
        const entries = response.data.anamathEntries || [];
        
        // Find the highest existing transaction number
        let maxNumber = 0;
        entries.forEach(entry => {
          if (entry.transactionNumber && typeof entry.transactionNumber === 'number') {
            if (entry.transactionNumber > maxNumber) {
              maxNumber = entry.transactionNumber;
            }
          }
        });
        
        const nextNumber = maxNumber + 1;
        const nextId = `A${String(nextNumber).padStart(3, '0')}`;
        setNextAnamathId(nextId);
      }
    } catch (error: any) {
      console.error('Failed to fetch anamath entries for ID generation:', error);
    } finally {
      setLoadingAnamathId(false);
    }
  };

  const onSubmit = async (formData: AnamathFormData) => {
    try {

      // Validation
      if (!formData.amount || formData.amount <= 0) {
        console.error('Invalid amount:', formData.amount);
        toast.error('Please enter a valid amount greater than 0');
        return;
      }

      if (!formData.remarks.trim()) {
        console.error('No remarks provided');
        toast.error('Remarks are required for Anamath entries');
        return;
      }

      // Create anamath entry using the dedicated anamath API
      const anamathData: CreateAnamathEntryData = {
        date: formData.date,
        amount: formData.amount,
        remarks: formData.remarks.trim(),
        referenceNumber: nextAnamathId || undefined, // Include the generated anamath ID
        ledgerId: formData.ledgerId || undefined // Optional ledger reference
      };

      const response = await anamathApi.create(anamathData);

      if (response.success) {
        toast.success(
          `Anamath entry of ${formatIndianCurrency(formData.amount)} added successfully!`
        );
        navigate('/anamath');
      } else {
        console.error('Anamath creation failed:', response);
        toast.error(response.message || 'Failed to create anamath entry');
      }
    } catch (error: any) {
      console.error('Error creating anamath entry:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create anamath entry';
      toast.error(errorMessage);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatIndianCurrency(amount);
  };

  if (loadingLedgers) {
    return <LoadingSpinner message="Loading ledgers..." />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/transactions/create')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
        >
          <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" />
        </motion.button>
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-amber-900 dark:text-amber-400">Add Anamath Entry</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Record a special entry</p>
        </div>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 sm:p-6 lg:p-8 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
          {/* Transaction Type Display */}
          <div className="p-4 sm:p-5 rounded-lg border-2 bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700">
            <div className="flex items-center">
              <Calculator className="w-6 h-6 sm:w-7 sm:h-7 mr-3 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="text-base sm:text-lg font-medium text-amber-900 dark:text-amber-300">Anamath Entry</div>
                <div className="text-sm sm:text-base text-amber-600 dark:text-amber-400">Special entry that doesn't affect balance</div>
              </div>
            </div>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-base sm:text-lg font-medium text-amber-800 dark:text-amber-400 mb-2">
              Date *
            </label>
            <input
              {...register('date', { required: 'Date is required' })}
              type="date"
              className="input-field border-amber-300 dark:border-amber-700 focus:border-amber-500 focus:ring-amber-500"
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          {/* Ledger Selection - Now Optional */}
          <div>
            <label htmlFor="ledgerId" className="block text-base sm:text-lg font-medium text-amber-800 dark:text-amber-400 mb-2">
              Select Ledger (Optional)
            </label>
            <div className="relative">
              <select
                id="ledgerId"
                {...register('ledgerId')}
                className="input-field pl-10 sm:pl-12 pr-8 appearance-none bg-white dark:bg-gray-700 border-amber-300 dark:border-amber-700 focus:border-amber-500 focus:ring-amber-500"
              >
                <option value="">No specific ledger (General entry)</option>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <p className="mt-1 text-xs text-amber-600">
              You can optionally associate this entry with a specific ledger for reference
            </p>
            {selectedLedger && (
              <div className="mt-3 p-4 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-amber-900 dark:text-amber-300">{selectedLedger.name}</div>
                    <div className="text-xs text-amber-600 dark:text-amber-400">Current Balance (unchanged)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(selectedLedger.currentBalance)}
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-400">Will remain the same</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Anamath ID - Auto-generated */}
          <div>
            <label className="block text-base sm:text-lg font-medium text-amber-800 dark:text-amber-400 mb-2">
              Anamath ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={loadingAnamathId ? 'Loading...' : nextAnamathId || 'A + Auto-generated number'}
                className="input-field bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 cursor-not-allowed border-amber-300 dark:border-amber-700"
                readOnly
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-xs text-amber-500">Auto</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-amber-600">
              {nextAnamathId ? `Next available anamath ID: ${nextAnamathId}` : 'A unique anamath ID (A001, A002, etc.) will be assigned automatically'}
            </p>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-base sm:text-lg font-medium text-amber-800 dark:text-amber-400 mb-2">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-amber-600 dark:text-amber-400 text-xl font-bold">₹</span>
              <input
                {...register('amount', { 
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be greater than 0' }
                })}
                type="number"
                step="0.01"
                min="0.01"
                className="input-field pl-10 sm:pl-12 py-3 sm:py-4 text-lg sm:text-xl font-semibold border-amber-300 dark:border-amber-700 focus:border-amber-500 focus:ring-amber-500"
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label htmlFor="remarks" className="block text-base sm:text-lg font-medium text-amber-800 dark:text-amber-400 mb-2">
              Remarks *
            </label>
            <textarea
              {...register('remarks', { required: 'Remarks are required for Anamath entries' })}
              rows={3}
              className="input-field border-amber-300 dark:border-amber-700 focus:border-amber-500 focus:ring-amber-500"
              placeholder="Please provide details for this Anamath entry..."
            />
            {errors.remarks && (
              <p className="mt-1 text-sm text-red-600">{errors.remarks.message}</p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-amber-200 dark:border-amber-800">
            <button
              type="button"
              onClick={() => navigate('/transactions/create')}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 sm:px-8 py-3 rounded-lg text-base sm:text-lg font-medium transition-colors duration-200 flex items-center disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Adding Anamath Entry...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Add Anamath Entry
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AnamathTransactionForm;