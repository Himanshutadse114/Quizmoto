import React from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import './authorQuizEditor.css';

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
    <section className="scorm-panel qmx-author-quiz rounded-3xl border overflow-hidden">
      <div className="scorm-panel-header flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="scorm-eyebrow">Knowledge check editor</div>
          <h2 className="text-xl mt-1">Edit the generated quiz</h2>
          <p className="qmx-quiz-editor-copy text-xs mt-2 max-w-2xl">Change the question, all four answers, the correct answer and learner explanation before generating or rebuilding the SCORM package.</p>
        </div>
        <button type="button" onClick={add} className="scorm-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold">
          <Plus size={14} /> Add question
        </button>
      </div>

      <div className="p-4 md:p-5 space-y-4">
        {questions.length === 0 && (
          <div className="qmx-quiz-empty rounded-2xl border border-dashed p-8 text-center">
            <div className="qmx-quiz-empty-title text-sm font-semibold">No knowledge-check questions</div>
            <div className="qmx-quiz-empty-copy text-xs mt-1">Add a question to include an assessment in this course.</div>
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
            <article key={questionIndex} className="qmx-question-card rounded-2xl border overflow-hidden">
              <div className="qmx-question-header px-4 py-3.5 border-b flex items-center gap-3">
                <div className="qmx-question-index w-9 h-9 rounded-xl grid place-items-center font-mono font-bold">{questionIndex + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="qmx-question-eyebrow text-[10px] uppercase tracking-[.12em] font-semibold">Knowledge check</div>
                  <div className="qmx-question-status text-xs mt-1">{complete ? 'Ready for learner delivery' : 'Complete all fields before publishing'}</div>
                </div>
                {complete && <CheckCircle2 size={16} className="qmx-question-complete" />}
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(questionIndex, -1)} disabled={questionIndex === 0} className="scorm-button-secondary w-8 h-8 grid place-items-center disabled:opacity-25" title="Move question up"><ArrowUp size={13} /></button>
                  <button type="button" onClick={() => move(questionIndex, 1)} disabled={questionIndex === questions.length - 1} className="scorm-button-secondary w-8 h-8 grid place-items-center disabled:opacity-25" title="Move question down"><ArrowDown size={13} /></button>
                  <button type="button" onClick={() => remove(questionIndex)} className="scorm-button-secondary qmx-delete-question w-8 h-8 grid place-items-center" title="Delete question"><Trash2 size={13} /></button>
                </div>
              </div>

              <div className="p-4 md:p-5 space-y-4">
                <div>
                  <label className="qmx-field-label block text-[10px] uppercase tracking-[.11em] font-semibold mb-2">Question</label>
                  <textarea rows={2} value={question.question} onChange={(event) => update(questionIndex, { question: event.target.value })} className="w-full p-3 text-sm leading-relaxed" placeholder="Enter the learner question" />
                </div>

                <div>
                  <label className="qmx-field-label block text-[10px] uppercase tracking-[.11em] font-semibold mb-2">Answer options · select the correct answer</label>
                  <div className="grid lg:grid-cols-2 gap-2.5">
                    {question.options.map((option, optionIndex) => {
                      const selected = question.correctAnswer === optionIndex;
                      return (
                        <label key={optionIndex} className={`qmx-answer-option rounded-xl border px-3 py-3 flex items-center gap-3 cursor-pointer ${selected ? 'is-correct' : ''}`}>
                          <input type="radio" name={`scorm-author-correct-${questionIndex}`} checked={selected} onChange={() => update(questionIndex, { correctAnswer: optionIndex })} />
                          <span className="qmx-answer-letter w-7 h-7 rounded-lg grid place-items-center shrink-0 text-[10px] font-bold">{String.fromCharCode(65 + optionIndex)}</span>
                          <input value={option} onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)} onClick={(event) => event.stopPropagation()} className="min-w-0 flex-1 bg-transparent border-0 outline-none text-xs p-0" placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} />
                          {selected && <span className="qmx-correct-label text-[9px] uppercase tracking-[.08em] font-semibold">Correct</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="qmx-field-label block text-[10px] uppercase tracking-[.11em] font-semibold mb-2">Explanation shown after answering</label>
                  <textarea rows={3} value={question.explanation} onChange={(event) => update(questionIndex, { explanation: event.target.value })} className="w-full p-3 text-sm leading-relaxed" placeholder="Explain why the correct answer is right and reinforce the learning point." />
                </div>
              </div>
            </article>
          );
        })}

        {!!questions.length && (
          <div className="qmx-quiz-footnote text-[10px] px-1">Recommended: 5–8 well-structured knowledge-check questions. The selected correct-answer index and explanation are preserved in the generated SCORM package.</div>
        )}
      </div>
    </section>
  );
}
