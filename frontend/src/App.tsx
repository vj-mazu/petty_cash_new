// frontend/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './contexts/AuthContext';
import { OpeningBalanceProvider } from './contexts/OpeningBalanceContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ZoomProvider } from './contexts/ZoomContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Ledgers from './pages/Ledgers';
import CreateLedger from './pages/CreateLedger';
import EditLedger from './pages/EditLedger';
import Transactions from './pages/Transactions';
import CreateTransaction from './pages/CreateTransaction';
import CreateAnamath from './pages/CreateAnamath';
import ClosedAnamathRecords from './pages/ClosedAnamathRecords';

import { CombinedTransactionForm } from './components/transactions';
import TransactionFilters from './pages/TransactionFilters';
import Settings from './pages/Settings';
import OpeningBalance from './pages/OpeningBalance';
import Anamath from './pages/Anamath';
import AnamathFilters from './pages/AnamathFilters';
import EditAnamath from './pages/EditAnamath';
import TransactionTypeSelection from './pages/TransactionTypeSelection';
import UserManagement from './pages/UserManagement';

// Records component removed

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ZoomProvider>
          <AuthProvider>
            <OpeningBalanceProvider>
              <Router>
                <AppWithShortcuts />
              </Router>
            </OpeningBalanceProvider>
          </AuthProvider>
        </ZoomProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function AppWithShortcuts() {
  // Enable keyboard shortcuts globally
  useKeyboardShortcuts();

  return (
    <div className="App">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="ledgers" element={<Ledgers />} />
          <Route path="ledgers/create" element={<CreateLedger />} />
          <Route path="ledgers/:id/edit" element={
            <ProtectedRoute requiredRole="admin">
              <EditLedger />
            </ProtectedRoute>
          } />

          <Route path="transactions" element={<TransactionTypeSelection />} />
          <Route path="transactions/list" element={<Transactions />} />
          <Route path="transactions/create/credit" element={<CreateTransaction />} />
          <Route path="transactions/create/debit" element={<CreateTransaction />} />
          <Route path="transactions/create/anamath" element={<CreateAnamath />} />
          <Route path="transactions/create/combined" element={<CombinedTransactionForm />} />
          <Route path="transactions/filters" element={<TransactionFilters />} />
          <Route path="transactions/anamath" element={<Anamath />} />

          {/* PDF Export Test Page */}


          {/* User Management route */}
          <Route path="user-management" element={
            <ProtectedRoute>
              <UserManagement />
            </ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute requiredRole="admin">
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="opening-balance" element={
            <ProtectedRoute openingBalanceAccess={true}>
              <OpeningBalance />
            </ProtectedRoute>
          } />
          <Route path="anamath" element={<Anamath />} />
          <Route path="anamath/closed" element={<ClosedAnamathRecords />} />
          <Route path="anamath-filters" element={<AnamathFilters />} />
          <Route path="anamath/:id/edit" element={<EditAnamath />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </div>
  );
}

export default App;