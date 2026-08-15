import React from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Trash2 } from 'lucide-react';

const blankQuestion = () => ({
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: ''
});

function normalizeQuestion(value) {
  const item = value && typeof value === 'object' ? value : {};
  const options = Array.isArray(item.options) ? [...item.options].slice(0, 4) : [];
  while (options.length < 4) options.push('');
  const correct = Number(item.correctAnswer);
  return {
    ...item,
    question: String(item.question || ''),
    options,
    correctAnswer: Number.isInteger(correct) && correct >= 0 && correct < 4 ? correct : 0,
    explanation: String(item.explanation || '')
  };
}

export default function AuthorQuizEditor({ quiz = [], onChange }) {
  const questions = (Array.isArray(quiz) ? quiz : []).map(normalizeQuestion);

  const replace = (index, nextQuestion) => {
    const next = [...questions];
    next[index] = nextQuestion;
    onChange(next);
  };

  const update = (index, patch) => replace(index, { ...questions[index], ...patch });

  const updateOption = (questionIndex, optionIndex, value) => {
    const options = [...questions[questionIndex].options];
    options[optionIndex] = value;
    update(questionIndex, { options });
  };

  const remove = (index) => onChange(questions.filter((_, questionIndex) => questionIndex !== index));

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = () => onChange([...questions, blankQuestion()]);

  return (
    <section className="scorm-panel rounded-3xl border overflow-hidden">
      <div className="scorm-panel-header flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="scorm-eyebrow">Knowledge check editor</div>
          <h2 className="text-xl mt-1">Edit the generated quiz</h2>
          <p className="text-xs mt-2 max-w-2xl text-[#a98259]">Change the question, all four answers, the correct answer and learner explanation before generating or rebuilding the SCORM package.</p>
        </div>
        <button type="button" onClick={add} className="scorm-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold">
          <Plus size={14} /> Add question
        </button>
      </div>

      <div className="p-4 md:p-5 space-y-4">
        {questions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#6c4827] bg-[#1d140e] p-8 text-center">
            <div className="text-sm font-semibold text-[#f2d8b2]">No knowledge-check questions</div>
            <div className="text-xs text-[#a98259] mt-1">Add a question to include an assessment in this course.</div>
            <button type="button" onClick={add} className="scorm-button-primary mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"><Plus size={14} /> Add first question</button>
          </div>
        )}

        {questions.map((question, questionIndex) => {
          const complete = Boolean(
            question.question.trim() &&
            question.options.every((option) => String(option || '').trim()) &&
            question.explanation.trim()
          );
          return (
            <article key={questionIndex} className="rounded-2xl border border-[#4f3521] bg-[#1c130d] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[#4f3521] bg-[#25170e] flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl grid place-items-center font-mono font-bold text-[#1a110a] bg-[#f5b53f]">{questionIndex + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-[.12em] font-semibold text-[#a98259]">Knowledge check</div>
                  <div className="text-xs mt-1 text-[#e9d1ae]">{complete ? 'Ready for learner delivery' : 'Complete all fields before publishing'}</div>
                </div>
                {complete && <CheckCircle2 size={16} className="text-[#e3b35f]" />}
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(questionIndex, -1)} disabled={questionIndex === 0} className="scorm-button-secondary w-8 h-8 grid place-items-center disabled:opacity-25" title="Move question up"><ArrowUp size={13} /></button>
                  <button type="button" onClick={() => move(questionIndex, 1)} disabled={questionIndex === questions.length - 1} className="scorm-button-secondary w-8 h-8 grid place-items-center disabled:opacity-25" title="Move question down"><ArrowDown size={13} /></button>
                  <button type="button" onClick={() => remove(questionIndex)} className="scorm-button-secondary w-8 h-8 grid place-items-center text-[#f1a18e]" title="Delete question"><Trash2 size={13} /></button>
                </div>
              </div>

              <div className="p-4 md:p-5 space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[.11em] text-[#a98259] font-semibold mb-2">Question</label>
                  <textarea rows={2} value={question.question} onChange={(event) => update(questionIndex, { question: event.target.value })} className="w-full p-3 text-sm leading-relaxed" placeholder="Enter the learner question" />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[.11em] text-[#a98259] font-semibold mb-2">Answer options · select the correct answer</label>
                  <div className="grid lg:grid-cols-2 gap-2.5">
                    {question.options.map((option, optionIndex) => {
                      const selected = question.correctAnswer === optionIndex;
                      return (
                        <label key={optionIndex} className={`rounded-xl border px-3 py-3 flex items-center gap-3 cursor-pointer ${selected ? 'border-[#c9821f] bg-[#3a240f]' : 'border-[#4f3521] bg-[#17100c]'}`}>
                          <input type="radio" name={`scorm-author-correct-${questionIndex}`} checked={selected} onChange={() => update(questionIndex, { correctAnswer: optionIndex })} />
                          <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 text-[10px] font-bold ${selected ? 'bg-[#f5b53f] text-[#1a110a]' : 'bg-[#2d1d12] text-[#c99d69]'}`}>{String.fromCharCode(65 + optionIndex)}</span>
                          <input value={option} onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)} onClick={(event) => event.stopPropagation()} className="min-w-0 flex-1 bg-transparent border-0 outline-none text-xs p-0" placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} />
                          {selected && <span className="text-[9px] uppercase tracking-[.08em] font-semibold text-[#ffc45c]">Correct</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[.11em] text-[#a98259] font-semibold mb-2">Explanation shown after answering</label>
                  <textarea rows={3} value={question.explanation} onChange={(event) => update(questionIndex, { explanation: event.target.value })} className="w-full p-3 text-sm leading-relaxed" placeholder="Explain why the correct answer is right and reinforce the learning point." />
                </div>
              </div>
            </article>
          );
        })}

        {!!questions.length && (
          <div className="text-[10px] text-[#8f6a45] px-1">Recommended: 5–8 well-structured knowledge-check questions. The selected correct-answer index and explanation are preserved in the generated SCORM package.</div>
        )}
      </div>
    </section>
  );
}
