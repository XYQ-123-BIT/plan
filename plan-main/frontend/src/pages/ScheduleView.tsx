import { useState } from 'react';
import { Clock, CheckCircle2, AlertCircle, Trash2, CalendarDays } from 'lucide-react';
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

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 未来日期的中文标签：明天 / 后天 / M月D日 周X */
function futureDayLabel(date: Date, now: Date): string {
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86400000);
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  if (diff === 1) return `明天（${week}）`;
  if (diff === 2) return `后天（${week}）`;
  return `${date.getMonth() + 1}月${date.getDate()}日（${week}）`;
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
  const now = new Date();
  const todayDow = now.getDay(); // 0=Sun
  const mondayOffset = todayDow === 0 ? -6 : 1 - todayDow;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEK_DAYS.map((day, idx) => {
        const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
        const isToday = isSameDay(date, now);
        // 按截止时间落位到对应日期列；已完成任务不展示
        const dayTasks = tasks
          .filter((t) => t.status !== 'completed' && t.deadlineAt && isSameDay(new Date(t.deadlineAt), date))
          .sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime());

        return (
          <div key={day} className={`rounded-xl border p-2 min-h-[120px] ${isToday ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
            <div className={`text-xs font-semibold mb-2 text-center ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
              {day}
              <span className="block text-[9px] font-normal text-slate-400">{date.getMonth() + 1}/{date.getDate()}</span>
              {isToday && <span className="ml-1 text-[9px] bg-indigo-500 text-white px-1 rounded-full">今</span>}
            </div>
            <div className="space-y-1">
              {dayTasks.slice(0, 4).map((task) => {
                const meta = QUADRANT_META[task.quadrant];
                return (
                  <div
                    key={task.id}
                    className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${
                      task.status === 'overdue' ? 'bg-red-100 text-red-600' : `${meta.bgColor} ${meta.textColor}`
                    }`}
                  >
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

/** 延期任务单独标记区（红色卡片 + 快捷操作） */
function OverdueSection({ tasks, onComplete, onDelete }: { tasks: Task[]; onComplete: (id: string) => void; onDelete: (id: string) => void }) {
  if (tasks.length === 0) return null;
  return (
    <div className="bg-red-50 rounded-2xl border border-red-200 shadow-sm p-4 mb-6">
      <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        已延期任务
        <Badge className="bg-red-100 text-red-600 hover:bg-red-100">{tasks.length}</Badge>
      </h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between p-3 bg-white/70 rounded-lg border border-red-100">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold text-red-500">原定 {task.deadline}</span>
                <span className="text-[10px] text-slate-400">{task.durationMinutes} 分钟</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onComplete(task.id)}
                className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                aria-label="完成"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                aria-label="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScheduleView() {
  const [view, setView] = useState<'day' | 'week'>('day');
  const { tasks, completeTask, deleteTask } = useTaskContext();
  const now = new Date();

  // 延期任务：单独标记展示
  const overdue = tasks
    .filter((t) => t.status === 'overdue')
    .sort((a, b) => new Date(a.deadlineAt ?? 0).getTime() - new Date(b.deadlineAt ?? 0).getTime());

  // 未来任务：截止时间在明天及以后的正常计划任务，按截止时间排序
  const upcoming = tasks
    .filter((t) => t.status === 'pending' && t.deadlineAt && startOfDay(new Date(t.deadlineAt)).getTime() > startOfDay(now).getTime())
    .sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime());

  // 未排期任务：截止在今天但未排进时间轴（工作时段已满）
  const unscheduled = tasks.filter(
    (t) => t.status === 'pending' && !t.scheduledStart && (!t.deadlineAt || isSameDay(new Date(t.deadlineAt), now)),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">日程表</h1>
            <p className="text-sm text-slate-500 mt-1">计划任务均排在当前时间之后，延期任务单独标记</p>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as 'day' | 'week')}>
            <TabsList>
              <TabsTrigger value="day" className="cursor-pointer">日视图</TabsTrigger>
              <TabsTrigger value="week" className="cursor-pointer">周视图</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 延期任务单独标记 */}
        <OverdueSection tasks={overdue} onComplete={completeTask} onDelete={deleteTask} />

        {/* Main view */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 overflow-x-auto">
          {view === 'day' ? <DayView tasks={tasks} /> : <WeekView tasks={tasks} />}
        </div>

        {/* 未来任务（按截止时间排布） */}
        {upcoming.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              未来任务
              <Badge variant="secondary">{upcoming.length}</Badge>
            </h3>
            <div className="space-y-2">
              {upcoming.map((task) => {
                const meta = QUADRANT_META[task.quadrant];
                const d = new Date(task.deadlineAt!);
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] font-semibold ${meta.textColor}`}>{meta.label}</span>
                        <span className="text-[10px] text-indigo-500 font-medium">
                          {futureDayLabel(d, now)} {d.getHours().toString().padStart(2, '0')}:{d.getMinutes().toString().padStart(2, '0')}
                        </span>
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
