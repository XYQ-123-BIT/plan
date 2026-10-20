/**
 * 内置自然语言任务解析器（艾森豪威尔四象限）
 * ==================================================================
 * 模块位置：shared/parser/nlpParser.ts
 * 同时被后端路由（backend/routes/ai.ts 的 /api/ai/parse）与
 * 前端（hooks/useTasks 的网络失败兜底）引用，保证离线/无 API Key 也能解析。
 *
 * 能力：
 *  1. 按「分号 / 换行」拆分多条任务；
 *  2. 提取任务标题、截止时间、预估耗时；
 *  3. 依据固定关键词规则判定【重要 / 紧急】并映射到四象限；
 *  4. 时间校验（本次迭代重点）：
 *     - 相对时间词（今天、明天、N天后、N小时后、周X、X月X日…）全部基于
 *       当前时间【向后】计算；
 *     - 普通计划任务的截止时间绝不允许落在过去：若用户口误写了过去时间，
 *       自动顺延到合理的未来时间并生成 timeNote 提示；
 *     - 仅当用户明确表示「本该之前完成、现已逾期」（昨天该交、已逾期、
 *       错过了…）时，才保留过去时间并标记 isOverdue。
 *
 * 判定规则（固定，严格执行）：
 *  - 紧急：截止时间在当日 / 24 小时内 = 紧急；距今 3 天以上 = 不紧急；
 *    时间已过去 = 延期。
 *  - 重要：影响学业、考核、项目交付 = 重要；娱乐、无关琐事 = 不重要。
 */

import type { ParsedTask, Quadrant } from '../types/tasks';

// ---------------------------------------------------------------------------
// 关键词表
// ---------------------------------------------------------------------------

/** 重要关键词：学业 / 考核 / 项目交付 / 金钱事务 / 健康 */
const IMPORTANT_KEYWORDS = [
  '考试', '测验', '作业', '报告', '周报', '月报', '日报', '总结', '汇报', '项目',
  '交付', '会议', '开会', '面试', '客户', '论文', '答辩', '复习', '备考', '提交',
  '上线', '发布', '付款', '缴费', '报销', '账单', '合同', '方案', '演讲', '演示',
  '体检', '需求', '设计', '代码', '开发', '修复', '课程', '学习', '预习', '申请',
  '签证', '房租', '水电', '工作', '加班', '培训', '证书', '驾照', '保险', '理财',
  '打卡', '健身', '规划',
  'PRD', 'prd', 'DDL', 'ddl', 'bug', 'Bug', 'BUG',
];

/** 不重要关键词：娱乐 / 琐事 */
const UNIMPORTANT_KEYWORDS = [
  '刷视频', '刷抖音', '刷剧', '追剧', '短视频', '游戏', '打游戏', '玩游戏', '娱乐',
  '闲逛', '逛街', '淘宝', '网购', '闲聊', '八卦', '微博', '小红书', '看电影',
  '电影', '看剧', '听歌', '打牌', '麻将', '小说', '漫画', '直播', '综艺', '放松',
];

/** 紧急语气词：出现且没有明确时间时，默认 2 小时后截止 */
const URGENT_WORDS = [
  '马上', '立即', '立刻', '赶紧', '赶快', '尽快', '加急', '紧急', '急着',
  'asap', 'ASAP', 'urgent', 'URGENT',
];

/** 明确的逾期标记：用户自述任务本该过去完成 */
const OVERDUE_MARK_REGEX = /(已经过期|已过期|已逾期|逾期了|逾期|本该|该交了|该交|该完成|该做了|错过了|没来得及|迟到了|忘了交|忘记交|漏交了)/;
/** 过去日词 */
const PAST_DAY_REGEX = /(前天|昨晚|昨天)/;

// ---------------------------------------------------------------------------
// 中文数字解析
// ---------------------------------------------------------------------------

const CN_NUM: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** 支持 阿拉伯数字 / 一二三… / 十 / 十五 / 二十 / 二十五 */
function toNumber(raw: string): number {
  if (/^\d+(\.\d+)?$/.test(raw)) return parseFloat(raw);
  if (raw === '十') return 10;
  if (raw.includes('十')) {
    const [a, b] = raw.split('十');
    const tens = a ? CN_NUM[a] ?? 1 : 1;
    const ones = b ? CN_NUM[b] ?? 0 : 0;
    return tens * 10 + ones;
  }
  return CN_NUM[raw] ?? NaN;
}

