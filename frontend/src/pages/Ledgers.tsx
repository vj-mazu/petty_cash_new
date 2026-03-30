// src/pages/Ledgers.tsx

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { ledgerApi, Ledger } from '../services/api';
import {
  Plus,
  Search,
  Trash2,
  BookOpen,
  Building2
} from 'lucide-react';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import LedgersView from './LedgersView';

const Ledgers: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'create' | 'summary'>(
    (searchParams.get('tab') as 'create' | 'summary') || 'create'
  );
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Role-based permissions
  const isAdmin = user?.role && ['admin', 'owner', 'manager'].includes(user.role);
  const canEdit = isAdmin;
  const canDelete = user?.role && ['admin', 'owner'].includes(user.role);

  const handleTabChange = (tab: 'create' | 'summary') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleSearch = (value: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      setSearchQuery(value);
      setCurrentPage(1);
    }, 500);

    setSearchTimeout(timeout);
  };

  useEffect(() => {
    if (activeTab === 'create') {
      fetchLedgers();
    }
  }, [currentPage, searchQuery, activeTab]);

  const fetchLedgers = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: 10,
        search: searchQuery || undefined
      };

      const response = await ledgerApi.getAll(params);
      if (response.success) {
        setLedgers(response.data.ledgers);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch ledgers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await ledgerApi.delete(id);
      if (response.success) {
        toast.success('Ledger deleted successfully');
        setLedgers(ledgers.filter(ledger => ledger.id !== id));
        setShowDeleteModal(null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete ledger');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            📚 Ledgers
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400 flex items-center">
            💰 Manage your account ledgers and balances
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/ledgers/create')}
          className="mt-4 sm:mt-0 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-2 rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all duration-200 flex items-center shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          ✨ Create Ledger
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => handleTabChange('create')}
          className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
            activeTab === 'create'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
          }`}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          Manage Ledgers
        </button>
        <button
          onClick={() => handleTabChange('summary')}
          className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
            activeTab === 'summary'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
          }`}
        >
          <Building2 className="w-4 h-4 mr-2" />
          Ledger Summary
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' ? (
        <LedgersView />
      ) : (
        <>
          {/* Search */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
            <div className="p-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search ledgers by name or details..."
                  className="input-field pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Ledgers Table */}
          {loading && ledgers.length === 0 ? (
            <LoadingSpinner message="Loading ledgers..." />
          ) : ledgers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <BookOpen className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No ledgers found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first ledger to start managing your finances</p>
              <button
                onClick={() => navigate('/ledgers/create')}
                className="btn-primary"
              >
                <Plus className="w-5 h-5 mr-2 inline" />
                Create First Ledger
              </button>
            </motion.div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-300 dark:border-gray-700 overflow-hidden transition-colors">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-0 border-b-2 border-gray-400 dark:border-gray-600 bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-700 dark:to-purple-800 font-bold text-white text-sm">
                <div className="col-span-4 py-3 px-4 border-r border-white/20 text-left">Ledger Name</div>
                <div className="col-span-5 py-3 px-4 border-r border-white/20 text-left">Remarks</div>
                <div className="col-span-2 py-3 px-4 border-r border-white/20 text-left">Created Date</div>
                <div className="col-span-1 py-3 px-4 text-center">Actions</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-gray-300 dark:divide-gray-700">
                {ledgers.map((ledger, index) => (
                  <motion.div
                    key={ledger.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`grid grid-cols-12 gap-0 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/60'} hover:bg-blue-50 dark:hover:bg-gray-700`}
                  >
                    <div className="col-span-4 py-3 px-4 border-r border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-gray-200 truncate bg-white dark:bg-transparent text-base">
                      {ledger.name}
                    </div>
                    <div className="col-span-5 py-3 px-4 text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 truncate text-base">
                      {ledger.description || '-'}
                    </div>
                    <div className="col-span-2 py-3 px-4 text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 text-sm">
                      {format(new Date(ledger.createdAt), 'MMM dd, yyyy')}
                    </div>
                    <div className="col-span-1 py-1.5 px-2 flex items-center justify-center space-x-1">
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/ledgers/${ledger.id}/edit`);
                          }}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteModal(ledger.id);
                          }}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 font-medium transition-colors"
              >
                Previous
              </button>

              <div className="flex space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 font-medium transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {ReactDOM.createPortal(
          <AnimatePresence>
            {showDeleteModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50"
                onClick={() => setShowDeleteModal(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Ledger</h3>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Are you sure you want to delete this ledger? This action cannot be undone and will also delete all associated transactions.
                  </p>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowDeleteModal(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(showDeleteModal)}
                      className="btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
          )}
        </>
      )}
    </div>
  );
};

export default Ledgers;