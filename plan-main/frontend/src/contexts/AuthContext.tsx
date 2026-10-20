import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useLocalStorage } from '@/hooks/use-localStorage';
import type { User } from '../../../shared/types/auth';

/**
 * 全局登录态模块（手机号 + 验证码登录 · 纯前端模拟版）
 * ------------------------------------------------------------------
 * 本项目部署于 GitHub Pages 静态站点，没有后端服务器，
 * 因此登录流程全部在前端完成：
 *   1. sendCode  —— 不请求任何接口，直接回传固定演示验证码（MOCK_CODE）
 *   2. login     —— 把用户输入的验证码与 MOCK_CODE 比对，一致即登录成功
 *   3. 登录态持久化 —— localStorage（键 omniflow_auth_v1），刷新页面保持登录
 * 原先后端接口 /api/auth/send-code、/api/auth/login 的调用已全部删除。
 */

/** 演示用固定验证码：与登录页提示文案保持一致，方便测试 */
export const MOCK_CODE = '123456';

/** 模拟网络耗时，让"发送中 / 登录中"的 loading 状态有真实反馈 */
const MOCK_DELAY = 400;

interface StoredAuth {
  token: string;
  user: User;
}

interface AuthContextValue {
  /** 当前登录用户（null = 未登录） */
  user: User | null;
  /** 登录凭证（纯前端模拟，仅作登录态载体，不参与真实鉴权） */
  token: string | null;
  /** 发送验证码：模拟实现，直接返回固定演示验证码 */
  sendCode: (phone: string) => Promise<string | undefined>;
  /** 验证码登录（验证码匹配即登录成功；手机号首次登录视作注册） */
  login: (phone: string, code: string) => Promise<boolean>;
  /** 退出登录（清除本地登录态，任务数据保留在对应账号的存储键下） */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** 已登录过的手机号记录键：用于区分「欢迎加入 / 欢迎回来」提示 */
const KNOWN_PHONES_KEY = 'omniflow_known_phones_v1';

/**
 * 判断是否该手机号首次登录（首次视作注册）。
 * 用 localStorage 记录历史手机号，纯前端模拟"登录即注册"的语义。
 */
function isFirstLogin(phone: string): boolean {
  try {
    const raw = window.localStorage.getItem(KNOWN_PHONES_KEY);
    const phones: string[] = raw ? JSON.parse(raw) : [];
    if (phones.includes(phone)) return false;
    phones.push(phone);
    window.localStorage.setItem(KNOWN_PHONES_KEY, JSON.stringify(phones));
    return true;
  } catch {
    // localStorage 不可用时按老用户处理，避免影响登录主流程
    return false;
  }
}

/**
 * 由手机号生成模拟用户对象。
 * id 采用手机号派生（稳定不变），保证同一手机号每次登录后
 * 任务数据都落在同一个存储键下，不会因为重新登录而丢任务。
 */
function createMockUser(phone: string): User {
  return {
    id: `u_${phone}`,
    phone,
    nickname: `用户${phone.slice(-4)}`,
    createdAt: new Date().toISOString(),
  };
}

/** 等待指定毫秒（模拟请求延迟） */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<StoredAuth | null>('omniflow_auth_v1', null);

  const user = stored?.user ?? null;
  const token = stored?.token ?? null;

  /** 发送验证码（纯前端模拟：不请求接口，直接返回固定验证码） */
  const sendCode = useCallback(async (phone: string): Promise<string | undefined> => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new Error('请输入正确的 11 位手机号');
    }
    await delay(MOCK_DELAY);
    // 返回固定演示验证码，由登录页用 toast 展示
    return MOCK_CODE;
  }, []);

  /** 验证码登录（纯前端模拟：验证码匹配即成功） */
  const login = useCallback(
    async (phone: string, code: string): Promise<boolean> => {
      await delay(MOCK_DELAY);

      // ① 手机号格式校验
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        throw new Error('请输入正确的 11 位手机号');
      }

      // ② 验证码校验：与演示固定验证码比对
      if (code !== MOCK_CODE) {
        throw new Error(`验证码错误，请输入演示验证码 ${MOCK_CODE}`);
      }

      // ③ 校验通过：生成用户并写入登录态
      const newUser = createMockUser(phone);
      const isNewUser = isFirstLogin(phone);
      setStored({ token: `mock-token-${phone}`, user: newUser });

      if (isNewUser) {
        toast.success(`欢迎加入 Omniflow AI，${newUser.nickname}！`);
      } else {
        toast.success(`欢迎回来，${newUser.nickname}`);
      }
      return isNewUser;
    },
    [setStored],
  );

  /** 退出登录 */
  const logout = useCallback(() => {
    setStored(null);
    toast.success('已退出登录');
  }, [setStored]);

  return (
    <AuthContext.Provider value={{ user, token, sendCode, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** 在任意组件中读取登录态 / 执行登录登出 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
