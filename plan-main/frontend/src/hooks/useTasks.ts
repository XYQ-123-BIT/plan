import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { Task, Quadrant, ParsedTask } from '../../../shared/types/tasks';
import type { User } from '../../../shared/types/auth';
import { parseTasks } from '../../../shared/parser/nlpParser';
import { useAuth } from '@/contexts/AuthContext';

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** 升级前的全局任务存储键（仅用于一次性迁移旧数据） */
const LEGACY_STORAGE_KEY = 'omniflow_tasks_v2';

/** 按登录用户隔离任务存储键：每个账号看到自己的任务 */
function storageKeyFor(user: User | null): string {
  return user ? `omniflow_tasks_v2__${user.id}` : 'omniflow_tasks_v2__anonymous';
}

/**
 * 从 localStorage 恢复任务（本地运行时的持久化方案）。
 * 首次以账号身份加载时，把升级前的全局任务数据迁移到该账号名下（仅一次）。
 */
function loadTasks(key: string, userId: string | null): Task[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }

    // 一次性迁移：老版本的通用数据搬进当前账号的存储键
    if (userId && !localStorage.getItem(`omniflow_tasks_migrated__${userId}`)) {
      localStorage.setItem(`omniflow_tasks_migrated__${userId}`, '1');
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // 数据损坏时按空任务处理
  }
  return [];
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * 将「截止时间为今天」的待办任务按象限优先级排进今日时间轴。
 * 工作时段：08:30-12:00、14:00-22:00；排期起点不早于当前时间，
 * 因此所有计划任务都落在当前时间之后。
 * 延期任务与未来日期的任务不参与今日排期（在日程页单独展示）。
 */
