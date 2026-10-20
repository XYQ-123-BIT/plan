import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/use-localStorage';

/**
 * 全局用户设置模块
 * ------------------------------------------------------------------
 * 负责管理：昵称、头像（预设 emoji / 本地上传图片）、任务提醒偏好。
 * 所有设置通过 localStorage 持久化，刷新页面后依然保留。
 */

/** 头像数据：emoji 预设头像，或用户上传的本地图片（dataURL） */
export type AvatarData =
  | { type: 'emoji'; emoji: string; bg: string }
  | { type: 'image'; src: string };

/** 用户设置数据结构 */
export interface UserSettings {
  /** 用户昵称（用于头像兜底文案与菜单展示） */
  nickname: string;
  /** 当前头像 */
  avatar: AvatarData;
  /** 弹窗提醒总开关 */
  remindersEnabled: boolean;
  /** 提前多少分钟提醒任务开始 */
  leadMinutes: number;
  /** 任务超过计划结束时间时是否提醒 */
  overdueReminder: boolean;
  /** 是否同时发送浏览器系统通知 */
  browserNotification: boolean;
}

/** 默认设置（首次使用或恢复默认时生效） */
export const DEFAULT_SETTINGS: UserSettings = {
  nickname: '',
  avatar: {
    type: 'emoji',
    emoji: '🦊',
    bg: 'bg-gradient-to-br from-amber-400 to-orange-500',
  },
  remindersEnabled: true,
  leadMinutes: 10,
  overdueReminder: true,
  browserNotification: false,
};

interface SettingsContextValue {
  settings: UserSettings;
  /** 局部更新设置（自动合并并持久化） */
  updateSettings: (patch: Partial<UserSettings>) => void;
  /** 恢复全部默认设置 */
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // 复用项目已有的 localStorage Hook，与既有代码风格保持一致
  const [storedSettings, setStoredSettings] = useLocalStorage<UserSettings>(
    'omniflow_settings_v1',
    DEFAULT_SETTINGS
  );

  // 与默认值做一层合并，避免旧版本数据缺少新增字段时页面报错
  const settings: UserSettings = { ...DEFAULT_SETTINGS, ...storedSettings };

  /** 合并式更新，调用方式：updateSettings({ nickname: '小明' }) */
  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      setStoredSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch }));
    },
    [setStoredSettings]
  );

  /** 恢复默认设置（不影响任务数据） */
  const resetSettings = useCallback(() => {
    setStoredSettings(DEFAULT_SETTINGS);
  }, [setStoredSettings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

/** 在任意子组件中读取 / 修改用户设置 */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
