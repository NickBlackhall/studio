
"use client";

import { useState, useEffect } from 'react';

export default function CurrentYear() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  // Fallback for SSR or if year hasn't been set yet by useEffect
  // Note: On initial client render before useEffect, this will show the server-rendered year.
  // After hydration and useEffect, it will update to the client's current year if different (though unlikely for getFullYear).
  return <>{year !== null ? year : new Date().getFullYear()}</>;
}
