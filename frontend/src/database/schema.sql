-- FAREDEAL POS System Database Schema
-- Comprehensive database setup for Point of Sale and Business Management System

-- =============================================================================
-- DATABASE INITIALIZATION SCRIPT
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- CORE USER MANAGEMENT TABLES
-- =============================================================================

-- User roles enum
CREATE TYPE user_role AS ENUM (
    'admin',
    'manager', 
    'employee',
    'cashier',
    'inventory_manager',
    'supplier',
    'customer'
);

-- User status enum
CREATE TYPE user_status AS ENUM (
    'active',
    'inactive',
    'suspended',
    'pending_verification',
    'blocked'
);

-- Main users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'customer',
    status user_status NOT NULL DEFAULT 'active',
    avatar_url TEXT,
    date_of_birth DATE,
    gender VARCHAR(20),
    address JSONB, -- {street, city, state, country, postal_code}
    permissions JSONB DEFAULT '{}', -- Role-specific permissions
    settings JSONB DEFAULT '{}', -- User preferences
    last_login_at TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions for login tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- BUSINESS STRUCTURE TABLES
-- =============================================================================

-- Categories for products
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers management
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id), -- Link to user if supplier has account
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(200),
    email VARCHAR(255),
    phone VARCHAR(20),
    address JSONB,
    tax_number VARCHAR(50),
    business_license VARCHAR(100),
    payment_terms INTEGER DEFAULT 30, -- Days
    credit_limit DECIMAL(15,2) DEFAULT 0,
    status user_status DEFAULT 'active',
    rating DECIMAL(3,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products master data
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id),
    supplier_id UUID REFERENCES suppliers(id),
    brand VARCHAR(100),
    model VARCHAR(100),
    cost_price DECIMAL(15,2) NOT NULL,
    selling_price DECIMAL(15,2) NOT NULL,
    markup_percentage DECIMAL(5,2),
    tax_rate DECIMAL(5,2) DEFAULT 0,
    weight DECIMAL(8,3),
    dimensions JSONB, -- {length, width, height, unit}
    images JSONB DEFAULT '[]', -- Array of image URLs
    specifications JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_service BOOLEAN DEFAULT FALSE, -- For service items
    track_inventory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INVENTORY MANAGEMENT
-- =============================================================================

-- Inventory status enum
CREATE TYPE inventory_status AS ENUM (
    'in_stock',
    'low_stock',
    'out_of_stock',
    'discontinued'
);

-- Current inventory levels
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    current_stock INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER DEFAULT 0, -- Stock allocated but not sold
    minimum_stock INTEGER DEFAULT 0,
    maximum_stock INTEGER DEFAULT 1000,
    reorder_point INTEGER DEFAULT 10,
    reorder_quantity INTEGER DEFAULT 50,
    status inventory_status DEFAULT 'in_stock',
    location VARCHAR(100), -- Warehouse location
    last_counted_at TIMESTAMP WITH TIME ZONE,
    last_restocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id)
);

-- Inventory movements/transactions
CREATE TYPE inventory_movement_type AS ENUM (
    'purchase',
    'sale',
    'adjustment',
    'return',
    'transfer',
    'damage',
    'theft'
);

CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id),
    movement_type inventory_movement_type NOT NULL,
    quantity INTEGER NOT NULL, -- Positive for inbound, negative for outbound
    unit_cost DECIMAL(15,2),
    reference_id UUID, -- Reference to sale, purchase, etc.
    reference_type VARCHAR(50), -- 'sale', 'purchase_order', etc.
    notes TEXT,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- SALES AND POS SYSTEM
-- =============================================================================

-- Sales transaction status
CREATE TYPE sale_status AS ENUM (
    'pending',
    'completed',
    'cancelled',
    'refunded',
    'partially_refunded'
);

-- Payment methods
CREATE TYPE payment_method AS ENUM (
    'cash',
    'card',
    'mobile_money',
    'bank_transfer',
    'cheque',
    'credit',
    'gift_card'
);

