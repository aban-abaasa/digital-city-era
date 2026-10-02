import React, { memo, useId, useState } from 'react';
import {
  FiActivity, FiBriefcase, FiCalendar, FiChevronDown, FiEye, FiPhone, FiPower, FiTrash2, FiUser
} from 'react-icons/fi';
import './AdminUserCard.css';

const ROLE_ICONS = { manager: '👔', cashier: '💰', employee: '👥', supplier: '📦', admin: '⚡', customer: '👤' };
const ASSIGNABLE = [
  { role: 'manager', label: 'Manager', icon: '👔' },
  { role: 'cashier', label: 'Cashier', icon: '💰' },
  { role: 'supplier', label: 'Supplier', icon: '🏭' },
  { role: 'customer', label: 'Customer', icon: '👤' }
];

const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Detail = ({ icon, label, children, mono }) => {
  const Icon = icon;
  return children ? (
    <div className="auc-detail">
      <dt><Icon aria-hidden="true" />{label}</dt>
      <dd className={mono ? 'auc-mono' : ''}>{children}</dd>
    </div>
  ) : null;
};

/**
 * One row of the admin's user list. Collapsed it is a single tappable line (who, role, status);
 * opened it shows the contact details and every action. Colours come from CSS variables so the
 * card follows the portal's light / dark theme instead of fixed gradients.
 */
const AdminUserCard = ({ user, onAssignRole, onRevoke, onToggleActive, onDetails, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const role = String(user.role || 'customer').toLowerCase();
  const meta = user.metadata || {};
  const company = meta.company_name || meta.companyName;
  const category = meta.business_category || meta.businessCategory;
  const license = meta.business_license || meta.businessLicense;
  const isAdmin = role === 'admin';

  return (
    <article className={`auc auc-role-${role}${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="auc-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="auc-avatar" aria-hidden="true">{ROLE_ICONS[role] || '👤'}</span>
        <span className="auc-who">
          <span className="auc-name">{user.full_name || 'Unnamed user'}</span>
          <span className="auc-email">{user.email}</span>
          <span className="auc-status">
            <span className={`auc-chip ${user.email_verified ? 'auc-chip-ok' : 'auc-chip-warn'}`}>
              {user.email_verified ? 'Email verified' : 'Email pending'}
            </span>
            <span className={`auc-chip ${user.is_active ? 'auc-chip-ok' : 'auc-chip-off'}`}>
              <i aria-hidden="true" />{user.is_active ? 'Active' : 'Inactive'}
            </span>
          </span>
        </span>
        <span className="auc-role">{role}</span>
        <FiChevronDown className="auc-caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="auc-body" id={panelId}>
          <dl className="auc-details">
            <Detail icon={FiPhone} label="Phone">{user.phone}</Detail>
            <Detail icon={FiUser} label="Employee ID" mono>{user.employee_id}</Detail>
            <Detail icon={FiBriefcase} label="Department">{user.department}</Detail>
            <Detail icon={FiCalendar} label="Joined">{user.created_at ? fmtDate(user.created_at) : ''}</Detail>
            <Detail icon={FiActivity} label="Last sign-in">{user.last_sign_in_at ? fmtDateTime(user.last_sign_in_at) : ''}</Detail>
          </dl>

          {role === 'supplier' && company && (
            <div className="auc-callout">
              <b>🏢 {company}</b>
              {category && <span>📦 {category}</span>}
              {meta.address && <span>📍 {meta.address}</span>}
              {license && <span>📄 License: {license}</span>}
            </div>
          )}
          {role === 'cashier' && meta.preferred_shift && (
            <div className="auc-callout"><b>⏰ Preferred shift</b><span className="auc-cap">{meta.preferred_shift}</span></div>
          )}
          {role === 'manager' && user.department && (
            <div className="auc-callout"><b>🎯 Department</b><span>{user.department} Management</span></div>
          )}

          {!isAdmin && (
            <div className="auc-assign">
              <p className="auc-label">Assign role</p>
              <div className="auc-assign-row">
                {ASSIGNABLE.map(({ role: r, label, icon }) => (
                  <button
                    key={r}
                    type="button"
                    className={`auc-pill${role === r ? ' is-current' : ''}`}
                    onClick={() => onAssignRole(r)}
                    disabled={role === r}
                    aria-pressed={role === r}
                  >
                    <span aria-hidden="true">{icon}</span>{label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="auc-actions">
            <button type="button" className="auc-btn auc-btn-primary" onClick={onDetails}>
              <FiEye aria-hidden="true" />Details
            </button>
            {!isAdmin && (
              <button type="button" className={`auc-btn ${user.is_active ? 'auc-btn-warn' : 'auc-btn-ok'}`} onClick={onToggleActive}>
                <FiPower aria-hidden="true" />{user.is_active ? 'Deactivate' : 'Activate'}
              </button>
            )}
            {!isAdmin && role !== 'customer' && (
              <button type="button" className="auc-btn auc-btn-danger" onClick={onRevoke} title="Remove role → customer">
                <FiTrash2 aria-hidden="true" />Revoke
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

export default memo(AdminUserCard);
