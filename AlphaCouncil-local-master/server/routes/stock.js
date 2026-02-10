import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// 聚合数据 API 地址
const API_URLS = {
  HS: 'http://web.juhe.cn/finance/stock/hs', // 沪深
  HK: 'http://web.juhe.cn/finance/stock/hk', // 香港
  US: 'http://web.juhe.cn/finance/stock/usa' // 美国
};

function getJuheApiKey() {
  return process.env.JUHE_API_KEY;
}

// 辅助函数：判断市场类型
function detectMarket(symbol) {
  const code = symbol.toLowerCase().trim();
  // 美股：纯字母 (如 aapl)
  if (/^[a-z]+$/.test(code)) return 'US';
  // 港股：5位数字 (如 00700)
  if (/^\d{5}$/.test(code)) return 'HK';
  // 沪深：6位数字 (如 600519) 或 sh/sz开头
  if (/^(sh|sz)?\d{6}$/.test(code)) return 'HS';
  return 'HS'; // 默认为沪深
}

router.post('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { apiKey } = req.body;
    const effectiveApiKey = apiKey || getJuheApiKey();

    if (!effectiveApiKey) {
      return res.status(500).json({ success: false, error: '未配置聚合数据 API Key' });
    }

    const market = detectMarket(symbol);
    let url = '';
    let formattedSymbol = symbol.toLowerCase();

    // 根据文档构建请求 URL
    switch (market) {
      case 'US':
        url = `${API_URLS.US}?gid=${formattedSymbol}&key=${effectiveApiKey}`;
        break;
      case 'HK':
        // 港股API参数名为 num
        url = `${API_URLS.HK}?num=${formattedSymbol}&key=${effectiveApiKey}`;
        break;
      case 'HS':
        // 沪深处理逻辑
        if (!formattedSymbol.startsWith('sh') && !formattedSymbol.startsWith('sz')) {
            formattedSymbol = formattedSymbol.startsWith('6') ? `sh${formattedSymbol}` : `sz${formattedSymbol}`;
        }
        url = `${API_URLS.HS}?gid=${formattedSymbol}&key=${effectiveApiKey}`;
        break;
      default:
        return res.status(400).json({ success: false, error: '不支持的股票代码格式' });
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.resultcode !== '200') {
      return res.status(400).json({ success: false, error: data.reason || 'API 请求失败' });
    }

    // 【核心修复】提取逻辑优化
    // 聚合数据结构通常为: result: [{ data: {...}, gopicture: {...} }]
    const resultObj = data.result && data.result[0];
    
    if (!resultObj) {
         return res.status(400).json({ success: false, error: 'API 返回数据格式异常' });
    }

    // 1. 获取基础行情
    let cleanData = resultObj.data || resultObj; 
    
    // 2. 【关键】合并 K线图 URL (gopicture)
    // 如果存在 gopicture 字段，将其属性展开合并到 cleanData 中
    if (resultObj.gopicture) {
        cleanData = {
            ...cleanData,
            minurl: resultObj.gopicture.minurl,   // 分时
            dayurl: resultObj.gopicture.dayurl,   // 日K
            weekurl: resultObj.gopicture.weekurl, // 周K
            monthurl: resultObj.gopicture.monthurl // 月K
        };
    }

    // 注入市场标记
    cleanData._market = market; 

    return res.json({
      success: true,
      data: cleanData
    });

  } catch (error) {
    console.error('获取股票数据失败:', error);
    return res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

export default router;