const NUM = '\\d+(?:\\.\\d+)?|[一二两三四五六七八九十]+';

// ---------------------------------------------------------------------------
// 日期工具
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60 * 1000);
}

function withTime(day: Date, h: number, m: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** 生成人类可读时间：今天/明天/后天/昨天/前天/M月D日 HH:mm */
export function formatDeadlineText(deadline: Date, now: Date): string {
  const dayDiff = Math.round(
    (startOfDay(deadline).getTime() - startOfDay(now).getTime()) / 86400000,
  );
  const hm = `${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`;
  const labels: Record<number, string> = {
    [-2]: '前天', [-1]: '昨天', 0: '今天', 1: '明天', 2: '后天',
  };
  const dayLabel = labels[dayDiff] ?? `${deadline.getMonth() + 1}月${deadline.getDate()}日`;
  return `${dayLabel} ${hm}`;
}

// ---------------------------------------------------------------------------
// 时间提取
// ---------------------------------------------------------------------------

interface TimeExtraction {
  /** 提取到的截止时间（尚未做未来校验）；null 表示未识别到时间 */
  deadline: Date | null;
  /** 用户明确表示已逾期 */
  explicitOverdue: boolean;
  /** 被时间表达式消耗的原文片段（用于清洗标题） */
  consumed: string[];
}

const WEEKDAY_MAP: Record<string, number> = {
  日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
};

/**
 * 从单条任务文本中提取截止时间。
 * 所有相对时间词均基于 now 向后计算，绝不主动生成过去时间
 * （唯一例外：explicitOverdue 为 true 时保留过去时间用于延期统计）。
 */
function extractTime(text: string, now: Date): TimeExtraction {
  const consumed: string[] = [];
  const explicitOverdue =
    OVERDUE_MARK_REGEX.test(text) ||
    (PAST_DAY_REGEX.test(text) && /(该|截止|到期|过期|逾期)/.test(text));

  // ---- 1. 相对时长：N小时后 / N个半小时后 / 半小时后 / N分钟后 -------------
  // 优先级最高（「今天2小时后」以「2小时后」为准）
  const hoursLater = text.match(
    new RegExp(`(${NUM})\\s*(?:个)?半?\\s*(?:小时|钟头)后`),
  );
  const halfHourLater = text.match(/(?:^|[^一二两三四五六七八九十\d])半小时后/);
  const minutesLater = text.match(new RegExp(`(${NUM})\\s*分钟后`));

  if (hoursLater || halfHourLater || minutesLater) {
    let minutes = 0;
    if (hoursLater) {
      const n = toNumber(hoursLater[1]);
      minutes += /半/.test(hoursLater[0]) ? n * 60 + 30 : n * 60;
      consumed.push(hoursLater[0]);
    } else if (halfHourLater) {
      minutes += 30;
      consumed.push(halfHourLater[0].trim());
    }
    if (minutesLater) {
      minutes += toNumber(minutesLater[1]);
      consumed.push(minutesLater[0]);
    }
    // 顺带消耗同日词，避免残留进标题（如「今天2小时后开会」）
    const dayWord = text.match(/(今天|今日|今晚|现在|待会|等会)/);
    if (dayWord) consumed.push(dayWord[0]);
    return { deadline: addMinutes(now, minutes), explicitOverdue: false, consumed };
  }

  // ---- 2. 过去相对时长：N小时前（仅在明确逾期时保留） ----------------------
  const hoursAgo = text.match(new RegExp(`(${NUM})\\s*(?:个)?\\s*(?:小时|钟头)前`));
  if (hoursAgo && explicitOverdue) {
    consumed.push(hoursAgo[0]);
    return {
      deadline: addMinutes(now, -toNumber(hoursAgo[1]) * 60),
      explicitOverdue: true,
      consumed,
    };
  }

  // ---- 3. 日级偏移：今天/明天/后天/N天后/周X/下周X/周末/X月X日 ------------
  let baseDay: Date | null = null;

  const absDate = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/);
  const daysLater = text.match(new RegExp(`(${NUM})\\s*天后`));
  const nextWeek = text.match(/下周([一二三四五六日天])?/);
  const weekDay = text.match(/(?:周|星期)([一二三四五六日天])/);
  const pastDay = text.match(PAST_DAY_REGEX);

  if (absDate) {
    consumed.push(absDate[0]);
    const month = parseInt(absDate[1], 10) - 1;
    const day = parseInt(absDate[2], 10);
    let candidate = new Date(now.getFullYear(), month, day);
    // 未给年份时，过去的日期顺延到明年（计划任务时间向后计算）
    if (candidate.getTime() < startOfDay(now).getTime() && !explicitOverdue) {
      candidate = new Date(now.getFullYear() + 1, month, day);
    }
    baseDay = candidate;
  } else if (daysLater) {
    consumed.push(daysLater[0]);
    baseDay = addDays(startOfDay(now), toNumber(daysLater[1]));
  } else if (text.includes('大后天')) {
    consumed.push('大后天');
    baseDay = addDays(startOfDay(now), 3);
  } else if (text.includes('后天')) {
    consumed.push('后天');
    baseDay = addDays(startOfDay(now), 2);
  } else if (/(明天|明日|明早|明晚)/.test(text)) {
    consumed.push(text.match(/(明天|明日|明早|明晚)/)![0]);
    baseDay = addDays(startOfDay(now), 1);
  } else if (nextWeek) {
    consumed.push(nextWeek[0]);
    const target = nextWeek[1] ? WEEKDAY_MAP[nextWeek[1]] : 1; // 下周=下周一
    const diff = ((target - now.getDay() + 7) % 7) + 7; // 严格落在下周
    baseDay = addDays(startOfDay(now), diff);
  } else if (weekDay) {
    consumed.push(weekDay[0]);
    const target = WEEKDAY_MAP[weekDay[1]];
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0 && !/(\d{1,2})\s*(?:点|时)/.test(text)) diff = 7; // 无具体时刻的「周X(当天)」视为下周
    baseDay = addDays(startOfDay(now), diff);
  } else if (text.includes('周末')) {
    consumed.push('周末');
    baseDay = addDays(startOfDay(now), (6 - now.getDay() + 7) % 7); // 本周六
  } else if (/(今天|今日|今晚|今早|今晨)/.test(text)) {
    consumed.push(text.match(/(今天|今日|今晚|今早|今晨)/)![0]);
    baseDay = startOfDay(now);
  } else if (pastDay) {
    // 昨天/前天：仅在明确逾期时使用过去日期
    consumed.push(pastDay[0]);
    if (explicitOverdue) {
      baseDay = addDays(startOfDay(now), pastDay[0] === '前天' ? -2 : -1);
    }
  }

  // ---- 4. 当天时刻：下午3点 / 9点半 / 18:30 / 单独时段词 ------------------
  let hour: number | null = null;
  let minute = 0;

  const timeMatch = text.match(
    /(凌晨|早上|早晨|上午|中午|午后|下午|傍晚|晚上|今晚|深夜|明早|明晚)?\s*(\d{1,2})\s*(?:点|时)(半|\d{1,2})?(?:分)?/,
  );
  const colonMatch = text.match(/(\d{1,2})[:：](\d{2})/);

  if (timeMatch) {
    consumed.push(timeMatch[0]);
    const period = timeMatch[1] || '';
    let h = parseInt(timeMatch[2], 10);
    const mRaw = timeMatch[3];
    minute = mRaw === '半' ? 30 : mRaw ? parseInt(mRaw, 10) : 0;
    if (/(下午|午后|傍晚|晚上|今晚|深夜|明晚)/.test(period) && h < 12) h += 12;
    if (period === '中午' && h < 6) h += 12;
    if (period === '深夜' && h === 12) h = 0;
    hour = Math.min(h, 23);
  } else if (colonMatch) {
    consumed.push(colonMatch[0]);
    hour = Math.min(parseInt(colonMatch[1], 10), 23);
    minute = parseInt(colonMatch[2], 10);
  } else {
    // 只有时段词：今晚→20:00、下午→15:00 …
    const periodOnly = text.match(/(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|明早|明晚)/);
    if (periodOnly) {
      consumed.push(periodOnly[0]);
      const defaults: Record<string, number> = {
        凌晨: 5, 早上: 9, 早晨: 9, 上午: 9, 中午: 12,
        下午: 15, 傍晚: 18, 晚上: 20, 今晚: 20, 明早: 9, 明晚: 20,
      };
      hour = defaults[periodOnly[1]];
      if (periodOnly[1] === '明早' || periodOnly[1] === '明晚') {
        baseDay = baseDay ?? addDays(startOfDay(now), 1);
      }
    }
  }

  // ---- 5. 合成截止时间 -----------------------------------------------------
  let deadline: Date | null = null;
  if (baseDay) {
    if (hour !== null) {
      deadline = withTime(baseDay, hour, minute);
    } else {
      // 日级词但无时刻：今天 → 3小时后；其他日 → 当天 18:00；过去日 → 18:00
      const isToday = startOfDay(baseDay).getTime() === startOfDay(now).getTime();
      deadline = isToday && baseDay.getTime() >= startOfDay(now).getTime()
        ? addMinutes(now, 180)
        : withTime(baseDay, 18, 0);
    }
  } else if (hour !== null) {
    // 只有时刻没有日词 → 今天该时刻（若已过则由调用方顺延）
    deadline = withTime(startOfDay(now), hour, minute);
  }

  return { deadline, explicitOverdue, consumed };
}

