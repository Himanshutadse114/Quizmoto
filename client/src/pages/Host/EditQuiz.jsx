import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { ArrowLeft, Clock3, Image as ImageIcon, Plus, Save, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiUrl } from '../../config';
import './quizmotoEditWorkbench.css';

const EditQuiz = () => {
    const { id } = useParams();
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();
    const navigate = useNavigate();

    const API_URL = apiUrl('/api/quizzes');

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await axios.get(`${API_URL}/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTitle(res.data.title);
                const formattedQuestions = res.data.questions.map((q) => ({
                    ...q,
                    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                }));
                setQuestions(formattedQuestions);
                setLoading(false);
            } catch (err) {
                console.error(err);
                alert('Failed to load quiz');
                navigate('/host');
            }
        };
        fetchQuiz();
    }, [id, token, navigate, API_URL]);

    const addQuestion = () => {
        setQuestions([
            ...questions,
            {
                questionText: '',
                options: ['', '', '', ''],
                correctIndex: 0,
                timer: 20,
                explanation: '',
                image: null
            }
        ]);
    };

    const removeQuestion = (index) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const updateQuestion = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        setQuestions(newQuestions);
    };

    const updateOption = (qIndex, oIndex, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    const handleImageUpload = (qIndex, e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be under 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 800;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const base64Str = canvas.toDataURL('image/jpeg', 0.8);
                updateQuestion(qIndex, 'image', base64Str);
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

                const correctText = q.options[q.correctIndex];
                if (!correctText || correctText.trim() === '') {
                    throw new Error(`Question ${i + 1}'s correct answer cannot be an empty option`);
                }

                const newCorrectIndex = validOptions.indexOf(correctText);

                return {
                    questionText: q.questionText,
                    options: validOptions,
                    correctIndex: newCorrectIndex,
                    timer: q.timer,
                    explanation: q.explanation || '',
                    image: q.image || null
                };
            });

            await axios.put(
                `${API_URL}/${id}`,
                { title, questions: sanitizedQuestions },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            navigate('/host');
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.message || err.message || 'Failed to update quiz';
            alert(message);
        }
    };

    const totalSeconds = useMemo(
        () => questions.reduce((sum, question) => sum + Number(question.timer || 0), 0),
        [questions]
    );

    if (loading) {
        return (
            <div className="quizmoto-edit-workbench qe-loading">
                <div>
                    <div className="qe-loading-title">Loading quiz</div>
                    <div className="qe-loading-sub">Opening the Quizmoto editing workspace</div>
                </div>
            </div>
        );
    }

    return (
        <div className="quizmoto-edit-workbench">
            <div className="qe-shell">
                <header className="qe-topbar">
                    <button type="button" onClick={() => navigate('/host')} className="qe-back" aria-label="Back to Quizmoto dashboard">
                        <ArrowLeft size={19} />
                    </button>
                    <div className="qe-header-copy">
                        <div className="qe-kicker">Quiz management</div>
                        <div className="qe-heading">Edit Quiz</div>
                        <div className="qe-header-meta">Update questions, answers, timing and learning feedback</div>
                    </div>
                    <button type="button" onClick={handleSave} className="qe-save">
                        <Save size={15} /> <span>Save changes</span>
                    </button>
                </header>

                <section className="qe-overview">
                    <div className="qe-title-panel">
                        <label className="qe-label" htmlFor="quiz-title">Quiz title</label>
                        <input
                            id="quiz-title"
                            type="text"
                            placeholder="Enter quiz title"
                            className="qe-title-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="qe-summary" aria-label="Quiz edit summary">
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
                                    <label className="qe-label" htmlFor={`question-${qIndex}`}>Question prompt</label>
                                    <input
                                        id={`question-${qIndex}`}
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
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleImageUpload(qIndex, e)}
                                                />
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
                                        <label className="qe-label" htmlFor={`timer-${qIndex}`}>Time limit</label>
                                        <Clock3 size={14} className="qe-timer-icon" />
                                        <select
                                            id={`timer-${qIndex}`}
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
                                        <label className="qe-label" htmlFor={`explanation-${qIndex}`}>Explanation / learning note · optional</label>
                                        <textarea
                                            id={`explanation-${qIndex}`}
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
        </div>
    );
};

export default EditQuiz;
