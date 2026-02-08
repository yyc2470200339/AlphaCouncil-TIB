// services/geminiService.ts
import { AgentConfig, ApiKeys, ModelProvider } from '../types';

// 后端 AI 代理接口 URL
const getBackendUrl = () => '/api/ai';

/**
 * 核心函数：根据配置生成单个智能体的回复
 * 包含 Prompt 模板变量替换逻辑
 */
export async function generateAgentResponse(
  config: AgentConfig,
  stockSymbol: string,
  apiKeys: ApiKeys,
  context: string = "",
  stockDataContext: string = ""
): Promise<string> {
  // 1. 模板变量替换
  // 将 constants.ts 中定义的占位符替换为实际数据
  let finalPrompt = config.systemPrompt;
  
  // 替换股票代码 [[Ticker]] 或 [Ticker]
  finalPrompt = finalPrompt.replace(/\[\[?Ticker\]?\]/gi, stockSymbol.toUpperCase());
  
  // 替换行情数据 [Price Data]
  finalPrompt = finalPrompt.replace(/\[Price Data\]/gi, stockDataContext || "暂无实时行情数据");
  
  // 替换上下文 [Context] / [Knowledge Base Summary]
  // 如果是第一步(P1)，context可能为空，此时填入提示
  finalPrompt = finalPrompt.replace(/\[Context\]|\[Knowledge Base Summary\]/gi, context || "暂无前序分析档案 (这是第一步分析)");

  // 替换 [Current Date] (如果有)
  finalPrompt = finalPrompt.replace(/\[Current Date\]|\[当前日期\]/gi, new Date().toLocaleDateString());

  console.log(`[AI Service] Generating for ${config.title}... Provider: ${config.modelProvider}`);

  try {
    // 2. 根据模型提供商调用对应的 API
    
    // --- GEMINI ---
    if (config.modelProvider === ModelProvider.GEMINI) {
      const response = await fetch(`${getBackendUrl()}/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.modelName,
          prompt: finalPrompt, // 发送处理后的完整 Prompt
          temperature: config.temperature,
          tools: [{ googleSearch: {} }], // Gemini 启用搜索
          apiKey: apiKeys.gemini
        })
      });

      if (!response.ok) throw new Error(`Gemini API 错误: ${response.statusText}`);
      const data = await response.json();
      return data.text || "生成内容失败 (Gemini)";
    }

    // --- DEEPSEEK ---
    if (config.modelProvider === ModelProvider.DEEPSEEK) {
      const response = await fetch(`${getBackendUrl()}/deepseek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.modelName,
          // DeepSeek 不像 Gemini 有独立的 system/user 区分那么强，
          // 这里我们将处理好的 finalPrompt 作为 user content 发送，
          // 或者可以将 systemPrompt 设为简单的身份定义，这里直接用 finalPrompt 包含所有指令
          systemPrompt: "你是一个专业的金融分析助手。", 
          prompt: finalPrompt,
          temperature: config.temperature,
          apiKey: apiKeys.deepseek
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`DeepSeek API 错误: ${err.error || response.statusText}`);
      }
      const data = await response.json();
      return data.text || "生成内容失败 (DeepSeek)";
    }

    // --- QWEN ---
    if (config.modelProvider === ModelProvider.QWEN) {
      const response = await fetch(`${getBackendUrl()}/qwen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.modelName,
          systemPrompt: "你是一个专业的金融分析助手。",
          prompt: finalPrompt,
          temperature: config.temperature,
          apiKey: apiKeys.qwen
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`Qwen API 错误: ${err.error || response.statusText}`);
      }
      const data = await response.json();
      return data.text || "生成内容失败 (Qwen)";
    }

    return "不支持的模型提供商";

  } catch (error) {
    console.error(`Error generating response for ${config.title}:`, error);
    // 错误处理：抛出以便上层捕获显示
    throw error; 
  }
}