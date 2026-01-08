-- Add missing supplier tables: supplier_invoices, supplier_products and supplier_payments

-- Create supplier_invoices table first (needed by supplier_payments)
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50),
  amount_invoiced_ugx DECIMAL(12, 2),
  amount_paid_ugx DECIMAL(12, 2) DEFAULT 0,
  balance_due_ugx DECIMAL(12, 2),
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  invoice_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON public.supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_payment_status ON public.supplier_invoices(payment_status);

-- Create supplier_products table
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON public.supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product ON public.supplier_products(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_is_active ON public.supplier_products(is_active);

-- Create supplier_payments table
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  payment_method VARCHAR(50),
  amount_paid_ugx DECIMAL(12, 2),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_reference VARCHAR(255),
  status VARCHAR(50) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON public.supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_payment_method ON public.supplier_payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_status ON public.supplier_payments(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_payment_date ON public.supplier_payments(payment_date);

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE public.supplier_invoices TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.supplier_products TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.supplier_payments TO authenticated, anon;
