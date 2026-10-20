import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { TaskProvider } from './contexts/TaskContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ReminderManager from './components/custom/ReminderManager';
import Index from './pages/Index';
import ScheduleView from './pages/ScheduleView';
import ReviewView from './pages/ReviewView';
import Settings from './pages/Settings';
import Auth from './pages/Auth';

/**
 * 路由守卫：未登录访问业务页面时跳转到 /auth，
 * 并记录来源路径，登录成功后回到原页面。
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

/**
 * 任务 Provider 以用户 id 作为 key：登录 / 退出 / 切换账号时
 * 整体重挂载，确保任务数据从对应用户的存储键重新加载，
 * 避免上一个登录态的任务数据串入当前账号。
 */
function TaskProviderWithUser({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <TaskProvider key={user?.id ?? 'anonymous'}>{children}</TaskProvider>;
}

/**
 * 应用根组件
 * ------------------------------------------------------------------
 * Provider 层级（由外到内）：
 *  SettingsProvider    —— 用户头像 / 昵称 / 提醒偏好（localStorage 持久化）
 *    AuthProvider      —— 登录态（JWT + 用户信息，localStorage 持久化）
 *      TaskProviderWithUser —— 任务业务逻辑（数据按登录用户隔离存储）
 *        ReminderManager —— 全局弹窗提醒调度器（无 UI 占位，仅负责提醒）
 *        Routes          —— 登录页 / 工作台 / 日程表 / 复盘统计 / 设置
 */
const App = () => (
  <HashRouter>
    <SettingsProvider>
      <AuthProvider>
        <TaskProviderWithUser>
          {/* 任务即将开始 / 已超期时自动弹出提醒 */}
          <ReminderManager />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<RequireAuth><Index /></RequireAuth>} />
            <Route path="/schedule" element={<RequireAuth><ScheduleView /></RequireAuth>} />
            <Route path="/review" element={<RequireAuth><ReviewView /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          </Routes>
        </TaskProviderWithUser>
      </AuthProvider>
    </SettingsProvider>
  </HashRouter>
);

export default App;
