-- FAREDEAL Sample Data Seeds
-- This file contains sample data to populate the database for testing and development

-- =============================================================================
-- SAMPLE CATEGORIES
-- =============================================================================
INSERT INTO categories (name, description, sort_order) VALUES
('Electronics', 'Electronic devices, phones, computers, and accessories', 1),
('Groceries', 'Food items, beverages, and daily consumables', 2),
('Clothing & Fashion', 'Apparel, shoes, and fashion accessories', 3),
('Home & Garden', 'Home improvement, furniture, and garden supplies', 4),
('Health & Beauty', 'Personal care, cosmetics, and health products', 5),
('Sports & Outdoors', 'Sports equipment and outdoor gear', 6),
('Books & Stationery', 'Books, office supplies, and educational materials', 7),
('Toys & Games', 'Children toys, games, and entertainment', 8);

-- =============================================================================
-- SAMPLE SUPPLIERS
-- =============================================================================
INSERT INTO suppliers (company_name, contact_person, email, phone, address, payment_terms, credit_limit, rating) VALUES
('TechWorld Uganda Ltd', 'John Mukasa', 'john@techworld.co.ug', '+256-701-234-567', 
 '{"street": "Plot 15, Industrial Area", "city": "Kampala", "country": "Uganda", "postal_code": "00256"}', 
 30, 5000000.00, 4.5),

('Fresh Foods Suppliers', 'Mary Nakato', 'mary@freshfoods.co.ug', '+256-702-345-678',
 '{"street": "Nakasero Road", "city": "Kampala", "country": "Uganda", "postal_code": "00256"}',
 15, 2000000.00, 4.8),

('Fashion Hub Africa', 'David Ssemakula', 'david@fashionhub.co.ug', '+256-703-456-789',
 '{"street": "Owino Market", "city": "Kampala", "country": "Uganda", "postal_code": "00256"}',
 21, 3000000.00, 4.2),

('HomeStyle Furniture', 'Grace Nalubega', 'grace@homestyle.co.ug', '+256-704-567-890',
 '{"street": "Ntinda Shopping Center", "city": "Kampala", "country": "Uganda", "postal_code": "00256"}',
 45, 4000000.00, 4.6),

('Beauty Care Uganda', 'Peter Kato', 'peter@beautycare.co.ug', '+256-705-678-901',
 '{"street": "Garden City Mall", "city": "Kampala", "country": "Uganda", "postal_code": "00256"}',
 30, 1500000.00, 4.3);

-- =============================================================================
-- SAMPLE PRODUCTS WITH INVENTORY
-- =============================================================================

-- Electronics Products
INSERT INTO products (sku, barcode, name, description, category_id, supplier_id, brand, model, cost_price, selling_price, markup_percentage, tax_rate) 
SELECT 
    'TECH-001', '1234567890123', 'Samsung Galaxy A54', 'Latest Samsung smartphone with 128GB storage',
    c.id, s.id, 'Samsung', 'Galaxy A54', 800000.00, 1200000.00, 50.00, 18.00
FROM categories c, suppliers s 
WHERE c.name = 'Electronics' AND s.company_name = 'TechWorld Uganda Ltd';

INSERT INTO products (sku, barcode, name, description, category_id, supplier_id, brand, model, cost_price, selling_price, markup_percentage, tax_rate)
SELECT 
    'TECH-002', '1234567890124', 'iPhone 15', 'Apple iPhone 15 128GB',
    c.id, s.id, 'Apple', 'iPhone 15', 1800000.00, 2500000.00, 38.89, 18.00
FROM categories c, suppliers s 
WHERE c.name = 'Electronics' AND s.company_name = 'TechWorld Uganda Ltd';

INSERT INTO products (sku, barcode, name, description, category_id, supplier_id, brand, model, cost_price, selling_price, markup_percentage, tax_rate)
SELECT 
    'TECH-003', '1234567890125', 'Dell Laptop', 'Dell Inspiron 15 - Core i5, 8GB RAM, 512GB SSD',
    c.id, s.id, 'Dell', 'Inspiron 15', 1200000.00, 1800000.00, 50.00, 18.00
FROM categories c, suppliers s 
WHERE c.name = 'Electronics' AND s.company_name = 'TechWorld Uganda Ltd';

-- Grocery Products
INSERT INTO products (sku, barcode, name, description, category_id, supplier_id, brand, cost_price, selling_price, markup_percentage, tax_rate, track_inventory)
SELECT 
    'FOOD-001', '2345678901234', 'Rice - 5KG Bag', 'Premium quality white rice',
    c.id, s.id, 'Super Rice', 15000.00, 20000.00, 33.33, 0.00, true
FROM categories c, suppliers s 
WHERE c.name = 'Groceries' AND s.company_name = 'Fresh Foods Suppliers';

