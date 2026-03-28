import React, { useState } from 'react';
import { MessageCircleQuestion, Send, ChevronRight, Check } from 'lucide-react';
import { ContentBlock, AskUserQuestion } from '../../types';

type AskUserData = Extract<ContentBlock, { type: 'askuser' }>;

function QuestionPanel({
  q,
  index,
  total,
  onAnswer,
}: {
  q: AskUserQuestion;
  index: number;
  total: number;
  onAnswer: (response: string) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState('');

  const handleSubmitAnswer = () => {
    if (selected !== null && selected < (q.options?.length ?? 0)) {
      onAnswer(q.options![selected]);
    } else if (customInput.trim()) {
      onAnswer(customInput.trim());
    }
  };

  return (
    <div>
      {/* Question text */}
      <div className="px-4 py-3">
        <p className="text-sm text-gray-200">
          <span className="text-gray-500 text-xs mr-2">{index + 1}/{total}</span>
          {q.question}
        </p>
      </div>

      {/* Options list */}
      <div className="border-t border-white/5">
        {q.options?.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelected(i)}
            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-white/5 last:border-b-0 w-full text-left ${
              selected === i ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
            }`}
          >
            <span className={`w-5 h-5 rounded-full text-[11px] font-medium flex items-center justify-center shrink-0 ${
              selected === i ? 'bg-violet-400 text-white' : 'bg-white/10 text-gray-400'
            }`}>
              {i + 1}
            </span>
            <span className={`text-sm ${selected === i ? 'text-gray-200' : 'text-gray-300'}`}>{opt}</span>
          </button>
        ))}

        {/* Custom input row */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className={`w-5 h-5 rounded-full text-[11px] font-medium flex items-center justify-center shrink-0 ${
            selected === (q.options?.length ?? 0) ? 'bg-violet-400 text-white' : 'bg-white/10 text-gray-400'
          }`}>
            {(q.options?.length ?? 0) + 1}
          </span>
          <input
            type="text"
            value={customInput}
            onChange={(e) => { setCustomInput(e.target.value); setSelected(q.options?.length ?? 0); }}
            onFocus={() => setSelected(q.options?.length ?? 0)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitAnswer(); }}
            placeholder="自定义回复..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
          />
          <button
            onClick={handleSubmitAnswer}
            disabled={selected === null && !customInput.trim()}
            aria-label="Submit answer"
            className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-30 flex items-center justify-center text-gray-300 transition-colors shrink-0"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AskUserBlock({ questions, submitted, onSubmit }: AskUserData & { onSubmit?: (text: string) => void }) {
  const [currentTab, setCurrentTab] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    questions.forEach(q => { if (q.response) init[q.id] = q.response; });
    return init;
  });
  const [isSubmitted, setIsSubmitted] = useState(!!submitted);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const handleAnswer = (qId: string, response: string) => {
    setAnswers(prev => ({ ...prev, [qId]: response }));
    if (currentTab < questions.length - 1) {
      setCurrentTab(currentTab + 1);
    }
  };

  const handleSubmitAll = () => {
    setIsSubmitted(true);
    if (onSubmit) {
      const text = questions.map((q, i) =>
        `${i + 1}. ${q.question}\n   → ${answers[q.id] || '—'}`
      ).join('\n');
      onSubmit(text);
    }
  };

  // Submitted state: flat list of Q&A
  if (isSubmitted) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
          <Check size={14} className="text-green-400" />
          <span className="text-xs font-medium text-gray-400">已回复 {questions.length} 个问题</span>
        </div>
        <div className="divide-y divide-white/5">
          {questions.map((q, i) => (
            <div key={q.id} className="px-4 py-2.5">
              <p className="text-xs text-gray-500">{i + 1}. {q.question}</p>
              <p className="text-sm text-gray-300 mt-1">{answers[q.id] || q.response || '—'}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Active state
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <MessageCircleQuestion size={14} className="text-violet-400" />
        <span className="text-xs font-medium text-gray-400">需要你的回答</span>
      </div>

      {/* Tab dots */}
      {questions.length > 1 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5">
          {questions.map((q, i) => {
            const isAnswered = !!answers[q.id];
            const isCurrent = i === currentTab;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentTab(i)}
                className={`h-1.5 rounded-full transition-all ${
                  isCurrent
                    ? 'w-6 bg-violet-400'
                    : isAnswered
                      ? 'w-1.5 bg-green-400/60'
                      : 'w-1.5 bg-white/20'
                }`}
              />
            );
          })}
          <span className="text-[11px] text-gray-500 ml-auto">{answeredCount}/{questions.length}</span>
        </div>
      )}

      {/* Current question */}
      {questions[currentTab] && !answers[questions[currentTab].id] ? (
        <QuestionPanel
          key={questions[currentTab].id}
          q={questions[currentTab]}
          index={currentTab}
          total={questions.length}
          onAnswer={(resp) => handleAnswer(questions[currentTab].id, resp)}
        />
      ) : (
        <div className="px-4 py-3">
          <p className="text-sm text-gray-300/70">
            <span className="text-gray-500 text-xs mr-2">{currentTab + 1}/{questions.length}</span>
            {questions[currentTab]?.question}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Check size={12} className="text-green-400" />
            <span className="text-sm text-gray-300">{answers[questions[currentTab]?.id]}</span>
            <button
              onClick={() => setAnswers(prev => { const next = { ...prev }; delete next[questions[currentTab].id]; return next; })}
              className="text-[11px] text-gray-500 hover:text-gray-300 ml-auto transition-colors"
            >
              重选
            </button>
          </div>
        </div>
      )}

      {/* Submit button */}
      {allAnswered && (
        <div className="border-t border-white/5 px-4 py-2.5">
          <button
            onClick={handleSubmitAll}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-gray-300 text-sm font-medium transition-colors"
          >
            <Send size={13} />
            提交全部回答
          </button>
        </div>
      )}
    </div>
  );
}