-- Main sales transactions
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES users(id),
    cashier_id UUID REFERENCES users(id) NOT NULL,
    status sale_status DEFAULT 'pending',
    subtotal DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    amount_paid DECIMAL(15,2) DEFAULT 0,
    change_amount DECIMAL(15,2) DEFAULT 0,
    payment_method payment_method NOT NULL,
    payment_reference VARCHAR(100), -- Mobile money ref, card ref, etc.
    notes TEXT,
    receipt_printed BOOLEAN DEFAULT FALSE,
    receipt_emailed BOOLEAN DEFAULT FALSE,
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales items (line items)
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer loyalty and rewards
CREATE TABLE customer_loyalty (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    points_balance INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    total_points_redeemed INTEGER DEFAULT 0,
    tier VARCHAR(50) DEFAULT 'bronze', -- bronze, silver, gold, platinum
    tier_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id)
);

-- =============================================================================
-- SUPPLY CHAIN MANAGEMENT
-- =============================================================================

-- Purchase order status
CREATE TYPE purchase_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'ordered',
    'partially_received',
    'received',
    'cancelled'
);

-- Purchase orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    status purchase_status DEFAULT 'draft',
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    subtotal DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase order items
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    unit_cost DECIMAL(15,2) NOT NULL,
    total_cost DECIMAL(15,2) NOT NULL,
    received_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- EMPLOYEE MANAGEMENT
-- =============================================================================

-- Employee specific information
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    employee_number VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    hire_date DATE NOT NULL,
    salary DECIMAL(15,2),
    hourly_rate DECIMAL(8,2),
    manager_id UUID REFERENCES employees(id),
    work_schedule JSONB, -- Working hours, days
    emergency_contact JSONB,
    bank_details JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee attendance tracking
CREATE TABLE employee_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id),
    date DATE NOT NULL,
    clock_in TIMESTAMP WITH TIME ZONE,
    clock_out TIMESTAMP WITH TIME ZONE,
    break_start TIMESTAMP WITH TIME ZONE,
    break_end TIMESTAMP WITH TIME ZONE,
    total_hours DECIMAL(4,2),
    status VARCHAR(20) DEFAULT 'present', -- present, absent, late, sick, vacation
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- =============================================================================
-- BUSINESS ANALYTICS AND REPORTING
-- =============================================================================

-- Daily business metrics
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    total_sales DECIMAL(15,2) DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    total_customers INTEGER DEFAULT 0,
    average_transaction DECIMAL(15,2) DEFAULT 0,
    top_selling_product_id UUID REFERENCES products(id),
    cash_sales DECIMAL(15,2) DEFAULT 0,
    card_sales DECIMAL(15,2) DEFAULT 0,
    mobile_money_sales DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product performance analytics
CREATE TABLE product_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id),
    date DATE NOT NULL,
    units_sold INTEGER DEFAULT 0,
    revenue DECIMAL(15,2) DEFAULT 0,
    profit DECIMAL(15,2) DEFAULT 0,
    views INTEGER DEFAULT 0, -- For online analytics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, date)
);

-- =============================================================================
-- SYSTEM CONFIGURATION
-- =============================================================================

-- System settings
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit trail
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Product indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- Sales indexes
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_transaction_number ON sales(transaction_number);

-- Inventory indexes
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(performed_at);

