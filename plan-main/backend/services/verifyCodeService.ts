/**
 * 短信验证码服务
 * ==================================================================
 * 本地运行（演示模式）：没有配置真实短信服务商时，验证码只打印到
 * 后端控制台，并随接口响应回传 devCode 给前端展示，方便演示联调。
 *
 * 接入真实短信：实现 sendSmsViaProvider() 中的调用（阿里云 / 腾讯云
 * SMS 等），并设置环境变量 SMS_PROVIDER_KEY=1，devCode 将不再返回。
 *
 * 安全设计：
 *  - 6 位纯数字，5 分钟有效；
 *  - 同一手机号 60 秒内只能发一次（限流防轰炸）；
 *  - 验证成功后立即销毁（一次性），验证失败不重置过期时间。
 */

import { SERVER_CONFIG } from '../config/constants';

/** 验证码有效期（毫秒）：5 分钟 */
const CODE_TTL_MS = 5 * 60 * 1000;
/** 发送间隔限制（毫秒）：60 秒 */
const SEND_INTERVAL_MS = 60 * 1000;

interface CodeEntry {
  code: string;
  expiresAt: number;
  lastSentAt: number;
}

/** 内存存储（进程重启后失效，本地演示足够；接入 Redis 可平滑替换） */
const codeStore = new Map<string, CodeEntry>();

/** 中国大陆手机号校验 */
export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 真实短信发送挂载点（预留）。
 * 接入时在此调用短信服务商 SDK，例如：
 *   await aliSmsClient.send({ PhoneNumbers: phone, TemplateCode: 'SMS_xxx', TemplateParam: JSON.stringify({ code }) })
 * 当前实现仅在后端控制台输出，作为本地演示。
 */
async function sendSmsViaProvider(phone: string, code: string): Promise<void> {
  console.log(`[SMS][演示模式] 向 ${phone} 发送验证码：${code}（5 分钟内有效）`);
}

/**
 * 生成并发送验证码。
 * 返回值：成功时 { ok: true, devCode? }；失败时 { ok: false, error }。
 */
export async function sendCode(
  phone: string,
): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  if (!isValidPhone(phone)) {
    return { ok: false, error: '手机号格式不正确' };
  }

  const now = Date.now();
  const existing = codeStore.get(phone);

  // 限流：60 秒内不允许重复发送
  if (existing && now - existing.lastSentAt < SEND_INTERVAL_MS) {
    const waitSec = Math.ceil((SEND_INTERVAL_MS - (now - existing.lastSentAt)) / 1000);
    return { ok: false, error: `发送太频繁，请 ${waitSec} 秒后再试` };
  }

  // 生成 6 位数字验证码（前置补零）
  const code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

  codeStore.set(phone, { code, expiresAt: now + CODE_TTL_MS, lastSentAt: now });
  await sendSmsViaProvider(phone, code);

  // 演示模式：把验证码回传给前端展示
  return SERVER_CONFIG.SMS_DEV_MODE ? { ok: true, devCode: code } : { ok: true };
}

/** 校验验证码（成功后立即销毁，保证一次性） */
export function verifyCode(phone: string, code: string): boolean {
  const entry = codeStore.get(phone);
  if (!entry) return false;

  // 顺带清理过期验证码，避免 Map 无限增长
  if (Date.now() > entry.expiresAt) {
    codeStore.delete(phone);
    return false;
  }

  if (entry.code !== code) return false;

  codeStore.delete(phone);
  return true;
}
