import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ledgerApi } from '../services/api';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import { toTitleCase } from '../utils/textUtils';

interface CreateLedgerForm {
  name: string;
  description: string;
}

const schema = yup.object({
  name: yup.string()
    .required('Ledger name is required')
    .min(1, 'Name must be at least 1 character')
    .max(100, 'Name must be less than 100 characters'),
  description: yup.string()
    .notRequired()
    .max(500, 'Remarks must be less than 500 characters')
});

const CreateLedger: React.FC = () => {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateLedgerForm>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      description: ''
    }
  });

  // Handle input changes with title case formatting
  const handleInputChange = (fieldName: keyof CreateLedgerForm, value: string) => {
    const titleCaseValue = toTitleCase(value);
    setValue(fieldName, titleCaseValue);
  };

  const onSubmit = async (data: CreateLedgerForm) => {
    try {
      // Apply title case formatting to name and description
      const formattedData = {
        name: toTitleCase(data.name.trim()),
        description: data.description.trim() ? toTitleCase(data.description.trim()) : undefined,
        ledgerType: 'asset' as const
      };

      const response = await ledgerApi.create(formattedData);

      if (response.success) {
        toast.success('Ledger created successfully!');
        navigate('/ledgers');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create ledger');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/ledgers')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.button>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Create New Ledger</h1>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 sm:p-6 lg:p-8"
      >
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-5 sm:space-y-6">
          {/* Ledger Name */}
          <div className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm sm:text-base lg:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ledger Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                className={`block w-full px-4 py-3 text-base rounded-lg border shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all duration-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 dark:border-gray-600'
                  }`}
                {...register('name')}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm sm:text-base lg:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                Remarks <span className="text-gray-500 dark:text-gray-400 text-sm font-normal">(Optional)</span>
              </label>
              <textarea
                id="description"
                rows={3}
                className={`block w-full px-4 py-3 text-base rounded-lg border shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all duration-200 resize-none dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 ${errors.description ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 dark:border-gray-600'
                  }`}
                {...register('description')}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end pt-5 border-t border-gray-100 dark:border-gray-700 space-x-3 sm:space-x-4">
            <button
              type="button"
              onClick={() => navigate('/ledgers')}
              className="px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="px-6 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-200 transition-all duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              {isSubmitting ? 'Creating...' : 'Create Ledger'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateLedger;