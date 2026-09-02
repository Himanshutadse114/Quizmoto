import React, { useState } from 'react';
import { Building2, Mail } from 'lucide-react';
import TenantAdmin from './TenantAdmin';
import SuperAdminMailPanel from './SuperAdminMailPanel';
import EmailTemplatesPanel from './EmailTemplatesPanel';

export default function AccessAdmin() {
  const [tab, setTab] = useState('tenants');

  return (
    <div className="pt-4 md:pt-5">
      <div className="px-4 md:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
          <div>
            <div className="scorm-micro text-[9px] uppercase font-semibold">Super Admin</div>
            <div className="mt-1 text-[10px]" style={{ color: 'var(--scorm-muted)' }}>Platform-wide administration</div>
          </div>
          <div className="inline-flex rounded-xl border p-1" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
            <button
              type="button"
              onClick={() => setTab('tenants')}
              className="h-9 px-3.5 rounded-lg text-[10px] font-semibold inline-flex items-center gap-2 transition"
              style={{
                background: tab === 'tenants' ? 'rgba(79,201,191,.12)' : 'transparent',
                color: tab === 'tenants' ? '#4FC9BF' : 'var(--scorm-muted)'
              }}
            >
              <Building2 size={13} /> Tenant Management
            </button>
            <button
              type="button"
              onClick={() => setTab('email')}
              className="h-9 px-3.5 rounded-lg text-[10px] font-semibold inline-flex items-center gap-2 transition"
              style={{
                background: tab === 'email' ? 'rgba(79,201,191,.12)' : 'transparent',
                color: tab === 'email' ? '#4FC9BF' : 'var(--scorm-muted)'
              }}
            >
              <Mail size={13} /> Email Templates
            </button>
          </div>
        </div>
      </div>

      {tab === 'tenants' ? (
        <TenantAdmin />
      ) : (
        <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1280px] mx-auto space-y-4">
          <div className="mb-5">
            <div className="text-[#4FC9BF] text-[9px] uppercase tracking-[.15em] font-semibold">Platform communication</div>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-[-.025em]">Email Templates</h1>
            <p className="mt-2 text-xs md:text-sm max-w-3xl leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>Control the HTML and subject used by every LMSGEN system email, then preview or test delivery before using it with learners.</p>
          </div>
          <SuperAdminMailPanel />
          <EmailTemplatesPanel />
        </div>
      )}
    </div>
  );
}
