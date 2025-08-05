/*
  # Real-Time Banking App Database Schema

  1. New Tables
    - `users` - User accounts with authentication
    - `balances` - Multi-currency balance tracking per user
    - `crypto_balances` - Cryptocurrency holdings per user
    - `transactions` - All deposits, transfers, and financial transactions
    - `messages` - Admin-user messaging system
    - `taxes` - Annual tax tracking and status
    - `support_tickets` - Customer support ticket system
    - `activity_logs` - Complete user activity tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Admin-specific policies for management access

  3. Real-Time Features
    - All tables configured for real-time subscriptions
    - Automatic timestamp tracking
    - UUID primary keys with secure defaults
*/

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'client',
  created_at timestamptz DEFAULT now()
);

-- Multi-currency balances
CREATE TABLE IF NOT EXISTS balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  currency text NOT NULL,
  amount numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Cryptocurrency balances
CREATE TABLE IF NOT EXISTS crypto_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  crypto text NOT NULL,
  amount numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Transaction history
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'transfer', 'withdrawal')),
  currency text NOT NULL,
  amount numeric NOT NULL,
  to_user_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Messaging system
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  from_admin boolean DEFAULT false,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tax tracking
CREATE TABLE IF NOT EXISTS taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  year int NOT NULL,
  amount numeric DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  issue text NOT NULL,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  activity text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Balances policies
CREATE POLICY "Users can manage own balances"
  ON balances
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all balances"
  ON balances
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Crypto balances policies
CREATE POLICY "Users can manage own crypto balances"
  ON crypto_balances
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all crypto balances"
  ON crypto_balances
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Transactions policies
CREATE POLICY "Users can read own transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text OR auth.uid()::text = to_user_id::text);

CREATE POLICY "Users can create transactions"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all transactions"
  ON transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Messages policies
CREATE POLICY "Users can manage own messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Taxes policies
CREATE POLICY "Users can read own taxes"
  ON taxes
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all taxes"
  ON taxes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Support tickets policies
CREATE POLICY "Users can manage own support tickets"
  ON support_tickets
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all support tickets"
  ON support_tickets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Activity logs policies
CREATE POLICY "Users can read own activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all activity logs"
  ON activity_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_balances_user_id ON balances(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_balances_user_id ON crypto_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user_id ON transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_taxes_user_id ON taxes(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);