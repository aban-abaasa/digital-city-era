# 🎯 FAREDEAL APPLICATION - COMPLETE UNDERSTANDING

## 📊 APPLICATION OVERVIEW

**Faredeal** is a comprehensive **Point of Sale (POS) System** built for Uganda, designed to manage retail operations with multi-role access and payment integration.

---

## 🏗️ SYSTEM ARCHITECTURE

### **Frontend Structure** (React + Vite)
```
frontend/
├── src/
│   ├── pages/
│   │   ├── MainLanding.jsx          # Main entry point
│   │   ├── PortalLanding.jsx        # Portal selection page
│   │   ├── AdminAuth.jsx            # Admin login/signup
│   │   ├── AdminPortal.jsx          # Admin dashboard
│   │   ├── ManagerAuth.jsx          # Manager login/signup
│   │   ├── ManagerPortal.jsx        # Manager dashboard
│   │   ├── CashierAuth.jsx          # Cashier login/signup
│   │   ├── CashierPortal.jsx        # Cashier dashboard (POS)
│   │   ├── EmployeeAuth.jsx         # Employee login/signup
│   │   ├── EmployeePortal.jsx       # Employee dashboard
│   │   ├── SupplierAuth.jsx         # Supplier login/signup
│   │   ├── SupplierPortal.jsx       # Supplier dashboard
│   │   └── CustomerLanding.jsx      # Customer interface
│   │
│   ├── components/
│   │   ├── Layout.jsx               # Main layout wrapper
│   │   ├── PortalNavigation.jsx     # Role-based navigation
│   │   ├── AdminProtectedRoute.jsx  # Route protection
│   │   ├── ProductInventoryInterface.jsx
│   │   ├── TransactionHistory.jsx
│   │   ├── OrderInventoryPOSControl.jsx
│   │   ├── SupplierOrderManagement.jsx
│   │   ├── TillSuppliesOrderManagement.jsx
│   │   └── ... (many more)
│   │
│   ├── services/
│   │   ├── supabase.js              # Supabase client
│   │   ├── notificationService.js   # Toast notifications
│   │   ├── portalConfigService.js   # Portal configuration
│   │   ├── employeeAccessService.js # Employee access control
│   │   └── supplierOrdersService.js # Supplier orders API
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx          # Authentication state
│   │   ├── PortalConfigContext.jsx  # Portal config state
│   │   └── EmployeeAccessContext.jsx # Employee access state
│   │
│   ├── App.jsx                      # Main routing
│   └── main.jsx                     # Entry point
│
├── package.json
├── vite.config.js
└── README.md
```

### **Backend Structure** (Node.js + Express)
```
backend/
├── src/
│   ├── index.js                     # Main server entry
│   ├── setup-application-database.js # DB initialization
│   ├── config/                      # Configuration files
│   ├── routes/                      # API endpoints
│   ├── middleware/                  # Express middleware
│   ├── services/
│   │   ├── cashierOrdersService.js
│   │   ├── supplierOrdersService.js
│   │   └── ... (business logic)
│   └── utils/                       # Utility functions
│
├── database/
│   ├── FIX_GOOGLE_OAUTH_AUTO_RECORD.sql  # New RPC functions
│   ├── STEP_0_ADD_ASSIGNED_ADMIN_COLUMN.sql
│   ├── ADMIN_SCHEMA_SETUP.md
│   ├── ADMIN_SCHEMA_SUMMARY.md
│   └── supplier-schema.sql
│
├── .env                             # Environment variables
├── package.json
└── README.md
```

---

## 👥 USER ROLES & PORTALS

| Role | Portal | Features |
|------|--------|----------|
| **Admin** | `/admin-portal` | User management, system configuration, analytics, employee access control |
| **Manager** | `/manager-portal` | Order management, inventory tracking, team performance, financial analytics, supplier orders, till supplies |
| **Cashier** | `/cashier-portal` or `/employee-portal` | POS system, transaction history, daily metrics, performance stats, till supplies ordering |
| **Employee** | `/employee-portal` | Dashboard, profile management, till supplies requests |
| **Supplier** | `/supplier-portal` | Order fulfillment, delivery tracking, communication |
| **Customer** | `/customer` | Payment processing, delivery tracking |

---

## 🔐 AUTHENTICATION FLOW

### **Current Issue (FIXED)**
- **Problem**: Google OAuth error "Manager, Cashier, and Employee users must be assigned to a supermarket"
- **Root Cause**: Old RPC function validating non-existent `supermarket_id` column
- **Solution**: New RPC functions with `assigned_admin_id` instead

