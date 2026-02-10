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
  stockDataContext: string = "",
  // 👇👇👇【关键修复】必须在这里定义参数，否则下面使用时会报错 "holdingCost is not defined"
  holdingCost?: string 
): Promise<string> {
  // 1. 模板变量替换
  // 将 constants.ts 中定义的占位符替换为实际数据
  let finalPrompt = config.systemPrompt;
  
  // 替换股票代码 [[Ticker]] 或 [Ticker]
  finalPrompt = finalPrompt.replace(/\[\[?Ticker\]?\]/gi, stockSymbol.toUpperCase());
  
  // 替换行情数据 [Price Data]
  finalPrompt = finalPrompt.replace(/\[Price Data\]/gi, stockDataContext || "暂无实时行情数据");
  
  // 替换上下文 [Context]
  finalPrompt = finalPrompt.replace(/\[Context\]|\[Knowledge Base Summary\]/gi, context || "暂无前序分析档案 (这是第一步分析)");

  // 替换 [Current Date]
  finalPrompt = finalPrompt.replace(/\[Current Date\]|\[当前日期\]/gi, new Date().toLocaleDateString());

  // 👇【处理持仓成本】
  // 这里使用了 holdingCost 变量，所以上面参数列表必须定义它
  const costInfo = holdingCost && holdingCost.trim() !== '' ? `${holdingCost} (当前持仓均价)` : "N/A (当前为空仓状态)";
  console.log("用户输入持仓成本："+costInfo)
  finalPrompt = finalPrompt.replace(/\[\[?Cost\]?\]/gi, costInfo);

  console.log(`[AI Service] Generating for ${config.title}... Provider: ${config.modelProvider}`);

  try {
    // --- GEMINI ---
    if (config.modelProvider === ModelProvider.GEMINI) {
      const response = await fetch(`${getBackendUrl()}/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.modelName,
          prompt: finalPrompt,
          temperature: config.temperature,
          tools: [{ googleSearch: {} }],
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
    throw error; 
  }
}