// ---------------------------------------------------------------------------
// 耗时提取
// ---------------------------------------------------------------------------

function extractDuration(text: string, consumed: string[]): number {
  // 1个半小时 / 1.5小时
  const halfHour = text.match(new RegExp(`(${NUM})\\s*(?:个)?半\\s*(?:小时|钟头)`));
  if (halfHour) {
    consumed.push(halfHour[0]);
    return Math.round(toNumber(halfHour[1]) * 60 + 30);
  }
  const hours = text.match(new RegExp(`(${NUM})\\s*(?:个)?\\s*(?:小时|钟头)`));
  if (hours) {
    consumed.push(hours[0]);
    return Math.round(toNumber(hours[1]) * 60);
  }
  if (/半小时/.test(text)) {
    consumed.push(text.match(/(?:大约|大概|约|需要|耗时|预计)?\s*半小时/)![0]);
    return 30;
  }
  const minutes = text.match(new RegExp(`(${NUM})\\s*分钟`));
  if (minutes) {
    consumed.push(minutes[0]);
    return Math.round(toNumber(minutes[1]));
  }
  return 30; // 默认 30 分钟
}

// ---------------------------------------------------------------------------
// 标题清洗
// ---------------------------------------------------------------------------

function cleanTitle(segment: string, consumed: string[]): string {
  let title = segment;
  // 去掉时间 / 耗时表达式原文
  for (const c of consumed) title = title.split(c).join('');
  // 去掉常见填充词
  title = title
    .replace(/(请在|麻烦|记得要|记得|我要|我想|我需要|帮我|打算去|打算|准备去|准备|需要|大约|大概|预计|耗时)/g, '')
    .replace(/(本该|应该|该)/g, '')
    // 「明天下午3点前交报告」去掉时间后残留的「前/之前」
    .replace(/^[\s]*(之前|以前|前)\s*/, '')
    .replace(/^[要该得去]+/, '')
    .replace(/^(.{0,3}?)的/, '$1')
    .replace(/[，。、；,;:!!？?~\s]+/g, ' ')
    .trim();
  if (title.length < 2) {
    // 清洗后过短时回退为原文（截断）
    return segment.replace(/\s+/g, ' ').trim().slice(0, 20);
  }
  return title.slice(0, 30);
}

