import React, { useEffect, useState } from 'react';
import { FiChevronDown, FiTrash2 } from 'react-icons/fi';
import '../styles/supermartkera-portals.css';

const normalizeTone = (value) => {
  const type = String(value || '').toLowerCase();
  if (['urgent', 'critical', 'error', 'danger', 'high'].includes(type)) return 'urgent';
  if (['warning', 'medium', 'pending'].includes(type)) return 'warning';
  return 'info';
};

const readDismissedKeys = (storageKey) => {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(storageKey) || '[]').map(String));
  } catch {
    return new Set();
  }
};

/** Shared compact notification feed used by portal dashboards and wallet approvals. */
export default function ClassicNotificationList({
  notifications = [],
  title = 'Notifications',
  eyebrow = 'Workspace / Updates',
  description = 'Select a notification to read the full message.',
  emptyMessage = "You're all caught up. New notifications will appear here.",
  showHeading = true,
  variant = 'panel',
  className = '',
  idPrefix = 'classic-notification',
  storageKey = `classic-notification-dismissals:${idPrefix}`,
  getId,
  getTitle,
  getMessage,
  getTime,
  getType,
  getUnread,
  renderExpanded,
  onDelete
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [dismissedKeys, setDismissedKeys] = useState(() => readDismissedKeys(storageKey));

  useEffect(() => {
    setDismissedKeys(readDismissedKeys(storageKey));
  }, [storageKey]);

  const notificationKeyFor = (notification, index) => (getId ? getId(notification, index) : notification.id) ?? index;
  const visibleNotifications = notifications
    .map((notification, index) => ({ notification, index, key: notificationKeyFor(notification, index) }))
    .filter(({ key }) => !dismissedKeys.has(String(key)));

  const dismissNotification = (notification, index, key) => {
    const nextDismissedKeys = new Set(dismissedKeys);
    nextDismissedKeys.add(String(key));
    setDismissedKeys(nextDismissedKeys);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...nextDismissedKeys]));
    } catch { /* keep the notification dismissed for this render if storage is unavailable */ }
    onDelete?.(notification, index);
  };

  return (
    <section className={`classic-notifications-feed classic-notifications-${variant} ${className}`.trim()}>
      {showHeading && (
        <header className="classic-notifications-heading">
          <div>
            <p className="classic-eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <span className="classic-notifications-count" aria-label={`${visibleNotifications.length} notifications`}>
            {visibleNotifications.length}
          </span>
        </header>
      )}

      <div className="classic-notifications-list">
        {visibleNotifications.length ? visibleNotifications.map(({ notification, index, key }) => {
          const id = `${idPrefix}-message-${index}`;
          const isExpanded = expandedId === key;
          const sourceType = getType ? getType(notification) : notification.type;
          const tone = normalizeTone(sourceType);
          const typeLabel = String(sourceType || 'Update').replaceAll('_', ' ');
          const unread = getUnread
            ? Boolean(getUnread(notification))
            : notification.unread !== undefined
              ? Boolean(notification.unread)
              : notification.read !== undefined && !notification.read;
          const titleText = getTitle ? getTitle(notification) : notification.title || 'Notification';
          const message = getMessage ? getMessage(notification) : notification.message || '';
          const rawTime = getTime ? getTime(notification) : notification.time ?? notification.timestamp;
          const time = rawTime instanceof Date ? rawTime.toLocaleString() : rawTime;

          return (
            <article
              key={key}
              className={`classic-notification-row${unread ? ' is-unread' : ' is-read'}${isExpanded ? ' is-expanded' : ''}`}
            >
              <button
                type="button"
                className="classic-notification-toggle"
                aria-expanded={isExpanded}
                aria-controls={id}
                onClick={() => setExpandedId((currentId) => currentId === key ? null : key)}
              >
                <span className={`classic-notification-dot type-${tone}`} aria-hidden="true" />
                <span className="classic-notification-summary">
                  <span className="classic-notification-title-line">
                    <span className="classic-notification-title">{titleText}</span>
                    <span className={`classic-notification-type type-${tone}`}>{typeLabel}</span>
                  </span>
                  {time && <span className="classic-notification-time">{time}</span>}
                </span>
                <FiChevronDown className="classic-notification-chevron" aria-hidden="true" />
              </button>
              <div id={id} className="classic-notification-detail" hidden={!isExpanded}>
                {message && <p className="classic-notification-message">{message}</p>}
                {renderExpanded?.(notification, index)}
                <div className="classic-notification-delete-row">
                  <button
                    type="button"
                    className="classic-notification-delete"
                    aria-label={`Delete notification: ${titleText}`}
                    onClick={() => dismissNotification(notification, index, key)}
                  >
                    <FiTrash2 aria-hidden="true" />
                    <span>Delete notification</span>
                  </button>
                </div>
              </div>
            </article>
          );
        }) : (
          <p className="classic-notifications-empty">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}
