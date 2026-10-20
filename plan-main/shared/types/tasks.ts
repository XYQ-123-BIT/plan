// Shared domain types for the four-quadrant task planning system

export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface Task {
  id: string;
  title: string;
  quadrant: Quadrant;
  status: TaskStatus;
  durationMinutes: number;
  deadline?: string;    // 人类可读的截止时间（如「明天 15:00」）
  deadlineAt?: string;  // 截止时间的 ISO 8601 字符串（用于排序 / 逾期判定）
  timeNote?: string;    // 时间被自动调整时的提示说明
  scheduledStart?: string; // HH:mm
  scheduledEnd?: string;   // HH:mm
  importanceScore: number; // 0-100
  urgencyScore: number;    // 0-100
  aiReasoning?: string;
  manuallyChanged?: boolean;
  createdAt: string;
}

/**
 * 单条自然语言任务的解析结果（内置解析器输出）
 * ------------------------------------------------------------------
 * 核心时间约束：
 *  - 普通计划任务的 deadlineAt 必须晚于解析时的当前时间；
 *  - 仅当用户明确表示任务已逾期（isOverdue=true）时，deadlineAt 才允许为过去时间；
 *  - 用户口误写了过去时间但打算后续完成时，timeAdjusted=true 且 timeNote 给出说明。
 */
export interface ParsedTask {
  title: string;
  quadrant: Quadrant;
  importanceScore: number; // 0-100，>=60 视为重要
  urgencyScore: number;    // 0-100，>=60 视为紧急
  durationMinutes: number; // 预估耗时（分钟），默认 30
  deadlineAt: string;      // ISO 8601 截止时间
  deadlineText: string;    // 人类可读截止时间（如「明天 15:00」）
  isOverdue: boolean;      // 用户明确描述的逾期任务
  timeAdjusted: boolean;   // 过去时间被自动顺延到未来
  timeNote?: string;       // 顺延说明（展示给用户）
  reasoning: string;       // 判定依据说明
}

export interface AIClassifyRequest {
  input: string;
}

/** @deprecated 兼容旧字段名，等价于 ParsedTask */
export type AIClassifyResponse = ParsedTask;

/** 多任务解析接口（/api/ai/parse） */
export interface AIParseRequest {
  input: string;
}

export interface AIParseResponse {
  tasks: ParsedTask[];
}

export const QUADRANT_META: Record<Quadrant, { label: string; desc: string; color: string; borderColor: string; bgColor: string; textColor: string }> = {
  Q1: { label: '象限 I', desc: '重要且紧急 (立即执行)', color: 'error', borderColor: 'border-l-red-500', bgColor: 'bg-red-50', textColor: 'text-red-600' },
  Q2: { label: '象限 II', desc: '重要不紧急 (有计划执行)', color: 'primary', borderColor: 'border-l-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
  Q3: { label: '象限 III', desc: '紧急不重要 (快速处理)', color: 'accent', borderColor: 'border-l-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-600' },
  Q4: { label: '象限 IV', desc: '不重要不紧急 (减少或舍弃)', color: 'muted', borderColor: 'border-l-slate-400', bgColor: 'bg-slate-50', textColor: 'text-slate-500' },
};
