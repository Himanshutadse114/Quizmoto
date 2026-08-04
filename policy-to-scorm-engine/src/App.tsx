import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  BookOpen,
  Layout,
  HelpCircle,
  ShieldCheck,
  ImageIcon,
  X,
  Pencil,
  Plus,
  Trash2,
  ArrowLeft,
  Settings,
  Sparkles,
  Upload,
} from 'lucide-react';
import { FileUploader } from './components/FileUploader';
import { analyzePolicy, PolicyAnalysis } from './services/geminiService';
import { generateScormPackage } from './services/scormGenerator';
import JSZip from 'jszip';

// --- Editable field helpers ---
function EditableInput({
  value, onChange, className, placeholder,
}: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-transparent border-b border-transparent hover:border-orange-200 focus:border-orange-400 focus:outline-none transition-colors ${className ?? ''}`}
    />
  );
}

function EditableTextarea({
  value, onChange, className, placeholder,
}: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={4}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-transparent border border-transparent hover:border-orange-200 focus:border-orange-400 focus:outline-none resize-none transition-colors rounded-lg p-2 leading-relaxed ${className ?? ''}`}
    />
  );
}

export default function App() {
  const [view, setView] = useState<'upload' | 'preview'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<PolicyAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [detailLevel, setDetailLevel] = useState<'detailed' | 'condensed' | 'summary'>('detailed');

  const templates = [
    { id: 1, name: 'Modern Corporate', color: '#f97316', bg: '#ffffff' },
    { id: 3, name: 'Elegant Ivory', color: '#b45309', bg: '#fffbeb' },
    { id: 4, name: 'Forest Growth', color: '#059669', bg: '#f0fdf4' },
    { id: 5, name: 'Sunset Berry', color: '#db2777', bg: '#fff1f2' },
  ];

  // Auto-switch view when analysis is ready
  useEffect(() => {
    if (analysis && view === 'upload') {
      setView('preview');
    }
  }, [analysis]);

  // --- Analysis mutators ---
  const updateField = (field: keyof PolicyAnalysis, value: string) => {
    setAnalysis(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const updateSlideField = (idx: number, field: 'title' | 'content' | 'imageQuery', value: string) => {
    setAnalysis(prev => {
      if (!prev) return prev;
      const slides = prev.slides.map((s, i) => i === idx ? { ...s, [field]: value } : s);
      return { ...prev, slides };
    });
  };

  const updateKeyPoint = (sIdx: number, kIdx: number, value: string) => {
    setAnalysis(prev => {
      if (!prev) return prev;
      const slides = prev.slides.map((s, i) => {
        if (i !== sIdx) return s;
        const keyPoints = s.keyPoints.map((kp, ki) => ki === kIdx ? value : kp);
        return { ...s, keyPoints };
      });
      return { ...prev, slides };
    });
  };

  const addKeyPoint = (sIdx: number) => {
    setAnalysis(prev => {
      if (!prev) return prev;
      const slides = prev.slides.map((s, i) =>
        i === sIdx ? { ...s, keyPoints: [...s.keyPoints, 'New key point'] } : s
      );
      return { ...prev, slides };
    });
  };

  const removeKeyPoint = (sIdx: number, kIdx: number) => {
    setAnalysis(prev => {
      if (!prev) return prev;
      const slides = prev.slides.map((s, i) =>
        i === sIdx ? { ...s, keyPoints: s.keyPoints.filter((_, ki) => ki !== kIdx) } : s
      );
      return { ...prev, slides };
    });
  };

  const updateQuizQuestion = (qIdx: number, value: string) => {
    setAnalysis(prev => {
      if (!prev) return prev;
      const quiz = prev.quiz.map((q, i) => i === qIdx ? { ...q, question: value } : q);
      return { ...prev, quiz };
    });
  };

  const removeSlide = (idx: number) => {
    setAnalysis(prev => {
      if (!prev) return prev;
      const slides = prev.slides.filter((_, i) => i !== idx);
      return { ...prev, slides };
    });
  };

  const updateQuizOption = (qIdx: number, oIdx: number, value: string) => {
    setAnalysis(prev => {
      if (!prev) return prev;
      const quiz = prev.quiz.map((q, i) => {
        if (i !== qIdx) return q;
        const options = q.options.map((o, oi) => oi === oIdx ? value : o);
        return { ...q, options };
      });
      return { ...prev, quiz };
    });
  };

  const setCorrectAnswer = (qIdx: number, oIdx: number) => {
    setAnalysis(prev => {
      if (!prev) return prev;
      const quiz = prev.quiz.map((q, i) => i === qIdx ? { ...q, correctAnswer: oIdx } : q);
      return { ...prev, quiz };
    });
  };

  // --- File handling ---
  const handleFileSelect = async (file: File) => {
    setError(null);

    // Handle ZIP import (Re-edit)
    if (file.name.toLowerCase().endsWith('.zip')) {
      setIsProcessing(true);
      try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const contentFile = contents.file('content.json');

        if (!contentFile) {
          throw new Error('This ZIP does not appear to be a valid SCORM package (missing content.json).');
        }

        const jsonString = await contentFile.async('string');
        const importedAnalysis = JSON.parse(jsonString) as PolicyAnalysis;
        
        // Basic validation of imported data
        if (!importedAnalysis.title || !Array.isArray(importedAnalysis.slides)) {
          throw new Error('Invalid or corrupted SCORM content.');
        }

        setAnalysis(importedAnalysis);
      } catch (err: any) {
        setError(err.message || 'Failed to import SCORM package.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Handle Document Analysis (New)
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const result = await analyzePolicy(base64, file.type, detailLevel);
          setAnalysis(result);
        } catch (err) {
          setError('Failed to analyze document. Please try again.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setError('Error reading file.');
      setIsProcessing(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoPreview(result);
      setLogoBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleExport = async () => {
    if (!analysis) return;
    setShowExportModal(false);
    setIsDownloading(true);
    try {
      const blob = await generateScormPackage(analysis, logoBase64 ?? undefined, selectedTemplate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${analysis.title.replace(/\s+/g, '_')}_SCORM.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to generate SCORM package.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900" style={{ fontFamily: "'Poppins', sans-serif" }}>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header (Fixed) */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Finalize & Export</h2>
                  <p className="text-sm text-slate-500 mt-1">Select your theme and optionally add a logo.</p>
                </div>
                <button onClick={() => setShowExportModal(false)} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="flex-grow overflow-y-auto p-8">
                <div className="grid md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Choose Theme</label>
                      <div className="grid gap-3">
                        {templates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTemplate(t.id)}
                            className={`group relative flex items-center gap-4 p-4 rounded-3xl border-2 transition-all ${selectedTemplate === t.id ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-100' : 'border-slate-100 hover:border-slate-200'
                              }`}
                          >
                            <div
                              className="w-12 h-12 rounded-2xl border border-slate-200 shadow-sm flex-shrink-0 flex items-center justify-center overflow-hidden"
                              style={{ backgroundColor: t.bg }}
                            >
                              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: t.color }}></div>
                            </div>
                            <div className="text-left">
                              <p className={`font-black text-sm ${selectedTemplate === t.id ? 'text-orange-900' : 'text-slate-700'}`}>{t.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Visual Layout</p>
                            </div>
                            {selectedTemplate === t.id && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Theme Preview</label>
                      <div 
                        className="rounded-[32px] border border-slate-200 shadow-inner overflow-hidden flex flex-col h-[200px] transition-colors duration-500"
                        style={{ backgroundColor: templates.find(t => t.id === selectedTemplate)?.bg }}
                      >
                        <div className="h-4 w-full" style={{ backgroundColor: templates.find(t => t.id === selectedTemplate)?.color }}></div>
                        <div className="flex-grow p-6 flex flex-col gap-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: templates.find(t => t.id === selectedTemplate)?.bg, border: `3px solid ${templates.find(t => t.id === selectedTemplate)?.color}` }}></div>
                            <div className="space-y-1.5 flex-1">
                              <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: templates.find(t => t.id === selectedTemplate)?.color, opacity: 0.2 }}></div>
                              <div className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: templates.find(t => t.id === selectedTemplate)?.color, opacity: 0.1 }}></div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: templates.find(t => t.id === selectedTemplate)?.color, opacity: 0.1 }}></div>
                            <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: templates.find(t => t.id === selectedTemplate)?.color, opacity: 0.1 }}></div>
                            <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: templates.find(t => t.id === selectedTemplate)?.color, opacity: 0.1 }}></div>
                          </div>
                          <div className="mt-auto h-4 w-20 rounded-full self-end" style={{ backgroundColor: templates.find(t => t.id === selectedTemplate)?.color }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Optional: Branding</label>
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        className="group border-2 border-dashed border-slate-200 rounded-[32px] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-slate-50 hover:border-orange-300 transition-all h-[240px]"
                      >
                        {logoPreview ? (
                          <div className="relative group">
                            <img src={logoPreview} alt="Logo preview" className="max-h-32 max-w-full object-contain rounded-xl shadow-lg" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                              <p className="text-white text-xs font-bold">Replace Logo</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                              <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-orange-500 transition-colors" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-black text-slate-900">Upload Company Logo</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">PNG or SVG Preferred</p>
                            </div>
                          </>
                        )}
                      </div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                      {logoPreview && (
                        <button onClick={() => { setLogoPreview(null); setLogoBase64(null); }} className="w-full text-center text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors">
                          Remove logo
                        </button>
                      )}
                    </div>

                    <div className="p-6 bg-orange-50 border border-orange-100 rounded-[32px] space-y-3">
                      <div className="flex items-center gap-2 text-orange-700 font-bold text-[10px] uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4 text-orange-500" /> Export Configuration
                      </div>
                      <p className="text-xs text-orange-800 leading-relaxed font-medium">
                        Your module is optimized with <strong>{detailLevel}</strong> detail level using the <strong>{templates.find(t => t.id === selectedTemplate)?.name}</strong> aesthetic.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Fixed) */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-4 shrink-0">
                <button 
                  onClick={() => setShowExportModal(false)} 
                  className="px-8 py-5 border border-slate-200 rounded-3xl text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-white transition-all underline-offset-4 hover:underline"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleExport} 
                  disabled={isDownloading}
                  className="flex-1 px-8 py-5 bg-orange-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isDownloading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download className="w-5 h-5" /> Download SCORM Package
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'upload' ? (
          <motion.div
            key="upload-view"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="max-w-4xl mx-auto px-6 py-20 space-y-12"
          >
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-full text-xs font-bold uppercase tracking-widest animate-bounce">
                <Sparkles className="w-4 h-4" /> Welcome to Policy Engine
              </div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.05]">
                Convert Policies to <span className="text-orange-500">Interactive Lessons.</span>
              </h1>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                The engine uses AI to extract core logic and generate beautiful, image-rich SCORM modules in seconds.
              </p>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl shadow-slate-200/50 p-8 md:p-12 space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">1. Select Content Style</h2>
                    <p className="text-sm text-slate-400">How detailed should the learning module be?</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'detailed', label: 'Detailed', sub: '8-12 slides', icon: FileText, desc: 'Deep dive into policy' },
                    { id: 'condensed', label: 'Condensed', sub: '5-7 slides', icon: Layout, desc: 'Key takeaways focus' },
                    { id: 'summary', label: 'Summary', sub: '3-4 slides', icon: BookOpen, desc: 'Highlight reel' },
                  ].map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setDetailLevel(level.id as any)}
                      className={`p-6 rounded-[28px] border-2 transition-all flex flex-col gap-3 text-left ${
                        detailLevel === level.id 
                          ? 'border-orange-500 bg-orange-50 shadow-xl shadow-orange-100' 
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      <div className={`p-3 rounded-xl w-fit ${detailLevel === level.id ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <level.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={`font-bold text-sm ${detailLevel === level.id ? 'text-orange-900' : 'text-slate-700'}`}>{level.label}</p>
                        <p className="text-xs text-slate-400 mt-1">{level.desc}</p>
                        <p className="text-[10px] font-bold text-orange-500 mt-2 uppercase tracking-widest">{level.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">2. Upload & Magic</h2>
                    <p className="text-sm text-slate-400">PDF, Word, or Text files are supported.</p>
                  </div>
                </div>
                <FileUploader onFileSelect={handleFileSelect} isProcessing={isProcessing} />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview-view"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-screen overflow-hidden bg-white"
          >
            {/* Editor Toolbar */}
            <header className="h-20 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 bg-white z-10">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setView('upload')}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-colors border border-slate-100 group"
                  title="Back to Upload"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-slate-900" />
                </button>
                <div className="h-8 w-[1px] bg-slate-100 mx-2"></div>
                <div>
                  <EditableInput
                    value={analysis?.title || ''}
                    onChange={v => updateField('title', v)}
                    className="text-lg font-black text-slate-900"
                    placeholder="Course title..."
                  />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-orange-500" /> Course Editor
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 mr-4">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Auto-Saved</span>
                </div>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 text-sm"
                >
                  <Download className="w-4 h-4" /> Export Module
                </button>
              </div>
            </header>

            <div className="flex-grow overflow-y-auto bg-slate-50/50 p-8">
              <div className="max-w-5xl mx-auto space-y-12 pb-24">
                
                {/* Visual Overview */}
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Course Description</label>
                    <EditableTextarea
                      value={analysis?.summary || ''}
                      onChange={v => updateField('summary', v)}
                      className="text-lg text-slate-600 bg-white border-slate-200 p-6 rounded-[32px] italic shadow-sm"
                    />
                  </div>
                  <div className="bg-orange-50 p-6 rounded-[32px] border border-orange-100 flex flex-col justify-center gap-2">
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Stats</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-orange-900">{analysis?.slides.length}</span>
                      <span className="text-xs font-bold text-orange-700">Slides</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-orange-900">{analysis?.quiz.length}</span>
                      <span className="text-xs font-bold text-orange-700">Questions</span>
                    </div>
                  </div>
                </div>

                {/* Slides Section */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                     <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                       <Layout className="w-6 h-6 text-orange-500" />
                       Content Structure
                     </h3>
                     <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500">REORDER SLIDES</span>
                   </div>

                   <div className="grid gap-8">
                     {analysis?.slides.map((slide, idx) => (
                       <motion.div 
                         key={idx}
                         initial={{ opacity: 0, y: 20 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: idx * 0.1 }}
                         className="group bg-white rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all p-8 relative overflow-hidden"
                       >
                         <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                            onClick={() => removeSlide(idx)}
                            className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-100"
                           >
                             <Trash2 className="w-5 h-5" />
                           </button>
                         </div>

                         <div className="grid md:grid-cols-2 gap-12">
                           <div className="space-y-6">
                             <div className="flex items-center gap-3">
                               <span className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-500">#{idx + 1}</span>
                               <EditableInput
                                 value={slide.title}
                                 onChange={v => updateSlideField(idx, 'title', v)}
                                 className="text-2xl font-black text-slate-900"
                                 placeholder="Slide title..."
                               />
                             </div>
                             <EditableTextarea
                               value={slide.content}
                               onChange={v => updateSlideField(idx, 'content', v)}
                               className="text-base text-slate-600 leading-relaxed"
                               placeholder="Start writing your lesson content..."
                             />
                           </div>
                           
                           <div className="space-y-8">
                             <div className="space-y-4">
                               <label className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Key Insights</label>
                               <div className="grid gap-3">
                                 {slide.keyPoints.map((kp, kIdx) => (
                                   <div key={kIdx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100/50 hover:border-orange-200 transition-colors group/kp">
                                     <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />
                                     <EditableInput
                                       value={kp}
                                       onChange={v => updateKeyPoint(idx, kIdx, v)}
                                       className="text-sm font-semibold text-slate-700"
                                     />
                                     <button onClick={() => removeKeyPoint(idx, kIdx)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover/kp:opacity-100">
                                       <X className="w-3 h-3" />
                                     </button>
                                   </div>
                                 ))}
                                 <button onClick={() => addKeyPoint(idx)} className="flex items-center gap-2 text-[10px] font-black text-orange-500 p-3 hover:bg-orange-50 rounded-2xl transition-all w-fit uppercase tracking-[0.2em]">
                                   <Plus className="w-4 h-4" /> Add Insight
                                 </button>
                               </div>
                             </div>
                           </div>
                         </div>
                       </motion.div>
                     ))}
                   </div>
                </div>

                {/* Quiz Section */}
                <div className="space-y-6">
                  <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                    Knowledge Checks
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    {analysis?.quiz.map((q, qIdx) => (
                      <div key={qIdx} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest">Question {qIdx + 1}</span>
                        </div>
                        <EditableInput
                          value={q.question}
                          onChange={v => updateQuizQuestion(qIdx, v)}
                          className="text-lg font-black text-slate-900"
                        />
                        <div className="grid gap-3">
                           {q.options.map((opt, oIdx) => (
                             <div 
                               key={oIdx}
                               className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                 oIdx === q.correctAnswer 
                                 ? 'bg-emerald-50 border-emerald-500 shadow-lg shadow-emerald-50' 
                                 : 'bg-slate-50 border-slate-100 hover:border-emerald-200'
                               }`}
                             >
                                <button
                                  onClick={() => setCorrectAnswer(qIdx, oIdx)}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                    oIdx === q.correctAnswer 
                                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                                    : 'border-slate-300'
                                  }`}
                                >
                                  {oIdx === q.correctAnswer && <CheckCircle2 className="w-4 h-4" />}
                                </button>
                                <EditableInput
                                  value={opt}
                                  onChange={v => updateQuizOption(qIdx, oIdx, v)}
                                  className={`text-sm font-bold ${oIdx === q.correctAnswer ? 'text-emerald-900' : 'text-slate-600'}`}
                                />
                             </div>
                           ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Save Overlay */}
            {!showExportModal && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <p className="text-xs font-black uppercase tracking-widest whitespace-nowrap">Ready to Ship</p>
                 </div>
                 <div className="h-6 w-[1px] bg-white/20" />
                 <button 
                  onClick={() => setShowExportModal(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all"
                 >
                   Export SCORM
                 </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
