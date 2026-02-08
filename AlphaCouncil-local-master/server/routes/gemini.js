import express from 'express';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

// 动态获取环境变量，避免模块加载时机问题
function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY;
}

router.post('/', async (req, res) => {
  try {
    const { model, prompt, temperature, tools, apiKey } = req.body;

    // 优先使用前端传递的 API Key，其次使用环境变量
    const effectiveApiKey = apiKey || getGeminiApiKey();

    if (!effectiveApiKey) {
      return res.status(500).json({
        success: false,
        error: '未配置 Gemini API Key。请在前端输入 API Key 或在服务器设置环境变量 GEMINI_API_KEY'
      });
    }

    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: temperature || 0.7,
        tools: tools || [{ googleSearch: {} }]
      }
    });

    return res.json({
      success: true,
      text: response.text || ''
    });
  } catch (error) {
    console.error('[Gemini] 请求失败:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
