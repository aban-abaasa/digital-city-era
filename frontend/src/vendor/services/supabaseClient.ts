// Ported from mybodaguy's src/services/supabaseClient.ts. That file created
// its own Supabase client — this app already has one singleton (with the
// same globalThis.__ICANERACOIN_SUPABASE_CLIENTS__ sharing convention), so
// this re-exports it instead of initializing a second GoTrueClient.
export { supabase } from '@/services/supabase';
