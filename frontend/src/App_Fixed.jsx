import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
// import { AuthProvider } from './contexts/AuthContext'; // Disabled for demo
import { AppProvider } from './contexts/AppContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import FloatingScanner from './components/FloatingScanner';
// import ProtectedRoute from './components/ProtectedRoute'; // Disabled for demo
// import Login from './pages/Login'; // Disabled for demo
// import CustomerLogin from './pages/CustomerLogin'; // Disabled for demo
// import Unauthorized from './pages/Unauthorized'; // Disabled for demo
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import Employees from './pages/Employees';
import Suppliers from './pages/Suppliers';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import POS from './pages/POS';
import CustomerPayment from './pages/CustomerPayment';
import CustomerDelivery from './pages/CustomerDelivery';
import CustomerLanding from './pages/CustomerLanding';
import CustomerDashboard from './pages/CustomerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerPortal from './pages/ManagerPortal';
import CashierPortal from './pages/cashier portal';
import SupplierPortal from './pages/SupplierPortal';
import PortalLanding from './pages/PortalLanding';
import PortalTest from './pages/PortalTest';
import MainLanding from './pages/MainLanding';
import PaymentDashboard from './components/PaymentDashboard';

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <div>
          <Routes>
            {/* Main Landing Page */}
            <Route path="/" element={<MainLanding />} />
            
            {/* Public routes - disabled for demo */}
            {/* <Route path="/login" element={<Login />} /> */}
            {/* <Route path="/customer-login" element={<CustomerLogin />} /> */}
            {/* <Route path="/unauthorized" element={<Unauthorized />} /> */}
            
            {/* Customer-facing interfaces (no layout) */}
            <Route path="/customer-payment" element={<CustomerPayment />} />
            <Route path="/customer-delivery" element={<CustomerDelivery />} />
            <Route path="/customer" element={<CustomerLanding />} />
            <Route path="/payment-dashboard" element={<PaymentDashboard />} />
            
            {/* Customer routes (no protection for now) */}
            <Route path="/customer-dashboard" element={<CustomerDashboard />} />
            
            {/* Employee routes (no protection for now) */}
            <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
            
            {/* Professional Portals */}
            <Route path="/portals" element={<PortalLanding />} />
            <Route path="/portal-test" element={<PortalTest />} />
            <Route path="/manager-portal" element={<ManagerPortal />} />
            <Route path="/employee-portal" element={<CashierPortal />} />
            <Route path="/cashier-portal" element={<CashierPortal />} />
            <Route path="/supplier-portal" element={<SupplierPortal />} />

            {/* Main application routes with Layout wrapper */}
            <Route
              path="/dashboard"
              element={
                <Layout>
                  <Dashboard />
                </Layout>
              }
            />
            <Route
              path="/pos"
              element={
                <Layout>
                  <POS />
                </Layout>
              }
            />
            <Route
              path="/products"
              element={
                <Layout>
                  <Products />
                </Layout>
              }
            />
            <Route
              path="/sales"
              element={
                <Layout>
                  <Sales />
                </Layout>
              }
            />
            <Route
              path="/customers"
              element={
                <Layout>
                  <Customers />
                </Layout>
              }
            />
            <Route
              path="/employees"
              element={
                <Layout>
                  <Employees />
                </Layout>
              }
            />
            <Route
              path="/suppliers"
              element={
                <Layout>
                  <Suppliers />
                </Layout>
              }
            />
            <Route
              path="/inventory"
              element={
                <Layout>
                  <Inventory />
                </Layout>
              }
            />
            <Route
              path="/reports"
              element={
                <Layout>
                  <Reports />
                </Layout>
              }
            />
          </Routes>
          
          {/* Global Floating Scanner - Available on all pages */}
          <FloatingScanner />
          
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
    </ErrorBoundary>
  );
}

export default App;
