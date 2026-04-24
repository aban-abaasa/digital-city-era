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
  
  // Supermarket selection state
  const [supermarkets, setSupermarkets] = useState([]);
  const [selectedSupermarket, setSelectedSupermarket] = useState('');
  const [loadingSupermarkets, setLoadingSupermarkets] = useState(true);
  
  // Profile Form Fields
  const [profileData, setProfileData] = useState({
    fullName: '',
    companyName: '',
    phone: '',
    address: '',
    businessLicense: '',
    category: ''
  });

  // Fetch supermarkets from database
  const fetchSupermarkets = async () => {
    try {
      console.log('🏪 Fetching supermarkets...');
      const { data, error } = await supabase
        .from('supermarkets')
        .select('id, name, location')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('❌ Error fetching supermarkets:', error);
        notificationService.show('Failed to load supermarkets', 'error');
        return;
      }

      console.log('✅ Loaded supermarkets:', data);
      setSupermarkets(data || []);
      
      // Auto-select first supermarket
      if (data && data.length > 0) {
        setSelectedSupermarket(data[0].id);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingSupermarkets(false);
    }
  };

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
    
    // Fetch supermarkets
    fetchSupermarkets();

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
      console.log('🔍 Checking supplier authentication...');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        console.log('✅ User authenticated:', user.email);
        console.log('📌 Auth user ID:', user.id);
        setCurrentUser(user);
        
        // Check if this is a Google OAuth user
        const isGoogleUser = user.identities?.some(id => id.provider === 'google');
        
        // Check if user exists in database
        let { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('id, auth_id, email, full_name, role, is_active, phone, supermarket_id')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (fetchError) {
          console.error('❌ Error fetching user data:', fetchError);
        }

        // If user exists, also fetch supplier profile details
        let supplierData = null;
        if (userData && userData.role === 'supplier') {
          console.log('🔍 Looking for supplier record with user_id:', userData.id);
          const { data: supplier, error: supplierError } = await supabase
            .from('suppliers')
            .select('id, user_id, company_name, contact_person, phone, address, is_approved')
            .eq('user_id', userData.id)
            .maybeSingle();

          if (supplierError) {
            console.error('❌ Error fetching supplier profile:', supplierError);
          } else {
            supplierData = supplier;
            console.log('📋 Supplier profile data found:', supplierData);
            if (supplierData) {
              console.log('   - Company:', supplierData.company_name);
              console.log('   - Is Approved:', supplierData.is_approved);
              console.log('   - ID:', supplierData.id);
            } else {
              console.warn('⚠️ No supplier record found for this user');
            }
          }
        } else {
          console.warn('⚠️ User is not a supplier or userData is missing');
        }

        console.log('👤 Raw user data from database:', userData);
        console.log('📊 User data details - Auth ID:', user.id, 'Query returned:', userData ? 'yes' : 'no');
        console.log('📊 User fields - full_name:', userData?.full_name, 'phone:', userData?.phone, 'supermarket_id:', userData?.supermarket_id);
        console.log('📊 User status - role:', userData?.role, 'is_active:', userData?.is_active);

        // Check if user is a supplier
        if (userData && userData.role !== 'supplier') {
          console.warn('⚠️ User exists but is not a supplier, role:', userData.role);
          userData = null;
        }

        // If user doesn't exist, it's a new Google OAuth sign-in
        if (!userData) {
          console.log('📝 New Google OAuth user - Showing profile form');
          
          // Show profile completion form
          if (isGoogleUser) {
            console.log('📋 Showing supplier profile form for Google OAuth user');
            setShowProfileForm(true);
            setProfileData(prev => ({
              ...prev,
              fullName: user.user_metadata?.full_name || '',
              phone: user.user_metadata?.phone || '',
              email: user.email
            }));
            notificationService.show('Welcome! Please complete your supplier profile.', 'info', 4000);
            return;
          }
        }

        // Check if profile is complete
        const hasRequiredData = userData?.full_name && userData?.phone && supplierData?.company_name && userData?.supermarket_id;
        console.log('🔀 Supplier status - Profile Complete:', hasRequiredData, 'Approved:', supplierData?.is_approved, 'Active:', userData?.is_active);
        
        if (!hasRequiredData) {
          // Incomplete profile → Show profile form
          console.log('📋 Incomplete profile - Showing profile form');
          setShowProfileForm(true);
          setProfileData(prev => ({
            ...prev,
            fullName: userData?.full_name || user.user_metadata?.full_name || '',
            phone: userData?.phone || '',
            companyName: supplierData?.company_name || '',
            address: supplierData?.address || '',
            businessLicense: '',
            category: '',
            email: user.email
          }));
        } else if (userData?.is_active || supplierData?.is_approved) {
          // Profile complete AND approved (check both is_active in users and is_approved in suppliers) → Go to supplier portal
          console.log('✅ Supplier approved and profile complete - Redirecting to Supplier Portal');
          notificationService.show('✅ Welcome back!', 'success');
          navigate('/supplier-portal');
        } else {
          // Profile complete but not approved yet
          console.log('⏳ Application submitted - Waiting for admin approval');
          notificationService.show(
            '📝 Your supplier application has been submitted! An admin will review your request.',
            'info',
            6000
          );
          setTimeout(() => {
            supabase.auth.signOut();
            setShowProfileForm(false);
          }, 3000);
        }
      } else {
        console.log('❌ No authenticated user found');
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

      console.log('📝 Submitting supplier application...');

      // For new Google OAuth users, INSERT with upsert
      // For existing users, UPDATE their record
      const { error } = await supabase
        .from('users')
        .upsert({
          auth_id: user.id,
          email: user.email,
          full_name: profileData.fullName,
          phone: profileData.phone,
          role: 'supplier',
          is_active: false, // Pending admin approval
          email_verified: user.email_verified || false,
          supermarket_id: selectedSupermarket // Store selected supermarket
        }, { 
          onConflict: 'auth_id' 
        });
      
      if (error) {
        console.error('❌ Profile submission error:', error);
        notificationService.show('Failed to submit application. Please try again.', 'error');
        setLoading(false);
        return;
      }

      // Also create supplier record with company details
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (userData) {
        await supabase.from('suppliers').upsert({
          user_id: userData.id,
          company_name: profileData.companyName,
          contact_person: profileData.fullName,
          phone: profileData.phone,
          address: profileData.address,
          business_license: profileData.businessLicense,
          category: profileData.category,
          is_approved: false
        }, {
          onConflict: 'user_id'
        });
      }

      console.log('✅ Application submitted successfully');
      notificationService.show('🎉 Your application has been submitted! An admin will review it soon.', 'success');
      
      // Sign out and show pending message
      await supabase.auth.signOut();
      setShowProfileForm(false);
      notificationService.show('⏳ Your supplier application is pending admin approval.', 'warning', 5000);

    } catch (error) {
      console.error('Error completing profile:', error);
      notificationService.error('An error occurred');
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
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>👋</div>
            <h1 className="auth-title">Welcome to Supermartkera!</h1>
            <p className="auth-subtitle">Let's set up your supplier profile</p>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '10px' }}>
              Complete your profile to start managing orders and payments
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

            <div className="form-group">
              <label>Select Supermarket *</label>
              {loadingSupermarkets ? (
                <div style={{ color: '#666' }}>Loading supermarkets...</div>
              ) : (
                <select
                  value={selectedSupermarket}
                  onChange={(e) => setSelectedSupermarket(e.target.value)}
                  required
                >
                  <option value="">Select a Supermarket</option>
                  {supermarkets.map(sm => (
                    <option key={sm.id} value={sm.id}>
                      {sm.name} - {sm.location}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button 
              type="submit" 
              className="auth-button"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Complete Profile'}
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
  // RENDER: Google Sign-In Button
  // =============================================
  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-title">Supplier Portal</h1>
        <p className="auth-subtitle">Sign in with your Google account</p>

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
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <div className="auth-footer">
          <p>After signing in, you'll complete your business profile and wait for admin approval.</p>
        </div>
      </div>
    </div>
  );
};

export default SupplierAuth;
