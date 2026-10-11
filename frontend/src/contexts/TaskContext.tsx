import { createContext, useContext, ReactNode } from 'react';
import { useTasks } from '@/hooks/useTasks';

type TaskContextType = ReturnType<typeof useTasks>;

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const taskState = useTasks();
  return <TaskContext.Provider value={taskState}>{children}</TaskContext.Provider>;
}

export function useTaskContext(): TaskContextType {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTaskContext must be used within TaskProvider');
  return ctx;
}
