import React from 'react';
import { createPortal } from 'react-dom';
import UnifiedProfilePage from '../pages/UnifiedProfilePage';

/**
 * Shows the single unified profile page as an actual popup dialog — dimmed
 * backdrop, centered card — sitting on top of whatever portal is open,
 * matching every other modal in this app, instead of a full-bleed
 * standalone-page takeover. Portaled to <body> so no ancestor header's
 * overflow/z-index can clip it (same reasoning as PortalSwitcher's dropdown).
 */
const ProfileModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-5xl sm:max-h-[92vh] min-h-screen sm:min-h-0 overflow-y-auto">
        <UnifiedProfilePage onClose={onClose} />
      </div>
    </div>,
    document.body
  );
};

export default ProfileModal;
