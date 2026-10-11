import { CheckCircle2, Clock, Trash2, MoreHorizontal } from 'lucide-react';
import type { Task, Quadrant } from '../../../../shared/types/tasks';
import { QUADRANT_META } from '../../../../shared/types/tasks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  tasks: Task[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeQuadrant: (id: string, q: Quadrant) => void;
}

const QUADRANTS: Quadrant[] = ['Q1', 'Q2', 'Q3', 'Q4'];

function TaskCard({
  task,
  onComplete,
  onDelete,
  onChangeQuadrant,
}: {
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeQuadrant: (id: string, q: Quadrant) => void;
}) {
  const meta = QUADRANT_META[task.quadrant];
  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`group p-3 bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all ${
        isCompleted ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm leading-snug ${isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.deadline && (
              <span className={`text-[10px] font-semibold ${meta.textColor}`}>{task.deadline}</span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Clock className="w-3 h-3" />
              {task.durationMinutes} 分钟
            </span>
            {task.scheduledStart && (
              <span className="text-[10px] text-slate-400">{task.scheduledStart}–{task.scheduledEnd}</span>
            )}
            {task.manuallyChanged && (
              <span className="text-[10px] bg-amber-100 text-amber-600 px-1 rounded">手动</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isCompleted && (
            <button
              onClick={() => onComplete(task.id)}
              className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
              title="完成"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors cursor-pointer">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-sm">
              {QUADRANTS.filter((q) => q !== task.quadrant).map((q) => (
                <DropdownMenuItem key={q} onClick={() => onChangeQuadrant(task.id, q)}>
                  移到 {QUADRANT_META[q].label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onClick={() => onDelete(task.id)}
                className="text-red-500 focus:text-red-500"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export default function QuadrantBoard({ tasks, onComplete, onDelete, onChangeQuadrant }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {QUADRANTS.map((q) => {
        const meta = QUADRANT_META[q];
        const qTasks = tasks.filter((t) => t.quadrant === q);
        const activeTasks = qTasks.filter((t) => t.status !== 'completed');
        const completedTasks = qTasks.filter((t) => t.status === 'completed');

        return (
          <div
            key={q}
            className={`border-l-4 ${meta.borderColor} border border-slate-200 rounded-xl p-5 bg-white transition-shadow hover:shadow-md`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className={`font-bold ${meta.textColor}`}>{meta.label}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{meta.desc}</p>
              </div>
              <span className={`${meta.bgColor} ${meta.textColor} text-[10px] px-2 py-0.5 rounded-full font-bold`}>
                {activeTasks.length} 任务
              </span>
            </div>

            <div className="space-y-2">
              {activeTasks.length === 0 && completedTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-slate-300">
                  <CheckCircle2 className="w-7 h-7 mb-1" />
                  <p className="text-xs">暂无任务</p>
                </div>
              )}
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onChangeQuadrant={onChangeQuadrant}
                />
              ))}
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onChangeQuadrant={onChangeQuadrant}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
