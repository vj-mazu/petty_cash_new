import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { transactionApi, ledgerApi, Ledger, CreateTransactionData } from '../../services/api';
import { formatIndianCurrency } from '../../utils/indianNumberFormat';
import {
  ArrowLeft,
  Save,
  BookOpen,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner';
import { useOpeningBalanceContext } from '../../contexts/OpeningBalanceContext';

interface CreditFormData {
  ledgerId: string;
  amount: number;
  date: string;
  reference?: string;
  remarks?: string;
}

const CreditTransactionForm: React.FC = () => {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState(true);
  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);
  const { updateAfterTransaction } = useOpeningBalanceContext();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<CreditFormData>({
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      reference: ''
    }
  });

  const watchedLedgerId = watch('ledgerId');
  const watchedAmount = watch('amount') || 0;

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

  const onSubmit = async (formData: CreditFormData) => {
    try {

      // Validation
      if (!formData.ledgerId) {
        console.error('No ledger selected');
        toast.error('Please select a ledger');
        return;
      }

      if (!formData.amount || formData.amount <= 0) {
        console.error('Invalid amount:', formData.amount);
        toast.error('Please enter a valid amount greater than 0');
        return;
      }



      // Create credit transaction
      const transactionData: CreateTransactionData = {
        ledgerId: formData.ledgerId,
        remarks: formData.remarks?.trim() || undefined,
        date: formData.date,
        reference: formData.reference?.trim() || undefined,
        debitAmount: 0,
        creditAmount: formData.amount,
        type: 'credit',
        transactionType: 'regular'
      };

      const response = await transactionApi.create(transactionData);

      if (response.success) {

        // Update opening balance for the main transaction
        try {
          await updateAfterTransaction(transactionData, formData.ledgerId);
        } catch (balanceError) {
        }

        toast.success(
          `Credit transaction of ${formatIndianCurrency(formData.amount)} added successfully!`
        );

        navigate('/transactions');
      } else {
        console.error('Credit transaction creation failed:', response);
        toast.error(response.message || 'Failed to create credit transaction');
      }
    } catch (error: any) {
      console.error('Credit transaction submission error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create credit transaction';
      toast.error(errorMessage);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatIndianCurrency(amount);
  };

  const calculateNewBalance = (currentBalance: number, amount: number) => {
    return currentBalance + amount;
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
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-emerald-900 dark:text-emerald-400">Add Credit Transaction</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Record money coming in</p>
        </div>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 sm:p-6 lg:p-8 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
          {/* Transaction Type Display */}
          <div className="p-4 sm:p-5 rounded-lg border-2 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700">
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 mr-3 text-emerald-600 dark:text-emerald-400" />
              <div>
                <div className="text-base sm:text-lg font-medium text-emerald-900 dark:text-emerald-300">Credit Transaction (+)</div>
                <div className="text-sm sm:text-base text-emerald-600 dark:text-emerald-400">Money coming in</div>
              </div>
            </div>
          </div>

          {/* Ledger Selection */}
          <div>
            <label htmlFor="ledgerId" className="block text-base sm:text-lg font-medium text-emerald-800 dark:text-emerald-400 mb-2">
              Select Ledger *
            </label>
            <div className="relative">
              <select
                id="ledgerId"
                {...register('ledgerId', { required: 'Ledger is required' })}
                className="input-field pl-10 sm:pl-12 pr-8 appearance-none bg-white dark:bg-gray-700 border-emerald-300 dark:border-emerald-700 focus:border-emerald-500 focus:ring-emerald-500"
              >
                <option value="">Choose a ledger...</option>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <BookOpen className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            {errors.ledgerId && (
              <p className="mt-1 text-sm text-red-600">{errors.ledgerId.message}</p>
            )}
            {selectedLedger && (
              <div className="mt-3 p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg border border-emerald-300 dark:border-emerald-700">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-emerald-900 dark:text-emerald-300">{selectedLedger.name}</div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">Current Balance</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(selectedLedger.currentBalance)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-base sm:text-lg font-medium text-emerald-800 dark:text-emerald-400 mb-2">
              Credit Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-emerald-600 dark:text-emerald-400 text-xl font-bold">₹</span>
              <input
                {...register('amount', {
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be greater than 0' }
                })}
                type="number"
                step="0.01"
                min="0.01"
                className="input-field w-full pl-10 sm:pl-12 py-3 sm:py-4 text-xl sm:text-2xl font-semibold border-emerald-300 dark:border-emerald-700 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-base sm:text-lg font-medium text-emerald-800 dark:text-emerald-400 mb-2">
              Date *
            </label>
            <input
              {...register('date', { required: 'Date is required' })}
              type="date"
              className="input-field border-emerald-300 dark:border-emerald-700 focus:border-emerald-500 focus:ring-emerald-500"
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          {/* Reference */}
          <div>
            <label htmlFor="reference" className="block text-base sm:text-lg font-medium text-emerald-800 dark:text-emerald-400 mb-2">
              Reference (Optional)
            </label>
            <input
              {...register('reference')}
              type="text"
              className="input-field border-emerald-300 dark:border-emerald-700 focus:border-emerald-500 focus:ring-emerald-500"
              placeholder="Optional reference number or note..."
            />
          </div>

          {/* Remarks */}
          <div>
            <label htmlFor="remarks" className="block text-base sm:text-lg font-medium text-emerald-800 dark:text-emerald-400 mb-2">
              Remarks (Optional)
            </label>
            <input
              {...register('remarks')}
              type="text"
              className="input-field border-emerald-300 dark:border-emerald-700 focus:border-emerald-500 focus:ring-emerald-500"
              placeholder="Optional remarks..."
            />
          </div>

          {/* New Balance Preview */}
          {selectedLedger && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border-2 shadow-lg bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 border-emerald-400 dark:border-emerald-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    After this credit transaction
                  </div>
                </div>
                <div className="text-right text-emerald-900 dark:text-emerald-200">
                  <div className="text-xl font-bold">
                    {formatCurrency(calculateNewBalance(selectedLedger.currentBalance, watchedAmount))}
                  </div>
                  <div className="text-xs opacity-75">
                    Current: {formatCurrency(selectedLedger.currentBalance)}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(watchedAmount)}
                </div>
              </div>
            </motion.div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-emerald-200 dark:border-emerald-800">
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 sm:px-8 py-3 rounded-lg text-base sm:text-lg font-medium transition-colors duration-200 flex items-center disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Adding Credit...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreditTransactionForm;