import { useEffect, useState } from 'react';
import {
  BellRing,
  Info,
  RotateCcw,
  Save,
  Send,
  TimerReset,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import Navbar from '@/components/custom/Navbar';
import OmniflowBadge from '@/components/custom/OmniflowBadge';
import { AvatarFace } from '@/components/custom/UserAvatar';
import AvatarPicker from '@/components/custom/AvatarPicker';
import { Toaster } from '@/components/ui/sonner';
import { useSettings } from '@/contexts/SettingsContext';

/**
 * 设置页面
 * ------------------------------------------------------------------
 * 1. 个人资料：头像更换（预设 / 上传）、昵称；
 * 2. 提醒设置：弹窗提醒开关、提前提醒时长、超期提醒、浏览器系统通知、
 *    并提供「发送测试提醒」便于验证功能；
 * 3. 关于：应用基础信息；
 * 4. 恢复默认设置（仅重置本页设置，不影响任务数据）。
 * 所有数据通过 SettingsContext 持久化到 localStorage。
 */

/** 提前提醒时长可选项 */
const LEAD_MINUTE_OPTIONS = [5, 10, 15, 30, 60];

export default function Settings() {
  const { settings, updateSettings, resetSettings } = useSettings();

  // 头像选择弹窗开关
  const [pickerOpen, setPickerOpen] = useState(false);
  // 昵称输入框内容（点击保存后才写入）
  const [nicknameDraft, setNicknameDraft] = useState(settings.nickname);
  // 浏览器通知授权状态
  const [notificationPermission, setNotificationPermissionState] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // 从其他入口修改昵称后保持输入框同步
  useEffect(() => {
    setNicknameDraft(settings.nickname);
  }, [settings.nickname]);

  /** 保存昵称 */
  const handleSaveNickname = () => {
    const trimmed = nicknameDraft.trim();
    updateSettings({ nickname: trimmed });
    setNicknameDraft(trimmed);
    toast.success('个人资料已保存');
  };

  /**
   * 切换浏览器系统通知：
   * 开启时需要先向浏览器申请权限，被拒绝则回退开关。
   */
  const handleToggleBrowserNotification = async (checked: boolean) => {
    if (!checked) {
      updateSettings({ browserNotification: false });
      return;
    }
    if (!('Notification' in window)) {
      toast.error('当前浏览器不支持系统通知');
      return;
    }
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
      setNotificationPermissionState(permission);
    }
    if (permission === 'granted') {
      updateSettings({ browserNotification: true });
      toast.success('已开启浏览器系统通知');
    } else {
      toast.error('通知权限被拒绝，请在浏览器设置中允许通知后再试');
    }
  };

  /** 发送一条测试提醒（轻提示 + 系统通知） */
  const handleSendTest = () => {
    toast.success('测试提醒', {
      description: '如果你能看到这条消息，说明弹窗提醒功能正常 ✅',
    });
    if (
      settings.browserNotification &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification('Omniflow 测试通知', {
        body: '浏览器系统通知功能正常 ✅',
      });
    }
  };

  /** 恢复默认设置 */
  const handleReset = () => {
    resetSettings();
    setNicknameDraft('');
    toast.success('已恢复默认设置');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">设置</h1>
          <p className="text-sm text-slate-500 mt-1">管理个人资料与任务提醒偏好，设置会自动保存在本机</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ============ 个人资料 ============ */}
          <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 mb-5">
              <UserRound className="w-4 h-4 text-indigo-500" />
              个人资料
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* 头像展示 + 更换入口 */}
              <div className="flex flex-col items-center gap-2">
                <AvatarFace
                  avatar={settings.avatar}
                  nickname={settings.nickname}
                  sizeClass="h-20 w-20"
                  textClass="text-4xl"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setPickerOpen(true)}
                >
                  更换头像
                </Button>
              </div>

              {/* 昵称编辑 */}
              <div className="flex-1 w-full">
                <Label htmlFor="nickname" className="text-xs text-slate-500">
                  昵称
                </Label>
                <Input
                  id="nickname"
                  maxLength={20}
                  placeholder="给自己起个名字吧"
                  className="mt-1.5"
                  value={nicknameDraft}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  最多 20 个字符，头像图片加载失败时会显示昵称缩写
                </p>
                <Button
                  size="sm"
                  className="mt-3 cursor-pointer"
                  onClick={handleSaveNickname}
                >
                  <Save className="w-4 h-4 mr-1" />
                  保存资料
                </Button>
              </div>
            </div>
          </section>

          {/* ============ 关于 ============ */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 mb-5">
              <Info className="w-4 h-4 text-indigo-500" />
              关于
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">应用名称</dt>
                <dd className="font-medium text-slate-800">Omniflow AI</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">版本</dt>
                <dd className="font-medium text-slate-800">v1.0.0</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">核心能力</dt>
                <dd className="font-medium text-slate-800">AI 四象限任务规划</dd>
              </div>
            </dl>
            <div className="mt-5 p-3 rounded-lg bg-slate-50 text-[11px] leading-relaxed text-slate-500">
              用自然语言输入任务，AI 自动识别重要度、紧急度与耗时，并将任务安排到今日时间轴。
            </div>
          </section>

          {/* ============ 提醒设置 ============ */}
          <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 mb-5">
              <BellRing className="w-4 h-4 text-indigo-500" />
              提醒设置
            </h2>

            <div className="divide-y divide-slate-100">
              {/* 弹窗提醒总开关 */}
              <div className="flex items-center justify-between py-4">
                <div className="pr-4">
                  <p className="text-sm font-medium text-slate-800">弹窗提醒</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    任务即将开始或已超期时，在页面内弹出提醒窗口
                  </p>
                </div>
                <Switch
                  checked={settings.remindersEnabled}
                  onCheckedChange={(checked) => updateSettings({ remindersEnabled: checked })}
                />
              </div>

              {/* 提前提醒时长 */}
              <div className="flex items-center justify-between py-4">
                <div className="pr-4">
                  <p className="text-sm font-medium text-slate-800">提前提醒时间</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    在任务计划开始前多久发送提醒
                  </p>
                </div>
                <Select
                  value={String(settings.leadMinutes)}
                  onValueChange={(value) => updateSettings({ leadMinutes: Number(value) })}
                >
                  <SelectTrigger className="w-32 cursor-pointer">
                    <SelectValue placeholder="选择时长" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_MINUTE_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)} className="cursor-pointer">
                        提前 {minutes} 分钟
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 超期提醒开关 */}
              <div className="flex items-center justify-between py-4">
                <div className="pr-4">
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    <TimerReset className="w-4 h-4 text-slate-400" />
                    超期提醒
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    任务超过计划结束时间仍未完成时进行提醒
                  </p>
                </div>
                <Switch
                  checked={settings.overdueReminder}
                  onCheckedChange={(checked) => updateSettings({ overdueReminder: checked })}
                />
              </div>

              {/* 浏览器系统通知开关 */}
              <div className="flex items-center justify-between py-4">
                <div className="pr-4">
                  <p className="text-sm font-medium text-slate-800">浏览器系统通知</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    开启后即使切换到其他标签页也能收到通知
                    {notificationPermission === 'denied' && (
                      <span className="block text-red-400 mt-0.5">
                        通知权限已被浏览器拒绝，请在浏览器站点设置中手动允许
                      </span>
                    )}
                  </p>
                </div>
                <Switch
                  checked={settings.browserNotification}
                  onCheckedChange={handleToggleBrowserNotification}
                />
              </div>
            </div>

            {/* 测试提醒 */}
            <div className="mt-5 flex justify-end">
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={handleSendTest}>
                <Send className="w-4 h-4 mr-1" />
                发送测试提醒
              </Button>
            </div>
          </section>
        </div>

        {/* ============ 危险操作：恢复默认 ============ */}
        <div className="mt-6 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500 cursor-pointer">
                <RotateCcw className="w-4 h-4 mr-1" />
                恢复默认设置
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>恢复默认设置？</AlertDialogTitle>
                <AlertDialogDescription>
                  昵称、头像与提醒偏好将恢复为默认值。该操作只影响设置，不会删除你的任何任务。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-500 hover:bg-red-600 cursor-pointer"
                  onClick={handleReset}
                >
                  确认恢复
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>

      {/* 头像选择弹窗 */}
      <AvatarPicker open={pickerOpen} onOpenChange={setPickerOpen} />

      <OmniflowBadge />
      <Toaster />
    </div>
  );
}
