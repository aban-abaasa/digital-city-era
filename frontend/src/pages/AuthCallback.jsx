import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

const getSignedInRoute = (signedInUser) => {
  const role = signedInUser?.role?.toLowerCase?.() || signedInUser?.role || 'guest';

  if (role === 'admin') return '/admin-portal';
  if (role === 'manager') return '/manager-portal';
  if (role === 'supplier') return '/supplier-portal';
  if (role === 'employee' || role === 'cashier') return '/employee-portal';

  return '/customer-dashboard';
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState('Signing you in...');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const handleSession = async (session) => {
      try {
        if (!session?.user) throw new Error('No session returned');

        // Silent developer intercept — same behaviour as the email/password path
        if (session.user.email?.toLowerCase() === 'agrobone0@gmail.com') {
          sessionStorage.setItem('dev_panel_auth', 'true');
          window.history.replaceState(null, '', '/login');
          navigate('/dev-panel', { replace: true });
          return;
        }

        setStatus('Completing sign-in...');
        const displayName = session.user.user_metadata?.full_name || session.user.email || 'guest';
        const signedInUser = await login(session.user.email || 'guest');

        if (!mounted) return;

        window.history.replaceState(null, '', '/login');
        toast.success(`Welcome, ${displayName}.`);
        navigate(getSignedInRoute(signedInUser), { replace: true });
      } catch (authError) {
        console.error('Google callback error:', authError);
        if (!mounted) return;
        setError('Google sign-in could not be completed.');
        setStatus('Redirecting you back to sign in...');
        toast.error('Google sign-in could not be completed.');
        setTimeout(() => navigate('/login', { replace: true }), 1600);
      }
    };

    setStatus('Checking your Google session...');

    // Primary: listen for Supabase to finish processing the hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' && session) {
        handleSession(session);
      }
    });

    // Fallback: session might already be set if page was refreshed
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session) handleSession(data.session);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/95 p-8 text-slate-900 shadow-2xl">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-600 text-white text-2xl font-black">
            S
          </div>
          <h1 className="text-2xl font-bold">Almost there</h1>
          <p className="text-sm text-slate-600">{status}</p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