-- Employee indexes
CREATE INDEX idx_employees_number ON employees(employee_number);
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_attendance_employee_date ON employee_attendance(employee_id, date);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to automatically update inventory after sales
CREATE OR REPLACE FUNCTION update_inventory_after_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Reduce inventory for each sold item
    IF NEW.quantity > 0 THEN
        UPDATE inventory 
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE product_id = NEW.product_id;
        
        -- Insert inventory movement record
        INSERT INTO inventory_movements (
            product_id, 
            movement_type, 
            quantity, 
            unit_cost, 
            reference_id, 
            reference_type,
            performed_by
        ) VALUES (
            NEW.product_id,
            'sale',
            -NEW.quantity,
            NEW.unit_price,
            NEW.sale_id,
            'sale',
            (SELECT cashier_id FROM sales WHERE id = NEW.sale_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for inventory update after sale
CREATE TRIGGER trigger_update_inventory_after_sale
    AFTER INSERT ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_after_sale();

-- Function to update inventory status based on stock levels
CREATE OR REPLACE FUNCTION update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update status based on stock levels
    IF NEW.current_stock <= 0 THEN
        NEW.status = 'out_of_stock';
    ELSIF NEW.current_stock <= NEW.minimum_stock THEN
        NEW.status = 'low_stock';
    ELSE
        NEW.status = 'in_stock';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for inventory status update
CREATE TRIGGER trigger_update_inventory_status
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_status();

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View for product information with inventory
CREATE VIEW product_inventory_view AS
SELECT 
    p.id,
    p.sku,
    p.barcode,
    p.name,
    p.description,
    p.selling_price,
    p.cost_price,
    c.name as category_name,
    s.company_name as supplier_name,
    i.current_stock,
    i.minimum_stock,
    i.status as inventory_status,
    p.is_active
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN inventory i ON p.id = i.product_id
WHERE p.is_active = true;

-- View for sales summary
CREATE VIEW sales_summary_view AS
SELECT 
    s.id,
    s.transaction_number,
    s.sale_date,
    CONCAT(cu.first_name, ' ', cu.last_name) as customer_name,
    CONCAT(ca.first_name, ' ', ca.last_name) as cashier_name,
    s.subtotal,
    s.tax_amount,
    s.discount_amount,
    s.total_amount,
    s.payment_method,
    s.status,
    COUNT(si.id) as item_count
FROM sales s
LEFT JOIN users cu ON s.customer_id = cu.id
LEFT JOIN users ca ON s.cashier_id = ca.id
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id, cu.first_name, cu.last_name, ca.first_name, ca.last_name;

-- =============================================================================
-- INITIAL SYSTEM CONFIGURATION
-- =============================================================================

-- Insert default system settings
INSERT INTO system_settings (key, value, description, category) VALUES
('currency', '{"code": "UGX", "symbol": "USh", "name": "Ugandan Shilling"}', 'Default currency settings', 'general'),
('tax_rate', '{"default": 18, "vat": 18, "service": 6}', 'Tax rates configuration', 'financial'),
('business_info', '{"name": "FAREDEAL", "address": "Kampala, Uganda", "phone": "+256-xxx-xxxx", "email": "info@faredeal.co.ug"}', 'Business information', 'general'),
('pos_settings', '{"receipt_footer": "Thank you for shopping with FAREDEAL!", "auto_print": true}', 'POS system configuration', 'pos'),
('inventory_settings', '{"auto_reorder": false, "low_stock_alert": true}', 'Inventory management settings', 'inventory');

-- Create default admin user (password: admin123)
-- Note: In production, use proper password hashing
INSERT INTO users (
    email, 
    username, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    status,
    permissions,
    email_verified
) VALUES (
    'admin@faredeal.co.ug',
    'admin',
    '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG', -- admin123
    'System',
    'Administrator',
    'admin',
    'active',
    '{"all": true}',
    true
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- =============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data (unless admin/manager)
CREATE POLICY users_own_data ON users
    FOR ALL USING (
        id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'manager')
        )
    );

-- Sales data access based on role
CREATE POLICY sales_access ON sales
    FOR SELECT USING (
        cashier_id = auth.uid() OR
        customer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'manager')
        )
    );

-- Employee data access
CREATE POLICY employee_access ON employees
    FOR SELECT USING (
        user_id = auth.uid() OR
        manager_id = (SELECT id FROM employees WHERE user_id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'manager')
        )
    );

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

-- Log the schema creation
DO $$
BEGIN
    RAISE NOTICE 'FAREDEAL POS Database Schema created successfully!';
    RAISE NOTICE 'Tables created: %, Indexes: %, Functions: %, Triggers: %', 
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
        (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'),
        (SELECT count(*) FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')),
        (SELECT count(*) FROM pg_trigger);
END $$;