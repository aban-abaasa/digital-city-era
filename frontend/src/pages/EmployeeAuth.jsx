import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import {
  FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiPhone,
  FiShield, FiAlertCircle, FiArrowRight, FiLogIn,
  FiUserPlus, FiUsers, FiCheckCircle, FiClock, FiBriefcase,
  FiMapPin, FiCalendar, FiAward, FiHeart, FiZap
} from 'react-icons/fi';

const EmployeeAuth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [profileStep, setProfileStep] = useState(1);
  const [completionProgress, setCompletionProgress] = useState(0);
  
  // Supermarket selection state
  const [supermarkets, setSupermarkets] = useState([]);
  const [selectedSupermarket, setSelectedSupermarket] = useState('');
  const [loadingSupermarkets, setLoadingSupermarkets] = useState(true);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    position: '',
    address: '',
    city: '',
    dateOfBirth: '',
    gender: '',
    education: '',
    experience: '',
    skills: '',
    emergencyContact: '',
    emergencyPhone: '',
    availability: 'full-time',
    idNumber: ''
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

  useEffect(() => {
    const initAuth = async () => {
      // CRITICAL: Set app context IMMEDIATELY to prevent Farm Agent redirect
      localStorage.setItem('current_app', 'supermartkera');
      localStorage.setItem('current_portal', 'employee');
      
      // Clear any Farm Agent data that might cause redirect
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
      console.log('🔍 Checking employee authentication...');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('✅ User authenticated:', user.email);
        
        // Check if this is a Google OAuth user
        const isGoogleUser = user.identities?.some(id => id.provider === 'google');
        
        if (isGoogleUser) {
          const supermarketId = localStorage.getItem('selected_supermarket');
          
          if (!supermarketId) {
            console.error('⚠️ No supermarket selected for Google OAuth');
            notificationService.show('Please select a supermarket and try again', 'warning');
            await supabase.auth.signOut();
            return;
          }

          console.log('👤 Creating user record for Google OAuth user with supermarket_id:', supermarketId);
          
          const fullName = user.user_metadata?.full_name || user.email?.split('@')[0];
          
          // Create user record in database
          const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert([{
              auth_id: user.id,
              email: user.email,
              full_name: fullName,
              phone: user.user_metadata?.phone || null,
              role: 'employee',
              supermarket_id: supermarketId,
              is_active: false,  // Admin approval needed
              profile_completed: false,
              employee_id: `EMP-${Date.now().toString().slice(-6)}`,
              email_verified: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (insertError && insertError.code !== '23505') {
            console.error('❌ Failed to create user:', insertError);
            notificationService.show('Failed to create user account', 'error');
            await supabase.auth.signOut();
            return;
          }

          console.log('✅ User created via Google OAuth:', insertedUser);
          notificationService.show(
            '👋 Welcome! Please complete your profile to get started',
            'info',
            5000
          );
          localStorage.removeItem('selected_supermarket');
          
          // Show profile completion form
          setCurrentUser(user);
          setShowProfileCompletion(true);
          setFormData(prev => ({
            ...prev,
            email: user.email,
            fullName: fullName,
            phone: user.user_metadata?.phone || ''
          }));
          return;
        }

        let { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, auth_id, email, full_name, role, is_active, phone, supermarket_id')
          .eq('auth_id', user.id)
          .single();

        // If no user record exists (Magic Link first-time signin), create one
        if (!userData) {
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
              auth_id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
              phone: user.user_metadata?.phone || '',
              role: 'employee',
              is_active: false,
              profile_completed: false,
              employee_id: `EMP-${Date.now().toString().slice(-6)}`
            })
            .select()
            .single();

          if (insertError) throw insertError;
          userData = newUser;
          
          // New user - show profile completion form
          setCurrentUser(user);
          setShowProfileCompletion(true);
          setFormData(prev => ({
            ...prev,
            email: user.email,
            fullName: userData.full_name || '',
            phone: userData.phone || ''
          }));
          notificationService.show('👋 Welcome! Please complete your profile to get started', 'info', 5000);
          return; // Stop here to show the form
        }

        // User record exists - check their status
        if (userData?.role === 'employee') {
          // Priority 1: If already approved - let them in
          if (userData.is_active) {
            navigate('/employee-portal');
            return;
          }
          
          // Priority 2: If profile NOT completed - show completion form
          if (!userData.profile_completed) {
            setCurrentUser(user);
            setShowProfileCompletion(true);
            setFormData(prev => ({
              ...prev,
              email: user.email || userData.email,
              fullName: userData.full_name || '',
              phone: userData.phone || '',
              position: userData.position || userData.department || '',
              address: userData.address || '',
              city: userData.city || '',
              dateOfBirth: userData.date_of_birth || '',
              gender: userData.gender || '',
              education: userData.education_level || '',
              experience: userData.previous_experience || '',
              skills: userData.skills || '',
              emergencyContact: userData.emergency_contact || '',
              emergencyPhone: userData.emergency_phone || '',
              availability: userData.availability || 'full-time',
              idNumber: userData.id_number || ''
            }));
            notificationService.show('👋 Welcome back! Please complete your profile to continue', 'info', 5000);
            return;
          }
          
          // Priority 3: Profile completed but NOT approved - show pending message
          notificationService.show('⏳ Your account is pending admin approval. You will be notified once approved.', 'info', 6000);
          // Sign them out so they don't stay logged in while pending
          setTimeout(async () => {
            await supabase.auth.signOut();
          }, 2000);
        }
      }
    } catch (error) {
      console.log('Not authenticated yet', error);
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

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
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
      if (!formData.phone) {
        newErrors.phone = 'Phone number is required';
      }
      if (!formData.position) {
        newErrors.position = 'Position is required';
      }
      if (!formData.address) {
        newErrors.address = 'Address is required';
      }
      if (!formData.city) {
        newErrors.city = 'City is required';
      }
      if (!formData.dateOfBirth) {
        newErrors.dateOfBirth = 'Date of birth is required';
      }
      if (!formData.emergencyContact) {
        newErrors.emergencyContact = 'Emergency contact is required';
      }
      if (!formData.emergencyPhone) {
        newErrors.emergencyPhone = 'Emergency phone is required';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateProfileStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!formData.fullName) newErrors.fullName = 'Full name is required';
      if (!formData.phone) newErrors.phone = 'Phone is required';
      if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
      if (!formData.address) newErrors.address = 'Address is required';
      if (!formData.city) newErrors.city = 'City is required';
    }
    
    if (step === 2) {
      if (!formData.position) newErrors.position = 'Position is required';
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
      console.log('📝 Submitting employee profile...');
      
      // For new Google OAuth users, INSERT a new record
      // For existing users, UPDATE their record
      let error;
      
      if (currentUser?.id) {
        // New Google OAuth user - INSERT with upsert
        console.log('✅ Creating new employee application...');
        
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            auth_id: currentUser.id,
            email: currentUser.email,
            full_name: formData.fullName,
            phone: formData.phone,
            role: 'employee',
            supermarket_id: selectedSupermarket,
            is_active: false, // Pending admin approval
            email_verified: currentUser.email_verified || false
          }, { 
            onConflict: 'auth_id' 
          });
        
        error = upsertError;
      } else {
        // Existing user - UPDATE their record
        console.log('✅ Updating existing employee profile...');
        
        const { error: updateError } = await supabase
          .from('users')
          .update({
            full_name: formData.fullName,
            phone: formData.phone,
            supermarket_id: selectedSupermarket,
            metadata: {
              date_of_birth: formData.dateOfBirth,
              gender: formData.gender,
              address: formData.address,
              city: formData.city,
              position: formData.position,
              availability: formData.availability,
              education_level: formData.education,
              previous_experience: formData.experience,
              skills: formData.skills,
              emergency_contact: formData.emergencyContact,
              emergency_phone: formData.emergencyPhone,
              id_number: formData.idNumber,
              submitted_at: new Date().toISOString()
            }
          })
          .eq('auth_id', currentUser.id);
        
        error = updateError;
      }

      if (error) throw error;

      notificationService.show(
        '🎉 Application submitted! Your profile is now pending admin approval.',
        'success',
        5000
      );

      // Sign out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        setShowProfileCompletion(false);
        setProfileStep(1);
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          fullName: '',
          phone: '',
          position: '',
          address: '',
          city: '',
          dateOfBirth: '',
          gender: '',
          education: '',
          experience: '',
          skills: '',
          emergencyContact: '',
          emergencyPhone: '',
          availability: 'full-time',
          idNumber: ''
        });
        notificationService.show(
          '⏳ Please wait for admin approval before signing in.',
          'info',
          4000
        );
      }, 2000);

    } catch (error) {
      console.error('Profile completion error:', error);
      notificationService.show(
        error.message || 'Failed to complete profile',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.email) {
      setErrors({ email: 'Email is required' });
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrors({ email: 'Email is invalid' });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          emailRedirectTo: `${window.location.origin}/employee-auth`
        }
      });

      if (error) throw error;

      setMagicLinkSent(true);
      notificationService.show(
        '📧 Magic link sent! Check your email and click the link to sign in.',
        'success',
        8000
      );

    } catch (error) {
      console.error('Magic link error:', error);
      notificationService.show(
        error.message || 'Failed to send magic link',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Validate supermarket selection
    if (!selectedSupermarket) {
      notificationService.show('Please select a supermarket first', 'warning');
      return;
    }

    try {
      setLoading(true);
      
      // Store selected supermarket in localStorage temporarily
      localStorage.setItem('selected_supermarket', selectedSupermarket);
      
      // Build explicit redirect URL (handle mobile and desktop)
      const protocol = window.location.protocol;
      const host = window.location.host;
      const explicitRedirectUrl = `${protocol}//${host}/employee-auth`;
      
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

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (error) {
        // Check if it's an email confirmation error
        if (error.message.toLowerCase().includes('email') && 
            error.message.toLowerCase().includes('confirm')) {
          notificationService.show(
            '📧 Please verify your email first! Check your inbox for the confirmation link.',
            'warning',
            6000
          );
          return;
        }
        throw error;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', data.user.id)
        .single();

      if (userError) throw userError;

      if (userData.role !== 'employee') {
        await supabase.auth.signOut();
        throw new Error('This portal is for employees only');
      }

      if (!userData.is_active) {
        await supabase.auth.signOut();
        notificationService.show(
          '⏳ Your account is pending admin approval. You will be notified once approved.',
          'warning'
        );
        return;
      }

      localStorage.setItem('supermarket_user', JSON.stringify({
        id: userData.id,
        name: userData.full_name,
        role: 'employee',
        email: userData.email,
        department: userData.department,
        timestamp: Date.now()
      }));

      notificationService.show('✅ Welcome back, Employee!', 'success');
      navigate('/employee-portal');

    } catch (error) {
      console.error('Login error:', error);
      notificationService.show(
        error.message || 'Invalid email or password',
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
            role: 'employee'
          },
          emailRedirectTo: `${window.location.origin}/employee-auth`
        }
      });

      if (authError) throw authError;

      // Check if email confirmation is required
      const needsEmailConfirmation = !authData.user?.email_confirmed_at && !authData.user?.confirmed_at;

      const { error: userError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          email: formData.email,
          full_name: formData.fullName,
          phone: formData.phone,
          role: 'employee',
          supermarket_id: selectedSupermarket,
          department: formData.position,
          position: formData.position,
          address: formData.address,
          city: formData.city,
          date_of_birth: formData.dateOfBirth,
          gender: formData.gender,
          education_level: formData.education,
          previous_experience: formData.experience,
          skills: formData.skills,
          emergency_contact: formData.emergencyContact,
          emergency_phone: formData.emergencyPhone,
          availability: formData.availability,
          id_number: formData.idNumber,
          is_active: false,
          profile_completed: true,
          employee_id: `EMP-${Date.now().toString().slice(-6)}`
        });

      if (userError) throw userError;

      if (needsEmailConfirmation) {
        notificationService.show(
          '📧 Please check your email to verify your account! After verification, your account will be pending admin approval.',
          'success',
          8000
        );
      } else {
        notificationService.show(
          '🎉 Employee account created! Your account is pending admin approval. You will receive an email once approved.',
          'success'
        );
      }

      setTimeout(() => {
        setIsLogin(true);
        setFormData({
          email: formData.email,
          password: '',
          confirmPassword: '',
          fullName: '',
          phone: '',
          position: '',
          address: '',
          city: '',
          dateOfBirth: '',
          gender: '',
          education: '',
          experience: '',
          skills: '',
          emergencyContact: '',
          emergencyPhone: '',
          availability: 'full-time',
          idNumber: ''
        });
      }, 3000);

    } catch (error) {
      console.error('Signup error:', error);
      notificationService.show(
        error.message || 'Failed to create account',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Profile Completion Multi-Step Form UI
  if (showProfileCompletion) {
    // Add custom animations
    const customStyles = `
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes bounce-slow {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @keyframes scale-in {
        0% { transform: scale(0); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      @keyframes slide-in-right {
        0% { opacity: 0; transform: translateX(20px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      @keyframes flow-right {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .animate-shimmer {
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
        background-size: 200% 100%;
        animation: shimmer 2s infinite;
      }
      .animate-bounce-slow {
        animation: bounce-slow 3s ease-in-out infinite;
      }
      .animate-scale-in {
        animation: scale-in 0.5s ease-out;
      }
      .animate-slide-in-right {
        animation: slide-in-right 0.5s ease-out;
      }
      .animate-shake {
        animation: shake 0.5s ease-in-out;
      }
      .animate-flow-right {
        animation: flow-right 1.5s ease-in-out infinite;
      }
    `;

    // Calculate completion percentage
    const calculateProgress = () => {
      let filled = 0;
      const totalFields = 11; // Required fields
      
      if (formData.fullName) filled++;
      if (formData.phone) filled++;
      if (formData.dateOfBirth) filled++;
      if (formData.address) filled++;
      if (formData.city) filled++;
      if (formData.position) filled++;
      if (formData.emergencyContact) filled++;
      if (formData.emergencyPhone) filled++;
      
      // Optional fields that add value
      if (formData.gender) filled++;
      if (formData.education) filled++;
      if (formData.experience) filled++;
      
      return Math.round((filled / totalFields) * 100);
    };

    const progress = calculateProgress();

    return (
      <>
        <style>{customStyles}</style>
        <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 flex items-center justify-center p-4 relative overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-8 relative z-10 transform transition-all duration-500 hover:shadow-indigo-500/20">
          {/* Header with Animation */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-bounce-slow">
                <FiBriefcase className="w-12 h-12 text-white" />
              </div>
              {/* Pulse Ring */}
              <div className="absolute inset-0 w-24 h-24 bg-indigo-400 rounded-full animate-ping opacity-20"></div>
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Complete Your Profile
            </h2>
            <p className="text-gray-600 text-lg">
              Welcome, <span className="font-semibold text-indigo-600">{formData.fullName || 'there'}</span>! 🎉
            </p>
            <p className="text-sm text-gray-500 mt-1">Let's get you set up for success</p>
          </div>

          {/* Overall Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Profile Completion</span>
              <span className="text-sm font-bold text-indigo-600">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700 ease-out rounded-full"
                style={{width: `${progress}%`}}
              >
                <div className="h-full w-full bg-white/30 animate-shimmer"></div>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-10">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`flex flex-col items-center transition-all duration-500 ${
                  profileStep >= s ? 'scale-100 opacity-100' : 'scale-90 opacity-40'
                }`}>
                  <div className={`relative flex items-center justify-center w-14 h-14 rounded-full font-bold text-lg transition-all duration-500 ${
                    profileStep >= s
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl scale-110'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {profileStep > s ? (
                      <FiCheckCircle className="w-7 h-7 animate-scale-in" />
                    ) : (
                      <span className={profileStep === s ? 'animate-pulse' : ''}>{s}</span>
                    )}
                    {/* Active Ring */}
                    {profileStep === s && (
                      <div className="absolute inset-0 rounded-full border-4 border-indigo-300 animate-ping"></div>
                    )}
                  </div>
                  <p className={`text-xs mt-2 font-bold transition-all duration-300 ${
                    profileStep >= s ? 'text-indigo-600' : 'text-gray-400'
                  }`}>
                    {s === 1 ? '📋 Personal' : s === 2 ? '💼 Work' : '🚨 Emergency'}
                  </p>
                </div>
                {s < 3 && (
                  <div className="relative mx-2">
                    <div className={`w-24 h-2 rounded-full transition-all duration-500 ${
                      profileStep > s ? 'bg-gradient-to-r from-indigo-500 to-purple-600' : 'bg-gray-200'
                    }`}>
                      {profileStep > s && (
                        <div className="h-full w-full bg-white/40 animate-flow-right"></div>
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={profileStep === 3 ? handleCompleteProfile : (e) => { e.preventDefault(); handleProfileNext(); }} className="relative">
            {/* Step 1: Personal Information */}
            {profileStep === 1 && (
              <div className="space-y-5 transition-all duration-500 animate-slide-in-right">
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-4 rounded-xl border-2 border-indigo-200 shadow-sm">
                  <h3 className="font-bold text-indigo-900 flex items-center text-lg">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mr-3">
                      <FiUser className="text-white" />
                    </div>
                    Personal Information
                  </h3>
                  <p className="text-sm text-indigo-600 mt-1 ml-11">Tell us about yourself</p>
                </div>

                <div className="relative group">
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <FiUser className="mr-2 text-indigo-500" />
                    Full Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className={`w-full px-4 py-3.5 border-2 rounded-xl focus:ring-4 focus:ring-indigo-200 transition-all duration-300 ${
                        errors.fullName 
                          ? 'border-red-500 focus:border-red-600' 
                          : formData.fullName 
                          ? 'border-green-400 focus:border-green-500 bg-green-50/30' 
                          : 'border-gray-300 focus:border-indigo-500'
                      }`}
                      placeholder="John Doe"
                    />
                    {formData.fullName && !errors.fullName && (
                      <FiCheckCircle className="absolute right-4 top-1/2 transform -translate-y-1/2 text-green-500 w-5 h-5" />
                    )}
                  </div>
                  {errors.fullName && (
                    <p className="text-red-500 text-sm mt-1.5 flex items-center animate-shake">
                      <FiAlertCircle className="mr-1" />
                      {errors.fullName}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-indigo-200 transition-all ${
                        errors.phone ? 'border-red-500' : 'border-gray-300 focus:border-indigo-500'
                      }`}
                      placeholder="+256 700 000 000"
                    />
                    {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth *</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-indigo-200 transition-all ${
                        errors.dateOfBirth ? 'border-red-500' : 'border-gray-300 focus:border-indigo-500'
                      }`}
                    />
                    {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 transition-all"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Address *</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-indigo-200 transition-all ${
                      errors.address ? 'border-red-500' : 'border-gray-300 focus:border-indigo-500'
                    }`}
                    placeholder="Street address"
                  />
                  {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-indigo-200 transition-all ${
                      errors.city ? 'border-red-500' : 'border-gray-300 focus:border-indigo-500'
                    }`}
                    placeholder="Kampala"
                  />
                  {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
                </div>
              </div>
            )}

            {/* Step 2: Work Information */}
            {profileStep === 2 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="bg-purple-50 px-4 py-3 rounded-xl border-2 border-purple-200">
                  <h3 className="font-bold text-purple-900 flex items-center">
                    <FiBriefcase className="mr-2" />
                    Work Information
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Desired Position *</label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-indigo-200 transition-all ${
                      errors.position ? 'border-red-500' : 'border-gray-300 focus:border-indigo-500'
                    }`}
                  >
                    <option value="">Select position</option>
                    <option value="Sales Associate">Sales Associate</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Stock Clerk">Stock Clerk</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Inventory Assistant">Inventory Assistant</option>
                    <option value="Security">Security</option>
                    <option value="Cleaner">Cleaner</option>
                    <option value="Delivery Personnel">Delivery Personnel</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.position && <p className="text-red-500 text-sm mt-1">{errors.position}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Availability</label>
                  <select
                    name="availability"
                    value={formData.availability}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 transition-all"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Education Level</label>
                  <select
                    name="education"
                    value={formData.education}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 transition-all"
                  >
                    <option value="">Select education level</option>
                    <option value="primary">Primary School</option>
                    <option value="o-level">O-Level</option>
                    <option value="a-level">A-Level</option>
                    <option value="certificate">Certificate</option>
                    <option value="diploma">Diploma</option>
                    <option value="degree">Degree</option>
                    <option value="masters">Masters</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Previous Experience (Optional)</label>
                  <textarea
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Tell us about your previous work experience..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Skills (Optional)</label>
                  <textarea
                    name="skills"
                    value={formData.skills}
                    onChange={handleChange}
                    rows="2"
                    placeholder="e.g., Customer service, POS systems, inventory management..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 transition-all resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Emergency Contact */}
            {profileStep === 3 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="bg-yellow-50 px-4 py-3 rounded-xl border-2 border-yellow-300">
                  <h3 className="font-bold text-yellow-900 flex items-center">
                    <FiAlertCircle className="mr-2" />
                    Emergency Contact Information
                  </h3>
                  <p className="text-sm text-yellow-700 mt-1">Required for workplace safety</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Name *</label>
                    <input
                      type="text"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-indigo-200 transition-all ${
                        errors.emergencyContact ? 'border-red-500' : 'border-gray-300 focus:border-indigo-500'
                      }`}
                      placeholder="Contact person"
                    />
                    {errors.emergencyContact && <p className="text-red-500 text-sm mt-1">{errors.emergencyContact}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Phone *</label>
                    <input
                      type="tel"
                      name="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-indigo-200 transition-all ${
                        errors.emergencyPhone ? 'border-red-500' : 'border-gray-300 focus:border-indigo-500'
                      }`}
                      placeholder="+256 700 000 000"
                    />
                    {errors.emergencyPhone && <p className="text-red-500 text-sm mt-1">{errors.emergencyPhone}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">ID Number (Optional)</label>
                  <input
                    type="text"
                    name="idNumber"
                    value={formData.idNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 transition-all"
                    placeholder="National ID or Passport number"
                  />
                </div>

                {/* Summary */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-indigo-200 mt-6">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center">
                    <FiCheckCircle className="mr-2 text-green-600" />
                    Application Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="font-semibold">Name:</span> {formData.fullName}</div>
                    <div><span className="font-semibold">Position:</span> {formData.position}</div>
                    <div><span className="font-semibold">Phone:</span> {formData.phone}</div>
                    <div><span className="font-semibold">City:</span> {formData.city}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t-2 border-gray-200">
              {profileStep > 1 ? (
                <button
                  type="button"
                  onClick={handleProfileBack}
                  disabled={loading}
                  className="px-6 py-3 text-indigo-600 border-2 border-indigo-300 rounded-xl hover:bg-indigo-50 transition-all duration-300 font-semibold disabled:opacity-50"
                >
                  ← Back
                </button>
              ) : (
                <div></div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`px-8 py-3 ${
                  profileStep === 3
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                } text-white rounded-xl transition-all duration-300 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>{profileStep === 3 ? '🎉 Submit Application' : 'Next Step'}</span>
                    {profileStep < 3 && <FiArrowRight />}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 relative z-10">
        {/* Left side - Branding */}
        <div className="hidden md:flex flex-col justify-center text-white space-y-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <FiUsers className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Supermartkera</h1>
                <p className="text-indigo-100">Employee Portal</p>
              </div>
            </div>
            <p className="text-xl text-indigo-50">
              Join our team and grow your career
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg">Professional Growth</h3>
                <p className="text-indigo-100 text-sm">Training opportunities and career advancement</p>
              </div>
            </div>

            <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg">Competitive Benefits</h3>
                <p className="text-indigo-100 text-sm">Fair salary, allowances, and employee benefits</p>
              </div>
            </div>

            <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <FiCheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg">Great Work Environment</h3>
                <p className="text-indigo-100 text-sm">Supportive team and positive workplace culture</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth form */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10">
          <div className="md:hidden flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <FiUsers className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Supermartkera</h2>
              <p className="text-sm text-gray-600">Employee Portal</p>
            </div>
          </div>

          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              onClick={() => {
                setIsLogin(true);
                setErrors({});
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${
                isLogin
                  ? 'bg-white text-indigo-600 shadow-md'
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
                  ? 'bg-white text-indigo-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FiUserPlus className="w-5 h-5" />
              <span>Join Team</span>
            </button>
          </div>

          {!isLogin && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start space-x-3">
              <FiClock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">Admin Approval Required</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Your application will be reviewed by HR before you can access the portal.
                </p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isLogin ? 'Welcome back!' : 'Join our team'}
            </h2>
            <p className="text-gray-600">
              {isLogin
                ? 'Access your employee dashboard'
                : 'Apply to become a Supermartkera employee'}
            </p>
          </div>

          {isLogin && !magicLinkSent && (
            <div className="mb-4 flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => setUseMagicLink(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  !useMagicLink
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🔑 Password
              </button>
              <button
                type="button"
                onClick={() => setUseMagicLink(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  useMagicLink
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                📧 Email Link
              </button>
            </div>
          )}

          {magicLinkSent ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="text-xl font-bold text-green-900 mb-2">Check Your Email!</h3>
              <p className="text-green-700 mb-4">
                We've sent a magic link to <strong>{formData.email}</strong>
              </p>
              <p className="text-sm text-green-600 mb-4">
                Click the link in your email to sign in instantly. The link expires in 1 hour.
              </p>
              <button
                onClick={() => {
                  setMagicLinkSent(false);
                  setUseMagicLink(false);
                  setFormData(prev => ({ ...prev, email: '' }));
                }}
                className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm"
              >
                ← Back to login
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={isLogin && useMagicLink ? handleMagicLinkLogin : (isLogin ? handleLogin : handleSignup)} className="space-y-5">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                          !selectedSupermarket
                            ? 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-200'
                            : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
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
                )}

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
                        : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="employee@supermartkera.ug"
                  className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    errors.email
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <FiAlertCircle className="w-4 h-4 mr-1" />
                  {errors.email}
                </p>
              )}
            </div>

            {!isLogin && (
              <>
                {/* Personal Information Section */}
                <div className="bg-indigo-50 px-3 py-2 rounded-lg">
                  <h4 className="text-sm font-semibold text-indigo-900">📋 Personal Information</h4>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+256 700 000 000"
                        className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                          errors.phone
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                            : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
                        }`}
                      />
                    </div>
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <FiAlertCircle className="w-4 h-4 mr-1" />
                        {errors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth *
                    </label>
                    <div className="relative">
                      <FiCalendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                          errors.dateOfBirth
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                            : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
                        }`}
                      />
                    </div>
                    {errors.dateOfBirth && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <FiAlertCircle className="w-4 h-4 mr-1" />
                        {errors.dateOfBirth}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address *
                  </label>
                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Street address"
                      className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                        errors.address
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
                      }`}
                    />
                  </div>
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <FiAlertCircle className="w-4 h-4 mr-1" />
                      {errors.address}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Kampala"
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      errors.city
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
                    }`}
                  />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <FiAlertCircle className="w-4 h-4 mr-1" />
                      {errors.city}
                    </p>
                  )}
                </div>

                {/* Work Information Section */}
                <div className="bg-indigo-50 px-3 py-2 rounded-lg mt-4">
                  <h4 className="text-sm font-semibold text-indigo-900">💼 Work Information</h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Desired Position *
                  </label>
                  <div className="relative">
                    <FiBriefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <select
                      name="position"
                      value={formData.position}
                      onChange={handleChange}
                      className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                        errors.position
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
                      }`}
                    >
                      <option value="">Select position</option>
                      <option value="Sales Associate">Sales Associate</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Stock Clerk">Stock Clerk</option>
                      <option value="Customer Service">Customer Service</option>
                      <option value="Inventory Assistant">Inventory Assistant</option>
                      <option value="Security">Security</option>
                      <option value="Cleaner">Cleaner</option>
                      <option value="Delivery Personnel">Delivery Personnel</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {errors.position && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <FiAlertCircle className="w-4 h-4 mr-1" />
                      {errors.position}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Availability
                  </label>
                  <select
                    name="availability"
                    value={formData.availability}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Education Level
                  </label>
                  <select
                    name="education"
                    value={formData.education}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  >
                    <option value="">Select education level</option>
                    <option value="primary">Primary School</option>
                    <option value="o-level">O-Level</option>
                    <option value="a-level">A-Level</option>
                    <option value="certificate">Certificate</option>
                    <option value="diploma">Diploma</option>
                    <option value="degree">Degree</option>
                    <option value="masters">Masters</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Previous Experience (Optional)
                  </label>
                  <textarea
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    rows="2"
                    placeholder="Brief description of your previous work experience..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skills (Optional)
                  </label>
                  <textarea
                    name="skills"
                    value={formData.skills}
                    onChange={handleChange}
                    rows="2"
                    placeholder="e.g., Customer service, POS systems, inventory management..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
                  />
                </div>

                {/* Emergency Contact Section */}
                <div className="bg-yellow-50 px-3 py-2 rounded-lg mt-4">
                  <h4 className="text-sm font-semibold text-yellow-900">🚨 Emergency Contact</h4>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      placeholder="Contact person"
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                        errors.emergencyContact
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
                      }`}
                    />
                    {errors.emergencyContact && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <FiAlertCircle className="w-4 h-4 mr-1" />
                        {errors.emergencyContact}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Phone *
                    </label>
                    <input
                      type="tel"
                      name="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={handleChange}
                      placeholder="+256 700 000 000"
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                        errors.emergencyPhone
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
                      }`}
                    />
                    {errors.emergencyPhone && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <FiAlertCircle className="w-4 h-4 mr-1" />
                        {errors.emergencyPhone}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Number (Optional)
                  </label>
                  <input
                    type="text"
                    name="idNumber"
                    value={formData.idNumber}
                    onChange={handleChange}
                    placeholder="National ID or Passport number"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  />
                </div>
              </>
            )}

            {(!isLogin || (isLogin && !useMagicLink)) && (
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
                        : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
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
            )}

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
                        : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{isLogin && useMagicLink ? 'Sending link...' : (isLogin ? 'Logging in...' : 'Submitting...')}</span>
                </>
              ) : (
                <>
                  <span>{isLogin && useMagicLink ? '📧 Send Magic Link' : (isLogin ? 'Access Portal' : 'Apply Now')}</span>
                  <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
              </button>
              </form>

              {isLogin && !magicLinkSent && (
                <>
                  {/* Supermarket Selection for Google Sign-In */}
                  <div className="mt-6 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                          !selectedSupermarket
                            ? 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-200'
                            : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
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

                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      {useMagicLink ? (
                        <>No password needed! Just click the link we send to your email.</>
                      ) : (
                        <>Passwordless login available with Email Link option above</>
                      )}
                    </p>
                  </div>

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
                    className="w-full flex items-center justify-center space-x-3 px-4 py-3 border-2 border-gray-300 rounded-xl hover:border-indigo-500 hover:bg-gray-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span className="text-gray-700 font-semibold group-hover:text-indigo-700">
                      Sign in with Google
                    </span>
                  </button>
                </>
              )}
            </>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                {isLogin ? 'Apply here' : 'Login here'}
              </button>
            </p>
          </div>

          <div className="mt-6 flex items-start space-x-2 bg-indigo-50 rounded-xl p-4">
            <FiShield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-900">
              All employee applications are reviewed by our HR team. Background checks and verification will be conducted before approval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeAuth;
