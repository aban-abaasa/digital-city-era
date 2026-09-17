import { supabase } from './supabase';

// A 'ticket' or 'room' product doesn't have a time-of-day — it's booked
// against one pseudo-slot covering the whole day. Rather than teach
// fn_get_available_slots a second code path, the admin's availability rule
// for those types is just pinned to this exact all-day range, so the
// existing per-time-slot generator naturally produces a single slot.
export const ALL_DAY_AVAILABILITY = { startTime: '00:00:00', endTime: '23:59:00', slotMinutes: 1439 };

// Stores offering bookable services (offers_services=true), for the
// customer-facing "Book" browse screen.
export const getBusinessesOfferingServices = async () => {
  const { data, error } = await supabase
    .from('supermarkets')
    .select('id, name, business_type, logo_url, city, address')
    .eq('offers_services', true)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
};

// Bookable service_item products for one store.
export const getBookableServices = async (supermarketId) => {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, selling_price, price, image_url, images, booking_type')
    .eq('supermarket_id', supermarketId)
    .eq('inventory_mode', 'service_item')
    .eq('is_bookable', true)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
};

// Every bookable service across every business that has opted in
// (offers_services=true), each carrying its own business's info — this is
// what powers the customer-facing cross-business search/marketplace, as
// opposed to getBookableServices() above which is scoped to one store (used
// by the admin availability editor). `!inner` forces the join so the
// supermarkets.* filters below actually apply server-side.
export const searchBookableServices = async () => {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, description, selling_price, price, image_url, images, supermarket_id, booking_type,' +
        ' supermarkets!inner(id, name, business_type, logo_url, city, address, offers_services, is_active)'
    )
    .eq('inventory_mode', 'service_item')
    .eq('is_bookable', true)
    .eq('is_active', true)
    .eq('supermarkets.offers_services', true)
    .eq('supermarkets.is_active', true)
    .order('name');
  if (error) throw error;
  return (data || []).map(({ supermarkets, ...svc }) => ({ ...svc, business: supermarkets }));
};

// Open slots for one product/date — computed live server-side, so this
// always reflects current bookings (call again after a booking succeeds to
// refresh the grid).
export const getAvailableSlots = async (productId, date) => {
  const { data, error } = await supabase.rpc('fn_get_available_slots', {
    p_product_id: productId,
    p_date: date,
  });
  if (error) throw error;
  return data || [];
};

