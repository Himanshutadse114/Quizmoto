import React from 'react';
import './platformPageLayout.css';

// The workspace shell owns page width and gutters. Individual pages own only
// their content, panels and purpose-specific preview layouts.
export default function PlatformPageLayout({ children }) {
  return <div className="platform-route-frame">{children}</div>;
}
