import { HashRouter, Routes, Route } from 'react-router-dom';
import { TaskProvider } from './contexts/TaskContext';
import { SettingsProvider } from './contexts/SettingsContext';
import ReminderManager from './components/custom/ReminderManager';
import Index from './pages/Index';
import ScheduleView from './pages/ScheduleView';
import ReviewView from './pages/ReviewView';
import Settings from './pages/Settings';

/**
 * 应用根组件
 * ------------------------------------------------------------------
 * Provider 层级（由外到内）：
 *  SettingsProvider —— 用户头像 / 昵称 / 提醒偏好（localStorage 持久化）
 *    TaskProvider   —— 原有任务业务逻辑（保持不变）
 *      ReminderManager —— 全局弹窗提醒调度器（无 UI 占位，仅负责提醒）
 *      Routes         —— 工作台 / 日程表 / 复盘统计 / 设置
 */
const App = () => (
  <HashRouter>
    <SettingsProvider>
      <TaskProvider>
        {/* 任务即将开始 / 已超期时自动弹出提醒 */}
        <ReminderManager />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/schedule" element={<ScheduleView />} />
          <Route path="/review" element={<ReviewView />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </TaskProvider>
    </SettingsProvider>
  </HashRouter>
);

export default App;
