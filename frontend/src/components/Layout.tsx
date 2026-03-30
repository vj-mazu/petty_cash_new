// frontend/src/components/Layout.tsx
import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useZoom } from '../contexts/ZoomContext';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import ZoomControl from './ZoomControl';
import {
  Home,
  BookOpen,
  CreditCard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  User,
  ChevronDown,
  Calculator,
  Building2,
  Sun,
  Moon
} from 'lucide-react';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { zoomScale } = useZoom();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, current: location.pathname === '/dashboard' },
    { name: 'Ledgers', href: '/ledgers', icon: BookOpen, current: location.pathname.startsWith('/ledgers') },
    { name: 'Transactions', href: '/transactions', icon: CreditCard, current: location.pathname.startsWith('/transactions') },
    { name: 'Anamath', href: '/anamath', icon: Calculator, current: location.pathname.startsWith('/anamath') },
    { name: 'Opening Balance', href: '/opening-balance', icon: Calculator, current: location.pathname.startsWith('/opening-balance'), adminOnly: true, openingBalanceOnly: true },
    { name: 'Users', href: '/user-management', icon: Users, current: location.pathname.startsWith('/user-management'), adminOnly: true }
  ];

  // Filter navigation based on user role
  const isAdminRole = (role: string) => role === 'admin';
  const isOwnerRole = (role: string) => role === 'owner';
  const isManagerRole = (role: string) => role === 'manager';
  const hasOpeningBalanceAccess = (role: string) => role === 'admin' || role === 'owner';
  const filteredNavigation = navigation.filter(item => {
    if (item.adminOnly && !isAdminRole(user?.role || '') && !isOwnerRole(user?.role || '') && !isManagerRole(user?.role || '')) {
      return false; // Hide admin-only items from staff
    }
    if (item.openingBalanceOnly && !hasOpeningBalanceAccess(user?.role || '')) {
      return false; // Hide opening balance from non-admin/owner
    }
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-primary-100 text-primary-800';
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'manager':
        return 'bg-emerald-100 text-emerald-800';
      case 'staff':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'owner':
        return 'Owner';
      case 'manager':
        return 'Manager';
      case 'staff':
        return 'Staff';
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <div className="fixed inset-0 bg-gray-600/75 dark:bg-black/60" />
            </motion.div>
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed top-0 left-0 z-50 w-64 h-full bg-white dark:bg-gray-800 shadow-xl lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">₹</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Petty Cash</h1>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="mt-4">
                <div className="px-4 space-y-1">
                  {filteredNavigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <motion.button
                        key={item.name}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          navigate(item.href);
                          setSidebarOpen(false);
                        }}
                        className={`w-full text-left group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${item.current
                          ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-900 dark:text-primary-300 border-r-2 border-primary-600'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                          }`}
                      >
                        <Icon className={`mr-3 flex-shrink-0 h-5 w-5 ${item.current ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                          }`} />
                        {item.name}
                      </motion.button>
                    );
                  })}
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <div className="flex flex-1 flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">₹</span>
                </div>
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Petty Cash</h1>
              </div>
            </div>
            <nav className="mt-8 flex-1 px-4 space-y-1">
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.name}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(item.href)}
                    className={`w-full text-left group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200 ${item.current
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-900 dark:text-primary-300 border-r-2 border-primary-600 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                  >
                    <Icon className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors duration-200 ${item.current ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                      }`} />
                    {item.name}
                  </motion.button>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center w-full group">
              <div>
                <img
                  className="inline-block h-9 w-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium"
                  src={`https://ui-avatars.com/api/?name=${user?.username}&background=3b82f6&color=fff`}
                  alt={user?.username}
                />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                  {user?.username}
                </p>
                <p className="text-xs text-gray-500">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(user?.role || '')}`}>
                    {getRoleDisplayName(user?.role || '')}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                {/* Mobile menu button */}
                <button
                  type="button"
                  className="lg:hidden -ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                  onClick={() => setSidebarOpen(true)}
                >
                  <span className="sr-only">Open sidebar</span>
                  <Menu className="h-6 w-6" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  className="relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-gray-200 dark:bg-gray-600"
                  aria-label="Toggle theme"
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ${isDark ? 'translate-x-7' : 'translate-x-0'}`}>
                    {isDark ? <Moon className="h-3.5 w-3.5 text-indigo-500" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
                  </span>
                </button>

                {/* Notifications */}
                <button className="p-1.5 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors">
                  <span className="sr-only">View notifications</span>
                  <Bell className="h-5 w-5" />
                </button>

                {/* Profile dropdown */}
                <div className="relative flex-shrink-0">
                  <div>
                    <button
                      type="button"
                      className="rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800"
                      onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    >
                      <span className="sr-only">Open user menu</span>
                      <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <ChevronDown className="ml-1 h-4 w-4 text-gray-400 dark:text-gray-500 self-center" />
                    </button>
                  </div>

                  <AnimatePresence>
                    {profileDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="origin-top-right absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-20 border border-gray-200 dark:border-gray-700"
                        onMouseLeave={() => setProfileDropdownOpen(false)}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => {
                              navigate('/settings');
                              setProfileDropdownOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Settings
                          </button>
                          <button
                            onClick={() => {
                              handleLogout();
                              setProfileDropdownOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <LogOut className="inline w-4 h-4 mr-2" />
                            Sign out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-x-auto pb-12">
          <div className="py-6">
            <div
              className="mx-auto px-4 sm:px-6 lg:px-8"
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top left',
                width: `${100 / zoomScale}%`,
              }}
            >
              <Outlet />
            </div>
          </div>
        </main>

        {/* Footer - fixed to bottom */}
        <footer className="fixed bottom-0 right-0 left-0 lg:left-64 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 transition-colors duration-200 z-10">
          <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <span>Made with</span>
            <span className="text-red-500 text-base">❤️</span>
            <span>by</span>
            <span className="vajjra-shine font-bold text-lg tracking-widest" style={{ fontFamily: "Cinzel, 'Times New Roman', serif" }}>VAJJRA</span>
          </div>
        </footer>
      </div>

      {/* Zoom Control */}
      <ZoomControl />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp />
    </div>
  );
};

export default Layout;