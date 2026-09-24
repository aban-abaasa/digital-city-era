import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSun, FiMoon, FiUser, FiLogOut, FiShoppingBag } from 'react-icons/fi';
import { supabase } from '../services/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { usePortalAccess } from '../hooks/usePortalAccess';
import { prefetchPortal } from '../utils/portalPages';

/**
 * The one header every Supermartkera portal shares — same layout as
 * BodaGoEra's UnifiedDashboard header:
 *   - sticky classic indigo bar (same serif/gold styling as the customer
 *     dashboard) with a gold hairline
 *   - brand + "<PORTAL> DASHBOARD" eyebrow on the left
 *   - theme toggle + round avatar menu (My Profile / Sign out) on the right
 *   - an underlined tab strip of every portal you can enter, shown only when
 *     you have more than one (a plain supplier or customer gets a clean bar)
 *
 * Props let a portal keep what is specific to it without a second header:
 *   leftSlot / rightSlot   extra controls (e.g. a mobile menu button)
 *   menuItems              extra avatar-menu entries [{ label, icon, onClick }]
 *   onProfile / onSignOut  override the defaults (portals with their own
 *                          profile modal or logout bookkeeping)
 *   onWalletClick + walletActive
 *                          adds a wallet tab at the end of the strip that
 *                          behaves like BodaGoEra's ₡ Wallet tab
 *   badgeCount             red count shown on the avatar (e.g. pending approvals)
 *   onCurrentPortalClick   called when the active portal's own tab is tapped
 *                          (e.g. to leave the wallet tab again)
 */
const PortalHeader = ({
  brand = 'Supermartkera',
  title,
  leftSlot = null,
  rightSlot = null,
  menuItems = [],
  onProfile,
  onSignOut,
  onWalletClick,
  walletActive = false,
  onCurrentPortalClick,
  avatarUrl: avatarUrlProp = null,
  badgeCount = 0
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { accessiblePortals, currentPortal, pageMeta } = usePortalAccess();
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(avatarUrlProp);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !active) return;
        setEmail(session.user.email || '');
        if (avatarUrlProp) return;
        // The profile page saves the picture to unified_profiles first and
        // copies it to users.avatar_url best-effort, so check both — otherwise
        // an account whose users row missed the copy shows just an initial.
        const { data: userRow } = await supabase
          .from('users')
          .select('id, avatar_url')
          .or(`auth_id.eq.${session.user.id},id.eq.${session.user.id}`)
          .maybeSingle();
        let url = userRow?.avatar_url || null;
        if (!url) {
          const ids = [...new Set([session.user.id, userRow?.id].filter(Boolean))];
          const { data: profileRow } = await supabase
            .from('unified_profiles')
            .select('avatar_url')
            .in('user_id', ids)
            .not('avatar_url', 'is', null)
            .limit(1)
            .maybeSingle();
          url = profileRow?.avatar_url || null;
        }
        if (active && url) setAvatarUrl(url);
      } catch (err) {
        console.warn('[PortalHeader] Could not load account details:', err);
      }
    })();
    return () => { active = false; };
  }, [avatarUrlProp]);

  useEffect(() => {
    if (avatarUrlProp) setAvatarUrl(avatarUrlProp);
  }, [avatarUrlProp]);

  useEffect(() => {
    if (!showMenu) return undefined;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const active = currentPortal || pageMeta;
  const ActiveIcon = active?.icon || FiShoppingBag;
  const subtitle = title || `${active?.label || 'Portal'} Dashboard`;
  const showTabs = accessiblePortals.length > 1;

  const handleSignOut = async () => {
    setShowMenu(false);
    if (onSignOut) { onSignOut(); return; }
    try { await supabase.auth.signOut(); } catch (err) { console.warn('[PortalHeader] Sign out failed:', err); }
    try { localStorage.removeItem('supermarket_user'); } catch { /* storage unavailable */ }
    window.location.href = '/login';
  };

  const handleProfile = () => {
    setShowMenu(false);
    if (onProfile) onProfile();
    else navigate('/profile');
  };

  const tabClass = (isActive) => `flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
    isActive ? 'text-white border-b-2 border-[#f5dfa0]' : 'text-white/70 hover:text-white/90'
  }`;

  return (
    <header className="bg-gradient-to-br from-[#1e3a8a] via-[#3730a3] to-[#6d28d9] text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-12 sm:h-14 md:h-16">
          {/* Left: brand */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {leftSlot}
            <span className="grid h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-[#f5dfa0]/70 shadow-inner">
              <ActiveIcon className="h-4 w-4 sm:h-5 sm:w-5 text-[#f5dfa0]" />
            </span>
            <div className="min-w-0">
              <h1 className="font-classic-display text-base sm:text-xl font-bold leading-none truncate">{brand}</h1>
              <p className="mt-1 text-[9px] sm:text-[10px] font-semibold uppercase leading-none tracking-[0.2em] sm:tracking-[0.24em] text-[#f3dc9b] hidden min-[400px]:block truncate">{subtitle}</p>
            </div>
          </div>

          {/* Right: extras + theme toggle + avatar menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {rightSlot}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white text-slate-800 font-bold text-xs sm:text-sm ring-2 ring-[#f5dfa0]/80 shadow-md hover:ring-[#f5dfa0] transition-all flex-shrink-0 overflow-hidden"
                title={email}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (email || '?').charAt(0).toUpperCase()
                )}
              </button>
              {badgeCount > 0 && (
                <span className="pointer-events-none absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white animate-pulse">
                  {badgeCount}
                </span>
              )}

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-[#c4a052]/30 py-2 min-w-[230px] z-50 text-slate-800">
                  <div className="px-4 pb-3 pt-2 border-b border-[#c4a052]/25 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 font-bold text-slate-700">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (email || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="classic-eyebrow !text-[9px]">Signed in as</p>
                      <p className="text-sm font-medium truncate">{email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleProfile}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FiUser size={16} />
                    <span className="text-sm font-medium">My Profile</span>
                  </button>
                  {menuItems.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => { setShowMenu(false); item.onClick?.(); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                    >
                      {item.icon ? <item.icon size={16} /> : null}
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <FiLogOut size={16} />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Portal tabs — one per portal you can enter; hidden with a single portal */}
        {showTabs && (
          <div className="flex gap-1 pb-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {accessiblePortals.map((portal) => {
              const isCurrent = currentPortal?.id === portal.id;
              return (
                <button
                  key={portal.id}
                  type="button"
                  // Start fetching that portal's page before the tap lands
                  onMouseEnter={() => prefetchPortal(portal.id)}
                  onFocus={() => prefetchPortal(portal.id)}
                  onTouchStart={() => prefetchPortal(portal.id)}
                  onClick={() => {
                    if (isCurrent) onCurrentPortalClick?.();
                    else navigate(portal.route);
                  }}
                  className={tabClass(isCurrent && !walletActive)}
                  title={portal.subtitle ? `${portal.name} — ${portal.subtitle}` : portal.name}
                >
                  {portal.label}
                </button>
              );
            })}
            {onWalletClick && (
              <button
                type="button"
                onClick={onWalletClick}
                className={`${tabClass(walletActive)} ml-auto`}
              >
                ₡ Wallet
              </button>
            )}
          </div>
        )}
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-[#f5dfa0] to-transparent" />
    </header>
  );
};

export default PortalHeader;
