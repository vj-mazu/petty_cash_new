import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { transactionApi, ledgerApi, anamathApi, Ledger, CreateTransactionData } from '../services/api';
import { parseIndianNumber, formatIndianNumber } from '../utils/indianNumberFormat';
import {
  ArrowLeft,
  Save,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Calculator
} from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import DateInput from '../components/DateInput';
import { toTitleCase } from '../utils/textUtils';

type TransactionType = 'debit' | 'credit' | 'amount' | 'anamath' | 'combined';

interface CreateTransactionForm {
  ledgerId?: string;
  amount: number;
  type: TransactionType;
  date: string;
  description?: string;
  remarks?: string;
  saveOption?: 'single' | 'withAnamath';
}

interface CreateTransactionProps {
  type?: TransactionType;
}

const CreateTransaction: React.FC<CreateTransactionProps> = ({ type: propType }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState(true);

  const [isFormSubmitting, setIsFormSubmitting] = useState<boolean>(false);
  const [nextTransactionNumber, setNextTransactionNumber] = useState<number | null>(null);
  const [loadingTransactionNumber, setLoadingTransactionNumber] = useState(true);
  const [nextAnamathId, setNextAnamathId] = useState<string | null>(null);
  const [loadingAnamathId, setLoadingAnamathId] = useState(true);

  // Determine transaction type from props or URL
  const getTransactionType = (): TransactionType => {
    if (propType) return propType;
    const path = location.pathname;
    if (path.includes('/credit')) return 'credit';
    if (path.includes('/debit')) return 'debit';
    if (path.includes('/amount')) return 'amount';
    if (path.includes('/anamath')) return 'anamath';
    return 'credit'; // default
  };

  const transactionType = getTransactionType();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
    clearErrors,
    setError
  } = useForm<CreateTransactionForm>({
    defaultValues: {
      type: transactionType,
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      remarks: '',
      ledgerId: '',
      saveOption: 'single'
    },
    mode: 'onChange',
    criteriaMode: 'all'
  });

  // Watch form values
  const watchedLedgerId = watch('ledgerId');
  const watchedAmount = watch('amount');

  // State for formatted amount display
  const [displayAmount, setDisplayAmount] = useState<string>('0');

  // Reset form function - clears form and prepares for next entry
  const resetForm = () => {
    reset({
      type: transactionType,
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      remarks: '',
      ledgerId: '',
      saveOption: 'single'
    });
    setDisplayAmount('0');
    clearErrors();
  };

  // Register amount field with validation
  useEffect(() => {
    register('amount', {
      required: 'Amount is required',
      min: {
        value: 0.01,
        message: 'Must be greater than 0'
      }
    });
  }, [register]);

  useEffect(() => {
    fetchLedgers();
    if (transactionType !== 'anamath') {
      fetchNextTransactionNumber();
    }
    // Always fetch anamath ID for combined save functionality
    fetchNextAnamathId();
  }, [transactionType]);

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

  const fetchNextTransactionNumber = async () => {
    try {
      setLoadingTransactionNumber(true);
      const response = await transactionApi.getNextNumber();
      if (response.success && response.data) {
        setNextTransactionNumber(response.data.nextTransactionNumber);
      }
    } catch (error: any) {
      console.error('Failed to fetch next transaction number:', error);
    } finally {
      setLoadingTransactionNumber(false);
    }
  };

  const fetchNextAnamathId = async () => {
    try {
      setLoadingAnamathId(true);
      // Use fast dedicated endpoint instead of fetching all entries
      const response = await anamathApi.getNextNumber();

      if (response.success && response.data) {
        const nextNumber = response.data.nextTransactionNumber;
        const nextId = `A${String(nextNumber).padStart(3, '0')}`;
        setNextAnamathId(nextId);
      } else {
        setNextAnamathId(null);
      }
    } finally {
      setLoadingAnamathId(false);
    }
  };

  const handleAnamath = useCallback(async (formData: CreateTransactionForm) => {
    try {
      const anamathData = {
        date: formData.date,
        amount: formData.amount,
        remarks: formData.remarks?.trim() ? toTitleCase(formData.remarks.trim()) : '',
        ledgerId: formData.ledgerId
      };

      const response = await anamathApi.create(anamathData);

      if (!response.success) {
        throw new Error(response.message || 'Failed to save Anamath entry');
      }

      if (!response.data) {
        throw new Error('Invalid response from server when saving Anamath entry');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }, []);

  const handleRegularTransaction = useCallback(async (formData: CreateTransactionForm) => {
    if (!formData.ledgerId) {
      return null;
    }

    const isCredit = transactionType === 'credit';
    const remarks = formData.remarks?.trim() ? toTitleCase(formData.remarks.trim()) : null;

    try {
      const amount = Number(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }

      const transactionData = {
        ledgerId: formData.ledgerId,
        remarks, // Changed from 'description' to 'remarks' to match backend
        date: formData.date,
        debitAmount: isCredit ? 0 : amount,
        creditAmount: isCredit ? amount : 0,
        type: isCredit ? 'credit' as const : 'debit' as const,
        transactionType: 'regular' as const,
        referenceNumber: `${isCredit ? 'CR' : 'DR'}-${Date.now()}`
      };

      const response = await transactionApi.create(transactionData);

      if (response && typeof response === 'object') {
        if ('success' in response && response.success === false) {
          throw new Error(response.message || 'Failed to save transaction');
        }
        return response;
      }

      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error('Failed to save transaction');
      throw error;
    }
  }, [transactionType]);

  const handleFormSubmit = async (formData: CreateTransactionForm, saveOption: 'single' | 'withAnamath' = 'single') => {
    setIsFormSubmitting(true);

    try {
      const amount = Number(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        setError('amount', { type: 'min', message: 'Please enter a valid amount greater than 0' });
        setIsFormSubmitting(false);
        return;
      }
      formData.amount = amount;

      if (saveOption === 'withAnamath' && transactionType !== 'anamath') {
        const transactionData: CreateTransactionData = {
          ledgerId: formData.ledgerId!,
          date: formData.date,
          remarks: formData.remarks?.trim() || null, // Transaction remarks optional - can be empty
          debitAmount: transactionType === 'debit' ? formData.amount : 0,
          creditAmount: transactionType === 'credit' ? formData.amount : 0,
          transactionType: 'combined',
          reference: 'A',
          referenceNumber: `COMB-${Date.now()}`,
          type: transactionType === 'amount' ? 'credit' : transactionType as 'debit' | 'credit' | 'anamath',
          // Add anamath-specific fields for combined transaction
          anamathAmount: formData.amount,
          // Anamath remarks: Use user's remarks if provided, otherwise send null (backend will use fallback)
          anamathRemarks: formData.remarks?.trim() ? toTitleCase(formData.remarks.trim()) : null,
          anamathLedgerId: formData.ledgerId
        };

        const transactionResponse = await transactionApi.create(transactionData);

        if (transactionResponse.success) {
          await fetchNextAnamathId();
          await fetchNextTransactionNumber();
          toast.success(`Combined transaction created successfully! Ready for next entry.`);
          // Add small delay to let backend finish balance recalculation
          await new Promise(resolve => setTimeout(resolve, 500));
          // STAY ON SAME PAGE - Reset form for next entry
          resetForm();
        } else {
          toast.error(transactionResponse.message || 'Failed to create combined transaction');
        }
      } else if (transactionType === 'anamath') {
        const response = await handleAnamath(formData);
        if (response && response.success) {
          await fetchNextAnamathId();
          toast.success('Anamath entry saved successfully! Ready for next entry.');
          resetForm();
        }
      } else {
        const response = await handleRegularTransaction(formData);
        if (response?.success) {
          await fetchNextTransactionNumber();
          toast.success('Transaction saved successfully! Ready for next entry.');
          // Add small delay to let backend finish balance recalculation
          await new Promise(resolve => setTimeout(resolve, 500));
          // STAY ON SAME PAGE - Reset form for next entry
          resetForm();
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'An error occurred during submission.';
      toast.error(errorMessage);
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const onSubmit = (data: CreateTransactionForm, saveOptionOrEvent?: 'single' | 'withAnamath' | React.BaseSyntheticEvent) => {
    let saveOption: 'single' | 'withAnamath' = 'single';

    if (typeof saveOptionOrEvent === 'string') {
      saveOption = saveOptionOrEvent;
    } else if (saveOptionOrEvent && saveOptionOrEvent.nativeEvent instanceof SubmitEvent) {
      const submitter = (saveOptionOrEvent.nativeEvent as any).submitter as HTMLButtonElement | null;
      if (submitter?.name === 'withAnamath') {
        saveOption = 'withAnamath';
      }
    }

    handleFormSubmit(data, saveOption);
  };

  if (loadingLedgers) {
    return <LoadingSpinner message="Loading ledgers..." />;
  }
  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/transactions')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.button>
        <div>
          <h1 className={`text-xl sm:text-2xl lg:text-3xl font-bold ${transactionType === 'credit' ? 'text-emerald-900 dark:text-emerald-400' :
            transactionType === 'debit' ? 'text-red-900 dark:text-red-400' :
              'text-amber-900 dark:text-amber-400'
            }`}>
            Add {transactionType === 'credit' ? 'Credit' : transactionType === 'debit' ? 'Debit' : 'Anamath'}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {transactionType === 'credit' ? 'Record money coming in' :
              transactionType === 'debit' ? 'Record money going out' :
                'Record a special entry'}
          </p>
        </div>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 sm:p-6 lg:p-8"
      >
        <form onSubmit={handleSubmit((data, e) => onSubmit(data, e))} className="space-y-5 sm:space-y-6">
          {/* Transaction Type Display */}
          <div className={`p-3 rounded-lg border ${transactionType === 'credit' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
            transactionType === 'debit' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
              'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
            <div className="flex items-center">
              {transactionType === 'credit' ? (
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-emerald-600" />
              ) : transactionType === 'debit' ? (
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-red-600" />
              ) : (
                <Calculator className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-amber-600" />
              )}
              <div>
                <div className={`text-sm sm:text-base font-medium ${transactionType === 'credit' ? 'text-emerald-900 dark:text-emerald-300' :
                  transactionType === 'debit' ? 'text-red-900 dark:text-red-300' :
                    'text-amber-900 dark:text-amber-300'
                  }`}>
                  {transactionType === 'credit' ? 'Credit (+)' :
                    transactionType === 'debit' ? 'Debit (-)' :
                      'Anamath'}
                </div>
                <div className={`text-xs sm:text-sm ${transactionType === 'credit' ? 'text-emerald-600 dark:text-emerald-400' :
                  transactionType === 'debit' ? 'text-red-600 dark:text-red-400' :
                    'text-amber-600 dark:text-amber-400'
                  }`}>
                  {transactionType === 'credit' ? 'Money coming in' :
                    transactionType === 'debit' ? 'Money going out' :
                      'Special entry'}
                </div>
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label htmlFor="date" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              Date * <span className="text-gray-400 dark:text-gray-500">(Click to change)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setValue('date', format(new Date(), 'yyyy-MM-dd'))}
                className="px-3 py-2 text-sm sm:text-base bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setValue('date', format(yesterday, 'yyyy-MM-dd'));
                }}
                className="px-3 py-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => {
                  const lastWeek = new Date();
                  lastWeek.setDate(lastWeek.getDate() - 7);
                  setValue('date', format(lastWeek, 'yyyy-MM-dd'));
                }}
                className="px-3 py-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Last Week
              </button>
            </div>
            <DateInput
              value={watch('date')}
              onChange={(val) => setValue('date', val)}
              className={`mt-1 input-field ${errors.date ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              title="Click to select a different date"
            />
            {errors.date && (
              <p className="text-sm text-red-600">{errors.date?.message}</p>
            )}
          </div>

          {/* Ledger Selection - Hidden for Anamath */}
          {transactionType !== 'anamath' && (
            <div className="space-y-2">
              <label htmlFor="ledgerId" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                Select Ledger *
              </label>
              <div className="relative">
                <select
                  id="ledgerId"
                  {...register('ledgerId')}
                  className={`input-field pl-10 sm:pl-12 pr-8 appearance-none bg-white dark:bg-gray-700 ${errors.ledgerId ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                  required={transactionType === 'debit' || transactionType === 'credit'}
                >
                  <option value="">Select Ledger</option>
                  {ledgers.map((ledger) => (
                    <option key={ledger.id} value={ledger.id}>
                      {ledger.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-4 pointer-events-none">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {errors.ledgerId && (
                <p className="text-sm text-red-600">{errors.ledgerId?.message}</p>
              )}
              {/* Balance display removed - not needed for Credit/Debit transaction creation */}
            </div>
          )}

          {/* Transaction ID - Auto-generated readonly field for Credit/Debit */}
          {transactionType !== 'anamath' && (
            <div className="space-y-2">
              <label className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                Transaction ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loadingTransactionNumber ? 'Loading...' : nextTransactionNumber ? `T${String(nextTransactionNumber).padStart(2, '0')}` : 'Auto'}
                  className="input-field bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 cursor-not-allowed"
                  readOnly
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-sm text-gray-400">Auto</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {nextTransactionNumber ? `Next: T${String(nextTransactionNumber).padStart(2, '0')}` : 'Auto-generated'}
              </p>
            </div>
          )}

          {/* Anamath ID - Auto-generated readonly field for Anamath */}
          {transactionType === 'anamath' && (
            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                Anamath ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value="A + Auto-generated number"
                  className="input-field bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 cursor-not-allowed"
                  readOnly
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-xs text-gray-400">Auto</span>
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {nextAnamathId ? `Next available anamath ID: ${nextAnamathId}` : 'A unique anamath ID (A001, A002, etc.) will be assigned automatically'}
              </p>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <label htmlFor="amount" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xl font-bold">₹</span>
              <input
                type="text"
                value={displayAmount}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  // Remove non-numeric characters except commas and dots
                  const cleanValue = inputValue.replace(/[^0-9.,]/g, '');

                  // Parse the cleaned value to get actual number
                  const numericValue = parseIndianNumber(cleanValue);

                  // Format for display (without decimals for whole numbers)
                  const hasDecimal = cleanValue.includes('.');
                  const formattedValue = hasDecimal
                    ? cleanValue // Keep user's decimal input as-is while typing
                    : formatIndianNumber(numericValue, false);

                  setDisplayAmount(formattedValue);
                  setValue('amount', numericValue);
                  clearErrors('amount');
                }}
                onBlur={() => {
                  // On blur, ensure proper formatting
                  const formatted = formatIndianNumber(watchedAmount, false);
                  setDisplayAmount(formatted);
                }}
                className={`w-full py-3 rounded-lg border shadow-sm focus:ring-2 pl-10 sm:pl-12 text-lg sm:text-xl font-medium dark:bg-gray-800 dark:text-gray-100 ${errors.amount
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-200'
                  }`}
                placeholder=""
              />
            </div>
            {errors.amount && (
              <p className="text-sm text-red-600">{errors.amount?.message}</p>
            )}
          </div>


          {/* Remarks - Only for Credit/Debit */}
          {(transactionType === 'credit' || transactionType === 'debit') && (
            <div className="space-y-2">
              <label htmlFor="remarks" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                Remarks (Optional)
              </label>
              <input
                {...register('remarks')}
                type="text"
                className="input-field"
                placeholder=""
              />
            </div>
          )}

          {/* Form Actions */}
          <div className="space-y-4 pt-5 border-t border-gray-200 dark:border-gray-700">
            {/* Combined Save Options - Only for Credit transactions */}
            {transactionType === 'credit' && (
              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-gray-600 dark:text-gray-400">Credit TX #:</div>
                    <div className="font-mono text-right text-gray-900 dark:text-gray-200">
                      {loadingTransactionNumber ? '...' : (nextTransactionNumber ? `T${String(nextTransactionNumber).padStart(2, '0')}` : '—')}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">Anamath ID:</div>
                    <div className="font-mono text-right text-gray-900 dark:text-gray-200">
                      {loadingAnamathId ? '...' : (nextAnamathId || '—')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => handleSubmit(data => onSubmit(data, 'withAnamath'))()}
                    disabled={isFormSubmitting}
                    className={`flex-1 flex items-center justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg text-sm sm:text-base font-medium text-white ${isFormSubmitting
                      ? 'bg-indigo-400'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                  >
                    <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Save + Anamath
                  </button>
                  <div className="text-sm text-gray-500 dark:text-gray-400">or</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="px-4 sm:px-5 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(data => onSubmit(data, 'single'))()}
                disabled={isFormSubmitting}
                className={`px-5 sm:px-6 py-2.5 sm:py-3 border border-transparent rounded-lg text-sm sm:text-base font-medium text-white ${isFormSubmitting
                  ? 'bg-indigo-400'
                  : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
              >
                {isFormSubmitting ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    {transactionType === 'anamath' ? 'Save' : `Save ${transactionType}`}
                  </div>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateTransaction;
