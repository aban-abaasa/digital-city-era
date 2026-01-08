-- Add missing columns to purchase_orders table
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Create index for payment date lookups
CREATE INDEX IF NOT EXISTS idx_purchase_orders_last_payment ON purchase_orders(last_payment_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_next_payment ON purchase_orders(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_method ON purchase_orders(payment_method);
