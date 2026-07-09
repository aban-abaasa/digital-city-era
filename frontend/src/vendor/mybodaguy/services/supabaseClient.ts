// Ported from mybodaguy's src/mybodaguy/services/supabaseClient.ts, which
// re-exported its app-wide singleton. Re-export this app's singleton instead
// so ride/checkout components ported into digital-city-era share the one
// real Supabase client rather than initializing a second GoTrueClient.
export { supabase } from '@/services/supabase';
