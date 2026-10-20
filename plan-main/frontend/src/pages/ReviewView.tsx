import { useMemo } from 'react';
import { TrendingUp, CheckCircle2, AlertCircle, Clock, Lightbulb } from 'lucide-react';
import Navbar from '@/components/custom/Navbar';
import { useTaskContext } from '@/contexts/TaskContext';
import { QUADRANT_META } from '../../../shared/types/tasks';
import type { Quadrant } from '../../../shared/types/tasks';
import OmniflowBadge from '@/components/custom/OmniflowBadge';
import { Toaster } from '@/components/ui/sonner';

const QUADRANTS: Quadrant[] = ['Q1', 'Q2', 'Q3', 'Q4'];

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="w-32 h-32 rounded-full bg-slate-100 mx-auto" />;

  const segments = data.reduce<{ label: string; value: number; color: string; start: number; pct: number }[]>(
    (acc, d) => {
      const pct = d.value / total;
      const start = acc.length > 0 ? acc[acc.length - 1].start + acc[acc.length - 1].pct : 0;
      return [...acc, { ...d, start, pct }];
    },
    []
  );

  const size = 128;
  const cx = size / 2;
  const cy = size / 2;
  const r = 48;

  function polarToCartesian(angle: number) {
    const rad = (angle - 0.25) * 2 * Math.PI;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {segments.map((seg, i) => {
        if (seg.pct === 0) return null;
        if (seg.pct >= 1) {
          return <circle key={i} cx={cx} cy={cy} r={r} fill={seg.color} />;
        }
        const start = polarToCartesian(seg.start);
        const end = polarToCartesian(seg.start + seg.pct);
        const largeArc = seg.pct > 0.5 ? 1 : 0;
        const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
        return <path key={i} d={d} fill={seg.color} />;
      })}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="bold" fill="#1e293b">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#94a3b8">
        总任务
      </text>
    </svg>
  );
}

const PIE_COLORS: Record<Quadrant, string> = {
  Q1: '#ef4444',
  Q2: '#6366f1',
  Q3: '#f59e0b',
  Q4: '#94a3b8',
};

export default function ReviewView() {
  const { tasks } = useTaskContext();

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const overdue = tasks.filter((t) => t.status === 'overdue').length;
    const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byQuadrant = QUADRANTS.map((q) => ({
      quadrant: q,
      total: tasks.filter((t) => t.quadrant === q).length,
      completed: tasks.filter((t) => t.quadrant === q && t.status === 'completed').length,
    }));

    const pieData = QUADRANTS.map((q) => ({
      label: QUADRANT_META[q].label,
      value: tasks.filter((t) => t.quadrant === q).length,
      color: PIE_COLORS[q],
    }));

    const manualChanges = tasks.filter((t) => t.manuallyChanged).length;
    const aiAccuracy = total > 0 ? Math.round(((total - manualChanges) / total) * 100) : 100;

    return { total, completed, overdue, pending, completionRate, byQuadrant, pieData, aiAccuracy, manualChanges };
  }, [tasks]);

  const suggestions = useMemo(() => {
    const tips: string[] = [];
    const q2Count = tasks.filter((t) => t.quadrant === 'Q2' && t.status !== 'completed').length;
    const q1Count = tasks.filter((t) => t.quadrant === 'Q1' && t.status !== 'completed').length;
    const q4Count = tasks.filter((t) => t.quadrant === 'Q4').length;

    if (q1Count > 5) tips.push('象限 I 任务过多，建议检查是否可以提前规划，将部分转化为象限 II');
    if (q2Count < 2 && stats.total > 3) tips.push('象限 II （重要不紧急）投入偏少，建议安排固定时段处理重要事项');
    if (q4Count > stats.total * 0.3 && stats.total > 0) tips.push('象限 IV 任务占比较高，建议减少或删除这类任务');
    if (stats.overdue > 0) tips.push(`有 ${stats.overdue} 个任务已超期，建议尽快重新安排或删除`);
    if (stats.completionRate >= 80) tips.push('今日完成率较高，表现优秀！继续保持这个势头');
    if (tips.length === 0) tips.push('任务分配均衡，继续保持良好的时间管理习惯');

    return tips;
  }, [tasks, stats]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">复盘统计</h1>
          <p className="text-sm text-slate-500 mt-1">了解今日时间分配与效率表现</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: '总任务数', value: stats.total, icon: Clock, color: 'text-slate-700', bg: 'bg-white' },
            { label: '已完成', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '已延期', value: stats.overdue, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
            { label: 'AI 准确率', value: `${stats.aiAccuracy}%`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`${bg} border border-slate-200 rounded-xl p-4 flex flex-col gap-2`}>
              <Icon className={`w-5 h-5 ${color}`} />
              <span className={`text-2xl font-bold ${color}`}>{value}</span>
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Pie chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">四象限任务占比</h3>
            <PieChart data={stats.pieData} />
            <div className="grid grid-cols-2 gap-2 mt-4">
              {QUADRANTS.map((q) => {
                const meta = QUADRANT_META[q];
                const count = stats.byQuadrant.find((b) => b.quadrant === q)?.total || 0;
                return (
                  <div key={q} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[q] }} />
                    <span className="text-xs text-slate-600 truncate">{meta.label}</span>
                    <span className="text-xs font-bold text-slate-700 ml-auto">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quadrant breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">各象限完成情况</h3>
            <div className="space-y-3">
              {stats.byQuadrant.map(({ quadrant, total, completed }) => {
                const meta = QUADRANT_META[quadrant];
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <div key={quadrant}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-semibold ${meta.textColor}`}>{meta.label}</span>
                      <span className="text-xs text-slate-500">{completed}/{total} 完成</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${meta.bgColor.replace('bg-', 'bg-').replace('-50', '-400')}`}
                        style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[quadrant] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completion rate */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-700">总完成率</span>
                <span className="text-xs font-bold text-emerald-600">{stats.completionRate}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            AI 个性化建议
          </h3>
          <div className="space-y-2">
            {suggestions.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                <span className="text-amber-500 text-xs font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                <p className="text-xs text-slate-600 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <OmniflowBadge />
      <Toaster />
    </div>
  );
}
