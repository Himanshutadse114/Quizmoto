import React, { useState } from 'react';
import { BookOpenCheck, Building2, Mail, UsersRound } from 'lucide-react';
import TenantAdmin from './TenantAdmin';
import PlatformUsersAdmin from './PlatformUsersAdmin';
import FlipbookTenantAdmin from './FlipbookTenantAdmin';
import SuperAdminMailPanel from './SuperAdminMailPanel';
import EmailTemplatesPanel from './EmailTemplatesPanel';
import './accessAdminCompact.css';

export default function AccessAdmin() {
  const [tab, setTab] = useState('tenants');

  const tabs = [
    ['tenants', 'Tenant Management', Building2],
    ['users', 'Platform Users', UsersRound],
    ['flipbooks', 'Flipbook Controls', BookOpenCheck],
    ['email', 'Email Templates', Mail]
  ];

  return (
    <div className="pt-4 md:pt-5 access-admin-compact">
      <div className="px-4 md:px-8 max-w-[1280px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
          <div>
            <div className="scorm-micro text-[9px] uppercase font-semibold">Super Admin</div>
            <div className="mt-1 text-[10px]" style={{ color: 'var(--scorm-muted)' }}>Platform-wide administration</div>
          </div>
          <div className="inline-flex flex-wrap rounded-xl border p-1 self-start lg:self-auto" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
            {tabs.map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className="h-9 px-3.5 rounded-lg text-[10px] font-semibold inline-flex items-center gap-2 transition"
                style={{
                  background: tab === value ? 'rgba(79,201,191,.12)' : 'transparent',
                  color: tab === value ? '#4FC9BF' : 'var(--scorm-muted)'
                }}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'tenants' ? (
        <TenantAdmin />
      ) : tab === 'users' ? (
        <PlatformUsersAdmin />
      ) : tab === 'flipbooks' ? (
        <FlipbookTenantAdmin />
      ) : (
        <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1280px] mx-auto space-y-4">
          <div className="mb-5">
            <div className="text-[#4FC9BF] text-[9px] uppercase tracking-[.15em] font-semibold">Platform communication</div>
            <h1 className="mt-2 text-xl md:text-2xl font-semibold tracking-[-.02em]">Email Templates</h1>
            <p className="mt-2 text-xs max-w-3xl leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>Control the HTML and subject used by every LMSGEN system email, then preview or test delivery before using it with learners.</p>
          </div>
          <SuperAdminMailPanel />
          <EmailTemplatesPanel />
        </div>
      )}
    </div>
  );
}
