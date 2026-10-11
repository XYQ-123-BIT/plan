import { useEffect, useRef, useState } from 'react';
import { AlarmClock, BellRing, TimerOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTaskContext } from '@/contexts/TaskContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { Task } from '../../../../shared/types/tasks';

/**
 * 全局弹窗提醒调度器
 * ------------------------------------------------------------------
 * 挂载在 App 根部（仅一个实例），每 20 秒扫描一次今日任务：
 *  - 到达「开始时间 - 提前提醒分钟数」时，弹出「任务即将开始」提醒；
 *  - 当前时间超过任务计划结束时间且未完成时，弹出「任务已超期」提醒。
 * 同一条任务的每类提醒每天最多弹出一次（记录在 localStorage），
 * 弹窗同时会发送 sonner 轻提示；若用户开启了浏览器系统通知，也会一并推送。
 */

/** 一条待展示的提醒 */
interface ReminderAlert {
  /** 去重键：soon:task_xxx / overdue:task_xxx */
  key: string;
  kind: 'soon' | 'overdue';
  task: Task;
}

const STORE_KEY = 'omniflow_fired_reminders_v1';
/** 轮询间隔（毫秒） */
const CHECK_INTERVAL = 20 * 1000;
/** 「即将开始」提醒在开始后 2 分钟内仍允许弹出，避免轮询恰好错过 */
const SOON_GRACE_MINUTES = 2;

/** 今日日期字符串，用于让去重记录按天自动失效 */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** "HH:mm" 转当天分钟数 */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 读取今天已经弹过的提醒键集合（跨天自动清空） */
function loadFiredKeys(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    if (raw && raw.date === todayStr() && Array.isArray(raw.keys)) {
      return new Set(raw.keys as string[]);
    }
  } catch {
    // 数据损坏时按「今天还没弹过」处理
  }
  return new Set();
}

/** 持久化今天已弹过的提醒键 */
function saveFiredKeys(keys: Set<string>) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ date: todayStr(), keys: [...keys] }));
}

export default function ReminderManager() {
  const { tasks, completeTask } = useTaskContext();
  const { settings } = useSettings();
  // 已弹过的提醒（ref 变化不需要触发渲染）
  const firedRef = useRef<Set<string>>(loadFiredKeys());
  // 等待弹窗展示的提醒队列（一次只展示最前面的一条）
  const [queue, setQueue] = useState<ReminderAlert[]>([]);

  useEffect(() => {
    // 总开关关闭时不进行任何扫描
    if (!settings.remindersEnabled) return;

    const check = () => {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const newAlerts: ReminderAlert[] = [];

      tasks.forEach((task) => {
        if (task.status === 'completed' || !task.scheduledStart || !task.scheduledEnd) return;

        const start = toMinutes(task.scheduledStart);
        const end = toMinutes(task.scheduledEnd);

        // 1) 任务即将开始
        const soonKey = `soon:${task.id}`;
        const inSoonWindow =
          start - settings.leadMinutes <= nowMinutes &&
          nowMinutes <= start + SOON_GRACE_MINUTES;
        if (inSoonWindow && !firedRef.current.has(soonKey)) {
          firedRef.current.add(soonKey);
          newAlerts.push({ key: soonKey, kind: 'soon', task });
        }

        // 2) 任务已超期
        const overdueKey = `overdue:${task.id}`;
        if (
          settings.overdueReminder &&
          nowMinutes > end &&
          !firedRef.current.has(overdueKey)
        ) {
          firedRef.current.add(overdueKey);
          newAlerts.push({ key: overdueKey, kind: 'overdue', task });
        }
      });

      if (newAlerts.length === 0) return;

      saveFiredKeys(firedRef.current);
      setQueue((prev) => [...prev, ...newAlerts]);

      // 每条提醒同时发送一条右上角轻提示
      newAlerts.forEach((alert) => {
        toast(alert.kind === 'soon' ? '任务即将开始' : '任务已超期', {
          description: `${alert.task.title}（${alert.task.scheduledStart}–${alert.task.scheduledEnd}）`,
          action: {
            label: '查看日程',
            onClick: () => {
              // HashRouter 下通过 hash 跳转日程表
              window.location.hash = '#/schedule';
            },
          },
        });
      });

      // 可选：发送浏览器系统通知（需用户已授权）
      if (
        settings.browserNotification &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        newAlerts.forEach((alert) => {
          new Notification(alert.kind === 'soon' ? 'Omniflow：任务即将开始' : 'Omniflow：任务已超期', {
            body: `${alert.task.title}（${alert.task.scheduledStart}–${alert.task.scheduledEnd}）`,
          });
        });
      }
    };

    // 任务变化或设置变化时立即检查一次，再定时轮询
    check();
    const timer = window.setInterval(check, CHECK_INTERVAL);
    return () => window.clearInterval(timer);
  }, [
    tasks,
    settings.remindersEnabled,
    settings.leadMinutes,
    settings.overdueReminder,
    settings.browserNotification,
  ]);

  /** 关闭当前弹窗（队列中还有则自动展示下一条） */
  const handleDismiss = () => setQueue((prev) => prev.slice(1));

  /** 直接把当前提醒的任务标记完成 */
  const handleComplete = () => {
    const current = queue[0];
    if (current) completeTask(current.task.id);
    handleDismiss();
  };

  const current = queue[0];

  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && handleDismiss()}>
      {current && (
        <DialogContent className="max-w-sm">
          <DialogHeader className="items-center text-center">
            {/* 提醒图标 */}
            <span
              className={`w-14 h-14 rounded-full flex items-center justify-center mb-1 ${
                current.kind === 'soon'
                  ? 'bg-indigo-50 text-indigo-500'
                  : 'bg-red-50 text-red-500'
              }`}
            >
              {current.kind === 'soon' ? (
                <BellRing className="w-7 h-7" />
              ) : (
                <TimerOff className="w-7 h-7" />
              )}
            </span>
            <DialogTitle className="text-lg">
              {current.kind === 'soon' ? '任务即将开始' : '任务已超期'}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              <span className="font-semibold text-slate-700">{current.task.title}</span>
              <br />
              <span className="inline-flex items-center gap-1 mt-1">
                <AlarmClock className="w-3.5 h-3.5" />
                计划时间：{current.task.scheduledStart}–{current.task.scheduledEnd}
                {current.kind === 'soon'
                  ? `（提前 ${settings.leadMinutes} 分钟提醒）`
                  : '（已超过结束时间）'}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Button className="flex-1 cursor-pointer" onClick={handleComplete}>
              标记完成
            </Button>
            <Button variant="outline" className="flex-1 cursor-pointer" onClick={handleDismiss}>
              知道了
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
