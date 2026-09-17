-- ============================================================
-- SERVICE BOOKING HOUR BLOCKS — let admin block a specific time range
-- ============================================================
-- ADD_SERVICE_BOOKINGS.sql's fn_get_available_slots() treated
-- is_blackout=true rows as "generate no slots from this row", which only
-- ever worked for closing a WHOLE day (a blackout row with no start/end) --
-- a blackout row that DID carry a start_time/end_time (e.g. 14:00-16:00 for
-- a lunch break or a walk-in appointment) had no effect at all, because it
-- was simply excluded rather than subtracted from the other rules covering
-- that same day.
--
-- This replaces fn_get_available_slots() so an is_blackout row WITH
-- start_time/end_time now blocks exactly that range out of whatever the
-- other rule(s) for that day/date would otherwise open up, while an
-- is_blackout row with NO start_time/end_time still closes the entire day,
-- exactly as before. Both day_of_week (recurring, e.g. a daily lunch break)
-- and specific_date (one-off, e.g. "block 2pm-4pm this Wednesday only")
-- blackout rows are supported, matching how open-hours rows already combine
-- for the same scope. No schema/constraint changes are needed --
-- service_availability_rules already allows start_time/end_time on a
-- blackout row (service_availability_rules_hours only REQUIRES them when
-- is_blackout is false).
--
-- Run after: ADD_SERVICE_BOOKINGS.sql.
-- Safe to run more than once.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_get_available_slots(p_product_id UUID, p_date DATE)
RETURNS TABLE (slot_start TIME, slot_end TIME, spots_left INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_override BOOLEAN;
  v_dow SMALLINT := EXTRACT(DOW FROM p_date)::SMALLINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.service_availability_rules
    WHERE product_id = p_product_id AND specific_date = p_date
  ) INTO v_has_override;

  RETURN QUERY
  WITH scope AS (
    SELECT r.start_time, r.end_time, r.slot_minutes, r.capacity, r.is_blackout
    FROM public.service_availability_rules r
    WHERE r.product_id = p_product_id
      AND (
        (v_has_override AND r.specific_date = p_date)
        OR (NOT v_has_override AND r.specific_date IS NULL AND r.day_of_week = v_dow)
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
    SELECT b.slot_start, COUNT(*) AS taken
    FROM public.service_bookings b
    WHERE b.product_id = p_product_id
      AND b.booking_date = p_date
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
  RAISE NOTICE '✅ Service booking hour blocks ready — is_blackout rows with start_time/end_time now block just that range instead of the whole day.';
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Service booking hour blocks installed.' AS status;
