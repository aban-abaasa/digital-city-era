import React, { useEffect, useState, useRef } from 'react';
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
  const [showRetry, setShowRetry] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);

  const handleCompleteLogout = async () => {
    try {
      setStatus('Clearing all sessions...');
      setShowRetry(false);
      
      // First clear the URL hash to prevent re-processing
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      
      // Sign out from Supabase (this clears auth state)
      await supabase.auth.signOut({ scope: 'global' });
      
      // Clear all storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear cookies
      document.cookie.split(";").forEach(cookie => {
        const cookieName = cookie.split("=")[0].trim();
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      
      toast.success('All sessions cleared. Redirecting to login...');
      
      // Use window.location to force a full page reload and clear React state
      setTimeout(() => {
        window.location.href = '/login';
      }, 800);
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('Error clearing sessions. Reloading page...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    }
  };

  const handleBackToLogin = async () => {
    try {
      setStatus('Returning to login...');
      
      // Clear the problematic URL hash first
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      
      // Don't clear the session - just navigate back
      // This allows the user to try logging in again
      window.location.href = '/login';
    } catch (err) {
      console.error('Navigation error:', err);
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let sessionTimeout;

    const handleSession = async (session) => {
      // Prevent multiple simultaneous processing
      if (processingRef.current) {
        console.log('[AUTH] Already processing a session, skipping duplicate');
        return;
      }
      
      if (!session?.user) {
        console.log('[AUTH] No session user found');
        return;
      }

      processingRef.current = true;
      
      try {
        console.log('[AUTH] Processing session for:', session.user.email);

        if (!mountedRef.current) return;

        setStatus('Completing sign-in...');
        const displayName = session.user.user_metadata?.full_name || session.user.email || 'guest';
        
        // Use the Supabase session email to login
        const signedInUser = await login(session.user.email || 'guest');

        if (!mountedRef.current) return;

        // Clear the hash from URL
        window.history.replaceState(null, '', '/login');
        
        toast.success(`Welcome, ${displayName}.`);
        navigate(getSignedInRoute(signedInUser), { replace: true });
      } catch (authError) {
        console.error('[AUTH] Callback error:', authError);
        if (!mountedRef.current) return;
        
        // Check for specific session conflict errors
        const errorMessage = authError?.message?.toLowerCase() || '';
        const isSessionConflict = errorMessage.includes('session') || 
                                  errorMessage.includes('confirm') ||
                                  errorMessage.includes('disagree') ||
                                  errorMessage.includes('tabs') ||
                                  errorMessage.includes('conflict');
        
        if (isSessionConflict) {
          setSessionConflict(true);
          setError('Session conflict detected. Multiple tabs or an expired session may be causing this issue.');
          setStatus('Sign-in could not be confirmed');
          toast.error('Session conflict. Please clear all sessions to continue.');
        } else {
          setError('Google sign-in could not be completed.');
          setStatus('Redirecting you back to sign in...');
          toast.error('Sign-in failed. Please try again.');
          
          // Auto-redirect after 3 seconds for non-conflict errors
          setTimeout(() => {
            if (mountedRef.current) {
              handleBackToLogin();
            }
          }, 3000);
        }
        
        setShowRetry(true);
      } finally {
        processingRef.current = false;
      }
    };

    const initializeAuth = async () => {
      setStatus('Checking your session...');
      
      try {
        // Check if there's a hash in the URL that needs to be processed
        if (window.location.hash && window.location.hash.includes('access_token')) {
          console.log('[AUTH] Found auth hash in URL, processing...');

          try {
            // detectSessionInUrl:true parses the hash internally; getSession()
            // awaits that in-flight init before returning, so this reliably
            // picks up the session once it's ready.
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error('[AUTH] Error exchanging hash for session:', error);
              
              // Clear the bad hash
              window.history.replaceState(null, '', window.location.pathname);
              
              setSessionConflict(true);
              setError('Could not confirm sign-in. The authentication link may be expired or invalid.');
              setShowRetry(true);
              return;
            }
            
            if (data?.session) {
              console.log('[AUTH] Successfully got session from hash');
              await handleSession(data.session);
              return;
            }
          } catch (hashError) {
            console.error('[AUTH] Hash processing error:', hashError);
            window.history.replaceState(null, '', window.location.pathname);
            setSessionConflict(true);
            setError('Authentication failed. Please try signing in again.');
            setShowRetry(true);
            return;
          }
        }
        
        // No hash in URL, check for existing session in storage
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[AUTH] Session error:', sessionError);
          setSessionConflict(true);
          setError('Could not retrieve session. Please clear sessions and try again.');
          setShowRetry(true);
          return;
        }
        
        if (session) {
          console.log('[AUTH] Found existing session in storage');
          await handleSession(session);
        } else {
          console.log('[AUTH] No session found, waiting for auth state change...');
        }
      } catch (err) {
        console.error('[AUTH] Initialization error:', err);
        setError('Authentication failed. Please try logging in again.');
        setShowRetry(true);
      }
    };

    // Set a timeout to detect stuck sessions
    sessionTimeout = setTimeout(() => {
      if (mountedRef.current && !processingRef.current && !error) {
        console.log('[AUTH] Timeout - no session processed');
        setSessionConflict(true);
        setError('Sign-in is taking too long. This may be a session conflict.');
        setStatus('Session timeout');
        setShowRetry(true);
      }
    }, 10000); // 10 second timeout

    // Listen for auth state changes (for OAuth flows)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AUTH] Auth state changed:', event);
      
      if (!mountedRef.current) return;
      
      clearTimeout(sessionTimeout);
      
      if (event === 'SIGNED_IN' && session && !processingRef.current) {
        console.log('[AUTH] Signed in event detected');
        await handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        console.log('[AUTH] Signed out event detected');
        if (!processingRef.current) {
          setError('Session was signed out. Please try logging in again.');
          setShowRetry(true);
        }
      }
    });

    // Initialize
    initializeAuth();

    return () => {
      mountedRef.current = false;
      clearTimeout(sessionTimeout);
      subscription?.unsubscribe();
    };
  }, [login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/95 p-8 text-slate-900 shadow-2xl">
        <div className="space-y-4 text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white text-2xl font-black ${
            sessionConflict ? 'bg-gradient-to-br from-orange-400 via-red-500 to-pink-600' : 
            'bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-600'
          }`}>
            {sessionConflict ? '⚠' : 'S'}
          </div>
          <h1 className="text-2xl font-bold">
            {sessionConflict ? 'Session Conflict' : 'Almost there'}
          </h1>
          <p className="text-sm text-slate-600">{status}</p>
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
              <p className="text-sm text-red-700 font-medium mb-1">Error Details:</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : null}
          
          {sessionConflict && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-left">
              <p className="text-sm text-orange-800 font-medium mb-2">What happened?</p>
              <p className="text-xs text-orange-700 mb-3">
                Multiple browser tabs or an expired session may have caused this conflict. 
                Clearing all sessions will resolve this issue.
              </p>
            </div>
          )}
          
          {!showRetry ? (
            <div className="flex items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {sessionConflict && (
                <button
                  onClick={handleCompleteLogout}
                  className="w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                >
                  Clear All Sessions & Sign Out
                </button>
              )}
              
              <button
                onClick={handleBackToLogin}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
