import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown,
  Plus,
  BookOpen
} from 'lucide-react';

interface TransactionActionButtonsProps {
  onCreditClick: () => void;
  onDebitClick: () => void;
  onAnamathClick: () => void;
  disabled?: boolean;
}

const TransactionActionButtons: React.FC<TransactionActionButtonsProps> = ({
  onCreditClick,
  onDebitClick,
  onAnamathClick,
  disabled = false
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Choose Transaction Type
        </h2>
        <p className="text-gray-600">
          Select the type of transaction you want to record
        </p>
      </div>

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Credit Button */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCreditClick}
          disabled={disabled}
          className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
          
          {/* Content */}
          <div className="relative z-10 text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4 group-hover:bg-opacity-30 transition-all duration-300">
              <TrendingUp className="w-8 h-8" />
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-bold mb-2">Add Credit</h3>
            
            {/* Description */}
            <p className="text-emerald-100 text-sm mb-4">
              Record money coming in
            </p>
            
            {/* Plus Icon */}
            <div className="inline-flex items-center justify-center w-8 h-8 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all duration-300">
              <Plus className="w-4 h-4" />
            </div>
          </div>

          {/* Hover Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-all duration-700" />
        </motion.button>

        {/* Debit Button */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onDebitClick}
          disabled={disabled}
          className="group relative overflow-hidden bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
          
          {/* Content */}
          <div className="relative z-10 text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4 group-hover:bg-opacity-30 transition-all duration-300">
              <TrendingDown className="w-8 h-8" />
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-bold mb-2">Add Debit</h3>
            
            {/* Description */}
            <p className="text-red-100 text-sm mb-4">
              Record money going out
            </p>
            
            {/* Minus Icon */}
            <div className="inline-flex items-center justify-center w-8 h-8 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all duration-300">
              <span className="text-lg font-bold">−</span>
            </div>
          </div>

          {/* Hover Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-all duration-700" />
        </motion.button>

        {/* Anamath Button */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAnamathClick}
          disabled={disabled}
          className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
          
          {/* Content */}
          <div className="relative z-10 text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4 group-hover:bg-opacity-30 transition-all duration-300">
              <BookOpen className="w-8 h-8" />
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-bold mb-2">Anamath Entry</h3>
            
            {/* Description */}
            <p className="text-blue-100 text-sm mb-4">
              Record miscellaneous transactions
            </p>
            
            {/* Plus Icon */}
            <div className="inline-flex items-center justify-center w-8 h-8 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all duration-300">
              <Plus className="w-4 h-4" />
            </div>
          </div>

          {/* Hover Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-all duration-700" />
        </motion.button>
      </div>

      {/* Help Text */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Click on any button above to start recording a transaction
        </p>
      </div>
    </div>
  );
};

export default TransactionActionButtons;