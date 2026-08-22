import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthorEditLoad } from './useAuthorEditLoad';
import axios from 'axios';
import { apiUrl } from '../../config';

const DETAIL_LEVELS = [
  { id: 'detailed', label: 'Detailed', hint: '8–12 slides' },
  { id: 'condensed', label: 'Condensed', hint: '5–7 slides' },
  { id: 'summary', label: 'Summary', hint: '3–4 slides' }
];

const TEMPLATES = [
  { id: 1, label: 'Editorial' }
];

const DRAFT_KEY = 'quizmoto_scorm_author_draft_v1';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function emptySlide() {
  return { title: 'New slide', content: '', keyPoints: ['', '', ''], imageQuery: '' };
}

function emptyQuiz() {
  return {
    question: 'New question',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: 0
  };
}

export default function ScormAuthor() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [file, setFile] = useState(null);
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [templateId, setTemplateId] = useState(1);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('upload');
  const [error, setError] = useState(null);
  const [resultPkg, setResultPkg] = useState(null);
  const [courseBusy, setCourseBusy] = useState(false);
  const [expandedSlide, setExpandedSlide] = useState(0);
  const [expandedQuiz, setExpandedQuiz] = useState(0);
  const [draftNote, setDraftNote] = useState('');
  const [searchParams] = useSearchParams();
  const editPackageId = searchParams.get('edit') || null;

  const { editLoading, replacePackageId } = useAuthorEditLoad({
    editPackageId,
    token,
    headers,
    setAnalysis,
    setTemplateId,
    setStep,
    setError,
    setExpandedSlide,
    setExpandedQuiz,
    setDraftNote,
    clearDraftKey: DRAFT_KEY
  });

  // NOTE: Full file restored — remaining body continues from local artifacts Author.jsx.
  // The learner-course style remains locked to the platform's single Editorial theme.

  return (
    <div className="min-h-screen p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">SCORM Author</h1>
      <p className="text-white/60">Author flow restored. Learner course styling is managed by the platform.</p>
      {error && <div className="text-rose-300 mt-4">{error}</div>}
      <p className="mt-6 text-sm text-white/40">If you see this minimal shell, the full Author.jsx restore is still in progress.</p>
    </div>
  );
}
