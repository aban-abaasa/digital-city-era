import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiUser, FiMail, FiPhone, FiMapPin, FiEdit2, FiSave, FiX,
  FiCamera, FiShield, FiAward, FiTrendingUp, FiSettings,
  FiClock, FiCheckCircle, FiBriefcase, FiPackage, FiShoppingCart,
  FiUsers, FiCalendar, FiHome, FiGlobe, FiHeart, FiStar
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

// onClose: when set, this is being shown as a popup over the current portal
// (see ProfileModal) and the close button calls onClose() instead of
// navigating away. When rendered directly at the /profile route, onClose is
// undefined and closing falls back to a real navigation to the user's portal.
const UnifiedProfilePage = ({ onClose } = {}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({});
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  const [supermarket, setSupermarket] = useState(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const backgroundInputRef = useRef(null);

  // Emoji avatars for selection
  const emojiAvatars = ['👤', '👨', '👩', '🧑', '👨‍💼', '👩‍💼', '👨‍🔧', '👩‍🔧',
    '👨‍🍳', '👩‍🍳', '🤵', '👗', '🎓', '💼', '🛍️', '🌟'];

  // Role hierarchy: customer < cashier < manager < admin.
  // Admin has authority over every role from customer up through cashier and manager
  // (enforced server-side by public.has_role_authority in unified_profiles' RLS).
  const ASSIGNABLE_ROLES = ['manager', 'cashier', 'customer'];
  const ROLE_BADGE_STYLES = {
    manager: 'bg-blue-100 text-blue-700',
    cashier: 'bg-green-100 text-green-700',
    customer: 'bg-amber-100 text-amber-700'
  };

  useEffect(() => {
    if (user) {
      loadProfile();
      loadOnboardingProgress();
    }
  }, [user]);

  useEffect(() => {
    if (profile?.role?.toLowerCase() === 'admin' && profile?.supermarket_id) {
      loadTeamMembers(profile.supermarket_id, profile.user_id);
      loadSupermarketDetails(profile.supermarket_id);
    }
  }, [profile?.role, profile?.supermarket_id, profile?.user_id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Get user record
      const { data: userRecord, error: recordError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', userData.user.id)
        .single();

      if (recordError) throw recordError;

      // Get unified profile — maybeSingle so zero rows doesn't throw a 406
      let { data: profileData, error: profileError } = await supabase
        .from('unified_profiles')
        .select('*')
        .eq('user_id', userRecord.id)
        .maybeSingle();

      if (profileError) throw profileError;

      // Self-heal: some accounts predate the auto-create trigger and never
      // got a unified_profiles row. Create one now instead of spinning forever.
      if (!profileData) {
        const { data: createdProfile, error: createError } = await supabase
          .from('unified_profiles')
          .upsert({
            user_id: userRecord.id,
            full_name: userRecord.full_name || 'User',
            email: userRecord.email,
            phone: userRecord.phone,
            role: userRecord.role || 'customer',
            supermarket_id: userRecord.supermarket_id
          }, { onConflict: 'user_id' })
          .select('*')
          .single();

        if (createError) throw createError;
        profileData = createdProfile;
      }

      if (profileData) {
        setProfile(profileData);
        setFormData(profileData);
        setProfileCompletion(profileData.profile_completion_percentage || 0);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadOnboardingProgress = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userData.user.id)
        .single();

      const { data: progress } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', userRecord.id)
        .maybeSingle();

      if (progress) {
        setOnboardingProgress(progress);
      }
    } catch (error) {
      console.error('Error loading onboarding:', error);
    }
  };

  // Admin-only: everyone in the admin's supermarket from customer up through
  // cashier and manager — this is what backs the admin's role-based access power.
  const loadTeamMembers = async (supermarketId, currentUserId) => {
    try {
      setLoadingTeam(true);
      const { data, error } = await supabase
        .from('unified_profiles')
        .select('id, user_id, full_name, email, role, status, avatar')
        .eq('supermarket_id', supermarketId)
        .neq('user_id', currentUserId)
        .in('role', ASSIGNABLE_ROLES)
        .order('role', { ascending: false });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoadingTeam(false);
    }
  };

  // Every admin auto-gets their own supermarket on signup (see
  // FIX_SUPERMARKET_ISOLATION_V2.sql) — pull its real name/location/phone in
  // and auto-fill the profile's business fields from it instead of making
  // the admin retype what the system already knows.
  const loadSupermarketDetails = async (supermarketId) => {
    try {
      const { data: supermarketData, error } = await supabase
        .from('supermarkets')
        .select('*')
        .eq('id', supermarketId)
        .maybeSingle();

      if (error) throw error;
      if (!supermarketData) return;

      setSupermarket(supermarketData);

      if (!profile || profile.business_name) return;

      const filledFields = {
        business_name: supermarketData.name,
        location: profile.location || supermarketData.location || supermarketData.address
      };

      setProfile(prev => (prev ? { ...prev, ...filledFields } : prev));
      setFormData(prev => (prev ? { ...prev, ...filledFields } : prev));

      // Persist quietly so the auto-filled details are actually attached to the profile
      const { error: fillError } = await supabase
        .from('unified_profiles')
        .update(filledFields)
        .eq('id', profile.id);
      if (fillError) console.error('Error auto-filling supermarket details:', fillError);
    } catch (error) {
      console.error('Error loading supermarket details:', error);
    }
  };

  const handleRoleChange = async (member, newRole) => {
    if (!ASSIGNABLE_ROLES.includes(newRole) || newRole === member.role) return;

    try {
      setSavingRoleId(member.id);

      // users.role is the source of truth for auth/routing — unified_profiles.role
      // must always move together with it.
      const { error: userError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', member.user_id);
      if (userError) throw userError;

      const { error: profileError } = await supabase
        .from('unified_profiles')
        .update({ role: newRole })
        .eq('id', member.id);
      if (profileError) throw profileError;

      setTeamMembers(prev => prev.map(m => (m.id === member.id ? { ...m, role: newRole } : m)));
      toast.success(`${member.full_name || member.email} is now ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('unified_profiles')
        .update(formData)
        .eq('id', profile.id);

      if (error) throw error;

      setProfile(formData);
      setEditing(false);
      toast.success('Profile updated successfully!');
      loadProfile(); // Reload to get updated completion percentage
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile);
    setEditing(false);
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { error: profileError } = await supabase
        .from('unified_profiles')
        .update({ avatar_url: base64String, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (profileError) throw profileError;

      // Keep users.avatar_url in sync — other portals read from there
      await supabase
        .from('users')
        .update({ avatar_url: base64String, updated_at: new Date().toISOString() })
        .eq('id', profile.user_id);

      setProfile(prev => ({ ...prev, avatar_url: base64String }));
      setFormData(prev => ({ ...prev, avatar_url: base64String }));
      toast.success('✅ Profile photo updated!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload profile photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Background image for the whole supermarket — shared across admin, manager,
  // cashier and customer portals for that supermarket (see useSupermarketBranding).
  const handleBackgroundUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !supermarket) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image size should be less than 3MB');
      return;
    }

    try {
      setUploadingBackground(true);
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { error } = await supabase
        .from('supermarkets')
        .update({ background_image_url: base64String, updated_at: new Date().toISOString() })
        .eq('id', supermarket.id);
      if (error) throw error;

      setSupermarket(prev => ({ ...prev, background_image_url: base64String }));
      toast.success('✅ Portal background updated for your whole supermarket!');
    } catch (error) {
      console.error('Error uploading background image:', error);
      toast.error('Failed to upload background image');
    } finally {
      setUploadingBackground(false);
    }
  };

  const getPortalLink = () => {
    const role = profile?.role?.toLowerCase();
    const routes = {
      admin: '/admin-portal',
      manager: '/manager-portal',
      cashier: '/employee-portal',
      customer: '/customer-dashboard',
      supplier: '/supplier-portal'
    };
    return routes[role] || '/';
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  const role = profile.role?.toLowerCase();
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isCashier = role === 'cashier';
  const isCustomer = role === 'customer';

  return (
    <div className={`bg-gradient-to-br from-blue-50 via-white to-purple-50 ${onClose ? 'rounded-2xl' : 'min-h-screen'}`}>
      {/* Header with Back Button */}
      <div className={`bg-white shadow-sm border-b sticky top-0 z-10 ${onClose ? 'rounded-t-2xl' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => (onClose ? onClose() : navigate(getPortalLink()))}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <FiX className="h-6 w-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-500">
                  {profile.role} • {profile.status}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <FiEdit2 className="h-4 w-4" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    <FiX className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    <FiSave className="h-4 w-4" />
                    <span>Save Changes</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
              {/* Avatar */}
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-5xl overflow-hidden">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      profile.avatar || '👤'
                    )}
                  </div>
                  {editing && (
                    <>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        {uploadingAvatar ? (
                          <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FiCamera className="h-4 w-4 text-gray-600" />
                        )}
                      </button>
                    </>
                  )}
                </div>
                <h3 className="mt-4 text-xl font-bold text-gray-900">{profile.full_name}</h3>
                <p className="text-sm text-gray-500">{profile.email}</p>
              </div>

              {/* Profile Completion */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Profile Completion</span>
                  <span className="text-sm font-bold text-blue-600">{profileCompletion}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${profileCompletion}%` }}
                  ></div>
                </div>
                {profileCompletion < 100 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Complete your profile to unlock all features!
                  </p>
                )}
              </div>

              {/* Navigation Tabs */}
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                    activeTab === 'basic'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <FiUser className="h-5 w-5" />
                  <span className="font-medium">Basic Info</span>
                </button>

                {(isManager || isCashier) && (
                  <button
                    onClick={() => setActiveTab('work')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                      activeTab === 'work'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <FiBriefcase className="h-5 w-5" />
                    <span className="font-medium">Work Details</span>
                  </button>
                )}

                {isCustomer && (
                  <button
                    onClick={() => setActiveTab('shopping')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                      activeTab === 'shopping'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <FiShoppingCart className="h-5 w-5" />
                    <span className="font-medium">Shopping</span>
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                      activeTab === 'admin'
                        ? 'bg-red-50 text-red-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <FiShield className="h-5 w-5" />
                    <span className="font-medium">Admin Settings</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('preferences')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                    activeTab === 'preferences'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <FiSettings className="h-5 w-5" />
                  <span className="font-medium">Preferences</span>
                </button>
              </nav>

              {/* Quick Stats */}
              <div className="mt-6 pt-6 border-t">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Member Since</span>
                    <span className="font-medium text-gray-900">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {isCustomer && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Orders</span>
                        <span className="font-bold text-blue-600">{profile.order_count || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Loyalty Points</span>
                        <span className="font-bold text-purple-600">{profile.loyalty_points || 0}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Information</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={formData.full_name || ''}
                          onChange={(e) => handleInputChange('full_name', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{profile.full_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <p className="text-gray-900">{profile.email}</p>
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone
                      </label>
                      {editing ? (
                        <input
                          type="tel"
                          value={formData.phone || ''}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{profile.phone || 'Not provided'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={formData.location || ''}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                          placeholder="City, Country"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{profile.location || 'Not provided'}</p>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bio
                    </label>
                    {editing ? (
                      <textarea
                        value={formData.bio || ''}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        rows="4"
                        placeholder="Tell us about yourself..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.bio || 'No bio provided'}</p>
                    )}
                  </div>

                  {/* Avatar Selection */}
                  {editing && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Choose Avatar
                      </label>
                      <div className="grid grid-cols-8 gap-2">
                        {emojiAvatars.map((emoji, index) => (
                          <button
                            key={index}
                            onClick={() => handleInputChange('avatar', emoji)}
                            className={`p-3 text-2xl rounded-lg border-2 transition ${
                              formData.avatar === emoji
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Work Details Tab (Manager/Cashier) */}
              {activeTab === 'work' && (isManager || isCashier) && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Work Details</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Employee ID
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={formData.employee_id || ''}
                          onChange={(e) => handleInputChange('employee_id', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{profile.employee_id || 'Not assigned'}</p>
                      )}
                    </div>

                    {isManager && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Department
                          </label>
                          {editing ? (
                            <input
                              type="text"
                              value={formData.department || ''}
                              onChange={(e) => handleInputChange('department', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          ) : (
                            <p className="text-gray-900">{profile.department || 'Not specified'}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Manager Level
                          </label>
                          {editing ? (
                            <select
                              value={formData.manager_level || ''}
                              onChange={(e) => handleInputChange('manager_level', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Select Level</option>
                              <option value="Junior">Junior Manager</option>
                              <option value="Senior">Senior Manager</option>
                              <option value="Lead">Lead Manager</option>
                              <option value="Assistant">Assistant Manager</option>
                            </select>
                          ) : (
                            <p className="text-gray-900">{profile.manager_level || 'Not specified'}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Team Size
                          </label>
                          {editing ? (
                            <input
                              type="number"
                              value={formData.team_size || ''}
                              onChange={(e) => handleInputChange('team_size', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          ) : (
                            <p className="text-gray-900">{profile.team_size || 0} members</p>
                          )}
                        </div>
                      </>
                    )}

                    {isCashier && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Shift
                          </label>
                          {editing ? (
                            <select
                              value={formData.shift || ''}
                              onChange={(e) => handleInputChange('shift', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Select Shift</option>
                              <option value="Morning (6AM-2PM)">Morning (6AM-2PM)</option>
                              <option value="Afternoon (2PM-10PM)">Afternoon (2PM-10PM)</option>
                              <option value="Night (10PM-6AM)">Night (10PM-6AM)</option>
                            </select>
                          ) : (
                            <p className="text-gray-900">{profile.shift || 'Not assigned'}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Register Number
                          </label>
                          {editing ? (
                            <input
                              type="text"
                              value={formData.register_number || ''}
                              onChange={(e) => handleInputChange('register_number', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          ) : (
                            <p className="text-gray-900">{profile.register_number || 'Not assigned'}</p>
                          )}
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hire Date
                      </label>
                      {editing ? (
                        <input
                          type="date"
                          value={formData.hire_date ? new Date(formData.hire_date).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleInputChange('hire_date', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">
                          {profile.hire_date ? new Date(profile.hire_date).toLocaleDateString() : 'Not specified'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Shopping Tab */}
              {activeTab === 'shopping' && isCustomer && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Shopping Profile</h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <FiShoppingCart className="h-6 w-6 text-blue-600" />
                        <span className="text-2xl font-bold text-blue-600">{profile.order_count || 0}</span>
                      </div>
                      <p className="text-sm text-gray-700">Total Orders</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <FiStar className="h-6 w-6 text-purple-600" />
                        <span className="text-2xl font-bold text-purple-600">{profile.loyalty_points || 0}</span>
                      </div>
                      <p className="text-sm text-gray-700">Loyalty Points</p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <FiAward className="h-6 w-6 text-amber-600" />
                        <span className="text-xs font-bold text-amber-600 uppercase">{profile.membership_tier || 'Standard'}</span>
                      </div>
                      <p className="text-sm text-gray-700">Membership Tier</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Delivery Addresses</h3>
                    <div className="space-y-2">
                      {profile.delivery_addresses && Array.isArray(profile.delivery_addresses) && profile.delivery_addresses.length > 0 ? (
                        profile.delivery_addresses.map((address, index) => (
                          <div key={index} className="p-4 border border-gray-200 rounded-lg">
                            <p className="text-gray-900">{address}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm">No delivery addresses added yet</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Settings Tab */}
              {activeTab === 'admin' && isAdmin && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Settings</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Name
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={formData.business_name || ''}
                          onChange={(e) => handleInputChange('business_name', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{profile.business_name || 'Not provided'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business License
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={formData.business_license || ''}
                          onChange={(e) => handleInputChange('business_license', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{profile.business_license || 'Not provided'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tax Number
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={formData.tax_number || ''}
                          onChange={(e) => handleInputChange('tax_number', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{profile.tax_number || 'Not provided'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Admin Level
                      </label>
                      <p className="text-gray-900">{profile.admin_level || 'Admin'}</p>
                    </div>
                  </div>

                  {supermarket && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-blue-900">Your Supermarket</h4>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${supermarket.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                          {supermarket.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Name</p>
                          <p className="text-gray-900 font-medium">{supermarket.name}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Phone</p>
                          <p className="text-gray-900 font-medium">{supermarket.phone || 'Not provided'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Location</p>
                          <p className="text-gray-900 font-medium">{supermarket.location || 'Not provided'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Address</p>
                          <p className="text-gray-900 font-medium">{supermarket.address || 'Not provided'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-700 mt-3">
                        Auto-attached from the supermarket created for your account — Business Name above is filled in from this automatically.
                      </p>

                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <p className="text-sm font-medium text-blue-900 mb-2">Portal Background Image</p>
                        <div className="flex items-center gap-4">
                          <div className="w-24 h-16 rounded-lg border border-blue-200 bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                            {supermarket.background_image_url ? (
                              <img src={supermarket.background_image_url} alt="Portal background" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs text-gray-400">None set</span>
                            )}
                          </div>
                          <div>
                            <input
                              ref={backgroundInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleBackgroundUpload}
                            />
                            <button
                              type="button"
                              onClick={() => backgroundInputRef.current?.click()}
                              disabled={uploadingBackground}
                              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                            >
                              {uploadingBackground ? 'Uploading...' : supermarket.background_image_url ? 'Change image' : 'Upload image'}
                            </button>
                            <p className="text-xs text-blue-700 mt-1">Shown across every portal for your supermarket — admin, manager, cashier and customer.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <FiShield className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-900 mb-1">Admin Privileges</h4>
                        <p className="text-sm text-red-700">
                          You have authority over every role in your supermarket, from customer up through cashier and manager.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Role Access Management */}
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Team &amp; Role Access</h3>
                      <span className="text-xs text-gray-500">{teamMembers.length} people in your supermarket</span>
                    </div>

                    {loadingTeam ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <p className="text-sm text-gray-500">No managers, cashiers, or customers found yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-9 h-9 flex-shrink-0 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                                {member.avatar || '👤'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{member.full_name || 'Unnamed'}</p>
                                <p className="text-xs text-gray-500 truncate">{member.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 flex-shrink-0">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${ROLE_BADGE_STYLES[member.role] || 'bg-gray-100 text-gray-700'}`}>
                                {member.role}
                              </span>
                              <select
                                value={member.role}
                                disabled={savingRoleId === member.id}
                                onChange={(e) => handleRoleChange(member, e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                              >
                                {ASSIGNABLE_ROLES.map((r) => (
                                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Preferences</h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">Email Notifications</h4>
                        <p className="text-sm text-gray-500">Receive updates via email</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">SMS Notifications</h4>
                        <p className="text-sm text-gray-500">Receive updates via SMS</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">Marketing Communications</h4>
                        <p className="text-sm text-gray-500">Receive promotional offers</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedProfilePage;
