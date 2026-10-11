import { useState } from 'react';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/custom/Navbar';
import { useTaskContext } from '@/contexts/TaskContext';
import { QUADRANT_META } from '../../../shared/types/tasks';
import type { Task } from '../../../shared/types/tasks';
import OmniflowBadge from '@/components/custom/OmniflowBadge';
import { Toaster } from '@/components/ui/sonner';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 - 22:00

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function DayView({ tasks }: { tasks: Task[] }) {
  const scheduledTasks = tasks.filter((t) => t.scheduledStart && t.scheduledEnd && t.status !== 'completed');

  return (
    <div className="relative">
      {/* Time axis */}
      <div className="flex">
        {/* Hour labels */}
        <div className="w-14 flex-shrink-0">
          {HOURS.map((h) => (
            <div key={h} className="h-16 flex items-start pt-1">
              <span className="text-[10px] text-slate-400 font-medium">{h.toString().padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 relative border-l border-slate-200">
          {/* Hour lines */}
          {HOURS.map((h) => (
            <div key={h} className="h-16 border-b border-slate-100 relative">
              {/* Half-hour line */}
              <div className="absolute top-8 left-0 right-0 border-b border-dashed border-slate-100" />
            </div>
          ))}

          {/* Task blocks */}
          {scheduledTasks.map((task) => {
            const startMin = timeToMinutes(task.scheduledStart!);
            const endMin = timeToMinutes(task.scheduledEnd!);
            const topOffset = ((startMin - 7 * 60) / 60) * 64; // 64px per hour
            const height = Math.max(((endMin - startMin) / 60) * 64, 24);
            const meta = QUADRANT_META[task.quadrant];

            return (
              <div
                key={task.id}
                className={`absolute left-2 right-2 rounded-lg px-2 py-1 ${meta.bgColor} border ${meta.borderColor.replace('border-l-', 'border-')} shadow-sm overflow-hidden`}
                style={{ top: topOffset, height }}
              >
                <p className={`text-[11px] font-semibold leading-tight ${meta.textColor} truncate`}>{task.title}</p>
                <p className="text-[10px] text-slate-400">{task.scheduledStart}–{task.scheduledEnd}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function WeekView({ tasks }: { tasks: Task[] }) {
  const today = new Date().getDay(); // 0=Sun
  const dayIndex = today === 0 ? 6 : today - 1; // Mon=0

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEK_DAYS.map((day, idx) => {
        const isToday = idx === dayIndex;
        const dayTasks = idx === dayIndex ? tasks.filter((t) => t.status !== 'completed') : [];

        return (
          <div key={day} className={`rounded-xl border p-2 min-h-[120px] ${isToday ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
            <div className={`text-xs font-semibold mb-2 text-center ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
              {day}
              {isToday && <span className="ml-1 text-[9px] bg-indigo-500 text-white px-1 rounded-full">今</span>}
            </div>
            <div className="space-y-1">
              {dayTasks.slice(0, 4).map((task) => {
                const meta = QUADRANT_META[task.quadrant];
                return (
                  <div key={task.id} className={`text-[10px] px-1.5 py-0.5 rounded ${meta.bgColor} ${meta.textColor} truncate font-medium`}>
                    {task.title}
                  </div>
                );
              })}
              {dayTasks.length > 4 && (
                <div className="text-[10px] text-slate-400 text-center">+{dayTasks.length - 4} 更多</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ScheduleView() {
  const [view, setView] = useState<'day' | 'week'>('day');
  const { tasks, completeTask, deleteTask } = useTaskContext();

  const unscheduled = tasks.filter((t) => !t.scheduledStart && t.status !== 'completed');
  const overdue = tasks.filter((t) => t.status === 'overdue');

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">日程表</h1>
            <p className="text-sm text-slate-500 mt-1">查看今日和本周任务安排</p>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as 'day' | 'week')}>
            <TabsList>
              <TabsTrigger value="day" className="cursor-pointer">日视图</TabsTrigger>
              <TabsTrigger value="week" className="cursor-pointer">周视图</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{overdue.length} 个任务已超期，请尽快处理</span>
          </div>
        )}

        {/* Main view */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 overflow-x-auto">
          {view === 'day' ? <DayView tasks={tasks} /> : <WeekView tasks={tasks} />}
        </div>

        {/* Unscheduled tasks */}
        {unscheduled.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              未排期任务
              <Badge variant="secondary">{unscheduled.length}</Badge>
            </h3>
            <div className="space-y-2">
              {unscheduled.map((task) => {
                const meta = QUADRANT_META[task.quadrant];
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-semibold ${meta.textColor}`}>{meta.label}</span>
                        <span className="text-[10px] text-slate-400">{task.durationMinutes} 分钟</span>
                      </div>
                    </div>
                    <button
                      onClick={() => completeTask(task.id)}
                      className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      aria-label="完成"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">还没有任务，请在工作台输入任务</p>
          </div>
        )}
      </main>

      <OmniflowBadge />
      <Toaster />
    </div>
  );
}
