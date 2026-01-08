-- Create payment_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount_ugx DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  transaction_number VARCHAR(255),
  payment_reference VARCHAR(255),
  transaction_ref VARCHAR(255),
  payment_date TIMESTAMP WITH TIME ZONE,
  recorded_by UUID,
  confirmed_by_supplier BOOLEAN DEFAULT FALSE,
  confirmation_date TIMESTAMP WITH TIME ZONE,
  confirmation_notes TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_payment_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_date ON payment_transactions(payment_date);

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
CREATE POLICY "Users can view their own payment transactions"
  ON payment_transactions FOR SELECT
  USING (auth.uid() = user_id OR 
         EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can create payment transactions" ON payment_transactions;
CREATE POLICY "Users can create payment transactions"
  ON payment_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR 
              EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Admins can update payment transactions" ON payment_transactions;
CREATE POLICY "Admins can update payment transactions"
  ON payment_transactions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin'));
