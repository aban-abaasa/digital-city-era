import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export default function IcanCoinBadge({ userId: propUserId }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    const load = async () => {
      let uid = propUserId;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        uid = user?.id;
      }
      if (!uid) return;
      const { data } = await supabase
        .from('ican_user_wallets')
        .select('ican_balance')
        .eq('user_id', uid)
        .single();
      setBalance(data?.ican_balance ?? 0);
    };
    load();
  }, [propUserId]);

  return (
    <div
      onClick={() => (window.location.href = '/ican-wallet')}
      className="cursor-pointer bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 text-white hover:opacity-90 transition-opacity select-none"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-violet-200 mb-0.5">ICAN Coins</p>
          <p className="text-2xl font-bold leading-none">
            {balance === null ? '…' : Number(balance).toFixed(2)}
          </p>
          <p className="text-xs text-violet-200 mt-1">₡ · tap to open wallet</p>
        </div>
        <span className="text-3xl opacity-80">₡</span>
      </div>
    </div>
  );
}
