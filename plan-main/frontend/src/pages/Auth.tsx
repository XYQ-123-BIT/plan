import { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Smartphone, ShieldCheck, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 登录 / 注册页（手机号 + 短信验证码 · 纯前端模拟）
 * ------------------------------------------------------------------
 * 静态部署（GitHub Pages）无后端服务器，登录流程全部在前端完成：
 * 点击「获取验证码」由 AuthContext 回传固定演示验证码并用 toast 展示，
 * 用户输入的验证码与之匹配即判定登录成功，随后自动跳转回来源页面。
 * 手机号首次登录视作注册，由 AuthContext 内部标记。
 */

/** 手机号输入过滤：仅保留数字，最长 11 位 */
function sanitizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

export default function Auth() {
  const { user, sendCode, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/';

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 倒计时（60 秒内不允许重发，避免重复点击）
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((n) => n - 1), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  // 已登录用户直接进入工作台
  if (user) {
    return <Navigate to={from} replace />;
  }

  const phoneValid = /^1[3-9]\d{9}$/.test(phone);

  /** 发送验证码 */
  const handleSendCode = async () => {
    if (!phoneValid || sending || countdown > 0) return;
    setSending(true);
    try {
      const devCode = await sendCode(phone);
      if (devCode) {
        toast.info(`【演示模式】验证码：${devCode}`, { duration: 10000 });
      } else {
        toast.success('验证码已发送，请查收短信');
      }
      setCountdown(60);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  /** 提交登录（登录即注册） */
  const handleSubmit = async () => {
    if (!phoneValid || code.length !== 6 || loggingIn) return;
    setLoggingIn(true);
    try {
      await login(phone, code);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Toaster />
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-3">4</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Omniflow AI</h1>
          <p className="text-sm text-slate-500 mt-1">四象限智能任务规划</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900">登录 / 注册</h2>
          <p className="text-xs text-slate-400 mt-1 mb-5">未注册的手机号验证后将自动创建账号</p>

          {/* 手机号 */}
          <label className="text-xs text-slate-500 font-medium block mb-1.5" htmlFor="phone">手机号</label>
          <div className="relative mb-4">
            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="phone"
              inputMode="numeric"
              placeholder="请输入 11 位手机号"
              className="pl-9 tracking-wide"
              value={phone}
              onChange={(e) => setPhone(sanitizePhone(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && phoneValid && handleSendCode()}
              disabled={loggingIn}
            />
          </div>

          {/* 验证码：6 位 OTP 输入 + 发送按钮 */}
          <label className="text-xs text-slate-500 font-medium block mb-1.5">短信验证码</label>
          <div className="flex items-center gap-3 mb-5">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              disabled={loggingIn}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-shrink-0 whitespace-nowrap cursor-pointer text-xs"
              disabled={!phoneValid || sending || countdown > 0}
              onClick={handleSendCode}
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : countdown > 0 ? (
                `${countdown}s 后重发`
              ) : (
                '获取验证码'
              )}
            </Button>
          </div>

          {/* 登录按钮 */}
          <Button
            className="w-full cursor-pointer"
            disabled={!phoneValid || code.length !== 6 || loggingIn}
            onClick={handleSubmit}
          >
            {loggingIn ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-1" />
                登录 / 注册
              </>
            )}
          </Button>

          {/* 演示模式提示 */}
          <div className="mt-4 flex items-start gap-2 p-3 bg-slate-50 rounded-lg text-[11px] text-slate-400 leading-relaxed">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              演示模式（纯前端模拟，无需后端）：点击「获取验证码」后，验证码将以弹窗展示，固定为
              123456。输入该验证码即可登录，未注册的手机号首次登录将自动创建账号。
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