### **Auth Process**
1. User selects role → Navigates to `/[role]-auth`
2. Signs in via Google OAuth (Supabase)
3. Auth trigger creates `public.users` record automatically
4. User redirected to profile completion form
5. Profile form calls RPC: `update_manager_profile_on_submission()`
6. RPC auto-assigns admin and sets `profile_completed=true, is_active=false`
7. User enters pending status until admin approves

---

## 📊 DATABASE SCHEMA (94 Tables)

### **Core Tables** (Essential)
- **users** - All user accounts with roles (admin, manager, cashier, supplier, employee, customer)
- **auth.users** - Supabase authentication table (auto-linked)

### **Admin Management** (11 tables)
- admin_access_requests
- admin_activity_log
- admin_dashboard_metrics
- admin_notifications
- admin_system_config
- admin_config_history
- admin_portal_config
- admin_payment_audit
- admin_system_health
- admin_api_usage
- admin_error_logs

### **Manager Functions** (13 tables)
- manager_activity_log / manager_activity_logs
- manager_alerts
- manager_customer_complaints
- manager_daily_reports
- manager_employee_attendance
- manager_employee_schedules
- manager_performance_metrics
- manager_profiles
- manager_sales_analysis
- manager_stock_requests
- manager_team_members / manager_team_performance
- manager_teams

### **Cashier Functions** (15 tables)
- cashier_activity_log
- cashier_alerts
- cashier_daily_stats
- cashier_drawer_operations
- cashier_evaluations
- cashier_kpis
- cashier_order_items
- cashier_orders
- cashier_performance
- cashier_preferences
- cashier_profiles
- cashier_returns
- cashier_shifts
- cashier_training
- cashier_transactions

### **Inventory System** (5 tables)
- categories
- products
- inventory
- inventory_metrics
- inventory_real_time_metrics / inventory_system_audit / inventory_system_status

### **Orders & Transactions** (8 tables)
- orders
- order_items / order_history
- sales
- sales_transaction_items
- sales_transactions
- purchase_orders

### **Payments** (5 tables)
- payments
- payment_transactions
- payment_installments
- payment_metrics

### **Supplier Management** (10 tables)
- suppliers
- supplier_activity_log
- supplier_alerts
- supplier_communications
- supplier_deliveries
- supplier_invoices
- supplier_payments
- supplier_performance
- supplier_products
- supplier_profiles

### **Supermarket/Branch** (6 tables)
- supermarkets
- supermarket_admin_users
- supermarket_branches
- supermarket_inventory
- supermarket_staff
- supermarket_suppliers / supermarket_users

### **Other Systems** (11+ tables)
- products, categories, customers, product_ratings
- employee_attendance, staff_profiles, staff_schedules, staff_goals, staff_achievements
- notifications, system_settings, daily_sales_reports
- balance_adjustments, performance_metrics, receipt_print_log, till_supplies_inventory, training_records
- avatar_images, quick_access_items, quick_access_sections

---

## 🔌 SUPABASE CONFIGURATION

### **Project Details**
- **URL**: https://zwmupgbixextqlexknnu.supabase.co
- **Project ID**: zwmupgbixextqlexknnu
- **Database**: PostgreSQL (Supabase managed)
- **Authentication**: Google OAuth 2.0

### **Current Status**
- ✅ All 94 tables DROPPED (cleared schema)
- ✅ Ready for fresh deployment
- ✅ Credentials in `backend/.env` file

### **Environment Variables** (backend/.env)
```
SUPABASE_URL=https://zwmupgbixextqlexknnu.supabase.co
SUPABASE_ANON_KEY=[JWT Token for public access]
SUPABASE_SERVICE_KEY=[JWT Token for admin/server access]
PORT=3001
NODE_ENV=development
JWT_SECRET=faredeal_super_secret_key_2024_make_this_very_long_and_random
JWT_EXPIRES_IN=7d
BUSINESS_NAME=FAREDEAL
BUSINESS_CURRENCY=UGX
BUSINESS_TAX_RATE=18
BUSINESS_COUNTRY=Uganda
```

---

## 🚀 KEY FEATURES

### **POS System** (Cashier Portal)
- Real-time product scanning
- Multiple payment methods (MTN Mobile Money, Airtel Money, Card, Cash, Bank Transfer)
- Receipt generation
- Transaction history
- Daily performance metrics

### **Inventory Management** (Manager Portal)
- Real-time stock tracking
- Product categorization
- Low stock alerts
- Inventory audit trails
- Stock movement history

