import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import {
  User,
  Lock,
  Save,
  Eye,
  EyeOff,
  Database,
  Shield,
  Info
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

interface PasswordChangeForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const passwordSchema = yup.object().shape({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup.string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  confirmPassword: yup.string()
    .required('Please confirm your password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
}).required();

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<PasswordChangeForm>({
    resolver: yupResolver(passwordSchema) as any
  });

  const onPasswordSubmit = async (data: PasswordChangeForm) => {
    try {
      const response = await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });

      if (response.success) {
        toast.success('Password changed successfully!');
        reset();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            ⚙️ Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400 flex items-center">
            🔧 Manage your account and application settings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Profile */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-5 sm:p-6 lg:p-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800"
        >
          <h3 className="text-lg sm:text-xl font-semibold text-blue-900 dark:text-blue-300 mb-4 sm:mb-5 flex items-center">
            <User className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
            👤 User Profile
          </h3>

          <div className="space-y-4">
            <div className="flex items-center">
              <img
                className="h-16 w-16 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium"
                src={`https://ui-avatars.com/api/?name=${user?.username}&background=3b82f6&color=fff&size=64`}
                alt={user?.username}
              />
              <div className="ml-4">
                <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-300">{user?.username}</h4>
                <p className="text-blue-700 dark:text-blue-400">{user?.email}</p>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 capitalize mt-1">
                  <Shield className="w-3 h-3 mr-1" />
                  {user?.role}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/60 bg-opacity-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Account Status:</span>
                  <p className="text-blue-800 dark:text-blue-300">{user?.isActive ? '✅ Active' : '❌ Inactive'}</p>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Last Login:</span>
                  <p className="text-blue-800 dark:text-blue-300">
                    {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Change Password */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-5 sm:p-6 lg:p-8 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800"
        >
          <h3 className="text-lg sm:text-xl font-semibold text-green-900 dark:text-green-300 mb-4 sm:mb-5 flex items-center">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
            🔐 Change Password
          </h3>

          <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4 sm:space-y-5">
            {/* Current Password */}
            <div>
              <label className="block text-base sm:text-lg font-medium text-green-700 dark:text-green-400 mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  {...register('currentPassword')}
                  type={showCurrentPassword ? 'text' : 'password'}
                  className={`input-field pr-10 ${errors.currentPassword ? 'border-red-300 dark:border-red-700' : 'border-green-300 dark:border-green-700'
                    }`}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-xs text-red-600 mt-1">{errors.currentPassword.message}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-base sm:text-lg font-medium text-green-700 dark:text-green-400 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  {...register('newPassword')}
                  type={showNewPassword ? 'text' : 'password'}
                  className={`input-field pr-10 ${errors.newPassword ? 'border-red-300 dark:border-red-700' : 'border-green-300 dark:border-green-700'
                    }`}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-xs text-red-600 mt-1">{errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-base sm:text-lg font-medium text-green-700 dark:text-green-400 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`input-field pr-10 ${errors.confirmPassword ? 'border-red-300 dark:border-red-700' : 'border-green-300 dark:border-green-700'
                    }`}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-green-600 text-white py-3 px-5 rounded-lg text-base sm:text-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              {isSubmitting ? 'Changing...' : 'Change Password'}
            </motion.button>
          </form>
        </motion.div>
      </div>

      {/* System Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card p-5 sm:p-6 lg:p-8 bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30 border-purple-200 dark:border-purple-800"
      >
        <h3 className="text-lg sm:text-xl font-semibold text-purple-900 dark:text-purple-300 mb-4 sm:mb-5 flex items-center">
          <Database className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
          📊 System Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800/60 bg-opacity-60 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">🏗️ Application</h4>
            <div className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
              <p><strong>Name:</strong> Cash Management System</p>
              <p><strong>Version:</strong> 1.0.0</p>
              <p><strong>Environment:</strong> Development</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/60 bg-opacity-60 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">💰 Currency</h4>
            <div className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
              <p><strong>Primary:</strong> Indian Rupees (₹)</p>
              <p><strong>Format:</strong> ₹{(12345.67).toLocaleString('en-IN')}</p>
              <p><strong>Locale:</strong> en-IN</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/60 bg-opacity-60 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">🔐 Security</h4>
            <div className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
              <p><strong>Auth:</strong> JWT Tokens</p>
              <p><strong>Encryption:</strong> bcrypt</p>
              <p><strong>Role:</strong> Admin Only</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Help Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card p-6 bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-200 dark:border-yellow-800"
      >
        <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300 mb-3 flex items-center">
          <Info className="w-5 h-5 mr-2" />
          💡 Settings Help
        </h3>
        <div className="space-y-2 text-sm text-yellow-800 dark:text-yellow-400">
          <p>• <strong>Password Requirements:</strong> Minimum 8 characters with uppercase, lowercase, and number</p>
          <p>• <strong>Security:</strong> Always use strong passwords and change them regularly</p>
          <p>• <strong>Profile:</strong> Your profile information is automatically synced</p>
          <p>• <strong>Access:</strong> All users have administrator privileges in this system</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Settings;