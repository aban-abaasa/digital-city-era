import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import {
  FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiPhone,
  FiShield, FiAlertCircle, FiArrowRight, FiLogIn,
  FiUserPlus, FiBriefcase, FiCheckCircle, FiClock,
  FiCalendar, FiMapPin, FiHome, FiBook, FiAward,
  FiUsers, FiCheck, FiArrowLeft, FiFileText
} from 'react-icons/fi';

const ManagerAuth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [profileStep, setProfileStep] = useState(1);
  
  // Supermarket selection state
  const [supermarkets, setSupermarkets] = useState([]);
  const [selectedSupermarket, setSelectedSupermarket] = useState('');
  const [loadingSupermarkets, setLoadingSupermarkets] = useState(true);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    department: '',
    // Profile completion fields
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    experienceYears: '',
    education: '',
    certifications: '',
    previousEmployer: '',
    employeeCount: '',
    emergencyContact: '',
    emergencyPhone: ''
  });

  const [errors, setErrors] = useState({});

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

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      
      // Store app context to prevent redirect to other apps
      localStorage.setItem('current_app', 'digital-city-era');
      localStorage.setItem('current_portal', 'manager');
      
      // Build explicit redirect URL (handle mobile and desktop)
      const protocol = window.location.protocol; // http: or https:
      const host = window.location.host; // includes port
      const explicitRedirectUrl = `${protocol}//${host}/manager-auth`;
      
      console.log('🔐 OAuth redirect URL:', explicitRedirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: explicitRedirectUrl
        }
      });

      if (error) throw error;

      notificationService.show(
        '🔄 Redirecting to Google...',
        'info'
      );

    } catch (error) {
      console.error('Google sign-in error:', error);
      notificationService.show(
        error.message || 'Failed to sign in with Google',
        'error'
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      // CRITICAL: Set app context IMMEDIATELY to prevent Farm Agent redirect
      localStorage.setItem('current_app', 'digital-city-era');
      localStorage.setItem('current_portal', 'manager');
      
      // Clear any Farm Agent data that might cause redirect
      // This prevents cross-app session confusion
      if (localStorage.getItem('farm_agent_session')) {
        localStorage.removeItem('farm_agent_session');
      }
      if (sessionStorage.getItem('farm_agent_session')) {
        sessionStorage.removeItem('farm_agent_session');
      }
      
      // Fetch supermarkets
      await fetchSupermarkets();

      // Check if we're returning from OAuth
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hasOAuthCallback = hashParams.has('access_token') || window.location.search.includes('code=');
      
      if (hasOAuthCallback) {
        console.log('🔄 OAuth callback detected, waiting for session...');
        // Wait for Supabase to process the OAuth callback
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      checkAuth();
    };
    
    initAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔍 Checking manager authentication...');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        console.log('✅ User authenticated:', user.email);
        setCurrentUser(user);
        
        // Check if this is a Google OAuth user
        const isGoogleUser = user.identities?.some(id => id.provider === 'google');
        
        // Check if user exists in database
        let { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('id, auth_id, email, full_name, role, is_active, phone, supermarket_id')
          .eq('auth_id', user.id)
          .single();

        console.log('👤 User data from database:', userData, 'Error:', fetchError?.code);

        // If user doesn't exist, it means:
        // 1. First time Google OAuth sign-in
        // 2. Trigger didn't create record
        // 3. Need to create it now or wait for trigger
        if (fetchError && fetchError.code === 'PGRST116') {
          console.log('📝 New Google OAuth user - Showing profile form');
          
          // New Google OAuth user - show profile form with supermarket selection
          if (isGoogleUser) {
            console.log('📋 Showing manager profile form for Google OAuth user');
            setShowProfileCompletion(true);
            setFormData(prev => ({
              ...prev,
              fullName: user.user_metadata?.full_name || '',
              phone: user.user_metadata?.phone || '',
              department: ''
            }));
            notificationService.show('Welcome! Please complete your manager profile.', 'info', 4000);
            return;
          }
          
          // Wait a moment for the trigger to create the record
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Try again
          const { data: retryData, error: retryError } = await supabase
            .from('users')
            .select('id, auth_id, email, full_name, role, is_active, phone, supermarket_id')
            .eq('auth_id', user.id)
            .single();
          
          if (retryData) {
            console.log('✅ User record created by trigger:', retryData);
            userData = retryData;
          } else if (retryError) {
            console.warn('⚠️ Trigger did not create record, using fallback...');
            // Fallback: Create temporary user object
            userData = {
              id: null,
              auth_id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
              role: 'customer',
              is_active: false,
              phone: null,
              supermarket_id: null
            };
            console.log('⚠️ Using fallback user object - record will be created on profile submission');
            notificationService.show('Welcome! Please complete your manager profile.', 'info', 4000);
          }
        } else if (fetchError) {
          console.error('❌ Database error:', fetchError);
          throw fetchError;
        }
        
        // Check if account is approved
        if (userData && !userData.is_active) {
          console.warn('⚠️ Account pending approval from administrator');
        }


        // Check if user has manager role
        const hasManagerRole = userData?.role === 'manager';
        const profileComplete = userData?.full_name && userData?.phone && userData?.supermarket_id;
        console.log('🔀 User status - Manager Role:', hasManagerRole, 'Profile Complete:', profileComplete, 'Active:', userData?.is_active);
        
        if (hasManagerRole && userData?.is_active && profileComplete) {
          // Approved manager with complete profile → Go to Manager Portal
          console.log('✅ Manager approved and profile complete - Redirecting to Manager Portal');
          notificationService.show('✅ Welcome back!', 'success');
          navigate('/manager');
        } else if (!hasManagerRole && !profileComplete) {
          // New Google sign-in, no manager role yet → Show profile form for application
          console.log('📋 New manager application - Showing profile form');
          setShowProfileCompletion(true);
          setFormData(prev => ({
            ...prev,
            fullName: userData?.full_name || '',
            phone: userData?.phone || '',
            department: userData?.department || ''
          }));
        } else if (!hasManagerRole && profileComplete) {
          // Profile submitted but waiting for admin approval → Show pending message
          console.log('⏳ Application submitted - Waiting for admin approval');
          notificationService.show(
            '📝 Your manager application has been submitted! An admin will review your request and grant you manager access.',
            'info',
            6000
          );
          await supabase.auth.signOut();
          setShowProfileCompletion(false);
        } else if (hasManagerRole && !userData?.is_active) {
          // Approved but not activated yet
          console.log('⏳ Manager role approved but not activated');
          notificationService.show(
            '⏳ Your manager account is being activated. Please try again in a moment.',
            'warning',
            5000
          );
          await supabase.auth.signOut();
        }
      } else {
        console.log('❌ No authenticated user found');
      }
    } catch (error) {
      console.error('❌ Auth check error:', error);
    }
  };

  const validateProfileStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!selectedSupermarket) newErrors.supermarket = 'Supermarket selection is required';
      if (!formData.fullName) newErrors.fullName = 'Full name is required';
      if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
      if (!formData.gender) newErrors.gender = 'Gender is required';
      if (!formData.phone) newErrors.phone = 'Phone is required';
      if (!formData.address) newErrors.address = 'Address is required';
      if (!formData.city) newErrors.city = 'City is required';
    }
    
    if (step === 2) {
      if (!formData.department) newErrors.department = 'Department is required';
      if (!formData.experienceYears) newErrors.experienceYears = 'Experience is required';
      if (!formData.education) newErrors.education = 'Education level is required';
    }
    
    if (step === 3) {
      if (!formData.emergencyContact) newErrors.emergencyContact = 'Emergency contact is required';
      if (!formData.emergencyPhone) newErrors.emergencyPhone = 'Emergency phone is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProfileNext = () => {
    if (validateProfileStep(profileStep)) {
      setProfileStep(profileStep + 1);
      setErrors({});
    }
  };

  const handleProfileBack = () => {
    setProfileStep(profileStep - 1);
    setErrors({});
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    
    if (!validateProfileStep(3)) return;

    setLoading(true);

    try {
      console.log('📝 Submitting manager profile...');
      
      // For new Google OAuth users, use currentUser.id (auth_id)
      // For existing users, use stored supermarket_user
      let authId;
      
      if (currentUser?.id) {
        // New Google OAuth user - use Supabase auth ID
        authId = currentUser.id;
        console.log('✅ Using Google OAuth auth_id:', authId);
      } else {
        // Existing user - get from localStorage
        const storedUser = localStorage.getItem('supermarket_user');
        const userData = storedUser ? JSON.parse(storedUser) : null;
        authId = userData?.auth_id || userData?.id;
        
        if (!authId) {
          throw new Error('User session not found. Please log in again.');
        }
        console.log('✅ Using stored user auth_id:', authId);
      }
      
      // Use direct upsert instead of RPC (RPC function may not be deployed yet)
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          auth_id: authId,
          email: currentUser?.email,
          full_name: formData.fullName,
          phone: formData.phone,
          role: 'manager',
          supermarket_id: selectedSupermarket,
          is_active: false, // Pending admin approval
          email_verified: currentUser?.email_verified || false
        }, { 
          onConflict: 'auth_id' 
        });

      if (upsertError) {
        console.error('❌ Upsert error:', upsertError);
        throw new Error(upsertError.message || 'Failed to submit profile');
      }

      console.log('✅ Manager profile submitted successfully');
      notificationService.show(
        '📝 Your manager application has been submitted! An admin will review your request and grant you manager access.',
        'success',
        6000
      );

      // Wait a moment then sign out (they need admin approval)
      setTimeout(async () => {
        await supabase.auth.signOut();
        setShowProfileCompletion(false);
        setProfileStep(1);
      }, 2000);

    } catch (error) {
      console.error('❌ Profile completion error:', error);
      notificationService.show(
        error.message || 'Failed to complete profile',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!isLogin) {
      if (!formData.fullName) {
        newErrors.fullName = 'Full name is required';
      }
      if (!formData.department) {
        newErrors.department = 'Department is required';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Use custom RPC login function that validates username/password
      const { data: loginResult, error: loginError } = await supabase
        .rpc('login_user', {
          p_username: formData.username,
          p_password: formData.password
        });

      if (loginError) {
        console.error('Login RPC error:', loginError);
        throw new Error('Invalid username or password');
      }

      if (!loginResult?.success) {
        // Check if pending approval
        if (loginResult?.pending_approval) {
          notificationService.show(
            '⏳ Your account is pending admin approval. You will be notified once approved.',
            'warning'
          );
        } else {
          throw new Error(loginResult?.error || 'Invalid username or password');
        }
        return;
      }

      // Verify role is manager
      if (loginResult.role !== 'manager') {
        throw new Error('This portal is for managers only');
      }

      // Store manager data
      localStorage.setItem('supermarket_user', JSON.stringify({
        id: loginResult.user_id,
        name: loginResult.full_name,
        role: 'manager',
        username: loginResult.username,
        timestamp: Date.now()
      }));

      notificationService.show('✅ Welcome back, Manager!', 'success');
      navigate('/manager-portal');

    } catch (error) {
      console.error('Login error:', error);
      notificationService.show(
        error.message || 'Invalid username or password',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Validate supermarket selection
    if (!selectedSupermarket) {
      notificationService.show('Please select a supermarket first', 'warning');
      return;
    }
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Call the register_manager RPC function (bypasses RLS, hashes password)
      const { data, error } = await supabase.rpc('register_manager', {
        p_username: formData.username,
        p_password: formData.password,
        p_full_name: formData.fullName,
        p_phone: formData.phone,
        p_department: formData.department,
        p_supermarket_id: selectedSupermarket
      });

      if (error) {
        console.error('❌ RPC error:', error);
        throw new Error(error.message || 'Failed to register manager');
      }

      if (!data.success) {
        throw new Error(data.error || 'Registration failed');
      }

      console.log('✅ Manager registered:', data);

      notificationService.show(
        '✅ Application submitted! Your manager account is pending admin approval.',
        'success',
        5000
      );

      // Switch to login view
      setTimeout(() => {
        setIsLogin(true);
        setFormData({
          username: formData.username,
          password: '',
          confirmPassword: '',
          fullName: '',
          phone: '',
          department: ''
        });
      }, 2000);

    } catch (error) {
      console.error('Signup error:', error);
      
      if (error.message && error.message.includes('Username already taken')) {
        notificationService.show(
          '⚠️ Username already taken. Please choose another.',
          'warning'
        );
      } else if (error.message && error.message.includes('For security purposes')) {
        notificationService.show(
          '⏱️ Please wait a moment before trying again.',
          'warning'
        );
      } else {
        notificationService.show(
          error.message || 'Failed to create account',
          'error'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Profile Completion Modal
  if (showProfileCompletion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-8 md:p-12 animate-scale-in">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
              <FiBriefcase className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Complete Your Manager Profile
            </h1>
            <p className="text-gray-600">
              Step {profileStep} of 3 - Fill in your details for admin approval
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              <span className={`text-sm font-medium ${profileStep >= 1 ? 'text-purple-600' : 'text-gray-400'}`}>
                Personal Info
              </span>
              <span className={`text-sm font-medium ${profileStep >= 2 ? 'text-purple-600' : 'text-gray-400'}`}>
                Professional
              </span>
              <span className={`text-sm font-medium ${profileStep >= 3 ? 'text-purple-600' : 'text-gray-400'}`}>
                Emergency
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${(profileStep / 3) * 100}%` }}
              ></div>
            </div>
          </div>

          <form onSubmit={profileStep === 3 ? handleCompleteProfile : (e) => { e.preventDefault(); handleProfileNext(); }}>
            {/* Step 1: Personal Information */}
            {profileStep === 1 && (
              <div className="space-y-5 animate-slide-in-right">
                {/* Supermarket Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🏪 Select Your Supermarket *
                  </label>
                  {loadingSupermarkets ? (
                    <div className="w-full p-3 bg-gray-100 rounded-xl text-gray-600 text-center">
                      Loading supermarkets...
                    </div>
                  ) : supermarkets.length === 0 ? (
                    <div className="w-full p-3 bg-yellow-50 rounded-xl text-yellow-700 flex items-center">
                      <FiAlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                      ⚠️ No supermarkets available. Contact an admin to create one.
                    </div>
                  ) : (
                    <select
                      value={selectedSupermarket}
                      onChange={(e) => setSelectedSupermarket(e.target.value)}
                      className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        !selectedSupermarket ? 'border-yellow-400 animate-shake' : 'border-gray-200'
                      }`}
                      required
                    >
                      <option value="">Choose a supermarket...</option>
                      {supermarkets.map(market => (
                        <option key={market.id} value={market.id}>
                          {market.name} - {market.location}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <FiUser className="inline w-4 h-4 mr-2" />
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        errors.fullName ? 'border-red-500 animate-shake' : 'border-gray-200'
                      }`}
                      placeholder="John Doe"
                    />
                    {errors.fullName && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.fullName}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <FiCalendar className="inline w-4 h-4 mr-2" />
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        errors.dateOfBirth ? 'border-red-500 animate-shake' : 'border-gray-200'
                      }`}
                    />
                    {errors.dateOfBirth && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.dateOfBirth}</p>}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <FiUser className="inline w-4 h-4 mr-2" />
                      Gender *
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        errors.gender ? 'border-red-500 animate-shake' : 'border-gray-200'
                      }`}
                    >
                      <option value="">Select gender...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.gender && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.gender}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <FiPhone className="inline w-4 h-4 mr-2" />
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        errors.phone ? 'border-red-500 animate-shake' : 'border-gray-200'
                      }`}
                      placeholder="+255 123 456 789"
                    />
                    {errors.phone && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.phone}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiHome className="inline w-4 h-4 mr-2" />
                    Address *
                    </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                      errors.address ? 'border-red-500 animate-shake' : 'border-gray-200'
                    }`}
                    placeholder="Street, building, floor..."
                  />
                  {errors.address && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiMapPin className="inline w-4 h-4 mr-2" />
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                      errors.city ? 'border-red-500 animate-shake' : 'border-gray-200'
                    }`}
                    placeholder="Dar es Salaam"
                  />
                  {errors.city && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.city}</p>}
                </div>
              </div>
            )}

            {/* Step 2: Professional Details */}
            {profileStep === 2 && (
              <div className="space-y-5 animate-slide-in-right">
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <FiBriefcase className="inline w-4 h-4 mr-2" />
                      Department *
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        errors.department ? 'border-red-500 animate-shake' : 'border-gray-200'
                      }`}
                      placeholder="Sales, Operations, etc."
                    />
                    {errors.department && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.department}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <FiClock className="inline w-4 h-4 mr-2" />
                      Years of Experience *
                    </label>
                    <input
                      type="number"
                      name="experienceYears"
                      value={formData.experienceYears}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        errors.experienceYears ? 'border-red-500 animate-shake' : 'border-gray-200'
                      }`}
                      placeholder="5"
                    />
                    {errors.experienceYears && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.experienceYears}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiBook className="inline w-4 h-4 mr-2" />
                    Education Level *
                  </label>
                  <select
                    name="education"
                    value={formData.education}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                      errors.education ? 'border-red-500 animate-shake' : 'border-gray-200'
                    }`}
                  >
                    <option value="">Select education level...</option>
                    <option value="high_school">High School</option>
                    <option value="diploma">Diploma</option>
                    <option value="bachelors">Bachelor's Degree</option>
                    <option value="masters">Master's Degree</option>
                    <option value="phd">PhD</option>
                  </select>
                  {errors.education && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.education}</p>}
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <FiAward className="inline w-4 h-4 mr-2" />
                      Certifications
                    </label>
                    <input
                      type="text"
                      name="certifications"
                      value={formData.certifications}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      placeholder="PMP, MBA, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <FiUsers className="inline w-4 h-4 mr-2" />
                      Team Size
                    </label>
                    <input
                      type="number"
                      name="employeeCount"
                      value={formData.employeeCount}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      placeholder="10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiBriefcase className="inline w-4 h-4 mr-2" />
                    Previous Employer
                  </label>
                  <input
                    type="text"
                    name="previousEmployer"
                    value={formData.previousEmployer}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    placeholder="ABC Company Ltd"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Emergency Contact */}
            {profileStep === 3 && (
              <div className="space-y-5 animate-slide-in-right">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-blue-800 text-sm flex items-center">
                    <FiAlertCircle className="w-5 h-5 mr-2" />
                    Please provide emergency contact information for safety purposes.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiUser className="inline w-4 h-4 mr-2" />
                    Emergency Contact Name *
                  </label>
                  <input
                    type="text"
                    name="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                      errors.emergencyContact ? 'border-red-500 animate-shake' : 'border-gray-200'
                    }`}
                    placeholder="Jane Doe"
                  />
                  {errors.emergencyContact && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.emergencyContact}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiPhone className="inline w-4 h-4 mr-2" />
                    Emergency Contact Phone *
                  </label>
                  <input
                    type="tel"
                    name="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                      errors.emergencyPhone ? 'border-red-500 animate-shake' : 'border-gray-200'
                    }`}
                    placeholder="+255 987 654 321"
                  />
                  {errors.emergencyPhone && <p className="text-red-600 text-sm mt-1 flex items-center"><FiAlertCircle className="w-4 h-4 mr-1" />{errors.emergencyPhone}</p>}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              {profileStep > 1 ? (
                <button
                  type="button"
                  onClick={handleProfileBack}
                  className="px-6 py-3 text-gray-600 hover:text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-all flex items-center space-x-2"
                >
                  <FiArrowLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
              ) : (
                <div></div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : profileStep === 3 ? (
                  <>
                    <span>Submit Application</span>
                    <FiCheck className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <span>Next Step</span>
                    <FiArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Main container */}
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 relative z-10">
        {/* Left side - Branding */}
        <div className="hidden md:flex flex-col justify-center text-white space-y-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <FiBriefcase className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">FAREDEAL</h1>
                <p className="text-blue-100">Manager Portal</p>
              </div>
            </div>
            <p className="text-xl text-blue-50">
              Manage your team, track sales, and monitor operations
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg">Team Management</h3>
                <p className="text-blue-100 text-sm">Schedule employees, track attendance, and manage performance</p>
              </div>
            </div>

            <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg">Sales Monitoring</h3>
                <p className="text-blue-100 text-sm">Real-time sales reports and analytics at your fingertips</p>
              </div>
            </div>

            <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg">Inventory Control</h3>
                <p className="text-blue-100 text-sm">Stock management, reorder alerts, and supplier coordination</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth form */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10">
          {/* Mobile branding */}
          <div className="md:hidden flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <FiBriefcase className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">FAREDEAL</h2>
              <p className="text-sm text-gray-600">Manager Portal</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              onClick={() => {
                setIsLogin(true);
                setErrors({});
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${
                isLogin
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FiLogIn className="w-5 h-5" />
              <span>Login</span>
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setErrors({});
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${
                !isLogin
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FiUserPlus className="w-5 h-5" />
              <span>Register</span>
            </button>
          </div>

          {/* Info banner for signup */}
          {!isLogin && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start space-x-3">
              <FiClock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">Admin Approval Required</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Your account will appear in admin's pending approvals immediately!
                </p>
              </div>
            </div>
          )}

          {/* Form title */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isLogin ? 'Welcome back!' : 'Create manager account'}
            </h2>
            <p className="text-gray-600">
              {isLogin
                ? 'Enter your credentials to access the manager portal'
                : 'Fill in your details to request manager access'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-5">
            {/* Full Name (Signup only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      errors.fullName
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-purple-500 focus:ring-purple-200'
                    }`}
                  />
                </div>
                {errors.fullName && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <FiAlertCircle className="w-4 h-4 mr-1" />
                    {errors.fullName}
                  </p>
                )}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username *
              </label>
              <div className="relative">
                <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="manager_john"
                  className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    errors.username
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-200 focus:border-purple-500 focus:ring-purple-200'
                  }`}
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <FiAlertCircle className="w-4 h-4 mr-1" />
                  {errors.username}
                </p>
              )}
            </div>

            {/* Phone and Department (Signup only) */}
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+256 700 000 000"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department *
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      errors.department
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-purple-500 focus:ring-purple-200'
                    }`}
                  >
                    <option value="">Select department</option>
                    <option value="Sales">Sales</option>
                    <option value="Operations">Operations</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Finance">Finance</option>
                  </select>
                  {errors.department && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <FiAlertCircle className="w-4 h-4 mr-1" />
                      {errors.department}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className={`w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    errors.password
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-200 focus:border-purple-500 focus:ring-purple-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <FiAlertCircle className="w-4 h-4 mr-1" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password (Signup only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      errors.confirmPassword
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-purple-500 focus:ring-purple-200'
                    }`}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <FiAlertCircle className="w-4 h-4 mr-1" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-purple-300 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{isLogin ? 'Logging in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Login to Portal' : 'Request Access'}</span>
                  <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {isLogin && (
            <>
              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-medium">Or continue with</span>
                </div>
              </div>

              {/* Google Sign In Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                type="button"
                className="w-full flex items-center justify-center space-x-3 px-4 py-3 border-2 border-gray-300 rounded-xl hover:border-purple-500 hover:bg-gray-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-gray-700 font-semibold group-hover:text-purple-700">
                  Sign in with Google
                </span>
              </button>
            </>
          )}

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-purple-600 hover:text-purple-700 font-semibold"
              >
                {isLogin ? 'Request access here' : 'Login here'}
              </button>
            </p>
          </div>

          {/* Security note */}
          <div className="mt-6 flex items-start space-x-2 bg-purple-50 rounded-xl p-4">
            <FiShield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-purple-900">
              Login with your username. Admin will approve your account to grant access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerAuth;
