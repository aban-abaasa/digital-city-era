import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import ClockSkewNotification from '@/components/ClockSkewNotification';

// Pages and Components
import AdminPortal from '@/pages/AdminPortal';
import AdminProfile from '@/pages/AdminProfile';
import CustomerLogin from '@/pages/CustomerLogin';
import EmployeeAuth from '@/pages/EmployeeAuth';
import UnifiedAuth from '@/pages/UnifiedAuth';
import ManagerPortal from '@/pages/ManagerPortal';
import CashierPortal from '@/pages/CushierPortal';
import EmployeePortal from '@/pages/cashier portal';
import SupplierPortal from '@/pages/SupplierPortal';
import SupplierAuth from '@/pages/SupplierAuth';
import SupermartkeraLanding from '@/pages/SupermartkeraLanding';
import AdminAuth from '@/pages/AdminAuth';
import AuthCallback from '@/pages/AuthCallback';
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
import ICANWalletPage from '@/pages/ICANWalletPage';

// Styles
import 'react-toastify/dist/ReactToastify.css';

// ============================================================
// CRITICAL: Prevent redirect to Farm Agent
// Set app context immediately on app load
// ============================================================
(() => {
  // This runs BEFORE anything else in the app
  localStorage.setItem('current_app', 'supermartkera');
  localStorage.setItem('app_load_time', Date.now().toString());
  
  // Clear any Farm Agent session data that might cause redirect
  localStorage.removeItem('farm_agent_session');
  localStorage.removeItem('farm_agent_user');
  sessionStorage.removeItem('farm_agent_session');
  
  console.log('✅ [APP] Supermartkera context set. Farm Agent redirect prevention enabled.');
  
  // ============================================================
  // CRITICAL: Handle OAuth callback BEFORE React Router loses the hash
  // ============================================================
  if (window.location.hash.includes('access_token=')) {
    console.log('🔑 [APP] OAuth token detected in URL hash!');
    const targetPath = '/auth/callback';
    
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

  // CRITICAL: Monitor for any redirect attempts away from Supermartkera
  useEffect(() => {
    const monitorRedirects = () => {
      const currentUrl = window.location.href.toLowerCase();
      
      // If we somehow ended up on Farm Agent specifically, redirect back
      if (currentUrl.includes('farm-agent.vercel.app')) {
        console.warn('🚨 ALERT: Detected redirect to Farm Agent!', currentUrl);
        console.log('🔄 Redirecting back to Supermartkera...');

        const protocol = window.location.protocol;
        const host = window.location.host;
        window.location.href = `${protocol}//${host}/login`;
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

  return (
    <ErrorBoundary>
      <ThemeProvider>
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
                    hasOAuthToken
                    ? <Navigate to="/auth/callback" replace />
                    : window.location.hash === '#admin' || window.location.hash === '#/admin' 
                      ? <Navigate to="/admin-login" replace /> 
                      : <SupermartkeraLanding />
                } 
              />

              <Route path="/login" element={<CustomerLogin />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/customer-login" element={<Navigate to="/login" replace />} />
              <Route path="/dashboard" element={<Navigate to="/customer-dashboard" replace />} />
              
              {/* Admin authentication routes - always accessible */}
              <Route path="/admin-login" element={<UnifiedAuth />} />
              <Route path="/admin-auth" element={<AdminAuth />} />
              <Route path="/admin-setup" element={<AdminAuth />} />
              <Route path="/admin-signup" element={<UnifiedAuth />} />
              <Route path="/admin" element={<Navigate to="/admin-login" replace />} />
              
              {/* Shared authentication routes */}
              <Route path="/manager-login" element={<UnifiedAuth />} />
              <Route path="/manager-auth" element={<UnifiedAuth />} />
              <Route path="/manager-signup" element={<UnifiedAuth />} />
              <Route path="/cashier-login" element={<UnifiedAuth />} />
              <Route path="/cashier-auth" element={<UnifiedAuth />} />
              <Route path="/cashier-signup" element={<UnifiedAuth />} />
              <Route path="/employee-login" element={<EmployeeAuth />} />
              <Route path="/employee-auth" element={<EmployeeAuth />} />
              <Route path="/employee-signup" element={<EmployeeAuth />} />
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
              
              {/* Main role pages - directly accessible */}
              <Route path="/manager-portal" element={<ManagerPortal />} />
              <Route path="/manager" element={<ManagerPortal />} />
              
              <Route path="/cashier-portal" element={<CashierPortal />} />
              <Route path="/cashier" element={<CashierPortal />} />
              
              <Route path="/employee-portal" element={<EmployeePortal />} />
              <Route path="/employee" element={<EmployeePortal />} />
              
              <Route path="/supplier-portal" element={<SupplierPortal />} />
              <Route path="/supplier" element={<SupplierPortal />} />
              
              <Route path="/customer-portal" element={<CustomerDashboard />} />
              <Route path="/customer" element={<CustomerDashboard />} />
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
              <Route path="/ican-wallet" element={<ICANWalletPage />} />
              
              {/* Fallback route */}
              <Route 
                path="*" 
                element={
                  isAdmin 
                    ? <Navigate to="/admin-portal" replace />
                    : <Navigate to="/" replace />
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
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
