-- A receipt can remain publicly viewable through get_invoice_public(), but
-- only an authenticated member of its issuing store can attest that the
-- invoice belongs to that company.
CREATE OR REPLACE FUNCTION public.verify_invoice_company_member(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction public.transactions%ROWTYPE;
  v_store_name text;
  v_is_member boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in with an account that belongs to this company to verify this invoice.');
  END IF;

  SELECT * INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found or you are not a member of its company.');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.supermarkets sm
    WHERE sm.id = v_transaction.supermarket_id
      AND (
        sm.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.supermarket_staff ss
          JOIN public.users u ON u.id = ss.user_id
          WHERE ss.supermarket_id = sm.id
            AND ss.status = 'active'
            AND (u.id = auth.uid() OR u.auth_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1
          FROM public.business_profiles bp
          WHERE bp.id = sm.pichin_business_profile_id
            AND bp.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.business_account_members bam
          WHERE bam.business_profile_id = sm.pichin_business_profile_id
            AND bam.auth_user_id = auth.uid()
            AND bam.employment_status = 'active'
        )
      )
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only an active member of the issuing company can verify this invoice.');
  END IF;

  SELECT name INTO v_store_name
  FROM public.supermarkets
  WHERE id = v_transaction.supermarket_id;

  RETURN jsonb_build_object(
    'success', true,
    'verified', true,
    'transactionId', v_transaction.id,
    'receiptNumber', v_transaction.receipt_number,
    'companyName', COALESCE(v_store_name, v_transaction.merchant_name, v_transaction.store_location),
    'verifiedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_invoice_company_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_invoice_company_member(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
