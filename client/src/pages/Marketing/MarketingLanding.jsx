import React, { useEffect } from 'react';

export default function MarketingLanding() {
  useEffect(() => {
    window.location.replace('/landing/index.html');
  }, []);

  return (
    <div className="min-h-screen grid place-items-center bg-[#f7fbfa] text-[#0b1514]">
      <div className="text-center">
        <div className="w-9 h-9 rounded-full border-2 border-[#0b1514]/15 border-t-[#17978d] animate-spin mx-auto" />
        <div className="mt-3 text-xs font-semibold text-[#60716d]">Loading Atelora…</div>
      </div>
    </div>
  );
}
