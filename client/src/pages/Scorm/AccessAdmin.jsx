import React, { useState } from 'react';
import { Building2, Mail } from 'lucide-react';
import TenantAdmin from './TenantAdmin';
import SuperAdminMailPanel from './SuperAdminMailPanel';
import EmailTemplatesPanel from './EmailTemplatesPanel';

export default function AccessAdmin() {
  const [tab, setTab] = useState('tenants');

  return (
    <div className="p-4 md:p-7 lg:p-8 max-w-[1500px] mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5 pb-5 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div>
          <div className="scorm-micro text-[9px] uppercase font-semibold">Platform administration</div>
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-.03em] mt-1.5">Super Admin</h1>
          <p className="text-xs mt-2 max-w-2xl leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>
            Manage tenants, platform access and the email templates used across LMSGEN.
          </p>
        </div>
        <div className="inline-flex rounded-xl border p-1 self-start lg:self-auto" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
          <button
            type="button"
            onClick={() => setTab('tenants')}
            className="h-9 px-3.5 rounded-lg text-[10px] font-semibold inline-flex items-center gap-2 transition"
            style={{
              background: tab === 'tenants' ? 'rgba(79,201,191,.12)' : 'transparent',
              color: tab === 'tenants' ? '#4FC9BF' : 'var(--scorm-ink-soft)'
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
              color: tab === 'email' ? '#4FC9BF' : 'var(--scorm-ink-soft)'
            }}
          >
            <Mail size={13} /> Email Templates
          </button>
        </div>
      </div>

      {tab === 'tenants' ? (
        <TenantAdmin />
      ) : (
        <>
          <SuperAdminMailPanel />
          <EmailTemplatesPanel />
        </>
      )}
    </div>
  );
}
