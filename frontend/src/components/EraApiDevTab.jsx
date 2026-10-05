import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

/**
 * API tab of the Supermartkera developer panel: approve outside developers, watch usage, switch endpoints off.
 *
 * The console is one framework-free module shared by all four developer panels
 * (public/developers/admin.js, loaded at runtime so it is not part of this bundle). It renders in a Shadow DOM,
 * so this app's styles cannot touch it, and it asks for a REAL signed-in admin account (the panel PIN is never
 * used). The database side lives in the ICAN repo (supabase/migrations/20261005100000_era_api.sql); all four
 * apps share one Supabase project.
 */
export default function EraApiDevTab({ theme = null }) {
  const ref = useRef(null);
  const ui = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const url = '/developers/admin.js';
        const { mountEraApiAdmin } = await import(/* @vite-ignore */ url);
        if (off || !ref.current) return;
        ui.current = mountEraApiAdmin(ref.current, {
          rpc: (fn, args) => supabase.rpc(fn, args),
          signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
          theme,
        });
      } catch {
        if (!off) setFailed(true);
      }
    })();
    return () => { off = true; if (ui.current) { ui.current.destroy(); ui.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ui.current) ui.current.setTheme(theme); }, [theme]);

  if (failed) return <p className="py-8 text-center text-xs opacity-60">The API console could not load. Check your connection and refresh.</p>;
  return <div ref={ref} />;
}
