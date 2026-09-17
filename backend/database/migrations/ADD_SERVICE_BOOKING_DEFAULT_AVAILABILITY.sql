-- ============================================================
-- SERVICE BOOKING AVAILABILITY — "open every day by default" fallback
-- ============================================================
-- Today a bookable service starts out completely unbookable: with zero
-- service_availability_rules rows, fn_get_available_slots returns nothing
-- for every date, and the admin has to add a day_of_week row for each of
-- the 7 weekdays one at a time before customers can book anything at all.
--
-- This adds a third, lowest-priority scope: a "default" rule with BOTH
-- day_of_week AND specific_date left NULL. Set that once (e.g. "every day,
-- 9am-5pm") and the service is bookable every day automatically. The admin
-- only needs to act again to make ONE day different — add a day_of_week row
-- for just that weekday (a blackout with no times fully closes it, matching
-- hours gives it different hours) — or to change a single date, exactly like
-- the existing one-off specific_date override already does. Nothing about
-- specific_date overrides or day_of_week rules changes: a date/weekday that
-- already has its own row keeps behaving exactly as before. This is purely
-- an additional fallback for the weekdays nobody has touched yet.
--
-- Priority per date, unchanged at the top two tiers:
--   1. A specific_date row for that exact date (as today).
--   2. A day_of_week row for that weekday, if any exists (as today) —
--      this is also how the admin "explicitly removes a day": add one
--      blackout day_of_week row for it.
--   3. NEW — the default row (day_of_week IS NULL AND specific_date IS
--      NULL), if one exists.
--   4. Otherwise closed, same as today.
--
-- Run after: ADD_SERVICE_BOOKINGS.sql, ADD_SERVICE_BOOKING_TYPES.sql,
-- ADD_SERVICE_BOOKING_HOUR_BLOCKS.sql.
-- Safe to run more than once.
-- ============================================================

-- The old scope constraint required EXACTLY one of day_of_week/specific_date
-- to be set (forbidding a "both NULL" default row). Relax it to just
-- forbidding BOTH being set at once (still no ambiguity between the two
-- scopes), which is what allows a default row to exist.
ALTER TABLE public.service_availability_rules DROP CONSTRAINT IF EXISTS service_availability_rules_one_scope;
ALTER TABLE public.service_availability_rules
  ADD CONSTRAINT service_availability_rules_one_scope
  CHECK (NOT (day_of_week IS NOT NULL AND specific_date IS NOT NULL));

CREATE OR REPLACE FUNCTION public.fn_get_available_slots(p_product_id UUID, p_date DATE)
RETURNS TABLE (slot_start TIME, slot_end TIME, spots_left INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_override BOOLEAN;
  v_has_dow_rule BOOLEAN;
  v_dow SMALLINT := EXTRACT(DOW FROM p_date)::SMALLINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.service_availability_rules
    WHERE product_id = p_product_id AND specific_date = p_date
  ) INTO v_has_override;

  SELECT EXISTS (
    SELECT 1 FROM public.service_availability_rules
    WHERE product_id = p_product_id AND specific_date IS NULL AND day_of_week = v_dow
  ) INTO v_has_dow_rule;

  RETURN QUERY
  WITH scope AS (
    SELECT r.start_time, r.end_time, r.slot_minutes, r.capacity, r.is_blackout
    FROM public.service_availability_rules r
    WHERE r.product_id = p_product_id
      AND (
        (v_has_override AND r.specific_date = p_date)
        OR (NOT v_has_override AND v_has_dow_rule AND r.specific_date IS NULL AND r.day_of_week = v_dow)
        OR (NOT v_has_override AND NOT v_has_dow_rule AND r.specific_date IS NULL AND r.day_of_week IS NULL)
      )
  ),
  full_day_blackout AS (
    SELECT 1 FROM scope WHERE is_blackout = true AND start_time IS NULL
  ),
  rules AS (
    SELECT start_time, end_time, slot_minutes, capacity
    FROM scope
    WHERE is_blackout = false AND NOT EXISTS (SELECT 1 FROM full_day_blackout)
  ),
  blocks AS (
    SELECT start_time, end_time
    FROM scope
    WHERE is_blackout = true AND start_time IS NOT NULL AND end_time IS NOT NULL
  ),
  candidate_slots AS (
    SELECT
      (r.start_time + make_interval(mins => n))::TIME AS slot_start,
      (r.start_time + make_interval(mins => n + r.slot_minutes))::TIME AS slot_end,
      r.capacity
    FROM rules r,
      LATERAL generate_series(
        0,
        (EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 60)::INT - r.slot_minutes,
        r.slot_minutes
      ) AS n
  ),
  open_slots AS (
    SELECT cs.slot_start, cs.slot_end, cs.capacity
    FROM candidate_slots cs
    WHERE NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE cs.slot_start < b.end_time AND cs.slot_end > b.start_time
    )
  ),
  booked AS (
    SELECT b.slot_start, SUM(b.quantity)::INT AS taken
    FROM public.service_bookings b
    WHERE b.product_id = p_product_id
      AND p_date >= b.booking_date
      AND p_date < COALESCE(b.checkout_date, b.booking_date + 1)
      AND b.status IN ('requested', 'confirmed')
    GROUP BY b.slot_start
  )
  SELECT os.slot_start, os.slot_end, (os.capacity - COALESCE(bk.taken, 0))::INT AS spots_left
  FROM open_slots os
  LEFT JOIN booked bk ON bk.slot_start = os.slot_start
  WHERE (os.capacity - COALESCE(bk.taken, 0)) > 0
  ORDER BY os.slot_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_available_slots(UUID, DATE) TO anon, authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Availability now supports a default (every-day) rule — fn_get_available_slots() falls back to it only for a weekday with no day_of_week rule of its own.';
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Default availability fallback installed.' AS status;
