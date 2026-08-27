import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { auth } from '../services/supabase';
import { useTheme } from '../contexts/ThemeContext';

const themeStyles = {
  dark: {
    shell: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800',
    card: 'bg-white/85 border-white/20 text-slate-900',
    muted: 'text-slate-600',
    input: 'border-gray-300 bg-white text-slate-900',
    button: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
  },
  light: {
    shell: 'bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_55%,#fff7ed_100%)]',
    card: 'bg-white/90 border-slate-200 text-slate-900',
    muted: 'text-slate-600',
    input: 'border-slate-200 bg-slate-50 text-slate-900',
    button: 'bg-gradient-to-r from-sky-600 to-violet-600 text-white'
  }
};

/**
 * Landing page for the emailed "reset my password" link. Supabase's
 * detectSessionInUrl (services/supabase.js) already turns the link's URL
 * hash into a live recovery session by the time this mounts, so submitting
 * just calls auth.updateUser({ password }) — it acts on that session.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const palette = themeStyles[theme];
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    const { error } = await auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast.error(error.message || 'Failed to reset password. The link may have expired — request a new one.');
      return;
    }
    setSuccess(true);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${palette.shell}`}>
      <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-8 ${palette.card}`}>
        <h1 className="text-2xl font-bold mb-2">Reset Your Password</h1>
        <p className={`text-sm mb-6 ${palette.muted}`}>Choose a new password for your account</p>

        {success ? (
          <div className="text-center py-2">
            <p className="font-semibold mb-4">Password reset — sign in with your new password.</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${palette.button}`}
            >
              Continue to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className={`block w-full pl-10 pr-10 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${palette.input}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={`block w-full pl-10 pr-10 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${palette.input}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${palette.button}`}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
