export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  // JWT 签名密钥：生产环境请通过环境变量 JWT_SECRET 覆盖
  JWT_SECRET: process.env.JWT_SECRET || 'omniflow-dev-secret-change-me',
  JWT_EXPIRES_IN: '7d',
  // 短信演示模式：未配置 SMS_PROVIDER_KEY 时验证码只打印到控制台
  // 并通过接口回传 devCode；接入真实短信服务后设置该环境变量即可关闭
  SMS_DEV_MODE: !process.env.SMS_PROVIDER_KEY,
} as const;
