// services/juheService.ts

// 后端代理服务器配置
const BACKEND_API_URL = '/api/stock';

// 扩充接口定义以包含美股/港股字段
export interface StockRealtimeData {
  _market: 'HS' | 'HK' | 'US'; // 后端注入的市场标记
  gid?: string;      // 股票编号
  name: string;      // 股票名称
  
  // 价格字段 (A股用 nowPri, 美/港股用 lastestpri)
  nowPri?: string;     
  lastestpri?: string; 

  formpri?: string;    // 昨收
  openpri?: string;    // 今开
  maxpri?: string;     // 最高
  minpri?: string;     // 最低
  
  traAmount?: string;  // 成交额
  traNumber?: string;  // 成交量
  
  uppic?: string;      // 涨跌额 (美/港股可能用 uppic)
  increase?: string;   // 涨跌额 (A股可能用 increase)
  
  limit?: string;      // 涨跌幅 (美/港股)
  increPer?: string;   // 涨跌幅 (A股)

  // 美股/港股特定字段
  priearn?: string;    // 市盈率
  max52?: string;      // 52周最高
  min52?: string;      // 52周最低
  EPS?: string;        // 每股收益
  
  // A股特定字段 (竞价等)
  competitivePri?: string; 
  reservePri?: string; 
  
  // A股买卖盘口 (可选，简化定义)
  buyOne?: string; buyOnePri?: string;
  sellOne?: string; sellOnePri?: string;
  // ... 其他盘口数据省略，Prompt中使用简略版
}

/**
 * 获取实时股票数据
 * 通过本地后端代理服务器请求聚合数据 API，避免 CORS 问题
 */
export async function fetchStockData(symbol: string, apiKey?: string): Promise<StockRealtimeData | null> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/${symbol}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, apiKey })
    });
    
    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    if (!result.success) {
      return null;
    }

    // 提取股票数据
    // 注意：这里适配了新的后端 stock.js 逻辑，数据直接在 result.data 中
    const stockData = result.data;
    
    // 数据验证：确保必要字段存在
    // 兼容 A股(nowPri) 和 美股/港股(lastestpri)
    const currentPrice = stockData.nowPri || stockData.lastestpri;
    
    if (!stockData || !stockData.name || !currentPrice) {
      console.warn('[AlphaCouncil] 数据校验失败: 缺少价格或名称', stockData);
      return null;
    }

    return stockData as StockRealtimeData;

  } catch (error) {
    console.error('[AlphaCouncil] 获取股票数据失败:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 将原始 JSON 数据格式化为 AI 可读的字符串
 * 根据聚合数据API文档格式优化输出，支持多市场
 */
export function formatStockDataForPrompt(data: StockRealtimeData | null): string {
  if (!data) return "无法获取实时行情数据 (API连接失败或无数据)。";

  // 1. 提取通用字段，处理字段名差异
  const price = data.nowPri || data.lastestpri || "0";
  const changePercent = data.limit || data.increPer || "0";
  const changeAmt = data.uppic || data.increase || "0";
  const open = data.openpri || "N/A";
  const prevClose = data.formpri || "N/A";
  const high = data.maxpri || "N/A";
  const low = data.minpri || "N/A";
  
  // 2. 市场特定信息构建
  let specificInfo = "";
  
  if (data._market === 'US') {
      specificInfo = `
【美股特定数据】
  市盈率 (P/E): ${data.priearn || 'N/A'}
  每股收益 (EPS): ${data.EPS || 'N/A'}
  52周最高: ${data.max52 || 'N/A'}
  52周最低: ${data.min52 || 'N/A'}
      `;
  } else if (data._market === 'HK') {
      specificInfo = `
【港股特定数据】
  市盈率 (P/E): ${data.priearn || 'N/A'}
  52周最高: ${data.max52 || 'N/A'}
  52周最低: ${data.min52 || 'N/A'}
      `;
  } else {
      // A股
      specificInfo = `
【A股特定数据】
  竞买价: ${data.competitivePri || '--'}
  竞卖价: ${data.reservePri || '--'}
      `;
  }

  return `
╔═══════════════════════════════════════════════════════════╗
║           实时行情数据 (${data._market}市场)              ║
╚═══════════════════════════════════════════════════════════╝

【基本信息】
  股票名称: ${data.name}
  股票代码: ${data.gid || 'N/A'}
  当前价格: ${price}
  涨跌幅度: ${parseFloat(changePercent) >= 0 ? '+' : ''}${changePercent}%
  涨跌金额: ${parseFloat(changeAmt) >= 0 ? '+' : ''}${changeAmt}

【价格详情】
  今日开盘: ${open}
  昨日收盘: ${prevClose}
  今日最高: ${high}
  今日最低: ${low}

【成交情况】
  成交量: ${data.traNumber || 'N/A'}
  成交额: ${data.traAmount || 'N/A'}
${specificInfo}
═══════════════════════════════════════════════════════════
  `;
}