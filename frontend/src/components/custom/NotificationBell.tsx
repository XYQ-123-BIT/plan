import { Link } from 'react-router-dom';
import { AlertCircle, Bell, Clock, Settings as SettingsIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTaskContext } from '@/contexts/TaskContext';
import { useSettings } from '@/contexts/SettingsContext';
import { QUADRANT_META } from '../../../../shared/types/tasks';
import type { Task } from '../../../../shared/types/tasks';

/**
 * 导航栏铃铛：通知中心
 * ------------------------------------------------------------------
 * 聚合展示今日与任务提醒相关的信息：
 *  - 已超期任务（红色）
 *  - 即将开始任务（提前提醒时间窗口内）
 *  - 接下来的待办任务（按开始时间升序，最多 5 条）
 * 点击铃铛展开下拉面板；红点角标显示需要关注的任务数量。
 */

/** "HH:mm" 转当天分钟数 */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 单条通知行 */
function NotificationRow({ task, state }: { task: Task; state: 'overdue' | 'soon' | 'upcoming' }) {
  const meta = QUADRANT_META[task.quadrant];
  const styles = {
    overdue: { icon: AlertCircle, iconClass: 'text-red-500', tag: '已超期', tagClass: 'bg-red-50 text-red-600' },
    soon: { icon: Bell, iconClass: 'text-indigo-500', tag: '即将开始', tagClass: 'bg-indigo-50 text-indigo-600' },
    upcoming: { icon: Clock, iconClass: 'text-slate-400', tag: meta.label, tagClass: `${meta.bgColor} ${meta.textColor}` },
  }[state];
  const Icon = styles.icon;

  return (
    <DropdownMenuItem className="cursor-pointer py-2.5 focus:bg-slate-50" asChild>
      <Link to="/schedule" className="flex items-start gap-2.5">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.iconClass}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400">
              {task.scheduledStart}–{task.scheduledEnd}
            </span>
            <span className={`text-[10px] px-1.5 py-px rounded-full font-semibold ${styles.tagClass}`}>
              {styles.tag}
            </span>
          </div>
        </div>
      </Link>
    </DropdownMenuItem>
  );
}

export default function NotificationBell() {
  const { tasks } = useTaskContext();
  const { settings } = useSettings();

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  // 只统计今天已排期且未完成的任务
  const scheduled = tasks.filter(
    (t) => t.status !== 'completed' && t.scheduledStart && t.scheduledEnd
  );

  const overdueTasks = scheduled.filter((t) => nowMinutes > toMinutes(t.scheduledEnd!));
  const soonTasks = scheduled.filter((t) => {
    const start = toMinutes(t.scheduledStart!);
    return start - settings.leadMinutes <= nowMinutes && start >= nowMinutes;
  });
  const upcomingTasks = scheduled
    .filter((t) => toMinutes(t.scheduledStart!) > nowMinutes)
    .sort((a, b) => toMinutes(a.scheduledStart!) - toMinutes(b.scheduledStart!))
    .slice(0, 5);

  // 角标：超期 + 即将开始
  const attentionCount = overdueTasks.length + soonTasks.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          aria-label="通知"
        >
          <Bell className="w-5 h-5" />
          {attentionCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {attentionCount > 9 ? '9+' : attentionCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-semibold text-slate-800">通知提醒</span>
          {attentionCount > 0 && (
            <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">
              {attentionCount} 条待关注
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />

        <div className="max-h-80 overflow-y-auto py-1">
          {/* 提醒被关闭时给出引导 */}
          {!settings.remindersEnabled && (
            <div className="mx-2 my-1.5 p-2.5 rounded-lg bg-amber-50 text-[11px] text-amber-700 leading-relaxed">
              弹窗提醒已关闭，可在设置页重新开启。
            </div>
          )}

          {overdueTasks.map((task) => (
            <NotificationRow key={`over-${task.id}`} task={task} state="overdue" />
          ))}
          {soonTasks.map((task) => (
            <NotificationRow key={`soon-${task.id}`} task={task} state="soon" />
          ))}
          {upcomingTasks.map((task) => (
            <NotificationRow key={`up-${task.id}`} task={task} state="upcoming" />
          ))}

          {attentionCount === 0 && upcomingTasks.length === 0 && (
            <div className="flex flex-col items-center py-8 text-slate-300">
              <Bell className="w-8 h-8 mb-2" />
              <p className="text-xs text-slate-400">暂无提醒，一切井然有序</p>
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/settings" className="flex items-center gap-2 py-2.5 text-slate-500">
            <SettingsIcon className="w-4 h-4" />
            <span className="text-xs">提醒设置</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
