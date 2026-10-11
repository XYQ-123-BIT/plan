import { useState } from 'react';
import { Send, Loader2, CheckCircle2, Clock, Zap, Target, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import OmniflowBadge from '@/components/custom/OmniflowBadge';
import QuadrantBoard from '@/components/custom/QuadrantBoard';
import Navbar from '@/components/custom/Navbar';
import { useTaskContext } from '@/contexts/TaskContext';
import type { AIClassifyResponse, Quadrant, Task } from '../../../shared/types/tasks';
import { QUADRANT_META } from '../../../shared/types/tasks';

const QUADRANT_OPTIONS: Quadrant[] = ['Q1', 'Q2', 'Q3', 'Q4'];

function ResultCard({
  result,
  onConfirm,
  onCancel,
}: {
  result: AIClassifyResponse;
  onConfirm: (r: AIClassifyResponse) => void;
  onCancel: () => void;
}) {
  const [editedResult, setEditedResult] = useState<AIClassifyResponse>(result);
  const [showReasoning, setShowReasoning] = useState(false);
  const meta = QUADRANT_META[editedResult.quadrant];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-xs text-slate-400 font-medium mb-1">AI 识别结果</p>
          <input
            className="text-base font-semibold text-slate-900 w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none pb-0.5 transition-colors"
            value={editedResult.title}
            onChange={(e) => setEditedResult((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>
        <button onClick={onCancel} className="ml-3 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {/* Quadrant selector */}
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">象限</label>
          <select
            className={`w-full text-xs font-semibold px-2 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 ${meta.bgColor} ${meta.textColor} border-transparent`}
            value={editedResult.quadrant}
            onChange={(e) => setEditedResult((prev) => ({ ...prev, quadrant: e.target.value as Quadrant }))}
          >
            {QUADRANT_OPTIONS.map((q) => (
              <option key={q} value={q}>{QUADRANT_META[q].label}</option>
            ))}
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">时长(分钟)</label>
          <input
            type="number"
            min={5}
            max={480}
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
            value={editedResult.durationMinutes}
            onChange={(e) => setEditedResult((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))}
          />
        </div>

        {/* Deadline */}
        <div className="col-span-2 sm:col-span-2">
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide block mb-1">截止时间</label>
          <input
            type="text"
            placeholder="如：明天下午3点"
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
            value={editedResult.deadline || ''}
            onChange={(e) => setEditedResult((prev) => ({ ...prev, deadline: e.target.value || undefined }))}
          />
        </div>
      </div>

      {/* Scores */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs text-slate-500">重要度</span>
          <span className="text-xs font-bold text-indigo-600">{editedResult.importanceScore}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs text-slate-500">紧急度</span>
          <span className="text-xs font-bold text-amber-600">{editedResult.urgencyScore}</span>
        </div>
        <button
          onClick={() => setShowReasoning((v) => !v)}
          className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
        >
          AI 依据 {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showReasoning && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 leading-relaxed">
          {editedResult.reasoning}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" className="flex-1 cursor-pointer" onClick={() => onConfirm(editedResult)}>
          <CheckCircle2 className="w-4 h-4 mr-1" />
          加入规划
        </Button>
        <Button size="sm" variant="outline" className="cursor-pointer" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}

function TodayStats({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const overdue = tasks.filter((t) => t.status === 'overdue').length;
  const q1 = tasks.filter((t) => t.quadrant === 'Q1' && t.status !== 'completed').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: '今日任务', value: total, color: 'text-slate-700', bg: 'bg-slate-50' },
        { label: '已完成', value: completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: '已延期', value: overdue, color: 'text-red-500', bg: 'bg-red-50' },
        { label: '紧急待办', value: q1, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      ].map(({ label, value, color, bg }) => (
        <div key={label} className={`${bg} rounded-xl p-4 flex flex-col gap-1`}>
          <span className={`text-2xl font-bold ${color}`}>{value}</span>
          <span className="text-xs text-slate-500">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Index() {
  const [input, setInput] = useState('');
  const {
    tasks,
    isClassifying,
    pendingResult,
    classifyTask,
    confirmTask,
    cancelPending,
    completeTask,
    deleteTask,
    changeQuadrant,
    clearCompleted,
  } = useTaskContext();

  const handleSubmit = () => {
    if (!input.trim() || isClassifying) return;
    classifyTask(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasCompleted = tasks.some((t) => t.status === 'completed');

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">工作台</h1>
          <p className="text-sm text-slate-500 mt-1">用自然语言输入任务，AI 自动分类到四象限</p>
        </div>

        {/* Today Stats */}
        <div className="mb-6">
          <TodayStats tasks={tasks} />
        </div>

        {/* Input Area */}
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="relative">
            <Textarea
              placeholder="输入任务，如：明天下午3点前交产品PRD，大约需要2小时"
              className="resize-none pr-12 text-sm min-h-[80px] border-0 shadow-none focus-visible:ring-0 bg-transparent"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isClassifying}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isClassifying}
              className="absolute bottom-2 right-2 p-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-xl transition-colors cursor-pointer"
              aria-label="提交"
            >
              {isClassifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          {isClassifying && (
            <div className="flex items-center gap-2 mt-2 text-xs text-indigo-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              AI 识别中...
            </div>
          )}
        </div>

        {/* AI Result Card */}
        {pendingResult && (
          <div className="mb-6">
            <ResultCard
              result={pendingResult}
              onConfirm={confirmTask}
              onCancel={cancelPending}
            />
          </div>
        )}

        {/* Quadrant Board */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-700">四象限看板</h2>
          <div className="flex items-center gap-2">
            {hasCompleted && (
              <button
                onClick={clearCompleted}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空已完成
              </button>
            )}
            <Badge variant="secondary" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {tasks.filter((t) => t.status !== 'completed').length} 个待办
            </Badge>
          </div>
        </div>

        <QuadrantBoard
          tasks={tasks}
          onComplete={completeTask}
          onDelete={deleteTask}
          onChangeQuadrant={changeQuadrant}
        />
      </main>

      <OmniflowBadge />
      <Toaster />
    </div>
  );
}
