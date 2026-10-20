import { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';

/**
 * 头像选择弹窗
 * ------------------------------------------------------------------
 * 1. 「预设头像」：12 个 emoji + 渐变底色，点击即换；
 * 2. 「上传图片」：选择本地图片后转成 dataURL 保存到 localStorage，
 *    无需后端上传，刷新与跨页面均可保留。
 * 弹窗为受控组件，由导航栏 / 设置页通过 open / onOpenChange 控制。
 */

/** 预设 emoji 列表（与下方渐变色一一对应） */
const PRESET_EMOJIS = ['🦊', '🐼', '🐱', '🐶', '🦁', '🐸', '🐵', '🦄', '🐝', '🐙', '🦋', '🐳'];

/** 预设渐变底色（必须写完整类名，Tailwind 才能正确打包） */
const PRESET_BGS = [
  'bg-gradient-to-br from-amber-400 to-orange-500',
  'bg-gradient-to-br from-slate-400 to-slate-600',
  'bg-gradient-to-br from-pink-400 to-rose-500',
  'bg-gradient-to-br from-yellow-300 to-amber-500',
  'bg-gradient-to-br from-orange-400 to-red-500',
  'bg-gradient-to-br from-lime-400 to-green-500',
  'bg-gradient-to-br from-yellow-400 to-amber-600',
  'bg-gradient-to-br from-fuchsia-400 to-purple-500',
  'bg-gradient-to-br from-yellow-300 to-yellow-500',
  'bg-gradient-to-br from-rose-400 to-pink-600',
  'bg-gradient-to-br from-sky-400 to-indigo-500',
  'bg-gradient-to-br from-cyan-400 to-blue-500',
];

/** 允许上传的最大图片大小（2MB，避免 localStorage 超限） */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

interface AvatarPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AvatarPicker({ open, onOpenChange }: AvatarPickerProps) {
  const { settings, updateSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  /** 选中某个预设头像 */
  const handlePickPreset = (emoji: string, bg: string) => {
    updateSettings({ avatar: { type: 'emoji', emoji, bg } });
    toast.success('头像已更换');
    onOpenChange(false);
  };

  /** 触发隐藏的文件选择框 */
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  /** 读取本地图片并保存 */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 允许后清空 value，保证选择同一文件也能再次触发 change
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('图片不能超过 2MB，请换一张更小的图片');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ avatar: { type: 'image', src: String(reader.result) } });
      setUploading(false);
      toast.success('头像已更换');
      onOpenChange(false);
    };
    reader.onerror = () => {
      setUploading(false);
      toast.error('图片读取失败，请重试');
    };
    reader.readAsDataURL(file);
  };

  /** 判断某个预设头像是否为当前选中项 */
  const isPresetActive = (emoji: string, bg: string) =>
    settings.avatar.type === 'emoji' &&
    settings.avatar.emoji === emoji &&
    settings.avatar.bg === bg;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>更换头像</DialogTitle>
          <DialogDescription>挑选一个喜欢的预设头像，或上传本地图片。</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preset">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preset" className="cursor-pointer">
              预设头像
            </TabsTrigger>
            <TabsTrigger value="upload" className="cursor-pointer">
              上传图片
            </TabsTrigger>
          </TabsList>

          {/* 预设头像网格 */}
          <TabsContent value="preset">
            <div className="grid grid-cols-4 gap-3">
              {PRESET_EMOJIS.map((emoji, index) => {
                const bg = PRESET_BGS[index];
                const active = isPresetActive(emoji, bg);
                return (
                  <button
                    key={emoji + index}
                    type="button"
                    onClick={() => handlePickPreset(emoji, bg)}
                    className={cn(
                      'relative aspect-square rounded-2xl flex items-center justify-center text-2xl',
                      'transition-all duration-150 hover:scale-105 cursor-pointer',
                      bg,
                      active && 'ring-2 ring-indigo-500 ring-offset-2'
                    )}
                    aria-label={`选择头像 ${emoji}`}
                  >
                    <span className="drop-shadow-sm">{emoji}</span>
                    {active && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </TabsContent>

          {/* 本地上传 */}
          <TabsContent value="upload">
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors flex flex-col items-center justify-center gap-2 py-10 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-xs text-slate-500">图片读取中...</span>
                </>
              ) : (
                <>
                  <span className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <ImagePlus className="w-6 h-6 text-slate-400" />
                  </span>
                  <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
                    <Upload className="w-4 h-4" />
                    点击选择本地图片
                  </span>
                  <span className="text-[11px] text-slate-400">支持 JPG / PNG / GIF，大小不超过 2MB</span>
                </>
              )}
            </button>
            {/* 隐藏的文件输入框 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
