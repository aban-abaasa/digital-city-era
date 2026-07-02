# Unified Profile System - Design Document

## 🎯 Overview
A smart, unified profile system where:
- **One profile page** adapts to all roles (manager, cashier, customer)
- **Admin has full access** to all portals with role-switching
- **Clear onboarding** explains how to create supermarket profiles
- **Seamless experience** across the entire platform

## 📋 Requirements

### 1. Unified Profile Page
- Single `/profile` route for all authenticated users
- Dynamically renders based on user role
- Consistent UI/UX across all roles
- Role-specific sections that appear/hide based on user

### 2. Admin Super Access
- Admins can view any portal (manager, cashier, customer)
- Portal switcher in admin navigation
- Maintains admin identity while viewing other portals
- "Return to Admin Portal" quick action

### 3. Smart Onboarding
- First-time user welcome flow
- Role-specific tutorials
- Interactive guided tours
- Progress indicators

## 🗂️ Database Schema

### unified_profiles table
```sql
CREATE TABLE IF NOT EXISTS public.unified_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Basic Info (All Roles)
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  avatar VARCHAR(10), -- Emoji
  avatar_url TEXT,
  bio TEXT,
  location VARCHAR(255),
  languages TEXT[], -- Array: ['English', 'Luganda']
  
  -- Role-Specific Fields
  role VARCHAR(50) NOT NULL,
  supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  
  -- Manager-specific
  department VARCHAR(100),
  team_size INTEGER,
  manager_level VARCHAR(50), -- 'Senior', 'Junior', 'Lead'
  
  -- Cashier-specific
  shift VARCHAR(100), -- 'Morning', 'Afternoon', 'Night'
  register_number VARCHAR(50),
  pos_access BOOLEAN DEFAULT true,
  
  -- Customer-specific
  loyalty_points INTEGER DEFAULT 0,
  membership_tier VARCHAR(50) DEFAULT 'standard', -- 'standard', 'premium', 'vip'
  delivery_addresses JSONB DEFAULT '[]',
  
  -- Admin-specific
  admin_level VARCHAR(50), -- 'Super Admin', 'Admin', 'System Admin'
  permissions JSONB DEFAULT '[]',
  can_access_all_portals BOOLEAN DEFAULT false,
  
  -- Common Fields
  employee_id VARCHAR(50),
  hire_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'active',
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  preferences JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_profile_update TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unified_profiles_user_id ON public.unified_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_profiles_role ON public.unified_profiles(role);
CREATE INDEX IF NOT EXISTS idx_unified_profiles_supermarket_id ON public.unified_profiles(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_unified_profiles_status ON public.unified_profiles(status);

-- RLS Policies
ALTER TABLE public.unified_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own unified profile" ON public.unified_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own unified profile" ON public.unified_profiles
  FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can read all profiles in their supermarket
CREATE POLICY "Admins can read all supermarket profiles" ON public.unified_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'admin'
      AND users.supermarket_id = unified_profiles.supermarket_id
    )
  );
```

### admin_portal_access table
```sql
CREATE TABLE IF NOT EXISTS public.admin_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  accessed_portal VARCHAR(50) NOT NULL, -- 'manager', 'cashier', 'customer', 'supplier'
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_duration INTEGER, -- in seconds
  actions_performed JSONB DEFAULT '[]',
  
  CONSTRAINT unique_admin_portal_access UNIQUE(admin_id, accessed_portal, accessed_at)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_admin_portal_access_admin_id ON public.admin_portal_access(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_portal_access_portal ON public.admin_portal_access(accessed_portal);
```

## 🎨 UI Components

### 1. UnifiedProfilePage.jsx
```
/profile
├── ProfileHeader (role-aware)
├── ProfileNavigation (tabs based on role)
├── BasicInfoSection (all roles)
├── RoleSpecificSection (conditional)
│   ├── ManagerSection (department, team)
│   ├── CashierSection (shift, register)
│   ├── CustomerSection (loyalty, orders)
│   └── AdminSection (permissions, access)
├── PreferencesSection (all roles)
└── SecuritySection (all roles)
```

