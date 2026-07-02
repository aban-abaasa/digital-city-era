import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

const REFRESH_MS = 60_000;

export default function IcanCoinBadge({ userId: propUserId, onOpen }) {
  const [wallet,  setWallet]  = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let uid = propUserId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    if (!uid) { setLoading(false); return; }

    try {
      // Resolves country → currency → live icaneracoin price for this user
      const { data, error } = await supabase.rpc('ican_get_user_wallet_display', {
        p_user_id: uid,
      });
      if (!error && data?.[0]) {
        setWallet(data[0]);
      } else {
        // Fallback: balance only from user_accounts
        const { data: ua } = await supabase
          .from('user_accounts')
          .select('ican_coin_balance')
          .eq('user_id', uid)
          .single();
        setWallet({ ican_balance: ua?.ican_coin_balance ?? 0 });
      }
    } catch (_) {}
    setLoading(false);
  }, [propUserId]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const balance    = Number(wallet?.ican_balance    ?? 0);
  const priceLocal = Number(wallet?.price_local     ?? 0);
  const balLocal   = Number(wallet?.balance_local   ?? 0);
  const currency   = wallet?.currency_code          ?? 'UGX';
  const appPct     = Number(wallet?.appreciation_pct ?? 0);
  const hasPrice   = priceLocal > 0;

  return (
    <div
      onClick={() => (onOpen ? onOpen() : (window.location.href = '/ican-wallet'))}
      className="cursor-pointer select-none rounded-xl p-4 text-white hover:opacity-90 transition-opacity"
      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', minWidth: 180 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: 2, letterSpacing: '0.05em' }}>
            icaneracoin
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
            {loading ? '…' : balance.toFixed(2)}
          </p>
          {hasPrice && !loading && (
            <p style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: 4 }}>
              {currency} {balLocal > 0
                ? balLocal.toLocaleString(undefined, { maximumFractionDigits: 0 })
                : '—'}
            </p>
          )}
          <p style={{ fontSize: '0.65rem', opacity: 0.65, marginTop: 2 }}>
            ERA · tap to open wallet
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.6rem', opacity: 0.7, fontWeight: 700 }}>ERA</span>
          {hasPrice && !loading && appPct > 0 && (
            <p style={{ fontSize: '0.65rem', color: '#86efac', marginTop: 4, fontWeight: 600 }}>
              +{appPct.toFixed(1)}%
            </p>
          )}
        </div>
      </div>
      {hasPrice && !loading && (
        <div
          style={{
            marginTop: 8, paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.2)',
            fontSize: '0.65rem', opacity: 0.75,
          }}
        >
          1 icaneracoin = {currency}{' '}
          {priceLocal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
}