INSERT INTO products (sku, barcode, name, description, category_id, supplier_id, brand, cost_price, selling_price, markup_percentage, tax_rate, track_inventory)
SELECT 
    'FOOD-002', '2345678901235', 'Cooking Oil - 2L', 'Refined vegetable cooking oil',
    c.id, s.id, 'Golden Oil', 12000.00, 16000.00, 33.33, 0.00, true
FROM categories c, suppliers s 
WHERE c.name = 'Groceries' AND s.company_name = 'Fresh Foods Suppliers';

INSERT INTO products (sku, barcode, name, description, category_id, supplier_id, brand, cost_price, selling_price, markup_percentage, tax_rate, track_inventory)
SELECT 
    'FOOD-003', '2345678901236', 'Sugar - 1KG', 'Pure white sugar',
    c.id, s.id, 'Sweet Sugar', 4500.00, 6000.00, 33.33, 0.00, true
FROM categories c, suppliers s 
WHERE c.name = 'Groceries' AND s.company_name = 'Fresh Foods Suppliers';

-- Clothing Products
INSERT INTO products (sku, barcode, name, description, category_id, supplier_id, brand, cost_price, selling_price, markup_percentage, tax_rate)
SELECT 
    'CLOTH-001', '3456789012345', 'Cotton T-Shirt', 'Comfortable cotton t-shirt - various colors',
    c.id, s.id, 'ComfortWear', 25000.00, 40000.00, 60.00, 18.00
FROM categories c, suppliers s 
WHERE c.name = 'Clothing & Fashion' AND s.company_name = 'Fashion Hub Africa';

INSERT INTO products (sku, barcode, name, description, category_id, supplier_id, brand, cost_price, selling_price, markup_percentage, tax_rate)
SELECT 
    'CLOTH-002', '3456789012346', 'Jeans Pants', 'Classic denim jeans - multiple sizes',
    c.id, s.id, 'DenimPro', 45000.00, 75000.00, 66.67, 18.00
FROM categories c, suppliers s 
WHERE c.name = 'Clothing & Fashion' AND s.company_name = 'Fashion Hub Africa';

-- =============================================================================
-- INVENTORY SETUP FOR PRODUCTS
-- =============================================================================

-- Create inventory records for all products
INSERT INTO inventory (product_id, current_stock, minimum_stock, maximum_stock, reorder_point, reorder_quantity, location)
SELECT 
    p.id,
    CASE 
        WHEN p.name LIKE '%Rice%' OR p.name LIKE '%Oil%' OR p.name LIKE '%Sugar%' THEN 150
        WHEN p.name LIKE '%Samsung%' OR p.name LIKE '%iPhone%' THEN 25
        WHEN p.name LIKE '%Laptop%' THEN 10
        ELSE 50
    END as current_stock,
    CASE 
        WHEN p.name LIKE '%Rice%' OR p.name LIKE '%Oil%' OR p.name LIKE '%Sugar%' THEN 20
        WHEN p.name LIKE '%Samsung%' OR p.name LIKE '%iPhone%' THEN 5
        WHEN p.name LIKE '%Laptop%' THEN 3
        ELSE 10
    END as minimum_stock,
    CASE 
        WHEN p.name LIKE '%Rice%' OR p.name LIKE '%Oil%' OR p.name LIKE '%Sugar%' THEN 300
        WHEN p.name LIKE '%Samsung%' OR p.name LIKE '%iPhone%' THEN 100
        WHEN p.name LIKE '%Laptop%' THEN 50
        ELSE 200
    END as maximum_stock,
    CASE 
        WHEN p.name LIKE '%Rice%' OR p.name LIKE '%Oil%' OR p.name LIKE '%Sugar%' THEN 25
        WHEN p.name LIKE '%Samsung%' OR p.name LIKE '%iPhone%' THEN 8
        WHEN p.name LIKE '%Laptop%' THEN 5
        ELSE 15
    END as reorder_point,
    CASE 
        WHEN p.name LIKE '%Rice%' OR p.name LIKE '%Oil%' OR p.name LIKE '%Sugar%' THEN 100
        WHEN p.name LIKE '%Samsung%' OR p.name LIKE '%iPhone%' THEN 20
        WHEN p.name LIKE '%Laptop%' THEN 10
        ELSE 50
    END as reorder_quantity,
    'Main Warehouse' as location
FROM products p;

-- =============================================================================
-- SAMPLE USERS (EMPLOYEES & CUSTOMERS)
-- =============================================================================

-- Additional Staff Users
INSERT INTO users (email, username, password_hash, first_name, last_name, phone, role, status, email_verified, permissions)
VALUES 
('manager2@faredeal.co.ug', 'manager2', '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG', 
 'Robert', 'Kiprotich', '+256-701-111-222', 'manager', 'active', true,
 '{"manage_employees": true, "manage_inventory": true, "view_reports": true, "pos_access": true}'),

