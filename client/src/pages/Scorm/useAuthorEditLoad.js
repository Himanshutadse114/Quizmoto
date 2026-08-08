import { useEffect, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../../config';

/**
 * When URL has ?edit=packageId, load package analysis and open the editor.
 */
export function useAuthorEditLoad({
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
  clearDraftKey
}) {
  const [editLoading, setEditLoading] = useState(!!editPackageId);
  const [replacePackageId, setReplacePackageId] = useState(null);

  useEffect(() => {
    if (!editPackageId || !token) {
      setEditLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setEditLoading(true);
      setError(null);
      try {
        const res = await axios.get(apiUrl(`/api/scorm/packages/${editPackageId}/analysis`), { headers });
        if (cancelled) return;
        const a = res.data.analysis || {};
        a.slides = (a.slides || []).map((s, index) => ({
          ...s,
          title: s.title || '',
          content: s.content || '',
          keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints : [],
          imageQuery: s.imageQuery || '',
          layout: s.layout || s.slideType || 'cards',
          visualTitle: s.visualTitle || s.title || `Section ${index + 1}`,
          interaction: s.interaction && typeof s.interaction === 'object'
            ? s.interaction
            : { type: 'hotspot_explore', prompt: 'Explore the learning points before continuing.' }
        }));
        a.quiz = (a.quiz || []).map((q) => ({
          ...q,
          question: q.question || '',
          options:
            Array.isArray(q.options) && q.options.length >= 2
              ? q.options.slice(0, 6)
              : ['', '', '', ''],
          correctAnswer:
            typeof q.correctAnswer === 'number'
              ? q.correctAnswer
              : Number(q.correctAnswer) || 0,
          explanation: q.explanation || ''
        }));
        setAnalysis(a);
        setTemplateId(res.data.templateId || 1);
        setReplacePackageId(res.data.packageId || editPackageId);
        setStep('preview');
        setExpandedSlide(0);
        setExpandedQuiz(0);
        setDraftNote('Editing existing Quizmoto package');
        try {
          if (clearDraftKey) localStorage.removeItem(clearDraftKey);
        } catch (_) {}
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load package for edit');
          setStep('upload');
        }
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editPackageId, token]);

  return { editLoading, replacePackageId, setReplacePackageId };
}
