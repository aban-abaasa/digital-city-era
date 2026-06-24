import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  getOrCreateWallet,
  getBalance,
  getTransactions,
  sendICAN,
  formatICAN,
  icanToUGX,
  ugxToICAN,
  ICAN_TO_UGX,
} from '@/services/icanWalletService';
import { supabase } from '@/services/supabase';

// ─── helpers ───────────────────────────────────────────────────────────────

const TX_LABELS = {
  earn: 'Earned',
  cashback: 'Cashback',
  purchase: 'Purchase',
  transfer_in: 'Received',
  transfer_out: 'Sent',
  tithe: 'Tithe (10%)',
  sale: 'Sale',
  refund: 'Refund',
};

const TX_COLORS = {
  earn: 'text-emerald-400',
  cashback: 'text-emerald-400',
  purchase: 'text-rose-400',
  transfer_in: 'text-emerald-400',
  transfer_out: 'text-rose-400',
  tithe: 'text-amber-400',
  sale: 'text-emerald-400',
  refund: 'text-sky-400',
};

const APP_BADGE = {
  ican: { label: 'ICAN', color: 'bg-violet-900 text-violet-200' },
  'digital-city-era': { label: 'Supermarket', color: 'bg-blue-900 text-blue-200' },
  'farm-agent': { label: 'Farm Agent', color: 'bg-green-900 text-green-200' },
  mybodaguy: { label: 'My Boda Guy', color: 'bg-orange-900 text-orange-200' },
};

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-UG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── sub-components ────────────────────────────────────────────────────────

function BalanceCard({ balance, walletAddress, onRefresh, refreshing }) {
  const [hidden, setHidden] = useState(false);
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{
      background: 'linear-gradient(135deg, #1a1040 0%, #0f2055 50%, #0a3d2b 100%)',
    }}>
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #7c3aed 0%, transparent 60%)' }} />
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">I</span>
            </div>
            <span className="text-white font-semibold text-sm">Icaneracoin Wallet</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setHidden(h => !h)}
              className="text-white/60 hover:text-white text-xs px-2 py-1 rounded bg-white/10">
              {hidden ? 'Show' : 'Hide'}
            </button>
            <button onClick={onRefresh} disabled={refreshing}
              className="text-white/60 hover:text-white text-xs px-2 py-1 rounded bg-white/10">
              {refreshing ? '...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mb-1 text-white/60 text-xs uppercase tracking-widest">ICAN Balance</div>
        <div className="text-4xl font-bold text-white mb-1">
          {hidden ? '••••••' : `${formatICAN(balance.ican)} ICAN`}
        </div>
        <div className="text-white/70 text-sm mb-4">
          {hidden ? '••••••' : `≈ UGX ${Number(balance.ugx).toLocaleString()}`}
        </div>

        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <span className="text-white/50 text-xs">Address:</span>
          <span className="text-white/80 text-xs font-mono truncate">{walletAddress ?? 'Generating…'}</span>
          {walletAddress && (
            <button onClick={() => { navigator.clipboard.writeText(walletAddress); toast.info('Address copied'); }}
              className="text-white/50 hover:text-white text-xs ml-auto shrink-0">Copy</button>
          )}
        </div>

        <div className="mt-3 text-white/40 text-xs">Floor price: 1 ICAN = UGX {ICAN_TO_UGX.toLocaleString()}</div>
      </div>
    </div>
  );
}

