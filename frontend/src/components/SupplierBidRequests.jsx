import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Gavel, Loader, RefreshCw } from 'lucide-react';
import supplierBidRequestsService from '../services/supplierBidRequestsService';

const formatUgx = (value) => `UGX ${Number(value || 0).toLocaleString()}`;

const BID_STATUS = {
  submitted: { label: 'Submitted', className: 'bg-gray-100 text-gray-700' },
  under_review: { label: 'Under review', className: 'bg-amber-50 text-amber-700' },
  shortlisted: { label: 'Shortlisted', className: 'bg-sky-50 text-sky-700' },
  interview: { label: 'Interview', className: 'bg-sky-50 text-sky-700' },
  selected: { label: 'Won', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Not selected', className: 'bg-rose-50 text-rose-700' },
  withdrawn: { label: 'Withdrawn', className: 'bg-gray-100 text-gray-500' },
};

const PAYMENT_LABEL = {
  not_requested: 'Payment not requested yet',
  pending_approval: 'Payment awaiting the buyer’s approval',
  paid: 'Paid',
  rejected: 'Payment rejected',
  cancelled: 'Payment cancelled',
};

const inputClass = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300';

/**
 * A supplier's view of supply requests raised from buyers' requisitions: the
 * open ones to price (one unit price per item, all items required), and its
 * own bid history including the order a won bid becomes.
 */
export default function SupplierBidRequests({ supplierBusinessProfileId }) {
  const [requests, setRequests] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supplierBusinessProfileId) { setLoading(false); return; }
    setLoading(true);
    const [requestsResult, bidsResult] = await Promise.all([
      supplierBidRequestsService.getOpenSupplyRequests(supplierBusinessProfileId),
      supplierBidRequestsService.getMySupplierBids(supplierBusinessProfileId),
    ]);
    setRequests(requestsResult.data || []);
    setMyBids(bidsResult.data || []);
    // A missing migration or a non-published business surfaces here as text.
    setError(requestsResult.success ? '' : requestsResult.error);
    setLoading(false);
  }, [supplierBusinessProfileId]);

  useEffect(() => { load(); }, [load]);

  if (!supplierBusinessProfileId) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Gavel className="h-4 w-4 text-indigo-600" /> Bid requests</h3>
          <p className="text-xs text-gray-500 mt-1">Businesses list the items they need to buy. Quote a price for every item — the buyer compares bids and awards one.</p>
        </div>
        <button onClick={load} title="Refresh" className="text-gray-400 hover:text-gray-600">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400 flex items-center gap-2"><Loader className="h-4 w-4 animate-spin" /> Loading bid requests…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-400">No open bid requests right now.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} supplierBusinessProfileId={supplierBusinessProfileId} onChanged={load} />
          ))}
        </div>
      )}

      {myBids.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">My bids</p>
          <div className="space-y-2">
            {myBids.map((bid) => {
              const status = BID_STATUS[bid.bid_status] || BID_STATUS.submitted;
              return (
                <div key={bid.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-700 truncate">{bid.title}</p>
                    <p className="text-xs text-gray-400">
                      {bid.company_name} · {formatUgx(bid.amount)} · {new Date(bid.submitted_at).toLocaleDateString()}
                      {bid.opportunity_status === 'cancelled' ? ' · Request cancelled by buyer' : ''}
                    </p>
                    {bid.order_number && (
                      <p className="text-xs text-emerald-700 mt-0.5">Order {bid.order_number} · {PAYMENT_LABEL[bid.payment_status] || bid.payment_status}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ request, supplierBusinessProfileId, onChanged }) {
  const existing = request.my_bid || null;
  const canRevise = !existing || ['submitted', 'under_review', 'shortlisted', 'interview', 'withdrawn'].includes(existing.status);

  const initialPrices = useMemo(() => {
    const prices = {};
    (existing?.items || []).forEach((row) => { prices[row.opportunity_item_id] = { price: String(row.unit_price ?? ''), notes: row.notes || '' }; });
    return prices;
  }, [existing]);

  const [open, setOpen] = useState(false);
  const [prices, setPrices] = useState(initialPrices);
  const [leadTime, setLeadTime] = useState(existing?.lead_time_days ?? '');
  const [proposal, setProposal] = useState(existing?.proposal && existing.proposal !== 'Itemised quotation' ? existing.proposal : '');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const items = request.items || [];
  const lineTotal = (item) => (Number(item.quantity) || 0) * (Number(prices[item.id]?.price) || 0);
  const total = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const allPriced = items.length > 0 && items.every((item) => Number(prices[item.id]?.price) > 0);

  const setPrice = (itemId, patch) => setPrices((current) => ({ ...current, [itemId]: { price: '', notes: '', ...current[itemId], ...patch } }));

  const submit = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    const result = await supplierBidRequestsService.submitSupplierBid(request.id, supplierBusinessProfileId, {
      items: items.map((item) => ({
        opportunity_item_id: item.id,
        unit_price: Number(prices[item.id].price),
        notes: prices[item.id].notes?.trim() || null,
      })),
      proposal,
      leadTimeDays: leadTime,
      contact,
    });
    setSaving(false);
    if (!result.success) { setError(result.error); return; }
    setMessage(existing ? 'Bid updated.' : 'Bid submitted.');
    setOpen(false);
    onChanged();
  };

  const withdraw = async () => {
    if (!window.confirm('Withdraw your bid on this request?')) return;
    setSaving(true);
    setError('');
    const result = await supplierBidRequestsService.withdrawSupplierBid(existing.id);
    setSaving(false);
    if (!result.success) { setError(result.error); return; }
    onChanged();
  };

  const status = existing ? (BID_STATUS[existing.status] || BID_STATUS.submitted) : null;

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-800">{request.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {request.company_name}
            {request.deadline ? ` · Closes ${new Date(request.deadline).toLocaleDateString()}` : ''}
            {request.delivery_location ? ` · Deliver to ${request.delivery_location}` : ''}
          </p>
          {request.description && <p className="text-xs text-gray-500 mt-1">{request.description}</p>}
        </div>
        <div className="text-right">
          {status && <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>Your bid: {status.label}</span>}
          {existing && existing.status !== 'withdrawn' && <p className="text-sm font-semibold text-gray-800 mt-1">{formatUgx(existing.amount)}</p>}
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-gray-50 p-2">
        <table className="w-full text-xs text-gray-600">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-400">
              <th className="text-left font-medium py-1">Item</th>
              <th className="text-right font-medium py-1">Quantity</th>
              {open && <th className="text-right font-medium py-1 w-32">Unit price (UGX)</th>}
              {open && <th className="text-right font-medium py-1">Line total</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-gray-100 align-top">
                <td className="py-1 pr-2">
                  {item.item_name}
                  {item.description && <span className="block text-[10px] text-gray-400">{item.description}</span>}
                  {open && (
                    <input
                      value={prices[item.id]?.notes || ''}
                      onChange={(e) => setPrice(item.id, { notes: e.target.value })}
                      placeholder="Brand / note (optional)"
                      className={`${inputClass} mt-1 text-xs`}
                    />
                  )}
                </td>
                <td className="py-1 text-right whitespace-nowrap">{Number(item.quantity)} {item.unit}</td>
                {open && (
                  <td className="py-1 pl-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={prices[item.id]?.price || ''}
                      onChange={(e) => setPrice(item.id, { price: e.target.value })}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                )}
                {open && <td className="py-1 pl-2 text-right whitespace-nowrap">{formatUgx(lineTotal(item))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="mt-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <input type="number" min="0" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="Delivery time in days" className={inputClass} />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact phone or email (optional)" className={inputClass} />
          </div>
          <textarea rows={2} value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="Terms, warranty, validity… (optional)" className={inputClass} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800">Total: {formatUgx(total)}</p>
            <div className="flex gap-2">
              <button onClick={() => { setOpen(false); setError(''); }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              <button disabled={saving || !allPriced} onClick={submit} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-1.5 text-xs font-semibold text-white">
                {saving ? 'Sending…' : existing ? 'Update bid' : 'Submit bid'}
              </button>
            </div>
          </div>
          {!allPriced && <p className="text-[11px] text-gray-400">Every item needs a unit price greater than zero.</p>}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-end gap-3">
          {message && <span className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> {message}</span>}
          {existing && ['submitted', 'under_review', 'shortlisted', 'interview'].includes(existing.status) && (
            <button disabled={saving} onClick={withdraw} className="text-xs text-rose-600 hover:text-rose-500 disabled:opacity-50">Withdraw</button>
          )}
          {canRevise && (
            <button onClick={() => { setOpen(true); setMessage(''); }} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white">
              {existing && existing.status !== 'withdrawn' ? 'Revise bid' : 'Quote this request'}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
