# 代码改动说明 —— AI 解析能力补齐迭代

本次迭代核心：补上缺失的**内置自然语言解析能力**（不依赖外部 AI Key），
并严格执行「计划任务时间必须在当前时间之后」的时间约束，同时完善全系统联动。

---

## 一、新增模块位置（重点）

### 核心解析器：`shared/parser/nlpParser.ts`
前后端共用的内置 NLP 解析模块，导出的关键函数：

| 导出 | 说明 |
| --- | --- |
| `parseTasks(input, now)` | 入口。按分号/换行拆分多任务，逐条提取标题、截止时间、预估耗时，判定象限 |
| `recalcUrgency(deadlineAt, importanceScore, now)` | 编辑截止时间后重算紧急度与象限（前端结果卡片联动用） |
| `formatDeadlineText(date, now)` | 生成「今天/明天/昨天 HH:mm」人类可读时间 |

解析规则实现要点：
1. **相对时间全部向后计算**：今天、明天/明早、后天/大后天、N天后、N小时后、
   N分钟后、半小时后、周X/下周X/周末、X月X日（过去的月份日期自动顺延到明年）。
2. **口误过去时间自动顺延**：如下午输入「今天上午9点提交报销单」，识别为
   疑似口误 → 顺延到明天 09:00，并生成 `timeNote` 备注提示用户，**不**标记延期。
3. **仅明确逾期才标记延期**：命中「昨天该交 / 本该 / 已过期 / 已逾期 / 错过了 /
   没来得及…」等表述时，`isOverdue=true`，保留过去截止时间，进入【已延期】统计。
4. **无时间词兜底**：默认 3 小时后截止（含紧急语气词时 2 小时后），保证未来时间。
5. **判定规则（固定）**：紧急 = 截止时间距今 ≤24 小时（当日/几小时内），
   ≥3 天 = 不紧急，已过去 = 延期；重要 = 命中学业/考核/项目交付类关键词，
   娱乐琐事类关键词或默认 = 不重要。象限映射 Q1/Q2/Q3/Q4。

### 后端接口：`backend/routes/ai.ts`
- 新增 `POST /api/ai/parse`：直接调用内置解析器（以服务器当前时间为基准），
  返回 `{ success, data: { tasks: ParsedTask[] } }`。
- 旧的 `/api/ai/classify`（外部大模型接口）保留，不再被前端使用。

---

## 二、类型与数据结构改动

### `shared/types/tasks.ts`
- 新增 `ParsedTask`：`deadlineAt`（ISO 结构化截止时间）、`deadlineText`、
  `isOverdue`、`timeAdjusted`、`timeNote`、`reasoning`。
- `Task` 新增字段：`deadlineAt?`、`timeNote?`。
- `AIClassifyResponse` 保留为 `ParsedTask` 的别名（兼容旧引用）。
- 新增 `AIParseRequest / AIParseResponse`。

### 数据库结构：`backend/db/schema.sql`（新增）
tasks 表（象限、状态、耗时、截止时间、重要/紧急度、解析依据等字段 + 索引 +
计划任务时间约束）。本地运行时任务经 **localStorage**（键 `omniflow_tasks_v2`）
持久化，无需数据库即可启动；schema 供服务端持久化使用。

---

## 三、前端改动

### `frontend/src/hooks/useTasks.ts`（重写）
- `classifyTask` 改调 `/api/ai/parse`；**后端不可用时用同一个内置解析器本地兜底**，
  保证离线可用。
- `pendingResults: ParsedTask[]`：一次解析多条任务，逐条确认或「全部加入规划」。
- 任务持久化到 localStorage，刷新不丢失。
- 每 30 秒扫描：截止时间已过且未完成的任务自动翻转 `status='overdue'`，
  实时联动顶部【已延期】统计与复盘页。
- 今日排期 `scheduleTasksForDay`：仅排「截止时间为今天」的待办任务，
  **排期起点不早于当前时间**（工作时段 08:30-12:00 / 14:00-22:00），
  未来日期任务不占今日时间轴。