### 2. AdminPortalSwitcher.jsx
```
Admin Navigation Bar
├── Current Portal Badge
├── Portal Dropdown
│   ├── Admin Portal (default)
│   ├── → Manager View
│   ├── → Cashier View
│   ├── → Customer View
│   └── → Supplier View
└── Return to Admin (when in other portal)
```

### 3. OnboardingWizard.jsx
```
Onboarding Flow
├── Welcome Screen
├── Role Introduction
├── Profile Setup (step-by-step)
├── Feature Tour
└── Completion & Rewards
```

## 🔄 User Flows

### New User Sign Up
```
1. User signs up → Role selection
2. System checks role:
   - If 'admin' → Create supermarket → Admin onboarding
   - If 'manager/cashier' → Join supermarket → Team onboarding
   - If 'customer' → Customer onboarding
3. Create unified_profile record
4. Start onboarding wizard
5. Complete profile setup
6. Redirect to appropriate portal
```

### Admin Switching Portals
```
1. Admin clicks Portal Switcher
2. Select target portal (e.g., Manager)
3. System loads manager UI with admin permissions
4. Admin can view/test manager features
5. "Return to Admin Portal" always visible
6. Log portal access in admin_portal_access
```

### User Updating Profile
```
1. Navigate to /profile
2. Profile page loads with role-specific sections
3. User edits relevant fields
4. Save triggers unified_profiles update
5. Update timestamp and trigger notifications
```

## 📱 Responsive Design

### Mobile-First Profile
- Collapsible sections
- Touch-friendly controls
- Swipeable tabs
- Bottom navigation for quick actions

### Desktop Profile
- Sidebar navigation
- Multi-column layout
- Inline editing
- Real-time preview

## 🎁 Smart Features

### 1. Profile Completeness
- Progress bar (0-100%)
- Missing field suggestions
- Completion rewards (ICAN coins)
- Profile strength indicator

### 2. Quick Actions
- Update avatar (emoji picker)
- Change password
- Notification preferences
- Download profile data (GDPR)

### 3. Activity Timeline
- Recent profile changes
- Portal access history (admin)
- Role changes
- Important milestones

### 4. Integration Points
- ICAN Wallet balance
- Performance metrics
- Achievements/badges
- Social connections

## 🔐 Security Considerations

### Role Validation
- Server-side role checks
- Token-based authentication
- RLS policies enforced
- Audit logging for admin actions

### Data Privacy
- Users only see their own data
- Admins see supermarket-scoped data
- Sensitive fields encrypted
- GDPR-compliant data export

## 🚀 Implementation Priority

### Phase 1: Foundation
1. Create unified_profiles table
2. Create migration from existing profile tables
3. Build UnifiedProfilePage component
4. Implement role-based rendering

### Phase 2: Admin Features
1. Build AdminPortalSwitcher
2. Create admin_portal_access logging
3. Implement portal access controls
4. Add "Return to Admin" functionality

### Phase 3: Onboarding
1. Build OnboardingWizard component
2. Create role-specific onboarding flows
3. Add interactive tutorials
4. Implement progress tracking

### Phase 4: Polish
1. Add profile completeness
2. Implement quick actions
3. Build activity timeline
4. Add ICAN wallet integration

## 📊 Success Metrics

- Profile completion rate > 80%
- Onboarding completion < 5 minutes
- Admin portal switching < 3 seconds
- User satisfaction score > 4.5/5
- Profile update frequency: weekly

## 🎯 Next Steps

1. **Review and approve** this design
2. **Run database migration** (create unified_profiles)
3. **Build components** in order of priority
4. **Test with real users** for each role
5. **Deploy gradually** with feature flags
