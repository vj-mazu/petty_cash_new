import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BookOpen, List, Plus } from 'lucide-react';

const TransactionTypeSelection: React.FC = () => {
  const navigate = useNavigate();

  const handleCreditClick = () => {
    navigate('/transactions/create/credit');
  };

  const handleDebitClick = () => {
    navigate('/transactions/create/debit');
  };

  const handleAnamathClick = () => {
    navigate('/transactions/create/anamath');
  };

  const handleShowTransactions = () => {
    navigate('/transactions/list', { state: { showAll: true } });
  };

  return (
    <div className="w-full mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Create a new transaction or view existing records</p>
      </div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card p-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Choose an Action
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Select what you want to do
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Credit Button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreditClick}
            className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-300"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
            <div className="relative z-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4 group-hover:bg-opacity-30 transition-all duration-300">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Add Credit</h3>
              <p className="text-emerald-100 text-sm mb-4">Record money coming in</p>
              <div className="inline-flex items-center justify-center w-8 h-8 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all duration-300">
                <Plus className="w-4 h-4" />
              </div>
            </div>
          </motion.button>

          {/* Debit Button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDebitClick}
            className="group relative overflow-hidden bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-red-300"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
            <div className="relative z-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4 group-hover:bg-opacity-30 transition-all duration-300">
                <TrendingDown className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Add Debit</h3>
              <p className="text-red-100 text-sm mb-4">Record money going out</p>
              <div className="inline-flex items-center justify-center w-8 h-8 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all duration-300">
                <span className="text-lg font-bold">−</span>
              </div>
            </div>
          </motion.button>

          {/* Anamath Button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAnamathClick}
            className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
            <div className="relative z-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4 group-hover:bg-opacity-30 transition-all duration-300">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Anamath Entry</h3>
              <p className="text-blue-100 text-sm mb-4">Record miscellaneous transactions</p>
              <div className="inline-flex items-center justify-center w-8 h-8 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all duration-300">
                <Plus className="w-4 h-4" />
              </div>
            </div>
          </motion.button>

          {/* Show Transactions Button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleShowTransactions}
            className="group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-amber-300"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
            <div className="relative z-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4 group-hover:bg-opacity-30 transition-all duration-300">
                <List className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Show Transactions</h3>
              <p className="text-amber-100 text-sm mb-4">View transaction summary</p>
              <div className="inline-flex items-center justify-center w-8 h-8 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all duration-300">
                <span className="text-lg font-bold">→</span>
              </div>
            </div>
          </motion.button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Click on any button above to get started
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default TransactionTypeSelection;