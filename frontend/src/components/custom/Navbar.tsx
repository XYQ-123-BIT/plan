import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutGrid,
  Calendar,
  BarChart2,
  Settings,
  ImagePlus,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotificationBell from '@/components/custom/NotificationBell';
import { AvatarFace } from '@/components/custom/UserAvatar';
import AvatarPicker from '@/components/custom/AvatarPicker';
import { useSettings } from '@/contexts/SettingsContext';

/** 顶部 / 底部导航菜单项（保持原有四项不变） */
const links = [
  { to: '/', label: '工作台', icon: LayoutGrid },
  { to: '/schedule', label: '日程表', icon: Calendar },
  { to: '/review', label: '复盘统计', icon: BarChart2 },
  { to: '/settings', label: '设置', icon: Settings },
];

export default function Navbar() {
  const { settings } = useSettings();
  // 头像选择弹窗的显示状态（导航栏头像菜单中触发）
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 cursor-pointer" aria-label="Omniflow AI 首页">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">4</div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Omniflow AI</span>
        </Link>

        {/* Desktop nav：选中项使用胶囊高亮，hover 有浅色底 */}
        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                  isActive
                    ? 'text-indigo-600 font-semibold bg-indigo-50'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* 右侧操作区：通知铃铛 + 头像菜单（均已可点击） */}
        <div className="flex items-center gap-2">
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-full transition-all hover:ring-2 hover:ring-indigo-200 hover:ring-offset-1 cursor-pointer"
                aria-label="用户菜单"
              >
                <AvatarFace
                  avatar={settings.avatar}
                  nickname={settings.nickname}
                  sizeClass="h-9 w-9"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800">
                    {settings.nickname || 'Omniflow 用户'}
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">个人中心</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setPickerOpen(true)}
              >
                <ImagePlus className="w-4 h-4 mr-2 text-slate-400" />
                更换头像
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link to="/settings">
                  <Settings className="w-4 h-4 mr-2 text-slate-400" />
                  个人设置
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-300" />
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile bottom nav（保持原有底部导航不变） */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-[10px] gap-1 transition-colors cursor-pointer ${
                isActive ? 'text-indigo-600' : 'text-slate-400'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </div>

      {/* 头像选择弹窗（与设置页内的弹窗互不影响，各自独立控制） */}
      <AvatarPicker open={pickerOpen} onOpenChange={setPickerOpen} />
    </nav>
  );
}
