
"use client";

import { useEffect } from 'react';

// This is a client component that runs only in the browser.
// It will not be part of the server-rendered HTML.
export default function FontDebugger() {
  useEffect(() => {
    // The document.fonts API provides an interface to query font loading status.
    // .ready is a Promise that resolves when all fonts in the document are loaded.
    document.fonts.ready.then(() => {
      console.log('✅ FONT_DEBUGGER: All fonts finished loading.');

      // Check for specific fonts
      if (document.fonts.check("1em 'IM Fell English SC'")) {
        console.log("✅ FONT_DEBUGGER: 'IM Fell English SC' is loaded and ready.");
      } else {
        console.error("❌ FONT_DEBUGGER: 'IM Fell English SC' FAILED to load.");
      }

      if (document.fonts.check("1em 'Corben'")) {
        console.log("✅ FONT_DEBUGGER: 'Corben' is loaded and ready.");
      } else {
        console.error("❌ FONT_DEBUGGER: 'Corben' FAILED to load.");
      }
    }).catch(error => {
      console.error('❌ FONT_DEBUGGER: An error occurred while waiting for fonts.', error);
    });
  }, []);

  // This component renders nothing to the DOM.
  return null;
}
