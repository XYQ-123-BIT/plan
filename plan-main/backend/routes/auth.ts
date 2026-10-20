/**
 * 注册登录路由 /api/auth —— 手机号 + 短信验证码方案
 * ==================================================================
 *  POST /api/auth/send-code  发送验证码（60s 限流；演示模式回传 devCode）
 *  POST /api/auth/login      验证码登录（手机号未注册时自动创建账号）
 *  GET  /api/auth/me         获取当前登录用户（需 Bearer Token）
 *
 * 认证方案：JWT（Bearer Token），与 server.ts 的 CORS 配置
 * （允许 Authorization 头、不依赖 Cookie）兼容，前端将 Token
 * 存于 localStorage 并在每次请求时附带。
 */

import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SERVER_CONFIG } from '../config/constants';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { sendCode, verifyCode, isValidPhone } from '../services/verifyCodeService';
import { findUserByPhone, createUserByPhone } from '../services/userService';
import type { LoginRequest, SendCodeRequest } from '../../shared/types/auth';

const router = Router();

/** 签发 JWT（sub = 用户 id，有效期见 SERVER_CONFIG.JWT_EXPIRES_IN） */
function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SERVER_CONFIG.JWT_SECRET, {
    expiresIn: SERVER_CONFIG.JWT_EXPIRES_IN,
  });
}

/** 发送验证码 */
router.post('/send-code', async (req: AuthedRequest, res: Response) => {
  try {
    const { phone } = (req.body || {}) as SendCodeRequest;

    if (!phone) {
      return res.status(400).json({ success: false, error: '请输入手机号' });
    }

    const result = await sendCode(phone.trim());
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      data: { expiresIn: 300, ...(result.devCode ? { devCode: result.devCode } : {}) },
    });
  } catch (error) {
    console.error('Send code error:', error);
    return res.status(500).json({ success: false, error: '验证码发送失败，请稍后再试' });
  }
});

/** 验证码登录（登录即注册：手机号不存在时自动创建账号） */
router.post('/login', async (req: AuthedRequest, res: Response) => {
  try {
    const { phone, code } = (req.body || {}) as LoginRequest;

    if (!phone || !code) {
      return res.status(400).json({ success: false, error: '请输入手机号和验证码' });
    }

    const normalized = phone.trim();
    if (!isValidPhone(normalized)) {
      return res.status(400).json({ success: false, error: '手机号格式不正确' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: '请输入 6 位数字验证码' });
    }

    if (!verifyCode(normalized, code)) {
      return res.status(400).json({ success: false, error: '验证码错误或已过期，请重新获取' });
    }

    // 验证码校验通过：已有用户直接登录，新手机号自动注册
    let user = findUserByPhone(normalized);
    let isNewUser = false;
    if (!user) {
      user = createUserByPhone(normalized);
      isNewUser = true;
    }

    return res.json({
      success: true,
      data: { token: signToken(user.id), user, isNewUser },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: '登录失败，请稍后再试' });
  }
});

/** 当前登录用户（Token 校验 + 用户仍存在） */
router.get('/me', requireAuth, (req: AuthedRequest, res: Response) => {
  return res.json({ success: true, data: { user: req.user } });
});

export default router;
