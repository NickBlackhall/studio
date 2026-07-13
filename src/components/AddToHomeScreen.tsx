"use client";

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'a2hs-dismissed-at';
const DISMISS_DAYS = 14;

/**
 * One-time nudge to install the game to the home screen: full screen, real icon,
 * no browser bars — and the PWA is where the game is designed to live.
 *
 * Android/Chrome exposes the native install flow via `beforeinstallprompt`; iOS
 * has no API, so it gets one-line instructions instead. Never shows when already
 * installed (standalone), and a dismissal sticks for two weeks.
 */
export default function AddToHomeScreen() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS never fires beforeinstallprompt; show instructions after a beat so the
    // menu appears first and the nudge reads as a suggestion, not a gate.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const iosTimer = isIos ? setTimeout(() => setShowIosHint(true), 4000) : null;

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setInstallEvent(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    dismiss();
  };

  if (!installEvent && !showIosHint) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-40 rounded-lg bg-black/90 p-4 text-amber-100 shadow-xl font-im-fell"
      data-testid="a2hs-nudge"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg text-amber-300">💀 Add Make It Terrible to your home screen</div>
          <div className="mt-1 text-sm text-amber-100/80">
            {installEvent
              ? 'Full screen, no browser bars — like a real app.'
              : 'Tap the Share button, then "Add to Home Screen".'}
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-amber-100/60">
          ✕
        </button>
      </div>
      {installEvent && (
        <button
          type="button"
          onClick={install}
          className="mt-3 w-full rounded-md bg-amber-400 py-2 text-lg font-bold text-black"
        >
          Install
        </button>
      )}
    </div>
  );
}
