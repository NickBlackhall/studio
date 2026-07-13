"use client";

import { useEffect, useState } from 'react';

/**
 * "New version — tap to refresh."
 *
 * The PWA service worker precaches the bundle, so a page that stays open keeps
 * running old code straight through deploys — every playtest so far has had to
 * start with "fully close and reopen the game on both phones". This surfaces the
 * moment a new build takes over instead.
 *
 * Mechanics: next-pwa registers with skipWaiting, so when a new service worker is
 * found it activates immediately and fires `controllerchange` on every open page.
 * That event also fires once when the very first service worker claims a fresh
 * page, so only a change AWAY from an existing controller counts as an update.
 * And because an installed PWA sitting on one screen never navigates, it never
 * re-checks for updates by itself — so poll while the tab is open.
 */
export default function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (hadController) setUpdateReady(true);
      hadController = true;
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const checkForUpdate = () => {
      navigator.serviceWorker
        .getRegistration()
        .then(registration => registration?.update())
        .catch(() => {});
    };
    const interval = setInterval(checkForUpdate, 5 * 60 * 1000);
    checkForUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      clearInterval(interval);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="fixed top-0 inset-x-0 z-[10000] flex items-center justify-center gap-2 bg-black/90 px-4 py-3 text-amber-300 font-im-fell text-lg shadow-lg"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      data-testid="update-banner"
    >
      ⚡ New version available — tap to refresh
    </button>
  );
}
