import { Router, Request, Response } from 'express';
import { createAIService } from '../services/aiService';
import type { AIClassifyRequest, AIClassifyResponse } from '../../shared/types/tasks';

const router = Router();

const CLASSIFY_SYSTEM_PROMPT = `You are an expert time management assistant using the Eisenhower Matrix.
Given a natural language task description, extract and classify the task.

Respond ONLY with valid JSON in this exact format:
{
  "title": "concise task title in the same language as input",
  "quadrant": "Q1" | "Q2" | "Q3" | "Q4",
  "importanceScore": <0-100>,
  "urgencyScore": <0-100>,
  "durationMinutes": <estimated minutes, default 30>,
  "deadline": "<extracted deadline as human-readable string, or null>",
  "reasoning": "<brief explanation in the same language as input>"
}

Quadrant rules:
- Q1 (Important + Urgent): importanceScore >= 60 AND urgencyScore >= 60
- Q2 (Important + Not Urgent): importanceScore >= 60 AND urgencyScore < 60
- Q3 (Not Important + Urgent): importanceScore < 60 AND urgencyScore >= 60
- Q4 (Not Important + Not Urgent): importanceScore < 60 AND urgencyScore < 60

Urgency keywords (high score): today, now, immediately, deadline, urgent, asap, 今天, 此刻, 马上, 立即, 截止, 加急, 尽快
Importance keywords (high score): report, project, exam, meeting, client, goal, 报告, 项目, 考试, 作业, 会议, 客户, 目标
Low importance: entertainment, browsing, casual, 刷视频, 闲聊, 浏览, 娱乐`;

// AI task classification endpoint
router.post('/classify', async (req: Request, res: Response) => {
  try {
    const { input } = req.body as AIClassifyRequest;

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Input is required' });
    }

    const aiService = createAIService();
    const appLink = req.get('Referer') || req.get('Origin') || `${req.protocol}://${req.get('host')}`;

    const responseText = await aiService.chat(input.trim(), CLASSIFY_SYSTEM_PROMPT, appLink);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ success: false, error: 'AI returned invalid format' });
    }

    const parsed: AIClassifyResponse = JSON.parse(jsonMatch[0]);

    // Validate quadrant
    if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(parsed.quadrant)) {
      // Derive from scores
      const imp = parsed.importanceScore >= 60;
      const urg = parsed.urgencyScore >= 60;
      parsed.quadrant = imp && urg ? 'Q1' : imp ? 'Q2' : urg ? 'Q3' : 'Q4';
    }

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Classify error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Classification failed' });
    }
  }
});

export default router;
