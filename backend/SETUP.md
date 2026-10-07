# SUPERMARTKERA Quick Setup Guide

## 🚀 Fast Database Setup

### Step 1: Backend Setup
```bash
cd C:\Users\Aban\Desktop\FD\backend
npm install
npm run setup
```

### Step 2: Execute Schema
1. **Open Supabase Dashboard**: https://supabase.com/dashboard
2. **Go to SQL Editor** in your project
3. **Copy** the contents from: `backend/database/clean-schema.sql`
4. **Paste and Execute** in the SQL Editor

### Step 3: (Optional) Add Sample Data
```bash
npm run seed
```

### Step 4: Start Frontend
```bash
cd C:\Users\Aban\Desktop\FD\frontend
npm run dev
```

## 🔑 Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@supermartkera.co.ug | admin123 |

## 🗄️ Database Tables Created

✅ **users** - User accounts and authentication
✅ **categories** - Product categorization
✅ **suppliers** - Supplier management
✅ **products** - Product catalog
✅ **inventory** - Stock tracking
✅ **sales** - Transaction records
✅ **sale_items** - Transaction details
✅ **employees** - Staff management
✅ **customer_loyalty** - Rewards program
✅ **system_settings** - Configuration

## 🎯 What You Can Do After Setup

- ✨ Login to admin dashboard
- 📦 Add products and manage inventory
- 🏪 Process POS transactions
- 👥 Manage users and employees
- 📊 View sales analytics
- 🔧 Configure system settings

## 🔧 Troubleshooting

**Connection Issues:**
- Verify `.env` file has correct Supabase credentials
- Check Supabase project is active (not paused)

**Schema Errors:**
- Execute `clean-schema.sql` in exact order provided
- Check for any existing conflicting table names

**Frontend Issues:**
- Ensure both `.env` files match Supabase credentials
- Restart dev server after database changes

## 📞 Need Help?
- Check the logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure Supabase project has the necessary permissions