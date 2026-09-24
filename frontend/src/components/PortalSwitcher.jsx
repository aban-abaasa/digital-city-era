import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiChevronDown } from 'react-icons/fi';
import { usePortalAccess } from '../hooks/usePortalAccess';

const PortalSwitcher = ({ variant = 'light', fullWidth = false, onNavigate, mobileFloating = false, mobileFloatingPositionClass = 'top-3 right-3 z-40' }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { accessiblePortals, currentPortal } = usePortalAccess();
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const insideButton = buttonRef.current && buttonRef.current.contains(event.target);
      const insideMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!insideButton && !insideMenu) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The dropdown is portaled to <body> so no ancestor header's overflow can
  // clip it (ManagerPortal's header has overflow-hidden for its decorative
  // background) — position it by the button's real screen coordinates.
  // Clamped so the fixed w-72 menu can never hang off the left edge on a
  // narrow phone when the button itself sits near the left of its row.
  const MENU_WIDTH = 288; // matches w-72
  const MENU_MARGIN = 8;
  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const rawRight = window.innerWidth - rect.right;
      const clampedRight = Math.min(
        Math.max(rawRight, MENU_MARGIN),
        Math.max(window.innerWidth - MENU_WIDTH - MENU_MARGIN, MENU_MARGIN)
      );
      setMenuPos({ top: rect.bottom + 8, right: clampedRight });
    }
    setIsOpen((prev) => !prev);
  };

  // Nothing to switch to (e.g. a plain customer or supplier) — hide entirely.
  if (accessiblePortals.length <= 1) return null;

  const CurrentIcon = (currentPortal || accessiblePortals[0]).icon;

  const handleSwitch = (portal) => {
    setIsOpen(false);
    onNavigate?.(); // close any parent mobile drawer — otherwise it stays
    // open on top of the page that just navigated underneath it, and the
    // switch looks like it did nothing.
    toast.info(`Switching to ${portal.name}...`, { position: 'top-right', autoClose: 1200 });
    navigate(portal.route);
  };

  const isDark = variant === 'dark';
  const displayPortal = currentPortal || accessiblePortals[0];

  // A persistent, always-reachable way to switch portals on phones — pinned
  // to the top-right corner instead of buried inside a hamburger drawer.
  // Desktop already gets the normal inline switcher elsewhere in each
  // portal's header, so this variant renders nothing at md and up.
  if (mobileFloating) {
    return (
      <div className="md:hidden">
        <button
          ref={buttonRef}
          onClick={toggleOpen}
          className={`fixed ${mobileFloatingPositionClass} flex items-center justify-center w-11 h-11 rounded-full shadow-lg ring-2 ring-white bg-gradient-to-r ${displayPortal.color} text-white transition-transform active:scale-95`}
          title="Switch portal"
        >
          <CurrentIcon className="h-5 w-5" />
        </button>

        {isOpen && createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
            className="w-72 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-[9999]"
          >
            <div className="p-2 max-h-96 overflow-y-auto">
              {accessiblePortals.map((portal) => {
                const PortalIcon = portal.icon;
                const isActive = currentPortal?.id === portal.id;
                return (
                  <button
                    key={portal.id}
                    onClick={() => handleSwitch(portal)}
                    className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all mb-1 ${
                      isActive ? 'bg-blue-50 border-2 border-blue-400' : 'hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${portal.color} flex-shrink-0`}>
                      <PortalIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 text-sm">{portal.name}</p>
                      {portal.subtitle && <p className="text-xs text-gray-500">{portal.subtitle}</p>}
                    </div>
                    {isActive && (
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Active</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div className={fullWidth ? 'relative w-full' : 'relative'}>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className={`flex items-center space-x-2 rounded-xl border transition-all ${fullWidth ? 'w-full justify-between px-4 py-3' : 'px-3 py-2'} ${
          isDark
            ? 'bg-white/10 hover:bg-white/20 border-white/20'
            : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
        }`}
        title="Switch portal"
      >
        <span className="flex items-center space-x-2 min-w-0">
          <div className={`p-1.5 rounded-lg bg-gradient-to-r ${displayPortal.color} flex-shrink-0`}>
            <CurrentIcon className="h-4 w-4 text-white" />
          </div>
          <span className={`text-sm font-medium truncate ${fullWidth ? '' : 'hidden md:inline'} ${isDark ? 'text-white' : 'text-gray-700'}`}>{displayPortal.name}</span>
        </span>
        <FiChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isDark ? 'text-white/80' : 'text-gray-400'} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="w-72 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-[9999]"
        >
          <div className="p-2 max-h-96 overflow-y-auto">
            {accessiblePortals.map((portal) => {
              const PortalIcon = portal.icon;
              const isActive = currentPortal?.id === portal.id;
              return (
                <button
                  key={portal.id}
                  onClick={() => handleSwitch(portal)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all mb-1 ${
                    isActive ? 'bg-blue-50 border-2 border-blue-400' : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${portal.color} flex-shrink-0`}>
                    <PortalIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900 text-sm">{portal.name}</p>
                    {portal.subtitle && <p className="text-xs text-gray-500">{portal.subtitle}</p>}
                  </div>
                  {isActive && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Active</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PortalSwitcher;
