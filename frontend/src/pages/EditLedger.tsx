import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ledgerApi, type Ledger, type CreateLedgerData } from '../services/api';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import { toTitleCase } from '../utils/textUtils';

const EditLedger: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
  }>({
    name: '',
    description: ''
  });
  
  // Store the full ledger data for reference
  const [ledger, setLedger] = useState<Ledger | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // If we're editing, fetch the specific ledger
        if (id) {
          const response = await ledgerApi.getById(id);
          
          if (response.success && response.data?.ledger) {
            const { name, description } = response.data.ledger;
            
            setLedger(response.data.ledger);
            setFormData({
              name: name || '',
              description: description || ''
            });
          } else {
            throw new Error(response.message || 'Failed to load ledger');
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load ledger data');
        navigate('/ledgers');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !ledger) return;
    
    try {
      setSaving(true);
      // Prepare the update data with proper types and title case formatting
      const updateData: Partial<CreateLedgerData> = {
        name: toTitleCase(formData.name.trim()),
        description: formData.description?.trim() ? toTitleCase(formData.description.trim()) : undefined
      };
      
      
      const response = await ledgerApi.update(id, updateData);
      
      if (response.success && response.data?.ledger) {
        toast.success('Ledger updated successfully');
        // Update the local state with the updated ledger data
        setLedger(response.data.ledger);
        // Navigate back after a short delay to show the success message
        setTimeout(() => navigate('/ledgers'), 1000);
      } else {
        throw new Error(response.message || 'Failed to update ledger');
      }
    } catch (error: any) {
      console.error('Error updating ledger:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update ledger';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <LoadingSpinner message="Loading ledger..." />;
  }


  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Edit Ledger</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-400">Update the details of this ledger account.</p>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5 sm:space-y-6"
      >
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-5 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
          {/* Ledger Name */}
          <div>
            <label htmlFor="name" className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300">
              Ledger Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="mt-2 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base p-3 border dark:bg-gray-700 dark:text-gray-200"
              placeholder="Enter ledger name"
            />
          </div>

          {/* Remarks */}
          <div>
            <label htmlFor="description" className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Remarks
            </label>
            <div className="relative">
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base p-3 border dark:bg-gray-700 dark:text-gray-200"
                placeholder="Enter any additional details or reference information"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.description ? `${formData.description.length}/500 characters` : 'Optional: Add any reference or important notes about this ledger'}
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 sm:space-x-4 pt-5 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate('/ledgers')}
              className="inline-flex items-center px-5 sm:px-6 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 shadow-sm text-sm sm:text-base font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-5 sm:px-6 py-2.5 sm:py-3 border border-transparent text-sm sm:text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
};

export default EditLedger;