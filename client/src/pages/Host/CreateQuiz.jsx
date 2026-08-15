import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import {
    ArrowLeft,
    Clock3,
    FileText,
    Image as ImageIcon,
    Loader2,
    Plus,
    Save,
    Sparkles,
    Trash2,
    UploadCloud,
    X
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { apiUrl } from '../../config';
import './quizmotoEditWorkbench.css';
import './quizmotoCreateWorkbench.css';

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

const emptyQuestion = () => ({
    questionText: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    timer: 20,
    explanation: '',
    image: null
});

const CreateQuiz = () => {
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState([emptyQuestion()]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiDescription, setAiDescription] = useState('');
    const [aiFile, setAiFile] = useState(null);
    const { token } = useAuth();
    const navigate = useNavigate();

    const GEN_API_URL = apiUrl('/api/quizzes/generate-ai');
    const API_URL = apiUrl('/api/quizzes');

    const addQuestion = () => setQuestions([...questions, emptyQuestion()]);
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
                if (!q.options[q.correctIndex] || q.options[q.correctIndex].trim() === '') {
                    throw new Error(`Question ${i + 1}'s correct answer cannot be an empty option`);
                }

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

            await axios.post(
                API_URL,
                { title, questions: sanitizedQuestions },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            navigate('/host');
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
            const res = await axios.post(
                GEN_API_URL,
                {
                    topic: aiTopic.trim(),
                    description: aiDescription.trim(),
                    fileBase64,
                    mimeType: aiFile?.type || '',
                    fileName: aiFile?.name || ''
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 180000
                }
            );

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

    const totalSeconds = useMemo(
        () => questions.reduce((sum, question) => sum + Number(question.timer || 0), 0),
        [questions]
    );

    return (
        <div className="quizmoto-edit-workbench">
            <div className="qe-shell">
                <header className="qe-topbar">
                    <button type="button" onClick={() => navigate('/host')} className="qe-back" aria-label="Back to Quizmoto dashboard">
                        <ArrowLeft size={19} />
                    </button>
                    <div className="qe-header-copy">
                        <div className="qe-kicker">Quiz creation</div>
                        <div className="qe-heading">Create Quiz</div>
                        <div className="qe-header-meta">Build manually or generate a complete live-quiz draft with AI</div>
                    </div>
                    <div className="qc-header-actions">
                        <button type="button" onClick={() => setShowAiModal(true)} className="qc-ai-button">
                            <Sparkles size={15} /> <span>Generate with AI</span>
                        </button>
                        <button type="button" onClick={handleSave} className="qe-save">
                            <Save size={15} /> <span>Save quiz</span>
                        </button>
                    </div>
                </header>

                <section className="qe-overview">
                    <div className="qe-title-panel">
                        <label className="qe-label" htmlFor="create-quiz-title">Quiz title</label>
                        <input
                            id="create-quiz-title"
                            type="text"
                            placeholder="Enter quiz title"
                            className="qe-title-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <div className="qc-builder-note">Create questions manually below or use AI to draft the complete quiz from a topic, brief or document.</div>
                    </div>
                    <div className="qe-summary" aria-label="Quiz creation summary">
                        <div className="qe-summary-card">
                            <div className="qe-summary-value">{questions.length}</div>
                            <div className="qe-summary-label">Questions</div>
                        </div>
                        <div className="qe-summary-card">
                            <div className="qe-summary-value">{totalSeconds}s</div>
                            <div className="qe-summary-label">Total answer time</div>
                        </div>
                    </div>
                </section>

                <section className="qe-question-list">
                    {questions.map((q, qIndex) => (
                        <motion.article
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(qIndex * 0.03, 0.18) }}
                            key={q.id || qIndex}
                            className="qe-question-card"
                        >
                            <div className="qe-question-head">
                                <div className="qe-question-index">
                                    <div className="qe-number">{qIndex + 1}</div>
                                    <div>
                                        <div className="qe-question-name">Question {qIndex + 1}</div>
                                        <div className="qe-question-sub">Choose one correct answer</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeQuestion(qIndex)}
                                    className="qe-delete"
                                    title={`Delete question ${qIndex + 1}`}
                                    aria-label={`Delete question ${qIndex + 1}`}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="qe-question-body">
                                <div className="qe-field">
                                    <label className="qe-label" htmlFor={`create-question-${qIndex}`}>Question prompt</label>
                                    <input
                                        id={`create-question-${qIndex}`}
                                        type="text"
                                        placeholder="Start typing your question"
                                        className="qe-question-input"
                                        value={q.questionText}
                                        onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                                    />
                                </div>

                                <div className="qe-field">
                                    <label className="qe-label">Question visual</label>
                                    <div className="qe-image-row">
                                        {q.image ? (
                                            <div className="qe-image-preview">
                                                <img src={q.image} alt={`Visual for question ${qIndex + 1}`} />
                                                <button
                                                    type="button"
                                                    onClick={() => updateQuestion(qIndex, 'image', null)}
                                                    className="qe-image-remove"
                                                    aria-label={`Remove image from question ${qIndex + 1}`}
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="qe-image-button">
                                                <ImageIcon size={14} /> Add image
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(qIndex, e)} />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="qe-field">
                                    <label className="qe-label">Answer options · select the correct answer</label>
                                    <div className="qe-options">
                                        {['A', 'B', 'C', 'D'].map((letter, oIndex) => (
                                            <div key={letter} className={`qe-option ${q.correctIndex === oIndex ? 'is-correct' : ''}`}>
                                                <label className="qe-option-pick" title={`Mark option ${letter} as correct`}>
                                                    <span className="qe-option-letter">{letter}</span>
                                                    <input
                                                        type="radio"
                                                        name={`correct-${qIndex}`}
                                                        checked={q.correctIndex === oIndex}
                                                        onChange={() => updateQuestion(qIndex, 'correctIndex', oIndex)}
                                                        aria-label={`Option ${letter} is correct`}
                                                    />
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder={`Option ${letter}`}
                                                    className="qe-option-input"
                                                    value={q.options[oIndex] || ''}
                                                    onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="qe-controls">
                                    <div className="qe-timer-wrap">
                                        <label className="qe-label" htmlFor={`create-timer-${qIndex}`}>Time limit</label>
                                        <Clock3 size={14} className="qe-timer-icon" />
                                        <select
                                            id={`create-timer-${qIndex}`}
                                            value={q.timer}
                                            onChange={(e) => updateQuestion(qIndex, 'timer', parseInt(e.target.value, 10))}
                                            className="qe-select"
                                        >
                                            <option value={5}>5 seconds</option>
                                            <option value={10}>10 seconds</option>
                                            <option value={15}>15 seconds</option>
                                            <option value={20}>20 seconds</option>
                                            <option value={30}>30 seconds</option>
                                            <option value={60}>60 seconds</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="qe-label" htmlFor={`create-explanation-${qIndex}`}>Explanation / learning note · optional</label>
                                        <textarea
                                            id={`create-explanation-${qIndex}`}
                                            placeholder="Explain the correct answer or add a short learning note for players."
                                            className="qe-explanation"
                                            value={q.explanation || ''}
                                            onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.article>
                    ))}
                </section>

                <button type="button" onClick={addQuestion} className="qe-add">
                    <Plus size={17} /> Add question
                </button>
            </div>

            <AnimatePresence>
                {showAiModal && (
                    <div className="qc-modal-layer">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="qc-modal-backdrop"
                            onClick={() => !isGenerating && setShowAiModal(false)}
                        />
                        <motion.section
                            initial={{ opacity: 0, scale: 0.96, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 16 }}
                            className="qc-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Generate quiz with AI"
                        >
                            <div className="qc-modal-head">
                                <div className="qc-ai-mark"><Sparkles size={20} /></div>
                                <div>
                                    <div className="qc-modal-kicker">AI quiz builder</div>
                                    <div className="qc-modal-title">Generate Quiz with AI</div>
                                    <div className="qc-modal-sub">Use a topic, supporting context, a document, or any combination of them.</div>
                                </div>
                                <button
                                    type="button"
                                    className="qc-modal-close"
                                    onClick={() => !isGenerating && setShowAiModal(false)}
                                    aria-label="Close AI quiz generator"
                                >
                                    <X size={17} />
                                </button>
                            </div>

                            <div className="qc-modal-body">
                                <div className="qc-field">
                                    <label className="qc-label" htmlFor="ai-topic">Topic</label>
                                    <input
                                        id="ai-topic"
                                        className="qc-input"
                                        value={aiTopic}
                                        onChange={(e) => setAiTopic(e.target.value)}
                                        disabled={isGenerating}
                                        placeholder="e.g. Phishing awareness"
                                    />
                                </div>

                                <div className="qc-field">
                                    <label className="qc-label" htmlFor="ai-description">Description / context</label>
                                    <textarea
                                        id="ai-description"
                                        className="qc-textarea"
                                        value={aiDescription}
                                        onChange={(e) => setAiDescription(e.target.value)}
                                        disabled={isGenerating}
                                        placeholder="Describe the audience, learning goal, important points, or paste supporting text."
                                    />
                                </div>

                                <div className="qc-field">
                                    <label className="qc-label">Optional document</label>
                                    <label className="qc-upload">
                                        <div className="qc-upload-icon">{aiFile ? <FileText size={18} /> : <UploadCloud size={18} />}</div>
                                        <div className="min-w-0">
                                            <div className="qc-upload-title truncate">{aiFile ? aiFile.name : 'Upload source document'}</div>
                                            <div className="qc-upload-meta">PDF, PPTX, DOCX, TXT or MD · up to 12 MB</div>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,.pptx,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                                            disabled={isGenerating}
                                            onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                                        />
                                    </label>
                                    {aiFile && (
                                        <button type="button" disabled={isGenerating} onClick={() => setAiFile(null)} className="qc-remove-file">
                                            Remove document
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAiGenerate}
                                    disabled={isGenerating || !hasAiSource}
                                    className="qc-generate"
                                >
                                    {isGenerating ? (
                                        <><Loader2 size={18} className="animate-spin" /> Generating quiz…</>
                                    ) : (
                                        <><Sparkles size={18} /> Generate quiz</>
                                    )}
                                </button>
                            </div>
                        </motion.section>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CreateQuiz;
