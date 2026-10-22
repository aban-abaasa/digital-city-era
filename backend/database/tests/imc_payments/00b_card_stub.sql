-- Test stub for ADD_ICAN_CARD_POS_PAYMENTS.sql. Not a migration: never run this against a real database.
--
-- The customer's digital card lives in the ICAN repo (ICAN_DIGITAL_CARD_QR.sql). The card migration only needs that
-- table to exist (the QR token and the PIN are checked by the Edge Function, not in SQL), so this recreates it with the
-- real column names and constraints.
\set ON_ERROR_STOP on

CREATE TABLE public.ican_digital_cards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number  TEXT NOT NULL UNIQUE CHECK (card_number ~ '^[0-9]{16}$'),
  holder_name  TEXT NOT NULL,
  expiry_month INT  NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year  INT  NOT NULL,
  qr_token     TEXT NOT NULL UNIQUE,
  qr_enabled   BOOLEAN NOT NULL DEFAULT true,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
  pin_pay_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
