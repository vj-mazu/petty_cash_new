import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { systemSettingsApi } from '../services/api';
import { Save, IndianRupee, TrendingUp, AlertCircle, History, Shield } from 'lucide-react';
import { numberToWords } from '../utils/numberToWords';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

interface OpeningBalanceForm {
  openingBalance: number;
}

const schema = yup.object({
  openingBalance: yup.number()
    .required('Opening balance is required')
    .min(0, 'Opening balance cannot be negative')
});

const OpeningBalance: React.FC = () => {
  const { user } = useAuth();
  const [currentOpeningBalance, setCurrentOpeningBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [isSet, setIsSet] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Check if user has admin access
  const hasOpeningBalanceAccess = user?.role === 'admin' || user?.role === 'owner';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset
  } = useForm<OpeningBalanceForm>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      openingBalance: 0
    }
  });

  const watchedOpeningBalance = watch('openingBalance');

  useEffect(() => {
    if (hasOpeningBalanceAccess) {
      fetchCurrentOpeningBalance();
    }
  }, [hasOpeningBalanceAccess]);

  const fetchCurrentOpeningBalance = async () => {
    try {
      setLoading(true);
      const response = await systemSettingsApi.get('global_opening_balance');
      if (response.success && response.data) {
        const value = response.data.value || 0;
        setCurrentOpeningBalance(value);
        setValue('openingBalance', value);
        setIsSet(true);
        setLastUpdated(response.data.updatedAt || null);
      }
    } catch (error: any) {
      // If setting doesn't exist, it's not set yet
      if (error.response?.status === 404) {
        setCurrentOpeningBalance(0);
        setValue('openingBalance', 0);
        setIsSet(false);
      } else {
        toast.error('Failed to fetch opening balance');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: OpeningBalanceForm) => {
    try {
      const response = await systemSettingsApi.set('global_opening_balance', {
        value: data.openingBalance,
        dataType: 'number',
        description: 'Global opening balance for the entire cash management system'
      });

      if (response.success) {
        toast.success(isSet ? 'Opening balance updated successfully!' : 'Opening balance set successfully!');
        setCurrentOpeningBalance(data.openingBalance);
        setIsSet(true);
        setLastUpdated(new Date().toISOString());
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to set opening balance');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Access Control Check */}
      {!hasOpeningBalanceAccess ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 text-center bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-red-900 dark:text-red-300 mb-2">Access Denied</h2>
              <p className="text-red-800 dark:text-red-400 max-w-md mx-auto">
                You don't have permission to access this page.
              </p>
            </div>
            <button
              onClick={() => window.history.back()}
              className="mt-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-all"
            >
              Go Back
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Global Opening Balance</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Set the one-time global opening balance for your entire cash management system</p>
            </div>
          </div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">Important</h3>
                <p className="text-sm text-blue-800 dark:text-blue-300">This is the global opening balance for your system. All calculations are based on this value.</p>
              </div>
            </div>
          </motion.div>

          {/* Current Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <History className="w-6 h-6 mr-2 text-primary-600" />
              Current Status
            </h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Status</p>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isSet ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400'
                    }`}>
                    {isSet ? '✅ Set' : '⚠️ Not Set'}
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Current Opening Balance</p>
                  <p className="text-2xl font-bold text-primary-600">
                    {formatCurrency(currentOpeningBalance)}
                  </p>
                </div>

                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Last Updated</p>
                  <p className="text-sm text-gray-900 dark:text-gray-200">
                    {formatDate(lastUpdated)}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Opening Balance Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-8"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <IndianRupee className="w-6 h-6 mr-2 text-primary-600" />
              {isSet ? 'Update' : 'Set'} Global Opening Balance
            </h2>

            <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
              {/* Opening Balance Input */}
              <div>
                <label htmlFor="openingBalance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Global Opening Balance (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">₹</span>
                  <input
                    {...register('openingBalance')}
                    type="number"
                    step="0.01"
                    min="0"
                    className={`input-field pl-8 text-lg ${errors.openingBalance ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500' : ''
                      }`}
                    placeholder="Enter global opening balance"
                  />
                </div>
                {errors.openingBalance && (
                  <p className="mt-1 text-sm text-danger-600">{errors.openingBalance.message}</p>
                )}
                {watchedOpeningBalance !== undefined && watchedOpeningBalance > 0 && (
                  <p className="mt-2 text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2 italic font-medium">
                    {numberToWords(watchedOpeningBalance)}
                  </p>
                )}
              </div>

              {/* Preview */}
              {watchedOpeningBalance !== undefined && watchedOpeningBalance !== currentOpeningBalance && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg"
                >
                  <div className="flex items-center mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                    <h3 className="font-semibold text-green-900">New Global Opening Balance Preview</h3>
                  </div>
                  <div className="text-green-800">
                    <p className="text-xl font-bold">{formatCurrency(watchedOpeningBalance || 0)}</p>
                    <p className="text-sm">
                      This will become your new global opening balance for the entire system
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    reset({ openingBalance: currentOpeningBalance });
                  }}
                  className="btn-secondary"
                >
                  Reset
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting || watchedOpeningBalance === currentOpeningBalance}
                  className="btn-primary flex items-center"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Save className="w-5 h-5 mr-2" />
                  )}
                  {isSubmitting ? (isSet ? 'Updating...' : 'Setting...') : (isSet ? 'Update Opening Balance' : 'Set Opening Balance')}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default OpeningBalance;