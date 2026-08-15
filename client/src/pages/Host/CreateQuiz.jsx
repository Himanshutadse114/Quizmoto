import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Plus, Trash2, Save, Sparkles, Loader2, X, Image as ImageIcon, FileText, UploadCloud } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiUrl } from '../../config';

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const value = String(reader.result || '');
            resolve(value.includes(',') ? value.split(',')[1] : value);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const CreateQuiz = () => {
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState([
        { questionText: '', options: ['', '', '', ''], correctIndex: 0, timer: 20, explanation: '', image: null }
    ]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiDescription, setAiDescription] = useState('');
    const [aiFile, setAiFile] = useState(null);
    const { token } = useAuth();
    const navigate = useNavigate();

    const GEN_API_URL = apiUrl('/api/scorm/author/quiz-generate');
    const API_URL = apiUrl('/api/quizzes');

    const addQuestion = () => {
        setQuestions([...questions, { questionText: '', options: ['', '', '', ''], correctIndex: 0, timer: 20, explanation: '', image: null }]);
    };

    const removeQuestion = (index) => setQuestions(questions.filter((_, i) => i !== index));

    const updateQuestion = (index, field, value) => {
        const next = [...questions];
        next[index][field] = value;
        setQuestions(next);
    };

    const updateOption = (qIndex, oIndex, value) => {
        const next = [...questions];
        next[qIndex].options[oIndex] = value;
        setQuestions(next);
    };

    const handleImageUpload = (qIndex, e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return alert('Image must be under 5MB');
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxWidth = 800;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                updateQuestion(qIndex, 'image', canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        try {
            if (!title.trim()) return alert('Please enter a quiz title');
            if (questions.length === 0) return alert('Please add at least one question');
            const sanitizedQuestions = questions.map((q, i) => {
                const validOptions = q.options.filter((opt) => opt.trim() !== '');
                if (!q.questionText.trim()) throw new Error(`Question ${i + 1} is missing text`);
                if (validOptions.length < 2) throw new Error(`Question ${i + 1} needs at least 2 valid options`);
                if (!q.options[q.correctIndex] || q.options[q.correctIndex].trim() === '') throw new Error(`Question ${i + 1}'s correct answer cannot be an empty option`);
                const correctText = q.options[q.correctIndex];
                return {
                    questionText: q.questionText,
                    options: validOptions,
                    correctIndex: validOptions.indexOf(correctText),
                    timer: q.timer,
                    explanation: q.explanation || '',
                    image: q.image || null
                };
            });
            await axios.post(API_URL, { title, questions: sanitizedQuestions }, { headers: { Authorization: `Bearer ${token}` } });
            navigate('/scorm/live-quiz');
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || err.message || 'Failed to save quiz. Please check your connection.');
        }
    };

    const hasAiSource = Boolean(aiTopic.trim() || aiDescription.trim() || aiFile);

    const handleAiGenerate = async () => {
        if (!hasAiSource) return alert('Add a topic, description, or document first.');
        setIsGenerating(true);
        try {
            const fileBase64 = aiFile ? await toBase64(aiFile) : '';
            const res = await axios.post(GEN_API_URL, {
                topic: aiTopic.trim(),
                description: aiDescription.trim(),
                fileBase64,
                mimeType: aiFile?.type || '',
                fileName: aiFile?.name || ''
            }, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 180000
            });

            if (res.data?.questions) {
                setQuestions(res.data.questions);
                if (res.data.title && !title.trim()) setTitle(res.data.title);
                setShowAiModal(false);
                setAiTopic('');
                setAiDescription('');
                setAiFile(null);
            }
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'AI quiz generation failed. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
            <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
                <div><h1 className="text-2xl font-black">Create Quiz</h1><p className="text-xs text-white/45 mt-1">Build manually or generate a complete draft with AI.</p></div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowAiModal(true)} className="bg-quizmoto-blue px-4 py-2 font-black text-xs flex items-center gap-2 shadow-[0_3px_0_0_#0e4b94] hover:shadow-none hover:translate-y-1 transition-all"><Sparkles size={16} /> Generate with AI</button>
                    <button onClick={handleSave} className="bg-quizmoto-green px-5 py-2 font-black text-xs flex items-center gap-2 shadow-[0_3px_0_0_#1a5e08] hover:shadow-none hover:translate-y-1 transition-all"><Save size={16} /> Save Quiz</button>
                </div>
            </header>

            <div className="bg-white/5 p-5 rounded-xl mb-6 border border-white/10">
                <label className="block text-[10px] font-black mb-2 uppercase tracking-widest opacity-40">Quiz Title</label>
                <input type="text" placeholder="Enter quiz title..." className="w-full bg-transparent border-b-2 border-white/20 text-xl font-black outline-none focus:border-white transition-colors py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-10">
                {questions.map((q, qIndex) => (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} key={qIndex} className="bg-white text-gray-800 p-5 sm:p-6 rounded-2xl shadow-xl relative">
                        <div className="absolute -top-3 -left-3 bg-quizmoto-purple text-white w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm">{qIndex + 1}</div>
                        <button onClick={() => removeQuestion(qIndex)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>

                        <div className="mb-5">
                            <label className="block text-[10px] font-black text-gray-400 mb-1 tracking-widest">QUESTION</label>
                            <input type="text" placeholder="Start typing your question" className="w-full text-lg font-black border-b border-gray-100 p-1 outline-none focus:border-quizmoto-purple transition-all" value={q.questionText} onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)} />
                        </div>

                        <div className="mb-6">
                            {q.image ? (
                                <div className="relative inline-block mt-2"><img src={q.image} alt="Question" className="max-h-48 rounded-lg shadow-sm border border-gray-200" /><button onClick={() => updateQuestion(qIndex, 'image', null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-lg p-1 shadow-md hover:scale-110 transition-transform"><X size={14} /></button></div>
                            ) : (
                                <div className="mt-2"><label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"><ImageIcon size={14} /> Add Image<input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(qIndex, e)} /></label></div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {['red', 'blue', 'yellow', 'green'].map((color, oIndex) => (
                                <div key={oIndex} className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded shrink-0 bg-quizmoto-${color} flex items-center justify-center`}><input type="radio" name={`correct-${qIndex}`} checked={q.correctIndex === oIndex} onChange={() => updateQuestion(qIndex, 'correctIndex', oIndex)} className="w-3.5 h-3.5 cursor-pointer" /></div>
                                    <input type="text" placeholder={`Option ${oIndex + 1}`} className="w-full p-2 bg-gray-50 border border-transparent rounded-lg focus:border-quizmoto-purple outline-none text-sm font-bold" value={q.options[oIndex] || ''} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} />
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex items-center gap-4"><label className="text-sm font-bold text-gray-400">TIME LIMIT (sec)</label><select value={q.timer} onChange={(e) => updateQuestion(qIndex, 'timer', parseInt(e.target.value, 10))} className="bg-gray-100 p-2 rounded font-bold"><option value={5}>5 sec</option><option value={10}>10 sec</option><option value={15}>15 sec</option><option value={20}>20 sec</option><option value={30}>30 sec</option><option value={60}>60 sec</option></select></div>
                        <div className="mt-4"><label className="block text-[10px] font-black text-gray-400 mb-1 tracking-widest">EXPLANATION / FUN FACT (Optional)</label><textarea placeholder="Explain the correct answer or share a useful fact..." className="w-full text-sm font-bold border border-gray-200 rounded-lg p-2 outline-none focus:border-quizmoto-purple transition-all resize-none h-16" value={q.explanation || ''} onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)} /></div>
                    </motion.div>
                ))}
            </div>

            <button onClick={addQuestion} className="w-full mt-8 border-2 border-dashed border-white/20 py-3 rounded-xl font-black text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-2"><Plus size={18} /> Add Question</button>

            <AnimatePresence>
                {showAiModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isGenerating && setShowAiModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.94, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 18 }} className="bg-white text-gray-800 w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 rounded-2xl shadow-2xl relative z-10">
                            <button onClick={() => !isGenerating && setShowAiModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                            <div className="flex items-center gap-3 mb-3"><div className="p-2 bg-blue-100 rounded-xl"><Sparkles className="text-quizmoto-blue" size={24} /></div><div><h2 className="text-2xl font-black">Generate Quiz with AI</h2><p className="text-xs text-gray-400 mt-0.5">Use a brief, a document, or both.</p></div></div>

                            <div className="space-y-4 mt-6">
                                <div><label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Topic</label><input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} disabled={isGenerating} placeholder="e.g. Phishing awareness" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-quizmoto-blue font-bold text-sm" /></div>
                                <div><label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Description / context</label><textarea value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} disabled={isGenerating} placeholder="Describe the audience, learning goal, important points, or paste supporting text..." className="w-full min-h-28 p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-quizmoto-blue font-semibold text-sm resize-y" /></div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Optional document</label>
                                    <label className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-quizmoto-blue grid place-items-center shrink-0">{aiFile ? <FileText size={19} /> : <UploadCloud size={19} />}</div>
                                        <div className="min-w-0"><div className="text-sm font-bold truncate">{aiFile ? aiFile.name : 'Upload source document'}</div><div className="text-[10px] text-gray-400 mt-1">PDF, PPTX, DOCX, TXT or MD · up to 12 MB</div></div>
                                        <input type="file" className="hidden" accept=".pdf,.pptx,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" disabled={isGenerating} onChange={(e) => setAiFile(e.target.files?.[0] || null)} />
                                    </label>
                                    {aiFile && <button type="button" disabled={isGenerating} onClick={() => setAiFile(null)} className="mt-2 text-xs font-bold text-red-500 hover:text-red-600">Remove document</button>}
                                </div>
                            </div>

                            <button onClick={handleAiGenerate} disabled={isGenerating || !hasAiSource} className={`w-full mt-6 py-4 rounded-xl font-black text-base flex items-center justify-center gap-3 transition-all ${isGenerating || !hasAiSource ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-quizmoto-blue text-white shadow-[0_5px_0_0_#0e4b94] hover:translate-y-1 hover:shadow-none'}`}>
                                {isGenerating ? <><Loader2 size={20} className="animate-spin" /> GENERATING QUIZ...</> : <><Sparkles size={20} /> GENERATE QUIZ</>}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CreateQuiz;
