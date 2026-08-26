import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
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
 * "Forgot password?" on CustomerLogin.jsx navigates here. Sends Supabase's
 * built-in reset email (auth.resetPassword in services/supabase.js, which
 * explicitly passes redirectTo since this Supabase project is shared across
 * ICAN/mybodaguy/this app — leaving it out would fall back to whichever
 * app's domain is configured as the project's dashboard Site URL).
 */
const ForgotPassword = () => {
  const { theme } = useTheme();
  const palette = themeStyles[theme];
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await auth.resetPassword(email);
    setIsLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to send reset link');
      return;
    }
    setSent(true);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${palette.shell}`}>
      <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-8 ${palette.card}`}>
        <Link to="/login" className={`inline-flex items-center gap-2 text-sm mb-6 hover:underline ${palette.muted}`}>
          <FiArrowLeft /> Back to Sign In
        </Link>

        <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
        <p className={`text-sm mb-6 ${palette.muted}`}>
          {sent ? "We've emailed you a reset link" : "Enter your email and we'll send you a reset link"}
        </p>

        {sent ? (
          <p className={`text-sm ${palette.muted}`}>
            Check <span className="font-semibold">{email}</span> for a link to set a new password. It expires shortly, so use it soon.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={`block w-full pl-10 pr-3 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${palette.input}`}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${palette.button}`}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
