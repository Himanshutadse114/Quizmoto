import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileText,
  Layers3,
  Loader2,
  Palette,
  PencilLine,
  Search,
  X
} from 'lucide-react';
import { apiUrl } from '../../config';

const COURSE_THEMES = [
  { id: 'neutral', name: 'Neutral', primary: '#177E78', background: '#E7E7E4', text: '#282824' },
  { id: 'teal', name: 'Teal', primary: '#0F8C82', background: '#F2F8F7', text: '#172321' },
  { id: 'blue', name: 'Blue', primary: '#2563EB', background: '#F3F6FB', text: '#172033' },
  { id: 'orange', name: 'Orange', primary: '#EA6A12', background: '#FBF6F1', text: '#2D231D' },
  { id: 'purple', name: 'Purple', primary: '#7C3AED', background: '#F7F4FB', text: '#271F31' },
  { id: 'forest', name: 'Forest', primary: '#2F855A', background: '#F3F8F3', text: '#1E2A22' }
];

function progressId() {
  let value = '';
  try { value = globalThis.crypto?.randomUUID?.() || ''; } catch (_) {}
  if (!value) value = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `scorm-theme-${value}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96);
}

const Metric = ({ label, value, icon: Icon }) => (
  <div className="scorm-course-metric rounded-xl border p-4 md:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="scorm-display text-2xl md:text-[30px] leading-none">{value}</div>
        <div className="scorm-micro mt-2 text-[9px] uppercase font-bold">{label}</div>
      </div>
      <div className="scorm-course-metric-icon w-9 h-9 rounded-lg border grid place-items-center">
        <Icon size={16} />
      </div>
    </div>
  </div>
);

function ThemeCard({ theme, selected, disabled, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      disabled={disabled}
      aria-pressed={selected}
      className="text-left rounded-2xl border p-2.5 sm:p-3.5 transition-all min-w-0"
      style={{
        borderColor: selected ? theme.primary : 'var(--scorm-line)',
        background: selected ? theme.background : 'var(--scorm-surface-soft)',
        boxShadow: selected ? `0 0 0 2px ${theme.primary}33` : 'none'
      }}
    >
      <div
        className="h-20 sm:h-24 rounded-xl border overflow-hidden flex"
        style={{ borderColor: `${theme.primary}33`, background: theme.background }}
      >
        <div className="w-[34%] h-full shrink-0" style={{ background: theme.primary }} />
        <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center" style={{ color: theme.text }}>
          <div className="h-2 rounded-full w-[82%]" style={{ background: theme.text, opacity: 0.92 }} />
          <div className="h-1.5 rounded-full w-[64%] mt-2" style={{ background: theme.text, opacity: 0.38 }} />
          <div className="h-1.5 rounded-full w-[70%] mt-1.5" style={{ background: theme.text, opacity: 0.22 }} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2.5 min-h-[22px]">
        <span className="text-xs font-semibold truncate">{theme.name}</span>
        {selected && <CheckCircle2 size={16} className="shrink-0" style={{ color: theme.primary }} />}
      </div>
    </button>
  );
}
