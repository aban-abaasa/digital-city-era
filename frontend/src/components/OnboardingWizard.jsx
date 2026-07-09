import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiCheck, FiArrowRight, FiArrowLeft, FiX, FiStar,
  FiUser, FiBriefcase, FiShoppingCart, FiShield, FiCreditCard,
  FiPackage, FiTruck, FiUsers, FiSettings, FiZap
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

const OnboardingWizard = ({ onComplete, onSkip }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || user?.name || '',
    phone: user?.phone || '',
    location: '',
    bio: '',
    avatar: '👤',
    // admin
    business_name: '',
    business_license: '',
    // manager
    department: '',
    team_goals: '',
    // cashier
    preferred_shift: '',
    // customer
    delivery_address: '',
    shopping_preferences: '',
  });

  const avatarOptions = ['👤', '👨', '👩', '🧑', '👨‍💼', '👩‍💼', '👨‍🔧', '👩‍🔧', '👨‍🍳', '👩‍🍳', '🤵', '🎓'];

  const getRoleSteps = (role) => {
    const base = [
      { id: 'welcome',  title: 'Welcome!',              icon: FiZap,      description: "Let's get you set up in just a few steps." },
      { id: 'profile',  title: 'Your Profile',           icon: FiUser,     description: 'Tell us a bit about yourself.' },
    ];
    const roleMap = {
      admin: [
        { id: 'business', title: 'Business Setup',  icon: FiShield,       description: 'Configure your supermarket details.' },
        { id: 'team',     title: 'Invite Your Team', icon: FiUsers,       description: 'Add managers and cashiers to get started.' },
      ],
      manager: [
        { id: 'team',  title: 'Your Team',     icon: FiUsers,    description: 'Meet the people you will be working with.' },
        { id: 'goals', title: 'Set Your Goals', icon: FiBriefcase,description: 'Define what success looks like this quarter.' },
      ],
      cashier: [
        { id: 'pos',   title: 'POS Training',   icon: FiCreditCard, description: 'A quick tour of the point-of-sale system.' },
        { id: 'shift', title: 'Your Schedule',  icon: FiSettings,   description: 'Let us know your preferred shift.' },
      ],
      customer: [
        { id: 'shopping', title: 'Start Shopping',   icon: FiShoppingCart, description: 'Browse and order products for delivery.' },
        { id: 'loyalty',  title: 'Loyalty Rewards',  icon: FiStar,         description: 'Earn ICAN points on every purchase.' },
      ],
      supplier: [
        { id: 'inventory', title: 'Your Inventory', icon: FiPackage, description: 'List the products you supply.' },
        { id: 'delivery',  title: 'Delivery Setup',  icon: FiTruck,   description: 'Configure your delivery zone and schedule.' },
      ],
    };
    return [
      ...base,
      ...(roleMap[role] || []),
      { id: 'complete', title: 'All Set!', icon: FiCheck, description: "You are ready to get started." },
    ];
  };

  const role = user?.role?.toLowerCase() || 'customer';
  const steps = getRoleSteps(role);
  const totalSteps = steps.length;
  const step = steps[currentStep];

  useEffect(() => {
    if (user) loadOnboardingProgress();
  }, [user]);

  const loadOnboardingProgress = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();
      if (!userRecord) return;

      const { data } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', userRecord.id)
        .single();

      if (data) {
        setOnboardingData(data);
        setCurrentStep(data.current_step || 0);
      }
    } catch {
      // onboarding row may not exist yet — that is fine
    }
  };

  const saveProgress = async (stepIndex) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();
      if (!userRecord) return;

      await supabase
        .from('onboarding_progress')
        .upsert({
          user_id: userRecord.id,
          current_step: stepIndex,
          completed: stepIndex >= totalSteps - 1,
          updated_at: new Date().toISOString(),
        });
    } catch {
      // silent — progress saving is best-effort
    }
  };

  const handleNext = async () => {
    setLoading(true);
    await saveProgress(currentStep + 1);
    setLoading(false);
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();

      if (userRecord) {
        // Save profile data
        await supabase
          .from('unified_profiles')
          .upsert({
            user_id: userRecord.id,
            full_name: formData.full_name,
            phone: formData.phone,
            location: formData.location,
            bio: formData.bio,
            avatar: formData.avatar,
            ...(role === 'admin' && { business_name: formData.business_name, business_license: formData.business_license }),
            ...(role === 'manager' && { department: formData.department }),
            ...(role === 'cashier' && { shift: formData.preferred_shift }),
            ...(role === 'customer' && { delivery_addresses: formData.delivery_address ? [formData.delivery_address] : [] }),
            updated_at: new Date().toISOString(),
          });

        // Mark onboarding complete
        await supabase
          .from('onboarding_progress')
          .upsert({
            user_id: userRecord.id,
            current_step: totalSteps - 1,
            completed: true,
            updated_at: new Date().toISOString(),
          });
      }

      toast.success('Welcome aboard! Your profile is ready.');
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Onboarding complete error:', error);
      toast.error('Could not save your details — you can update them in your profile later.');
      if (onComplete) onComplete();
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const progressPct = ((currentStep) / (totalSteps - 1)) * 100;

  // ─── Step Content Renderers ──────────────────────────────────────

  const renderWelcome = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 text-4xl shadow-xl">
        {role === 'admin'    && '🛡️'}
        {role === 'manager'  && '💼'}
        {role === 'cashier'  && '🧾'}
        {role === 'customer' && '🛍️'}
        {role === 'supplier' && '🚚'}
        {!['admin','manager','cashier','customer','supplier'].includes(role) && '✨'}
      </div>
      <div>
        <h2 className="text-3xl font-bold text-gray-900">
          Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!
        </h2>
        <p className="mt-3 text-gray-500 leading-7">
          You have been added as <span className="font-semibold capitalize text-blue-600">{role}</span> on Supermartkera.
          This quick setup takes less than a minute.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
        {[
          { icon: '⚡', text: 'Quick setup — under 2 minutes' },
          { icon: '🔒', text: 'Your data is private and secure' },
          { icon: '✏️', text: 'Edit everything later in your profile' },
        ].map((item) => (
          <div key={item.text} className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
            <span className="text-xl">{item.icon}</span>
            <p className="text-sm text-gray-700 leading-5">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Your Profile</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Choose an avatar</label>
        <div className="flex flex-wrap gap-2">
          {avatarOptions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleFieldChange('avatar', emoji)}
              className={`p-3 text-2xl rounded-xl border-2 transition ${
                formData.avatar === emoji
                  ? 'border-blue-500 bg-blue-50 scale-110'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={formData.full_name}
            onChange={(e) => handleFieldChange('full_name', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="+256 700 000 000"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <input
          type="text"
          value={formData.location}
          onChange={(e) => handleFieldChange('location', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          placeholder="Kampala, Uganda"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Short Bio <span className="text-gray-400">(optional)</span></label>
        <textarea
          value={formData.bio}
          onChange={(e) => handleFieldChange('bio', e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          placeholder="Tell the team a little about yourself…"
        />
      </div>
    </div>
  );

  const renderAdminBusiness = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Business Setup</h2>
      <p className="text-gray-500">This information appears on your admin dashboard and receipts.</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Supermarket / Business Name</label>
        <input
          type="text"
          value={formData.business_name}
          onChange={(e) => handleFieldChange('business_name', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          placeholder="Kera Supermarket"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business License Number <span className="text-gray-400">(optional)</span></label>
        <input
          type="text"
          value={formData.business_license}
          onChange={(e) => handleFieldChange('business_license', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          placeholder="UG-BUS-2024-XXXXX"
        />
      </div>
    </div>
  );

  const renderAdminTeam = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Invite Your Team</h2>
      <p className="text-gray-500">
        Share the invitation link below with your managers and cashiers to let them register.
      </p>
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">
        <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-2">Invitation Link</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-sm text-blue-900 bg-white rounded-lg px-3 py-2 border border-blue-200 break-all">
            {window.location.origin}/apply
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/apply`);
              toast.success('Link copied!');
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
          >
            Copy link
          </button>
        </div>
      </div>
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        💡 You can also manage team members and roles directly from the Admin Portal after setup.
      </div>
    </div>
  );

  const renderManagerTeam = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Your Team</h2>
      <p className="text-gray-500">Your admin will introduce you to your team. For now, tell us your department.</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
        <input
          type="text"
          value={formData.department}
          onChange={(e) => handleFieldChange('department', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          placeholder="e.g. Operations, Finance, Sales…"
        />
      </div>
    </div>
  );

  const renderManagerGoals = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Set Your Goals</h2>
      <p className="text-gray-500">What are you hoping to achieve in your first 30 days as manager?</p>
      <textarea
        value={formData.team_goals}
        onChange={(e) => handleFieldChange('team_goals', e.target.value)}
        rows={5}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
        placeholder="e.g. Reduce stock shortages, train two new cashiers, improve daily sales reports…"
      />
    </div>
  );

  const renderCashierPOS = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">POS Training</h2>
      <p className="text-gray-500">Here is a quick overview of how the point-of-sale system works.</p>
      {[
        { icon: '🔍', title: 'Scan products', desc: 'Use the scanner or search by product name to add items to the cart.' },
        { icon: '💳', title: 'Process payment', desc: 'Accept cash, mobile money, or card — then print or email the receipt.' },
        { icon: '📋', title: 'Manage your till', desc: 'Open and close your till at the start and end of every shift.' },
      ].map((item) => (
        <div key={item.title} className="flex gap-4 rounded-xl border border-gray-200 p-4">
          <span className="text-3xl flex-shrink-0">{item.icon}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{item.title}</h4>
            <p className="text-sm text-gray-500 mt-1 leading-5">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCashierShift = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Your Preferred Shift</h2>
      <p className="text-gray-500">Your admin can adjust this later. This is just your preference.</p>
      <div className="grid gap-3">
        {[
          { value: 'Morning (6AM–2PM)',   icon: '🌅' },
          { value: 'Afternoon (2PM–10PM)', icon: '☀️' },
          { value: 'Night (10PM–6AM)',     icon: '🌙' },
        ].map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => handleFieldChange('preferred_shift', s.value)}
            className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition ${
              formData.preferred_shift === s.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <span className="text-3xl">{s.icon}</span>
            <span className="font-medium text-gray-900">{s.value}</span>
            {formData.preferred_shift === s.value && (
              <FiCheck className="ml-auto h-5 w-5 text-blue-600" />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const renderCustomerShopping = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Start Shopping</h2>
      <p className="text-gray-500">Add a delivery address so we can get your orders to you quickly.</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
        <textarea
          value={formData.delivery_address}
          onChange={(e) => handleFieldChange('delivery_address', e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          placeholder="e.g. Plot 12, Kampala Road, Nakasero, Kampala"
        />
      </div>
    </div>
  );

  const renderCustomerLoyalty = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">ICAN Loyalty Rewards</h2>
      <p className="text-gray-500">Every purchase earns you ICAN coins — redeemable across the entire ecosystem.</p>
      {[
        { icon: '🛒', title: '1% cashback on every purchase', desc: 'Automatically added to your ICAN wallet after checkout.' },
        { icon: '💰', title: '1 ICAN = 5,000 UGX', desc: 'Redeem your coins for discounts or transfers.' },
        { icon: '🌍', title: 'Works across all apps', desc: 'Use your ICAN balance in Supermartkera, MybodaGuy, and AgriBone.' },
      ].map((item) => (
        <div key={item.title} className="flex gap-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 p-4">
          <span className="text-3xl flex-shrink-0">{item.icon}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{item.title}</h4>
            <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSupplierInventory = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Your Inventory</h2>
      <p className="text-gray-500">You can list your full product catalogue from the Supplier Portal after setup.</p>
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-sm text-emerald-800">
        📦 Once approved, your products will be visible to the supermarket for ordering.
        Head to the Supplier Portal → Products to add your catalogue.
      </div>
    </div>
  );

  const renderSupplierDelivery = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Delivery Setup</h2>
      <p className="text-gray-500">Your delivery zone and schedule can be configured from the Supplier Portal later.</p>
      <div className="space-y-3">
        {[
          { icon: '📍', text: 'Set your delivery radius from the portal.' },
          { icon: '🗓️', text: 'Define available delivery days and time windows.' },
          { icon: '📞', text: 'Receive delivery requests directly from supermarket managers.' },
        ].map((item) => (
          <div key={item.text} className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
            <span className="text-2xl">{item.icon}</span>
            <p className="text-sm text-gray-700 leading-5">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-green-600 text-5xl shadow-xl">
        🎉
      </div>
      <div>
        <h2 className="text-3xl font-bold text-gray-900">You are all set!</h2>
        <p className="mt-3 text-gray-500 leading-7">
          Your profile has been created. You can update any details anytime from your profile page.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={handleComplete}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:scale-[1.02] transition disabled:opacity-60"
        >
          {loading ? (
            <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <>
              <FiCheck className="h-5 w-5" />
              Go to my portal
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStepContent = () => {
    const id = step.id;
    if (id === 'welcome')   return renderWelcome();
    if (id === 'profile')   return renderProfile();
    if (id === 'business')  return renderAdminBusiness();
    if (id === 'team' && role === 'admin')    return renderAdminTeam();
    if (id === 'team' && role === 'manager')  return renderManagerTeam();
    if (id === 'goals')     return renderManagerGoals();
    if (id === 'pos')       return renderCashierPOS();
    if (id === 'shift')     return renderCashierShift();
    if (id === 'shopping')  return renderCustomerShopping();
    if (id === 'loyalty')   return renderCustomerLoyalty();
    if (id === 'inventory') return renderSupplierInventory();
    if (id === 'delivery')  return renderSupplierDelivery();
    if (id === 'complete')  return renderComplete();
    return null;
  };

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <step.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                Step {currentStep + 1} of {totalSteps}
              </p>
              <h3 className="text-base font-bold text-gray-900 leading-none mt-0.5">{step.title}</h3>
            </div>
          </div>
          {onSkip && (
            <button
              onClick={onSkip}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition"
              title="Skip setup"
            >
              <FiX className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-8 flex-shrink-0">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={`flex h-2 w-2 rounded-full transition-all ${
                  i < currentStep ? 'bg-blue-500' :
                  i === currentStep ? 'bg-purple-600 scale-150' :
                  'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {renderStepContent()}
        </div>

        {/* Footer navigation */}
        {!isLastStep && (
          <div className="flex items-center justify-between px-8 py-5 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              <FiArrowLeft className="h-4 w-4" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:scale-[1.02] disabled:opacity-60 transition text-sm"
            >
              {loading ? (
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  Continue
                  <FiArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
