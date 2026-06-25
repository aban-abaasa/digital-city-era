import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import './SupplierAuth.css';

/**
 * GOOGLE-ONLY AUTHENTICATION SYSTEM
 * Simple flow:
 * 1. User clicks "Sign in with Google"
 * 2. After OAuth, create_google_user() is called
 * 3. Show profile completion form
 * 4. Call complete_google_profile()
 * 5. Redirect to portal (limited access until admin approves)
 */

const SupplierAuth = () => {
  const navigate = useNavigate();
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true); // Add checking state
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Profile Form Fields
  const [profileData, setProfileData] = useState({
    fullName: '',
    companyName: '',
    phone: '',
    address: '',
    businessLicense: '',
    category: ''
  });

  // =============================================
  // Check authentication status ONLY after OAuth redirect
  // =============================================
  useEffect(() => {
    // CRITICAL: Set app context IMMEDIATELY to prevent Farm Agent redirect
    localStorage.setItem('current_app', 'supermartkera');
    localStorage.setItem('current_portal', 'supplier');
    
    // Clear any Farm Agent data that might cause redirect
    if (localStorage.getItem('farm_agent_session')) {
      localStorage.removeItem('farm_agent_session');
    }
    if (sessionStorage.getItem('farm_agent_session')) {
      sessionStorage.removeItem('farm_agent_session');
    }
    
    // Check if we're returning from OAuth (token in hash)
    const hasOAuthCallback = window.location.hash.includes('access_token=');
    
    const processOAuthAndCheckAuth = async () => {
      if (hasOAuthCallback) {
        console.log('🔄 OAuth callback detected in URL hash, processing...');
        
        // Manually tell Supabase to get the session from the URL
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session from OAuth:', error);
        } else if (data?.session) {
          console.log('✅ Session retrieved from OAuth callback:', data.session.user?.email);
          // Clear the hash from URL to clean up
          window.history.replaceState(null, '', window.location.pathname);
          // Process the authenticated user
          checkAuthStatus();
          return;
        } else {
          // Session not found in URL, try setSession with hash params
          console.log('🔄 Trying to extract session from hash...');
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('🔑 Found tokens in hash, setting session...');
            const { data: sessionData, error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (setError) {
              console.error('❌ Error setting session:', setError);
            } else if (sessionData?.session) {
              console.log('✅ Session set successfully:', sessionData.session.user?.email);
              // Clear the hash from URL
              window.history.replaceState(null, '', window.location.pathname);
              checkAuthStatus();
              return;
            }
          }
        }
      }
      
      // No OAuth callback or failed to process, just check auth normally
      checkAuthStatus();
    };

    // Set up auth state listener as backup
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in:', session.user.email);
        checkAuthStatus();
      }
    });

    // Process OAuth callback or check auth
    processOAuthAndCheckAuth();

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // No session — show sign-in options
        setChecking(false);
        return;
      }

      setCurrentUser(user);

      // Fetch existing public.users row (may be customer, supplier, or new)
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, role, is_active, phone')
        .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      // Already a supplier with a complete profile → go straight to portal
      if (userData?.role === 'supplier') {
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('company_name')
          .eq('user_id', userData.id)
          .maybeSingle();

        if (supplierData?.company_name) {
          notificationService.show('✅ Welcome back!', 'success');
          navigate('/supplier-portal');
          return;
        }
      }

      // Customer upgrading to supplier, or new user → show profile form
      setProfileData(prev => ({
        ...prev,
        fullName: userData?.full_name || user.user_metadata?.full_name || '',
        phone:    userData?.phone    || user.user_metadata?.phone    || '',
      }));
      setShowProfileForm(true);
      if (userData?.role !== 'supplier') {
        notificationService.show('Complete your business profile to become a supplier.', 'info', 4000);
      }
    } catch (error) {
      console.error('❌ Auth check error:', error);
    } finally {
      setChecking(false);
    }
  };

  // =============================================
  // Handle Google Sign-In
  // =============================================
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      // Build explicit redirect URL (handle mobile and desktop)
      const protocol = window.location.protocol;
      const host = window.location.host;
      const explicitRedirectUrl = `${protocol}//${host}/supplier-auth`;
      
      console.log('🔐 OAuth redirect URL:', explicitRedirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: explicitRedirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        console.error('Google sign-in error:', error);
        notificationService.error('Failed to sign in with Google');
      }
      // OAuth redirect will happen automatically
      
    } catch (error) {
      console.error('Error in handleGoogleSignIn:', error);
      notificationService.error('An error occurred during sign-in');
      setLoading(false);
    }
  };

  // =============================================
  // Handle Profile Completion
  // =============================================
  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!profileData.companyName || !profileData.phone || !profileData.address || 
        !profileData.businessLicense || !profileData.category) {
      notificationService.show('Please fill in all required fields', 'error');
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        notificationService.show('Session expired. Please sign in again.', 'error');
        setShowProfileForm(false);
        return;
      }

      // Find existing public.users row (customer upgrading or new user)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      let publicUserId;

      if (existingUser) {
        // Update existing row (customer → supplier)
        const { error: updateErr } = await supabase
          .from('users')
          .update({
            full_name: profileData.fullName,
            phone:     profileData.phone,
            role:      'supplier',
            is_active: true,
            email:     user.email,
            auth_id:   user.id
          })
          .eq('id', existingUser.id);

        if (updateErr) throw updateErr;
        publicUserId = existingUser.id;
      } else {
        // Brand new user (Google sign-up)
        const { data: inserted, error: insertErr } = await supabase
          .from('users')
          .insert({
            auth_id:   user.id,
            email:     user.email,
            full_name: profileData.fullName,
            phone:     profileData.phone,
            role:      'supplier',
            is_active: true
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        publicUserId = inserted.id;
      }

      // Create / update the suppliers business profile (use actual table columns)
      const { error: supplierErr } = await supabase
        .from('suppliers')
        .upsert({
          user_id:       publicUserId,
          company_name:  profileData.companyName,
          contact_email: user.email,
          contact_phone: profileData.phone,
          address:       profileData.address,
          is_active:     true
        }, { onConflict: 'user_id' });

      if (supplierErr) console.warn('Supplier profile save warning:', supplierErr.message);

      notificationService.show('🎉 Supplier account ready! Apply to supermarkets inside your portal to receive orders.', 'success', 5000);
      navigate('/supplier-portal');

    } catch (error) {
      console.error('❌ Account creation error:', error);
      notificationService.show('Failed to create account: ' + (error.message || 'Unknown error'), 'error');
      setLoading(false);
    }
  };

  // =============================================
  // RENDER: Profile Completion Form
  // =============================================
  if (showProfileForm) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏭</div>
            <h1 className="auth-title">Create Your Supplier Account</h1>
            <p className="auth-subtitle">No supermarket needed to get started</p>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '10px' }}>
              Your account is created instantly. Apply to supermarkets inside your portal to start receiving orders via blockchain-verified transactions.
            </p>
          </div>

          <form onSubmit={handleCompleteProfile} className="auth-form">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                value={profileData.fullName}
                onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Company Name *</label>
              <input
                type="text"
                value={profileData.companyName}
                onChange={(e) => setProfileData({...profileData, companyName: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Business Address *</label>
              <textarea
                value={profileData.address}
                onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                rows="3"
                required
              />
            </div>

            <div className="form-group">
              <label>Business License Number *</label>
              <input
                type="text"
                value={profileData.businessLicense}
                onChange={(e) => setProfileData({...profileData, businessLicense: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Business Category *</label>
              <select
                value={profileData.category}
                onChange={(e) => setProfileData({...profileData, category: e.target.value})}
                required
              >
                <option value="">Select Category</option>
                <option value="Food & Beverages">Food & Beverages</option>
                <option value="Electronics">Electronics</option>
                <option value="Clothing">Clothing</option>
                <option value="Hardware">Hardware</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="auth-button"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Supplier Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: Loading State
  // =============================================
  if (checking) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1 className="auth-title">Loading...</h1>
          <p className="auth-subtitle">Please wait</p>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: No session — sign-in options
  // =============================================
  return (
    <div className="auth-container">
      <div className="auth-box">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏭</div>
          <h1 className="auth-title">Become a Supplier</h1>
          <p className="auth-subtitle">No supermarket needed — create your account and apply to supermarkets inside your portal to receive orders.</p>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px', marginBottom: '20px', fontSize: '14px', color: '#166534' }}>
          <strong>Already a customer?</strong> Go to your <button onClick={() => navigate('/customer-dashboard')} style={{ background: 'none', border: 'none', color: '#15803d', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>Customer Dashboard</button> and click <em>"Become a Supplier"</em> to upgrade your existing account.
        </div>

        <div style={{ textAlign: 'center', color: '#9ca3af', marginBottom: '16px', fontSize: '13px' }}>— or sign up fresh with Google —</div>

        <button
          onClick={handleGoogleSignIn}
          className="google-signin-button"
          disabled={loading}
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div className="auth-footer">
          <p>Your account is created instantly. Apply to supermarkets inside your portal to receive blockchain-verified orders.</p>
        </div>
      </div>
    </div>
  );
};

export default SupplierAuth;
