"use client";

import { CONTACT } from "@/lib/brand";

export function HelpActions() {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <a className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white" href={`tel:+${CONTACT.phoneTel}`}>
        Call support
      </a>
      <a className="rounded-full bg-[#25D366] px-4 py-2 text-white" href={CONTACT.whatsappUrl} target="_blank" rel="noreferrer">
        WhatsApp Support
      </a>
      <a className="rounded-full border border-[#0B6E4F] px-4 py-2 text-[#0B6E4F]" href={`mailto:${CONTACT.email}`}>
        Email support
      </a>
    </div>
  );
}
