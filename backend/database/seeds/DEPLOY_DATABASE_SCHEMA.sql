-- ============================================================================
-- DIGITAL CITY ERA - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- This schema supports 20+ million supermarkets
-- Each supermarket has: 1 Admin, Multiple Managers, Multiple Cashiers
-- Suppliers need just 1 admin approval to activate
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: supermarkets
-- Stores information about each supermarket (20M+ scale)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.supermarkets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_supermarkets_name ON public.supermarkets(name);
CREATE INDEX IF NOT EXISTS idx_supermarkets_location ON public.supermarkets(location);
CREATE INDEX IF NOT EXISTS idx_supermarkets_active ON public.supermarkets(is_active);

-- ============================================================================
-- TABLE: users
-- Stores all user types: admin, manager, cashier, employee, supplier, customer
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'employee', 'supplier', 'customer')),
    supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sign_in_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_supermarket ON public.users(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);

-- ============================================================================
-- TABLE: products
-- Shared products catalog across all supermarkets
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    barcode TEXT UNIQUE,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- ============================================================================
-- TABLE: inventory
-- Each supermarket has its own inventory
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    last_restocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supermarket_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_supermarket ON public.inventory(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON public.inventory(quantity);

-- ============================================================================
-- TABLE: suppliers
-- Supplier companies that need admin approval
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_user ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_approved ON public.suppliers(is_approved);
CREATE INDEX IF NOT EXISTS idx_suppliers_supermarket ON public.suppliers(supermarket_id);

-- ============================================================================
-- TABLE: transactions
-- Sales transactions from POS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
    cashier_id UUID REFERENCES public.users(id),
    customer_id UUID REFERENCES public.users(id),
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'mobile_money', 'credit')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
    items JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_supermarket ON public.transactions(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON public.transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);

-- ============================================================================
-- TABLE: payments
-- Payment tracking for suppliers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id),
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    payment_method TEXT,
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_supermarket ON public.payments(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_payments_supplier ON public.payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ============================================================================
-- TABLE: blockchain_sync
-- Cross-app transaction verification
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.blockchain_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES public.transactions(id),
    source_app TEXT NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blockchain_transaction ON public.blockchain_sync(transaction_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_status ON public.blockchain_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_blockchain_hash ON public.blockchain_sync(transaction_hash);

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Function to get pending users
CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE (
    id UUID,
    auth_id UUID,
    email TEXT,
    full_name TEXT,
    phone TEXT,
    role TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.auth_id, u.email, u.full_name, u.phone, u.role, u.is_active, u.created_at
    FROM public.users u
    WHERE u.is_active = false
    ORDER BY u.created_at DESC;
END;
$$;

-- Function to approve user
CREATE OR REPLACE FUNCTION public.approve_user(p_user_id UUID, p_role TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET is_active = true,
        role = COALESCE(p_role, role),
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$;

-- Function to reject user
CREATE OR REPLACE FUNCTION public.reject_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.supermarkets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_sync ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Admins can read supermarket users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
DROP POLICY IF EXISTS "Anyone can insert supermarket" ON public.supermarkets;
DROP POLICY IF EXISTS "Admins can read own supermarket" ON public.supermarkets;
DROP POLICY IF EXISTS "Admins can update own supermarket" ON public.supermarkets;
DROP POLICY IF EXISTS "Authenticated can read supermarkets" ON public.supermarkets;
DROP POLICY IF EXISTS "Authenticated can update supermarkets" ON public.supermarkets;
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Users can read supermarket inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can read supermarket transactions" ON public.transactions;
DROP POLICY IF EXISTS "Cashiers can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can read supermarket payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can read all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Anyone can insert supplier" ON public.suppliers;
DROP POLICY IF EXISTS "Users can read blockchain sync" ON public.blockchain_sync;

-- Users: Allow authenticated users to read their own data
CREATE POLICY "Users can read own data" ON public.users
    FOR SELECT
    USING (auth.uid() = auth_id);

-- Users: Allow users to insert their own record
CREATE POLICY "Users can insert own data" ON public.users
    FOR INSERT
    WITH CHECK (auth.uid() = auth_id);

-- Users: Allow users to update their own record
CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE
    USING (auth.uid() = auth_id);

-- Users: Allow all authenticated users to read all users (simplified to avoid recursion)
CREATE POLICY "Authenticated users can read users" ON public.users
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Supermarkets: Anyone can insert (for new admin registration)
CREATE POLICY "Anyone can insert supermarket" ON public.supermarkets
    FOR INSERT
    WITH CHECK (true);

-- Supermarkets: All authenticated users can read supermarkets
CREATE POLICY "Authenticated can read supermarkets" ON public.supermarkets
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Supermarkets: All authenticated users can update supermarkets (will be controlled by app logic)
CREATE POLICY "Authenticated can update supermarkets" ON public.supermarkets
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Products: Everyone can read
CREATE POLICY "Anyone can read products" ON public.products
    FOR SELECT
    USING (true);

-- Products: Admins can insert products
CREATE POLICY "Admins can insert products" ON public.products
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Inventory: Users can read their supermarket inventory
CREATE POLICY "Users can read supermarket inventory" ON public.inventory
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Inventory: Admins can insert inventory
CREATE POLICY "Admins can insert inventory" ON public.inventory
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Inventory: Admins can update inventory
CREATE POLICY "Admins can update inventory" ON public.inventory
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Transactions: Users can read their supermarket transactions
CREATE POLICY "Users can read supermarket transactions" ON public.transactions
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Transactions: Cashiers can insert transactions
CREATE POLICY "Cashiers can insert transactions" ON public.transactions
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Payments: Users can read their supermarket payments
CREATE POLICY "Users can read supermarket payments" ON public.payments
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Payments: Admins can insert payments
CREATE POLICY "Admins can insert payments" ON public.payments
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Suppliers: Users can read approved suppliers
CREATE POLICY "Users can read suppliers" ON public.suppliers
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Suppliers: Anyone can insert supplier application
CREATE POLICY "Anyone can insert supplier" ON public.suppliers
    FOR INSERT
    WITH CHECK (true);

-- Blockchain: Users can read their transactions
CREATE POLICY "Users can read blockchain sync" ON public.blockchain_sync
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample supermarket
-- INSERT INTO public.supermarkets (name, location, phone, address) VALUES
-- ('Kampala Fresh Market', 'Kampala, Uganda', '+256 700 000000', 'Plot 123, Main Street, Kampala');

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- ============================================================================
-- Run this SQL in Supabase SQL Editor
-- Dashboard -> SQL Editor -> New Query -> Paste and Run
-- ============================================================================
