import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Plus, Trash2, Save, Sparkles, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CreateQuiz = () => {
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState([
        { questionText: '', options: ['', '', '', ''], correctIndex: 0, timer: 20 }
    ]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const { token } = useAuth();
    const navigate = useNavigate();

    const GEN_API_URL = `/api/quizzes/generate-ai`;

    const API_URL = `/api/quizzes`;

    const addQuestion = () => {
        setQuestions([...questions, { questionText: '', options: ['', '', '', ''], correctIndex: 0, timer: 20 }]);
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

    const handleSave = async () => {
        try {
            if (!title.trim()) return alert('Please enter a quiz title');
            if (questions.length === 0) return alert('Please add at least one question');

            // Re-map questions to filter out empty options
            const sanitizedQuestions = questions.map((q, i) => {
                // Filter out empty options
                const validOptions = q.options.filter(opt => opt.trim() !== '');

                if (!q.questionText.trim()) {
                    throw new Error(`Question ${i + 1} is missing text`);
                }

                if (validOptions.length < 2) {
                    throw new Error(`Question ${i + 1} needs at least 2 valid options`);
                }

                if (!q.options[q.correctIndex] || q.options[q.correctIndex].trim() === '') {
                    throw new Error(`Question ${i + 1}'s correct answer cannot be an empty option`);
                }

                // Calculate the new correctIndex based on filtered options
                const correctText = q.options[q.correctIndex];
                const newCorrectIndex = validOptions.indexOf(correctText);

                return {
                    questionText: q.questionText,
                    options: validOptions,
                    correctIndex: newCorrectIndex,
                    timer: q.timer
                };
            });

            console.log('Sending sanitized questions:', sanitizedQuestions);

            await axios.post(API_URL, {
                title,
                questions: sanitizedQuestions
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            const message = err.message || err.response?.data?.message || 'Failed to save quiz. Please check your connection.';
            alert(message);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return alert('Please enter a topic or paste some text');
        setIsGenerating(true);
        try {
            const res = await axios.post(GEN_API_URL, {
                prompt: aiPrompt
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.questions) {
                setQuestions(res.data.questions);
                if (res.data.title && !title) setTitle(res.data.title);
                setShowAiModal(false);
                setAiPrompt('');
            }
        } catch (err) {
            console.error(err);
            alert('AI Generation failed. Ensure your server has GEMINI_API_KEY configured.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-xl font-black italic">Create Quiz</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAiModal(true)}
                        className="bg-indigo-600 px-4 py-2 rounded-lg font-black text-xs flex items-center gap-2 shadow-[0_3px_0_0_#3730a3] hover:shadow-none hover:translate-y-1 transition-all"
                    >
                        <Sparkles size={16} /> Generate with AI
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-quizmoto-green px-5 py-2 rounded-lg font-black text-xs flex items-center gap-2 shadow-[0_3px_0_0_#1a5e08] hover:shadow-none hover:translate-y-1 transition-all"
                    >
                        <Save size={16} /> Save Quiz
                    </button>
                </div>
            </header>

            <div className="bg-white/5 p-5 rounded-xl mb-6 border border-white/10">
                <label className="block text-[10px] font-black mb-2 uppercase tracking-widest opacity-40">Quiz Title</label>
                <input
                    type="text"
                    placeholder="Enter quiz title..."
                    className="w-full bg-transparent border-b-2 border-white/20 text-xl font-black outline-none focus:border-white transition-colors py-1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
            </div>

            <div className="space-y-10">
                {questions.map((q, qIndex) => (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={qIndex}
                        className="bg-white text-gray-800 p-6 rounded-2xl shadow-xl relative"
                    >
                        <div className="absolute -top-3 -left-3 bg-quizmoto-purple text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-sm">
                            {qIndex + 1}
                        </div>

                        <button
                            onClick={() => removeQuestion(qIndex)}
                            className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>

                        <div className="mb-5">
                            <label className="block text-[10px] font-black text-gray-400 mb-1 tracking-widest">QUESTION</label>
                            <input
                                type="text"
                                placeholder="Start typing your question"
                                className="w-full text-lg font-black border-b border-gray-100 p-1 outline-none focus:border-quizmoto-purple transition-all"
                                value={q.questionText}
                                onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {['red', 'blue', 'yellow', 'green'].map((color, oIndex) => (
                                <div key={oIndex} className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded shrink-0 bg-quizmoto-${color} flex items-center justify-center`}>
                                        <input
                                            type="radio"
                                            name={`correct-${qIndex}`}
                                            checked={q.correctIndex === oIndex}
                                            onChange={() => updateQuestion(qIndex, 'correctIndex', oIndex)}
                                            className="w-3.5 h-3.5 cursor-pointer"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={`Option ${oIndex + 1}`}
                                        className="w-full p-2 bg-gray-50 border border-transparent rounded-lg focus:border-quizmoto-purple outline-none text-sm font-bold"
                                        value={q.options[oIndex]}
                                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex items-center gap-4">
                            <label className="text-sm font-bold text-gray-400">TIME LIMIT (sec)</label>
                            <select
                                value={q.timer}
                                onChange={(e) => updateQuestion(qIndex, 'timer', parseInt(e.target.value))}
                                className="bg-gray-100 p-2 rounded font-bold"
                            >
                                <option value={5}>5 sec</option>
                                <option value={10}>10 sec</option>
                                <option value={20}>20 sec</option>
                                <option value={30}>30 sec</option>
                                <option value={60}>60 sec</option>
                            </select>
                        </div>
                    </motion.div>
                ))}
            </div>

            <button
                onClick={addQuestion}
                className="w-full mt-8 border-2 border-dashed border-white/20 py-3 rounded-xl font-black text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={18} /> Add Question
            </button>

            {/* AI Generator Modal */}
            <AnimatePresence>
                {showAiModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isGenerating && setShowAiModal(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white text-gray-800 w-full max-w-md p-8 rounded-[32px] shadow-2xl relative z-10"
                        >
                            <button
                                onClick={() => setShowAiModal(false)}
                                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-100 rounded-xl">
                                    <Sparkles className="text-indigo-600" size={24} />
                                </div>
                                <h2 className="text-2xl font-black italic tracking-tight">QuestGen AI</h2>
                            </div>

                            <p className="text-sm font-bold text-gray-500 mb-6 leading-relaxed">
                                Enter a topic (e.g., "Phishing Awareness") or paste some text. I'll automatically generate a balanced quiz for you.
                            </p>

                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="What is the quiz about?"
                                className="w-full h-32 p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 transition-all font-bold resize-none mb-6"
                                disabled={isGenerating}
                            />

                            <button
                                onClick={handleAiGenerate}
                                disabled={isGenerating || !aiPrompt.trim()}
                                className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-3 transition-all ${isGenerating || !aiPrompt.trim()
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white shadow-[0_6px_0_0_#3730a3] hover:translate-y-1 hover:shadow-none'
                                    }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        GENERATING...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={20} />
                                        BRING IT TO LIFE
                                    </>
                                )}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CreateQuiz;
