import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, ChevronDown, Gavel, Loader, RefreshCw } from 'lucide-react';
import supplierBidRequestsService from '../services/supplierBidRequestsService';
import '../styles/supplier-classic.css';

const formatUgx = (value) => `UGX ${Number(value || 0).toLocaleString()}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const BID_STATUS = {
  submitted: { label: 'Submitted', tone: '' },
  under_review: { label: 'Under review', tone: 'warn' },
  shortlisted: { label: 'Shortlisted', tone: 'info' },
  interview: { label: 'Interview', tone: 'info' },
  selected: { label: 'Won', tone: 'ok' },
  rejected: { label: 'Not selected', tone: 'bad' },
  withdrawn: { label: 'Withdrawn', tone: '' },
};

const PAYMENT_LABEL = {
  not_requested: 'Payment not requested yet',
  pending_approval: 'Payment awaiting the buyer’s approval',
  paid: 'Paid',
  rejected: 'Payment rejected',
  cancelled: 'Payment cancelled',
};

const Badge = ({ status }) => {
  const meta = BID_STATUS[status] || BID_STATUS.submitted;
  return <span className={`spc-badge ${meta.tone}`}>{meta.label}</span>;
};

/**
 * A supplier's bidding desk. Two kinds of request reach a supplier:
 *  - Supply requests raised from a buyer's requisition: an itemised list where
 *    EVERY item gets a unit price (published suppliers only).
 *  - Other open opportunities: one amount and a short proposal.
 * "My bids" lists both, including the order a won supply bid becomes.
 */
export default function SupplierBidRequests({ supplierBusinessProfileId, profileLoading = false, supplierProfile = null }) {
  const [tab, setTab] = useState('supply');
  const [requests, setRequests] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [myGeneralBids, setMyGeneralBids] = useState([]);
  const [published, setPublished] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supplyError, setSupplyError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const pickedTab = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const svc = supplierBidRequestsService;
    const [supplyResult, bidsResult, publishedState, generalResult, generalBids] = await Promise.all([
      supplierBusinessProfileId ? svc.getOpenSupplyRequests(supplierBusinessProfileId) : Promise.resolve({ success: true, data: [] }),
      supplierBusinessProfileId ? svc.getMySupplierBids(supplierBusinessProfileId) : Promise.resolve({ success: true, data: [] }),
      supplierBusinessProfileId ? svc.getSupplierPublishedState(supplierBusinessProfileId) : Promise.resolve(null),
      svc.getOpenGeneralOpportunities(),
      svc.getMyGeneralBids(),
    ]);
    setRequests(supplyResult.data || []);
    setMyBids(bidsResult.data || []);
    setPublished(publishedState);
    setOpportunities(generalResult.data || []);
    setMyGeneralBids(generalBids.data || []);
    // A missing migration or a business that is not a member surfaces as text.
    setSupplyError(supplyResult.success ? '' : supplyResult.error);
    setGeneralError(generalResult.success ? '' : generalResult.error);
    setLoading(false);
    // First load: land where the work is instead of on an empty list.
    if (!pickedTab.current) {
      if ((supplyResult.data || []).length === 0 && (generalResult.data || []).length > 0) setTab('general');
      pickedTab.current = true;
    }
  }, [supplierBusinessProfileId]);

  useEffect(() => {
    if (profileLoading) return;
    load();
  }, [load, profileLoading]);

  const generalByOpportunity = useMemo(() => {
    const map = {};
    myGeneralBids.forEach((bid) => { map[bid.opportunity_id] = bid; });
    return map;
  }, [myGeneralBids]);

  const bidCount = myBids.length + myGeneralBids.length;
  const busy = loading || profileLoading;

  return (
    <section className="spc-card" aria-label="Bid requests">
      <div className="spc-card-head">
        <div>
          <p className="spc-eyebrow">Bidding desk</p>
          <h3 className="spc-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Gavel size={18} /> Bid requests</h3>
          <p className="spc-sub" style={{ marginTop: 4 }}>Businesses post what they need to buy. Quote a price and the buyer awards one supplier.</p>
        </div>
        <button type="button" className="spc-icon-btn" onClick={load} disabled={busy} title="Refresh" aria-label="Refresh bid requests">
          <RefreshCw size={18} className={busy ? 'spc-spin' : ''} />
        </button>
      </div>

      <div className="spc-seg" role="tablist" style={{ marginBottom: 12 }}>
        <button type="button" role="tab" aria-selected={tab === 'supply'} className={tab === 'supply' ? 'on' : ''} onClick={() => { pickedTab.current = true; setTab('supply'); }}>
          Supply requests<b>{requests.length}</b>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'general'} className={tab === 'general' ? 'on' : ''} onClick={() => { pickedTab.current = true; setTab('general'); }}>
          Other opportunities<b>{opportunities.length}</b>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => { pickedTab.current = true; setTab('mine'); }}>
          My bids<b>{bidCount}</b>
        </button>
      </div>

      {busy && <p className="spc-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}><Loader size={16} className="spc-spin" /> Loading bid requests…</p>}

      {!busy && tab === 'supply' && (
        <div className="spc-list">
          {!supplierBusinessProfileId && (
            <p className="spc-note warn">Your supplier business is not linked yet. Open <strong>Use Your Business Profile</strong> and link or create it to receive itemised supply requests.</p>
          )}
          {supplierBusinessProfileId && published === false && (
            <p className="spc-note warn">Your business is not published in the supplier directory. You can read supply requests, but only published suppliers can submit a bid. Publish your catalog from <strong>My Catalog</strong>.</p>
          )}
          {supplyError && <p className="spc-note bad">{supplyError}</p>}
          {supplierBusinessProfileId && !supplyError && requests.length === 0 && (
            <div className="spc-empty">
              <b>No open supply requests</b>
              <span>When a business opens an approved requisition to suppliers, the item list appears here for you to price.</span>
            </div>
          )}
          {requests.map((request) => (
            <SupplyRequestCard key={request.id} request={request} supplierBusinessProfileId={supplierBusinessProfileId} canBid={published !== false} onChanged={load} />
          ))}
        </div>
      )}

      {!busy && tab === 'general' && (
        <div className="spc-list">
          {generalError && <p className="spc-note bad">{generalError}</p>}
          {!generalError && opportunities.length === 0 && (
            <div className="spc-empty">
              <b>No other open opportunities</b>
              <span>Open tenders from businesses that are not itemised supply lists show here.</span>
            </div>
          )}
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} existing={generalByOpportunity[opportunity.id]} supplierProfile={supplierProfile} onChanged={load} />
          ))}
        </div>
      )}

      {!busy && tab === 'mine' && (
        <div className="spc-list">
          {bidCount === 0 && (
            <div className="spc-empty"><b>No bids yet</b><span>Bids you place on supply requests and opportunities are tracked here.</span></div>
          )}
          {myBids.map((bid) => (
            <div key={bid.id} className="spc-item">
              <div className="spc-item-head" style={{ cursor: 'default' }}>
                <div className="spc-item-main">
                  <p className="spc-item-title">{bid.title}</p>
                  <p className="spc-item-meta">
                    {bid.company_name} · {formatDate(bid.submitted_at)}
                    {bid.lead_time_days != null ? ` · ${bid.lead_time_days} day delivery` : ''}
                    {bid.opportunity_status === 'cancelled' ? ' · Request cancelled by buyer' : ''}
                  </p>
                  {bid.order_number && (
                    <p className="spc-item-meta" style={{ color: 'var(--ok-fg)', fontWeight: 600 }}>
                      Order {bid.order_number} · {PAYMENT_LABEL[bid.payment_status] || bid.payment_status}
                    </p>
                  )}
                </div>
                <div className="spc-item-side">
                  <span className="spc-amount">{formatUgx(bid.amount)}</span>
                  <Badge status={bid.bid_status} />
                </div>
              </div>
            </div>
          ))}
          {myGeneralBids.map((bid) => (
            <div key={bid.id} className="spc-item">
              <div className="spc-item-head" style={{ cursor: 'default' }}>
                <div className="spc-item-main">
                  <p className="spc-item-title">{bid.opportunity_title}</p>
                  <p className="spc-item-meta">
                    {bid.company_name} · {formatDate(bid.created_at)}{bid.reference_code ? ` · Ref ${bid.reference_code}` : ''}
                  </p>
                  {bid.status_note && <p className="spc-item-meta">{bid.status_note}</p>}
                </div>
                <div className="spc-item-side">
                  {bid.amount != null && <span className="spc-amount">{formatUgx(bid.amount)}</span>}
                  <Badge status={bid.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SupplyRequestCard({ request, supplierBusinessProfileId, canBid, onChanged }) {
  const existing = request.my_bid || null;
  const canRevise = canBid && (!existing || ['submitted', 'under_review', 'shortlisted', 'interview', 'withdrawn'].includes(existing.status));

  const initialPrices = useMemo(() => {
    const prices = {};
    (existing?.items || []).forEach((row) => { prices[row.opportunity_item_id] = { price: String(row.unit_price ?? ''), notes: row.notes || '' }; });
    return prices;
  }, [existing]);

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
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
  const active = existing && existing.status !== 'withdrawn';

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
    setEditing(false);
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

  return (
    <div className="spc-item">
      <button type="button" className="spc-item-head" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <div className="spc-item-main">
          <p className="spc-item-title">{request.title}</p>
          <p className="spc-item-meta">
            {request.company_name} · {items.length} item{items.length === 1 ? '' : 's'}
            {request.deadline ? ` · Closes ${formatDate(request.deadline)}` : ''}
          </p>
        </div>
        <div className="spc-item-side">
          {active ? <span className="spc-amount">{formatUgx(existing.amount)}</span> : <span className="spc-badge info">Open</span>}
          {existing && <Badge status={existing.status} />}
        </div>
        <ChevronDown size={18} className={`spc-chev ${expanded ? 'open' : ''}`} />
      </button>

      {expanded && (
        <div className="spc-item-body">
          {request.description && <p className="spc-desc">{request.description}</p>}
          {request.delivery_location && <p className="spc-sub">Deliver to <strong>{request.delivery_location}</strong></p>}

          <div className="spc-lines">
            {items.map((item) => (
              <div key={item.id} className="spc-line">
                <div>
                  <p className="spc-line-name">{item.item_name}</p>
                  <p className="spc-line-qty">{Number(item.quantity)} {item.unit}{item.description ? ` · ${item.description}` : ''}</p>
                </div>
                {editing ? (
                  <>
                    <div className="spc-line-fields">
                      <label className="spc-field">
                        <span>Unit price (UGX)</span>
                        <input type="number" inputMode="decimal" min="0" step="0.01" className="spc-input" value={prices[item.id]?.price || ''} onChange={(e) => setPrice(item.id, { price: e.target.value })} />
                      </label>
                      <label className="spc-field">
                        <span>Brand / note</span>
                        <input className="spc-input" value={prices[item.id]?.notes || ''} onChange={(e) => setPrice(item.id, { notes: e.target.value })} placeholder="Optional" />
                      </label>
                    </div>
                    <div className="spc-line-total"><span>Line total</span><b>{formatUgx(lineTotal(item))}</b></div>
                  </>
                ) : (
                  active && (
                    <div className="spc-line-total" style={{ gridColumn: '1 / -1' }}>
                      <span>Your price</span>
                      <b>{formatUgx(prices[item.id]?.price)} each</b>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>

          {editing ? (
            <>
              <div className="spc-grid2">
                <label className="spc-field"><span>Delivery time (days)</span><input type="number" inputMode="numeric" min="0" className="spc-input" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} /></label>
                <label className="spc-field"><span>Contact phone or email</span><input className="spc-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Optional" /></label>
              </div>
              <label className="spc-field"><span>Terms, warranty, validity</span><textarea className="spc-input" rows={2} value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="Optional" /></label>
              {!allPriced && <p className="spc-sub">Every item needs a unit price greater than zero.</p>}
              <div className="spc-actions">
                <p className="spc-total">Total: {formatUgx(total)}</p>
                <button type="button" className="spc-btn ghost" onClick={() => { setEditing(false); setError(''); }}>Cancel</button>
                <button type="button" className="spc-btn" disabled={saving || !allPriced} onClick={submit}>{saving ? 'Sending…' : existing ? 'Update bid' : 'Submit bid'}</button>
              </div>
            </>
          ) : (
            <div className="spc-actions">
              {message && <span className="spc-badge ok" style={{ gap: 4 }}><CheckCircle size={13} /> {message}</span>}
              {existing && ['submitted', 'under_review', 'shortlisted', 'interview'].includes(existing.status) && (
                <button type="button" className="spc-btn danger" disabled={saving} onClick={withdraw}>Withdraw</button>
              )}
              {canRevise && (
                <button type="button" className="spc-btn" onClick={() => { setEditing(true); setMessage(''); }}>{active ? 'Revise bid' : 'Quote this request'}</button>
              )}
            </div>
          )}
          {error && <p className="spc-note bad">{error}</p>}
        </div>
      )}
    </div>
  );
}

function OpportunityCard({ opportunity, existing, supplierProfile, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('');
  const [proposal, setProposal] = useState('');
  const [phone, setPhone] = useState(supplierProfile?.phone || '');
  const [email, setEmail] = useState(supplierProfile?.email || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const name = supplierProfile?.name || supplierProfile?.contactPerson || '';
  const ready = proposal.trim().length > 0 && email.trim().length > 0 && name.trim().length > 0;

  const submit = async () => {
    setSaving(true);
    setError('');
    const result = await supplierBidRequestsService.submitGeneralBid(opportunity.id, { name, email, phone, amount, proposal });
    setSaving(false);
    if (!result.success) { setError(result.error); return; }
    setMessage(result.referenceCode ? `Bid sent. Reference ${result.referenceCode}` : 'Bid sent.');
    onChanged();
  };

  return (
    <div className="spc-item">
      <button type="button" className="spc-item-head" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <div className="spc-item-main">
          <p className="spc-item-title">{opportunity.title}</p>
          <p className="spc-item-meta">
            {opportunity.company_name}
            {opportunity.deadline ? ` · Closes ${formatDate(opportunity.deadline)}` : ''}
            {opportunity.budget_hint ? ` · Budget ${opportunity.budget_hint}` : ''}
          </p>
        </div>
        <div className="spc-item-side">
          {existing ? <Badge status={existing.status} /> : <span className="spc-badge info">Open</span>}
        </div>
        <ChevronDown size={18} className={`spc-chev ${expanded ? 'open' : ''}`} />
      </button>

      {expanded && (
        <div className="spc-item-body">
          {opportunity.description && <p className="spc-desc">{opportunity.description}</p>}
          {opportunity.delivery_location && <p className="spc-sub">Deliver to <strong>{opportunity.delivery_location}</strong></p>}

          {existing ? (
            <p className="spc-note ok">
              You bid {existing.amount != null ? formatUgx(existing.amount) : 'on this request'} on {formatDate(existing.created_at)}
              {existing.reference_code ? ` · Reference ${existing.reference_code}` : ''}. Track it under <strong>My bids</strong>.
            </p>
          ) : message ? (
            <p className="spc-note ok">{message}</p>
          ) : (
            <>
              <div className="spc-grid2">
                <label className="spc-field"><span>Your price (UGX)</span><input type="number" inputMode="decimal" min="0" className="spc-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Optional" /></label>
                <label className="spc-field"><span>Contact phone</span><input className="spc-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></label>
              </div>
              {!supplierProfile?.email && (
                <label className="spc-field"><span>Contact email</span><input type="email" className="spc-input" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              )}
              <label className="spc-field"><span>Your proposal</span><textarea className="spc-input" rows={3} value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="What you can supply, delivery time, terms…" /></label>
              <div className="spc-actions">
                <button type="button" className="spc-btn" disabled={saving || !ready} onClick={submit}>{saving ? 'Sending…' : 'Submit bid'}</button>
              </div>
            </>
          )}
          {error && <p className="spc-note bad">{error}</p>}
        </div>
      )}
    </div>
  );
}
