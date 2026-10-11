import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { Task, Quadrant, AIClassifyResponse } from '../../../shared/types/tasks';

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function scheduleTasksForDay(tasks: Task[]): Task[] {
  // Work slots: 08:30-12:00, 14:00-22:00
  const slots = [
    { start: 8 * 60 + 30, end: 12 * 60 },
    { start: 14 * 60, end: 22 * 60 },
  ];

  const quadrantOrder: Quadrant[] = ['Q1', 'Q2', 'Q3', 'Q4'];
  const pending = tasks
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => quadrantOrder.indexOf(a.quadrant) - quadrantOrder.indexOf(b.quadrant));

  let slotIdx = 0;
  let cursor = slots[0].start;
  const GAP = 5;

  const scheduled: Task[] = [];

  for (const task of pending) {
    const dur = task.durationMinutes;
    let placed = false;

    while (slotIdx < slots.length) {
      const slot = slots[slotIdx];
      if (cursor < slot.start) cursor = slot.start;
      if (cursor + dur <= slot.end) {
        const startH = Math.floor(cursor / 60).toString().padStart(2, '0');
        const startM = (cursor % 60).toString().padStart(2, '0');
        const endMin = cursor + dur;
        const endH = Math.floor(endMin / 60).toString().padStart(2, '0');
        const endM = (endMin % 60).toString().padStart(2, '0');
        scheduled.push({ ...task, scheduledStart: `${startH}:${startM}`, scheduledEnd: `${endH}:${endM}` });
        cursor += dur + GAP;
        placed = true;
        break;
      } else {
        slotIdx++;
        if (slotIdx < slots.length) cursor = slots[slotIdx].start;
      }
    }

    if (!placed) {
      scheduled.push({ ...task, scheduledStart: undefined, scheduledEnd: undefined });
    }
  }

  // Merge completed tasks back
  const completed = tasks.filter((t) => t.status === 'completed');
  return [...scheduled, ...completed];
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [pendingResult, setPendingResult] = useState<AIClassifyResponse | null>(null);

  const classifyTask = useCallback(async (input: string) => {
    if (!input.trim()) return;
    setIsClassifying(true);
    try {
      const res = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Classification failed');
      setPendingResult(json.data as AIClassifyResponse);
    } catch (err) {
      toast.error('AI 识别失败，请手动填写');
      // Provide a fallback manual entry
      setPendingResult({
        title: input.trim(),
        quadrant: 'Q1',
        importanceScore: 70,
        urgencyScore: 70,
        durationMinutes: 30,
        deadline: undefined,
        reasoning: '识别失败，请手动调整象限',
      });
    } finally {
      setIsClassifying(false);
    }
  }, []);

  const confirmTask = useCallback((result: AIClassifyResponse) => {
    const newTask: Task = {
      id: generateId(),
      title: result.title,
      quadrant: result.quadrant,
      status: 'pending',
      durationMinutes: result.durationMinutes,
      deadline: result.deadline,
      importanceScore: result.importanceScore,
      urgencyScore: result.urgencyScore,
      aiReasoning: result.reasoning,
      manuallyChanged: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => {
      const updated = [...prev, newTask];
      return scheduleTasksForDay(updated);
    });
    setPendingResult(null);
    toast.success(`任务已加入 ${result.quadrant === 'Q1' ? '象限 I' : result.quadrant === 'Q2' ? '象限 II' : result.quadrant === 'Q3' ? '象限 III' : '象限 IV'}`);
  }, []);

  const cancelPending = useCallback(() => setPendingResult(null), []);

  const completeTask = useCallback((id: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => t.id === id ? { ...t, status: 'completed' as const } : t);
      return scheduleTasksForDay(updated);
    });
    toast.success('任务已完成 🎉');
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      return scheduleTasksForDay(updated);
    });
  }, []);

  const changeQuadrant = useCallback((id: string, quadrant: Quadrant) => {
    setTasks((prev) => {
      const updated = prev.map((t) => t.id === id ? { ...t, quadrant, manuallyChanged: true } : t);
      return scheduleTasksForDay(updated);
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
    toast.success('已清空完成任务');
  }, []);

  return {
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
  };
}
