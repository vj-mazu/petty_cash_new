import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { ledgerApi, Ledger } from '../services/api';
import { toast } from 'react-toastify';
import DateInput from '../components/DateInput';

const AnamathFilters: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLedger, setSelectedLedger] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState<boolean>(true);

  const fetchLedgers = useCallback(async () => {
    try {
      setLoadingLedgers(true);
      const response = await ledgerApi.getAll({ limit: 100 });
      if (response.success) {
        setLedgers(response.data.ledgers);
      }
    } catch (error) {
      console.error('Failed to fetch ledgers:', error);
      toast.error('Failed to load ledgers');
    } finally {
      setLoadingLedgers(false);
    }
  }, []);

  useEffect(() => {
    fetchLedgers();
  }, [fetchLedgers]);

  const handleApplyFilters = () => {
    // TODO: Implement filter application logic
    // This will likely involve passing the filter state back to the Anamath page
    // For now, we can just navigate back
    navigate('/anamath');
  };

  return (
    <div className="space-y-6 p-4">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-950 text-white p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Anamath Filters</h1>
          <p className="text-blue-100 mt-1">Filter Anamath transaction records</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow dark:border dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by remarks or amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="ledger" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ledger
            </label>
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-400 w-5 h-5" />
              <select
                id="ledger"
                value={selectedLedger}
                onChange={(e) => setSelectedLedger(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white dark:bg-gray-700 dark:text-gray-200"
                disabled={loadingLedgers}
              >
                <option value="all">All Ledgers</option>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <div className="relative">
              <DateInput
                id="startDate"
                value={startDate}
                onChange={(val) => setStartDate(val)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200"
              />
            </div>
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <div className="relative">
              <DateInput
                id="endDate"
                value={endDate}
                onChange={(val) => setEndDate(val)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-4">
          <button
            onClick={() => navigate('/anamath')}
            className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <button
            onClick={handleApplyFilters}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnamathFilters;
