import React from 'react';
import { createPortal } from 'react-dom';
import UnifiedProfilePage from '../pages/UnifiedProfilePage';

/**
 * Shows the single unified profile page as a full-screen page layered over
 * whatever portal is open (closing returns to the same portal state without a
 * route change). Portaled to <body> so no ancestor header's
 * overflow/z-index can clip it (same reasoning as PortalSwitcher's dropdown).
 */
const ProfileModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] overflow-y-auto sk-portal-themed" role="dialog" aria-modal="true" aria-label="My Profile">
      <UnifiedProfilePage onClose={onClose} />
    </div>,
    document.body
  );
};

export default ProfileModal;
