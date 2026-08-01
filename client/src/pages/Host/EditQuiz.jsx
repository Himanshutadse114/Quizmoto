import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Plus, Trash2, Save, ArrowLeft, Image as ImageIcon, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiUrl } from '../../config';

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
                // Ensure options is an array (backend might return stringified for some DBs)
                const formattedQuestions = res.data.questions.map(q => ({
                    ...q,
                    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                }));
                setQuestions(formattedQuestions);
                setLoading(false);
            } catch (err) {
                console.error(err);
                alert('Failed to load quiz');
                navigate('/dashboard');
            }
        };
        fetchQuiz();
    }, [id, token, navigate, API_URL]);

    const addQuestion = () => {
        setQuestions([...questions, { questionText: '', options: ['', '', '', ''], correctIndex: 0, timer: 20, explanation: '', image: null }]);
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
                const validOptions = q.options.filter(opt => opt.trim() !== '');

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

            await axios.put(`${API_URL}/${id}`, {
                title,
                questions: sanitizedQuestions
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.message || err.message || 'Failed to update quiz';
            alert(message);
        }
    };

    if (loading) return <div className="p-20 text-center font-black italic text-4xl">Loading Quiz...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/dashboard')} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-black italic">Edit Quiz</h1>
                </div>
                <button
                    onClick={handleSave}
                    className="bg-quizmoto-green px-5 py-2 rounded-lg font-black text-xs flex items-center gap-2 shadow-[0_3px_0_0_#1a5e08] hover:shadow-none hover:translate-y-1 transition-all"
                >
                    <Save size={16} /> Save Changes
                </button>
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

                        <div className="mb-6">
                            {q.image ? (
                                <div className="relative inline-block mt-2">
                                    <img src={q.image} alt="Question" className="max-h-48 rounded-lg shadow-sm border border-gray-200" />
                                    <button 
                                        onClick={() => updateQuestion(qIndex, 'image', null)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-2">
                                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors">
                                        <ImageIcon size={14} /> Add Image
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(qIndex, e)} />
                                    </label>
                                </div>
                            )}
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
                                        value={q.options[oIndex] || ''}
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
                                <option value={15}>15 sec</option>
                                <option value={20}>20 sec</option>
                                <option value={30}>30 sec</option>
                                <option value={60}>60 sec</option>
                            </select>
                        </div>

                        <div className="mt-4">
                            <label className="block text-[10px] font-black text-gray-400 mb-1 tracking-widest">EXPLANATION / FUN FACT (Optional)</label>
                            <textarea
                                placeholder="Explain the correct answer or share a fun fact to show players while they wait..."
                                className="w-full text-sm font-bold border border-gray-200 rounded-lg p-2 outline-none focus:border-quizmoto-purple transition-all resize-none h-16"
                                value={q.explanation || ''}
                                onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                            />
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
        </div>
    );
};

export default EditQuiz;
