import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import ClockSkewNotification from '@/components/ClockSkewNotification';

// Pages and Components
import AdminPortal from '@/pages/AdminPortal';
import AdminProfile from '@/pages/AdminProfile';
import AdminAuth from '@/pages/AdminAuth';
import ManagerAuth from '@/pages/ManagerAuth';
import CashierAuth from '@/pages/CashierAuth';
import EmployeeAuth from '@/pages/EmployeeAuth';
import SupplierAuth from '@/pages/SupplierAuth';
import ManagerPortal from '@/pages/ManagerPortal';
import CashierPortal from '@/pages/CushierPortal';
import EmployeePortal from '@/pages/cashier portal';
import SupplierPortal from '@/pages/SupplierPortal';
import PortalLanding from '@/pages/PortalLanding';
import PaymentDashboard from '@/components/PaymentDashboard';
import Products from '@/pages/Products';
import Sales from '@/pages/Sales';
import Customers from '@/pages/Customers';
import Employees from '@/pages/Employees';
import Suppliers from '@/pages/Suppliers';
import Inventory from '@/pages/Inventory';
import Reports from '@/pages/Reports';
import POS from '@/pages/POS';
import CustomerDashboard from '@/pages/CustomerDashboard';
import CustomerPayment from '@/pages/CustomerPayment';
import CustomerDelivery from '@/pages/CustomerDelivery';

// Styles
import 'react-toastify/dist/ReactToastify.css';

// ============================================================
// CRITICAL: Prevent redirect to Farm Agent
// Set app context immediately on app load
// ============================================================
(() => {
  // This runs BEFORE anything else in the app
  localStorage.setItem('current_app', 'digital-city-era');
  localStorage.setItem('app_load_time', Date.now().toString());
  
  // Clear any Farm Agent session data that might cause redirect
  localStorage.removeItem('farm_agent_session');
  localStorage.removeItem('farm_agent_user');
  sessionStorage.removeItem('farm_agent_session');
  
  console.log('✅ [APP] Digital City Era context set. Farm Agent redirect prevention enabled.');
  
  // ============================================================
  // CRITICAL: Handle OAuth callback BEFORE React Router loses the hash
  // ============================================================
  if (window.location.hash.includes('access_token=')) {
    console.log('🔑 [APP] OAuth token detected in URL hash!');
    const currentPortal = localStorage.getItem('current_portal') || 'cashier';
    const targetPath = `/${currentPortal}-auth`;
    
    // If we're at root path, redirect to auth page while PRESERVING the hash
    if (window.location.pathname === '/' || window.location.pathname === '') {
      console.log('🔄 [APP] Redirecting to', targetPath, 'with OAuth hash preserved');
      // Use window.location to preserve the hash
      window.location.href = targetPath + window.location.hash;
    }
  }
})();