// ---------------------------------------------------------------------------
// 象限判定
// ---------------------------------------------------------------------------

function matchAny(text: string, keywords: string[]): string[] {
  return keywords.filter((k) => text.includes(k));
}

/**
 * 根据重要度得分与截止时间（相对 now）计算紧急度得分与象限。
 * 编辑截止时间后前端也可调用此函数重新计算。
 */
export function recalcUrgency(
  deadlineAt: string,
  importanceScore: number,
  now: Date = new Date(),
): { urgencyScore: number; quadrant: Quadrant; isOverdueByTime: boolean } {
  const deadline = new Date(deadlineAt);
  const hoursUntil = (deadline.getTime() - now.getTime()) / 3600000;
  const isOverdueByTime = hoursUntil < 0;
  // 紧急规则：已过去=延期(最紧急)；当日/24小时内=紧急；3天以上=不紧急
  const urgencyScore = isOverdueByTime ? 95 : hoursUntil <= 24 ? 80 : 25;
  const important = importanceScore >= 60;
  const urgent = urgencyScore >= 60;
  const quadrant: Quadrant = important && urgent ? 'Q1' : important ? 'Q2' : urgent ? 'Q3' : 'Q4';
  return { urgencyScore, quadrant, isOverdueByTime };
}

// ---------------------------------------------------------------------------
// 单条解析
// ---------------------------------------------------------------------------

