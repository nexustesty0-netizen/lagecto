"use client";

import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [value, setValue] = useState(0);
  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setValue(max > 0 ? Math.min(100, Math.round((el.scrollTop / max) * 100)) : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="lg-read-progress" style={{ width: `${value}%` }} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress" />;
}
