import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Calculator, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { anamathApi, ledgerApi, Ledger } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import DateInput from '../components/DateInput';
import { toTitleCase } from '../utils/textUtils';
import { parseIndianNumber, formatIndianNumber } from '../utils/indianNumberFormat';

interface AnamathFormData {
  date: string;
  ledgerId: string;
  amount: number;
  remarks: string;
}

const CreateAnamath: React.FC = () => {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [formData, setFormData] = useState<AnamathFormData>({
    date: format(new Date(), 'yyyy-MM-dd'),
    ledgerId: '',
    amount: 0,
    remarks: ''
  });
  const [displayAmount, setDisplayAmount] = useState<string>('0');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [nextAnamathId, setNextAnamathId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [ledgerRes, nextNumRes] = await Promise.all([
          ledgerApi.getAll({ limit: 100 }),
          anamathApi.getNextNumber()
        ]);
        if (ledgerRes.success) setLedgers(ledgerRes.data.ledgers);
        if (nextNumRes.success && nextNumRes.data) {
          setNextAnamathId(`A${String(nextNumRes.data.nextTransactionNumber).padStart(3, '0')}`);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      ledgerId: '',
      amount: 0,
      remarks: ''
    });
    setDisplayAmount('0');
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.ledgerId) newErrors.ledgerId = 'Please select a ledger';
    if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Please enter a valid amount greater than 0';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    try {
      setIsSubmitting(true);
      const response = await anamathApi.create({
        date: formData.date,
        ledgerId: formData.ledgerId,
        amount: formData.amount,
        remarks: toTitleCase(formData.remarks)
      });
      if (response.success) {
        toast.success('Anamath entry saved successfully! Ready for next entry.');
        const nextNumRes = await anamathApi.getNextNumber();
        if (nextNumRes.success && nextNumRes.data) {
          setNextAnamathId(`A${String(nextNumRes.data.nextTransactionNumber).padStart(3, '0')}`);
        }
        resetForm();
      } else {
        throw new Error(response.message || 'Failed to create Anamath entry');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create Anamath entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading ledgers..." />;

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/anamath')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-900 dark:text-amber-400">
            Add Anamath
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Record a special entry</p>
        </div>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 sm:p-6 lg:p-8"
      >
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* Type Display */}
          <div className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-center">
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-amber-600" />
              <div>
                <div className="text-sm sm:text-base font-medium text-amber-900 dark:text-amber-300">Anamath</div>
                <div className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">Special entry</div>
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              Date * <span className="text-gray-400 dark:text-gray-500">(Click to change)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, date: format(new Date(), 'yyyy-MM-dd') }))}
                className="px-3 py-2 text-sm sm:text-base bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setFormData(prev => ({ ...prev, date: format(yesterday, 'yyyy-MM-dd') }));
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
                  setFormData(prev => ({ ...prev, date: format(lastWeek, 'yyyy-MM-dd') }));
                }}
                className="px-3 py-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Last Week
              </button>
            </div>
            <DateInput
              value={formData.date}
              onChange={(val) => setFormData(prev => ({ ...prev, date: val }))}
              className="mt-1 input-field border-gray-300 dark:border-gray-600"
            />
          </div>

          {/* Ledger */}
          <div className="space-y-2">
            <label htmlFor="ledgerId" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              Select Ledger *
            </label>
            <div className="relative">
              <select
                id="ledgerId"
                value={formData.ledgerId}
                onChange={(e) => { setFormData(prev => ({ ...prev, ledgerId: e.target.value })); setErrors(prev => ({ ...prev, ledgerId: '' })); }}
                className={`input-field pl-10 sm:pl-12 pr-8 appearance-none bg-white dark:bg-gray-700 ${
                  errors.ledgerId ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              >
                <option value="">Select Ledger</option>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>{ledger.name}</option>
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
            {errors.ledgerId && <p className="text-sm text-red-600">{errors.ledgerId}</p>}
          </div>

          {/* Anamath ID */}
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

          {/* Amount */}
          <div className="space-y-2">
            <label htmlFor="amount" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xl font-bold">₹</span>
              <input
                type="text"
                id="amount"
                value={displayAmount}
                onChange={(e) => {
                  const cleanValue = e.target.value.replace(/[^0-9.,]/g, '');
                  const numericValue = parseIndianNumber(cleanValue);
                  const hasDecimal = cleanValue.includes('.');
                  const formattedValue = hasDecimal ? cleanValue : formatIndianNumber(numericValue, false);
                  setDisplayAmount(formattedValue);
                  setFormData(prev => ({ ...prev, amount: numericValue }));
                  setErrors(prev => ({ ...prev, amount: '' }));
                }}
                onBlur={() => setDisplayAmount(formatIndianNumber(formData.amount, false))}
                className={`w-full py-3 rounded-lg border shadow-sm focus:ring-2 pl-10 sm:pl-12 text-lg sm:text-xl font-medium dark:bg-gray-800 dark:text-gray-100 ${
                  errors.amount ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-200'
                }`}
                placeholder=""
              />
            </div>
            {errors.amount && <p className="text-sm text-red-600">{errors.amount}</p>}
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <label htmlFor="remarks" className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              Remarks (Optional)
            </label>
            <input
              id="remarks"
              type="text"
              value={formData.remarks}
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: toTitleCase(e.target.value) }))}
              className="input-field"
              placeholder=""
            />
          </div>

          {/* Actions */}
          <div className="space-y-4 pt-5 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/anamath')}
                className="px-4 sm:px-5 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 sm:px-6 py-2.5 sm:py-3 border border-transparent rounded-lg text-sm sm:text-base font-medium text-white ${
                  isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Save Anamath
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

export default CreateAnamath;
