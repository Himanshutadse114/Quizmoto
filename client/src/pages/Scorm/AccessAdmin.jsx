import React from 'react';
import TenantAdmin from './TenantAdmin';
import SuperAdminMailPanel from './SuperAdminMailPanel';

export default function AccessAdmin() {
  return (
    <>
      <SuperAdminMailPanel />
      <TenantAdmin />
    </>
  );
}
