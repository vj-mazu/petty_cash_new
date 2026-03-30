import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatIndianCurrency, formatDisplayAmount } from '../../utils/indianNumberFormat';
import { 
  Filter,
  Calculator,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  date: string;
  time?: string;
  remarks?: string;
  creditAmount: number;
  debitAmount: number;
  type: 'credit' | 'debit' | 'anamath';
  ledger?: {
    id: string;
    name: string;
  };
  reference?: string;
  isAnamath?: boolean;
}

interface RunningBalanceDisplayProps {
  transactions: Transaction[];
  openingBalance: number;
  onTransactionClick?: (transaction: Transaction) => void;
  showFilters?: boolean;
  className?: string;
}

const RunningBalanceDisplay: React.FC<RunningBalanceDisplayProps> = ({
  transactions,
  openingBalance,
  onTransactionClick,
  showFilters = true,
  className = ''
}) => {
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit' | 'anamath'>('all');

  // Filter transactions when filters change
  useEffect(() => {
    let filtered = transactions;
    
    if (filterType !== 'all') {
      filtered = transactions.filter(t => t.type === filterType);
    }
    
    setFilteredTransactions(filtered);
  }, [transactions, filterType]);

  const formatCurrency = (amount: number) => {
    return formatIndianCurrency(amount);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold">Transaction Records</h2>
              <p className="text-blue-100 text-sm">View and manage all financial transactions</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-blue-500 px-3 py-1 rounded">
                <span className="text-sm">Opening Balance</span>
                <span className="font-bold">{formatCurrency(openingBalance)}</span>
              </div>
              
              {/* Transaction Type Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-3 py-1 bg-white text-gray-800 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-300"
                >
                  <option value="all">All Transactions</option>
                  <option value="credit">Credits Only</option>
                  <option value="debit">Debits Only</option>
                  <option value="anamath">Anamath Only</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Transaction Table */}
      <div className="bg-white shadow-sm border border-gray-200 overflow-hidden">
        {/* Date Header */}
        <div className="bg-gray-100 px-4 py-2 border-b">
          <span className="text-sm font-medium text-gray-700">SEP 10 2025</span>
        </div>
        
        {/* Table Header */}
        <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200">
          <div className="col-span-1 p-3 text-sm font-bold text-gray-700 text-center border-r">SL. NO</div>
          <div className="col-span-1 p-3 text-sm font-bold text-gray-700 text-center border-r">DATE</div>
          <div className="col-span-1 p-3 text-sm font-bold text-gray-700 text-center border-r">TIME</div>
          <div className="col-span-4 p-3 text-sm font-bold text-white text-center bg-green-500 border-r">CREDIT</div>
          <div className="col-span-4 p-3 text-sm font-bold text-white text-center bg-red-500 border-r">DEBIT</div>
        </div>
        
        {/* Sub Headers */}
        <div className="grid grid-cols-12 bg-gray-100 border-b border-gray-200 text-xs">
          <div className="col-span-1 p-2 text-center font-bold text-gray-600 border-r">#</div>
          <div className="col-span-1 p-2 text-center font-bold text-gray-600 border-r">DATE</div>
          <div className="col-span-1 p-2 text-center font-bold text-gray-600 border-r">TIME</div>
          <div className="col-span-1 p-2 text-center font-bold text-green-700 bg-green-50 border-r">AMOUNT</div>
          <div className="col-span-1 p-2 text-center font-bold text-green-700 bg-green-50 border-r">LEDGER</div>
          <div className="col-span-2 p-2 text-center font-bold text-green-700 bg-green-50 border-r">DESCRIPTION</div>
          <div className="col-span-1 p-2 text-center font-bold text-red-700 bg-red-50 border-r">AMOUNT</div>
          <div className="col-span-1 p-2 text-center font-bold text-red-700 bg-red-50 border-r">LEDGER</div>
          <div className="col-span-2 p-2 text-center font-bold text-red-700 bg-red-50">DESCRIPTION</div>
        </div>

        {/* Transaction Rows */}
        {filteredTransactions.map((transaction, index) => (
          <motion.div
            key={transaction.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.02 }}
            className="grid grid-cols-12 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
            onClick={() => onTransactionClick?.(transaction)}
          >
            {/* Serial Number */}
            <div className="col-span-1 p-3 text-center text-sm text-gray-700 border-r">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                {index + 1}
              </span>
            </div>
            
            {/* Date */}
            <div className="col-span-1 p-3 text-center text-sm text-gray-700 border-r">
              {format(new Date(transaction.date), 'dd/MM/yy')}
            </div>
            
            {/* Time */}
            <div className="col-span-1 p-3 text-center text-sm text-gray-600 border-r">
              {transaction.time || '00:00'}
            </div>
            
            {/* Credit Section */}
            {transaction.type === 'credit' ? (
              <>
                <div className="col-span-1 p-3 text-center text-sm font-bold text-green-700 bg-green-50 border-r">
                  <div className="flex items-center justify-center space-x-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>{formatIndianCurrency(transaction.creditAmount)}</span>
                  </div>
                </div>
                <div className="col-span-1 p-3 text-center text-xs text-green-700 bg-green-50 border-r font-medium">
                  {transaction.ledger?.name || 'Maruthi Company'}
                </div>
                <div className="col-span-2 p-3 text-center text-xs text-green-700 bg-green-50 border-r">
                  {transaction.remarks}
                </div>
              </>
            ) : (
              <>
                <div className="col-span-1 p-3 bg-green-50 border-r"></div>
                <div className="col-span-1 p-3 bg-green-50 border-r"></div>
                <div className="col-span-2 p-3 bg-green-50 border-r"></div>
              </>
            )}
            
            {/* Debit Section */}
            {transaction.type === 'debit' ? (
              <>
                <div className="col-span-1 p-3 text-center text-sm font-bold text-red-700 bg-red-50 border-r">
                  <div className="flex items-center justify-center space-x-1">
                    <TrendingDown className="w-4 h-4" />
                    <span>{formatIndianCurrency(transaction.debitAmount)}</span>
                  </div>
                </div>
                <div className="col-span-1 p-3 text-center text-xs text-red-700 bg-red-50 border-r font-medium">
                  {transaction.ledger?.name || 'Test Cash Ledger'}
                </div>
                <div className="col-span-2 p-3 text-center text-xs text-red-700 bg-red-50">
                  {transaction.remarks}
                </div>
              </>
            ) : (
              <>
                <div className="col-span-1 p-3 bg-red-50 border-r"></div>
                <div className="col-span-1 p-3 bg-red-50 border-r"></div>
                <div className="col-span-2 p-3 bg-red-50"></div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Daily Totals Footer */}
      {filteredTransactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 text-white p-4 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-300">DAILY TOTALS:</div>
            <div className="flex items-center space-x-6">
              <div className="bg-green-600 px-4 py-2 rounded text-sm font-bold">
                CREDIT: {formatCurrency(
                  filteredTransactions
                    .filter(t => t.type === 'credit')
                    .reduce((sum, t) => sum + t.creditAmount, 0)
                )}
              </div>
              <div className="bg-red-600 px-4 py-2 rounded text-sm font-bold">
                DEBIT: {formatCurrency(
                  filteredTransactions
                    .filter(t => t.type === 'debit')
                    .reduce((sum, t) => sum + t.debitAmount, 0)
                )}
              </div>
              <div className="bg-blue-600 px-4 py-2 rounded text-sm font-bold">
                TOTAL: {formatCurrency(
                  filteredTransactions
                    .filter(t => t.type === 'credit')
                    .reduce((sum, t) => sum + t.creditAmount, 0) -
                  filteredTransactions
                    .filter(t => t.type === 'debit')
                    .reduce((sum, t) => sum + t.debitAmount, 0)
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {filteredTransactions.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center"
        >
          <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No transactions found</p>
          <p className="text-sm text-gray-500 mt-1">
            {filterType !== 'all' 
              ? `No ${filterType} transactions to display. Try changing the filter or add some ${filterType} transactions.`
              : 'Add some transactions to see the running balance display.'
            }
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default RunningBalanceDisplay;