// origin_app is only meaningful for the mybodaguy port of this service
// (its bookingService.ts passes p_origin_app: 'mybodaguy'); digital-city-era
// relies on the RPC's default.
// slotStart is only meaningful for a 'slot' product; quantity is the ticket
// count or room count for 'ticket'/'room' products (ignored — forced to 1 —
// server-side for 'slot'); checkoutDate is only meaningful for a 'room'
// product (a multi-night stay).
export const createBooking = async ({
  productId,
  bookingDate,
  slotStart,
  customerName,
  customerPhone,
  customerEmail,
  notes,
  quantity,
  checkoutDate,
  formResponses,
}) => {
  const { data, error } = await supabase.rpc('fn_create_service_booking', {
    p_product_id: productId,
    p_booking_date: bookingDate,
    p_slot_start: slotStart || null,
    p_customer_name: customerName,
    p_customer_phone: customerPhone || null,
    p_customer_email: customerEmail || null,
    p_notes: notes || null,
    p_quantity: quantity || 1,
    p_checkout_date: checkoutDate || null,
    p_form_responses: formResponses && Object.keys(formResponses).length ? formResponses : null,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not create booking');
  return data;
};

export const updateBookingStatus = async (bookingId, status) => {
  const { data, error } = await supabase.rpc('fn_update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: status,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not update booking');
  return data;
};

// Signed-in customer's own bookings, newest first.
export const getMyBookings = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('service_bookings')
    .select('*, products(name, image_url, booking_type), supermarkets(name, logo_url, phone)')
    .eq('user_id', user.id)
    .order('booking_date', { ascending: false })
    .order('slot_start', { ascending: false });
  if (error) throw error;
  return data || [];
};

// Admin/manager view of a store's bookings.
export const getStoreBookings = async (supermarketId) => {
  const { data, error } = await supabase
    .from('service_bookings')
    .select('*, products(name, booking_type)')
    .eq('supermarket_id', supermarketId)
    .order('booking_date', { ascending: true })
    .order('slot_start', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getAvailabilityRules = async (productId) => {
  const { data, error } = await supabase
    .from('service_availability_rules')
    .select('*')
    .eq('product_id', productId)
    .order('day_of_week')
    .order('specific_date');
  if (error) throw error;
  return data || [];
};

export const saveAvailabilityRule = async ({
  id,
  supermarketId,
  productId,
  dayOfWeek,
  specificDate,
  startTime,
  endTime,
  slotMinutes,
  capacity,
  isBlackout,
}) => {
  const row = {
    supermarket_id: supermarketId,
    product_id: productId,
    day_of_week: dayOfWeek ?? null,
    specific_date: specificDate ?? null,
    // A blackout row may still carry a start/end (blocks just that range,
    // e.g. a 2pm-4pm lunch break) or omit them (closes the whole day) — only
    // a non-blackout "open hours" row requires them.
    start_time: startTime || null,
    end_time: endTime || null,
    slot_minutes: slotMinutes || 30,
    capacity: capacity || 1,
    is_blackout: !!isBlackout,
  };
  const query = id
    ? supabase.from('service_availability_rules').update(row).eq('id', id)
    : supabase.from('service_availability_rules').insert(row);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
};

export const deleteAvailabilityRule = async (id) => {
  const { error } = await supabase.from('service_availability_rules').delete().eq('id', id);
  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────
// Booking forms — a reusable named set of intake questions (see
// ADD_SERVICE_BOOKING_FORMS.sql). A form is built once and can be attached
// to several bookable services at once via service_booking_form_services,
// instead of re-typing the same questions per service.
// ─────────────────────────────────────────────────────────────────────────

// Every form this store has built, for the "attach an existing form"
// picker in the admin's form editor.
export const listBookingForms = async (supermarketId) => {
  const { data, error } = await supabase
    .from('service_booking_forms')
    .select('*')
    .eq('supermarket_id', supermarketId)
    .order('name');
  if (error) throw error;
  return data || [];
};

export const createBookingForm = async ({ supermarketId, name }) => {
  const { data, error } = await supabase
    .from('service_booking_forms')
    .insert({ supermarket_id: supermarketId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const renameBookingForm = async (formId, name) => {
  const { error } = await supabase.from('service_booking_forms').update({ name }).eq('id', formId);
  if (error) throw error;
};

// Which products currently use each form, and the form itself — this is
// what lets the editor show "also used by: Haircut, Hair colouring".
export const getFormServiceLinks = async (formId) => {
  const { data, error } = await supabase
    .from('service_booking_form_services')
    .select('product_id, products(id, name)')
    .eq('form_id', formId);
  if (error) throw error;
  return (data || []).map((row) => row.products);
};

// The form attached to one product, if any — null when that service still
// just collects the fixed name/phone/notes fields.
export const getServiceForm = async (productId) => {
  const { data, error } = await supabase
    .from('service_booking_form_services')
    .select('form_id, service_booking_forms(id, name)')
    .eq('product_id', productId)
    .maybeSingle();
  if (error) throw error;
  return data?.service_booking_forms || null;
};

// Attaching a product to a form_id it's already attached to is a no-op
// (upsert on the product_id primary key) — that's also how you MOVE a
// product from one form to another, since a product can only use one form.
export const attachServiceToForm = async ({ supermarketId, productId, formId }) => {
  const { error } = await supabase
    .from('service_booking_form_services')
    .upsert({ product_id: productId, form_id: formId, supermarket_id: supermarketId });
  if (error) throw error;
};

export const detachServiceFromForm = async (productId) => {
  const { error } = await supabase.from('service_booking_form_services').delete().eq('product_id', productId);
  if (error) throw error;
};

// Admin-defined intake questions on one form, in display order — used both
// by the admin's form builder and (resolved via getBookingFormFieldsForService
// below) the customer's booking modal. Public SELECT, same as availability
// rules.
export const getBookingFormFields = async (formId) => {
  const { data, error } = await supabase
    .from('service_booking_form_fields')
    .select('*')
    .eq('form_id', formId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
};

// What BookServiceModal actually needs: "what questions does booking THIS
// service ask" — resolves the product's attached form (if any) then its
// fields in one round trip, or [] when the service has no form.
export const getBookingFormFieldsForService = async (productId) => {
  const form = await getServiceForm(productId);
  if (!form) return [];
  return getBookingFormFields(form.id);
};

// field_key is a stable slug derived from the label (see slugifyFieldKey
// below) — it's what a booking's form_responses is keyed by, so it must
// stay unique per form (enforced by a DB constraint).
export const saveBookingFormField = async ({
  id,
  supermarketId,
  formId,
  label,
  fieldKey,
  fieldType,
  options,
  isRequired,
  sortOrder,
}) => {
  const row = {
    supermarket_id: supermarketId,
    form_id: formId,
    label,
    field_key: fieldKey,
    field_type: fieldType || 'text',
    options: fieldType === 'select' || fieldType === 'multiselect' ? options || [] : null,
    is_required: !!isRequired,
    sort_order: sortOrder ?? 0,
  };
  const query = id
    ? supabase.from('service_booking_form_fields').update(row).eq('id', id)
    : supabase.from('service_booking_form_fields').insert(row);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
};

export const deleteBookingFormField = async (id) => {
  const { error } = await supabase.from('service_booking_form_fields').delete().eq('id', id);
  if (error) throw error;
};

// Turns "Preferred stylist?" into "preferred_stylist" — lowercased,
// non-alphanumerics collapsed to underscores, trimmed of leading/trailing
// ones. Not guaranteed unique on its own; saveBookingFormField's caller
// disambiguates a collision by appending a counter before saving.
export const slugifyFieldKey = (label) =>
  (label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'field';

// Customer-side file upload for a 'file' form field — direct browser ->
// Supabase Storage, the same pattern AddProductModal already uses for
// product photos (no new API route/serverless function). Returns the
// public URL to store as that field's answer in form_responses.
const BOOKING_UPLOAD_BUCKET = 'booking-uploads';

export const uploadBookingAttachment = async (productId, file) => {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BOOKING_UPLOAD_BUCKET)
    .upload(path, file, { upsert: false, cacheControl: '3600' });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(BOOKING_UPLOAD_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};
