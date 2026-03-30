import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm, SubmitHandler } from 'react-hook-form';
import { transactionApi, ledgerApi, Ledger } from '../../services/api';
import { formatIndianCurrency, formatDisplayAmount } from '../../utils/indianNumberFormat';
import {
  Save,
  BookOpen,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner';
import { useNavigate } from 'react-router-dom';

interface AmountTransactionFormData {
  ledgerId: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  description: string;
  reference?: string;
}

const AmountTransactionForm: React.FC = () => {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState(true);
  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setValue
  } = useForm<AmountTransactionFormData>({
    defaultValues: {
      type: 'credit',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      description: '',
      reference: ''
    }
  });
  
  const watchedLedgerId = watch('ledgerId');
  const watchedType = watch('type');
  const watchedAmount = watch('amount');

  useEffect(() => {
    fetchLedgers();
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

  const onSubmit: SubmitHandler<AmountTransactionFormData> = async (formData) => {
    try {
      const transactionData = {
        ledgerId: formData.ledgerId,
        description: formData.description.trim(),
        date: formData.date,
        reference: formData.reference?.trim() || undefined,
        debitAmount: formData.type === 'debit' ? formData.amount : 0,
        creditAmount: formData.type === 'credit' ? formData.amount : 0,
        type: formData.type,
        amount: formData.amount,
        transactionType: 'regular' as const
      };

      const response = await transactionApi.create(transactionData);

      if (response.success) {
        toast.success(
          `${formData.type === 'credit' ? 'Credit' : 'Debit'} transaction of ${formatIndianCurrency(formData.amount)} added successfully!`
        );
        navigate('/transactions');
      }
    } catch (error: any) {
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map((err: any) => err.message).join(', ');
        toast.error(`Validation failed: ${errorMessages}`);
      } else {
        toast.error(error.response?.data?.message || 'Failed to create transaction');
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return formatIndianCurrency(amount);
  };

  const calculateNewBalance = (currentBalance: number, amount: number, type: 'credit' | 'debit') => {
    if (type === 'credit') {
      return currentBalance + amount;
    } else {
      return currentBalance - amount;
    }
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
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-900 dark:text-blue-400">
            Add Amount Transaction
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Record a transaction and choose whether it's credit or debit
          </p>
        </div>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 sm:p-6 lg:p-8"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
          {/* Transaction Type Selection */}
          <div>
            <label className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
              Transaction Type *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <motion.label
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex items-center p-4 sm:p-5 rounded-lg border-2 cursor-pointer transition-all ${
                  watchedType === 'credit'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-emerald-300'
                }`}
              >
                <input
                  {...register('type')}
                  type="radio"
                  value="credit"
                  className="sr-only"
                />
                <div className="flex items-center space-x-3">
                  <div className={`p-2 sm:p-3 rounded-full ${
                    watchedType === 'credit' ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <div className={`text-base sm:text-lg font-medium ${
                      watchedType === 'credit' ? 'text-emerald-900 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      Credit (+)
                    </div>
                    <div className={`text-sm ${
                      watchedType === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Money coming in
                    </div>
                  </div>
                </div>
              </motion.label>

              <motion.label
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  watchedType === 'debit'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-red-300'
                }`}
              >
                <input
                  {...register('type')}
                  type="radio"
                  value="debit"
                  className="sr-only"
                />
                <div className="flex items-center space-x-3">
                  <div className={`p-2 sm:p-3 rounded-full ${
                    watchedType === 'debit' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <div className={`text-base sm:text-lg font-medium ${
                      watchedType === 'debit' ? 'text-red-900 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      Debit (-)
                    </div>
                    <div className={`text-sm ${
                      watchedType === 'debit' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Money going out
                    </div>
                  </div>
                </div>
              </motion.label>
            </div>
          </div>

          {/* Ledger Selection */}
          <div>
            <label htmlFor="ledgerId" className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Ledger *
            </label>
            <div className="relative">
              <select
                id="ledgerId"
                {...register('ledgerId', { required: 'Please select a ledger' })}
                className={`input-field pl-10 sm:pl-12 pr-8 appearance-none bg-white dark:bg-gray-700 ${
                  errors.ledgerId ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
                }`}
              >
                <option value="">Choose a ledger...</option>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <BookOpen className="w-5 h-5 text-gray-400" />
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {errors.ledgerId && (
              <p className="mt-1 text-sm text-red-600">{errors.ledgerId.message}</p>
            )}
            {selectedLedger && (
              <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-300">{selectedLedger.name}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Current Balance</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      selectedLedger.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(selectedLedger.currentBalance)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl font-bold">₹</span>
              <input
                {...register('amount', { 
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be greater than 0' },
                  max: { value: 999999999.99, message: 'Amount cannot exceed 999,999,999.99' }
                })}
                type="number"
                step="0.01"
                min="0.01"
                className={`input-field pl-10 sm:pl-12 text-lg sm:text-xl font-semibold ${
                  errors.amount ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
                }`}
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description *
            </label>
            <input
              {...register('description', { 
                required: 'Description is required',
                maxLength: { value: 500, message: 'Description cannot exceed 500 characters' }
              })}
              type="text"
              className={`input-field ${
                errors.description ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
              }`}
              placeholder="Enter transaction description..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date *
            </label>
            <input
              {...register('date', { required: 'Date is required' })}
              type="date"
              className={`input-field ${
                errors.date ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          {/* Reference */}
          <div>
            <label htmlFor="reference" className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reference (Optional)
            </label>
            <input
              {...register('reference', { 
                maxLength: { value: 100, message: 'Reference cannot exceed 100 characters' }
              })}
              type="text"
              className={`input-field ${
                errors.reference ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
              }`}
              placeholder="Optional reference number or note..."
            />
            {errors.reference && (
              <p className="mt-1 text-sm text-red-600">{errors.reference.message}</p>
            )}
          </div>

          {/* New Balance Preview */}
          {selectedLedger && watchedAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border-2 shadow-lg ${
                watchedType === 'credit'
                  ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300'
                  : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-sm font-bold ${
                    watchedType === 'credit' ? 'text-emerald-800' : 'text-red-800'
                  }`}>
                    After this {watchedType} transaction
                  </div>
                </div>
                <div className={`text-right ${
                  watchedType === 'credit' ? 'text-emerald-900' : 'text-red-900'
                }`}>
                  <div className="text-xl font-bold">
                    {formatCurrency(calculateNewBalance(
                      selectedLedger.currentBalance,
                      watchedAmount || 0,
                      watchedType
                    ))}
                  </div>
                  <div className="text-xs opacity-75">
                    Current: {formatCurrency(selectedLedger.currentBalance)}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <div className={`text-sm font-medium ${
                  watchedType === 'credit' ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {watchedType === 'credit' ? '+' : '-'}{formatCurrency(watchedAmount || 0)}
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
              disabled={isSubmitting}
              className="btn-primary flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Adding Transaction...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Add Transaction
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AmountTransactionForm;