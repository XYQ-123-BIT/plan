// 认证模块共享类型（前后端共用）—— 手机号 + 短信验证码登录

/** 公开用户信息 */
export interface User {
  id: string;
  /** 手机号（中国大陆 11 位，直接明文存储，登录即标识） */
  phone: string;
  nickname: string;
  createdAt: string;
}

/** 内部用户记录（JSON 文件存储结构，见 backend/services/userService.ts） */
export type UserRecord = User;

/** 发送验证码请求 */
export interface SendCodeRequest {
  phone: string;
}

/** 发送验证码响应
 *  devCode：仅本地演示模式返回（未配置真实短信服务商时），
 *  方便开发调试；接入短信服务后该字段不再出现。 */
export interface SendCodeResponse {
  success: boolean;
  data?: { expiresIn: number; devCode?: string };
  error?: string;
}

/** 验证码登录请求（手机号未注册时自动创建账号，即「登录即注册」） */
export interface LoginRequest {
  phone: string;
  code: string;
}

export interface AuthData {
  token: string;
  user: User;
  /** 本次登录是否为新账号（自动注册），用于前端欢迎提示 */
  isNewUser?: boolean;
}

export interface AuthResponse {
  success: boolean;
  data?: AuthData;
  error?: string;
}

export interface MeResponse {
  success: boolean;
  data?: { user: User };
  error?: string;
}