function App() {
  // Validate if current URL is allowed for admin access
  // Only allow admin routes from hash-based navigation: /#admin
  const isAdminAccessAllowed = () => {
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    
    // Only allow admin if:
    // 1. Hash is #admin or #/admin (hash routing for admin)
    // 2. OR pathname includes /admin (direct navigation to /admin-login, /admin-portal, etc.)
    return hash === '#admin' || hash === '#/admin' || pathname.includes('/admin');
  };

  // CRITICAL: Monitor for any redirect attempts away from Digital City Era
  useEffect(() => {
    const monitorRedirects = () => {
      const currentUrl = window.location.href.toLowerCase();
      
      // If we somehow ended up on Farm Agent specifically, redirect back
      if (currentUrl.includes('farm-agent.vercel.app')) {
        console.warn('🚨 ALERT: Detected redirect to Farm Agent!', currentUrl);
        console.log('🔄 Redirecting back to Digital City Era...');
        
        const portal = localStorage.getItem('current_portal') || 'manager';
        const protocol = window.location.protocol;
        const host = window.location.host;
        window.location.href = `${protocol}//${host}/${portal}-auth`;
      }
    };
    
    // Check on mount and set interval to monitor
    monitorRedirects();
    const interval = setInterval(monitorRedirects, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Redirect if hash is #admin to proper admin login route
  useEffect(() => {
    if (window.location.hash === '#admin') {
      window.location.hash = '#/admin-login';
    }
  }, []);

  // Simple admin access check
  const checkAdminAccess = () => {
    const isAdminRoute = isAdminAccessAllowed();
    return isAdminRoute;
  };

  // Set admin mode based on URL
  useEffect(() => {
    const setAdminMode = () => {
      try {
        const isAdmin = checkAdminAccess();
        
        if (isAdmin) {
          // Set admin flag only if on actual admin routes
          localStorage.setItem('adminKey', 'true');
        } else {
          // Clear admin flag when not on admin routes
          localStorage.removeItem('adminKey');
        }
      } catch (error) {
        console.log('Admin mode setup:', error);
      }
    };
    setAdminMode();
  }, [window.location.search, window.location.hash, window.location.pathname]);

  const isAdmin = checkAdminAccess();

  // Check for OAuth callback tokens in URL hash
  const hasOAuthToken = window.location.hash.includes('access_token=');
  const currentPortal = localStorage.getItem('current_portal');

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <ClockSkewNotification />
          <div className={`app-container ${isAdmin ? 'admin-mode' : 'standard-mode'}`}>
            <Routes>
              {/* Main landing with portal selection - but check for OAuth callback first */}
              <Route 
                path="/" 
                element={
                  // If OAuth token in hash, redirect to the appropriate auth page
                  hasOAuthToken && currentPortal
                    ? <Navigate to={`/${currentPortal}-auth`} replace />
                    : window.location.hash === '#admin' || window.location.hash === '#/admin' 
                      ? <Navigate to="/admin-login" replace /> 
                      : <Navigate to="/portal-selection" replace />
                } 
              />
              
              {/* Admin authentication routes - always accessible */}
              <Route path="/admin-login" element={<AdminAuth />} />
              <Route path="/admin-auth" element={<AdminAuth />} />
              <Route path="/admin-signup" element={<AdminAuth />} />
              <Route path="/admin" element={<Navigate to="/admin-login" replace />} />
              
              {/* Manager authentication routes */}
              <Route path="/manager-login" element={<ManagerAuth />} />
              <Route path="/manager-auth" element={<ManagerAuth />} />
              <Route path="/manager-signup" element={<ManagerAuth />} />
              
              {/* Cashier authentication routes */}
              <Route path="/cashier-login" element={<CashierAuth />} />
              <Route path="/cashier-auth" element={<CashierAuth />} />
              <Route path="/cashier-signup" element={<CashierAuth />} />
              
              {/* Employee authentication routes */}
              <Route path="/employee-login" element={<EmployeeAuth />} />
              <Route path="/employee-auth" element={<EmployeeAuth />} />
              <Route path="/employee-signup" element={<EmployeeAuth />} />
              
              {/* Supplier authentication routes */}
              <Route path="/supplier-login" element={<SupplierAuth />} />
              <Route path="/supplier-auth" element={<SupplierAuth />} />
              <Route path="/supplier-signup" element={<SupplierAuth />} />
              
              {/* Admin routes - protected, require authentication */}
              <Route 
                path="/admin-portal" 
                element={
                  <AdminProtectedRoute>
                    <AdminPortal />
                  </AdminProtectedRoute>
                } 
              />
              <Route 
                path="/system-admin" 
                element={
                  <AdminProtectedRoute>
                    <AdminPortal />
                  </AdminProtectedRoute>
                } 
              />
              <Route 
                path="/admin-dashboard" 
                element={
                  <AdminProtectedRoute>
                    <AdminPortal />
                  </AdminProtectedRoute>
                } 
              />
              <Route 
                path="/admin-profile" 
                element={
                  <AdminProtectedRoute>
                    <AdminProfile />
                  </AdminProtectedRoute>
                } 
              />
              
              {/* Direct access to all portals */}
              <Route path="/portal-selection" element={<PortalLanding />} />
              
              {/* Main portals - directly accessible */}
              <Route path="/manager-portal" element={<ManagerPortal />} />
              <Route path="/manager" element={<ManagerPortal />} />
              
              <Route path="/cashier-portal" element={<CashierPortal />} />
              <Route path="/cashier" element={<CashierPortal />} />
              
              <Route path="/employee-portal" element={<EmployeePortal />} />
              <Route path="/employee" element={<EmployeePortal />} />
              
              <Route path="/supplier-portal" element={<SupplierPortal />} />
              <Route path="/supplier" element={<SupplierPortal />} />
              
              <Route path="/customer-portal" element={<CustomerDashboard />} />
              <Route path="/customer-dashboard" element={<CustomerDashboard />} />
              
              {/* Operational features - accessible to all */}
              <Route path="/pos" element={<POS />} />
              <Route path="/products" element={<Products />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/reports" element={<Reports />} />
              
              {/* Customer services - directly accessible */}
              <Route path="/customer-payment" element={<CustomerPayment />} />
              <Route path="/customer-delivery" element={<CustomerDelivery />} />
              <Route path="/payment-dashboard" element={<PaymentDashboard />} />
              
              {/* Fallback route */}
              <Route 
                path="*" 
                element={
                  isAdmin 
                    ? <Navigate to="/admin-portal" replace />
                    : <Navigate to="/portal-selection" replace />
                } 
              />
            </Routes>
            
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
          </div>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
