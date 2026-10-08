import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LockKeyhole } from 'lucide-react';

export default function ScormWorkspaceSearch({ groups, scormAccess }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = groups.flatMap(group => group.items.map(item => ({ ...item, group: group.label })))
    .filter(item => terms.every(term => `${item.label} ${item.group}`.toLowerCase().includes(term)));
  const open = focused && terms.length > 0;
  const reset = () => { setQuery(''); setFocused(false); };

  return (
    <form role="search" className="scorm-workspace-search" onFocus={() => setFocused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); reset(); } }}
      onSubmit={event => { event.preventDefault(); if (results[0] && terms.length) { navigate(results[0].to); reset(); } }}>
      <div className="scorm-search-shell scorm-workspace-search-field">
        <Search size={16} aria-hidden="true" />
        <input type="search" className="scorm-search-shell-input" aria-label="Search platform pages"
          placeholder="Search platform…" autoComplete="off" value={query} onChange={event => { setQuery(event.target.value); setFocused(true); }}
          aria-describedby={open ? 'workspace-search-status' : undefined} />
      </div>
      {open && <div className="scorm-workspace-search-results">
        <div id="workspace-search-status" role="status" className="scorm-workspace-search-status">
          {results.length ? `${results.length} matching ${results.length === 1 ? 'page' : 'pages'}` : 'No matching pages. Try Courses, Publica or Reports.'}
        </div>
        {results.length > 0 && <nav aria-label="Search results">
          {results.map(item => <Link key={item.to} to={item.to} onClick={reset} className="scorm-workspace-search-result">
            {React.createElement(item.icon, { size: 16, 'aria-hidden': true })}
            <span>{item.label}<small>{item.group}</small></span>
            {item.requiresScorm && !scormAccess && <LockKeyhole size={14} aria-label="Locked until activation" />}
          </Link>)}
        </nav>}
      </div>}
    </form>
  );
}