function parseSingle(segment: string, now: Date): ParsedTask {
  const consumed: string[] = [];
  const durationMinutes = extractDuration(segment, consumed);
  const { deadline: rawDeadline, explicitOverdue, consumed: timeConsumed } = extractTime(segment, now);
  consumed.push(...timeConsumed);

  let deadline = rawDeadline;
  let timeAdjusted = false;
  let timeNote: string | undefined;
  let isOverdue = explicitOverdue;

  if (!deadline) {
    // 未识别到时间：紧急语气词 → 2小时后；否则默认今天 3 小时后（保证未来）
    const hasUrgentWord = matchAny(segment, URGENT_WORDS).length > 0;
    deadline = addMinutes(now, hasUrgentWord ? 120 : 180);
  } else if (!explicitOverdue && deadline.getTime() <= now.getTime()) {
    // 口误过去时间：按天顺延到未来，并提示用户
    const original = formatDeadlineText(deadline, now);
    let adjusted = deadline;
    if (rawDeadline && /(\d{1,2})\s*(?:点|时)/.test(segment)) {
      // 当天具体时刻已过 → 顺延到明天同一时刻
      adjusted = addDays(deadline, 1);
    }
    while (adjusted.getTime() <= now.getTime()) {
      adjusted = addDays(adjusted, 1);
    }
    timeAdjusted = true;
    timeNote = `原始时间「${original}」已过，已自动调整为「${formatDeadlineText(adjusted, now)}」`;
    deadline = adjusted;
  }

  // 重要判定：命中重要关键词 = 重要；否则不重要（娱乐词仅用于说明文案）
  const importantHits = matchAny(segment, IMPORTANT_KEYWORDS);
  const unimportantHits = matchAny(segment, UNIMPORTANT_KEYWORDS);
  const important = importantHits.length > 0;
  const importanceScore = important ? 80 : 25;

  // 明确逾期时 recalcUrgency 已把过去时间 urgencyScore 置为 95，无需额外处理
  const { urgencyScore, quadrant } = recalcUrgency(deadline.toISOString(), importanceScore, now);

  const hoursUntil = Math.round((deadline.getTime() - now.getTime()) / 3600000);
  const reasoningParts: string[] = [];
  reasoningParts.push(
    important
      ? `识别到重要类关键词「${importantHits.slice(0, 3).join('、')}」，判定为重要`
      : unimportantHits.length > 0
        ? `识别到娱乐/琐事类关键词「${unimportantHits.slice(0, 2).join('、')}」，判定为不重要`
        : '未识别到重要类关键词，默认判定为不重要',
  );
  reasoningParts.push(
    isOverdue
      ? '用户明确表示任务已逾期，标记为延期任务'
      : timeAdjusted
        ? '描述时间已过（疑似口误），已自动顺延到未来，按新截止时间判定紧急度'
        : hoursUntil <= 24
          ? `截止时间距今约 ${hoursUntil} 小时（24小时内），判定为紧急`
          : `截止时间距今约 ${Math.round(hoursUntil / 24)} 天，判定为不紧急`,
  );

  return {
    title: cleanTitle(segment, consumed),
    quadrant,
    importanceScore,
    urgencyScore,
    durationMinutes,
    deadlineAt: deadline.toISOString(),
    deadlineText: formatDeadlineText(deadline, now),
    isOverdue,
    timeAdjusted,
    timeNote,
    reasoning: reasoningParts.join('；') + '。',
  };
}

// ---------------------------------------------------------------------------
// 入口：解析整段输入（支持分号/换行分隔的多条任务）
// ---------------------------------------------------------------------------

export function parseTasks(input: string, now: Date = new Date()): ParsedTask[] {
  return input
    .split(/[;；\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((segment) => parseSingle(segment, now));
}
