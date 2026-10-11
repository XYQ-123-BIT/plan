import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { AvatarData } from '@/contexts/SettingsContext';

/**
 * 统一头像渲染组件
 * ------------------------------------------------------------------
 * - 自定义图片头像：通过 AvatarImage 展示，加载失败时自动回退
 * - emoji 预设头像：在渐变色块中展示 emoji
 * - 兜底：显示昵称缩写（中文取末两位，英文取首字母）
 */

/** 根据昵称生成最多 2 个字符的兜底文案 */
function getInitials(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return 'OF';

  const chars = Array.from(trimmed);
  // 昵称为中文：取最后两个汉字
  if (/[\u4e00-\u9fa5]/.test(chars[0])) {
    return chars.slice(-2).join('');
  }
  // 英文昵称：取各单词首字母
  return trimmed
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface AvatarFaceProps {
  avatar: AvatarData;
  /** 昵称，仅在图片加载失败时用于兜底展示 */
  nickname?: string;
  /** 尺寸类名，如 h-8 w-8 / h-16 w-16 */
  sizeClass?: string;
  /** emoji / 文字字号类名 */
  textClass?: string;
  className?: string;
}

export function AvatarFace({
  avatar,
  nickname = '',
  sizeClass = 'h-9 w-9',
  textClass = 'text-base',
  className,
}: AvatarFaceProps) {
  return (
    <Avatar
      className={cn(
        sizeClass,
        'shrink-0 border border-slate-200/80 shadow-sm select-none',
        className
      )}
    >
      {/* 仅自定义图片头像需要渲染图片节点 */}
      {avatar.type === 'image' && (
        <AvatarImage
          src={avatar.src}
          alt={nickname || '用户头像'}
          className="object-cover"
        />
      )}
      <AvatarFallback
        className={cn(
          'font-semibold text-white',
          avatar.type === 'emoji' ? avatar.bg : 'bg-amber-400'
        )}
      >
        {avatar.type === 'emoji' ? (
          <span className={cn('leading-none', textClass)}>{avatar.emoji}</span>
        ) : (
          getInitials(nickname)
        )}
      </AvatarFallback>
    </Avatar>
  );
}
