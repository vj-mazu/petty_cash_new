import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import DateInput from '../../components/DateInput';
import { transactionApi, ledgerApi, Ledger, CreateTransactionData } from '../../services/api';
import { formatIndianCurrency } from '../../utils/indianNumberFormat';
import IndianNumberInput from '../IndianNumberInput';
import {
  ArrowLeft,
  Save,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Calculator,
  AlertTriangle,
  Info,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner';

interface CombinedFormData {
  // Main transaction fields
  ledgerId: string;
  amount: number;
  date: string;
  description?: string;

  // Anamath entry fields
  anamathAmount: number;
  anamathRemarks: string;
  anamathLedgerId?: string;
}

const CombinedTransactionForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactionType = searchParams.get('type') as 'credit' | 'debit' || 'credit';

  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState(true);
  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);
  const [selectedAnamathLedger, setSelectedAnamathLedger] = useState<Ledger | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<CombinedFormData>({
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      description: '',
      anamathAmount: 0,
      anamathRemarks: ''
    }
  });

  const watchedLedgerId = watch('ledgerId');
  const watchedAmount = watch('amount') || 0;
  const watchedAnamathLedgerId = watch('anamathLedgerId');
  const watchedAnamathAmount = watch('anamathAmount') || 0;

  useEffect(() => {
    fetchLedgers();
  }, []);

  useEffect(() => {
    if (watchedLedgerId) {
      const ledger = ledgers.find(l => l.id === watchedLedgerId);
      setSelectedLedger(ledger || null);
    }
  }, [watchedLedgerId, ledgers]);

  useEffect(() => {
    if (watchedAnamathLedgerId) {
      const ledger = ledgers.find(l => l.id === watchedAnamathLedgerId);
      setSelectedAnamathLedger(ledger || null);
    }
  }, [watchedAnamathLedgerId, ledgers]);

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

  const onSubmit = async (formData: CombinedFormData) => {
    try {

      // Validation
      if (!formData.ledgerId) {
        console.error('No ledger selected for main transaction');
        toast.error('Please select a ledger for the main transaction');
        return;
      }

      if (!formData.amount || formData.amount <= 0) {
        console.error('Invalid main transaction amount:', formData.amount);
        toast.error('Please enter a valid amount greater than 0 for the main transaction');
        return;
      }

      if (!formData.anamathAmount || formData.anamathAmount <= 0) {
        console.error('Invalid anamath amount:', formData.anamathAmount);
        toast.error('Please enter a valid anamath amount greater than 0');
        return;
      }

      if (!formData.anamathRemarks.trim()) {
        console.error('No anamath remarks provided');
        toast.error('Anamath remarks are required');
        return;
      }

      // Check balance for debit transactions
      if (transactionType === 'debit' && selectedLedger && selectedLedger.currentBalance < formData.amount) {
        console.error('Insufficient balance. Current:', selectedLedger.currentBalance, 'Required:', formData.amount);
        toast.error('Insufficient balance for this debit transaction');
        return;
      }

      // Create main transaction data, including anamath details for the backend
      const transactionData: CreateTransactionData = {
        ledgerId: formData.ledgerId,
        remarks: formData.description?.trim() || null, // Allow empty remarks - don't auto-fill
        date: formData.date,
        debitAmount: transactionType === 'debit' ? formData.amount : 0,
        creditAmount: transactionType === 'credit' ? formData.amount : 0,
        transactionType: 'combined', // Crucial for backend to trigger combined logic
        type: transactionType,

        // Pass anamath-related data to the backend
        anamathAmount: formData.anamathAmount ? parseFloat(formData.anamathAmount.toString()) : undefined,
        anamathRemarks: formData.anamathRemarks?.trim() || undefined,
        anamathLedgerId: formData.anamathLedgerId || undefined,
      };

      const transactionResponse = await transactionApi.create(transactionData);

      if (transactionResponse.success) {
        await toast.success(
          `Combined transaction created successfully! ${transactionType === 'credit' ? 'Credit' : 'Debit'}: ${formatIndianCurrency(formData.amount)}, Anamath: ${formatIndianCurrency(formData.anamathAmount)}`
        );
        navigate('/transactions', { state: { refresh: true } }); // Navigate and trigger refresh
      } else {
        console.error('Combined transaction creation failed:', transactionResponse);
        toast.error(transactionResponse.message || `Failed to create combined ${transactionType} transaction`);
      }
    } catch (error: any) {
      console.error('Combined transaction error:', error);
      const errorMessage = error.response?.data?.message || error.message || `Failed to create combined ${transactionType} transaction`;
      toast.error(errorMessage);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatIndianCurrency(amount);
  };

  const isInsufficientBalance = (): boolean => {
    return transactionType === 'debit' && selectedLedger ? selectedLedger.currentBalance < watchedAmount : false;
  };

  const getColorScheme = () => {
    return transactionType === 'credit'
      ? {
        primary: 'emerald',
        bg: 'from-emerald-50 to-green-50',
        border: 'border-emerald-200',
        text: 'text-emerald-900',
        icon: TrendingUp,
        sign: '+'
      }
      : {
        primary: 'red',
        bg: 'from-red-50 to-rose-50',
        border: 'border-red-200',
        text: 'text-red-900',
        icon: TrendingDown,
        sign: '-'
      };
  };

  if (loadingLedgers) {
    return <LoadingSpinner message="Loading ledgers..." />;
  }

  const colorScheme = getColorScheme();
  const IconComponent = colorScheme.icon;

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
          <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${colorScheme.text}`}>
            Add {transactionType === 'credit' ? 'Credit' : 'Debit'} + Anamath
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Create both a {transactionType} transaction and an anamath entry
          </p>
        </div>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`card p-5 sm:p-6 lg:p-8 bg-gradient-to-br ${colorScheme.bg} ${colorScheme.border}`}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
          {/* Combined Transaction Type Display */}
          <div className={`p-4 sm:p-5 rounded-lg border-2 bg-${colorScheme.primary}-100 border-${colorScheme.primary}-300`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <IconComponent className={`w-6 h-6 sm:w-7 sm:h-7 mr-3 text-${colorScheme.primary}-600`} />
                <div>
                  <div className={`text-base sm:text-lg font-medium text-${colorScheme.primary}-900`}>
                    Combined Transaction ({colorScheme.sign})
                  </div>
                  <div className={`text-sm text-${colorScheme.primary}-600`}>
                    {transactionType === 'credit' ? 'Money coming in' : 'Money going out'} + Anamath entry
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-600" />
                <Calculator className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Important Notice */}
          <div className="p-4 sm:p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">Combined Transaction</h4>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  This will create two separate entries: one {transactionType} transaction that affects the ledger balance,
                  and one anamath entry for record-keeping that doesn't affect the balance. Both entries will share the same reference number.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Main Transaction Section */}
            <div className={`p-5 sm:p-6 rounded-xl border-2 bg-${colorScheme.primary}-50 border-${colorScheme.primary}-300`}>
              <h3 className={`text-lg sm:text-xl font-semibold ${colorScheme.text} mb-4 sm:mb-5 flex items-center`}>
                <IconComponent className={`w-5 h-5 mr-2 text-${colorScheme.primary}-600`} />
                {transactionType === 'credit' ? 'Credit' : 'Debit'} Transaction
              </h3>

              <div className="space-y-4">
                {/* Ledger Selection */}
                <div>
                  <label htmlFor="ledgerId" className={`block text-base sm:text-lg font-medium text-${colorScheme.primary}-800 mb-2`}>
                    Select Ledger *
                  </label>
                  <div className="relative">
                    <select
                      id="ledgerId"
                      {...register('ledgerId', { required: 'Ledger is required' })}
                      className={`input-field pl-10 sm:pl-12 pr-8 appearance-none bg-white dark:bg-gray-700 border-${colorScheme.primary}-300 dark:border-${colorScheme.primary}-700 focus:border-${colorScheme.primary}-500 focus:ring-${colorScheme.primary}-500`}
                    >
                      <option value="">Choose a ledger...</option>
                      {ledgers.map((ledger) => (
                        <option key={ledger.id} value={ledger.id}>
                          {ledger.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <BookOpen className={`w-5 h-5 text-${colorScheme.primary}-400`} />
                    </div>
                  </div>
                  {errors.ledgerId && (
                    <p className="mt-1 text-sm text-red-600">{errors.ledgerId.message}</p>
                  )}

                </div>

                {/* Amount */}
                <div>
                  <label htmlFor="amount" className={`block text-base sm:text-lg font-medium text-${colorScheme.primary}-800 mb-2`}>
                    {transactionType === 'credit' ? 'Credit' : 'Debit'} Amount *
                  </label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-${colorScheme.primary}-600 text-lg font-bold z-10`}>₹</span>
                    <IndianNumberInput
                      value={watchedAmount}
                      onChange={(numValue, formattedValue) => {
                        // Update the form value
                        register('amount').onChange({ target: { value: numValue } });
                      }}
                      showDecimals={true}
                      className={`input-field pl-10 text-lg font-semibold border-${colorScheme.primary}-300 focus:border-${colorScheme.primary}-500 focus:ring-${colorScheme.primary}-500 ${isInsufficientBalance() ? 'border-red-500 bg-red-50' : ''
                        }`}
                      placeholder="0.00"
                      minValue={0.01}
                      maxValue={99999999.99}
                    />
                    {/* Hidden input for form validation */}
                    <input
                      {...register('amount', {
                        required: 'Amount is required',
                        min: { value: 0.01, message: 'Amount must be greater than 0' }
                      })}
                      type="hidden"
                    />
                  </div>
                  {errors.amount && (
                    <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
                  )}
                  {isInsufficientBalance() && (
                    <div className="mt-2 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center">
                      <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                      <p className="text-sm text-red-700">
                        Insufficient balance! Available: {formatCurrency(selectedLedger?.currentBalance || 0)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label htmlFor="date" className={`block text-base sm:text-lg font-medium text-${colorScheme.primary}-800 mb-2`}>
                    Date *
                  </label>
                  <DateInput
                    value={watch('date')}
                    onChange={(val) => setValue('date', val)}
                    className={`input-field border-${colorScheme.primary}-300 dark:border-${colorScheme.primary}-700`}
                  />
                  {errors.date && (
                    <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className={`block text-base sm:text-lg font-medium text-${colorScheme.primary}-800 mb-2`}>
                    Description (Optional)
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className={`input-field border-${colorScheme.primary}-300 dark:border-${colorScheme.primary}-700 focus:border-${colorScheme.primary}-500 focus:ring-${colorScheme.primary}-500`}
                    placeholder="Optional description or notes..."
                  />
                </div>
              </div>
            </div>

            {/* Anamath Entry Section */}
            <div className="p-5 sm:p-6 rounded-xl border-2 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800">
              <h3 className="text-lg sm:text-xl font-semibold text-amber-900 dark:text-amber-300 mb-4 sm:mb-5 flex items-center">
                <Calculator className="w-5 h-5 mr-2 text-amber-600 dark:text-amber-400" />
                Anamath Entry
              </h3>

              <div className="space-y-4">
                {/* Anamath Ledger Selection */}
                <div>
                  <label htmlFor="anamathLedgerId" className="block text-base sm:text-lg font-medium text-amber-800 dark:text-amber-400 mb-2">
                    Select Ledger (Optional)
                  </label>
                  <div className="relative">
                    <select
                      id="anamathLedgerId"
                      {...register('anamathLedgerId')}
                      className="input-field pl-10 sm:pl-12 pr-8 appearance-none bg-white dark:bg-gray-700 border-amber-300 dark:border-amber-700 focus:border-amber-500 focus:ring-amber-500"
                    >
                      <option value="">No specific ledger</option>
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

                </div>

                {/* Anamath Amount */}
                <div>
                  <label htmlFor="anamathAmount" className="block text-base sm:text-lg font-medium text-amber-800 dark:text-amber-400 mb-2">
                    Anamath Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-600 text-lg font-bold z-10">₹</span>
                    <IndianNumberInput
                      value={watchedAnamathAmount}
                      onChange={(numValue, formattedValue) => {
                        // Update the form value
                        register('anamathAmount').onChange({ target: { value: numValue } });
                      }}
                      showDecimals={true}
                      className="input-field pl-10 text-lg font-semibold border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                      placeholder="0.00"
                      minValue={0.01}
                      maxValue={99999999.99}
                    />
                    {/* Hidden input for form validation */}
                    <input
                      {...register('anamathAmount', {
                        required: 'Anamath amount is required',
                        min: { value: 0.01, message: 'Amount must be greater than 0' }
                      })}
                      type="hidden"
                    />
                  </div>
                  {errors.anamathAmount && (
                    <p className="mt-1 text-sm text-red-600">{errors.anamathAmount.message}</p>
                  )}
                </div>

                {/* Anamath Remarks */}
                <div>
                  <label htmlFor="anamathRemarks" className="block text-base sm:text-lg font-medium text-amber-800 dark:text-amber-400 mb-2">
                    Anamath Remarks *
                  </label>
                  <textarea
                    {...register('anamathRemarks', {
                      required: 'Anamath remarks are required',
                      minLength: { value: 1, message: 'Remarks cannot be empty' },
                      validate: (value) => {
                        const trimmed = value.trim();
                        if (trimmed.length === 0) {
                          return 'Remarks cannot be empty or contain only spaces';
                        }
                        return true;
                      }
                    })}
                    rows={4}
                    className="input-field border-amber-300 dark:border-amber-700 focus:border-amber-500 focus:ring-amber-500"
                    placeholder="Please provide details for this anamath entry..."
                    maxLength={1000}
                  />
                  {errors.anamathRemarks && (
                    <p className="mt-1 text-sm text-red-600">{errors.anamathRemarks.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Summary */}
          {selectedLedger && watchedAmount > 0 && watchedAnamathAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-xl border-2 shadow-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-300 dark:border-purple-800"
            >
              <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-300 mb-4">Transaction Summary</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Main Transaction Summary */}
                <div className={`p-4 rounded-lg bg-${colorScheme.primary}-50 border border-${colorScheme.primary}-200`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <IconComponent className={`w-5 h-5 mr-2 text-${colorScheme.primary}-600`} />
                      <span className={`font-medium text-${colorScheme.primary}-900`}>
                        {transactionType === 'credit' ? 'Credit' : 'Debit'} Transaction
                      </span>
                    </div>
                    <span className={`text-lg font-bold text-${colorScheme.primary}-700`}>
                      {colorScheme.sign}{formatCurrency(watchedAmount)}
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className={`text-${colorScheme.primary}-600`}>Ledger: {selectedLedger.name}</div>
                  </div>
                </div>

                {/* Anamath Summary */}
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <Calculator className="w-5 h-5 mr-2 text-amber-600" />
                      <span className="font-medium text-amber-900 dark:text-amber-300">Anamath Entry</span>
                    </div>
                    <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
                      {formatCurrency(watchedAnamathAmount)}
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="text-amber-600 dark:text-amber-400">
                      Ledger: {selectedAnamathLedger?.name || 'General entry'}
                    </div>
                    <div className="text-amber-600 dark:text-amber-400">Balance Impact: None</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-300">Total Amount Recorded:</span>
                  <span className="text-lg font-bold text-purple-900 dark:text-purple-200">
                    {formatCurrency(watchedAmount + watchedAnamathAmount)}
                  </span>
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  Reference will be generated to link both entries
                </div>
              </div>
            </motion.div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate('/transactions/create')}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInsufficientBalance()}
              className={`bg-${colorScheme.primary}-600 hover:bg-${colorScheme.primary}-700 text-white px-6 sm:px-8 py-3 rounded-lg text-base sm:text-lg font-medium transition-colors duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating Combined Transaction...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Create Combined Transaction
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CombinedTransactionForm;