-- Create supplier_profiles table
CREATE TABLE IF NOT EXISTS public.supplier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  rating DECIMAL(3, 2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  on_time_delivery_rate DECIMAL(5, 2) DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_profiles_status ON public.supplier_profiles(status);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_created ON public.supplier_profiles(created_at);

-- Create supplier_deliveries table
CREATE TABLE IF NOT EXISTS public.supplier_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delivery_status VARCHAR(50) DEFAULT 'pending',
  quality_check_status VARCHAR(50) DEFAULT 'pending',
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_deliveries_supplier ON public.supplier_deliveries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_deliveries_status ON public.supplier_deliveries(delivery_status);

-- Create supplier_invoices table
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

GRANT ALL PRIVILEGES ON TABLE public.supplier_profiles TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.supplier_deliveries TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.supplier_invoices TO authenticated, anon;
