import 'dotenv/config';
import express, { ErrorRequestHandler } from 'express';
import path from 'path';

// Stripe related import add here

import aiRoutes from './routes/ai';
import authRoutes from './routes/auth';

// Configuration
import { SERVER_CONFIG } from './config/constants';

// Middleware
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Omniflow embedded preview API compatibility
// Generated previews run in an isolated iframe origin. APIs use bearer tokens,
// so cross-origin cookies and credentials are intentionally not enabled.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

/**
 * Static Files
 */
const REACT_BUILD_FOLDER = path.join(__dirname, '..', 'frontend', 'dist');
app.use(
  express.static(REACT_BUILD_FOLDER, {
    setHeaders: (res, path) => {
      // Disable caching for CSS and JS files to ensure changes are reflected immediately
      if (path.endsWith('.css') || path.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  })
);

app.use(
  '/assets',
  express.static(path.join(REACT_BUILD_FOLDER, 'assets'), {
    setHeaders: (res, path) => {
      // Disable caching for CSS and JS files in assets folder
      if (path.endsWith('.css') || path.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  })
);

// 前端构建时 base 为 /plan/，产物内资源引用形如 /plan/assets/xxx.js。
// 必须把 /plan 前缀也映射到 dist，否则资源请求会落入 SPA 兜底返回 HTML，
// 浏览器拒绝执行导致白屏。
app.use(
  '/plan',
  express.static(REACT_BUILD_FOLDER, {
    setHeaders: (res, path) => {
      if (path.endsWith('.css') || path.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  })
);

// API Routes import here
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * API Routes
 */
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);

/**
 * Install Stripe Routes here
 */

/**
 * SPA Fallback Route
 * Handles client-side routing for React Router
 * Must be registered after all API routes
 */
app.get('*', (_req, res) => {
  res.sendFile(path.join(REACT_BUILD_FOLDER, 'index.html'));
});

/**
 * Error Handler
 * Must be the last middleware
 */
app.use(errorHandler as ErrorRequestHandler);

/**
 * Start Server
 */
app.listen(SERVER_CONFIG.PORT, () => {
  console.log(`Server ready on port ${SERVER_CONFIG.PORT}`);
});

export default app;
