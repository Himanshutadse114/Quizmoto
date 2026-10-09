import React from 'react';

const STUDIO_URL = import.meta.env.VITE_AVATAR_STUDIO_URL || '/avatar-studio/';

export default function AvatarStudio() {
  return (
    <section className="h-[calc(100vh-64px)] min-h-[680px] bg-[#050b13]" aria-label="LMSGEN Avatar Studio">
      <iframe
        src={STUDIO_URL}
        title="LMSGEN Avatar Studio"
        className="block h-full w-full border-0 bg-[#050b13]"
        allow="payment"
      />
    </section>
  );
}
