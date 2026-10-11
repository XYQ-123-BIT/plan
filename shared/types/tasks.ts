// Shared domain types for the four-quadrant task planning system

export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface Task {
  id: string;
  title: string;
  quadrant: Quadrant;
  status: TaskStatus;
  durationMinutes: number;
  deadline?: string; // ISO string or human-readable
  scheduledStart?: string; // HH:mm
  scheduledEnd?: string;   // HH:mm
  importanceScore: number; // 0-100
  urgencyScore: number;    // 0-100
  aiReasoning?: string;
  manuallyChanged?: boolean;
  createdAt: string;
}

export interface AIClassifyRequest {
  input: string;
}

export interface AIClassifyResponse {
  title: string;
  quadrant: Quadrant;
  importanceScore: number;
  urgencyScore: number;
  durationMinutes: number;
  deadline?: string;
  reasoning: string;
}

export const QUADRANT_META: Record<Quadrant, { label: string; desc: string; color: string; borderColor: string; bgColor: string; textColor: string }> = {
  Q1: { label: '象限 I', desc: '重要且紧急 (立即执行)', color: 'error', borderColor: 'border-l-red-500', bgColor: 'bg-red-50', textColor: 'text-red-600' },
  Q2: { label: '象限 II', desc: '重要不紧急 (有计划执行)', color: 'primary', borderColor: 'border-l-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
  Q3: { label: '象限 III', desc: '紧急不重要 (快速处理)', color: 'accent', borderColor: 'border-l-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-600' },
  Q4: { label: '象限 IV', desc: '不重要不紧急 (减少或舍弃)', color: 'muted', borderColor: 'border-l-slate-400', bgColor: 'bg-slate-50', textColor: 'text-slate-500' },
};