### **Order Management**
- Manager creates orders → Supplier fulfills
- Till supplies ordering system
- Order approval workflow
- Delivery tracking

### **Employee/Cashier Management**
- Time attendance tracking
- Performance KPIs
- Sales metrics
- Role-based access control
- Employee training records

### **Financial Analytics**
- Daily sales reports
- Payment method breakdown
- Revenue trends
- Payment audit trails
- Business metrics dashboard

### **Security**
- Row Level Security (RLS) policies
- Role-based access control
- Audit logs for all changes
- Secure password handling
- Activity tracking

### **Uganda-Specific Features**
- UGX currency
- Local payment integrations (MTN, Airtel)
- Uganda branch/supermarket support
- Supplier network in Uganda

---

## 📝 DEPLOYMENT READINESS

### **Files Ready to Deploy**
```
✅ FIX_GOOGLE_OAUTH_AUTO_RECORD.sql        (455 lines - RPC functions)
✅ STEP_0_ADD_ASSIGNED_ADMIN_COLUMN.sql    (Schema columns)
✅ Database schema (94 tables)
✅ Frontend (React Vite)
✅ Backend (Node.js)
```

### **Deployment Steps**
1. ✅ DROP all tables (DONE)
2. Run STEP_0_ADD_ASSIGNED_ADMIN_COLUMN.sql
3. Run FIX_GOOGLE_OAUTH_AUTO_RECORD.sql
4. Create initial admin user
5. Test Google OAuth flow
6. Deploy frontend & backend
7. Configure payment integrations

---

## 🔧 TECHNOLOGIES USED

### **Frontend**
- React 18
- React Router v6
- Tailwind CSS
- Recharts (analytics)
- React Icons
- Vite (build tool)
- Supabase JS Client

### **Backend**
- Node.js
- Express.js
- PostgreSQL (via Supabase)
- JWT for authentication
- Nodemon (development)

### **Database**
- Supabase (PostgreSQL managed)
- Row Level Security (RLS)
- Triggers & Functions (plpgsql)
- Real-time subscriptions

---

## 📊 APPLICATION FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN LANDING PAGE                      │
│         (Choose Portal: Admin, Manager, Cashier, etc)       │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼─────┐ ┌──▼────────┐  │
    │ Admin    │ │ Manager   │  │
    │ Portal   │ │ Portal    │  │
    └──────────┘ └───────────┘  │
                                 │
                         ┌───────▼──────┐
                         │ Cashier/     │
                         │ Employee     │
                         │ Portal       │
                         └──────────────┘

Each Portal → Auth (Google OAuth)
            → Profile Completion
            → Admin Approval (except Admin)
            → Access Granted
            → Use Portal Features
```

---

## ✅ NEXT STEPS

1. **Deploy Fresh Schema** (from Supabase SQL Editor)
   - Run: `STEP_0_ADD_ASSIGNED_ADMIN_COLUMN.sql`
   - Run: `FIX_GOOGLE_OAUTH_AUTO_RECORD.sql`

2. **Create Initial Admin User** (SQL Query)
   ```sql
   INSERT INTO public.users (
     email, full_name, role, is_active, phone, department, created_at
   ) VALUES (
     'admin@faredeal.com', 'Admin User', 'admin', true, 
     '0700000000', 'Administration', NOW()
   );
   ```

3. **Test Google OAuth Flow**
   - Go to: http://localhost:5173
   - Click Manager → Sign up with Google
   - Fill profile → Submit
   - Verify in database

4. **Deploy to Production**
   - Frontend: Vercel/Netlify
   - Backend: Heroku/Railway/AWS
   - Configure environment variables

---

## 🎯 KEY INSIGHTS

✅ **Multi-role system**: 6 different user types with specific portals
✅ **Comprehensive POS**: Full retail management capabilities
✅ **Admin approval workflow**: New users must be approved before access
✅ **Real-time tracking**: Inventory, sales, and metrics updates
✅ **Uganda-focused**: Local payment methods and currency
✅ **Secure architecture**: RLS, audit logs, role-based access
✅ **Scalable database**: 94 tables covering all business operations
✅ **Modern tech stack**: React, Node.js, PostgreSQL, Supabase

---

## 📞 SUPPORT

**Database**: Supabase PostgreSQL
**Auth**: Google OAuth 2.0 + Supabase
**Backend API**: Node.js Express
**Frontend**: React Vite
**Deployment**: Supabase (DB), Vercel/Netlify (Frontend), Server (Backend)

---

**Last Updated**: December 21, 2025
**Status**: Ready for fresh deployment ✅