('cashier2@faredeal.co.ug', 'cashier2', '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG',
 'Susan', 'Nalwanga', '+256-702-222-333', 'cashier', 'active', true,
 '{"pos_access": true, "process_sales": true}'),

('inventory@faredeal.co.ug', 'inventory', '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG',
 'Michael', 'Ochieng', '+256-703-333-444', 'inventory_manager', 'active', true,
 '{"manage_inventory": true, "view_products": true, "manage_suppliers": true}');

-- Sample Customers
INSERT INTO users (email, username, password_hash, first_name, last_name, phone, role, status, email_verified)
VALUES 
('grace.nakato@gmail.com', 'grace_n', '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG',
 'Grace', 'Nakato', '+256-704-444-555', 'customer', 'active', true),

('joseph.mugisha@gmail.com', 'joseph_m', '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG',
 'Joseph', 'Mugisha', '+256-705-555-666', 'customer', 'active', true),

('alice.nabirye@gmail.com', 'alice_n', '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG',
 'Alice', 'Nabirye', '+256-706-666-777', 'customer', 'active', true);

-- =============================================================================
-- EMPLOYEE RECORDS FOR STAFF
-- =============================================================================

-- Create employee records for staff users (excluding customers)
INSERT INTO employees (user_id, employee_number, department, position, hire_date, salary)
SELECT 
    u.id,
    CASE 
        WHEN u.username = 'manager2' THEN 'EMP-002'
        WHEN u.username = 'cashier2' THEN 'EMP-003'  
        WHEN u.username = 'inventory' THEN 'EMP-004'
    END as employee_number,
    CASE 
        WHEN u.role = 'manager' THEN 'Management'
        WHEN u.role = 'cashier' THEN 'Sales'
        WHEN u.role = 'inventory_manager' THEN 'Operations'
    END as department,
    CASE 
        WHEN u.role = 'manager' THEN 'Assistant Manager'
        WHEN u.role = 'cashier' THEN 'Cashier'
        WHEN u.role = 'inventory_manager' THEN 'Inventory Manager'
    END as position,
    '2024-01-15' as hire_date,
    CASE 
        WHEN u.role = 'manager' THEN 1200000.00
        WHEN u.role = 'cashier' THEN 600000.00
        WHEN u.role = 'inventory_manager' THEN 900000.00
    END as salary
FROM users u 
WHERE u.username IN ('manager2', 'cashier2', 'inventory') 
AND u.role != 'customer';

-- =============================================================================
-- CUSTOMER LOYALTY RECORDS
-- =============================================================================

-- Create loyalty records for customer users
INSERT INTO customer_loyalty (customer_id, points_balance, tier)
SELECT 
    u.id,
    FLOOR(RANDOM() * 500 + 50) as points_balance,  -- Random points between 50-550
    CASE 
        WHEN RANDOM() < 0.7 THEN 'bronze'
        WHEN RANDOM() < 0.9 THEN 'silver'  
        ELSE 'gold'
    END as tier
FROM users u 
WHERE u.role = 'customer';

-- =============================================================================
-- SAMPLE SALES TRANSACTIONS
-- =============================================================================

-- Create some sample sales (you can uncomment this section after setting up the database)
/*
-- Sample Sale 1
INSERT INTO sales (transaction_number, customer_id, cashier_id, subtotal, tax_amount, total_amount, amount_paid, payment_method, status, sale_date)
SELECT 
    'TXN-001',
    (SELECT id FROM users WHERE role = 'customer' LIMIT 1),
    (SELECT id FROM users WHERE role = 'cashier' LIMIT 1),
    50000.00,
    9000.00,
    59000.00,
    60000.00,
    'cash',
    'completed',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
WHERE EXISTS (SELECT 1 FROM users WHERE role = 'customer') 
AND EXISTS (SELECT 1 FROM users WHERE role = 'cashier');

-- Sample Sale Items for Sale 1
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
SELECT 
    (SELECT id FROM sales WHERE transaction_number = 'TXN-001'),
    p.id,
    2,
    p.selling_price,
    p.selling_price * 2
FROM products p 
WHERE p.sku = 'CLOTH-001'
AND EXISTS (SELECT 1 FROM sales WHERE transaction_number = 'TXN-001');
*/

-- =============================================================================
-- COMPLETION LOG
-- =============================================================================

-- Log the completion of sample data insertion
DO $$
BEGIN
    RAISE NOTICE 'Sample data insertion completed successfully!';
    RAISE NOTICE 'Created sample categories, suppliers, products, users, and related records.';
    RAISE NOTICE 'Default login credentials:';
    RAISE NOTICE '  Admin: admin@faredeal.co.ug / admin123';
    RAISE NOTICE '  Manager: manager@faredeal.co.ug / manager123';
    RAISE NOTICE '  Cashier: cashier@faredeal.co.ug / cashier123';
END $$;