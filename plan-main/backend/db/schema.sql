-- Omniflow AI 四象限任务管理系统 - 数据库结构
-- ==================================================================
-- 说明：本地运行时任务数据通过浏览器 localStorage 持久化（键 omniflow_tasks_v2），
--       无需数据库即可启动。本文件提供服务端持久化所需的标准表结构，
--       兼容 PostgreSQL / SQLite（去掉 SERIAL 改为 INTEGER PRIMARY KEY AUTOINCREMENT）。

-- 用户表（手机号验证码登录）
-- 说明：本地运行时用户数据持久化在 backend/db/users.json（见 backend/services/userService.ts），
--       此表结构供后续接入 PostgreSQL 时使用。验证码登录无密码字段；
--       短信验证码为一次性数据，不落库（内存/Redis 存储，见 backend/services/verifyCodeService.ts）。
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(64)  PRIMARY KEY,           -- user_时间戳_随机串
  phone         VARCHAR(20)  NOT NULL UNIQUE,       -- 登录手机号（中国大陆 11 位）
  nickname      VARCHAR(64),                        -- 昵称（缺省「用户+手机号后4位」）
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 任务表（增加归属用户）
-- ALTER TABLE tasks ADD COLUMN user_id VARCHAR(64) REFERENCES users(id);
-- CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id                VARCHAR(64)  PRIMARY KEY,           -- task_时间戳_随机串
  title             VARCHAR(120) NOT NULL,              -- 任务标题（AI 提取）
  quadrant          VARCHAR(2)   NOT NULL               -- 四象限：Q1 重要紧急 / Q2 重要不紧急
                    CHECK (quadrant IN ('Q1','Q2','Q3','Q4')),
  status            VARCHAR(16)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','completed','overdue')),
  duration_minutes  INTEGER      NOT NULL DEFAULT 30,   -- 预估耗时（分钟）
  deadline_at       TIMESTAMPTZ  NOT NULL,              -- 截止时间（计划任务必须 > 创建时的当前时间；
                                                        --   仅明确逾期的任务允许为过去时间）
  deadline_text     VARCHAR(64),                        -- 人类可读时间，如「明天 15:00」
  time_note         TEXT,                               -- 口误时间自动顺延时给用户的提示
  importance_score  SMALLINT     NOT NULL DEFAULT 25,   -- 重要度 0-100（>=60 为重要）
  urgency_score     SMALLINT     NOT NULL DEFAULT 25,   -- 紧急度 0-100（>=60 为紧急）
  ai_reasoning      TEXT,                               -- 解析依据说明
  manually_changed  BOOLEAN      NOT NULL DEFAULT FALSE,-- 象限是否被手动调整过（用于 AI 准确率统计）
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_at ON tasks (deadline_at);
CREATE INDEX IF NOT EXISTS idx_tasks_quadrant    ON tasks (quadrant);

-- 业务约束（PostgreSQL）：普通计划任务不允许落在过去（逾期任务除外）
-- ALTER TABLE tasks ADD CONSTRAINT chk_deadline_future
--   CHECK (status = 'overdue' OR deadline_at > created_at);