function SendModal({ userId, walletAddress, onClose, onDone }) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!recipientAddress || !amount) { toast.error('Fill in all fields'); return; }
    setLoading(true);
    try {
      // Resolve wallet address → user_id
      const { data: recipientWallet, error } = await supabase
        .from('ican_user_wallets')
        .select('user_id')
        .eq('wallet_address', recipientAddress.trim())
        .single();
      if (error || !recipientWallet) { toast.error('Wallet address not found'); return; }

      await sendICAN({
        fromUserId: userId,
        toUserId: recipientWallet.user_id,
        amount: parseFloat(amount),
        note,
      });
      toast.success(`Sent ${amount} ICAN`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">Send ICAN</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Recipient Wallet Address</label>
            <input
              value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)}
              placeholder="ICA-XXXXXXXXXXXXXXXX"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-violet-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Amount (ICAN)</label>
            <input
              type="number" min="0.0001" step="0.0001"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.0000"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-violet-500"
            />
            {amount && <p className="text-gray-500 text-xs mt-1">≈ UGX {(parseFloat(amount || 0) * ICAN_TO_UGX).toLocaleString()}</p>}
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Note (optional)</label>
            <input
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="What's this for?"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-violet-500"
            />
          </div>
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-amber-300 text-xs">
            10% tithe is automatically deducted from the recipient's earnings.
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium text-sm">Cancel</button>
          <button onClick={handleSend} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm disabled:opacity-60">
            {loading ? 'Sending…' : 'Send ICAN'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiveModal({ walletAddress, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl text-center">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">Receive ICAN</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        <div className="bg-white rounded-xl p-4 mx-auto w-48 h-48 flex items-center justify-center mb-4">
          <div className="text-xs text-gray-500 text-center">
            QR Code<br />(install qrcode.react to render)
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 text-white font-mono text-sm break-all mb-4">
          {walletAddress}
        </div>
        <button onClick={() => { navigator.clipboard.writeText(walletAddress); toast.info('Copied!'); }}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm">
          Copy Address
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ICANWalletPage() {
  const [userId, setUserId] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState({ ican: 0, ugx: 0, address: null });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null); // 'send' | 'receive' | null
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  const loadWallet = useCallback(async () => {
    if (!userId) return;
    try {
      await getOrCreateWallet(userId);
      const [bal, txs] = await Promise.all([
        getBalance(userId),
        getTransactions(userId, 50),
      ]);
      setBalance(bal);
      setTransactions(txs);
    } catch (e) {
      toast.error('Could not load wallet: ' + e.message);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    loadWallet().finally(() => setLoading(false));
  }, [userId, loadWallet]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWallet();
    setRefreshing(false);
  };

  const filteredTx = transactions.filter(tx => {
    if (activeTab === 'all') return true;
    if (activeTab === 'in') return tx.direction === 'in';
    if (activeTab === 'out') return tx.direction === 'out';
    if (activeTab === 'tithe') return tx.transaction_type === 'tithe';
    return true;
  });

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-gray-400">Please sign in to access your ICAN Wallet</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading your ICAN wallet…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
            <span className="font-bold text-lg">₡</span>
          </div>
          <div>
            <h1 className="font-bold text-xl">ICAN Wallet</h1>
            <p className="text-gray-500 text-sm">Supermarket — powered by Icaneracoin</p>
          </div>
        </div>

        {/* Balance card */}
        <BalanceCard
          balance={balance}
          walletAddress={balance.address}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Send', icon: '↑', color: 'from-violet-700 to-violet-900', action: () => setModal('send') },
            { label: 'Receive', icon: '↓', color: 'from-emerald-700 to-emerald-900', action: () => setModal('receive') },
            { label: 'History', icon: '≡', color: 'from-blue-700 to-blue-900', action: () => document.getElementById('tx-section')?.scrollIntoView({ behavior: 'smooth' }) },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              className={`bg-gradient-to-br ${btn.color} rounded-2xl p-4 flex flex-col items-center gap-2 hover:opacity-90 active:scale-95 transition-all`}>
              <span className="text-2xl font-light">{btn.icon}</span>
              <span className="text-sm font-medium">{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Earned', value: `${formatICAN(balance.ican)} ICAN` },
            { label: 'Rate', value: `1 ICAN = ${ICAN_TO_UGX.toLocaleString()} UGX` },
            { label: 'Tithe Rate', value: '10% auto-deducted' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-xs mb-1">{s.label}</p>
              <p className="text-white font-semibold text-xs">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Transaction history */}
        <div id="tx-section">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base">Transaction History</h2>
            <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
              {['all', 'in', 'out', 'tithe'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`text-xs px-3 py-1.5 rounded-md capitalize transition-colors ${activeTab === tab ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">💳</div>
              <p className="text-gray-500 text-sm">No transactions yet. Pay or receive ICAN at the supermarket checkout.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTx.map(tx => {
                const badge = APP_BADGE[tx.source_app] ?? APP_BADGE.ican;
                const isIn = tx.direction === 'in';
                return (
                  <div key={tx.id} className="bg-gray-900 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${isIn ? 'bg-emerald-900' : 'bg-rose-900'}`}>
                      {isIn ? '↓' : '↑'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white text-sm font-medium">
                          {TX_LABELS[tx.transaction_type] ?? tx.transaction_type}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                      </div>
                      <p className="text-gray-500 text-xs truncate">{tx.note || '—'}</p>
                      <p className="text-gray-600 text-xs">{formatDate(tx.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-semibold text-sm ${TX_COLORS[tx.transaction_type] ?? (isIn ? 'text-emerald-400' : 'text-rose-400')}`}>
                        {isIn ? '+' : '-'}{formatICAN(tx.ican_amount)} ICAN
                      </p>
                      <p className="text-gray-600 text-xs">
                        UGX {Number(tx.ican_amount * ICAN_TO_UGX).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Earn more section */}
        <div className="bg-gradient-to-br from-violet-900/40 to-blue-900/40 border border-violet-700/30 rounded-2xl p-5">
          <h3 className="font-semibold mb-2">Earn ICAN at the Supermarket</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> Pay with ICAN at checkout — 1% cashback on every purchase</li>
            <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> Suppliers earn ICAN on every approved delivery</li>
            <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> 10% tithe is auto-deducted from all earnings</li>
          </ul>
        </div>

      </div>

      {/* Modals */}
      {modal === 'send' && (
        <SendModal
          userId={userId}
          walletAddress={balance.address}
          onClose={() => setModal(null)}
          onDone={loadWallet}
        />
      )}
      {modal === 'receive' && balance.address && (
        <ReceiveModal walletAddress={balance.address} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
