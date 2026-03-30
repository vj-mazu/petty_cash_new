import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ledgerApi, Ledger } from '../services/api';
import { toast } from 'react-toastify';
import { ArrowLeft, Filter } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import DateInput from '../components/DateInput';

const TransactionFilters: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State for filters, initialized from URL search params
  const [selectedLedger, setSelectedLedger] = useState(searchParams.get('ledgerId') || 'all');
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || 'all');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [txNumberFilter, setTxNumberFilter] = useState(searchParams.get('txNumber') || '');
  
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedgers = async () => {
      try {
        setLoading(true);
        const response = await ledgerApi.getAll({ limit: 100 });
        if (response.success) {
          setLedgers(response.data.ledgers);
        }
      } catch (error) {
        console.error('Failed to fetch ledgers:', error);
        toast.error('Failed to load ledgers');
      } finally {
        setLoading(false);
      }
    };
    fetchLedgers();
  }, []);

  const handleApplyFilters = () => {
    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error('Start date must be before or equal to end date');
      return;
    }

    const newSearchParams = new URLSearchParams();

    if (selectedLedger !== 'all') newSearchParams.set('ledgerId', selectedLedger);
    if (selectedType !== 'all') newSearchParams.set('type', selectedType);
    if (startDate) newSearchParams.set('startDate', startDate);
    if (endDate) newSearchParams.set('endDate', endDate);
    if (txNumberFilter) newSearchParams.set('txNumber', txNumberFilter);

    // Show success message if filters are applied
    if (newSearchParams.toString()) {
      toast.success('Filters applied successfully');
    }

    navigate(`/transactions/list?${newSearchParams.toString()}`);
  };

  const clearFilters = () => {
    setSelectedLedger('all');
    setSelectedType('all');
    setStartDate('');
    setEndDate('');
    setTxNumberFilter('');
    toast.info('All filters cleared');
    navigate('/transactions/list');
  };

  if (loading) {
    return <LoadingSpinner message="Loading filters..." />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center space-x-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/transactions/list')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Filter Transactions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Refine the list of transactions</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg space-y-6 dark:border dark:border-gray-700"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transaction Number</label>
          <input
            type="text"
            value={txNumberFilter}
            onChange={(e) => setTxNumberFilter(e.target.value)}
            placeholder="Search by TX number"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ledger</label>
          <select
            value={selectedLedger}
            onChange={(e) => setSelectedLedger(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="all">All Ledgers</option>
            {ledgers.map((ledger: Ledger) => (
              <option key={ledger.id} value={ledger.id}>{ledger.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="all">All Types</option>
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
          <DateInput
            value={startDate}
            onChange={(val) => setStartDate(val)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
          <DateInput
            value={endDate}
            onChange={(val) => setEndDate(val)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200"
          />
        </div>

        <div className="flex justify-between items-center pt-6 border-t dark:border-gray-700 gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={clearFilters}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            Clear Filters
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleApplyFilters}
            className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            <Filter className="w-5 h-5 mr-2" />
            Apply Filters
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default TransactionFilters;