function scheduleTasksForDay(tasks: Task[], now: Date = new Date()): Task[] {
  const slots = [
    { start: 8 * 60 + 30, end: 12 * 60 },
    { start: 14 * 60, end: 22 * 60 },
  ];

  const quadrantOrder: Quadrant[] = ['Q1', 'Q2', 'Q3', 'Q4'];
  const dueToday = (t: Task) =>
    t.status === 'pending' && t.deadlineAt && isSameDay(new Date(t.deadlineAt), now);

  const pending = tasks
    .filter(dueToday)
    .sort((a, b) => quadrantOrder.indexOf(a.quadrant) - quadrantOrder.indexOf(b.quadrant));

  const nowMinutes = now.getHours() * 60 + now.getMinutes() + 5; // 5 分钟缓冲
  // 排期游标不早于当前时间，保证所有计划任务都落在当前时间之后
  let slotIdx = 0;
  let cursor = Math.max(slots[0].start, nowMinutes);
  const GAP = 5;

  const scheduledIds = new Map<string, { scheduledStart: string; scheduledEnd: string }>();

  for (const task of pending) {
    const dur = task.durationMinutes;
    let placed = false;

    while (slotIdx < slots.length) {
      const slot = slots[slotIdx];
      if (cursor < slot.start) cursor = slot.start;
      if (cursor + dur <= slot.end) {
        const fmt = (mins: number) =>
          `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
        scheduledIds.set(task.id, { scheduledStart: fmt(cursor), scheduledEnd: fmt(cursor + dur) });
        cursor += dur + GAP;
        placed = true;
        break;
      }
      slotIdx++;
    }

    if (!placed) scheduledIds.delete(task.id);
  }

  return tasks.map((t) => {
    const sched = scheduledIds.get(t.id);
    if (sched) return { ...t, ...sched };
    // 非今日任务 / 未排入的任务清空旧的排期
    return { ...t, scheduledStart: undefined, scheduledEnd: undefined };
  });
}

export function useTasks() {
  const { user } = useAuth();
  // 任务存储键跟随登录用户（切换账号互不可见）
  const storageKey = storageKeyFor(user);
  const [tasks, setTasks] = useState<Task[]>(() =>
    scheduleTasksForDay(loadTasks(storageKey, user?.id ?? null)),
  );
  const [isClassifying, setIsClassifying] = useState(false);
  const [pendingResults, setPendingResults] = useState<ParsedTask[]>([]);

  // 任务变化时持久化到 localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  }, [tasks, storageKey]);

  // 每 30 秒扫描一次：截止时间已过且仍未完成的任务自动翻转为「已延期」
  useEffect(() => {
    const flipOverdue = () => {
      const now = Date.now();
      setTasks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (t.status === 'pending' && t.deadlineAt && new Date(t.deadlineAt).getTime() < now) {
            changed = true;
            return { ...t, status: 'overdue' as const };
          }
          return t;
        });
        return changed ? next : prev;
      });
    };
    flipOverdue();
    const timer = window.setInterval(flipOverdue, 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  /** 提交自然语言输入：优先走后端 /api/ai/parse，失败时用前端内置解析器兜底 */
  const classifyTask = useCallback(async (input: string) => {
    if (!input.trim()) return;
    setIsClassifying(true);
    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Parse failed');
      const parsed = json.data.tasks as ParsedTask[];
      if (!parsed || parsed.length === 0) throw new Error('Empty result');
      setPendingResults(parsed);
    } catch {
      // 后端不可用时使用同一套内置解析器（shared/parser/nlpParser.ts）本地解析
      const parsed = parseTasks(input.trim(), new Date());
      setPendingResults(parsed);
      toast.info('已使用内置解析器完成识别');
    } finally {
      setIsClassifying(false);
    }
  }, []);

  /** 将一条解析结果加入看板（index 为待确认列表下标） */
  const confirmTask = useCallback((index: number, result: ParsedTask) => {
    const newTask: Task = {
      id: generateId(),
      title: result.title,
      quadrant: result.quadrant,
      status: result.isOverdue ? 'overdue' : 'pending',
      durationMinutes: result.durationMinutes,
      deadline: result.deadlineText,
      deadlineAt: result.deadlineAt,
      timeNote: result.timeNote,
      importanceScore: result.importanceScore,
      urgencyScore: result.urgencyScore,
      aiReasoning: result.reasoning,
      manuallyChanged: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => scheduleTasksForDay([...prev, newTask]));
    setPendingResults((prev) => prev.filter((_, i) => i !== index));
    if (result.isOverdue) {
      toast.warning(`「${result.title}」已标记为延期任务`);
    } else if (result.timeAdjusted) {
      toast.info(`「${result.title}」时间已自动顺延`, { description: result.timeNote });
    } else {
      toast.success(`任务已加入${result.quadrant === 'Q1' ? '象限 I' : result.quadrant === 'Q2' ? '象限 II' : result.quadrant === 'Q3' ? '象限 III' : '象限 IV'}`);
    }
  }, []);

  /** 忽略待确认列表中的某一条 */
  const dismissPending = useCallback((index: number) => {
    setPendingResults((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** 一键加入全部解析结果 */
  const confirmAll = useCallback((results: ParsedTask[]) => {
    results.forEach((r) => {
      const newTask: Task = {
        id: generateId(),
        title: r.title,
        quadrant: r.quadrant,
        status: r.isOverdue ? 'overdue' : 'pending',
        durationMinutes: r.durationMinutes,
        deadline: r.deadlineText,
        deadlineAt: r.deadlineAt,
        timeNote: r.timeNote,
        importanceScore: r.importanceScore,
        urgencyScore: r.urgencyScore,
        aiReasoning: r.reasoning,
        manuallyChanged: false,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, newTask]);
    });
    setTasks((prev) => scheduleTasksForDay(prev));
    setPendingResults([]);
    toast.success(`已加入 ${results.length} 条任务`);
  }, []);

  const cancelPending = useCallback(() => setPendingResults([]), []);

  const completeTask = useCallback((id: string) => {
    setTasks((prev) =>
      scheduleTasksForDay(prev.map((t) => (t.id === id ? { ...t, status: 'completed' as const } : t))),
    );
    toast.success('任务已完成 🎉');
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => scheduleTasksForDay(prev.filter((t) => t.id !== id)));
  }, []);

  const changeQuadrant = useCallback((id: string, quadrant: Quadrant) => {
    setTasks((prev) =>
      scheduleTasksForDay(prev.map((t) => (t.id === id ? { ...t, quadrant, manuallyChanged: true } : t))),
    );
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
    toast.success('已清空完成任务');
  }, []);

  return {
    tasks,
    isClassifying,
    pendingResults,
    classifyTask,
    confirmTask,
    confirmAll,
    dismissPending,
    cancelPending,
    completeTask,
    deleteTask,
    changeQuadrant,
    clearCompleted,
  };
}
