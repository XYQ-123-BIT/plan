/**
 * JWT 认证中间件
 * 校验请求头 Authorization: Bearer <token>，
 * 通过后将解码的用户信息挂到 req.user 供后续路由使用。
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SERVER_CONFIG } from '../config/constants';
import { findUserById } from '../services/userService';
import type { User } from '../../shared/types/auth';

/** 扩展 Express Request，携带已认证的用户信息 */
export interface AuthedRequest extends Request {
  user?: User;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    res.status(401).json({ success: false, error: '未登录，请先登录' });
    return;
  }

  try {
    const payload = jwt.verify(token, SERVER_CONFIG.JWT_SECRET) as { sub?: string };
    if (!payload.sub) throw new Error('invalid token');

    const user = findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ success: false, error: '账号不存在或已被移除' });
      return;
    }

    req.user = { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.createdAt };
    next();
  } catch {
    res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
}
