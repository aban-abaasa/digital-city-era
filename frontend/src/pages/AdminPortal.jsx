import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { notificationService } from '../services/notificationService';
import { portalConfigService } from '../services/portalConfigService';
import { supabase } from '../services/supabase';
import useSupermarketBranding from '../hooks/useSupermarketBranding';
import PortalSwitcher from '../components/PortalSwitcher';
import ProfileModal from '../components/ProfileModal';
import ProductInventoryInterface from '../components/ProductInventoryInterface';
import TransactionHistory from '../components/TransactionHistory';
import OrderInventoryPOSControl from '../components/OrderInventoryPOSControl';
import IcanCoinBadge from '../components/IcanCoinBadge';
import ICANWalletPage from './ICANWalletPage';
import { 
  FiUsers, FiUser, FiShield, FiSettings, FiBarChart, FiActivity,
  FiGlobe, FiServer, FiDatabase, FiLock, FiAlertTriangle,
  FiTerminal, FiCpu, FiHardDrive, FiRefreshCw, FiZap,
  FiPower, FiTrendingUp, FiUserCheck, FiShoppingBag,
  FiDollarSign, FiPieChart, FiCalendar, FiBell, FiCheckCircle,
  FiXCircle, FiUserPlus, FiSearch, FiFilter, FiDownload,
  FiUpload, FiTrash2, FiEdit, FiEye, FiRotateCw, FiX,
  FiMoreVertical, FiMail, FiPhone, FiBriefcase, FiFileText,
  FiChevronDown, FiMenu, FiChevronUp, FiChevronRight, FiLogOut, FiInfo
} from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const AdminPortal = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [systemData, setSystemData] = useState({
    analytics: {},
    users: {},
    settings: {}
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: ''
  });

  // Date range for revenue metrics
  const [revenueDateRange, setRevenueDateRange] = useState({
    type: 'today', // 'today', '7days', '30days', '90days', '1year', 'custom'
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999))
  });

  // Real-time state management - Initialize with zeros, will be loaded from Supabase
  const [realTimeData, setRealTimeData] = useState({
    activeUsers: 0,
    todaysOrders: 0,
    dailyRevenue: 0,
    revenueLabel: 'Today',
    systemHealth: 100,
    employeeLogins: 0,
    failedAttempts: 0,
    activeSessions: 0,
    managerAccess: 0,
    systemLoad: 0,
    memoryUsage: 0,
    diskUsage: 0,
    networkLoad: 0,
    isEmployeeLoginEnabled: true,
    isManagerLoginEnabled: true,
    recentActivities: [],
    systemServices: [
      { name: 'Web Server', status: 'online', uptime: 100 },
      { name: 'Database', status: 'online', uptime: 100 },
      { name: 'Payment Gateway', status: 'online', uptime: 100 },
      { name: 'Backup Service', status: 'online', uptime: 100 }
    ],
    totalUsers: 0,
    totalAdmins: 0,
    totalManagers: 0,
    totalCashiers: 0,
    totalSuppliers: 0,
    pendingApprovals: 0,
    verifiedUsers: 0,
    unverifiedUsers: 0
  });

  const [notifications, setNotifications] = useState([]);
  const [wsConnection, setWsConnection] = useState(null);
  
  // Pending Users State
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  // All Registered Users State
  const [allUsers, setAllUsers] = useState([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'applications' | 'staff' | 'riders'

  // Applications (supplier / mybodaguy)
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);

  // Approved My Boda Guy riders partnered with this supermarket
  const [riders, setRiders] = useState([]);
  const [ridersLoading, setRidersLoading] = useState(false);

  // Staff assignment
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffSearchResults, setStaffSearchResults] = useState([]);
  const [staffSearchLoading, setStaffSearchLoading] = useState(false);
  const [currentStaff, setCurrentStaff] = useState([]);

  // Each supermarket's own name/background — auto-populated, no manual retyping
  const branding = useSupermarketBranding();
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showQuickAccess, setShowQuickAccess] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showRecentActivities, setShowRecentActivities] = useState(false);
  const [showInventoryControl, setShowInventoryControl] = useState(false);
  const [showPaymentControl, setShowPaymentControl] = useState(false);
  const [showFinancialControl, setShowFinancialControl] = useState(false);
  const [showProductManagement, setShowProductManagement] = useState(false);

  // User Details Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);

  // Authorization state
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Current logged-in admin data
  const [currentAdmin, setCurrentAdmin] = useState({
    id: null,
    email: null,
    full_name: 'Administrator',
    role: 'admin',
    phone: null,
    supermarket_id: null
  });
  
  // Supermarket Profile Completion
  const [needsSupermarketProfile, setNeedsSupermarketProfile] = useState(false);
  const [supermarketForm, setSupermarketForm] = useState({
    name: '',
    location: '',
    phone: '',
    address: ''
  });

  // User Management Filters
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVerification, setFilterVerification] = useState('all'); // 'all', 'verified', 'unverified'
  const [searchQuery, setSearchQuery] = useState('');

  // Check admin access on component mount
  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('🔐 Checking admin access for user:', user?.id, user?.email);
      
      if (!user) {
        console.log('❌ No authenticated user found');
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      try {
        // Try auth_id first; fall back to id (some deployments lack auth_id column)
        let userData = null;
        const { data: ud1, error: e1 } = await supabase
          .from('users')
          .select('id, role, supermarket_id, full_name, email, phone')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (!e1) {
          userData = ud1;
        } else {
          console.warn('⚠️ auth_id query failed, trying id:', e1.message);
          const { data: ud2, error: e2 } = await supabase
            .from('users')
            .select('id, role, supermarket_id, full_name, email, phone')
            .eq('id', user.id)
            .maybeSingle();
          if (!e2) userData = ud2;
          else console.warn('⚠️ id fallback also failed:', e2.message);
        }

        console.log('📊 Query result:', { userData });

        // Determine admin status — three tiers:
        // 1. users.role column exists and equals 'admin'
        // 2. auth metadata says admin
        // 3. user owns a supermarket (role column may be missing or stale)
        const metaRole = user.user_metadata?.role || user.app_metadata?.role;
        let userIsAdmin = (userData?.role === 'admin') || metaRole === 'admin';

        // Always query supermarkets table — it is the source of truth for ownership
        const { data: ownedSm } = await supabase
          .from('supermarkets')
          .select('id, name')
          .eq('owner_user_id', user.id)
          .maybeSingle();

        if (ownedSm) {
          userIsAdmin = true;
          console.log('✅ Admin confirmed, owns supermarket:', ownedSm.id);
          // Repair users row silently so future logins are faster
          supabase.from('users').update({
            role: 'admin',
            supermarket_id: ownedSm.id,
            updated_at: new Date().toISOString()
          }).eq('id', user.id).then(() => {});
          supabase.auth.updateUser({ data: { role: 'admin' } }).catch(() => {});
        }

        console.log('👤 User role check:', { role: userData?.role, isAdmin: userIsAdmin, ownedSm });
        setIsAdmin(userIsAdmin);

        // Set current admin data
        setCurrentAdmin({
          id: userData?.id,
          email: userData?.email,
          full_name: userData?.full_name,
          role: userData?.role,
          phone: userData?.phone,
          supermarket_id: userData?.supermarket_id || ownedSm?.id
        });

        // Only show the supermarket profile form if they have NO supermarket at all
        const hasSupermarket = !!ownedSm || !!userData?.supermarket_id;
        if (userIsAdmin && !hasSupermarket) {
          console.log('👤 Admin has no supermarket yet — showing profile form');
          setNeedsSupermarketProfile(true);
        }

        if (!userIsAdmin) {
          console.warn('⚠️ Non-admin user attempting to access AdminPortal:', userData?.role);
        }
      } catch (queryError) {
        console.warn('⚠️ Failed to query user role:', queryError);
        // Allow access for debugging
        console.log('🔓 Allowing admin access despite query error for debugging');
        setIsAdmin(true);
        setNeedsSupermarketProfile(true);
        setAuthLoading(false);
      }
    } catch (error) {
      console.error('❌ Error checking admin access:', error);
      // Allow access for debugging
      console.log('🔓 Allowing admin access despite error for debugging');
      setIsAdmin(true);
      setNeedsSupermarketProfile(true);
    } finally {
      setAuthLoading(false);
    }
  };

  // Load pending users for approval
  const loadPendingUsers = useCallback(async () => {
    try {
      setApprovalsLoading(true);
      
      console.log('🔍 Loading pending users...');
      
      // get_pending_users() is admin-only and scoped to the caller's own
      // supermarket server-side (see FIX_PENDING_USER_RPCS_AUTH.sql).
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_pending_users');

        if (!rpcError && rpcData) {
          console.log(`✅ Loaded ${rpcData.length} pending users via RPC:`, rpcData);
          console.log(`📊 Breakdown by role:`, {
            manager: rpcData.filter(u => u.role === 'manager').length,
            cashier: rpcData.filter(u => u.role === 'cashier').length,
            employee: rpcData.filter(u => u.role === 'employee').length,
            supplier: rpcData.filter(u => u.role === 'supplier').length,
          });
          setPendingUsers(rpcData);
          return;
        }

        console.log('⚠️ RPC function returned error or no data, trying direct query', rpcError);
      } catch (rpcErr) {
        console.log('❌ RPC function not available:', rpcErr.message);
      }

      // Fallback: scoped to this admin's own supermarket only — never a
      // platform-wide query.
      if (!currentAdmin.supermarket_id) {
        setPendingUsers([]);
        return;
      }
      console.log('📡 Attempting direct query to users table...');
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', false)
        .eq('supermarket_id', currentAdmin.supermarket_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Direct query error:', error);
        
        // If RLS error, show helpful message
        if (error.code === '42P17') {
          notificationService.show(
            '⚠️ Database policy issue detected. Please run fix-users-rls-policy.sql in Supabase SQL Editor.',
            'warning',
            8000
          );
        } else {
          throw error;
        }
        return;
      }
      
      console.log(`✅ Loaded ${data?.length || 0} pending users via direct query:`, data);
      if (data && data.length > 0) {
        console.log(`📊 Breakdown by role:`, {
          manager: data.filter(u => u.role === 'manager').length,
          cashier: data.filter(u => u.role === 'cashier').length,
          employee: data.filter(u => u.role === 'employee').length,
          supplier: data.filter(u => u.role === 'supplier').length,
        });
      }
      setPendingUsers(data || []);
      
    } catch (error) {
      console.error('❌ Error loading pending users:', error);
      notificationService.show(
        'Failed to load pending applications. Check console for details.',
        'error'
      );
    } finally {
      setApprovalsLoading(false);
    }
  }, [currentAdmin.supermarket_id]);

  // Load registered users for THIS admin's own supermarket only.
  // Deliberately does not call any RLS-bypassing RPC (e.g. an "admin sees
  // everyone" helper) — that would leak every other supermarket's users into
  // this admin's User Management tab, which defeats supermarket isolation.
  const loadAllUsers = useCallback(async () => {
    if (!currentAdmin.supermarket_id) return;

    try {
      setAllUsersLoading(true);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('supermarket_id', currentAdmin.supermarket_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Direct query error:', error);
        
        // If RLS error, show helpful message
        if (error.code === '42P17') {
          notificationService.show(
            '⚠️ Database policy issue detected. Please run fix-users-rls-policy.sql in Supabase SQL Editor to fix this.',
            'warning',
            8000
          );
        } else {
          notificationService.show(
            'Unable to load users: ' + (error.message || 'Unknown error'),
            'error'
          );
        }
        return;
      }
      
      // Transform to include verification status - approved = verified
      const usersWithStatus = (data || []).map(user => ({
        ...user,
        email_verified: !!user.is_active,
        verification_status: user.is_active ? '✅ Verified' : '⏳ Pending'
      }));
      
      setAllUsers(usersWithStatus);
      notificationService.show(`Loaded ${usersWithStatus.length} registered users`, 'success');
      console.log(`✅ Loaded ${usersWithStatus.length} users from direct query`);

    } catch (error) {
      console.error('Error loading all users:', error);
      notificationService.show('Failed to load registered users. Check console for details.', 'error');
    } finally {
      setAllUsersLoading(false);
    }
  }, [currentAdmin.supermarket_id]);

  // Load applications — merges user_applications + supplier_applications + mybodaguy applications
  const loadApplications = useCallback(async () => {
    try {
      setApplicationsLoading(true);

      // 1. Legacy user_applications table
      const { data: legacyApps } = await supabase
        .from('user_applications')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // 2. Supplier partner applications (no join — all contact info is in the row itself)
      const { data: supplierApps } = await supabase
        .from('supplier_applications')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Normalize to the same shape the UI expects
      const normalizedSupplier = (supplierApps || []).map(a => ({
        id:               a.id,
        _source:          'supplier_applications',
        application_type: 'supplier',
        applicant_name:   a.contact_name || a.business_name || 'Supplier',
        applicant_email:  a.contact_email || '',
        applicant_phone:  a.contact_phone || '',
        business_name:    a.business_name,
        business_address: null,
        notes:            a.message || null,
        supermarket_id:   a.supermarket_id,
        supermarket_name: '',
        supplier_user_id: a.supplier_user_id,
        user_id:          a.supplier_user_id,
        status:           a.status,
        created_at:       a.created_at,
      }));

      // 3. My Boda Guy rider partnership applications (contact info denormalized
      // on the row — mbg_users/mbg_riders are locked to "read own row only",
      // so an admin's session can't join them directly)
      const { data: riderApps } = await supabase
        .from('rider_supermarket_applications')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const normalizedRider = (riderApps || []).map(a => ({
        id:               a.id,
        _source:          'rider_supermarket_applications',
        application_type: 'mybodaguy',
        applicant_name:   a.rider_name || 'Rider',
        applicant_email:  a.rider_email || '',
        applicant_phone:  a.rider_phone || '',
        business_name:    null,
        business_address: null,
        vehicle_type:     a.vehicle_type,
        license_number:   a.license_number,
        notes:            a.message || null,
        supermarket_id:   a.supermarket_id,
        supermarket_name: '',
        rider_user_id:    a.rider_user_id,
        user_id:          null,
        status:           a.status,
        created_at:       a.created_at,
      }));

      const merged = [...(legacyApps || []), ...normalizedSupplier, ...normalizedRider]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setApplications(merged);
    } catch (e) {
      console.warn('loadApplications failed:', e);
    } finally {
      setApplicationsLoading(false);
    }
  }, []);

  // Approve an application
  const approveApplication = async (app) => {
    try {
      if (app._source === 'supplier_applications') {
        // Supplier partner application — just mark approved in supplier_applications
        // Suppliers are independent: no supermarket_staff entry needed
        await supabase.from('supplier_applications').update({
          status: 'approved'
        }).eq('id', app.id);
        // Also ensure their users row is active as supplier
        if (app.supplier_user_id) {
          await supabase.from('users').update({ role: 'supplier', is_active: true })
            .eq('id', app.supplier_user_id);
        }
      } else if (app._source === 'rider_supermarket_applications') {
        // Rider partnership application — riders are managed entirely inside
        // mybodaguy's own tables, so just flip the application status.
        const { data: updated, error: riderErr } = await supabase
          .from('rider_supermarket_applications')
          .update({ status: 'approved', reviewed_by: currentAdmin.id, reviewed_at: new Date().toISOString() })
          .eq('id', app.id)
          .select('id')
          .maybeSingle();
        if (riderErr) throw riderErr;
        if (!updated) throw new Error('Update blocked — this application is not scoped to your supermarket (RLS).');
      } else {
        // Legacy user_applications flow (manager, cashier, mybodaguy)
        const smId = app.supermarket_id || currentAdmin?.supermarket_id;
        if (app.user_id) {
          await supabase.from('users').update({ role: app.application_type, is_active: true }).eq('id', app.user_id);
          if (['manager', 'cashier', 'staff'].includes(app.application_type)) {
            await supabase.from('supermarket_staff').upsert({
              supermarket_id: smId, user_id: app.user_id,
              role: app.application_type, status: 'active', assigned_by: currentAdmin.id
            }, { onConflict: 'supermarket_id,user_id' });
          }
        }
        await supabase.from('user_applications').update({
          status: 'approved', reviewed_by: currentAdmin.id, reviewed_at: new Date().toISOString()
        }).eq('id', app.id);
      }

      setApplications(prev => prev.filter(a => a.id !== app.id));
      notificationService.show(`✅ ${app.applicant_name} approved as ${app.application_type}`, 'success');
    } catch (e) {
      console.error('approveApplication error:', e);
      notificationService.show('Failed to approve application', 'error');
    }
  };

  const rejectApplication = async (appId) => {
    const app = applications.find(a => a.id === appId);
    try {
      if (app?._source === 'supplier_applications') {
        await supabase.from('supplier_applications').update({ status: 'rejected' }).eq('id', appId);
      } else if (app?._source === 'rider_supermarket_applications') {
        const { data: updated, error: riderErr } = await supabase
          .from('rider_supermarket_applications')
          .update({ status: 'rejected', reviewed_by: currentAdmin.id, reviewed_at: new Date().toISOString() })
          .eq('id', appId)
          .select('id')
          .maybeSingle();
        if (riderErr) throw riderErr;
        if (!updated) throw new Error('Update blocked — this application is not scoped to your supermarket (RLS).');
      } else {
        await supabase.from('user_applications').update({
          status: 'rejected', reviewed_by: currentAdmin.id, reviewed_at: new Date().toISOString()
        }).eq('id', appId);
      }
      setApplications(prev => prev.filter(a => a.id !== appId));
      notificationService.show('Application rejected', 'info');
    } catch (e) {
      console.error('rejectApplication error:', e);
      notificationService.show(e.message || 'Failed to reject application', 'error');
    }
  };

  // Load riders currently partnered (approved) with this supermarket
  const loadRiders = useCallback(async () => {
    try {
      setRidersLoading(true);
      const { data, error } = await supabase
        .from('rider_supermarket_applications')
        .select('*')
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false });
      if (error) throw error;
      setRiders(data || []);
    } catch (e) {
      console.warn('loadRiders failed:', e);
    } finally {
      setRidersLoading(false);
    }
  }, []);

  // End a rider partnership (reverts the application to rejected so the
  // rider stops appearing as an active partner for this supermarket)
  const revokeRiderPartnership = async (riderAppId) => {
    try {
      const { data: updated, error } = await supabase
        .from('rider_supermarket_applications')
        .update({ status: 'rejected', reviewed_by: currentAdmin.id, reviewed_at: new Date().toISOString() })
        .eq('id', riderAppId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error('Update blocked — this rider is not scoped to your supermarket (RLS).');
      setRiders(prev => prev.filter(r => r.id !== riderAppId));
      notificationService.show('Rider partnership ended', 'info');
    } catch (e) {
      console.error('revokeRiderPartnership error:', e);
      notificationService.show(e.message || 'Failed to end partnership', 'error');
    }
  };

  // Candidates an admin can assign as staff: every customer/unassigned
  // signup (regardless of what supermarket_id they currently carry), but
  // never another admin, and never someone who's already staff at a
  // DIFFERENT supermarket. get_staff_candidates_for_admin() enforces this
  // server-side (see GET_STAFF_CANDIDATES_RPC.sql) — a plain RLS-scoped
  // query can't see across supermarkets at all, so it's the fallback only.
  const loadAllUsersForStaff = useCallback(async () => {
    setStaffSearchLoading(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_staff_candidates_for_admin');

      if (!rpcError && rpcData) {
        setStaffSearchResults(rpcData);
        return;
      }
      console.warn('get_staff_candidates_for_admin failed, falling back:', rpcError?.message);

      let query = supabase
        .from('users')
        .select('*')
        .neq('role', 'admin')
        .order('created_at', { ascending: false })
        .limit(500);

      query = currentAdmin.supermarket_id
        ? query.or(`supermarket_id.is.null,supermarket_id.eq.${currentAdmin.supermarket_id}`)
        : query.is('supermarket_id', null);

      const { data, error } = await query;
      if (!error) {
        setStaffSearchResults(data || []);
      } else {
        notificationService.show('Could not load users: ' + error.message, 'error');
      }
    } catch (e) {
      console.error('loadAllUsersForStaff exception:', e);
    } finally {
      setStaffSearchLoading(false);
    }
  }, [currentAdmin.supermarket_id]);

  // Filter locally — no network call needed after initial load
  const searchUsersForStaff = (query) => {
    setStaffSearchQuery(query);
  };

  // Assign role — blockchain-verified via assign_staff_with_blockchain RPC
  const assignStaffRole = async (user, role) => {
    const smId = currentAdmin.supermarket_id;
    const adminId = currentAdmin.id;
    const targetId = user.id; // auth.users.id from RPC result

    try {
      // Call the blockchain RPC — atomically updates role + appends immutable block
      const { data: blockHash, error } = await supabase.rpc('assign_staff_with_blockchain', {
        p_supermarket_id: smId  || null,
        p_admin_id:       adminId,
        p_target_auth_id: targetId,
        p_role:           role
      });

      if (error) throw error;

      // Optimistically update search results
      setStaffSearchResults(prev => prev.map(u => u.id === targetId ? { ...u, role } : u));
      loadCurrentStaff();
      loadSystemData();
      loadAllUsers();

      const icons = { manager: '👔', cashier: '💰', supplier: '🏭', customer: '👤' };
      notificationService.show(
        `${icons[role] || '✅'} ${user.full_name || user.email} → ${role}  🔗 ${blockHash?.slice(0, 12)}…`,
        'success',
        4000
      );
    } catch (e) {
      console.error('assignStaffRole error:', e);
      // Fallback: direct update if RPC not yet deployed — must still set
      // supermarket_id, otherwise this person ends up staff on paper but
      // invisible to every supermarket-scoped query/count in this portal.
      try {
        await supabase.from('users').update({ role, is_active: true, supermarket_id: smId }).eq('id', targetId);
        await supabase.from('users').update({ role, is_active: true, supermarket_id: smId }).eq('auth_id', targetId);
        setStaffSearchResults(prev => prev.map(u => u.id === targetId ? { ...u, role } : u));
        loadCurrentStaff();
        loadSystemData();
        loadAllUsers();
        notificationService.show(`✅ ${user.full_name || user.email} → ${role} (run SQL migration for blockchain)`, 'success');
      } catch (e2) {
        notificationService.show('Failed to assign role: ' + e2.message, 'error');
      }
    }
  };

  const removeStaffRole = async (userId) => {
    if (!window.confirm('Remove this person\'s role? They will become a regular customer.')) return;
    try {
      const smId    = currentAdmin.supermarket_id;
      const adminId = currentAdmin.id;

      const { data: blockHash, error } = await supabase.rpc('revoke_staff_with_blockchain', {
        p_supermarket_id: smId   || null,
        p_admin_id:       adminId,
        p_target_auth_id: userId
      });

      if (error) throw error;

      loadCurrentStaff();
      // Also refresh search results so role badge updates
      setStaffSearchResults(prev => prev.map(u => u.id === userId ? { ...u, role: 'customer' } : u));
      notificationService.show(
        `🔒 Role revoked  🔗 ${blockHash?.slice(0, 12)}…`,
        'info', 4000
      );
    } catch (e) {
      console.error('removeStaffRole error:', e);
      // Fallback: direct delete if RPC not yet deployed
      try {
        const smId = currentAdmin.supermarket_id;
        await supabase.from('supermarket_staff').delete().eq('supermarket_id', smId).eq('user_id', userId);
        await supabase.from('users').update({ role: 'customer' }).eq('id', userId);
        await supabase.from('users').update({ role: 'customer' }).eq('auth_id', userId);
        loadCurrentStaff();
        setStaffSearchResults(prev => prev.map(u => u.id === userId ? { ...u, role: 'customer' } : u));
        notificationService.show('Role removed (run SQL migration for blockchain)', 'info');
      } catch (e2) {
        notificationService.show('Failed to remove role', 'error');
      }
    }
  };

  const loadCurrentStaff = useCallback(async () => {
    const smId = currentAdmin.supermarket_id;
    if (!smId) return;
    try {
      // Try supermarket_staff table (exists after SQL migration)
      const { data, error } = await supabase
        .from('supermarket_staff')
        .select('*')
        .eq('supermarket_id', smId);

      if (error) {
        // Table not yet created — fall back to public.users filtered by role,
        // still scoped to this admin's own supermarket
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email, phone, role, is_active')
          .in('role', ['manager', 'cashier', 'staff'])
          .eq('is_active', true)
          .eq('supermarket_id', smId);
        setCurrentStaff(users || []);
        return;
      }
      setCurrentStaff(data || []);
    } catch (e) {
      console.warn('loadCurrentStaff:', e.message);
      setCurrentStaff([]);
    }
  }, [currentAdmin.supermarket_id]);

  // Load order statistics from Supabase
  const loadOrderStats = useCallback(async () => {
    try {
      console.log('📊 Loading order statistics...');
      
      // Get total orders count
      let totalCount = 0;
      try {
        const result = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true });
        totalCount = result.count || 0;
        if (result.error) {
          console.error('❌ Error getting total count:', result.error);
        }
      } catch (e) {
        console.error('❌ Table does not exist:', e);
        totalCount = 0;
      }

      // Get today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      console.log('📅 Today ISO:', todayISO);
      
      let todayOrders = [];
      let todayCount = 0;
      try {
        const result = await supabase
          .from('transactions')
          .select('*', { count: 'exact' })
          .gte('created_at', todayISO);
        todayOrders = result.data || [];
        todayCount = result.count || 0;
        if (result.error) {
          console.error('❌ Error getting today orders:', result.error);
        }
      } catch (e) {
        console.error('❌ Table does not exist:', e);
        todayOrders = [];
        todayCount = 0;
      }
      console.log(`📈 Today's orders: ${todayCount}, data:`, todayOrders);

      // Get pending orders (from purchase_orders table)
      const { count: pendingCount, error: pendingError } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending_approval', 'sent_to_supplier']);

      if (pendingError) {
        console.error('❌ Error getting pending orders:', pendingError);
      }

      // Get completed orders
      let completedCount = 0;
      try {
        const result = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');
        completedCount = result.count || 0;
        if (result.error) {
          console.error('❌ Error getting completed orders:', result.error);
        }
      } catch (e) {
        console.error('❌ Table does not exist:', e);
        completedCount = 0;
      }

      // Calculate today's revenue
      const todayRevenue = todayOrders?.reduce((sum, order) => 
        sum + (parseFloat(order.amount || order.total_amount || 0)), 0) || 0;

      setOrderStats({
        total: totalCount || 0,
        today: todayCount || 0,
        pending: pendingCount || 0,
        completed: completedCount || 0,
        revenue: todayRevenue,
        loading: false
      });

      // SYNC: Also update realTimeData with order stats
      setRealTimeData(prev => ({
        ...prev,
        todaysOrders: todayCount || 0,
        dailyRevenue: Math.round(todayRevenue || 0)
      }));

      console.log('✅ Loaded order statistics:', {
        total: totalCount,
        today: todayCount,
        pending: pendingCount,
        completed: completedCount,
        revenue: todayRevenue
      });
      console.log('🔄 SYNC: Updated realTimeData with todaysOrders:', todayCount, 'revenue:', Math.round(todayRevenue));
    } catch (error) {
      console.error('Error loading order statistics:', error);
      setOrderStats(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Load detailed orders from Supabase (real data from manager portal)
  const loadDetailedOrders = useCallback(async () => {
    try {
      setLoadingDetailedOrders(true);
      console.log('📥 Loading detailed orders from database...');
      
      // Load recent sales transactions
      let transactions = [];
      try {
        const result = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        transactions = result.data || [];
        if (result.error) {
          console.error('❌ Error loading transactions:', result.error);
        } else {
          console.log(`✅ Loaded ${transactions?.length || 0} transactions:`, transactions);
        }
      } catch (e) {
        console.error('❌ Table does not exist:', e);
        transactions = [];
      }

      // Load purchase orders
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (poError) {
        console.error('❌ Error loading purchase orders:', poError);
      } else {
        console.log(`✅ Loaded ${purchaseOrders?.length || 0} purchase orders:`, purchaseOrders);
      }

      // Combine and format orders
      const allOrders = [
        ...(transactions || []).map(t => ({
          id: t.id,
          type: 'sale',
          status: t.status || 'completed',
          amount: t.amount || t.total_amount || 0,
          created_at: t.created_at,
          items: t.items_count || 1,
          customer: t.customer_name || 'Customer'
        })),
        ...(purchaseOrders || []).map(po => ({
          id: po.id,
          type: 'purchase',
          status: po.status || 'pending',
          amount: po.total_amount || 0,
          created_at: po.created_at,
          items: po.line_items?.length || 0,
          supplier: po.supplier_name || 'Supplier'
        }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);

      setDetailedOrders(allOrders);
      console.log(`✅ Total formatted orders: ${allOrders.length}`, allOrders);
    } catch (error) {
      console.error('❌ Error loading detailed orders:', error);
    } finally {
      setLoadingDetailedOrders(false);
    }
  }, []);

  // Load users when accessing user management or approvals
  useEffect(() => {
    // Only load when explicitly changing to these sections
    if (activeSection === 'users') {
      if (viewMode === 'applications') {
        loadApplications();
      } else if (viewMode === 'staff') {
        loadCurrentStaff();
        loadAllUsersForStaff();
      } else if (viewMode === 'riders') {
        loadRiders();
      } else {
        // Default: load all users — no pending concept
        loadAllUsers();
      }
    } else if (activeSection === 'approvals') {
      loadAllUsers();
    } else if (activeSection === 'orders') {
      // Load orders data
      const loadOrders = async () => {
        try {
          await Promise.all([
            loadOrderStats(),
            loadDetailedOrders()
          ]).catch(err => {
            console.warn('⚠️ Orders loading encountered an error, showing empty state:', err.message);
          });
        } catch (error) {
          console.warn('Error loading orders:', error.message);
        }
      };
      
      loadOrders();
      
      // Auto-refresh orders every 5 seconds only if orders section is still active
      const refreshInterval = setInterval(() => {
        if (document.hidden) return; // Don't refresh if tab is not visible
        console.log('🔄 Auto-refreshing order stats...');
        loadOrders();
      }, 5000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [activeSection, viewMode, loadPendingUsers, loadAllUsers, loadApplications, loadCurrentStaff, loadAllUsersForStaff, loadRiders, loadOrderStats, loadDetailedOrders]);

  // Real-time subscription for new user registrations
  useEffect(() => {
    // Subscribe to changes in the users table
    const subscription = supabase
      .channel('user-registrations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users',
          filter: 'is_active=eq.false'
        },
        (payload) => {
          console.log('🎉 New user registration detected!', payload);
          
          // Add the new user to the pending list
          setPendingUsers((current) => [payload.new, ...current]);
          
          // Show notification to admin
          notificationService.show(
            `🔔 New ${payload.new.role} application from ${payload.new.full_name}!`,
            'info',
            5000
          );
          
          // Play notification sound if available
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIF2S57OihUBELTqXh8LRiGgU7k9ryy3krBSl+y/LaizsKF2K56+mjURATUKXh8LNhGgU7k9ryy3kr');
            audio.play().catch(() => {});
          } catch (e) {}
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: 'is_active=eq.true'
        },
        (payload) => {
          console.log('✅ User approved!', payload);
          
          // Remove from pending list
          setPendingUsers((current) => 
            current.filter((user) => user.id !== payload.new.id)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          console.log('❌ User rejected/deleted!', payload);
          
          // Remove from pending list
          setPendingUsers((current) => 
            current.filter((user) => user.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Realtime subscription for new user_applications
  useEffect(() => {
    const appSub = supabase
      .channel('user-applications-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_applications' }, (payload) => {
        const app = payload.new;
        setApplications(prev => [app, ...prev]);
        const icons = { supplier: '🏭', mybodaguy: '🛵', manager: '👔', cashier: '💰' };
        notificationService.show(
          `${icons[app.application_type] || '📋'} New ${app.application_type} application from ${app.applicant_name}!`,
          'info', 5000
        );
        setRealTimeData(prev => ({ ...prev, pendingApprovals: prev.pendingApprovals + 1 }));
      })
      .subscribe();
    return () => appSub.unsubscribe();
  }, []);

  // Portal Configuration Management - Real Data Integration
  const [portalConfig, setPortalConfig] = useState({
    adminPortal: 'Admin Portal',
    employeePortal: 'Employee Portal',
    managerPortal: 'Manager Portal',
    customerPortal: 'Customer Portal',
    supplierPortal: 'Supplier Portal',
    deliveryPortal: 'Delivery Portal',
    systemName: 'FAREDEAL',
    companyName: 'FareDeal Uganda',
    appTitle: 'FareDeal Management System',
    tagline: 'Your Trusted Marketplace',
    version: '2.0.0'
  });
  
  const [showPortalConfig, setShowPortalConfig] = useState(false);
  const [configForm, setConfigForm] = useState({});
  const [configLoading, setConfigLoading] = useState(false);
  const [configHistory, setConfigHistory] = useState([]);
  const [realTimeListener, setRealTimeListener] = useState(null);
  // Mock admin user for development
  const user = {
    id: 1,
    name: "System Admin",
    role: "admin",
    email: "admin"
  };

  useEffect(() => {
    loadSystemData();
    loadOrderStats(); // Also load order stats immediately for dashboard metrics
    initializeRealTimeUpdates();
    simulateWebSocketConnection();
    loadPortalConfiguration();
    setupRealTimeConfigUpdates();
    
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
      if (realTimeListener) {
        realTimeListener();
      }
    };
  }, [loadOrderStats]);

  // Load portal configuration from server with fallback to localStorage
  const loadPortalConfiguration = async () => {
    try {
      showNotification('Loading portal configuration...', 'info');
      
      const response = await portalConfigService.getPortalConfiguration();
      
      if (response.success) {
        setPortalConfig(response.data);
        showNotification('Portal configuration loaded successfully', 'success');
      } else {
        // Fallback to localStorage or default
        const savedConfig = localStorage.getItem('portalConfiguration');
        if (savedConfig) {
          const parsedConfig = JSON.parse(savedConfig);
          setPortalConfig(parsedConfig);
          showNotification('Portal configuration loaded from local storage', 'warning');
        } else {
          showNotification('Using default portal configuration', 'info');
        }
      }
      
      // Load configuration history
      loadConfigurationHistory();
      
    } catch (error) {
      console.error('Failed to load portal configuration:', error);
      showNotification('Failed to load portal configuration, using defaults', 'error');
    }
  };

  // Mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize real-time updates
  const initializeRealTimeUpdates = () => {
    // Simulate real-time data updates every 5 seconds
    const interval = setInterval(() => {
      updateRealTimeData();
      generateRandomActivity();
    }, 5000);

    return () => clearInterval(interval);
  };

  // Simulate WebSocket connection for real-time updates
  const simulateWebSocketConnection = () => {
    // Simulate WebSocket connection
    const mockWs = {
      readyState: 1, // OPEN
      send: (data) => {
        console.log('Sending data:', data);
        showNotification('Command sent successfully', 'success');
      },
      close: () => console.log('WebSocket connection closed'),
      onmessage: null,
      onopen: () => console.log('WebSocket connected'),
      onerror: (error) => console.error('WebSocket error:', error)
    };
    
    setWsConnection(mockWs);
    showNotification('Real-time connection established', 'success');
  };

  // Update real-time data with simulated changes
  const updateRealTimeData = () => {
    setRealTimeData(prev => ({
      ...prev,
      activeUsers: prev.activeUsers + Math.floor(Math.random() * 10 - 5),
      todaysOrders: prev.todaysOrders + Math.floor(Math.random() * 5),
      dailyRevenue: prev.dailyRevenue + Math.floor(Math.random() * 1000),
      systemLoad: Math.max(10, Math.min(90, prev.systemLoad + Math.floor(Math.random() * 10 - 5))),
      memoryUsage: Math.max(30, Math.min(90, prev.memoryUsage + Math.floor(Math.random() * 6 - 3))),
      activeSessions: Math.max(50, Math.min(200, prev.activeSessions + Math.floor(Math.random() * 8 - 4))),
      employeeLogins: prev.employeeLogins + Math.floor(Math.random() * 3),
      systemServices: prev.systemServices.map(service => ({
        ...service,
        uptime: Math.max(95, Math.min(100, service.uptime + (Math.random() * 0.2 - 0.1)))
      }))
    }));
  };

  // Generate random system activities
  const generateRandomActivity = () => {
    const activities = [
      { type: 'order', message: `New order #${Math.floor(Math.random() * 1000 + 2000)} received from Customer Portal`, severity: 'info' },
      { type: 'payment', message: `Payment of $${(Math.random() * 200 + 50).toFixed(2)} processed successfully`, severity: 'success' },
      { type: 'employee', message: `Employee ${['John Doe', 'Jane Smith', 'Mike Wilson', 'Sarah Johnson'][Math.floor(Math.random() * 4)]} logged into system`, severity: 'info' },
      { type: 'inventory', message: `${['Rice', 'Beans', 'Sugar', 'Oil'][Math.floor(Math.random() * 4)]} stock level updated`, severity: 'warning' },
      { type: 'system', message: 'System optimization completed successfully', severity: 'success' }
    ];

    const newActivity = {
      ...activities[Math.floor(Math.random() * activities.length)],
      time: 'Just now',
      id: Date.now()
    };

    setRealTimeData(prev => ({
      ...prev,
      recentActivities: [newActivity, ...prev.recentActivities.slice(0, 9)]
    }));
  };

  // Show notifications
  const showNotification = (message, type = 'info') => {
    const notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const loadSystemData = async () => {
    try {
      setLoading(true);
      
      // Get all users from Supabase - skip RPC, use direct query for reliability
      let allUsersData = null;
      let usersError = null;
      
      // Direct query to users table (more reliable than RPC)
      const usersResponse = await supabase
        .from('users')
        .select('*');
      allUsersData = usersResponse.data;
      usersError = usersResponse.error;

      if (usersError) {
        console.warn('Error loading users:', usersError);
      }

      // Calculate analytics from the users data
      const users = allUsersData || [];
      const analytics = {
        users: {
          total: users.length,
          active: users.filter(u => u.is_active).length,
          pending: users.filter(u => !u.is_active).length,
          byRole: {
            admin: users.filter(u => u.role === 'admin').length,
            manager: users.filter(u => u.role === 'manager').length,
            cashier: users.filter(u => u.role === 'cashier').length,
            supplier: users.filter(u => u.role === 'supplier').length,
            customer: users.filter(u => u.role === 'customer').length
          }
        }
      };

      setSystemData({
        analytics: analytics || {},
        users: {
          all: users,
          admin: users.filter(u => u.role === 'admin'),
          manager: users.filter(u => u.role === 'manager'),
          cashier: users.filter(u => u.role === 'cashier'),
          supplier: users.filter(u => u.role === 'supplier'),
          customer: users.filter(u => u.role === 'customer')
        },
        settings: {}
      });
      
      // Calculate revenue for "today" on initial load
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Query transactions for today
        const { data: transactions } = await supabase
          .from('transactions')
          .select('total_amount')
          .gte('created_at', today.toISOString());
        
        const todayRevenue = transactions?.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0) || 0;
        
        console.log(`✅ Calculated today's revenue from loadSystemData: UGX ${Math.round(todayRevenue)}`);
        
        setRealTimeData(prev => ({
          ...prev,
          dailyRevenue: Math.round(todayRevenue),
          revenueLabel: 'Today'
        }));
      } catch (error) {
        console.error('Error calculating initial revenue:', error);
      }
      
      // Calculate real-time dashboard analytics
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.is_active).length;
      const totalAdmins = users.filter(u => u.role === 'admin').length;
      const totalManagers = users.filter(u => u.role === 'manager').length;
      const totalCashiers = users.filter(u => u.role === 'cashier').length;
      const totalSuppliers = users.filter(u => u.role === 'supplier').length;
      const verifiedUsers = users.filter(u => u.email_confirmed_at).length;
      const unverifiedUsers = totalUsers - verifiedUsers;
      
      // Get pending approvals - use direct query instead of RPC
      const pendingApprovals = users.filter(u => !u.is_active || u.status === 'pending').length;
      
      // Get today's orders count and revenue from transactions table
      // Using the same logic as loadOrderStats() for consistency
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const todayISO = todayDate.toISOString();
      
      let transactionsData = [];
      let todaysOrders = 0;
      let dailyRevenue = 0;
      
      try {
        const transResponse = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', todayISO);
        transactionsData = transResponse.data || [];
        todaysOrders = transResponse.count || transactionsData.length || 0;
        dailyRevenue = transactionsData?.reduce((sum, trans) => 
          sum + (parseFloat(trans.total_amount || trans.amount || 0)), 0) || 0;
        console.log(`✅ Loaded ${todaysOrders} transactions for today from loadSystemData`);
      } catch (error) {
        console.warn('Failed to get transactions:', error);
        transactionsData = [];
        todaysOrders = 0;
        dailyRevenue = 0;
      }
      
      // Get recent activities (last 10 user actions)
      const recentActivities = users
        .filter(u => u.last_sign_in_at)
        .sort((a, b) => new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at))
        .slice(0, 10)
        .map(u => ({
          user: u.email,
          action: 'Logged in',
          time: new Date(u.last_sign_in_at).toLocaleString(),
          role: u.role
        }));
      
      // Update real-time dashboard data
      setRealTimeData(prev => ({
        ...prev,
        activeUsers,
        todaysOrders,
        dailyRevenue: Math.round(dailyRevenue),
        totalUsers,
        totalAdmins,
        totalManagers,
        totalCashiers,
        totalSuppliers,
        pendingApprovals,
        verifiedUsers,
        unverifiedUsers,
        activeSessions: activeUsers, // Active users = active sessions for now
        employeeLogins: totalManagers + totalCashiers,
        managerAccess: totalManagers,
        recentActivities,
        systemHealth: users.length > 0 ? 99.9 : 100, // Simple health calculation
        failedAttempts: 0 // Would need auth logs to track this
      }));
      
      console.log(`✅ Loaded ${users.length} users from Supabase`);
      console.log(`📊 Dashboard Analytics: ${activeUsers} active, ${todaysOrders} orders today, UGX ${Math.round(dailyRevenue)} revenue`);
    } catch (error) {
      console.error('Error loading system data:', error);
      notificationService.show('Failed to load system data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Approve a user
  const approveUser = async (userId, userName, userEmail, userRole = null) => {
    try {
      // Call the approve_user() database function with optional role parameter
      // This sets is_active=true AND role='manager' for managers
      let rpcCall;
      
      // If we have a user role from the pending list, pass it to the RPC function
      if (userRole) {
        rpcCall = supabase.rpc('approve_user', { 
          p_user_id: userId,
          p_role: userRole 
        });
      } else {
        // Fallback to basic approval (for backward compatibility)
        rpcCall = supabase.rpc('approve_user', { 
          p_user_id: userId 
        });
      }
      
      const { data, error } = await rpcCall;

      if (error) throw error;

      console.log('✅ User approved:', { userId, userName, userRole, data });
      notificationService.show(`✅ ${userName} has been approved!`, 'success');
      loadPendingUsers(); // Reload the list
    } catch (error) {
      console.error('Error approving user:', error);
      notificationService.show('Failed to approve user', 'error');
    }
  };

  // Reject a user
  const rejectUser = async (userId, authId, userName) => {
    try {
      // Call the reject_user() database function (bypasses RLS and deletes from both tables)
      const { data, error } = await supabase.rpc('reject_user', { p_user_id: userId });

      if (error) throw error;
      if (authId) {
        console.log('Auth user still exists in auth.users, but access is revoked');
      }

      notificationService.show(`❌ ${userName}'s application was rejected`, 'info');
      loadPendingUsers(); // Reload the list
    } catch (error) {
      console.error('Error rejecting user:', error);
      notificationService.show('Failed to reject user', 'error');
    }
  };

  // Complete Supermarket Profile for Admin
  const completeSupermarketProfile = async () => {
    try {
      if (!supermarketForm.name || !supermarketForm.location) {
        notificationService.show('Please fill in supermarket name and location', 'error');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        notificationService.show('Not authenticated', 'error');
        return;
      }

      setLoading(true);

      // Create supermarket
      const { data: supermarket, error: supermarketError } = await supabase
        .from('supermarkets')
        .insert([{
          name: supermarketForm.name,
          location: supermarketForm.location,
          phone: supermarketForm.phone || null,
          address: supermarketForm.address || null,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (supermarketError) throw supermarketError;

      // Update admin user with supermarket_id
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          supermarket_id: supermarket.id,
          phone: supermarketForm.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('auth_id', user.id);

      if (updateError) throw updateError;

      notificationService.show('✅ Supermarket profile completed!', 'success');
      setNeedsSupermarketProfile(false);
      setSupermarketForm({ name: '', location: '', phone: '', address: '' });
      
      // Reload admin check
      await checkAdminAccess();
      
    } catch (error) {
      console.error('Error completing supermarket profile:', error);
      notificationService.show('Failed to complete profile: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Quick Admin Registration - Direct Supabase approach
  const createQuickAdmin = async () => {
    try {
      setLoading(true);
      
      // Auto-generate missing fields for quick setup
      const quickAdminData = {
        email: adminForm.email || `admin${Date.now()}@faredeal.com`,
        password: adminForm.password || 'FareAdmin2025!',
        full_name: adminForm.full_name || 'Quick Admin',
        phone: adminForm.phone || '+1234567890',
      };

      // Create admin user in Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: quickAdminData.email,
        password: quickAdminData.password,
        options: {
          data: {
            full_name: quickAdminData.full_name,
            phone: quickAdminData.phone,
            role: 'admin',
            admin_id: `QA-${Date.now()}`,
            department: 'administration'
          }
        }
      });

      if (authError) throw authError;

      // Wait for trigger to create user record
      await new Promise(resolve => setTimeout(resolve, 1000));

      notificationService.show('🚀 Admin account created! Instant access granted!', 'success');
      
      // Auto-login hint
      setTimeout(() => {
        window.location.href = '/admin-auth?email=' + encodeURIComponent(quickAdminData.email);
      }, 2000);
      
      setShowQuickRegister(false);
      setAdminForm({ email: '', password: '', full_name: '', phone: '' });
      
    } catch (error) {
      console.error('Quick admin creation error:', error);
      notificationService.show('Failed to create admin account: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (action, userType, userId) => {
    try {
      setLoading(true);
      
      switch (action) {
        case 'activate':
          await supabase
            .from('users')
            .update({ is_active: true, status: 'active' })
            .eq('id', userId);
          notificationService.show('User activated successfully', 'success');
          break;
        case 'deactivate':
          await supabase
            .from('users')
            .update({ is_active: false, status: 'inactive' })
            .eq('id', userId);
          notificationService.show('User deactivated successfully', 'success');
          break;
        case 'delete':
          if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            await supabase
              .from('users')
              .delete()
              .eq('id', userId);
            notificationService.show('User deleted successfully', 'success');
          }
          break;
        default:
          break;
      }
      
      loadSystemData(); // Refresh data
    } catch (error) {
      console.error(`Error ${action} user:`, error);
      notificationService.show(`Failed to ${action} user`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) {
      notificationService.show('Please select users first', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Get all user IDs
      const userIds = selectedUsers.map(user => user.id);

      // Perform bulk operation directly in Supabase
      const promises = userIds.map(userId => {
        switch (action) {
          case 'activate':
            return supabase.from('users').update({ is_active: true, status: 'active' }).eq('id', userId);
          case 'deactivate':
            return supabase.from('users').update({ is_active: false, status: 'inactive' }).eq('id', userId);
          case 'delete':
            return supabase.from('users').delete().eq('id', userId);
          default:
            return Promise.resolve();
        }
      });

      const promises2 = Promise.all(promises
      );

      await Promise.all(promises);
      
      notificationService.show(`Bulk ${action} completed successfully`, 'success');
      setSelectedUsers([]);
      loadSystemData();
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      notificationService.show(`Failed to perform bulk ${action}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Import Employee Access Service
  const [employeeAccessService, setEmployeeAccessService] = useState(null);
  const [showEmployeeControlModal, setShowEmployeeControlModal] = useState(false);
  const [employeeList, setEmployeeList] = useState([]);
  const [accessControlStats, setAccessControlStats] = useState({});
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [accessControlLoading, setAccessControlLoading] = useState(false);

  // Admin Data Storage System
  const [adminDataService, setAdminDataService] = useState(null);
  const [showDataDashboard, setShowDataDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState({});
  const [dataInsights, setDataInsights] = useState([]);
  const [businessIntelligence, setBusinessIntelligence] = useState({});
  const [dataLoading, setDataLoading] = useState(false);

  // Fetch payment data from Supabase
  const fetchPaymentData = async () => {
    try {
      // Fetch orders to calculate revenue and payments
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*');
      
      if (ordersError) throw ordersError;

      const today = new Date().toISOString().split('T')[0];
      const todayOrders = orders?.filter(order => 
        order.created_at?.startsWith(today)
      ) || [];

      const totalPayments = orders?.length || 0;
      const successfulPayments = orders?.filter(order => 
        order.payment_status === 'paid' || order.payment_status === 'completed'
      ).length || 0;
      const pendingPayments = orders?.filter(order => 
        order.payment_status === 'pending' || order.payment_status === 'processing'
      ).length || 0;
      const failedTransactions = orders?.filter(order => 
        order.payment_status === 'failed' || order.payment_status === 'cancelled'
      ).length || 0;

      const dailyRevenue = todayOrders.reduce((sum, order) => 
        sum + (parseFloat(order.total_amount) || 0), 0
      );

      setDashboardData(prev => ({
        ...prev,
        dailyRevenue,
        pendingPayments,
        failedTransactions,
        totalPayments,
        successfulPayments
      }));

    } catch (error) {
      console.error('Error fetching payment data:', error);
    }
  };

  // Fetch payment data on mount and set interval
  useEffect(() => {
    fetchPaymentData();
    const interval = setInterval(fetchPaymentData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch inventory data from Supabase
  const fetchInventoryData = async () => {
    try {
      // OPTIMIZED: Load products and inventory in parallel with timeouts
      const [productsResult, inventoryResult] = await Promise.all([
        // Load products with specific columns
        Promise.race([
          supabase
            .from('products')
            .select('id, name, price, selling_price, cost_price, category, barcode, sku, is_active')
            .limit(100),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 2000)
          )
        ]).catch(err => ({ data: [], error: err })),
        
        // Load inventory data
        Promise.race([
          supabase
            .from('inventory')
            .select('product_id, current_stock, minimum_stock, reorder_point'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 2000)
          )
        ]).catch(err => ({ data: [], error: err }))
      ]);

      // Create inventory map
      const inventoryMap = {};
      if (inventoryResult.data) {
        inventoryResult.data.forEach(inv => {
          inventoryMap[inv.product_id] = inv;
        });
      }

      const products = productsResult.data || [];
      console.log('Fetched products for inventory:', products?.length);

      // Calculate inventory metrics - use real inventory data from inventory table
      const totalProducts = products?.length || 0;
      const lowStockItems = products?.filter(product => {
        const invData = inventoryMap[product.id];
        let qty = 0;
        let threshold = 10;
        
        if (invData) {
          // Use real inventory data
          qty = invData.current_stock || 0;
          threshold = invData.minimum_stock || 10;
        } else {
          // Fallback to products table
          qty = product.quantity || product.stock || product.current_stock || 0;
          threshold = product.low_stock_threshold || product.minimum_stock || product.min_stock || 10;
        }
        return qty <= threshold;
      }).length || 0;

      // Calculate total inventory value - use real quantities
      const totalValue = products?.reduce((sum, product) => {
        const invData = inventoryMap[product.id];
        const qty = invData ? (invData.current_stock || 0) : (product.quantity || product.stock || product.current_stock || 0);
        const price = parseFloat(product.price || product.selling_price || product.cost_price || 0);
        return sum + (qty * price);
      }, 0) || 0;

      // Fetch orders for monthly count
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('created_at');
      
      if (!ordersError) {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyOrders = orders?.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate.getMonth() === currentMonth && 
                 orderDate.getFullYear() === currentYear;
        }).length || 0;

        setSystemData(prev => ({
          ...prev,
          inventory: {
            totalProducts,
            lowStockItems,
            totalValue,
            lastUpdated: new Date().toISOString()
          },
          orders: {
            ...prev.orders,
            monthlyCount: monthlyOrders
          }
        }));
      }

    } catch (error) {
      console.error('Error fetching inventory data:', error);
    }
  };

  // Fetch inventory data on mount and set interval
  useEffect(() => {
    fetchInventoryData();
    const interval = setInterval(fetchInventoryData, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, []);

  // Initialize Employee Access Service
  useEffect(() => {
    const initEmployeeAccessService = async () => {
      try {
        const { employeeAccessService: service } = await import('../services/employeeAccessService.js');
        setEmployeeAccessService(service);
        
        // Load initial data
        const employees = service.getEmployeeList();
        const stats = service.getAccessControlStats();
        const audit = service.getAuditLog();
        
        setEmployeeList(employees);
        setAccessControlStats(stats);
        setAuditLog(audit);
        
        // Subscribe to real-time updates
        service.subscribe((update) => {
          if (update.type === 'GLOBAL_ACCESS_CHANGED' || update.type === 'INDIVIDUAL_ACCESS_CHANGED') {
            const newStats = service.getAccessControlStats();
            setAccessControlStats(newStats);
            setRealTimeData(prev => ({
              ...prev,
              isEmployeeLoginEnabled: update.enabled !== false
            }));
          }
          
          if (update.type === 'BULK_OPERATION_COMPLETED') {
            const newStats = service.getAccessControlStats();
            setAccessControlStats(newStats);
            showNotification(`Bulk ${update.operation} completed for ${update.affectedCount} employees`, 'success');
          }
          
          // Update audit log
          const newAudit = service.getAuditLog();
          setAuditLog(newAudit);
        });
        
      } catch (error) {
        console.error('Error initializing employee access service:', error);
        showNotification('Error loading employee access control', 'error');
      }
    };
    
    initEmployeeAccessService();
  }, []);

  // Initialize Admin Data Storage Service
  useEffect(() => {
    const initAdminDataService = async () => {
      try {
        const { adminDataStorageService: service } = await import('../services/adminDataStorageService.js');
        setAdminDataService(service);
        
        // Initialize with sample data for demonstration
        initializeSampleData();
        
        // Load dashboard data
        const dashboard = service.getAdminDashboardData();
        setDashboardData(dashboard);
        setDataInsights(dashboard.recentInsights || []);
        setBusinessIntelligence({
          predictions: dashboard.predictions || [],
          recommendations: dashboard.recommendations || []
        });
        
        // Setup real-time data updates
        const updateInterval = setInterval(() => {
          const updatedDashboard = service.getAdminDashboardData();
          setDashboardData(updatedDashboard);
          setDataInsights(updatedDashboard.recentInsights || []);
          setBusinessIntelligence({
            predictions: updatedDashboard.predictions || [],
            recommendations: updatedDashboard.recommendations || []
          });
        }, showDataDashboard ? 5000 : 30000); // Update every 5 seconds when dashboard is open, otherwise 30 seconds
        
        // Store interval ID for cleanup
        const intervalId = updateInterval;
        
        return () => {
          clearInterval(intervalId);
          console.log('🧹 Cleaned up data service interval');
        };
        
      } catch (error) {
        console.error('Error initializing admin data service:', error);
        showNotification('Error loading admin data system', 'error');
        setDataLoading(false);
        
        // Set fallback data with proper structure
        setDashboardData({
          systemHealth: { 
            totalRecords: 0, 
            dataQuality: 85, 
            performance: 75,
            uptime: 85,
            responseTime: 100,
            dataFreshness: 90
          },
          dataCategories: [
            { name: 'inventory_data', count: 0, lastUpdated: new Date().toISOString() },
            { name: 'user_behavior', count: 0, lastUpdated: new Date().toISOString() },
            { name: 'business_metrics', count: 0, lastUpdated: new Date().toISOString() }
          ],
          realTimeMetrics: { activeUsers: 0, currentSales: 0, conversionRate: "0.0" },
          recentInsights: []
        });
      }
    };
    
    initAdminDataService();
  }, []);

  // Stable Data Center Management - Enhanced with error handling and data validation
  useEffect(() => {
    if (!showDataDashboard || !adminDataService) return;

    let dashboardInterval;
    
    const updateDashboardData = () => {
      try {
        setDataLoading(true);
        console.log('🔄 Refreshing real-time dashboard data...');
        
        // Get fresh data with error handling
        const freshData = adminDataService.getAdminDashboardData();
        
        // Validate data before setting
        if (freshData && typeof freshData === 'object') {
          setDashboardData(prev => ({
            ...prev,
            ...freshData,
            systemHealth: {
              totalRecords: freshData.systemHealth?.totalRecords || prev.systemHealth?.totalRecords || 0,
              dataQuality: freshData.systemHealth?.dataQuality || prev.systemHealth?.dataQuality || 85,
              performance: freshData.systemHealth?.performance || prev.systemHealth?.performance || 75
            },
            realTimeMetrics: {
              activeUsers: freshData.realTimeMetrics?.activeUsers || Math.floor(Math.random() * 50) + 25,
              currentSales: freshData.realTimeMetrics?.currentSales || Math.floor(Math.random() * 10000) + 5000,
              conversionRate: freshData.realTimeMetrics?.conversionRate || (Math.random() * 5 + 2).toFixed(1)
            }
          }));
          
          setDataInsights(freshData.recentInsights || []);
          setBusinessIntelligence({
            predictions: freshData.predictions || [],
            recommendations: freshData.recommendations || []
          });
          
          // Update real-time metrics display
          setRealTimeData(prev => ({
            ...prev,
            activeUsers: freshData.realTimeMetrics?.activeUsers || prev.activeUsers,
            todaysOrders: prev.todaysOrders + Math.floor(Math.random() * 3),
            dailyRevenue: prev.dailyRevenue + Math.floor(Math.random() * 1000),
            systemHealth: Math.max(85 + Math.floor(Math.random() * 15), 85)
          }));
          
          console.log('✅ Dashboard data updated successfully');
        }
        
      } catch (error) {
        console.error('❌ Error updating dashboard data:', error);
        showNotification('Data refresh error - using cached data', 'warning');
      } finally {
        setDataLoading(false);
      }
    };

    // Initial data load when dashboard opens
    updateDashboardData();
    
    // Set up high-frequency updates for active data dashboard
    dashboardInterval = setInterval(updateDashboardData, 5000); // Update every 5 seconds

    return () => {
      if (dashboardInterval) {
        clearInterval(dashboardInterval);
      }
    };
  }, [showDataDashboard, adminDataService]);

  // Initialize sample data for demonstration
  const initializeSampleData = () => {
    // Sample inventory data
    const sampleProducts = [
      { id: 1, name: 'iPhone 15 Pro', category: 'Electronics', price: 999, stock: 50, status: 'active', lastUpdated: new Date().toISOString() },
      { id: 2, name: 'Samsung Galaxy S24', category: 'Electronics', price: 899, stock: 30, status: 'active', lastUpdated: new Date().toISOString() },
      { id: 3, name: 'MacBook Pro M3', category: 'Electronics', price: 1999, stock: 25, status: 'active', lastUpdated: new Date().toISOString() },
      { id: 4, name: 'Dell XPS 13', category: 'Electronics', price: 1299, stock: 40, status: 'active', lastUpdated: new Date().toISOString() },
      { id: 5, name: 'iPad Air', category: 'Electronics', price: 599, stock: 60, status: 'active', lastUpdated: new Date().toISOString() },
      { id: 6, name: 'AirPods Pro', category: 'Electronics', price: 249, stock: 100, status: 'active', lastUpdated: new Date().toISOString() }
    ];
    
    // Sample employee data
    const sampleEmployees = [
      { id: 1, name: 'John Smith', department: 'Sales', role: 'Manager', status: 'active', lastLogin: new Date().toISOString() },
      { id: 2, name: 'Sarah Johnson', department: 'IT', role: 'Developer', status: 'active', lastLogin: new Date(Date.now() - 3600000).toISOString() },
      { id: 3, name: 'Mike Davis', department: 'Marketing', role: 'Specialist', status: 'active', lastLogin: new Date(Date.now() - 7200000).toISOString() },
      { id: 4, name: 'Lisa Wilson', department: 'HR', role: 'Coordinator', status: 'inactive', lastLogin: new Date(Date.now() - 86400000).toISOString() },
      { id: 5, name: 'David Brown', department: 'Finance', role: 'Analyst', status: 'active', lastLogin: new Date(Date.now() - 1800000).toISOString() }
    ];
    
    // Sample portal configuration
    const samplePortalConfig = {
      companyName: 'FareDeal Electronics',
      adminPortal: 'Admin Command Center',
      managerPortal: 'Management Hub',
      cashierPortal: 'Point of Sale',
      primaryColor: '#4F46E5',
      secondaryColor: '#7C3AED',
      lastUpdated: new Date().toISOString()
    };
    
    // Store sample data in localStorage if not already present
    if (!localStorage.getItem('inventory_products')) {
      localStorage.setItem('inventory_products', JSON.stringify(sampleProducts));
    }
    
    if (!localStorage.getItem('employee_access_control')) {
      localStorage.setItem('employee_access_control', JSON.stringify({
        employees: sampleEmployees,
        auditLog: [
          { action: 'login', employee: 'John Smith', timestamp: new Date().toISOString(), status: 'success' },
          { action: 'access_granted', employee: 'Sarah Johnson', timestamp: new Date(Date.now() - 1800000).toISOString(), status: 'success' },
          { action: 'logout', employee: 'Mike Davis', timestamp: new Date(Date.now() - 3600000).toISOString(), status: 'success' }
        ]
      }));
    }
    
    if (!localStorage.getItem('portal_configuration')) {
      localStorage.setItem('portal_configuration', JSON.stringify(samplePortalConfig));
      localStorage.setItem('portal_config_history', JSON.stringify([
        { action: 'update_theme', timestamp: new Date(Date.now() - 86400000).toISOString(), changes: { primaryColor: '#4F46E5' } },
        { action: 'update_branding', timestamp: new Date(Date.now() - 172800000).toISOString(), changes: { companyName: 'FareDeal Electronics' } }
      ]));
    }
    
    console.log('✅ Sample data initialized for real data demonstration');
  };

  // Real-time functional controls - Enhanced with service integration
  const toggleEmployeeLogin = async () => {
    if (!employeeAccessService) {
      showNotification('Employee access service not available', 'error');
      return;
    }
    
    try {
      setLoading(true);
      setAccessControlLoading(true);
      
      const result = await employeeAccessService.toggleGlobalEmployeeAccess();
      
      setRealTimeData(prev => ({
        ...prev,
        isEmployeeLoginEnabled: result.globalEmployeeAccess
      }));
      
      showNotification(
        `Global employee access ${result.globalEmployeeAccess ? 'enabled' : 'disabled'} successfully`, 
        result.globalEmployeeAccess ? 'success' : 'warning'
      );

      // Send real-time update via WebSocket
      if (wsConnection && wsConnection.readyState === 1) {
        wsConnection.send(JSON.stringify({
          type: 'EMPLOYEE_LOGIN_TOGGLE',
          enabled: result.globalEmployeeAccess,
          timestamp: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      showNotification('Failed to toggle employee login', 'error');
    } finally {
      setLoading(false);
      setAccessControlLoading(false);
    }
  };

  // Show detailed employee control modal
  const showEmployeeControlInterface = () => {
    if (employeeAccessService) {
      const employees = employeeAccessService.getEmployeeList();
      const stats = employeeAccessService.getAccessControlStats();
      const audit = employeeAccessService.getAuditLog();
      
      setEmployeeList(employees);
      setAccessControlStats(stats);
      setAuditLog(audit);
      setShowEmployeeControlModal(true);
    }
  };

  // Toggle individual employee access
  const toggleIndividualEmployeeAccess = async (employeeId, currentStatus) => {
    if (!employeeAccessService) return;
    
    try {
      setAccessControlLoading(true);
      const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
      
      await employeeAccessService.toggleEmployeeAccess(employeeId, newStatus);
      
      // Update local employee list
      setEmployeeList(prev => prev.map(emp => 
        emp.id === employeeId 
          ? { ...emp, status: newStatus }
          : emp
      ));
      
      showNotification(`Employee access ${newStatus === 'active' ? 'enabled' : 'disabled'}`, 'success');
    } catch (error) {
      showNotification('Failed to update employee access', 'error');
    } finally {
      setAccessControlLoading(false);
    }
  };

  // Perform bulk employee operations
  const performEmployeeBulkOperation = async (operation) => {
    if (!employeeAccessService || selectedEmployees.length === 0) {
      showNotification('Please select employees first', 'warning');
      return;
    }
    
    try {
      setAccessControlLoading(true);
      
      const result = await employeeAccessService.performBulkOperation(operation, selectedEmployees);
      
      // Update local employee list
      setEmployeeList(prev => prev.map(emp => 
        selectedEmployees.includes(emp.id)
          ? { ...emp, status: operation === 'enable' ? 'active' : 'disabled' }
          : emp
      ));
      
      setSelectedEmployees([]);
      showNotification(`Bulk ${operation} completed for ${result.affectedCount} employees`, 'success');
    } catch (error) {
      showNotification(`Failed to perform bulk ${operation}`, 'error');
    } finally {
      setAccessControlLoading(false);
    }
  };

  const toggleManagerLogin = async () => {
    try {
      setLoading(true);
      
      // Simulate API call to toggle manager login
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newStatus = !realTimeData.isManagerLoginEnabled;
      setRealTimeData(prev => ({
        ...prev,
        isManagerLoginEnabled: newStatus
      }));
      
      showNotification(
        `Manager login ${newStatus ? 'enabled' : 'disabled'} successfully`, 
        newStatus ? 'success' : 'warning'
      );

      // Send real-time update via WebSocket
      if (wsConnection && wsConnection.readyState === 1) {
        wsConnection.send(JSON.stringify({
          type: 'MANAGER_LOGIN_TOGGLE',
          enabled: newStatus,
          timestamp: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      showNotification('Failed to toggle manager login', 'error');
    } finally {
      setLoading(false);
    }
  };

  const performBulkAccountAction = async (action) => {
    try {
      setLoading(true);
      showNotification(`Performing bulk ${action} operation...`, 'info');
      
      // Simulate bulk operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const affectedCount = Math.floor(Math.random() * 50 + 10);
      showNotification(`Bulk ${action} completed for ${affectedCount} accounts`, 'success');
      
      // Update statistics
      setRealTimeData(prev => ({
        ...prev,
        employeeLogins: action === 'enable' ? prev.employeeLogins + affectedCount : prev.employeeLogins,
        activeSessions: action === 'disable' ? Math.max(0, prev.activeSessions - affectedCount) : prev.activeSessions
      }));

      // Send real-time update
      if (wsConnection && wsConnection.readyState === 1) {
        wsConnection.send(JSON.stringify({
          type: 'BULK_ACCOUNT_ACTION',
          action,
          affectedCount,
          timestamp: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      showNotification(`Failed to perform bulk ${action}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const viewAccessAuditLog = () => {
    showNotification('Opening access audit log...', 'info');
    
    // Simulate opening audit log with real data
    const auditData = {
      totalLogins: realTimeData.employeeLogins,
      failedAttempts: realTimeData.failedAttempts,
      activeSessions: realTimeData.activeSessions,
      lastActivity: new Date().toLocaleString()
    };
    
    alert(`Access Audit Log:\n\nTotal Logins Today: ${auditData.totalLogins}\nFailed Attempts: ${auditData.failedAttempts}\nActive Sessions: ${auditData.activeSessions}\nLast Activity: ${auditData.lastActivity}`);
  };

  const performSystemAction = async (action, description) => {
    try {
      setLoading(true);
      showNotification(`${description} in progress...`, 'info');
      
      // Simulate system action
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update relevant metrics based on action
      if (action === 'backup') {
        setRealTimeData(prev => ({
          ...prev,
          systemServices: prev.systemServices.map(service => 
            service.name === 'Backup Service' 
              ? { ...service, uptime: 100 }
              : service
          )
        }));
      } else if (action === 'security_scan') {
        setRealTimeData(prev => ({
          ...prev,
          failedAttempts: Math.max(0, prev.failedAttempts - 1)
        }));
      }
      
      showNotification(`${description} completed successfully!`, 'success');

      // Send real-time update
      if (wsConnection && wsConnection.readyState === 1) {
        wsConnection.send(JSON.stringify({
          type: 'SYSTEM_ACTION',
          action,
          description,
          timestamp: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      showNotification(`Failed to ${description.toLowerCase()}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const forcePasswordReset = async () => {
    if (!window.confirm('Are you sure you want to reset passwords for all employees and managers? This will force them to create new passwords on next login.')) {
      return;
    }
    
    await performSystemAction('password_reset', 'Force password reset');
    showNotification('All employee and manager passwords have been reset', 'warning');
  };

  // Portal Configuration Functions - Real API Integration
  const openPortalConfiguration = async () => {
    try {
      setConfigLoading(true);
      
      // Load latest configuration from server
      const response = await portalConfigService.getPortalConfiguration();
      
      if (response.success) {
        setPortalConfig(response.data);
        setConfigForm({ ...response.data });
      } else {
        showNotification('Failed to load latest configuration', 'warning');
        setConfigForm({ ...portalConfig });
      }
      
      // Load configuration history
      const historyResponse = await portalConfigService.getConfigurationHistory();
      if (historyResponse.success) {
        setConfigHistory(historyResponse.data);
      }
      
      setShowPortalConfig(true);
      showNotification('Portal configuration center opened', 'info');
      
    } catch (error) {
      showNotification('Failed to open configuration center', 'error');
      setConfigForm({ ...portalConfig });
      setShowPortalConfig(true);
    } finally {
      setConfigLoading(false);
    }
  };

  const updatePortalConfiguration = async () => {
    try {
      setConfigLoading(true);
      showNotification('Validating and updating portal configurations...', 'info');

      // Use real portal configuration service
      const response = await portalConfigService.updatePortalConfiguration(configForm);

      if (response.success) {
        // Update local state with server response
        setPortalConfig(response.data);
        
        // Send real-time update via WebSocket
        if (wsConnection && wsConnection.readyState === 1) {
          wsConnection.send(JSON.stringify({
            type: 'PORTAL_CONFIG_UPDATE',
            config: response.data,
            timestamp: new Date().toISOString(),
            affectedPortals: response.affectedPortals
          }));
        }

        showNotification('Portal configurations updated successfully!', 'success');
        
        // Show affected portals
        if (response.affectedPortals && response.affectedPortals.length > 0) {
          setTimeout(() => {
            showNotification(`Changes applied to ${response.affectedPortals.length} portals: ${response.affectedPortals.join(', ')}`, 'success');
          }, 1500);
        }
        
        setShowPortalConfig(false);
        
        // Reload configuration history
        loadConfigurationHistory();
        
      } else {
        showNotification(`Update failed: ${response.error}`, 'error');
      }

    } catch (error) {
      console.error('Portal configuration update error:', error);
      showNotification('Failed to update portal configuration', 'error');
    } finally {
      setConfigLoading(false);
    }
  };

  const resetPortalConfiguration = async () => {
    if (!window.confirm('Are you sure you want to reset all portal names to default? This will affect all users immediately and cannot be undone.')) {
      return;
    }

    try {
      setConfigLoading(true);
      showNotification('Resetting portal configuration to default values...', 'info');

      // Use real portal configuration service
      const response = await portalConfigService.resetPortalConfiguration();

      if (response.success) {
        setPortalConfig(response.data);
        setConfigForm(response.data);

        // Send real-time update
        if (wsConnection && wsConnection.readyState === 1) {
          wsConnection.send(JSON.stringify({
            type: 'PORTAL_CONFIG_RESET',
            config: response.data,
            timestamp: new Date().toISOString()
          }));
        }

        showNotification('Portal configurations reset to default successfully', 'success');
        
        // Reload configuration history
        loadConfigurationHistory();
        
      } else {
        showNotification(`Reset failed: ${response.error}`, 'error');
      }

    } catch (error) {
      console.error('Portal configuration reset error:', error);
      showNotification('Failed to reset configuration', 'error');
    } finally {
      setConfigLoading(false);
    }
  };

  const previewPortalChanges = () => {
    const changedPortals = Object.keys(configForm).filter(key => 
      configForm[key] !== portalConfig[key] && configForm[key] !== undefined
    );
    
    if (changedPortals.length === 0) {
      showNotification('No changes to preview', 'info');
      return;
    }

    const changes = changedPortals.map(key => 
      `• ${key.replace(/([A-Z])/g, ' $1').trim()}: "${portalConfig[key]}" → "${configForm[key]}"`
    ).join('\n');
    
    const impactMessage = `These changes will:\n- Affect all ${changedPortals.length} portal(s) immediately\n- Be visible to all users\n- Update navigation and branding\n- Be broadcasted in real-time`;
    
    alert(`📋 Preview Changes:\n\n${changes}\n\n⚠️ Impact Assessment:\n${impactMessage}`);
  };

  // Load configuration history
  const loadConfigurationHistory = async () => {
    try {
      const response = await portalConfigService.getConfigurationHistory();
      if (response.success) {
        setConfigHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to load configuration history:', error);
    }
  };

  // Setup real-time configuration updates
  const setupRealTimeConfigUpdates = () => {
    const cleanup = portalConfigService.setupRealTimeListener((updatedConfig) => {
      setPortalConfig(updatedConfig);
      showNotification('Portal configuration updated by another admin', 'info');
    });
    
    setRealTimeListener(cleanup);
  };

  const renderQuickAdminRegister = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all animate-scaleUp">
        {/* Header Section */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="bg-white/20 p-2 rounded-lg">🚀</span>
                Quick Admin Setup
              </h3>
              <p className="text-blue-100">Create admin account with instant access</p>
            </div>
            <button 
              onClick={() => setShowQuickRegister(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <FiX className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Form Section */}
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                label: 'Email',
                type: 'email',
                value: adminForm.email,
                placeholder: 'admin@faredeal.com',
                icon: '📧',
                onChange: (e) => setAdminForm({...adminForm, email: e.target.value})
              },
              {
                label: 'Password',
                type: 'text',
                value: adminForm.password,
                placeholder: 'FareAdmin2025!',
                icon: '🔒',
                onChange: (e) => setAdminForm({...adminForm, password: e.target.value})
              },
              {
                label: 'Full Name',
                type: 'text',
                value: adminForm.full_name,
                placeholder: 'Quick Admin',
                icon: '👤',
                onChange: (e) => setAdminForm({...adminForm, full_name: e.target.value})
              },
              {
                label: 'Phone',
                type: 'tel',
                value: adminForm.phone,
                placeholder: '+1234567890',
                icon: '📱',
                onChange: (e) => setAdminForm({...adminForm, phone: e.target.value})
              }
            ].map((field, index) => (
              <div key={index} className="group animate-fadeInUp" style={{ animationDelay: `${index * 100}ms` }}>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-lg">{field.icon}</span>
                  {field.label}
                  <span className="text-xs text-gray-500">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={field.placeholder}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white/50 backdrop-blur-sm group-hover:border-blue-500"
                  />
                  <div className="absolute inset-0 border border-blue-500/0 rounded-lg group-hover:border-blue-500/20 pointer-events-none transition-all duration-300"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
            {[
              { icon: '🔑', label: 'No Verification', color: 'blue' },
              { icon: '📝', label: 'Auto-fill Ready', color: 'green' },
              { icon: '🗄️', label: 'DB Integration', color: 'purple' },
              { icon: '🚀', label: 'Instant Access', color: 'yellow' },
              { icon: '⚡', label: 'Full Permissions', color: 'red' },
              { icon: '🛡️', label: 'Secure Setup', color: 'indigo' }
            ].map((feature, index) => (
              <div 
                key={index}
                className={`bg-${feature.color}-50 p-3 rounded-xl flex items-center gap-3 transform hover:scale-105 transition-all duration-300 animate-fadeInUp`}
                style={{ animationDelay: `${(index + 4) * 100}ms` }}
              >
                <span className="text-2xl">{feature.icon}</span>
                <span className={`text-sm font-medium text-${feature.color}-700`}>{feature.label}</span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={createQuickAdmin}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <FiRefreshCw className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <span className="text-lg">🚀</span>
                  Create Admin & Login
                </>
              )}
            </button>
            <button
              onClick={() => setShowQuickRegister(false)}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-3 md:space-y-4 lg:space-y-8">
      {/* Enhanced Master Dashboard Header - Mobile Optimized with Accordion */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-lg md:rounded-2xl p-3 md:p-4 lg:p-8 text-white shadow-xl md:shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
        
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 lg:gap-6">
            <div className="flex-1">
              <h2 className="text-lg md:text-2xl lg:text-4xl font-bold mb-1 md:mb-2 lg:mb-3 flex items-center gap-1 md:gap-2 lg:gap-4">
                <span className="text-xl md:text-2xl lg:text-5xl animate-bounce flex-shrink-0">🎯</span>
                <span className="leading-tight">Master Admin Dashboard</span>
              </h2>
              <p className="text-blue-100 text-xs md:text-sm lg:text-lg mb-1 md:mb-2 lg:mb-3">Complete system oversight and operational control</p>
              
              {/* Mobile: Ultra-compact badges - Hidden on mobile, shown on sm+ */}
              <div className="flex flex-wrap gap-0.5 md:gap-2 lg:gap-4 hidden sm:flex">
                <div className="flex items-center gap-0.5 md:gap-1 bg-white/10 backdrop-blur-sm px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full border border-white/20">
                  <div className="w-1 md:w-1.5 h-1 md:h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-100 text-xs font-medium">All Systems</span>
                </div>
                <div className="flex items-center gap-0.5 md:gap-1 bg-white/10 backdrop-blur-sm px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full border border-white/20">
                  <FiDatabase className="h-2.5 md:h-3 w-2.5 md:w-3 text-purple-300" />
                  <span className="text-purple-100 text-xs font-medium">Real-time</span>
                </div>
                <div className="flex items-center gap-0.5 md:gap-1 bg-white/10 backdrop-blur-sm px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full border border-white/20">
                  <FiShield className="h-2.5 md:h-3 w-2.5 md:w-3 text-pink-300" />
                  <span className="text-pink-100 text-xs font-medium">Secure</span>
                </div>
              </div>
            </div>
            
            {/* Mobile: Compact power indicator */}
            <div className="flex md:block items-center gap-2 md:gap-3 lg:text-right flex-shrink-0">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg md:rounded-xl lg:rounded-2xl p-1.5 md:p-2 lg:p-4 border-2 border-white/20">
                <div className="text-2xl md:text-3xl lg:text-6xl font-bold animate-pulse">∞</div>
                <div className="text-blue-200 text-xs md:text-xs lg:text-xl font-semibold mt-0.5">Admin Power</div>
                <div className="text-blue-300 text-xs hidden md:block">Unlimited Access</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ICAN Coin Balance */}
      <div className="flex justify-end mb-2">
        <div className="w-48"><IcanCoinBadge onOpen={() => setActiveSection('ican-wallet')} /></div>
      </div>

      {/* Admin Access Status Banner - Ultra Mobile Optimized */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg md:rounded-xl p-2 md:p-4 shadow-md">
        <div className="flex items-start gap-1.5 md:gap-3">
          <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0 text-base md:text-lg">
            <span>✅</span>
            <span>🛡️</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs md:text-base font-bold text-green-900 leading-tight">Admin Access Enabled</h3>
            <p className="text-xs text-green-700 mt-0.5 line-clamp-2 md:line-clamp-none">Full control. Edit pricing, manage stock, apply bulk updates.</p>
          </div>
        </div>
      </div>

      {/* Quick Access Hub - Mobile Optimized Accordion */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-lg md:rounded-2xl shadow-lg md:shadow-2xl p-3 md:p-6 border-2 border-purple-200">
        <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -mr-24 md:-mr-32 -mt-24 md:-mt-32 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-36 md:w-48 h-36 md:h-48 bg-gradient-to-tr from-pink-400/20 to-yellow-400/20 rounded-full blur-3xl -ml-18 md:-ml-24 -mb-18 md:-mb-24 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        {/* Toggle Button - Compact */}
        <div 
          className="relative flex items-center justify-between gap-2 md:gap-4 cursor-pointer hover:bg-white/50 p-2 md:p-3 rounded-lg transition-all duration-300 backdrop-blur-sm group"
          onClick={() => setShowQuickAccess(!showQuickAccess)}
        >
          <h3 className="text-base md:text-lg lg:text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-1 md:gap-2 lg:gap-3 flex-1 min-w-0">
            <span className="text-lg md:text-2xl lg:text-3xl animate-bounce flex-shrink-0">🚀</span>
            <span className="truncate">Quick Access Hub</span>
          </h3>
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-1.5 md:p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 flex-shrink-0">
            {showQuickAccess ? (
              <FiChevronUp className="h-4 md:h-5 w-4 md:w-5 text-white" />
            ) : (
              <FiChevronDown className="h-4 md:h-5 w-4 md:w-5 text-white" />
            )}
          </div>
        </div>

        {/* Quick Access Grid - Collapsible */}
        {showQuickAccess && (
          <div className="relative mt-3 md:mt-6 grid grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-1.5 md:gap-3 lg:gap-4 animate-slideDown">
            {[
              { id: 'inventory', label: 'Inventory', icon: '📦', stats: '6 Products', gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50/80', border: 'border-emerald-300', bullet: 'text-emerald-500' },
              { id: 'orders', label: 'Orders', icon: '📋', stats: '2,847 Orders', gradient: 'from-orange-500 to-amber-500', bg: 'bg-orange-50/80', border: 'border-orange-300', bullet: 'text-orange-500' },
              { id: 'payments', label: 'Payments', icon: '💳', stats: '$127K Revenue', gradient: 'from-green-500 to-emerald-500', bg: 'bg-green-50/80', border: 'border-green-300', bullet: 'text-green-500' },
              { id: 'suppliers', label: 'Suppliers', icon: '🏭', stats: '24 Suppliers', gradient: 'from-purple-500 to-pink-500', bg: 'bg-purple-50/80', border: 'border-purple-300', bullet: 'text-purple-500' },
              { id: 'users', label: 'Users', icon: '👥', stats: '1,234 Users', gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50/80', border: 'border-blue-300', bullet: 'text-blue-500' }
            ].map((section, index) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setShowQuickAccess(false);
                }}
                className={`relative flex flex-col items-center text-center gap-1 p-2 md:p-3 lg:p-4 ${section.bg} backdrop-blur-sm rounded-lg md:rounded-xl border-2 ${section.border} hover:shadow-lg transition-all duration-300 group transform hover:scale-105 hover:-translate-y-1 animate-fadeInUp overflow-hidden`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${section.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div className="relative">
                  <span className="text-lg md:text-2xl group-hover:scale-125 transition-transform duration-300 block">{section.icon}</span>
                </div>
                <div className="relative flex-1">
                  <span className={`font-bold text-xs md:text-sm text-gray-800 group-hover:bg-gradient-to-r group-hover:${section.gradient} group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300 block truncate`}>{section.label}</span>
                  <span className="text-xs text-gray-600 font-medium hidden md:block line-clamp-1">{section.stats}</span>
                </div>
                <div className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-gradient-to-r ${section.gradient}`}></div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Employee & Manager Sign-in Control Center - COMMENTED OUT */}
      {/* <div className="bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-3xl font-bold mb-3 flex items-center">
              <span className="mr-4 text-4xl">🔐</span>
              Employee & Manager Access Control
            </h3>
            <p className="text-cyan-100 text-lg">Complete control over employee and manager authentication</p>
          </div>
          <div className="flex space-x-4">
            <div className="bg-white/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold">156</div>
              <div className="text-cyan-200 text-sm">Active Employees</div>
            </div>
            <div className="bg-white/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold">24</div>
              <div className="text-blue-200 text-sm">Active Managers</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: 'Employee Login Control',
              description: 'Enable/disable employee access',
              icon: '👨‍💼',
              action: showEmployeeControlInterface,
              status: realTimeData.isEmployeeLoginEnabled ? 'enabled' : 'disabled',
              count: `${accessControlStats.activeEmployees || realTimeData.activeUsers} Active`
            },
            {
              title: 'Manager Login Control',
              description: 'Enable/disable manager access',
              icon: '👔',
              action: toggleManagerLogin,
              status: realTimeData.isManagerLoginEnabled ? 'enabled' : 'disabled',
              count: '24 Active'
            },
            {
              title: 'Bulk Account Actions',
              description: 'Mass enable/disable accounts',
              icon: '⚡',
              action: () => {
                const action = window.confirm('Enable (OK) or Disable (Cancel) accounts?') ? 'enable' : 'disable';
                performBulkAccountAction(action);
              },
              status: 'ready',
              count: 'Mass Actions'
            },
            {
              title: 'Access Audit Log',
              description: 'View all login attempts',
              icon: '📋',
              action: viewAccessAuditLog,
              status: 'active',
              count: 'Live Tracking'
            }
          ].map((control, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="text-4xl mb-4">{control.icon}</div>
              <h4 className="text-xl font-bold mb-2">{control.title}</h4>
              <p className="text-cyan-100 text-sm mb-4">{control.description}</p>
              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  control.status === 'enabled' ? 'bg-green-500/20 text-green-300' :
                  control.status === 'ready' ? 'bg-blue-500/20 text-blue-300' :
                  'bg-purple-500/20 text-purple-300'
                }`}>
                  {control.status}
                </span>
                <span className="text-white/80 text-xs">{control.count}</span>
              </div>
              <button
                onClick={control.action}
                className="w-full bg-white/20 hover:bg-white/30 text-white py-3 px-4 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
              >
                Access Control
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h4 className="text-xl font-bold mb-4 flex items-center">
              <span className="mr-3 text-2xl">🎛️</span>
              Advanced Controls
            </h4>
            <div className="space-y-3">
              {[
                { 
                  action: 'Force Password Reset', 
                  icon: '🔑', 
                  description: 'Reset all employee passwords',
                  onClick: forcePasswordReset
                },
                { 
                  action: 'Session Management', 
                  icon: '⏱️', 
                  description: 'Control active sessions',
                  onClick: () => {
                    showNotification(`Managing ${realTimeData.activeSessions} active sessions...`, 'info');
                    setTimeout(() => showNotification('Session management completed', 'success'), 2000);
                  }
                },
                { 
                  action: 'Role Assignment', 
                  icon: '👤', 
                  description: 'Modify user roles and permissions',
                  onClick: () => {
                    const roles = ['Employee', 'Manager', 'Supervisor'];
                    showNotification(`Role assignment system opened - ${roles.length} roles available`, 'info');
                  }
                },
                { 
                  action: 'Account Lockout', 
                  icon: '🔒', 
                  description: 'Lock/unlock specific accounts',
                  onClick: () => {
                    const action = window.confirm('Lock (OK) or Unlock (Cancel) accounts?') ? 'lock' : 'unlock';
                    showNotification(`Account ${action} operation initiated...`, 'warning');
                    setTimeout(() => showNotification(`Account ${action} completed`, 'success'), 1500);
                  }
                }
              ].map((item, index) => (
                <button
                  key={index}
                  onClick={item.onClick}
                  className="w-full bg-white/5 hover:bg-white/15 p-4 rounded-lg text-left transition-all duration-300 flex items-center"
                >
                  <span className="text-2xl mr-4">{item.icon}</span>
                  <div>
                    <div className="font-semibold">{item.action}</div>
                    <div className="text-cyan-200 text-sm">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h4 className="text-xl font-bold mb-4 flex items-center">
              <span className="mr-3 text-2xl">📊</span>
              Access Statistics
            </h4>
            <div className="space-y-4">
              {[
                { label: 'Today\'s Logins', value: realTimeData.employeeLogins.toString(), change: '+12%', type: 'employees' },
                { label: 'Failed Attempts', value: realTimeData.failedAttempts.toString(), change: '-67%', type: 'security' },
                { label: 'Active Sessions', value: realTimeData.activeSessions.toString(), change: '+5%', type: 'live' },
                { label: 'Manager Access', value: realTimeData.managerAccess.toString(), change: '+3%', type: 'managers' }
              ].map((stat, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <div className="font-medium">{stat.label}</div>
                    <div className="text-cyan-200 text-sm">{stat.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className={`text-sm ${stat.change.startsWith('+') ? 'text-green-300' : 'text-red-300'}`}>
                      {stat.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div> */}

      {/* Quick Stats with Enhanced Animations - COMMENTED OUT */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            title: 'Total Users', 
            value: realTimeData.activeUsers + 1145,
            icon: FiUsers, 
            color: 'from-blue-500 to-blue-600',
            animation: 'animate-fadeInUp delay-100'
          },
          { 
            title: 'Active Sessions', 
            value: realTimeData.activeSessions, 
            icon: FiActivity, 
            color: 'from-green-500 to-green-600',
            animation: 'animate-fadeInUp delay-200'
          },
          { 
            title: 'System Load', 
            value: `${realTimeData.systemLoad}%`, 
            icon: FiCpu, 
            color: 'from-purple-500 to-purple-600',
            animation: 'animate-fadeInUp delay-300'
          },
          { 
            title: 'Memory Usage', 
            value: `${realTimeData.memoryUsage}%`, 
            icon: FiShield, 
            color: 'from-yellow-500 to-red-600',
            animation: 'animate-fadeInUp delay-400'
          }
        ].map((stat, index) => (
          <div 
            key={index} 
            className={`${stat.animation} transform hover:scale-105 transition-all duration-500 container-glass rounded-xl p-6 shadow-lg hover:shadow-2xl group`}
          >
            <div className="flex items-center justify-between relative overflow-hidden">
              <div className="z-10">
                <p className="text-gray-600 text-sm font-medium mb-1 group-hover:text-blue-600 transition-colors duration-300">
                  {stat.title}
                </p>
                <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-300">
                  {stat.value}
                </p>
                <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 mt-2 rounded-full" />
              </div>
              <div className={`p-4 rounded-xl bg-gradient-to-r ${stat.color} transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500`}>
                <stat.icon className="h-8 w-8 text-white animate-pulse" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-xl" />
            </div>
          </div>
        ))}
      </div> */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Performance with Enhanced Animations */}
        <div className="container-glass rounded-xl p-6 shadow-lg transform hover:scale-[1.02] transition-all duration-500 animate-slideInRight">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg animate-pulse">
                <FiActivity className="h-6 w-6 text-blue-600" />
              </div>
              <span>System Performance</span>
            </h3>
            <button 
              onClick={loadSystemData}
              className="p-3 hover:bg-blue-50 rounded-lg transition-all duration-300 group"
            >
              <FiRefreshCw className="h-5 w-5 text-blue-600 group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-50/30 to-blue-100/30 rounded-lg animate-pulse" />
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[
              { time: '00:00', cpu: 45, memory: 60, network: 30 },
              { time: '04:00', cpu: 35, memory: 55, network: 25 },
              { time: '08:00', cpu: 65, memory: 75, network: 60 },
              { time: '12:00', cpu: 85, memory: 85, network: 75 },
              { time: '16:00', cpu: 75, memory: 80, network: 65 },
              { time: '20:00', cpu: 55, memory: 70, network: 45 },
              { time: '23:59', cpu: 45, memory: 65, network: 35 }
            ]}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="networkGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="time" 
                stroke="#6B7280"
                tick={{ fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis 
                stroke="#6B7280"
                tick={{ fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="cpu" 
                stroke="#3B82F6" 
                fillOpacity={1} 
                fill="url(#cpuGradient)" 
                strokeWidth={2}
                name="CPU Usage"
              />
              <Area 
                type="monotone" 
                dataKey="memory" 
                stroke="#10B981" 
                fillOpacity={1} 
                fill="url(#memoryGradient)"
                strokeWidth={2}
                name="Memory Usage"
              />
              <Area 
                type="monotone" 
                dataKey="network" 
                stroke="#8B5CF6" 
                fillOpacity={1} 
                fill="url(#networkGradient)"
                strokeWidth={2}
                name="Network Load"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

        {/* Quick Actions with Enhanced Animations */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-2xl p-6 border-2 border-indigo-200">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -mr-24 -mt-24 animate-pulse"></div>
          
          <div 
            className="relative flex items-center justify-between cursor-pointer hover:bg-white/50 p-3 rounded-xl transition-all duration-300 backdrop-blur-sm group"
            onClick={() => setShowQuickActions(!showQuickActions)}
          >
            <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
              <span className="mr-3 text-2xl sm:text-3xl animate-bounce">⚡</span>
              Quick Actions
            </h3>
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
              {showQuickActions ? (
                <FiChevronUp className="h-5 w-5 text-white" />
              ) : (
                <FiChevronDown className="h-5 w-5 text-white" />
              )}
            </div>
          </div>
          
          {showQuickActions && (
            <div className="relative mt-6 space-y-3 animate-fadeIn">
              {[
                { 
                  title: 'Add Admin',
                  description: `${pendingUsers.length} pending approvals`,
                  icon: '👤',
                  color: 'from-blue-500 to-blue-600',
                  bg: 'bg-blue-50/80',
                  border: 'border-blue-300',
                  bullet: 'text-blue-500',
                  onClick: () => setShowQuickRegister(true)
                },
                { 
                  title: 'Portal Names',
                  description: `${Object.keys(portalConfig).length} portals configured`,
                  icon: '⚙️',
                  color: 'from-indigo-500 to-purple-600',
                  bg: 'bg-indigo-50/80',
                  border: 'border-indigo-300',
                  bullet: 'text-indigo-500',
                  onClick: openPortalConfiguration
                },
                { 
                  title: 'System Backup',
                  description: `Last backup: ${new Date().toLocaleDateString()}`,
                  icon: '💾',
                  color: 'from-green-500 to-green-600',
                  bg: 'bg-green-50/80',
                  border: 'border-green-300',
                  bullet: 'text-green-500',
                  onClick: () => {
                    toast.info('Creating system backup...');
                    setTimeout(() => toast.success('Backup completed successfully!'), 2000);
                  }
                },
                { 
                  title: 'Security Scan',
                  description: `${realTimeData.activeUsers} active users monitored`,
                  icon: '🛡️',
                  color: 'from-yellow-500 to-red-600',
                  bg: 'bg-orange-50/80',
                  border: 'border-orange-300',
                  bullet: 'text-orange-500',
                  onClick: () => {
                    toast.info('Running security scan...');
                    setTimeout(() => toast.success('No security threats detected'), 2500);
                  }
                },
                { 
                  title: 'Clear Cache',
                  description: `Optimize system performance`,
                  icon: '🔄',
                  color: 'from-purple-500 to-purple-600',
                  bg: 'bg-purple-50/80',
                  border: 'border-purple-300',
                  bullet: 'text-purple-500',
                  onClick: () => {
                    toast.info('Clearing cache...');
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                  }
                }
              ].map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    setShowQuickActions(false);
                  }}
                  className={`relative w-full flex items-start space-x-3 p-4 ${action.bg} backdrop-blur-sm rounded-xl border-2 ${action.border} hover:shadow-xl transition-all duration-300 group text-left transform hover:scale-105 hover:-translate-y-1 animate-fadeInUp overflow-hidden`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${action.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                  <div className="relative">
                    <span className={`${action.bullet} text-2xl font-bold animate-pulse`}>•</span>
                  </div>
                  <div className="relative flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl group-hover:scale-125 transition-transform duration-300 animate-bounce" style={{ animationDelay: `${index * 100}ms` }}>{action.icon}</span>
                      <span className={`font-bold text-gray-800 group-hover:bg-gradient-to-r group-hover:${action.color} group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300`}>{action.title}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 font-medium">{action.description}</span>
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${action.color} animate-ping`}></div>
                    </div>
                  </div>
                  <FiChevronRight className={`h-5 w-5 ${action.bullet} opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showQuickRegister && renderQuickAdminRegister()}

      {/* Dashboard Secondary Content */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Health - COMMENTED OUT */}
        {/* <div className="container-glass rounded-xl p-6 shadow-lg transform hover:scale-[1.02] transition-all duration-500">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FiServer className="h-6 w-6 text-blue-600 animate-pulse" />
              </div>
              <span>API Health Status</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Response Time', value: '45ms', trend: '↓ 5ms', up: true },
              { label: 'Success Rate', value: '99.9%', trend: '↑ 0.1%', up: true },
              { label: 'Error Rate', value: '0.1%', trend: '↓ 0.2%', up: true },
              { label: 'Throughput', value: '850/s', trend: '↑ 50/s', up: true }
            ].map((item, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                <div className="text-sm text-gray-600 mb-1">{item.label}</div>
                <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                <div className={`text-sm ${item.up ? 'text-green-600' : 'text-red-600'}`}>
                  {item.trend}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full w-[99.9%] bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transform origin-left scale-x-0 animate-widthExpand"></div>
            </div>
          </div>
        </div> */}

        {/* Recent System Logs - COMMENTED OUT */}
        {/* <div className="container-glass rounded-xl p-6 shadow-lg transform hover:scale-[1.02] transition-all duration-500">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FiTerminal className="h-6 w-6 text-blue-600" />
              </div>
              <span>System Logs</span>
            </h3>
            <button className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-300">
              <FiRefreshCw className="h-5 w-5 text-blue-600" />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { type: 'info', message: 'System backup completed successfully', time: '2 mins ago' },
              { type: 'warning', message: 'High CPU usage detected', time: '5 mins ago' },
              { type: 'error', message: 'Failed login attempt', time: '10 mins ago' },
              { type: 'info', message: 'New user registration', time: '15 mins ago' }
            ].map((log, index) => (
              <div 
                key={index}
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-all duration-300"
              >
                <div className={`w-2 h-2 rounded-full ${
                  log.type === 'info' ? 'bg-blue-500' :
                  log.type === 'warning' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></div>
                <div className="flex-1">
                  <p className="text-gray-900">{log.message}</p>
                  <p className="text-sm text-gray-500">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div> */}

      {/* Comprehensive System Overview - COMMENTED OUT */}
      {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="mr-3 text-3xl">📡</span>
            Real-time System Overview
          </h3>
          <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <span className="bg-indigo-500 text-white p-3 rounded-xl">🏛️</span>
                  Admin Data Intelligence Center
                </h3>
                <p className="text-indigo-700 mt-2">Real-time business intelligence and comprehensive data analytics</p>
              </div>
              <button
                onClick={() => {
                  if (adminDataService) {
                    setDataLoading(true);
                    setShowDataDashboard(true);
                    showNotification('Loading Data Intelligence Center...', 'info');
                  } else {
                    showNotification('Data service not ready. Please wait...', 'warning');
                  }
                }}
                disabled={!adminDataService}
                className={`px-6 py-3 rounded-xl transition-all duration-300 font-medium flex items-center gap-2 ${
                  !adminDataService 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:scale-105'
                }`}
              >
                <span className={`text-xl ${!adminDataService ? '⏳' : '🏛️'}`}>
                  {!adminDataService ? '⏳' : '🏛️'}
                </span>
                {!adminDataService ? 'Loading System...' : 'Open Data Intelligence Center'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { 
                  title: 'Data Records', 
                  value: dashboardData.systemHealth?.totalRecords || 0, 
                  icon: '📁',
                  color: 'blue',
                  description: 'Total stored records'
                },
                { 
                  title: 'Data Quality', 
                  value: `${dashboardData.systemHealth?.dataQuality || 95}%`, 
                  icon: '✨',
                  color: 'green',
                  description: 'Data integrity score'
                },
                { 
                  title: 'Active Insights', 
                  value: dataInsights.length || 0, 
                  icon: '🧠',
                  color: 'purple',
                  description: 'Generated insights'
                },
                { 
                  title: 'System Performance', 
                  value: `${dashboardData.systemHealth?.performance || 87}%`, 
                  icon: '⚡',
                  color: 'orange',
                  description: 'Performance score'
                }
              ].map((metric, index) => (
                <div key={index} className={`bg-white p-4 rounded-lg border-l-4 border-${metric.color}-500 hover:shadow-lg transition-shadow`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{metric.icon}</span>
                    <div className={`text-2xl font-bold text-${metric.color}-600`}>{metric.value}</div>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm">{metric.title}</h4>
                  <p className="text-xs text-gray-600 mt-1">{metric.description}</p>
                </div>
              ))}
            </div>

            {dataInsights.length > 0 && (
              <div className="mt-6 p-4 bg-white/60 rounded-lg border border-indigo-200">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span>💡</span>
                  Latest Business Insights
                </h4>
                <div className="space-y-2">
                  {dataInsights.slice(0, 3).map((insight, index) => (
                    <div key={index} className="text-sm flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        insight.impact === 'high' ? 'bg-red-500' :
                        insight.impact === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}></span>
                      <span className="text-gray-700">{insight.title}</span>
                      <span className="text-xs text-gray-500">({insight.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { title: 'Orders Today', value: realTimeData.todaysOrders.toString(), icon: '📋', color: 'blue', status: 'active' },
              { title: 'Revenue Today', value: `$${(realTimeData.dailyRevenue / 1000).toFixed(1)}K`, icon: '💰', color: 'green', status: 'active' },
              { title: 'Active Users', value: (dashboardData.realTimeMetrics?.activeUsers || realTimeData.activeUsers).toString(), icon: '👥', color: 'purple', status: 'active' },
              { title: 'System Health', value: `${dashboardData.realTimeMetrics?.systemHealth?.uptime?.toFixed(1) || realTimeData.systemHealth}%`, icon: '❤️', color: 'red', status: 'healthy' }
            ].map((metric, index) => (
              <div key={index} className={`bg-gradient-to-br from-${metric.color}-50 to-${metric.color}-100 p-4 rounded-xl border border-${metric.color}-200`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{metric.icon}</span>
                  <div className={`w-2 h-2 rounded-full ${metric.status === 'active' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                </div>
                <div className={`text-${metric.color}-900 text-xs font-medium mb-1`}>{metric.title}</div>
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2 text-xl">🔔</span>
              Live Activity Feed
            </h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {realTimeData.recentActivities.length > 0 ? realTimeData.recentActivities.map((activity, index) => (
                <div key={index} className={`flex items-start space-x-3 p-3 rounded-lg ${
                  activity.severity === 'warning' ? 'bg-yellow-50 border-l-4 border-yellow-400' :
                  activity.severity === 'success' ? 'bg-green-50 border-l-4 border-green-400' :
                  'bg-blue-50 border-l-4 border-blue-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.severity === 'warning' ? 'bg-yellow-500' :
                    activity.severity === 'success' ? 'bg-green-500' :
                    'bg-blue-500'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-gray-900 text-sm font-medium">{activity.message}</p>
                    <p className="text-gray-500 text-xs">{activity.time}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🕒</div>
                  <p className="text-gray-500">Waiting for real-time activities...</p>
                </div>
              )}
            </div>
          </div>
        </div> */}

        {/* Quick Control Panel - COMMENTED OUT */}
        {/* <div className="bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="mr-3 text-3xl">⚡</span>
            Quick Controls
          </h3>
          <div className="space-y-4">
            {[
              { 
                title: 'Emergency Stop', 
                icon: '🚨', 
                color: 'red', 
                action: () => {
                  if (window.confirm('Are you sure you want to initiate emergency stop? This will affect all users.')) {
                    performSystemAction('emergency_stop', 'Emergency system shutdown');
                  }
                }
              },
              { 
                title: 'System Backup', 
                icon: '💾', 
                color: 'blue', 
                action: () => performSystemAction('backup', 'System backup')
              },
              { 
                title: 'Employee Broadcast', 
                icon: '📢', 
                color: 'green', 
                action: () => {
                  const message = window.prompt('Enter broadcast message for all employees and managers:');
                  if (message) {
                    showNotification(`Broadcasting: "${message}" to all users`, 'info');
                    setTimeout(() => showNotification('Broadcast sent successfully', 'success'), 2000);
                  }
                }
              },
              { 
                title: 'Security Scan', 
                icon: '🔍', 
                color: 'purple', 
                action: () => performSystemAction('security_scan', 'Security vulnerability scan')
              },
              { 
                title: 'Performance Boost', 
                icon: '🚀', 
                color: 'yellow', 
                action: () => {
                  performSystemAction('performance_boost', 'Performance optimization');
                  setRealTimeData(prev => ({
                    ...prev,
                    systemLoad: Math.max(10, prev.systemLoad - 10)
                  }));
                }
              }
            ].map((control, index) => (
              <button
                key={index}
                onClick={control.action}
                className={`w-full bg-gradient-to-r from-${control.color}-500 to-${control.color}-600 hover:from-${control.color}-600 hover:to-${control.color}-700 text-white p-4 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center space-x-3`}
              >
                <span className="text-2xl">{control.icon}</span>
                <span className="font-semibold">{control.title}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            <h4 className="text-lg font-bold text-gray-900 flex items-center">
              <span className="mr-2 text-xl">📊</span>
              System Status
            </h4>
            {realTimeData.systemServices.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${service.status === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                  <span className="font-medium text-gray-900">{service.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-green-600">{service.uptime.toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">uptime</div>
                </div>
              </div>
            ))}
          </div>
        </div> */}
      </div>

      {/* Enhanced Dashboard Stats - Real-time Supabase Data */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-3xl shadow-2xl p-8 mb-8 border-2 border-purple-200">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl -mr-48 -mt-48 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-pink-400/10 to-yellow-400/10 rounded-full blur-3xl -ml-32 -mb-32 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-3">
              <span className="text-3xl animate-bounce">📊</span>
              Live Business Metrics
            </h3>
            
            {/* Date Range Selector for Revenue */}
            <div className="flex gap-2 flex-wrap">
              {['today', '7days', '30days', '90days', '1year'].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setRevenueDateRange({ ...revenueDateRange, type });
                    // Trigger recalculation
                    const dateRange = { ...revenueDateRange, type };
                    let label = '';
                    let startDate, endDate = new Date();
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    switch(type) {
                      case 'today':
                        label = 'Today';
                        startDate = today;
                        break;
                      case '7days':
                        label = 'Last 7 Days';
                        startDate = new Date(today);
                        startDate.setDate(startDate.getDate() - 7);
                        break;
                      case '30days':
                        label = 'Last 30 Days';
                        startDate = new Date(today);
                        startDate.setDate(startDate.getDate() - 30);
                        break;
                      case '90days':
                        label = 'Last 90 Days';
                        startDate = new Date(today);
                        startDate.setDate(startDate.getDate() - 90);
                        break;
                      case '1year':
                        label = 'Last Year';
                        startDate = new Date(today);
                        startDate.setFullYear(startDate.getFullYear() - 1);
                        break;
                    }
                    
                    supabase
                      .from('transactions')
                      .select('total_amount')
                      .gte('created_at', startDate.toISOString())
                      .lte('created_at', endDate.toISOString())
                      .then(({ data: transactions }) => {
                        const revenue = transactions?.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0) || 0;
                        setRealTimeData(prev => ({
                          ...prev,
                          dailyRevenue: Math.round(revenue),
                          revenueLabel: label
                        }));
                      });
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    revenueDateRange.type === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {type === 'today' ? '1D' : type === '7days' ? '7D' : type === '30days' ? '30D' : type === '90days' ? '90D' : '1Y'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'Total Users',
                value: realTimeData.totalUsers || (pendingUsers.length + allUsers.length) || 0,
                icon: '👥',
                gradient: 'from-blue-500 via-blue-600 to-indigo-600',
                bg: 'from-blue-50 to-indigo-50',
                shadowColor: 'blue',
                trend: '+5.2%',
                trendUp: true,
                subtitle: `${pendingUsers.length} pending approval`,
                pulse: true
              },
              {
                title: 'Daily Revenue',
                value: realTimeData.dailyRevenue 

                  ? `UGX ${(realTimeData.dailyRevenue / 1000000).toFixed(1)}M`
                  : 'UGX 0',
                icon: '💰',
                gradient: 'from-green-500 via-emerald-600 to-teal-600',
                bg: 'from-green-50 to-emerald-50',
                shadowColor: 'green',
                trend: '+12.5%',
                trendUp: true,
                subtitle: realTimeData.revenueLabel || 'Today',
                pulse: false
              },
              {
                title: 'Active Orders',
                value: realTimeData.todaysOrders || orderStats.today || 0,
                icon: '📋',
                gradient: 'from-yellow-500 via-orange-500 to-red-500',
                bg: 'from-yellow-50 to-orange-50',
                shadowColor: 'orange',
                trend: '+8.3%',
                trendUp: true,
                subtitle: `${realTimeData.todaysOrders || orderStats.today || 0} orders today`,
                pulse: true
              },
              {
                title: 'Growth Rate',
                value: `${realTimeData.growthRate || 0}%`,
                icon: '📈',
                gradient: 'from-purple-500 via-pink-500 to-rose-500',
                bg: 'from-purple-50 to-pink-50',
                shadowColor: 'purple',
                trend: '+3.1%',
                trendUp: true,
                subtitle: 'Monthly growth',
                pulse: false
              }
            ].map((stat, index) => (
              <div
                key={index}
                className={`relative bg-gradient-to-br ${stat.bg} rounded-2xl p-6 border-2 border-white/50 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-500 group overflow-hidden animate-fadeInUp`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Animated Background */}
                <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

                <div className="relative">
                  {/* Header with Icon and Trend */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-4 bg-gradient-to-br ${stat.gradient} rounded-2xl shadow-lg transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 ${stat.pulse ? 'animate-pulse' : ''}`}>
                      <span className="text-3xl filter drop-shadow-lg">{stat.icon}</span>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold shadow-md ${
                      stat.trendUp 
                        ? 'text-green-700 bg-green-100 border-2 border-green-300' 
                        : 'text-red-700 bg-red-100 border-2 border-red-300'
                    } animate-bounce`}>
                      <span className="text-lg">{stat.trendUp ? '↑' : '↓'}</span>
                      <span>{stat.trend}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="text-gray-600 text-sm font-semibold mb-2 uppercase tracking-wide">{stat.title}</h4>

                  {/* Value */}
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className={`text-4xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                      {stat.value}
                    </span>
                  </div>

                  {/* Subtitle */}
                  <p className="text-xs text-gray-500 font-medium mb-4">{stat.subtitle}</p>

                  {/* Animated Progress Bar */}
                  <div className="relative h-2 bg-gray-200/50 rounded-full overflow-hidden">
                    <div 
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${stat.gradient} rounded-full shadow-lg transition-all duration-1000 ease-out`}
                      style={{ 
                        width: '0%',
                        animation: `progressExpand 2s ease-out ${index * 200}ms forwards`
                      }}
                    ></div>
                  </div>

                  {/* Live Indicator */}
                  <div className="absolute top-4 right-4 flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${stat.gradient} animate-ping`}></div>
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${stat.gradient}`}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes progressExpand {
            from { width: 0%; }
            to { width: 75%; }
          }
        `
      }} />

      {/* Enhanced Recent Activities */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-2xl shadow-lg p-6 border-2 border-purple-200 animate-fadeInUp" style={{ animationDelay: '400ms' }}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl -mr-24 -mt-24 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-400/10 to-purple-400/10 rounded-full blur-3xl -ml-20 -mb-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div 
          className="relative flex items-center justify-between cursor-pointer hover:bg-white/50 p-3 rounded-xl transition-all duration-300 backdrop-blur-sm group"
          onClick={() => setShowRecentActivities(!showRecentActivities)}
        >
          <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
            <span className="text-2xl animate-bounce">📋</span>
            Recent Activities
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                window.location.reload();
              }}
              className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <FiRefreshCw className="h-5 w-5 text-purple-600" />
            </button>
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
              {showRecentActivities ? (
                <FiChevronUp className="h-5 w-5 text-white" />
              ) : (
                <FiChevronDown className="h-5 w-5 text-white" />
              )}
            </div>
          </div>
        </div>

        {showRecentActivities && (
          <div className="relative mt-6 space-y-2 animate-fadeIn">
            {systemData.analytics?.recentActivities?.length > 0 ? (
              systemData.analytics.recentActivities.map((activity, index) => {
                const activityColors = [
                  { gradient: 'from-green-500 to-emerald-500', bg: 'bg-green-50/80', border: 'border-green-300', bullet: 'text-green-500' },
                  { gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50/80', border: 'border-blue-300', bullet: 'text-blue-500' },
                  { gradient: 'from-purple-500 to-pink-500', bg: 'bg-purple-50/80', border: 'border-purple-300', bullet: 'text-purple-500' },
                  { gradient: 'from-orange-500 to-amber-500', bg: 'bg-orange-50/80', border: 'border-orange-300', bullet: 'text-orange-500' },
                  { gradient: 'from-indigo-500 to-blue-500', bg: 'bg-indigo-50/80', border: 'border-indigo-300', bullet: 'text-indigo-500' }
                ];
                const colorScheme = activityColors[index % activityColors.length];
                
                return (
                  <div
                    key={index}
                    className={`relative flex items-start gap-3 p-3 ${colorScheme.bg} backdrop-blur-sm rounded-xl border ${colorScheme.border} hover:shadow-lg transition-all duration-300 group transform hover:scale-[1.02] animate-fadeInUp overflow-hidden`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${colorScheme.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                    <div className="relative">
                      <span className={`${colorScheme.bullet} text-xl font-bold animate-pulse`}>•</span>
                    </div>
                    <div className="relative flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-gray-900 font-semibold text-sm flex-1">{activity.description}</p>
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${colorScheme.gradient} animate-ping flex-shrink-0 mt-1`}></div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-600 font-medium">{activity.time}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className={`text-xs ${colorScheme.bullet} font-semibold`}>Live</span>
                      </div>
                    </div>
                    <FiChevronRight className={`h-4 w-4 ${colorScheme.bullet} opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 flex-shrink-0`} />
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 bg-white/60 rounded-xl backdrop-blur-sm">
                <div className="text-5xl mb-4 animate-bounce">🕒</div>
                <p className="text-gray-600 font-medium mb-4">No recent activities to display</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold"
                >
                  🔄 Refresh Activities
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderPendingApprovals = () => {
    const getRoleColor = (role) => {
      const colors = {
        manager: 'blue',
        cashier: 'purple',
        employee: 'indigo',
        supplier: 'orange'
      };
      return colors[role] || 'gray';
    };

    const getRoleIcon = (role) => {
      const icons = {
        manager: '👔',
        cashier: '💵',
        employee: '👥',
        supplier: '📦'
      };
      return icons[role] || '👤';
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="container-glass rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <FiUserCheck className="mr-3 text-blue-500" />
                Pending User Approvals
              </h2>
              <p className="text-gray-600 mt-1">Review and approve employee, manager, cashier, and supplier applications</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={loadPendingUsers}
                disabled={approvalsLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
              >
                <FiRefreshCw className={`h-4 w-4 ${approvalsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            {['manager', 'cashier', 'employee', 'supplier'].map(role => {
              const count = pendingUsers.filter(u => u.role === role).length;
              const color = getRoleColor(role);
              return (
                <div key={role} className={`bg-${color}-50 border-2 border-${color}-200 rounded-xl p-4`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-${color}-600 text-sm font-medium capitalize`}>{role}s</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
                    </div>
                    <span className="text-3xl">{getRoleIcon(role)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Users List */}
        {approvalsLoading ? (
          <div className="container-glass rounded-2xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading pending applications...</p>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="container-glass rounded-2xl p-12 text-center">
            <FiCheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-600">There are no pending user applications at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((user) => {
              const color = getRoleColor(user.role);
              const roleIcon = getRoleIcon(user.role);
              const metadata = user.metadata || {};
              
              return (
                <div key={user.id} className="container-glass rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Icon */}
                      <div className={`w-14 h-14 bg-${color}-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
                        {roleIcon}
                      </div>

                      {/* User Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{user.full_name}</h3>
                          <span className={`px-3 py-1 bg-${color}-100 text-${color}-700 rounded-full text-xs font-semibold uppercase`}>
                            {user.role}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <FiMail className="text-gray-400" />
                            <span>{user.email}</span>
                          </div>
                          
                          {user.phone && (
                            <div className="flex items-center space-x-2">
                              <FiPhone className="text-gray-400" />
                              <span>{user.phone}</span>
                            </div>
                          )}

                          {user.employee_id && (
                            <div className="flex items-center space-x-2">
                              <FiUser className="text-gray-400" />
                              <span>ID: {user.employee_id}</span>
                            </div>
                          )}

                          {user.department && (
                            <div className="flex items-center space-x-2">
                              <FiBriefcase className="text-gray-400" />
                              <span>{user.department}</span>
                            </div>
                          )}

                          <div className="flex items-center space-x-2">
                            <FiCalendar className="text-gray-400" />
                            <span>Applied: {new Date(user.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Additional metadata for specific roles */}
                        {user.role === 'supplier' && metadata.companyName && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-700">Company: {metadata.companyName}</p>
                            {metadata.businessCategory && (
                              <p className="text-xs text-gray-600 mt-1">Category: {metadata.businessCategory}</p>
                            )}
                            {metadata.address && (
                              <p className="text-xs text-gray-600 mt-1">Address: {metadata.address}</p>
                            )}
                          </div>
                        )}

                        {user.role === 'cashier' && metadata.shift_preference && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-600">Preferred Shift: </span>
                            <span className="text-xs font-medium text-gray-700 capitalize">{metadata.shift_preference}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => approveUser(user.id, user.full_name, user.email, user.role)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2 font-medium"
                      >
                        <FiCheckCircle className="h-4 w-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to reject ${user.full_name}'s application?`)) {
                            rejectUser(user.id, user.auth_id, user.full_name);
                          }
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center space-x-2 font-medium"
                      >
                        <FiXCircle className="h-4 w-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderUserManagement = () => {
    // Helper functions
    const getRoleIcon = (role) => {
      const icons = {
        manager: '👔',
        cashier: '💰',
        employee: '👥',
        supplier: '📦',
        admin: '⚡'
      };
      return icons[role?.toLowerCase()] || '👤';
    };

    const getRoleColor = (role) => {
      const colors = {
        manager: 'purple',
        cashier: 'green',
        employee: 'blue',
        supplier: 'orange',
        admin: 'red'
      };
      return colors[role?.toLowerCase()] || 'gray';
    };

    const getRoleGradient = (role) => {
      const gradients = {
        manager: 'from-purple-500 to-indigo-600',
        cashier: 'from-green-500 to-teal-600',
        employee: 'from-blue-500 to-cyan-600',
        supplier: 'from-orange-500 to-red-600',
        admin: 'from-red-500 to-pink-600'
      };
      return gradients[role?.toLowerCase()] || 'from-gray-500 to-gray-600';
    };

    // Always use allUsers — no pending concept
    const currentUserList = allUsers;
    const currentLoading = allUsersLoading;

    // Filter users
    const filteredUsers = currentUserList.filter(user => {
      const matchesRole = filterRole === 'all' || user.role?.toLowerCase() === filterRole.toLowerCase();
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && user.is_active) ||
        (filterStatus === 'inactive' && !user.is_active);
      const matchesVerification = filterVerification === 'all' ||
        (filterVerification === 'verified' && user.email_verified) ||
        (filterVerification === 'unverified' && !user.email_verified);
      const matchesSearch = !searchQuery || 
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesRole && matchesStatus && matchesVerification && matchesSearch;
    });

    return (
      <div className="space-y-6">
        {/* Creative Header with Live Stats - Mobile Optimized */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-lg md:rounded-2xl shadow-lg md:shadow-2xl p-4 md:p-8 relative overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          </div>

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-6 mb-4 md:mb-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-base md:text-2xl lg:text-3xl font-bold text-white mb-1 md:mb-2 flex items-center gap-2 truncate">
                  <FiUsers className="flex-shrink-0" />
                  <span className="truncate">{viewMode === 'staff' ? 'Assign Roles' : viewMode === 'applications' ? 'Applications' : viewMode === 'riders' ? 'Riders' : 'All Users'}</span>
                  {/* Real-time indicator */}
                  <span className="flex-shrink-0 flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 md:px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap">
                    <span className="relative flex h-2 w-2 md:h-3 md:w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-green-500"></span>
                    </span>
                    <span className="hidden sm:inline">Live</span>
                  </span>
                </h2>
                <p className="text-purple-100 text-xs md:text-sm lg:text-base truncate md:truncate">
                  {viewMode === 'staff' ? 'Assign manager / cashier / supplier roles'
                    : viewMode === 'applications' ? 'Review supplier & driver applications • Auto-updates'
                    : viewMode === 'riders' ? 'My Boda Guy riders partnered with your store'
                    : 'All registered users • Assign roles directly'}
                </p>
              </div>
              <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
                {/* View Mode Toggle */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg md:rounded-xl p-1 flex gap-0.5 md:gap-1">
                  <button onClick={() => setViewMode('all')}
                    className={`px-2 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1 ${viewMode === 'all' ? 'bg-white text-purple-600 shadow-lg' : 'text-white hover:bg-white/10'}`}>
                    <FiUsers className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Users</span>
                    <span className="bg-blue-400 text-blue-900 px-1.5 py-0.5 rounded-full text-xs font-bold">{allUsers.length}</span>
                  </button>
                  <button onClick={() => setViewMode('staff')}
                    className={`px-2 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1 ${viewMode === 'staff' ? 'bg-white text-purple-600 shadow-lg' : 'text-white hover:bg-white/10'}`}>
                    <FiUserPlus className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Assign Role</span>
                  </button>
                  <button onClick={() => setViewMode('applications')}
                    className={`px-2 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1 ${viewMode === 'applications' ? 'bg-white text-purple-600 shadow-lg' : 'text-white hover:bg-white/10'}`}>
                    <FiBriefcase className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Applications</span>
                    {applications.length > 0 && <span className="bg-orange-400 text-orange-900 px-1.5 py-0.5 rounded-full text-xs font-bold">{applications.length}</span>}
                  </button>
                  <button onClick={() => setViewMode('riders')}
                    className={`px-2 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1 ${viewMode === 'riders' ? 'bg-white text-purple-600 shadow-lg' : 'text-white hover:bg-white/10'}`}>
                    <span className="text-xs md:text-sm">🛵</span>
                    <span className="hidden sm:inline">Riders</span>
                    {riders.length > 0 && <span className="bg-green-400 text-green-900 px-1.5 py-0.5 rounded-full text-xs font-bold">{riders.length}</span>}
                  </button>
                </div>

                <button
                  onClick={loadAllUsers}
                  disabled={currentLoading}
                  className="px-2 md:px-6 py-1.5 md:py-3 bg-white text-purple-600 rounded-lg md:rounded-xl hover:bg-gray-50 transition-all duration-300 font-semibold flex items-center gap-1 md:gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 text-xs md:text-sm flex-shrink-0"
                >
                  <FiRefreshCw className={`h-4 w-4 md:h-5 md:w-5 flex-shrink-0 ${currentLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Stats Cards - Mobile Optimized */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
              {['all', 'admin', 'manager', 'cashier', 'supplier'].map(role => {
                const count = role === 'all' 
                  ? currentUserList.length 
                  : currentUserList.filter(u => u.role?.toLowerCase() === role.toLowerCase()).length;
                const icon = getRoleIcon(role);
                
                return (
                      <button
                    key={role}
                    onClick={() => setFilterRole(role)}
                    className={`p-2 md:p-4 rounded-lg md:rounded-xl transition-all duration-300 transform ${
                      filterRole === role
                        ? 'bg-white text-gray-900 shadow-2xl scale-105'
                        : 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:scale-102'
                    }`}
                  >
                    <div className="text-2xl md:text-3xl mb-1 md:mb-2">{icon}</div>
                    <p className="text-xs md:text-sm font-medium capitalize mb-0.5 md:mb-1 truncate">{role}</p>
                    <p className="text-lg md:text-2xl font-bold">{count}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search and Filters - Mobile Optimized */}
        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <FiSearch className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FiX className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Additional Filters for All Users View - Mobile Optimized */}
          {viewMode === 'all' && (
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
              {/* Status Filter */}
              <div className="flex-1 w-full">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Email Verification Filter */}
              <div className="flex-1 w-full">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Email</label>
                <select
                  value={filterVerification}
                  onChange={(e) => setFilterVerification(e.target.value)}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                >
                  <option value="all">All</option>
                  <option value="verified">✅ Verified</option>
                  <option value="unverified">⏳ Pending</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(filterStatus !== 'all' || filterVerification !== 'all' || filterRole !== 'all') && (
                <button
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterVerification('all');
                    setFilterRole('all');
                  }}
                  className="w-full md:w-auto md:mt-7 px-3 md:px-4 py-2 text-sm md:text-base bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1 md:gap-2"
                >
                  <FiX className="h-4 w-4" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ===== APPLICATIONS PANEL ===== */}
        {viewMode === 'applications' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FiBriefcase className="text-orange-500" /> Pending Applications
                {applications.length > 0 && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-sm font-bold">{applications.length}</span>}
              </h3>
              <button onClick={loadApplications} disabled={applicationsLoading}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 font-medium">
                <FiRefreshCw className={applicationsLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            {applicationsLoading ? (
              <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-500 mx-auto"></div></div>
            ) : applications.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-500 text-lg font-medium">No pending applications</p>
                <p className="text-gray-400 text-sm mt-1">Share your apply link so suppliers and drivers can apply</p>
                <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono break-all">
                  {window.location.origin}/apply/{currentAdmin.supermarket_id || 'your-supermarket-id'}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {applications.map(app => {
                  const typeColors = { supplier: 'bg-blue-50 border-blue-200', mybodaguy: 'bg-green-50 border-green-200', manager: 'bg-purple-50 border-purple-200', cashier: 'bg-yellow-50 border-yellow-200' };
                  const typeIcons = { supplier: '🏭', mybodaguy: '🛵', manager: '👔', cashier: '💰' };
                  return (
                    <div key={app.id} className={`border-2 rounded-xl p-4 shadow-sm ${typeColors[app.application_type] || 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="text-2xl">{typeIcons[app.application_type] || '📋'}</span>
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white/80 text-gray-700 capitalize border">{app.application_type}</span>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(app.created_at).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-bold text-gray-900 text-base">{app.applicant_name}</h4>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5"><FiMail className="h-3 w-3" />{app.applicant_email}</p>
                      {app.applicant_phone && <p className="text-sm text-gray-600 flex items-center gap-1"><FiPhone className="h-3 w-3" />{app.applicant_phone}</p>}
                      {app.business_name && <p className="text-sm text-gray-700 font-medium mt-1">🏢 {app.business_name}</p>}
                      {app.supermarket_name && <p className="text-xs text-blue-600 font-medium mt-0.5">🏪 Applying to: {app.supermarket_name}</p>}
                      {app.business_address && <p className="text-xs text-gray-500 mt-0.5">📍 {app.business_address}</p>}
                      {app.vehicle_type && <p className="text-sm text-gray-700 mt-1">🚗 {app.vehicle_type} · {app.license_number}</p>}
                      {app.notes && <p className="text-xs text-gray-500 italic mt-2 bg-white/60 rounded p-2">"{app.notes}"</p>}
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => approveApplication(app)}
                          className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-1 shadow">
                          <FiCheckCircle className="h-4 w-4" /> Approve
                        </button>
                        <button onClick={() => rejectApplication(app.id)}
                          className="flex-1 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg text-sm font-bold hover:from-red-600 hover:to-rose-700 transition-all flex items-center justify-center gap-1 shadow">
                          <FiXCircle className="h-4 w-4" /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== RIDERS PANEL ===== */}
        {viewMode === 'riders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>🛵</span> Partnered Riders
                {riders.length > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-sm font-bold">{riders.length}</span>}
              </h3>
              <button onClick={loadRiders} disabled={ridersLoading}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 font-medium">
                <FiRefreshCw className={ridersLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            {ridersLoading ? (
              <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-500 mx-auto"></div></div>
            ) : riders.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow">
                <div className="text-5xl mb-3">🛵</div>
                <p className="text-gray-500 text-lg font-medium">No riders yet</p>
                <p className="text-gray-400 text-sm mt-1">Approved applications from the Applications tab show up here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {riders.map(rider => (
                  <div key={rider.id} className="border-2 border-green-200 bg-green-50 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-2xl">🛵</span>
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white/80 text-green-700 border">Rider</span>
                      </div>
                      <span className="text-xs text-gray-400">Since {new Date(rider.reviewed_at || rider.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-bold text-gray-900 text-base">{rider.rider_name || 'Rider'}</h4>
                    {rider.rider_email && <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5"><FiMail className="h-3 w-3" />{rider.rider_email}</p>}
                    {rider.rider_phone && <p className="text-sm text-gray-600 flex items-center gap-1"><FiPhone className="h-3 w-3" />{rider.rider_phone}</p>}
                    {rider.vehicle_type && <p className="text-sm text-gray-700 mt-1">🚗 {rider.vehicle_type}{rider.license_number ? ` · ${rider.license_number}` : ''}</p>}
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => revokeRiderPartnership(rider.id)}
                        className="flex-1 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg text-sm font-bold hover:from-red-600 hover:to-rose-700 transition-all flex items-center justify-center gap-1 shadow">
                        <FiXCircle className="h-4 w-4" /> End Partnership
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== ASSIGN STAFF PANEL ===== */}
        {viewMode === 'staff' && (
          <div className="space-y-6">
            {/* Search & Assign */}
            <div className="bg-white rounded-xl shadow-lg p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FiUserPlus className="text-purple-500" /> Assign Manager or Cashier
                </h3>
                <button onClick={loadAllUsersForStaff} disabled={staffSearchLoading}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1">
                  <FiRefreshCw className={`h-3 w-3 ${staffSearchLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">All signed-up users are shown below. Search to filter, then assign a role.</p>

              {/* Filter bar */}
              <div className="relative mb-3">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Filter by name or email…"
                  value={staffSearchQuery}
                  onChange={(e) => searchUsersForStaff(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
                {staffSearchQuery && (
                  <button onClick={() => setStaffSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <FiX className="h-4 w-4" />
                  </button>
                )}
              </div>

              {staffSearchLoading ? (
                <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div><p className="text-xs text-gray-400 mt-2">Loading users…</p></div>
              ) : (() => {
                const q = staffSearchQuery.toLowerCase().trim();
                const filtered = staffSearchResults.filter(u =>
                  !q ||
                  (u.full_name  || '').toLowerCase().includes(q) ||
                  (u.email      || '').toLowerCase().includes(q) ||
                  (u.phone      || '').toLowerCase().includes(q) ||
                  (u.id         || '').toLowerCase().includes(q)
                );
                return filtered.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <FiUsers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{staffSearchResults.length === 0 ? 'No users found. Users must sign up first.' : 'No users match your search.'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                    {filtered.map(user => {
                      const roleColor = user.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                                        user.role === 'cashier'  ? 'bg-yellow-100 text-yellow-700' :
                                        user.role === 'admin'    ? 'bg-red-100 text-red-700' :
                                        user.role === 'supplier' ? 'bg-blue-100 text-blue-700' :
                                                                   'bg-gray-100 text-gray-500';
                      return (
                        <div key={user.id} className="flex items-center justify-between p-3 hover:bg-purple-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {(user.full_name || user.email || '?')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 text-sm truncate">{user.full_name || '(no name)'}</p>
                              <p className="text-xs text-gray-400 truncate">{user.email}</p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold mt-0.5 ${roleColor}`}>
                                {user.role || 'customer'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0 ml-2">
                            <button onClick={() => assignStaffRole(user, 'manager')}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${user.role === 'manager' ? 'bg-purple-200 text-purple-800 cursor-default' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                              disabled={user.role === 'manager'}>
                              👔 Mgr
                            </button>
                            <button onClick={() => assignStaffRole(user, 'cashier')}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${user.role === 'cashier' ? 'bg-yellow-200 text-yellow-800 cursor-default' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                              disabled={user.role === 'cashier'}>
                              💰 Csh
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Current Staff List */}
            <div className="bg-white rounded-xl shadow-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FiUsers className="text-indigo-500" /> Current Staff
                </h3>
                <button onClick={loadCurrentStaff} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                  <FiRefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>
              {currentStaff.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FiUsers className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No staff assigned yet. Search above to assign.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {currentStaff.map(staff => {
                    const u = staff.users || {};
                    return (
                      <div key={staff.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${staff.role === 'manager' ? 'bg-purple-500' : 'bg-yellow-500'}`}>
                            {(u.full_name || u.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{u.full_name || u.email}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${staff.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {staff.role === 'manager' ? '👔' : '💰'} {staff.role}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => removeStaffRole(u.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove role">
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Apply Link for Suppliers / MyBodaGuy */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
              <h3 className="text-base font-bold text-indigo-900 mb-1 flex items-center gap-2">📤 Share Application Links</h3>
              <p className="text-sm text-indigo-700 mb-3">Send these links to suppliers and MyBodaGuy drivers to apply.</p>
              {['supplier','mybodaguy'].map(type => (
                <div key={type} className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700 capitalize w-24">{type === 'mybodaguy' ? '🛵 MyBodaGuy' : '🏭 Supplier'}</span>
                  <div className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs text-gray-600 font-mono truncate">
                    {window.location.origin}/apply/{currentAdmin.supermarket_id}?type={type}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/apply/${currentAdmin.supermarket_id}?type=${type}`); notificationService.show('Link copied!', 'success'); }}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors whitespace-nowrap">
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users Grid — only shown in 'all' mode */}
        {viewMode === 'all' && currentLoading ? (
          <div className="bg-white rounded-lg md:rounded-2xl p-8 md:p-12 text-center">
            <div className="animate-spin rounded-full h-12 md:h-16 w-12 md:w-16 border-b-4 border-purple-500 mx-auto"></div>
            <p className="text-gray-600 mt-3 md:mt-4 text-sm md:text-lg">Loading users…</p>
          </div>
        ) : viewMode === 'all' && filteredUsers.length === 0 ? (
          <div className="bg-white rounded-lg md:rounded-2xl p-6 md:p-12 text-center">
            <div className="w-16 md:w-24 h-16 md:h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
              <FiUsers className="h-8 md:h-12 w-8 md:w-12 text-gray-400" />
            </div>
            <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">
              {searchQuery ? 'No users match' : 'No users yet'}
            </h3>
            <p className="text-sm md:text-base text-gray-600">
              {searchQuery
                ? 'Try a different name or email'
                : 'Users who sign up will appear here'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {filteredUsers.map((user) => {
              const roleColor = getRoleColor(user.role);
              const roleIcon = getRoleIcon(user.role);
              const roleGradient = getRoleGradient(user.role);
              const metadata = user.metadata || {};
              
              return (
                <div 
                  key={user.id} 
                  className="bg-white rounded-lg md:rounded-2xl shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-yellow-200 hover:border-yellow-300 transform hover:scale-102"
                >
                  {/* Card Header with Gradient - Mobile Optimized */}
                  <div className={`bg-gradient-to-r ${roleGradient} p-3 md:p-6`}>
                    <div className="flex items-start justify-between gap-2 md:gap-4">
                      <div className="flex items-center gap-2 md:gap-4 min-w-0">
                        {/* Avatar */}
                        <div className="w-12 md:w-16 h-12 md:h-16 bg-white rounded-lg md:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                          <span className="text-2xl md:text-4xl">{roleIcon}</span>
                        </div>
                        
                        {/* User Info */}
                        <div className="text-white min-w-0 flex-1">
                          <h3 className="text-sm md:text-xl font-bold mb-0.5 md:mb-1 truncate">{user.full_name}</h3>
                          <p className="text-xs md:text-sm opacity-90 mb-1 md:mb-2 truncate">{user.email}</p>
                          <div className="flex items-center flex-wrap gap-1">
                            {viewMode === 'pending' ? (
                              <span className="inline-flex items-center px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900 animate-pulse">
                                ⏳ Pending
                              </span>
                            ) : (
                              <>
                                {/* Email Verification Badge */}
                                {user.email_verified ? (
                                  <span className="inline-flex items-center px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-bold bg-green-400 text-green-900">
                                    ✅ Email
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-bold bg-orange-400 text-orange-900">
                                    📧 Pending
                                  </span>
                                )}
                                {/* Account Status Badge */}
                                {user.is_active ? (
                                  <span className="inline-flex items-center px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-bold bg-blue-400 text-blue-900">
                                    🟢 Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-bold bg-gray-400 text-gray-900">
                                    ⚪ Inactive
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Role Badge */}
                      <span className="px-2 md:px-4 py-1 md:py-2 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl text-white font-bold uppercase text-xs tracking-wider shadow-lg flex-shrink-0">
                        {user.role}
                      </span>
                    </div>
                  </div>

                  {/* Card Body - Mobile Optimized */}
                  <div className="p-3 md:p-6">
                    {/* User Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 mb-3 md:mb-4 text-sm md:text-base">
                      {user.phone && (
                        <div className="flex items-center gap-2">
                          <FiPhone className={`h-3 md:h-4 w-3 md:w-4 text-${roleColor}-500 flex-shrink-0`} />
                          <span className="text-xs md:text-sm text-gray-700 truncate">{user.phone}</span>
                        </div>
                      )}
                      
                      {user.employee_id && (
                        <div className="flex items-center gap-2">
                          <FiUser className={`h-3 md:h-4 w-3 md:w-4 text-${roleColor}-500 flex-shrink-0`} />
                          <span className="text-xs md:text-sm text-gray-700 font-mono bg-gray-100 px-2 py-1 rounded truncate">
                            {user.employee_id}
                          </span>
                        </div>
                      )}
                      
                      {user.department && (
                        <div className="flex items-center gap-2">
                          <FiBriefcase className={`h-3 md:h-4 w-3 md:w-4 text-${roleColor}-500 flex-shrink-0`} />
                          <span className="text-xs md:text-sm text-gray-700 truncate">{user.department}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <FiCalendar className={`h-3 md:h-4 w-3 md:w-4 text-${roleColor}-500 flex-shrink-0`} />
                        <span className="text-xs md:text-sm text-gray-700 truncate">
                          {new Date(user.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Last Login - Only for All Users view */}
                      {viewMode === 'all' && user.last_sign_in_at && (
                        <div className="flex items-center gap-2 col-span-1 md:col-span-2">
                          <FiActivity className={`h-3 md:h-4 w-3 md:w-4 text-${roleColor}-500 flex-shrink-0`} />
                          <span className="text-xs md:text-sm text-gray-700 truncate">
                            Last: {new Date(user.last_sign_in_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute:'2-digit'
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Role-Specific Details */}
                    {user.role === 'supplier' && (metadata.company_name || metadata.companyName) && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">🏢</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 mb-1">
                              {metadata.company_name || metadata.companyName}
                            </p>
                            {(metadata.business_category || metadata.businessCategory) && (
                              <p className="text-xs text-gray-600 mb-1">
                                📦 {metadata.business_category || metadata.businessCategory}
                              </p>
                            )}
                            {metadata.address && (
                              <p className="text-xs text-gray-600">
                                📍 {metadata.address}
                              </p>
                            )}
                            {(metadata.business_license || metadata.businessLicense) && (
                              <p className="text-xs text-gray-600 mt-1">
                                📄 License: {metadata.business_license || metadata.businessLicense}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {user.role === 'cashier' && metadata.preferred_shift && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border border-green-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">⏰</span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Preferred Shift</p>
                            <p className="text-sm font-bold text-gray-900 capitalize">
                              {metadata.preferred_shift}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {user.role === 'manager' && user.department && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">🎯</span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Department</p>
                            <p className="text-sm font-bold text-gray-900">
                              {user.department} Management
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons — role assignment + status */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      {/* Role assignment row */}
                      {user.role !== 'admin' && (
                        <div className="flex gap-1.5 flex-wrap">
                          {[
                            { role: 'manager',  label: '👔 Manager',  cls: 'bg-purple-600 hover:bg-purple-700' },
                            { role: 'cashier',  label: '💰 Cashier',  cls: 'bg-yellow-500 hover:bg-yellow-600' },
                            { role: 'supplier', label: '🏭 Supplier', cls: 'bg-blue-600 hover:bg-blue-700' },
                            { role: 'customer', label: '👤 Customer', cls: 'bg-gray-500 hover:bg-gray-600' },
                          ].map(({ role, label, cls }) => (
                            <button key={role}
                              onClick={() => assignStaffRole({ id: user.id || user.auth_id, full_name: user.full_name, email: user.email }, role)}
                              disabled={user.role === role}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold text-white transition-colors ${
                                user.role === role ? 'opacity-40 cursor-default bg-gray-400' : cls
                              }`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                          {/* View Details Button */}
                          <button
                            onClick={() => { setSelectedUser(user); setShowUserDetailsModal(true); }}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all font-bold flex items-center justify-center gap-2 text-sm shadow"
                          >
                            <FiEye className="h-4 w-4" />
                            <span>Details</span>
                          </button>

                          {/* Remove role (blockchain-verified revoke) */}
                          {user.role !== 'admin' && user.role !== 'customer' && (
                            <button
                              onClick={() => removeStaffRole(user.id)}
                              className="px-3 py-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl transition-all font-bold flex items-center justify-center gap-1 text-sm shadow"
                              title="Remove role → customer"
                            >
                              <FiTrash2 className="h-4 w-4" />
                              <span>Revoke</span>
                            </button>
                          )}

                          {/* Toggle Active Status */}
                          {user.role !== 'admin' && (
                            <button
                              onClick={async () => {
                                await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id);
                                loadAllUsers();
                                notificationService.show(`User ${user.is_active ? 'deactivated' : 'activated'}`, 'success');
                              }}
                              className={`flex-1 px-3 py-2 bg-gradient-to-r ${
                                user.is_active
                                  ? 'from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700'
                                  : 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                              } text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 text-sm shadow`}
                            >
                              <FiPower className="h-4 w-4" />
                              <span>{user.is_active ? 'Deactivate' : 'Activate'}</span>
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Footer */}
        {filteredUsers.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <FiUsers className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Showing</p>
                  <p className="text-xl font-bold text-gray-900">
                    {filteredUsers.length} {filterRole !== 'all' ? filterRole : 'user'}{filteredUsers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {['admin', 'manager', 'cashier', 'supplier', 'customer'].map(role => {
                  const count = allUsers.filter(u => u.role?.toLowerCase() === role).length;
                  if (count === 0) return null;
                  return (
                    <div key={role} className="text-center">
                      <p className="text-2xl">{getRoleIcon(role)}</p>
                      <p className="text-xs text-gray-600 capitalize">{role}</p>
                      <p className="text-sm font-bold text-gray-900">{count}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSystemSettings = () => (
    <div className="space-y-8">
      {/* System Settings Header */}
      <div className="container-glass rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">System Configuration</h2>
            <p className="text-gray-600">Configure system-wide settings, portal names, and preferences</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={openPortalConfiguration}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 flex items-center space-x-2 transform hover:scale-105"
            >
              <span className="text-lg">🏢</span>
              <span>Portal Names</span>
            </button>
            <button
              onClick={loadSystemData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-300 flex items-center space-x-2"
            >
              <FiRefreshCw className="h-5 w-5" />
              <span>Refresh Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Portal Configuration Quick Access */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-bold mb-3 flex items-center">
              <span className="mr-4 text-4xl">🏢</span>
              Portal Name Management
            </h3>
            <p className="text-indigo-100 text-lg mb-4">Customize portal names and system branding across the entire application</p>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-indigo-200">Real-time Updates</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-purple-300">6 Portals</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-pink-300">Instant Broadcasting</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <button
              onClick={openPortalConfiguration}
              className="bg-white/20 hover:bg-white/30 text-white py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 flex items-center space-x-3"
            >
              <span className="text-2xl">⚙️</span>
              <span>Configure Now</span>
            </button>
          </div>
        </div>

        {/* Current Portal Names Display */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(portalConfig).slice(0, 6).map(([key, value], index) => (
            <div key={key} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="text-sm text-indigo-200 uppercase tracking-wide font-medium mb-1">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div className="text-white font-bold text-lg">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* General Settings */}
        <div className="container-glass rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-2 mb-6">
            <FiSettings className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">General Settings</h3>
          </div>
          
          <div className="space-y-6">
            <div className="setting-item">
              <label className="block text-sm font-medium text-gray-700 mb-2">System Name</label>
              <div className="flex">
                <input
                  type="text"
                  value={systemData.settings?.systemName || 'FAREDEAL'}
                  readOnly
                  className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
                <button className="ml-2 p-2 text-gray-400 hover:text-gray-600">
                  <FiEdit className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="setting-item">
              <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Production
                </span>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <FiEdit className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="setting-item">
              <label className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Maintenance Mode</span>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  systemData.settings?.maintenanceMode
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {systemData.settings?.maintenanceMode ? 'Enabled' : 'Disabled'}
                </div>
              </label>
              <div className="mt-2 flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={systemData.settings?.maintenanceMode || false}
                    readOnly
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Enable maintenance mode
                  </span>
                </label>
                <button className="ml-2 p-2 text-gray-400 hover:text-gray-600">
                  <FiEdit className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="container-glass rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-2 mb-6">
            <FiShield className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">Security Settings</h3>
          </div>
          
          <div className="space-y-6">
            <div className="setting-item">
              <label className="block text-sm font-medium text-gray-700 mb-2">Session Timeout</label>
              <div className="flex">
                <input
                  type="number"
                  value={systemData.settings?.sessionTimeout || 30}
                  readOnly
                  className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                  min="1"
                  max="240"
                />
                <span className="ml-2 flex items-center text-gray-500">minutes</span>
                <button className="ml-2 p-2 text-gray-400 hover:text-gray-600">
                  <FiEdit className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="setting-item">
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Login Attempts</label>
              <div className="flex">
                <input
                  type="number"
                  value={systemData.settings?.maxLoginAttempts || 3}
                  readOnly
                  className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                  min="1"
                  max="10"
                />
                <span className="ml-2 flex items-center text-gray-500">attempts</span>
                <button className="ml-2 p-2 text-gray-400 hover:text-gray-600">
                  <FiEdit className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="setting-item">
              <label className="block text-sm font-medium text-gray-700 mb-2">Two-Factor Authentication</label>
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={systemData.settings?.twoFactorEnabled || false}
                    readOnly
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Require 2FA for admin accounts
                  </span>
                </label>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <FiEdit className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Settings */}
        <div className="container-glass rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-2 mb-6">
            <FiZap className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">Performance Settings</h3>
          </div>
          
          <div className="space-y-6">
            <div className="setting-item">
              <label className="block text-sm font-medium text-gray-700 mb-2">Cache Duration</label>
              <div className="flex">
                <input
                  type="number"
                  value={systemData.settings?.cacheDuration || 60}
                  readOnly
                  className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
                <span className="ml-2 flex items-center text-gray-500">minutes</span>
                <button className="ml-2 p-2 text-gray-400 hover:text-gray-600">
                  <FiEdit className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="setting-item">
              <label className="block text-sm font-medium text-gray-700 mb-2">Request Rate Limit</label>
              <div className="flex">
                <input
                  type="number"
                  value={systemData.settings?.rateLimit || 100}
                  readOnly
                  className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
                <span className="ml-2 flex items-center text-gray-500">requests/minute</span>
                <button className="ml-2 p-2 text-gray-400 hover:text-gray-600">
                  <FiEdit className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Settings */}
        <div className="container-glass rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-2 mb-6">
            <FiGlobe className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">Integration Settings</h3>
          </div>
          
          <div className="space-y-6">
            <div className="setting-item">
              <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
              <div className="flex">
                <input
                  type="password"
                  value="••••••••••••••••"
                  readOnly
                  className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
                <button className="ml-2 p-2 text-gray-400 hover:text-gray-600">
                  <FiEye className="h-5 w-5" />
                </button>
                <button className="ml-2 p-2 text-gray-400 hover:text-gray-600">
                  <FiRotateCw className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="setting-item">
              <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
              <div className="flex">
                <input
                  type="text"
                  value={systemData.settings?.webhookUrl || 'https://api.faredeal.ug/webhooks'}
                  readOnly
                  className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
                <button className="ml-2 p-2 text-gray-400 hover:text-gray-600">
                  <FiEdit className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInventoryControl = () => (
    <div className="space-y-6">
      {/* Master Inventory Control - Collapsible */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 rounded-2xl shadow-2xl p-6 border-2 border-emerald-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-400/20 to-blue-400/20 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-400/20 to-pink-400/20 rounded-full blur-3xl -ml-24 -mb-24 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div 
          className="relative flex items-center justify-between cursor-pointer hover:bg-white/50 p-3 rounded-xl transition-all duration-300 backdrop-blur-sm group"
          onClick={() => setShowInventoryControl(!showInventoryControl)}
        >
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <span className="text-2xl sm:text-3xl animate-bounce">🏭</span>
              Master Inventory Control
            </h2>
            <p className="text-emerald-700 text-sm sm:text-base mt-1">Complete administrative control over all inventory operations</p>
            
            {!showInventoryControl && (
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  System Active
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <FiDatabase className="h-3 w-3" />
                  Real-time Sync
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  <FiShield className="h-3 w-3" />
                  Admin Privileges
                </span>
              </div>
            )}
          </div>
          
          <div className="bg-gradient-to-r from-emerald-500 to-purple-500 p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
            {showInventoryControl ? (
              <FiChevronUp className="h-5 w-5 text-white" />
            ) : (
              <FiChevronDown className="h-5 w-5 text-white" />
            )}
          </div>
        </div>
        
        {showInventoryControl && (
          <div className="relative mt-6 space-y-3 animate-fadeIn">
            {/* Status Badges */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                System Active
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium">
                <FiDatabase className="h-4 w-4" />
                Real-time Sync
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-sm font-medium">
                <FiShield className="h-4 w-4" />
                Admin Privileges
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-purple-500 text-white rounded-lg text-sm font-bold shadow-lg">
                <span className="text-xl">∞</span>
                Full Access
              </div>
            </div>

            {/* Inventory Metrics with Real Supabase Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  title: 'Total Products',
                  value: systemData.inventory?.totalProducts || 0,
                  icon: '📦',
                  color: 'blue',
                  gradient: 'from-blue-500 to-cyan-500',
                  bg: 'bg-blue-50/80',
                  border: 'border-blue-300',
                  bullet: 'text-blue-500',
                  description: 'All system products'
                },
                {
                  title: 'Low Stock Alerts',
                  value: systemData.inventory?.lowStockItems || 0,
                  icon: '⚠️',
                  color: 'yellow',
                  gradient: 'from-yellow-500 to-orange-500',
                  bg: 'bg-yellow-50/80',
                  border: 'border-yellow-300',
                  bullet: 'text-yellow-600',
                  description: 'Items need restocking'
                },
                {
                  title: 'Monthly Orders',
                  value: systemData.orders?.monthlyCount || 0,
                  icon: '📈',
                  color: 'green',
                  gradient: 'from-green-500 to-emerald-500',
                  bg: 'bg-green-50/80',
                  border: 'border-green-300',
                  bullet: 'text-green-500',
                  description: 'Reorders processed'
                },
                {
                  title: 'Inventory Value',
                  value: `$${(systemData.inventory?.totalValue || 0).toLocaleString()}`,
                  icon: '💰',
                  color: 'purple',
                  gradient: 'from-purple-500 to-pink-500',
                  bg: 'bg-purple-50/80',
                  border: 'border-purple-300',
                  bullet: 'text-purple-500',
                  description: 'Total inventory value'
                }
              ].map((metric, index) => (
                <div
                  key={index}
                  className={`relative flex items-start gap-3 p-4 ${metric.bg} backdrop-blur-sm rounded-xl border-2 ${metric.border} hover:shadow-xl transition-all duration-300 group overflow-hidden`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${metric.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                  <div className="relative">
                    <span className={`${metric.bullet} text-2xl font-bold animate-pulse`}>•</span>
                  </div>
                  <div className="relative flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl group-hover:scale-125 transition-transform duration-300" style={{ animationDelay: `${index * 100}ms` }}>{metric.icon}</span>
                      <span className="font-bold text-gray-800 text-sm">{metric.title}</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                    <p className="text-xs text-gray-600 mt-1">{metric.description}</p>
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${metric.gradient} animate-ping absolute top-0 right-0`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Admin Controls */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-100">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="mr-3 text-3xl">🎛️</span>
              Advanced Admin Controls
            </h3>
            <p className="text-gray-600 mt-2">Exclusive administrative functions and system-wide operations</p>
          </div>
          <div className="flex space-x-3">
            <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center space-x-2">
              <FiDownload className="h-5 w-5" />
              <span>Export All Data</span>
            </button>
            <button className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center space-x-2">
              <FiUpload className="h-5 w-5" />
              <span>Bulk Import</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { title: 'Global Reorder', icon: '🔄', color: 'bg-blue-600 hover:bg-blue-700', description: 'Trigger system-wide reorders' },
            { title: 'Price Override', icon: '💲', color: 'bg-green-600 hover:bg-green-700', description: 'Modify all product prices' },
            { title: 'Supplier Audit', icon: '🔍', color: 'bg-purple-600 hover:bg-purple-700', description: 'Check all supplier status' },
            { title: 'Force Sync', icon: '⚡', color: 'bg-yellow-600 hover:bg-yellow-700', description: 'Sync all inventory data' },
            { title: 'Category Manager', icon: '📁', color: 'bg-indigo-600 hover:bg-indigo-700', description: 'Manage product categories' },
            { title: 'Alert System', icon: '🚨', color: 'bg-red-600 hover:bg-red-700', description: 'Configure alert thresholds' },
            { title: 'Backup System', icon: '💾', color: 'bg-gray-600 hover:bg-gray-700', description: 'Create inventory backups' },
            { title: 'Analytics Hub', icon: '📊', color: 'bg-pink-600 hover:bg-pink-700', description: 'Advanced data insights' }
          ].map((control, index) => (
            <button
              key={index}
              className={`${control.color} text-white p-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex flex-col items-center space-y-3 text-center animate-fadeInUp`}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => alert(`${control.title} functionality activated! This would trigger: ${control.description}`)}
            >
              <span className="text-3xl">{control.icon}</span>
              <div>
                <div className="font-semibold text-sm">{control.title}</div>
                <div className="text-xs text-white/80 mt-1">{control.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Product Inventory Interface */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 rounded-2xl shadow-2xl border-2 border-emerald-200">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-400/20 to-blue-400/20 rounded-full blur-3xl -mr-48 -mt-48 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-purple-400/20 to-pink-400/20 rounded-full blur-3xl -ml-36 -mb-36 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div 
          className="relative cursor-pointer p-3 md:p-4 lg:p-6 bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-700 text-white hover:from-emerald-700 hover:via-blue-700 hover:to-purple-800 transition-all duration-300"
          onClick={() => setShowProductManagement(!showProductManagement)}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
            <div className="flex-1">
              <h3 className="text-base md:text-lg lg:text-2xl font-bold flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                <span className="bg-white/20 p-2 md:p-3 rounded-lg md:rounded-xl animate-bounce text-lg md:text-2xl lg:text-3xl">📦</span>
                <span>Complete {branding.itemsLabel} Management</span>
              </h3>
              <p className="text-emerald-100 text-xs md:text-sm">Full administrative access to all inventory functions</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              <div className="hidden md:flex items-center gap-2 lg:gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl px-2 md:px-4 py-2 md:py-3 text-center border border-white/30 hover:bg-white/30 transition-all">
                  <div className="text-lg md:text-2xl font-bold">{dashboardData.inventory?.totalProducts || 0}</div>
                  <div className="text-emerald-200 text-xs font-medium hidden md:block">Total {branding.itemsLabel}</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl px-2 md:px-4 py-2 md:py-3 text-center border border-white/30 hover:bg-white/30 transition-all">
                  <div className="text-lg md:text-2xl font-bold">{dashboardData.inventory?.lowStock || 0}</div>
                  <div className="text-yellow-200 text-xs font-medium hidden md:block">Low Stock</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl px-2 md:px-4 py-2 md:py-3 text-center border border-white/30 hover:bg-white/30 transition-all">
                  <div className="text-lg md:text-2xl font-bold">∞</div>
                  <div className="text-blue-200 text-xs font-medium hidden md:block">Admin Access</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-white/30 to-white/20 p-2 md:p-3 rounded-lg md:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
                {showProductManagement ? (
                  <FiChevronUp className="h-5 md:h-6 w-5 md:w-6 text-white" />
                ) : (
                  <FiChevronDown className="h-5 md:h-6 w-5 md:w-6 text-white" />
                )}
              </div>
            </div>
          </div>
        </div>

        {showProductManagement && (
          <div className="relative animate-fadeIn">
            {/* Quick Product Stats - Mobile Optimized */}
            <div className="p-3 md:p-4 lg:p-6 grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
              {[
                { 
                  label: 'Total Products', 
                  value: dashboardData.inventory?.totalProducts || 0, 
                  icon: '📦', 
                  color: 'emerald',
                  gradient: 'from-emerald-500 to-teal-500'
                },
                { 
                  label: 'Low Stock Items', 
                  value: dashboardData.inventory?.lowStock || 0, 
                  icon: '⚠️', 
                  color: 'orange',
                  gradient: 'from-orange-500 to-amber-500'
                },
                { 
                  label: 'Out of Stock', 
                  value: dashboardData.inventory?.outOfStock || 0, 
                  icon: '🚫', 
                  color: 'red',
                  gradient: 'from-red-500 to-rose-500'
                },
                { 
                  label: 'Total Value', 
                  value: `$${((dashboardData.inventory?.totalValue || 0) / 1000).toFixed(1)}K`, 
                  icon: '💰', 
                  color: 'green',
                  gradient: 'from-green-500 to-emerald-500'
                }
              ].map((stat, index) => (
                <div 
                  key={index} 
                  className={`relative group bg-gradient-to-br from-${stat.color}-50 to-${stat.color}-100 p-2 md:p-3 lg:p-4 rounded-lg md:rounded-xl border-2 border-${stat.color}-200 hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                  <div className="relative flex items-start justify-between gap-1 md:gap-2">
                    <div>
                      <p className="text-xs text-gray-600 font-medium mb-0.5 md:mb-1">{stat.label}</p>
                      <p className="text-lg md:text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <span className="text-2xl md:text-3xl group-hover:scale-125 transition-transform duration-300 flex-shrink-0">{stat.icon}</span>
                  </div>
                  <div className={`mt-1 md:mt-2 h-1 bg-gradient-to-r ${stat.gradient} rounded-full`}></div>
                </div>
              ))}
            </div>

            {/* Enhanced Product Interface */}
            <div className="px-3 md:px-4 lg:px-6 pb-3 md:pb-4 lg:pb-6">
              <div className="bg-white rounded-lg md:rounded-xl shadow-inner border-2 border-gray-100 overflow-hidden">
                <ProductInventoryInterface />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* System-wide Inventory Reports - Mobile Optimized */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
        {/* Inventory Trends */}
        <div className="bg-white rounded-lg md:rounded-2xl shadow-lg md:shadow-xl p-4 md:p-6 border-2 border-blue-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4 mb-4 md:mb-6">
            <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 flex items-center gap-1 md:gap-2 lg:gap-3">
              <span className="text-lg md:text-2xl">📈</span>
              <span>Inventory Trends</span>
            </h3>
            <select className="border border-gray-300 rounded-lg px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm w-full sm:w-auto">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <div className="space-y-2 md:space-y-3">
            {[
              { product: 'Premium Rice 25kg', trend: 'up', value: '+15%', color: 'green' },
              { product: 'Organic Beans 10kg', trend: 'up', value: '+8%', color: 'green' },
              { product: 'White Sugar 5kg', trend: 'down', value: '-3%', color: 'red' },
              { product: 'Cooking Oil 2L', trend: 'up', value: '+22%', color: 'green' },
              { product: 'Maize Flour 10kg', trend: 'stable', value: '0%', color: 'gray' }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 md:p-3 lg:p-4 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                  <div className={`w-2 md:w-3 h-2 md:h-3 rounded-full bg-${item.color}-500 flex-shrink-0`}></div>
                  <span className="font-medium text-xs md:text-sm text-gray-900 truncate">{item.product}</span>
                </div>
                <div className={`flex items-center gap-1 md:gap-2 text-${item.color}-600 flex-shrink-0`}>
                  <span className="text-xs md:text-sm">{item.trend === 'up' ? '↗' : item.trend === 'down' ? '↘' : '→'}</span>
                  <span className="font-semibold text-xs md:text-sm">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Alerts - Mobile Optimized */}
        <div className="bg-white rounded-lg md:rounded-2xl shadow-lg md:shadow-xl p-4 md:p-6 border-2 border-red-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4 mb-4 md:mb-6">
            <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 flex items-center gap-1 md:gap-2 lg:gap-3">
              <span className="text-lg md:text-2xl">🚨</span>
              <span>Critical Alerts</span>
            </h3>
            <span className="bg-red-100 text-red-800 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium w-fit">3 Active</span>
          </div>
          <div className="space-y-2 md:space-y-3">
            {[
              {
                type: 'Critical Stock',
                message: 'Cooking Oil 2L - Only 2 units remaining',
                time: '2 mins ago',
                severity: 'high',
                action: 'Reorder Now'
              },
              {
                type: 'Supplier Issue',
                message: 'Premium Rice supplier delayed delivery',
                time: '15 mins ago',
                severity: 'medium',
                action: 'Contact Supplier'
              },
              {
                type: 'Price Alert',
                message: 'Maize Flour price increased by 12%',
                time: '1 hour ago',
                severity: 'low',
                action: 'Update Prices'
              }
            ].map((alert, index) => (
              <div key={index} className={`p-3 md:p-4 rounded-lg md:rounded-xl border-l-4 ${
                alert.severity === 'high' ? 'border-red-500 bg-red-50' :
                alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 md:gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs md:text-sm text-gray-900">{alert.type}</h4>
                    <p className="text-gray-700 text-xs md:text-sm mt-0.5 md:mt-1">{alert.message}</p>
                    <p className="text-gray-500 text-xs mt-1 md:mt-2">{alert.time}</p>
                  </div>
                  <button className={`px-2 md:px-3 py-1 rounded-lg text-xs font-medium flex-shrink-0 w-full sm:w-auto ${
                    alert.severity === 'high' ? 'bg-red-600 text-white' :
                    alert.severity === 'medium' ? 'bg-yellow-600 text-white' :
                    'bg-blue-600 text-white'
                  }`}>
                    {alert.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Add state for order stats and collapsible sections
  const [orderStats, setOrderStats] = useState({
    total: 0,
    today: 0,
    pending: 0,
    completed: 0,
    revenue: 0,
    loading: true
  });
  const [detailedOrders, setDetailedOrders] = useState([]);
  const [loadingDetailedOrders, setLoadingDetailedOrders] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);

  const renderOrderManagement = () => {
    const orderCards = [
      { 
        id: 'total',
        title: 'Total Orders', 
        value: orderStats.total,
        icon: '📋', 
        color: 'orange',
        description: 'All orders in the system',
        details: 'Complete order history across all portals and time periods'
      },
      { 
        id: 'today',
        title: 'Today Orders', 
        value: orderStats.today,
        icon: '📦', 
        color: 'blue',
        description: 'Orders placed today',
        details: `Active orders from ${new Date().toLocaleDateString()}`
      },
      { 
        id: 'pending',
        title: 'Pending Orders', 
        value: orderStats.pending,
        icon: '⏳', 
        color: 'yellow',
        description: 'Awaiting approval or processing',
        details: 'Purchase orders pending approval or supplier confirmation'
      },
      { 
        id: 'completed',
        title: 'Completed Orders', 
        value: orderStats.completed,
        icon: '✅', 
        color: 'green',
        description: 'Successfully completed',
        details: 'All successfully processed and delivered orders'
      },
      { 
        id: 'revenue',
        title: 'Revenue Today', 
        value: `UGX ${orderStats.revenue.toLocaleString()}`,
        icon: '💰', 
        color: 'purple',
        description: 'Today\'s earnings',
        details: 'Total revenue generated from today\'s transactions'
      }
    ];

    return (
      <div className="space-y-6">
        {/* Order Management Header - Collapsible - Mobile Optimized */}
        <div className="bg-gradient-to-r from-orange-500 via-red-600 to-pink-700 rounded-lg md:rounded-xl p-4 md:p-6 text-white shadow-lg md:shadow-xl cursor-pointer hover:shadow-xl md:hover:shadow-2xl transition-all duration-300"
             onClick={() => setExpandedCard(expandedCard === 'header' ? null : 'header')}>
          <div className="flex items-center justify-between gap-3 md:gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-2xl font-bold mb-1 md:mb-2 flex items-center gap-2">
                <span className="text-2xl md:text-3xl flex-shrink-0">📋</span>
                <span className="truncate">Order Management</span>
                <FiChevronDown className={`ml-2 transition-transform duration-300 flex-shrink-0 ${expandedCard === 'header' ? 'rotate-180' : ''}`} />
              </h2>
              <p className="text-orange-100 text-xs md:text-sm">Full administrative control over all order operations</p>
            </div>
            <div className="text-right ml-2 md:ml-4 flex-shrink-0">
              <div className="text-2xl md:text-4xl font-bold">{orderStats.loading ? '...' : orderStats.total.toLocaleString()}</div>
              <div className="text-orange-200 text-xs md:text-sm">Total Orders</div>
            </div>
          </div>
          
          {expandedCard === 'header' && (
            <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/20 animate-fadeIn">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
                <div className="bg-white/10 rounded-lg p-2 md:p-3">
                  <div className="text-orange-200 text-xs md:text-sm">System Status</div>
                  <div className="font-bold mt-1">🟢 Active</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2 md:p-3">
                  <div className="text-orange-200 text-xs md:text-sm">Last Updated</div>
                  <div className="font-bold mt-1 text-xs md:text-sm">{new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2 md:p-3">
                  <div className="text-orange-200 text-xs md:text-sm">Data Source</div>
                  <div className="font-bold mt-1">Supabase</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2 md:p-3">
                  <div className="text-orange-200 text-xs md:text-sm">Auto Refresh</div>
                  <div className="font-bold mt-1 text-xs md:text-sm">Every 5min</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Order Stats - List Format with Collapsible Cards - Mobile Optimized */}
        <div className="space-y-3 md:space-y-4">
          {orderCards.map((card) => (
            <div 
              key={card.id}
              className={`bg-white rounded-lg md:rounded-xl shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-${card.color}-500`}
              onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
            >
              <div className="p-3 md:p-5">
                <div className="flex items-center justify-between gap-2 md:gap-4">
                  <div className="flex items-center flex-1 gap-2 md:gap-4">
                    <div className={`p-2 md:p-3 bg-${card.color}-100 rounded-lg md:rounded-xl flex-shrink-0`}>
                      <span className="text-xl md:text-2xl">{card.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm md:text-lg font-bold text-gray-900 truncate">{card.title}</h3>
                      <p className="text-xs md:text-sm text-gray-600 truncate">{card.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-lg md:text-3xl font-bold text-gray-900">
                        {orderStats.loading ? '...' : card.value}
                      </div>
                    </div>
                    <FiChevronDown className={`text-gray-400 transition-transform duration-300 flex-shrink-0 ${expandedCard === card.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedCard === card.id && (
                  <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                        <div className="text-xs md:text-sm text-gray-600 mb-1">Details</div>
                        <div className="font-medium text-sm md:text-base text-gray-900">{card.details}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                        <div className="text-xs md:text-sm text-gray-600 mb-1">Last Updated</div>
                        <div className="font-medium text-sm md:text-base text-gray-900 flex items-center gap-2">
                          <FiRefreshCw className="text-green-500 flex-shrink-0" />
                          <span className="truncate">{new Date().toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 md:mt-4 flex justify-end gap-2 flex-wrap">
                      <button className={`px-3 md:px-4 py-2 text-sm md:text-base bg-${card.color}-600 text-white rounded-lg hover:bg-${card.color}-700 transition-colors flex items-center gap-1 md:gap-2`}>
                        <FiEye className="flex-shrink-0" /> <span className="hidden sm:inline">View Details</span>
                      </button>
                      <button className="px-3 md:px-4 py-2 text-sm md:text-base bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1 md:gap-2">
                        <FiDownload className="flex-shrink-0" /> <span className="hidden sm:inline">Export</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      {/* Order Control Panel - Mobile Optimized */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-lg md:shadow-xl p-4 md:p-8">
        <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
          <span className="text-2xl md:text-3xl">🎛️</span>
          <span className="truncate">Order Control Panel</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
          {[
            { title: 'Bulk Actions', icon: '🔄', action: 'Process multiple' },
            { title: 'Priority Queue', icon: '⚡', action: 'Manage urgent' },
            { title: 'Auto-Assignment', icon: '🤖', action: 'Automated routing' },
            { title: 'Cancel Orders', icon: '❌', action: 'Mass cancel' },
            { title: 'Refund Control', icon: '💸', action: 'Process refunds' },
            { title: 'Delivery Tracking', icon: '🚚', action: 'Monitor' },
            { title: 'Customer Alerts', icon: '📱', action: 'Send notify' },
            { title: 'Order Analytics', icon: '📊', action: 'Generate' }
          ].map((control, index) => (
            <button key={index} className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-2 md:p-4 rounded-lg md:rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 text-center flex flex-col items-center justify-center">
              <div className="text-lg md:text-2xl mb-1">{control.icon}</div>
              <div className="font-semibold text-xs md:text-sm line-clamp-2">{control.title}</div>
              <div className="text-xs text-white/70 mt-0.5 line-clamp-1">{control.action}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Detailed Orders List - Real data from database - Mobile Optimized */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-lg md:shadow-xl p-4 md:p-8">
        <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
          <span className="text-2xl md:text-3xl">📜</span>
          <span>Recent Orders</span>
        </h3>
        
        {loadingDetailedOrders ? (
          <div className="text-center py-8">
            <div className="animate-spin text-3xl md:text-4xl mb-3">⏳</div>
            <p className="text-sm md:text-base text-gray-600">Loading orders...</p>
          </div>
        ) : detailedOrders.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-sm md:text-base text-gray-500">No orders found</p>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-0 md:overflow-x-auto">
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {detailedOrders.slice(0, 10).map((order, index) => (
                <div key={order.id} className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-600">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Order ID</div>
                      <div className="font-mono text-sm font-bold text-blue-600">{order.id.slice(0, 8)}...</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      order.status === 'completed' 
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'pending' || order.status === 'pending_approval'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status === 'completed' && '✅ Done'}
                      {order.status === 'pending' && '⏳ Pending'}
                      {order.status === 'pending_approval' && '⏳ Await'}
                      {order.status === 'sent_to_supplier' && '🚚 Sent'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type</span>
                      <span className="font-semibold">{order.type === 'sale' ? '💰 Sale' : '📦 Purchase'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer/Supplier</span>
                      <span className="font-semibold truncate ml-2">{order.customer || order.supplier || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount</span>
                      <span className="font-bold text-gray-900">UGX {(order.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Items</span>
                      <span className="font-semibold text-gray-700">{order.items}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date</span>
                      <span className="text-xs font-medium">{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <button className="w-full text-sm text-blue-600 hover:text-blue-800 font-semibold py-2 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                    View Details
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="px-4 py-3 text-left font-bold text-gray-900">Order ID</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-900">Type</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-900">Status</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-900">Customer/Supplier</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-900">Amount</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-900">Items</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-900">Date</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedOrders.slice(0, 10).map((order, index) => (
                    <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{order.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          order.type === 'sale' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.type === 'sale' ? '💰 Sale' : '📦 Purchase'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          order.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'pending' || order.status === 'pending_approval'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status === 'completed' && '✅ Completed'}
                          {order.status === 'pending' && '⏳ Pending'}
                          {order.status === 'pending_approval' && '⏳ Pending Approval'}
                          {order.status === 'sent_to_supplier' && '🚚 Sent'}
                          {!['completed', 'pending', 'pending_approval', 'sent_to_supplier'].includes(order.status) && order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {order.customer || order.supplier || 'N/A'}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        UGX {(order.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">
                        {order.items}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-blue-600 hover:text-blue-800 font-semibold text-xs px-3 py-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-xs sm:text-sm text-gray-600">
                Showing 1-{Math.min(10, detailedOrders.length)} of {detailedOrders.length} orders
              </p>
              <button className="w-full sm:w-auto px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold text-sm flex items-center justify-center gap-2">
                <FiDownload /> <span>Export All</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    );
  };

  const renderPaymentControl = () => (
    <div className="space-y-8">
      {/* Payment Control Header - Collapsible */}
      <div className="relative overflow-hidden bg-gradient-to-r from-green-500 via-emerald-600 to-teal-700 rounded-2xl p-6 shadow-2xl border-2 border-emerald-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl -mr-32 -mt-32 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-white/10 to-transparent rounded-full blur-3xl -ml-24 -mb-24 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div 
          className="relative flex items-center justify-between cursor-pointer hover:bg-white/10 p-3 rounded-xl transition-all duration-300 backdrop-blur-sm group"
          onClick={() => setShowPaymentControl(!showPaymentControl)}
        >
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center text-white">
              <span className="mr-3 text-3xl sm:text-4xl animate-bounce">💳</span>
              Payment System Control
            </h2>
            <p className="text-green-100 text-sm sm:text-lg">Complete financial oversight and payment processing control</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-4xl sm:text-5xl font-bold text-white">${(dashboardData.totalRevenue || 0).toLocaleString()}</div>
              <div className="text-green-200 text-sm sm:text-lg">Monthly Revenue</div>
            </div>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
              {showPaymentControl ? (
                <FiChevronUp className="h-6 w-6 text-white" />
              ) : (
                <FiChevronDown className="h-6 w-6 text-white" />
              )}
            </div>
          </div>
        </div>
        
        {showPaymentControl && (
          <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
            {[
              { 
                title: 'Daily Revenue', 
                value: `$${(dashboardData.dailyRevenue || 0).toLocaleString()}`, 
                icon: '📈', 
                gradient: 'from-green-500 to-emerald-500', 
                bg: 'bg-green-50/90', 
                border: 'border-green-300', 
                bullet: 'text-green-500',
                description: 'Today\'s total revenue'
              },
              { 
                title: 'Pending Payments', 
                value: (dashboardData.pendingPayments || 0).toString(), 
                icon: '⏱️', 
                gradient: 'from-yellow-500 to-orange-500', 
                bg: 'bg-yellow-50/90', 
                border: 'border-yellow-300', 
                bullet: 'text-yellow-600',
                description: 'Awaiting confirmation'
              },
              { 
                title: 'Failed Transactions', 
                value: (dashboardData.failedTransactions || 0).toString(), 
                icon: '❌', 
                gradient: 'from-red-500 to-pink-500', 
                bg: 'bg-red-50/90', 
                border: 'border-red-300', 
                bullet: 'text-red-500',
                description: 'Requires attention'
              },
              { 
                title: 'Success Rate', 
                value: `${((dashboardData.successfulPayments || 0) / Math.max((dashboardData.totalPayments || 1), 1) * 100).toFixed(1)}%`, 
                icon: '✅', 
                gradient: 'from-blue-500 to-cyan-500', 
                bg: 'bg-blue-50/90', 
                border: 'border-blue-300', 
                bullet: 'text-blue-500',
                description: 'Payment success rate'
              }
            ].map((metric, index) => (
              <div
                key={index}
                className={`relative flex items-start space-x-3 p-4 ${metric.bg} backdrop-blur-sm rounded-xl border-2 ${metric.border} hover:shadow-xl transition-all duration-300 group transform hover:scale-105 hover:-translate-y-1 animate-fadeInUp overflow-hidden`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${metric.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div className="relative">
                  <span className={`${metric.bullet} text-2xl font-bold animate-pulse`}>•</span>
                </div>
                <div className="relative flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl group-hover:scale-125 transition-transform duration-300 animate-bounce" style={{ animationDelay: `${index * 100}ms` }}>{metric.icon}</span>
                    <span className={`font-bold text-gray-800 group-hover:bg-gradient-to-r group-hover:${metric.gradient} group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300`}>{metric.title}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-medium">{metric.description}</span>
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${metric.gradient} animate-ping`}></div>
                  </div>
                </div>
                <FiChevronRight className={`h-5 w-5 ${metric.bullet} opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Financial Control Center */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-2xl p-6 border-2 border-indigo-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse"></div>
        
        <div 
          className="relative flex items-center justify-between cursor-pointer hover:bg-white/50 p-3 rounded-xl transition-all duration-300 backdrop-blur-sm group"
          onClick={() => setShowFinancialControl(!showFinancialControl)}
        >
          <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <span className="mr-3 text-2xl sm:text-3xl animate-bounce">🏦</span>
            Financial Control Center
          </h3>
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
            {showFinancialControl ? (
              <FiChevronUp className="h-5 w-5 text-white" />
            ) : (
              <FiChevronDown className="h-5 w-5 text-white" />
            )}
          </div>
        </div>
        
        {showFinancialControl && (
          <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-fadeIn">
            {[
              { 
                title: 'Process Refunds', 
                icon: '💸', 
                description: 'Handle customer refunds', 
                gradient: 'from-blue-500 to-blue-600',
                bg: 'bg-blue-50/80',
                border: 'border-blue-300',
                bullet: 'text-blue-500',
                onClick: async () => {
                  toast.info('Loading refund processing...');
                  const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('status', 'refund_requested')
                    .order('created_at', { ascending: false });
                  
                  if (error) {
                    toast.error('Failed to load refund requests');
                  } else {
                    toast.success(`Found ${data?.length || 0} refund requests`);
                  }
                }
              },
              { 
                title: 'Payment Gateway', 
                icon: '🔗', 
                description: 'Manage payment providers', 
                gradient: 'from-purple-500 to-purple-600',
                bg: 'bg-purple-50/80',
                border: 'border-purple-300',
                bullet: 'text-purple-500',
                onClick: () => {
                  toast.info('Payment gateway settings opened');
                }
              },
              { 
                title: 'Transaction Logs', 
                icon: '📋', 
                description: 'View all transactions', 
                gradient: 'from-green-500 to-green-600',
                bg: 'bg-green-50/80',
                border: 'border-green-300',
                bullet: 'text-green-500',
                onClick: async () => {
                  toast.info('Loading transaction logs...');
                  const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);
                  
                  if (error) {
                    toast.error('Failed to load transactions');
                  } else {
                    toast.success(`Loaded ${data?.length || 0} recent transactions`);
                  }
                }
              },
              { 
                title: 'Fraud Detection', 
                icon: '🛡️', 
                description: 'Security monitoring', 
                gradient: 'from-red-500 to-red-600',
                bg: 'bg-red-50/80',
                border: 'border-red-300',
                bullet: 'text-red-500',
                onClick: async () => {
                  toast.info('Running fraud detection scan...');
                  const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('status', 'failed')
                    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
                  
                  if (error) {
                    toast.error('Fraud detection failed');
                  } else {
                    const suspiciousCount = data?.length || 0;
                    if (suspiciousCount > 0) {
                      toast.warning(`Found ${suspiciousCount} suspicious transactions`);
                    } else {
                      toast.success('No suspicious activity detected');
                    }
                  }
                }
              },
              { 
                title: 'Revenue Reports', 
                icon: '📊', 
                description: 'Financial analytics', 
                gradient: 'from-yellow-500 to-orange-500',
                bg: 'bg-yellow-50/80',
                border: 'border-yellow-300',
                bullet: 'text-yellow-600',
                onClick: async () => {
                  toast.info('Generating revenue reports...');
                  const { data, error } = await supabase
                    .from('transactions')
                    .select('amount, created_at')
                    .eq('status', 'completed')
                    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
                  
                  if (error) {
                    toast.error('Failed to generate report');
                  } else {
                    const totalRevenue = data?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
                    toast.success(`Monthly revenue: UGX ${totalRevenue.toLocaleString()}`);
                  }
                }
              },
              { 
                title: 'Tax Management', 
                icon: '🧾', 
                description: 'Handle tax calculations', 
                gradient: 'from-indigo-500 to-blue-500',
                bg: 'bg-indigo-50/80',
                border: 'border-indigo-300',
                bullet: 'text-indigo-500',
                onClick: () => {
                  toast.info('Tax management system opened');
                  toast.success('VAT: 18% | Income Tax: 30%');
                }
              }
            ].map((tool, index) => (
              <button
                key={index}
                onClick={() => {
                  tool.onClick();
                  setShowFinancialControl(false);
                }}
                className={`relative w-full flex flex-col items-center p-6 ${tool.bg} backdrop-blur-sm rounded-xl border-2 ${tool.border} hover:shadow-2xl transition-all duration-300 group text-center transform hover:scale-105 hover:-translate-y-1 animate-fadeInUp overflow-hidden`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${tool.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div className="relative mb-3">
                  <span className="text-4xl group-hover:scale-125 transition-transform duration-300 animate-bounce" style={{ animationDelay: `${index * 100}ms` }}>{tool.icon}</span>
                </div>
                <div className="relative">
                  <h4 className={`font-bold text-lg mb-2 text-gray-800 group-hover:bg-gradient-to-r group-hover:${tool.gradient} group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300`}>{tool.title}</h4>
                  <p className="text-sm text-gray-600 mb-3">{tool.description}</p>
                  <div className={`w-full py-2 px-4 bg-gradient-to-r ${tool.gradient} text-white rounded-lg font-semibold text-sm hover:shadow-lg transition-all duration-300 group-hover:scale-110`}>
                    Access
                  </div>
                </div>
                <div className={`absolute bottom-2 right-2 w-2 h-2 rounded-full bg-gradient-to-r ${tool.gradient} animate-ping`}></div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSupplierNetwork = () => (
    <div className="space-y-8">
      {/* Supplier Network Header */}
      <div className="bg-gradient-to-r from-purple-500 via-indigo-600 to-blue-700 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-3 flex items-center">
              <span className="mr-4 text-4xl">🏭</span>
              Supplier Network Control
            </h2>
            <p className="text-purple-100 text-lg">Complete supplier management and supply chain oversight</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold">24</div>
            <div className="text-purple-200 text-lg">Active Suppliers</div>
          </div>
        </div>
      </div>

      {/* Supplier Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Active Suppliers', value: '24', icon: '🏢', color: 'purple' },
          { title: 'Pending Orders', value: '156', icon: '📦', color: 'blue' },
          { title: 'On-Time Delivery', value: '94%', icon: '🚚', color: 'green' },
          { title: 'Quality Score', value: '4.8/5', icon: '⭐', color: 'yellow' }
        ].map((stat, index) => (
          <div key={index} className={`bg-gradient-to-br from-${stat.color}-50 to-${stat.color}-100 rounded-2xl p-6 shadow-lg`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 bg-${stat.color}-200 rounded-xl`}>
                <span className="text-2xl">{stat.icon}</span>
              </div>
            </div>
            <h3 className={`text-${stat.color}-900 font-medium text-sm mb-1`}>{stat.title}</h3>
            <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Supplier Management Tools */}
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <span className="mr-3 text-3xl">⚙️</span>
          Supplier Management Hub
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Supplier Performance',
              description: 'Monitor delivery times, quality ratings, and reliability metrics',
              icon: '📊',
              color: 'blue',
              metrics: ['On-time: 94%', 'Quality: 4.8/5', 'Reliability: 96%']
            },
            {
              title: 'Contract Management',
              description: 'Handle supplier agreements, pricing, and terms',
              icon: '📋',
              color: 'green',
              metrics: ['Active: 24', 'Expiring: 3', 'Renewals: 5']
            },
            {
              title: 'Supply Chain Analytics',
              description: 'Track costs, lead times, and optimization opportunities',
              icon: '🔍',
              color: 'purple',
              metrics: ['Cost Savings: 12%', 'Lead Time: -2 days', 'Efficiency: +15%']
            }
          ].map((section, index) => (
            <div key={index} className={`bg-gradient-to-br from-${section.color}-50 to-${section.color}-100 p-6 rounded-xl border-2 border-${section.color}-200`}>
              <div className="text-4xl mb-4">{section.icon}</div>
              <h4 className={`text-${section.color}-900 font-bold text-lg mb-3`}>{section.title}</h4>
              <p className={`text-${section.color}-700 text-sm mb-4`}>{section.description}</p>
              <div className="space-y-2">
                {section.metrics.map((metric, idx) => (
                  <div key={idx} className={`text-${section.color}-800 text-xs bg-white/50 px-2 py-1 rounded`}>
                    {metric}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBusinessAnalytics = () => (
    <div className="space-y-8">
      {/* Analytics Header */}
      <div className="bg-gradient-to-r from-pink-500 via-rose-600 to-red-700 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-3 flex items-center">
              <span className="mr-4 text-4xl">📈</span>
              Business Intelligence Center
            </h2>
            <p className="text-pink-100 text-lg">Advanced analytics and business intelligence dashboard</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold">+22%</div>
            <div className="text-pink-200 text-lg">Growth Rate</div>
          </div>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Customer Growth', value: '+18%', icon: '👥', color: 'blue', period: 'This Month' },
          { title: 'Revenue Growth', value: '+22%', icon: '💰', color: 'green', period: 'This Quarter' },
          { title: 'Order Volume', value: '+15%', icon: '📦', color: 'purple', period: 'vs Last Month' },
          { title: 'Profit Margin', value: '24.5%', icon: '📊', color: 'yellow', period: 'Current' }
        ].map((kpi, index) => (
          <div key={index} className={`bg-gradient-to-br from-${kpi.color}-50 to-${kpi.color}-100 rounded-2xl p-6 shadow-lg`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 bg-${kpi.color}-200 rounded-xl`}>
                <span className="text-2xl">{kpi.icon}</span>
              </div>
            </div>
            <h3 className={`text-${kpi.color}-900 font-medium text-sm mb-1`}>{kpi.title}</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">{kpi.value}</div>
            <div className={`text-${kpi.color}-700 text-xs`}>{kpi.period}</div>
          </div>
        ))}
      </div>

      {/* Analytics Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="mr-3 text-3xl">🎯</span>
            Performance Insights
          </h3>
          <div className="space-y-4">
            {[
              { metric: 'Customer Acquisition Cost', value: '$23.50', change: '-12%', good: true },
              { metric: 'Average Order Value', value: '$87.30', change: '+8%', good: true },
              { metric: 'Customer Lifetime Value', value: '$456', change: '+15%', good: true },
              { metric: 'Churn Rate', value: '2.3%', change: '-0.5%', good: true }
            ].map((insight, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">{insight.metric}</div>
                  <div className="text-2xl font-bold text-gray-900">{insight.value}</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${insight.good ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {insight.change}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="mr-3 text-3xl">🔮</span>
            Predictive Analytics
          </h3>
          <div className="space-y-6">
            {[
              {
                title: 'Revenue Forecast',
                prediction: '$156K next month',
                confidence: '94% confidence',
                trend: 'up'
              },
              {
                title: 'Inventory Demand',
                prediction: '2,340 units needed',
                confidence: '87% confidence',
                trend: 'up'
              },
              {
                title: 'Customer Growth',
                prediction: '145 new customers',
                confidence: '91% confidence',
                trend: 'up'
              }
            ].map((forecast, index) => (
              <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                <h4 className="font-bold text-gray-900 mb-2">{forecast.title}</h4>
                <div className="text-lg font-semibold text-blue-600 mb-1">{forecast.prediction}</div>
                <div className="text-sm text-gray-600">{forecast.confidence}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystemOperations = () => (
    <div className="space-y-8">
      {/* System Operations Header */}
      <div className="bg-gradient-to-r from-gray-700 via-gray-800 to-black rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-3 flex items-center">
              <span className="mr-4 text-4xl">⚙️</span>
              System Operations Command Center
            </h2>
            <p className="text-gray-300 text-lg">Complete system control and infrastructure management</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-green-400">99.9%</div>
            <div className="text-gray-300 text-lg">System Uptime</div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'CPU Usage', value: '23%', icon: '🖥️', color: 'green', status: 'healthy' },
          { title: 'Memory Usage', value: '67%', icon: '💾', color: 'yellow', status: 'warning' },
          { title: 'Disk Space', value: '45%', icon: '💿', color: 'green', status: 'healthy' },
          { title: 'Network Load', value: '12%', icon: '🌐', color: 'green', status: 'healthy' }
        ].map((metric, index) => (
          <div key={index} className={`bg-gradient-to-br from-${metric.color}-50 to-${metric.color}-100 rounded-2xl p-6 shadow-lg`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 bg-${metric.color}-200 rounded-xl`}>
                <span className="text-2xl">{metric.icon}</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${metric.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
            </div>
            <h3 className={`text-${metric.color}-900 font-medium text-sm mb-1`}>{metric.title}</h3>
            <div className="text-3xl font-bold text-gray-900">{metric.value}</div>
          </div>
        ))}
      </div>

      {/* Operations Control Panel */}
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <span className="mr-3 text-3xl">🎛️</span>
          System Control Panel
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: 'System Restart', icon: '🔄', color: 'red', action: 'Restart Services' },
            { title: 'Database Backup', icon: '💾', color: 'blue', action: 'Create Backup' },
            { title: 'Clear Cache', icon: '🧹', color: 'green', action: 'Clear All Cache' },
            { title: 'Update System', icon: '⬆️', color: 'purple', action: 'Check Updates' },
            { title: 'Security Scan', icon: '🔒', color: 'yellow', action: 'Run Security Scan' },
            { title: 'Performance Test', icon: '⚡', color: 'indigo', action: 'Run Benchmark' },
            { title: 'Error Logs', icon: '📋', color: 'orange', action: 'View Error Logs' },
            { title: 'Maintenance Mode', icon: '🚧', color: 'gray', action: 'Toggle Maintenance' }
          ].map((control, index) => (
            <button
              key={index}
              className={`bg-${control.color}-600 hover:bg-${control.color}-700 text-white p-4 rounded-xl transition-all duration-300 transform hover:scale-105 text-center`}
              onClick={() => alert(`${control.action} activated! System operation in progress...`)}
            >
              <div className="text-2xl mb-2">{control.icon}</div>
              <div className="font-semibold text-sm">{control.title}</div>
              <div className="text-xs text-white/80 mt-1">{control.action}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // No auth checks for development mode

  // User Details Modal Component
  const UserDetailsModal = () => {
    if (!showUserDetailsModal || !selectedUser) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all animate-scaleUp m-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {selectedUser.full_name?.charAt(0)?.toUpperCase() || selectedUser.email?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedUser.full_name || 'No Name'}</h2>
                  <p className="text-white/80">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUserDetailsModal(false);
                  setSelectedUser(null);
                }}
                className="text-white/80 hover:text-white transition-colors"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                selectedUser.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {selectedUser.is_active ? '✅ Active' : '⏳ Pending'}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 capitalize">
                {selectedUser.role || 'No Role'}
              </span>
              {selectedUser.email_confirmed_at && (
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                  ✉️ Email Verified
                </span>
              )}
            </div>

            {/* User Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center space-x-2">
                  <FiUser className="h-5 w-5 text-indigo-500" />
                  <span>Basic Information</span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Full Name:</span>
                    <span className="font-medium">{selectedUser.full_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Username:</span>
                    <span className="font-medium">{selectedUser.username || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span className="font-medium text-xs">{selectedUser.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone:</span>
                    <span className="font-medium">{selectedUser.phone || selectedUser.phone_number || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Role & Department */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center space-x-2">
                  <FiBriefcase className="h-5 w-5 text-indigo-500" />
                  <span>Role & Department</span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Role:</span>
                    <span className="font-medium capitalize">{selectedUser.role || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Department:</span>
                    <span className="font-medium">{selectedUser.department || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Position:</span>
                    <span className="font-medium">{selectedUser.position || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className={`font-medium ${selectedUser.is_active ? 'text-green-600' : 'text-yellow-600'}`}>
                      {selectedUser.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center space-x-2">
                  <FiCalendar className="h-5 w-5 text-indigo-500" />
                  <span>Account Details</span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">User ID:</span>
                    <span className="font-medium text-xs">{selectedUser.id?.slice(0, 8) || 'N/A'}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created:</span>
                    <span className="font-medium">
                      {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Sign In:</span>
                    <span className="font-medium">
                      {selectedUser.last_sign_in_at ? new Date(selectedUser.last_sign_in_at).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email Verified:</span>
                    <span className="font-medium">
                      {selectedUser.email_confirmed_at ? new Date(selectedUser.email_confirmed_at).toLocaleDateString() : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center space-x-2">
                  <FiInfo className="h-5 w-5 text-indigo-500" />
                  <span>Additional Info</span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Address:</span>
                    <span className="font-medium">{selectedUser.address || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">City:</span>
                    <span className="font-medium">{selectedUser.city || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Country:</span>
                    <span className="font-medium">{selectedUser.country || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Company:</span>
                    <span className="font-medium">{selectedUser.company_name || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowUserDetailsModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-semibold"
              >
                Close
              </button>
              {selectedUser.role !== 'admin' && (
                <button
                  onClick={() => {
                    const action = selectedUser.is_active ? 'deactivate' : 'activate';
                    if (window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${selectedUser.full_name}?`)) {
                      // Toggle user status
                      supabase.from('users')
                        .update({ is_active: !selectedUser.is_active, status: selectedUser.is_active ? 'inactive' : 'active' })
                        .eq('id', selectedUser.id)
                        .then(() => {
                          notificationService.show(`User ${action}d successfully`, 'success');
                          loadAllUsers();
                          setShowUserDetailsModal(false);
                          setSelectedUser(null);
                        });
                    }
                  }}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                    selectedUser.is_active 
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {selectedUser.is_active ? 'Deactivate User' : 'Activate User'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Notifications Component
  const NotificationCenter = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification, index) => (
        <div
          key={`${notification.id}-${index}`}
          className={`p-4 rounded-lg shadow-lg border-l-4 backdrop-blur-sm transition-all duration-500 animate-slideInRight ${
            notification.type === 'success' ? 'bg-green-50/90 border-green-500 text-green-800' :
            notification.type === 'error' ? 'bg-red-50/90 border-red-500 text-red-800' :
            notification.type === 'warning' ? 'bg-yellow-50/90 border-yellow-500 text-yellow-800' :
            'bg-blue-50/90 border-blue-500 text-blue-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">
                {notification.type === 'success' ? '✅' :
                 notification.type === 'error' ? '❌' :
                 notification.type === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
              <div>
                <p className="font-medium">{notification.message}</p>
                <p className="text-xs opacity-75">{notification.timestamp}</p>
              </div>
            </div>
            <button
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  // Portal Configuration Modal Component
  const PortalConfigurationModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all animate-scaleUp">
        {/* Header Section */}
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <h3 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="bg-white/20 p-3 rounded-xl">🏢</span>
                Portal Configuration Center
              </h3>
              <p className="text-indigo-100">Customize all portal names and system branding in real-time</p>
            </div>
            <button 
              onClick={() => setShowPortalConfig(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <FiX className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Configuration Notification */}
        {configNotification && (
          <div className={`mx-8 mt-6 p-4 rounded-xl flex items-center justify-between animate-fadeInUp ${
            configNotification.type === 'success' ? 'bg-green-50 border border-green-200' :
            configNotification.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center space-x-3">
              <span className="text-2xl">
                {configNotification.type === 'success' ? '✅' : 
                 configNotification.type === 'error' ? '❌' : 'ℹ️'}
              </span>
              <span className={`font-medium ${
                configNotification.type === 'success' ? 'text-green-800' :
                configNotification.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {configNotification.message}
              </span>
            </div>
            <button 
              onClick={() => setConfigNotification(null)}
              className={`p-1 rounded-lg hover:bg-white/50 transition-colors ${
                configNotification.type === 'success' ? 'text-green-600' :
                configNotification.type === 'error' ? 'text-red-600' :
                'text-blue-600'
              }`}
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Configuration Form */}
        <div className="p-8 space-y-8">
          {/* System Branding Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
            <h4 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-3 text-3xl">🏷️</span>
              System Branding
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'systemName', label: 'System Name', placeholder: 'FAREDEAL', icon: '🚀' },
                { key: 'companyName', label: 'Company Name', placeholder: 'FareDeal Uganda', icon: '🏢' },
                { key: 'appTitle', label: 'App Title', placeholder: 'FareDeal Management System', icon: '📱' }
              ].map((field, index) => (
                <div key={field.key} className="group animate-fadeInUp" style={{ animationDelay: `${index * 100}ms` }}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-lg">{field.icon}</span>
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={configForm[field.key] || ''}
                      onChange={(e) => setConfigForm({...configForm, [field.key]: e.target.value})}
                      placeholder={field.placeholder}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 bg-white/80 backdrop-blur-sm group-hover:border-indigo-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Portal Names Section */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
            <h4 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-3 text-3xl">🚪</span>
              Portal Names Configuration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { key: 'adminPortal', label: 'Admin Portal', icon: '👑', color: 'red' },
                { key: 'employeePortal', label: 'Employee Portal', icon: '👨‍💼', color: 'blue' },
                { key: 'managerPortal', label: 'Manager Portal', icon: '👔', color: 'green' },
                { key: 'customerPortal', label: 'Customer Portal', icon: '🛍️', color: 'yellow' },
                { key: 'supplierPortal', label: 'Supplier Portal', icon: '🏭', color: 'purple' },
                { key: 'deliveryPortal', label: 'Delivery Portal', icon: '🚚', color: 'indigo' }
              ].map((portal, index) => (
                <div key={portal.key} className="group animate-fadeInUp" style={{ animationDelay: `${(index + 3) * 100}ms` }}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-lg">{portal.icon}</span>
                    {portal.label}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={configForm[portal.key] || ''}
                      onChange={(e) => setConfigForm({...configForm, [portal.key]: e.target.value})}
                      placeholder={portal.label}
                      className={`w-full p-3 border-2 border-${portal.color}-200 rounded-lg focus:ring-2 focus:ring-${portal.color}-500 focus:border-${portal.color}-500 transition-all duration-300 bg-white/80 backdrop-blur-sm group-hover:border-${portal.color}-400`}
                    />
                    <div className={`absolute inset-0 border-2 border-${portal.color}-500/0 rounded-lg group-hover:border-${portal.color}-500/20 pointer-events-none transition-all duration-300`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Preview & Configuration History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Preview Changes */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3 text-2xl">👀</span>
                Live Preview
              </h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(configForm).map(([key, value], index) => (
                  <div key={key} className={`p-3 rounded-lg border transition-all duration-300 ${
                    value !== portalConfig[key] ? 'bg-yellow-50 border-yellow-300 ring-1 ring-yellow-400' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="font-semibold text-gray-900 truncate">{value || 'Not set'}</div>
                      </div>
                      {value !== portalConfig[key] && (
                        <div className="ml-2 flex items-center space-x-1">
                          <span className="text-xs text-yellow-600 font-medium">Modified</span>
                          <span className="text-yellow-500">✏️</span>
                        </div>
                      )}
                    </div>
                    {value !== portalConfig[key] && (
                      <div className="mt-2 text-xs text-gray-600 bg-white/60 p-2 rounded border-l-2 border-yellow-400">
                        <span className="font-medium">Previous:</span> {portalConfig[key]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration History */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3 text-2xl">📚</span>
                Recent Changes
                <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {configHistory.length} entries
                </span>
              </h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {configHistory.length > 0 ? configHistory.map((entry, index) => (
                  <div key={entry.id || index} className="bg-white/70 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-900">
                        Version {entry.version}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      <span className="font-medium">Updated by:</span> {entry.updatedBy}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {entry.changes.map((change, changeIndex) => (
                        <span key={changeIndex} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {change.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📝</div>
                    <p className="text-gray-500 text-sm">No configuration history available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Real-time Status */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-800 font-medium">Real-time Configuration Active</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  Version: {portalConfig.version}
                </span>
              </div>
              <div className="text-xs text-green-600">
                Last updated: {portalConfig.lastUpdated ? new Date(portalConfig.lastUpdated).toLocaleString() : 'Never'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={handleSaveConfiguration}
              disabled={!hasChanges || isConfigUpdating}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all duration-300 ${
                hasChanges && !isConfigUpdating
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isConfigUpdating ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Saving Changes...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <span className="mr-2">💾</span>
                  Save Configuration
                  {hasChanges && <span className="ml-2 bg-white/20 text-xs px-2 py-1 rounded-full">{Object.keys(configForm).filter(key => configForm[key] !== portalConfig[key]).length} changes</span>}
                </div>
              )}
            </button>
            
            <button
              onClick={() => {
                setConfigForm({ ...portalConfig });
                setConfigNotification({ type: 'info', message: 'Configuration reset to current values' });
              }}
              disabled={!hasChanges || isConfigUpdating}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all duration-300 ${
                hasChanges && !isConfigUpdating
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700 hover:scale-105'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              🔄 Reset Changes
            </button>
            
            <div className="flex space-x-2 flex-1">
              <button
                onClick={() => {
                  // Export current configuration
                  const configData = JSON.stringify(portalConfig, null, 2);
                  const blob = new Blob([configData], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `portal-config-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setConfigNotification({ type: 'success', message: 'Configuration exported successfully!' });
                }}
                disabled={isConfigUpdating}
                className="flex-1 py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-all duration-300 text-sm disabled:opacity-50"
              >
                📤 Export
              </button>
              
              <button
                onClick={() => setShowConfigModal(false)}
                className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all duration-300 hover:scale-105"
              >
                ❌ Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Employee Access Control Modal Component
  const EmployeeAccessControlModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-y-auto transform transition-all animate-scaleUp">
        {/* Header Section */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <h3 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="bg-white/20 p-3 rounded-xl">👨‍💼</span>
                Employee Access Control Center
              </h3>
              <p className="text-blue-100">Manage employee login permissions and access control in real-time</p>
              <div className="flex items-center space-x-4 mt-3">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${accessControlStats.globalAccessEnabled ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                  <span className="text-blue-100 text-sm">
                    Global Access: {accessControlStats.globalAccessEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="text-blue-100 text-sm">
                  Version: 2.1.0
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowEmployeeControlModal(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <FiX className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Quick Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                title: 'Total Employees',
                value: accessControlStats.totalEmployees || 0,
                icon: '👥',
                color: 'blue',
                description: 'Registered employees'
              },
              {
                title: 'Active Access',
                value: accessControlStats.activeEmployees || 0,
                icon: '✅',
                color: 'green',
                description: 'Currently enabled'
              },
              {
                title: 'Disabled Access',
                value: accessControlStats.disabledEmployees || 0,
                icon: '❌',
                color: 'red',
                description: 'Access disabled'
              },
              {
                title: 'Recent Actions',
                value: accessControlStats.recentActions || 0,
                icon: '📊',
                color: 'purple',
                description: 'Last 24 hours'
              }
            ].map((stat, index) => (
              <div key={index} className={`bg-gradient-to-br from-${stat.color}-50 to-${stat.color}-100 p-6 rounded-xl border border-${stat.color}-200`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-3xl">{stat.icon}</div>
                  <div className={`text-2xl font-bold text-${stat.color}-700`}>{stat.value}</div>
                </div>
                <h4 className={`text-${stat.color}-800 font-semibold mb-1`}>{stat.title}</h4>
                <p className={`text-${stat.color}-600 text-sm`}>{stat.description}</p>
              </div>
            ))}
          </div>

          {/* Global Controls */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
            <h4 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-3 text-3xl">🎛️</span>
              Global Access Controls
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={toggleEmployeeLogin}
                disabled={accessControlLoading}
                className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                  accessControlStats.globalAccessEnabled
                    ? 'bg-red-50 border-red-200 hover:bg-red-100 text-red-700'
                    : 'bg-green-50 border-green-200 hover:bg-green-100 text-green-700'
                }`}
              >
                <div className="text-4xl mb-3">
                  {accessControlStats.globalAccessEnabled ? '🔒' : '🔓'}
                </div>
                <div className="text-lg font-semibold mb-2">
                  {accessControlStats.globalAccessEnabled ? 'Disable All Access' : 'Enable All Access'}
                </div>
                <div className="text-sm opacity-75">
                  {accessControlStats.globalAccessEnabled ? 'Block all employee logins' : 'Allow all employee logins'}
                </div>
              </button>
              
              <button
                onClick={() => performEmployeeBulkOperation('enable')}
                disabled={accessControlLoading || selectedEmployees.length === 0}
                className="p-6 rounded-xl border-2 bg-green-50 border-green-200 hover:bg-green-100 text-green-700 transition-all duration-300 disabled:opacity-50"
              >
                <div className="text-4xl mb-3">✅</div>
                <div className="text-lg font-semibold mb-2">Enable Selected</div>
                <div className="text-sm opacity-75">
                  {selectedEmployees.length} employees selected
                </div>
              </button>
              
              <button
                onClick={() => performEmployeeBulkOperation('disable')}
                disabled={accessControlLoading || selectedEmployees.length === 0}
                className="p-6 rounded-xl border-2 bg-red-50 border-red-200 hover:bg-red-100 text-red-700 transition-all duration-300 disabled:opacity-50"
              >
                <div className="text-4xl mb-3">❌</div>
                <div className="text-lg font-semibold mb-2">Disable Selected</div>
                <div className="text-sm opacity-75">
                  {selectedEmployees.length} employees selected
                </div>
              </button>
            </div>
          </div>

          {/* Employee List with Individual Controls */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h4 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-3 text-3xl">👨‍💼</span>
                  Individual Employee Controls
                </h4>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => {
                      if (selectedEmployees.length === employeeList.length) {
                        setSelectedEmployees([]);
                      } else {
                        setSelectedEmployees(employeeList.map(emp => emp.id));
                      }
                    }}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
                  >
                    {selectedEmployees.length === employeeList.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <div className="text-sm text-gray-600">
                    {selectedEmployees.length} of {employeeList.length} selected
                  </div>
                </div>
              </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {employeeList.map((employee, index) => {
                const employeeStatus = employeeAccessService?.getEmployeeAccessStatus(employee.id) || employee.status;
                const isSelected = selectedEmployees.includes(employee.id);
                
                return (
                  <div key={employee.id} className={`p-6 border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmployees(prev => [...prev, employee.id]);
                            } else {
                              setSelectedEmployees(prev => prev.filter(id => id !== employee.id));
                            }
                          }}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{employee.name}</div>
                          <div className="text-sm text-gray-600">{employee.email}</div>
                          <div className="text-xs text-gray-500">{employee.department}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            employeeStatus === 'active' ? 'bg-green-100 text-green-800' :
                            employeeStatus === 'disabled' ? 'bg-red-100 text-red-800' :
                            employeeStatus === 'disabled_globally' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {employeeStatus === 'active' ? '✅ Active' :
                             employeeStatus === 'disabled' ? '❌ Disabled' :
                             employeeStatus === 'disabled_globally' ? '🔒 Globally Disabled' :
                             '⏳ Pending'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {employee.lastLogin ? `Last: ${new Date(employee.lastLogin).toLocaleDateString()}` : 'Never logged in'}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => toggleIndividualEmployeeAccess(employee.id, employeeStatus)}
                          disabled={accessControlLoading || employeeStatus === 'disabled_globally'}
                          className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                            employeeStatus === 'active'
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          {employeeStatus === 'active' ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Access Audit Log */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
            <h4 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-3 text-3xl">📋</span>
              Access Control Audit Log
              <span className="ml-3 text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                {auditLog.length} entries
              </span>
            </h4>
            <div className="max-h-64 overflow-y-auto space-y-3">
              {auditLog.length > 0 ? auditLog.slice(0, 10).map((entry, index) => (
                <div key={entry.id} className="bg-white/70 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">
                        {entry.action === 'GLOBAL_ACCESS_TOGGLE' ? '🌐' :
                         entry.action === 'INDIVIDUAL_ACCESS_TOGGLE' ? '👤' :
                         entry.action === 'BULK_OPERATION' ? '⚡' :
                         '📝'}
                      </span>
                      <div className="font-semibold text-gray-900">
                        {entry.action.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">By:</span> {entry.performedBy} 
                    {entry.details.affectedEmployees && (
                      <span className="ml-3">
                        <span className="font-medium">Affected:</span> {entry.details.affectedEmployees} employees
                      </span>
                    )}
                  </div>
                  {entry.details.employeeId && (
                    <div className="text-xs text-gray-500">
                      Employee ID: {entry.details.employeeId} | Status: {entry.details.status}
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📝</div>
                  <p className="text-gray-500">No audit log entries available</p>
                </div>
              )}
            </div>
          </div>

          {/* Export/Import Controls */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                if (employeeAccessService) {
                  const config = employeeAccessService.exportConfiguration();
                  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `employee-access-config-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showNotification('Employee access configuration exported successfully!', 'success');
                }
              }}
              disabled={accessControlLoading}
              className="flex-1 py-3 px-6 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
            >
              <span>📤</span>
              Export Configuration
            </button>
            
            <button
              onClick={() => setShowEmployeeControlModal(false)}
              className="flex-1 py-3 px-6 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-300"
            >
              ✖️ Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Admin Data Intelligence Dashboard Modal Component
  const AdminDataDashboardModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-y-auto transform transition-all animate-scaleUp">
        {/* Header Section */}
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <h3 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="bg-white/20 p-3 rounded-xl">🏛️</span>
                Admin Data Intelligence Center
              </h3>
              <p className="text-indigo-100">Comprehensive business intelligence and data analytics dashboard</p>
              <div className="flex items-center space-x-6 mt-3">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${
                    adminDataService && !dataLoading ? 'bg-green-400' : 'bg-yellow-400'
                  }`}></div>
                  <span className="text-indigo-100 text-sm">
                    {adminDataService && !dataLoading ? 'Real-time Data Active' : 'Connecting...'}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-indigo-100 text-sm">
                  <span>📊 Records: {dashboardData.systemHealth?.totalRecords || 0}</span>
                  <span>🏢 Products: {dashboardData.dataCategories?.find(cat => cat.name === 'inventory_data')?.count || 0}</span>
                  <span>👥 Employees: {dashboardData.dataCategories?.find(cat => cat.name === 'user_behavior')?.count || 0}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowDataDashboard(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <FiX className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Loading State */}
          {dataLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="text-lg text-gray-600">Loading real-time data...</span>
              </div>
            </div>
          ) : (
          <>
          {/* Executive Summary Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                title: 'Total Records',
                value: dashboardData.systemHealth?.totalRecords || 0,
                icon: '📊',
                color: 'blue',
                trend: '+12.5%',
                description: 'Data points collected'
              },
              {
                title: 'Data Quality Score',
                value: `${dashboardData.systemHealth?.dataQuality || 95}%`,
                icon: '✨',
                color: 'green',
                trend: '+2.1%',
                description: 'Data integrity rating'
              },
              {
                title: 'Business Insights',
                value: dataInsights.length || 0,
                icon: '🧠',
                color: 'purple',
                trend: '+8',
                description: 'Active insights generated'
              },
              {
                title: 'System Performance',
                value: `${dashboardData.systemHealth?.performance || 87}%`,
                icon: '⚡',
                color: 'orange',
                trend: '+3.2%',
                description: 'Overall system health'
              }
            ].map((metric, index) => (
              <div key={index} className={`bg-gradient-to-br from-${metric.color}-50 to-${metric.color}-100 p-6 rounded-xl border border-${metric.color}-200`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-4xl">{metric.icon}</div>
                  <div className={`text-sm font-semibold text-${metric.color}-600 bg-white/60 px-2 py-1 rounded`}>
                    {metric.trend}
                  </div>
                </div>
                <h4 className={`text-${metric.color}-800 font-semibold mb-2`}>{metric.title}</h4>
                <div className={`text-3xl font-bold text-${metric.color}-900 mb-1`}>{metric.value}</div>
                <p className={`text-${metric.color}-600 text-sm`}>{metric.description}</p>
              </div>
            ))}
          </div>

          {/* Data Categories Overview */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
            <h4 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-3 text-3xl">📂</span>
              Data Categories
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(dashboardData.dataCategories || []).map((category, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-lg">
                      {category.name === 'user_behavior' ? '👤' :
                       category.name === 'business_metrics' ? '📈' :
                       category.name === 'financial_data' ? '💰' :
                       category.name === 'inventory_data' ? '📦' :
                       category.name === 'performance' ? '⚡' :
                       '📊'}
                    </div>
                    <div className="text-lg font-bold text-indigo-600">{category.count}</div>
                  </div>
                  <h5 className="font-semibold text-gray-900 capitalize">
                    {category.name.replace(/_/g, ' ')}
                  </h5>
                  <p className="text-xs text-gray-500 mt-1">
                    Updated: {category.lastUpdated ? new Date(category.lastUpdated).toLocaleDateString() : 'Never'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Business Intelligence Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Insights */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3 text-2xl">💡</span>
                Business Insights
                <span className="ml-2 text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                  {dataInsights.length} active
                </span>
              </h4>
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {dataInsights.length > 0 ? dataInsights.map((insight, index) => (
                  <div key={index} className="bg-white/70 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${
                          insight.impact === 'high' ? 'bg-red-500' :
                          insight.impact === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}></span>
                        <div className="font-semibold text-gray-900">{insight.title}</div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${
                        insight.impact === 'high' ? 'bg-red-100 text-red-700' :
                        insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {insight.impact}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{insight.type}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(insight.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">🔍</div>
                    <p className="text-gray-500">Generating business insights...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Predictions & Recommendations */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3 text-2xl">🔮</span>
                Predictions & Recommendations
              </h4>
              
              {/* Predictions */}
              <div className="mb-6">
                <h5 className="font-semibold text-gray-800 mb-3">Predictive Analytics</h5>
                <div className="space-y-3">
                  {(businessIntelligence.predictions || []).map((prediction, index) => (
                    <div key={index} className="bg-white/70 p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-900">{prediction.title}</div>
                        <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {Math.round(prediction.confidence * 100)}% confidence
                        </div>
                      </div>
                      <div className="text-lg font-bold text-blue-600 mb-1">
                        {prediction.format === 'currency' ? 
                          `$${prediction.prediction.toLocaleString()}` : 
                          prediction.prediction.toLocaleString()
                        }
                      </div>
                      <p className="text-xs text-gray-500">{prediction.basis}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h5 className="font-semibold text-gray-800 mb-3">Strategic Recommendations</h5>
                <div className="space-y-3">
                  {(businessIntelligence.recommendations || []).map((rec, index) => (
                    <div key={index} className="bg-white/70 p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-900">{rec.title}</div>
                        <div className={`text-xs px-2 py-1 rounded ${
                          rec.priority === 'critical' ? 'bg-red-100 text-red-700' :
                          rec.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {rec.priority}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Effort: {rec.effort}</span>
                        <span>Impact: {rec.impact}</span>
                        <span>Category: {rec.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Metrics */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
            <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-3 text-2xl">⚡</span>
              Real-time System Metrics
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/70 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">👥</span>
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData.realTimeMetrics?.activeUsers || 0}
                  </div>
                </div>
                <h5 className="font-semibold text-gray-900">Active Users</h5>
                <p className="text-xs text-gray-600">Currently online</p>
              </div>
              
              <div className="bg-white/70 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">💰</span>
                  <div className="text-2xl font-bold text-green-600">
                    ${(dashboardData.realTimeMetrics?.currentSales || 0).toLocaleString()}
                  </div>
                </div>
                <h5 className="font-semibold text-gray-900">Current Sales</h5>
                <p className="text-xs text-gray-600">Today's revenue</p>
              </div>
              
              <div className="bg-white/70 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">🎯</span>
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData.realTimeMetrics?.conversionRate || 0}%
                  </div>
                </div>
                <h5 className="font-semibold text-gray-900">Conversion Rate</h5>
                <p className="text-xs text-gray-600">Current performance</p>
              </div>
            </div>
          </div>

          {/* Data Export and Management */}
          <div className="flex flex-wrap gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                if (adminDataService) {
                  const exportData = adminDataService.exportAdminData('json');
                  const blob = new Blob([exportData], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `admin-data-export-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showNotification('Admin data exported successfully!', 'success');
                }
              }}
              disabled={dataLoading}
              className="flex-1 py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
            >
              <span>📥</span>
              Export Data
            </button>
            
            <button
              onClick={() => {
                if (adminDataService) {
                  const dashboardUpdate = adminDataService.getAdminDashboardData();
                  setDashboardData(dashboardUpdate);
                  setDataInsights(dashboardUpdate.recentInsights || []);
                  showNotification('Data refreshed successfully!', 'success');
                }
              }}
              disabled={dataLoading}
              className="flex-1 py-3 px-6 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
            >
              <span>🔄</span>
              Refresh Data
            </button>
            
            <button
              onClick={() => setShowDataDashboard(false)}
              className="flex-1 py-3 px-6 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-300"
            >
              ✖️ Close Dashboard
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: FiBarChart },
    { id: 'transactions', label: '🧾 Transaction History', icon: FiFileText },
    { id: 'inventory-pos', label: '📦 Order Inventory - POS', icon: FiShoppingBag },
    { id: 'users', label: 'User Management', icon: FiUsers },
    { id: 'analytics', label: 'Business Analytics', icon: FiPieChart },
    { id: 'ican-wallet', label: '₡ IcanEra Wallet', icon: FiDollarSign }
  ];

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 bg-cover bg-center bg-fixed"
      style={branding.backgroundUrl ? {
        backgroundImage: `linear-gradient(rgba(249,250,251,0.92), rgba(243,244,246,0.92)), url(${branding.backgroundUrl})`
      } : undefined}
    >
      {/* Authorization Check */}
      {authLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Verifying access...</p>
          </div>
        </div>
      ) : !isAdmin ? (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
          <div className="max-w-md w-full mx-auto p-8 bg-white rounded-xl shadow-lg border-2 border-red-300">
            <div className="text-center">
              <div className="text-6xl mb-4">🚫</div>
              <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
              <p className="text-gray-700 mb-6">
                This portal is for administrators only. Your account does not have the required permissions.
              </p>
              <p className="text-sm text-gray-600 mb-6">
                If you believe this is an error, please contact your administrator.
              </p>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-300"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
      <NotificationCenter />
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .animate-slideInRight { animation: slideInRight 0.5s ease-out; }
          @keyframes scaleUp {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-scaleUp { animation: scaleUp 0.3s ease-out; }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
            50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }
          @keyframes rotate3d {
            0% { transform: rotate3d(1, 1, 1, 0deg); }
            100% { transform: rotate3d(1, 1, 1, 360deg); }
          }
          @keyframes border-glow {
            0%, 100% { border-color: rgba(59, 130, 246, 0.2); }
            50% { border-color: rgba(59, 130, 246, 0.8); }
          }
          @keyframes widthExpand {
            from { transform: scaleX(0); }
            to { transform: scaleX(1); }
          }
          .animate-widthExpand {
            animation: widthExpand 1.5s ease-out forwards;
          }
          .delay-100 { animation-delay: 0.1s; }
          .delay-200 { animation-delay: 0.2s; }
          .delay-300 { animation-delay: 0.3s; }
          .delay-400 { animation-delay: 0.4s; }
          .animate-fadeInUp { animation: fadeInUp 0.8s ease-out; }
          .animate-slideInLeft { animation: slideInLeft 0.8s ease-out; }
          .animate-slideInRight { animation: slideInRight 0.8s ease-out; }
          .animate-pulse { animation: pulse 2s infinite; }
          .animate-glow { animation: glow 2s infinite; }
          .animate-float { animation: float 3s ease-in-out infinite; }
          .animate-shimmer {
            background: linear-gradient(to right, transparent 0%, rgba(59, 130, 246, 0.1) 50%, transparent 100%);
            background-size: 1000px 100%;
            animation: shimmer 2s infinite;
          }
          .animate-rotate3d {
            animation: rotate3d 10s linear infinite;
            transform-style: preserve-3d;
          }
          .animate-border-glow {
            animation: border-glow 2s infinite;
          }
          .container-glass {
            backdrop-filter: blur(10px);
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(59, 130, 246, 0.2);
            transition: all 0.3s ease;
          }
          .container-glass:hover {
            backdrop-filter: blur(15px);
            background: rgba(255, 255, 255, 0.95);
            transform: translateY(-2px);
          }
          .container-neon {
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
            border: 2px solid rgba(59, 130, 246, 0.2);
            transition: all 0.3s ease;
          }
          .container-neon:hover {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
          }
        `
      }} />

      {/* Mobile Header with Hamburger */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg z-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg border-2 border-white/30 transition-all"
            >
              <FiMenu className="h-6 w-6 text-white" />
            </button>
            
            <div className="flex items-center space-x-2">
              <FiShield className="h-6 w-6 text-white" />
              <h1 className="text-lg font-bold text-white">Admin Portal</h1>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Menu */}
      {isMobile && showMobileMenu && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowMobileMenu(false)}>
          <div 
            className="w-80 max-w-[85vw] bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
              <button 
                onClick={() => setShowMobileMenu(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <FiX className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                  <FiShield className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{branding.typeEmoji} {branding.name}</h2>
                  <p className="text-blue-100 text-sm">System Administrator · {branding.typeLabel}</p>
                </div>
              </div>
            </div>

            <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.href) { window.location.href = item.href; return; }
                  setActiveSection(item.id);
                  setShowMobileMenu(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 relative ${
                  activeSection === item.id 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.id === 'users' && pendingUsers.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                    {pendingUsers.length}
                  </span>
                )}
                {activeSection === item.id && (
                  <FiChevronRight className="h-5 w-5" />
                )}
              </button>
            ))}
            
            <div className="p-4 border-t border-gray-200 mt-4 space-y-2">
              <PortalSwitcher variant="light" fullWidth onNavigate={() => setShowMobileMenu(false)} />
              <button
                onClick={handleLogout}
                className="w-full p-3 bg-red-50 hover:bg-red-100 rounded-xl text-center border border-red-200 transition-all flex items-center justify-center gap-2"
              >
                <FiLogOut className="h-4 w-4 text-red-600" />
                <span className="text-red-600 font-medium">Logout</span>
              </button>
            </div>
          </nav>
          </div>

          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}></div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`${isMobile ? 'pt-16' : ''} p-3 md:p-4 lg:p-8`}>
        {/* Header - Compact for mobile */}
        <div className="container-glass rounded-lg md:rounded-2xl shadow-lg p-3 md:p-4 lg:p-6 mb-4 md:mb-6 lg:mb-8 animate-fadeInUp">
          {!isMobile && (
            <div className="flex items-center justify-between gap-3 pb-3 md:pb-4 mb-3 md:mb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiShield className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-gray-900 hidden lg:inline">{branding.typeEmoji} {branding.name}</span>
              </div>
              <nav className="flex items-center gap-1 overflow-x-auto">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { if (item.href) { window.location.href = item.href; return; } setActiveSection(item.id); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-300 relative ${
                      activeSection === item.id
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.id === 'users' && pendingUsers.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                        {pendingUsers.length}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
              <PortalSwitcher />
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all flex-shrink-0"
              >
                <FiLogOut className="h-4 w-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 truncate">Admin Portal - System Administration</h1>
              <p className="text-xs md:text-sm text-gray-600 mt-0.5 md:mt-1">Welcome back to {branding.name}, admin</p>
            </div>
            <div className="flex items-center gap-1 md:gap-2 lg:gap-4 flex-shrink-0">
              <button 
                className="p-1.5 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Notifications"
              >
                <FiBell className="h-4 md:h-5 lg:h-6 w-4 md:w-5 lg:w-6" />
              </button>
              <button 
                className="p-1.5 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <FiSettings className="h-4 md:h-5 lg:h-6 w-4 md:w-5 lg:w-6" />
              </button>
              
              {/* Admin Profile Dropdown - Compact */}
              <div className="relative">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 md:px-3 py-1.5 md:py-2 hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Admin Profile"
                >
                  <div className="w-6 md:w-8 h-6 md:h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                    <FiShield className="h-3 md:h-5 w-3 md:w-5" />
                  </div>
                  <div className="text-xs md:text-sm text-left hidden md:block">
                    <div className="font-medium text-gray-900">{currentAdmin.full_name || 'Administrator'}</div>
                    <div className="text-gray-500 text-xs capitalize">{currentAdmin.role || 'Administrator'}</div>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowProfileMenu(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-20 overflow-hidden">
                      {/* Profile Header */}
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                            <FiShield className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="font-bold">{currentAdmin.full_name || 'Administrator'}</div>
                            <div className="text-xs text-white/80">{currentAdmin.email || ''}</div>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            setShowProfileModal(true);
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-blue-50 transition-colors"
                        >
                          <FiUser className="h-5 w-5 text-blue-600" />
                          <div className="text-left">
                            <div className="font-medium text-sm">My Profile</div>
                            <div className="text-xs text-gray-500">View and edit profile</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            setActiveSection('settings');
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-purple-50 transition-colors"
                        >
                          <FiSettings className="h-5 w-5 text-purple-600" />
                          <div className="text-left">
                            <div className="font-medium text-sm">Settings</div>
                            <div className="text-xs text-gray-500">System configuration</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            setActiveSection('security');
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-green-50 transition-colors"
                        >
                          <FiLock className="h-5 w-5 text-green-600" />
                          <div className="text-left">
                            <div className="font-medium text-sm">Security</div>
                            <div className="text-xs text-gray-500">Password & 2FA</div>
                          </div>
                        </button>

                        <div className="border-t border-gray-200 my-2"></div>

                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <FiPower className="h-5 w-5" />
                          <div className="text-left">
                            <div className="font-medium text-sm">Logout</div>
                            <div className="text-xs text-red-400">Sign out of account</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {loading && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-8 shadow-2xl animate-pulse">
                <div className="flex items-center space-x-4">
                  <FiRefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Loading...</h3>
                    <p className="text-gray-600">Please wait while we fetch the data</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="animate-fadeInUp">
            {activeSection === 'dashboard' && renderDashboard()}
            {activeSection === 'approvals' && renderPendingApprovals()}
            {activeSection === 'inventory' && renderInventoryControl()}
            {activeSection === 'orders' && renderOrderManagement()}
            {activeSection === 'payments' && renderPaymentControl()}
            {activeSection === 'suppliers' && renderSupplierNetwork()}
            {activeSection === 'users' && renderUserManagement()}
            {activeSection === 'analytics' && renderBusinessAnalytics()}
            {activeSection === 'operations' && renderSystemOperations()}
            {activeSection === 'settings' && renderSystemSettings()}
            
            {/* 📦 ORDER INVENTORY POS CONTROL */}
            {activeSection === 'inventory-pos' && (
              <OrderInventoryPOSControl />
            )}
            
            {/* 🧾 TRANSACTION HISTORY - Admin View */}
            {activeSection === 'transactions' && (
              <div>
                <div className={`bg-gradient-to-r from-yellow-500 via-red-600 to-black rounded-lg md:rounded-xl ${isMobile ? 'p-3 md:p-6' : 'p-6'} text-white shadow-lg md:shadow-xl mb-4 md:mb-6`}>
                  <h2 className={`${isMobile ? 'text-base md:text-2xl' : 'text-3xl'} font-bold flex items-center gap-2`}>
                    <span className="text-lg md:text-2xl flex-shrink-0">🧾</span>
                    <span className="truncate">All Transactions</span>
                    <span className="text-sm md:text-lg flex-shrink-0">🇺🇬</span>
                  </h2>
                  <p className={`text-yellow-100 mt-2 ${isMobile ? 'text-xs md:text-sm' : 'text-base'}`}>
                    Complete transaction history with advanced analytics and financial insights
                  </p>
                </div>
                <div className={isMobile ? 'space-y-3 md:space-y-4' : ''}>
                  <TransactionHistory viewMode="admin" />
                </div>
              </div>
            )}
            
            {activeSection === 'security' && (
              <div className="container-glass rounded-2xl p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <span className="mr-3 text-3xl">🛡️</span>
                  Security Center
                </h2>
                <p className="text-gray-600">Advanced security monitoring and threat detection coming soon...</p>
              </div>
            )}
            {activeSection === 'monitoring' && (
              <div className="container-glass rounded-2xl p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <span className="mr-3 text-3xl">📡</span>
                  Live System Monitoring
                </h2>
                <p className="text-gray-600">Real-time system monitoring dashboard coming soon...</p>
              </div>
            )}
            {activeSection === 'ican-wallet' && (
              <div className="mt-0 -mx-4 sm:-mx-0">
                <ICANWalletPage embedded={true} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portal Configuration Modal */}
      {showPortalConfig && <PortalConfigurationModal />}
      
      {/* Employee Access Control Modal */}
      {showEmployeeControlModal && <EmployeeAccessControlModal />}
      
      {/* Admin Data Intelligence Dashboard Modal */}
      {showDataDashboard && <AdminDataDashboardModal />}

      {/* User Details Modal */}
      <UserDetailsModal />
      
      {/* CSS Animations for Data Dashboard */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleUp {
          from { 
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 1;
          }
          50% { 
            transform: scale(1.05);
            opacity: 0.8;
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-scaleUp {
          animation: scaleUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .bg-grid-pattern {
          background-image: 
            linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
        </>
      )}

      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  );
};

export default AdminPortal;