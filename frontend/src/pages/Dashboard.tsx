import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, TrendingDown, ArrowRight, Wallet, BarChart3, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const greeting = (() => {
    const h = time.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.92 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.45 } },
  };

  const quickLinks = [
    { label: 'Add Transaction', href: '/transactions/create', icon: TrendingUp, color: 'from-blue-500 to-blue-700', hoverColor: 'hover:shadow-blue-500/25' },
    { label: 'View Transactions', href: '/transactions', icon: BarChart3, color: 'from-emerald-500 to-emerald-700', hoverColor: 'hover:shadow-emerald-500/25' },
    { label: 'Ledgers', href: '/ledgers', icon: Wallet, color: 'from-violet-500 to-violet-700', hoverColor: 'hover:shadow-violet-500/25' },
    { label: 'Ledger Summary', href: '/ledgers?tab=summary', icon: TrendingDown, color: 'from-amber-500 to-amber-700', hoverColor: 'hover:shadow-amber-500/25' },
  ];

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-8"
    >
      {/* Hero greeting */}
      <motion.div variants={fadeUp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-800 dark:via-gray-900 dark:to-black p-8 md:p-10">
        {/* Mesh gradient overlay */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500 blur-[120px]" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-violet-600 blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-emerald-500 blur-[90px] opacity-40" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <motion.p
                variants={fadeUp}
                className="text-blue-300 text-sm font-medium tracking-wide uppercase mb-1"
              >
                {greeting}
              </motion.p>
              <motion.h1
                variants={fadeUp}
                className="text-3xl md:text-4xl font-bold text-white tracking-tight"
              >
                Kushi Agro Industries
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-2 text-gray-400 text-base">
                {user?.username || 'User'} • Petty Cash Management System
              </motion.p>
            </div>

            <motion.div variants={scaleIn} className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-3xl font-mono font-bold text-white tabular-nums">
                  {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </p>
                <p className="text-gray-400 text-sm mt-0.5">
                  {time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="w-px h-12 bg-gray-700" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-sm font-medium">Online</span>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Quick action cards */}
      <motion.div variants={fadeUp}>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link, i) => {
            const Icon = link.icon;
            return (
              <motion.button
                key={link.label}
                variants={scaleIn}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(link.href)}
                className={`group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 text-left shadow-sm ${link.hoverColor} hover:shadow-lg transition-shadow duration-300`}
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${link.color} mb-4 shadow-md`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{link.label}</p>
                <ArrowRight className="absolute bottom-5 right-5 w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-1 transition-all duration-200" />
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Role & info bar */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex items-center gap-4 p-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Role</p>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100 capitalize">{user?.role || 'Staff'}</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-4 p-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md">
            <span className="text-white text-lg font-bold">₹</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Account</p>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100 capitalize">{user?.username || 'User'}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
