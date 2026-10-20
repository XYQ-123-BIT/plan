/**
 * 用户服务（手机号验证码登录的数据层）
 * ==================================================================
 * 本地运行方案：用户数据以 JSON 文件持久化（backend/db/users.json），
 * 与任务的 localStorage 方案保持一致——无需数据库即可启动。
 * 登录方式为「手机号 + 验证码」，无密码；手机号不存在时自动创建账号。
 * 若后续接入 PostgreSQL，可将本模块替换为 drizzle 实现，
 * 表结构见 backend/db/schema.sql 的 users 表。
 */

import fs from 'fs';
import path from 'path';
import type { User, UserRecord } from '../../shared/types/auth';

/** 用户数据文件路径（backend/db/users.json） */
const DATA_DIR = path.join(__dirname, '..', 'db');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

/** 从磁盘读取全部用户（文件不存在时视为空库） */
function readUsers(): UserRecord[] {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 全量写回用户数据（验证码登录为低频操作，同步写足够） */
function writeUsers(users: UserRecord[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/** 按手机号查找用户 */
export function findUserByPhone(phone: string): UserRecord | undefined {
  return readUsers().find((u) => u.phone === phone);
}

/** 按 id 查找用户 */
export function findUserById(id: string): UserRecord | undefined {
  return readUsers().find((u) => u.id === id);
}

/**
 * 创建新用户（验证码登录的自动注册路径，调用方需先完成验证码校验）
 * 昵称缺省为「用户 + 手机号后 4 位」，可在设置页自行修改。
 */
export function createUserByPhone(phone: string): User {
  const record: UserRecord = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phone,
    nickname: `用户${phone.slice(-4)}`,
    createdAt: new Date().toISOString(),
  };

  const users = readUsers();
  users.push(record);
  writeUsers(users);

  return record;
}