### `frontend/src/pages/Index.tsx`（工作台）
- 输入框支持分号分隔多条任务（占位文案已更新示例）。
- 多条解析结果卡片列表：可编辑标题/象限/时长/**截止时间（datetime-local）**；
  修改截止时间后调用 `recalcUrgency` 联动重算紧急度与象限。
- 卡片展示【已延期】红色标记与【时间已顺延】琥珀色备注。
- 顶部统计：今日任务 / 已完成 / 已延期 / 紧急待办，实时联动。

### `frontend/src/components/custom/QuadrantBoard.tsx`
- 任务卡片新增：【已延期】红色徽标与红色边框、【已顺延】琥珀色标记（悬停显示备注）。

### `frontend/src/pages/ScheduleView.tsx`（日程表）
- 延期任务：红色专区单独标记展示（原定时间 + 完成/删除快捷操作）。
- 未来任务：明天及以后的计划任务按截止时间排序展示（明天/后天/M月D日 周X）。
- 周视图：任务按截止日落位到对应日期列（不再只显示今天）。
- 日视图：仅展示今日已排期任务（均在当前时间之后）。

### 其他
- `frontend/vite.config.ts`：新增 `/api` 代理到 `localhost:3000`，本地联调更方便。
- `backend/config/constants.ts`：默认端口 3000。
- `package.json`：新增 `npm run test:parser`。
- 复盘统计页（ReviewView）、设置页（Settings）：无需改动，逾期统计自动生效。

---

## 四、测试用例（演示功能）

`scripts/test-task-parser.ts`（18 条用例，覆盖 PRD 三条核心时间逻辑）：

```bash
npm run test:parser
```

| 分组 | 用例示例 | 验证点 |
| --- | --- | --- |
| 单任务提取 | 明天下午3点前交产品PRD，约2小时 | 明天15:00 / Q2 / 120分钟 |
| | 今天2小时后开项目周会 | 当前+2h / Q1 |
| | 周末刷短视频 | Q4 / 本周六 |
| 核心时间逻辑 | 今天上午9点提交报销单（现已下午） | 顺延到明天9:00 + timeNote，不标延期 |
| | 昨天该交的数学作业 | isOverdue，保留过去时间，计入已延期 |
| | 今天/明天/3天后/2小时后 | 全部基于当前时间向后计算 |
| 多任务拆分 | 明早9点交英语作业；2小时后回复客户邮件；周末看电影 | 拆 3 条，象限 Q1/Q1/Q4 |
| 耗时 | 1个半小时 / 45分钟 / 半小时 | 90 / 45 / 30 分钟 |
| 联动 | recalcUrgency 三档 | 过去=95 / 24h内=80 / 3天后=25 |

> 本次开发环境无 Node.js，测试已在等价 JS 运行时中逐条执行，18/18 全部通过。

---

## 五、本地运行

```bash
# 1. 安装依赖
npm install
cd frontend && npm install && cd ..

# 2. 构建前端
cd frontend && npm run build && cd ..

# 3. 启动后端（同时托管前端静态页，默认 3000 端口）
npm run dev        # 开发模式（tsx watch）
# 或 npm start

# 浏览器访问 http://localhost:3000/plan/
```

前端单独开发调试：`cd frontend && npm run dev`（/api 已代理到 3000；
后端未启动时自动降级为前端内置解析，功能不受影响）。

### 推荐演示输入
```
明天下午3点前交产品PRD，大约需要2小时；2小时后回复客户邮件；3天后准备季度汇报；周末刷短视频放松一下；昨天该交的数学作业；今天上午9点提交报销单
```
一次可看到：多任务拆分、Q1/Q2/Q4 自动归类、延期任务标记、口误时间顺延备注。

---

## 六、注册登录功能（手机号验证码）

登录方式：**手机号 + 短信验证码**，未注册手机号验证通过后自动创建账号（登录即注册），无密码。

### 后端新增 / 改动

| 文件 | 说明 |
| --- | --- |
| `backend/services/verifyCodeService.ts`（新增） | 验证码生成 / 校验：6 位数字、5 分钟有效、同号 60 秒限流、验证通过即销毁；内存存储（可平滑替换 Redis） |
| `backend/services/userService.ts`（重写） | 用户数据层：`backend/db/users.json` 文件持久化，按手机号查找 / 创建用户，昵称缺省「用户+手机号后4位」 |
| `backend/routes/auth.ts`（重写） | `POST /api/auth/send-code` 发送验证码；`POST /api/auth/login` 验证码登录 + 自动注册；`GET /api/auth/me` 当前用户 |
| `backend/middleware/auth.ts`（新增） | `requireAuth` JWT 校验中间件（Authorization: Bearer Token） |
| `backend/config/constants.ts` | 新增 `JWT_SECRET`、`JWT_EXPIRES_IN=7d`、`SMS_DEV_MODE` |

### 短信演示模式（重要）

本地没有真实短信通道，默认运行在演示模式：
1. 点击「获取验证码」后，验证码**直接以弹窗展示**给用户，同时打印在后端控制台（`[SMS][演示模式]`）；
2. 接入真实短信时：在 `verifyCodeService.ts` 的 `sendSmsViaProvider()` 中调用短信服务商 SDK（阿里云 / 腾讯云等），并设置环境变量 `SMS_PROVIDER_KEY=1`——演示弹窗与 devCode 回传自动关闭。

### 前端新增 / 改动

| 文件 | 说明 |
| --- | --- |
| `frontend/src/pages/Auth.tsx`（新增） | 登录/注册页：手机号输入 + 6 位 OTP 验证码输入 + 60 秒倒计时重发，风格与全站一致 |
| `frontend/src/contexts/AuthContext.tsx`（新增） | 登录态管理：JWT + 用户信息持久化（`omniflow_auth_v1`），login / sendCode / logout |
| `frontend/src/App.tsx` | `AuthProvider` 注入 + `RequireAuth` 路由守卫（未登录跳 /auth，登录后回到原页面） |
| `frontend/src/components/custom/Navbar.tsx` | 头像菜单展示账号昵称与脱敏手机号（138\*\*\*\*1234），新增「退出登录」 |
| `frontend/src/hooks/useTasks.ts` | 任务存储键按登录用户隔离（`omniflow_tasks_v2__<userId>`），切换账号数据互不可见；首次登录自动迁移升级前的通用任务数据 |

### 测试流程

1. 启动后端与前端，访问任意页面会跳转到 `/auth`；
2. 输入手机号（如 `13800138000`）→ 获取验证码（弹窗显示演示验证码）→ 输入 6 位验证码 → 登录；
3. 新手机号首次登录自动注册（toast 提示「欢迎加入」）；再次登录提示「欢迎回来」；
4. 头像菜单可查看脱敏手机号并退出登录；退出后刷新仍需登录；
5. 不同手机号登录看到各自独立的任务列表。
