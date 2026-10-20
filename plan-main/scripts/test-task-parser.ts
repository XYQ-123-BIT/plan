/**
 * 内置 NLP 解析器测试用例
 * ==================================================================
 * 运行方式：npm run test:parser
 * 使用固定「当前时间」注入，保证结果可复现：
 *   NOW = 2026-10-18（周日）14:00
 *
 * 覆盖 PRD 要求的三条核心时间逻辑：
 *  1. 普通计划任务解析后的截止时间必须在未来；
 *  2. 仅用户明确描述逾期时才标记延期（isOverdue）；
 *  3. 相对时间词（今天/明天/3天后/2小时后…）全部基于当前时间向后计算。
 */

import assert from 'node:assert';
import { parseTasks, recalcUrgency, formatDeadlineText } from '../shared/parser/nlpParser';

const NOW = new Date('2026-10-18T14:00:00'); // 周日 14:00

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✘ ${name}`);
    console.error(`    ${(err as Error).message}`);
  }
}

const future = (iso: string) => new Date(iso).getTime() > NOW.getTime();

console.log('内置 NLP 解析器测试（基准时间：2026-10-18 周日 14:00）\n');

// ---------------------------------------------------------------- 单任务基础
console.log('【1】单任务：字段提取 + 象限判定');

check('明天下午3点前交产品PRD → 明天15:00 / Q2 / 120分钟', () => {
  const [t] = parseTasks('明天下午3点前交产品PRD，大约需要2小时', NOW);
  const d = new Date(t.deadlineAt);
  assert.ok(t.title.includes('PRD'), `标题应保留 PRD，实际：${t.title}`);
  assert.strictEqual(d.getHours(), 15, '下午3点应为15时');
  assert.strictEqual(d.getDate(), 19, '应为明天（19日）');
  assert.strictEqual(t.durationMinutes, 120, '2小时应为120分钟');
  assert.strictEqual(t.quadrant, 'Q2', `重要不紧急应为Q2，实际：${t.quadrant}`);
  assert.ok(future(t.deadlineAt), '截止时间必须在未来');
  assert.ok(!t.isOverdue);
});

check('今天2小时后开项目周会 → 当前时间+2h / Q1', () => {
  const [t] = parseTasks('今天2小时后开项目周会', NOW);
  const diffMin = (new Date(t.deadlineAt).getTime() - NOW.getTime()) / 60000;
  assert.ok(Math.abs(diffMin - 120) < 1, `2小时后应≈120分钟，实际：${diffMin}`);
  assert.strictEqual(t.quadrant, 'Q1', `重要且紧急应为Q1，实际：${t.quadrant}`);
});

check('3天后准备季度汇报 → +3天 / Q2', () => {
  const [t] = parseTasks('3天后准备季度汇报', NOW);
  const d = new Date(t.deadlineAt);
  assert.strictEqual(d.getDate(), 21, '3天后应为21日');
  assert.strictEqual(t.quadrant, 'Q2', `3天以上不紧急，应为Q2，实际：${t.quadrant}`);
  assert.ok(t.title.includes('季度汇报'), `标题应为季度汇报，实际：${t.title}`);
});

check('周末刷短视频放松一下 → Q4 / 未来时间', () => {
  const [t] = parseTasks('周末刷短视频放松一下', NOW);
  assert.strictEqual(t.quadrant, 'Q4', `娱乐琐事应为Q4，实际：${t.quadrant}`);
  assert.ok(future(t.deadlineAt));
  assert.strictEqual(new Date(t.deadlineAt).getDay(), 6, '周末应落在周六');
});

check('写周报（无时间词）→ 默认未来时间（当前+3h）/ Q1', () => {
  const [t] = parseTasks('写周报', NOW);
  const diffMin = (new Date(t.deadlineAt).getTime() - NOW.getTime()) / 60000;
  assert.ok(Math.abs(diffMin - 180) < 1, `默认应为3小时后，实际：${diffMin}分钟`);
  assert.strictEqual(t.quadrant, 'Q1');
  assert.ok(future(t.deadlineAt));
});

check('半小时后去买菜 → +30分钟 / Q3', () => {
  const [t] = parseTasks('半小时后去买菜', NOW);
  const diffMin = (new Date(t.deadlineAt).getTime() - NOW.getTime()) / 60000;
  assert.ok(Math.abs(diffMin - 30) < 1, `应为30分钟后，实际：${diffMin}`);
  assert.strictEqual(t.quadrant, 'Q3', `紧急不重要应为Q3，实际：${t.quadrant}`);
});

check('下周三交季度总结 → 严格落在下周三 / Q2', () => {
  const [t] = parseTasks('下周三交季度总结', NOW);
  const d = new Date(t.deadlineAt);
  assert.strictEqual(d.getDay(), 3, '应为周三');
  const days = Math.round((d.getTime() - NOW.getTime()) / 86400000);
  assert.ok(days >= 7, `下周三距今应≥7天，实际：${days}`);
  assert.strictEqual(t.quadrant, 'Q2');
});

check('12月1日前缴房租 → 今年12月1日 / Q2', () => {
  const [t] = parseTasks('12月1日前缴房租', NOW);
  const d = new Date(t.deadlineAt);
  assert.strictEqual(d.getMonth(), 11);
  assert.strictEqual(d.getDate(), 1);
  assert.ok(future(t.deadlineAt));
  assert.strictEqual(t.quadrant, 'Q2');
});

// ---------------------------------------------------------------- 核心时间逻辑
console.log('\n【2】核心时间逻辑（PRD 重点）');

check('口误过去时间：今天上午9点提交报销单（现已14点）→ 自动顺延 + 备注提示', () => {
  const [t] = parseTasks('今天上午9点提交报销单', NOW);
  assert.ok(future(t.deadlineAt), '口误过去时间必须顺延到未来');
  assert.ok(t.timeAdjusted, '应标记 timeAdjusted');
  assert.ok(t.timeNote && t.timeNote.includes('已自动调整'), `应给出备注提示，实际：${t.timeNote}`);
  assert.ok(!t.isOverdue, '口误不应标记为延期');
});

check('明确逾期：昨天该交的数学作业 → isOverdue + 保留过去时间', () => {
  const [t] = parseTasks('昨天该交的数学作业', NOW);
  assert.ok(t.isOverdue, '明确逾期应标记 isOverdue');
  assert.ok(!future(t.deadlineAt), '逾期任务截止时间允许在过去');
  assert.strictEqual(new Date(t.deadlineAt).getDate(), 17, '截止应为昨天（17日）');
});

check('明确逾期：前天本该提交的开题报告，已经过期 → isOverdue', () => {
  const [t] = parseTasks('前天本该提交的开题报告，已经过期', NOW);
  assert.ok(t.isOverdue);
  assert.strictEqual(new Date(t.deadlineAt).getDate(), 16, '截止应为前天（16日）');
});

check('相对时间全部向后：今天/明天/3天后/2小时后 均 > 当前时间', () => {
  const results = parseTasks('今天整理笔记；明天背单词；3天后做模拟题；2小时后喝水', NOW);
  assert.strictEqual(results.length, 4);
  results.forEach((t, i) => {
    assert.ok(future(t.deadlineAt), `第${i + 1}条「${t.title}」截止时间必须在未来`);
    assert.ok(!t.isOverdue);
  });
});

check('今天晚上8点（未来时刻）→ 今天20:00 不顺延', () => {
  const [t] = parseTasks('今天晚上8点看网课回放', NOW);
  const d = new Date(t.deadlineAt);
  assert.strictEqual(d.getDate(), 18, '20:00 未过，应保留在今天');
  assert.strictEqual(d.getHours(), 20);
  assert.ok(!t.timeAdjusted);
});

// ---------------------------------------------------------------- 多任务拆分
console.log('\n【3】多任务拆分（分号分隔）');

check('「明早9点交英语作业；2小时后回复客户邮件；周末看电影」→ 3条任务', () => {
  const results = parseTasks('明早9点交英语作业；2小时后回复客户邮件；周末看电影', NOW);
  assert.strictEqual(results.length, 3, `应拆出3条，实际：${results.length}`);

  const [hw, mail, movie] = results;
  assert.strictEqual(new Date(hw.deadlineAt).getDate(), 19, '明早应为明天');
  assert.strictEqual(new Date(hw.deadlineAt).getHours(), 9, '明早9点应为09:00');
  assert.ok(hw.quadrant === 'Q1' || hw.quadrant === 'Q2', `作业应重要，实际：${hw.quadrant}`);

  assert.strictEqual(mail.quadrant, 'Q1', `客户+2小时后应Q1，实际：${mail.quadrant}`);
  assert.strictEqual(movie.quadrant, 'Q4', `看电影应Q4，实际：${movie.quadrant}`);
  results.forEach((t) => assert.ok(future(t.deadlineAt) || t.isOverdue));
});

check('换行分隔同样生效', () => {
  const results = parseTasks('明天交作业\n后天复习考试', NOW);
  assert.strictEqual(results.length, 2);
});

// ---------------------------------------------------------------- 耗时提取
console.log('\n【4】耗时提取');

check('1个半小时 → 90分钟；45分钟 → 45分钟；半小时 → 30分钟', () => {
  const [a] = parseTasks('明天复习高数，大概1个半小时', NOW);
  const [b] = parseTasks('明天整理书桌45分钟', NOW);
  const [c] = parseTasks('明天楼下跑步半小时', NOW);
  assert.strictEqual(a.durationMinutes, 90);
  assert.strictEqual(b.durationMinutes, 45);
  assert.strictEqual(c.durationMinutes, 30);
});

// ---------------------------------------------------------------- 联动校验
console.log('\n【5】联动校验（编辑截止时间后重算象限）');

check('recalcUrgency：过去时间 → 紧急95；24h内 → 紧急80；3天后 → 不紧急25', () => {
  const past = recalcUrgency(new Date(NOW.getTime() - 3600000).toISOString(), 80, NOW);
  const soon = recalcUrgency(new Date(NOW.getTime() + 5 * 3600000).toISOString(), 80, NOW);
  const later = recalcUrgency(new Date(NOW.getTime() + 3 * 86400000).toISOString(), 80, NOW);
  assert.strictEqual(past.urgencyScore, 95);
  assert.ok(past.isOverdueByTime);
  assert.strictEqual(soon.urgencyScore, 80);
  assert.strictEqual(soon.quadrant, 'Q1');
  assert.strictEqual(later.urgencyScore, 25);
  assert.strictEqual(later.quadrant, 'Q2');
});

check('formatDeadlineText：今天/明天/昨天 标签正确', () => {
  assert.ok(formatDeadlineText(new Date('2026-10-18T20:00:00'), NOW).startsWith('今天'));
  assert.ok(formatDeadlineText(new Date('2026-10-19T09:00:00'), NOW).startsWith('明天'));
  assert.ok(formatDeadlineText(new Date('2026-10-17T09:00:00'), NOW).startsWith('昨天'));
});

// ---------------------------------------------------------------- 结果汇总
console.log(`\n结果：${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
