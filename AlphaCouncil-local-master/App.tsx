import React, { useState, useRef } from 'react';
import { AgentRole, AnalysisStatus, WorkflowState, ApiKeys, AgentConfig } from './types';
import { generateAgentResponse } from './services/geminiService';
import { fetchStockData, formatStockDataForPrompt } from './services/juheService';
import StockInput from './components/StockInput';
import AgentCard from './components/AgentCard';
import { DEFAULT_AGENTS } from './constants';
// 引入必要的图标
import { 
  RefreshCw, Download, Database, AlertTriangle, 
  LayoutDashboard, BrainCircuit, ShieldCheck, Gavel, Settings2
} from 'lucide-react';

const initialState: WorkflowState = {
  status: AnalysisStatus.IDLE,
  currentStep: 0,
  stockSymbol: '',
  stockDataContext: '',
  outputs: {},
  agentConfigs: JSON.parse(JSON.stringify(DEFAULT_AGENTS)),
  apiKeys: {}
};

const App: React.FC = () => {
  const [state, setState] = useState<WorkflowState>(initialState);
  
  // =================================================================
  // 👇【关键修复】之前漏掉了这两行状态定义，导致报错 holdingCost is not defined
  // =================================================================
  const [includeP6, setIncludeP6] = useState(true); 
  const [holdingCost, setHoldingCost] = useState<string>('');
  // =================================================================

  const reportRef = useRef<HTMLDivElement>(null);

  // 处理配置修改
  const handleConfigChange = (role: AgentRole, newConfig: AgentConfig) => {
    setState(prev => ({
      ...prev,
      agentConfigs: { ...prev.agentConfigs, [role]: newConfig }
    }));
  };

  const handleAnalyze = async (symbol: string, apiKeys: ApiKeys) => {
    // 1. 初始化
    setState(prev => ({
      ...prev,
      status: AnalysisStatus.FETCHING_DATA,
      stockSymbol: symbol,
      apiKeys,
      outputs: {},
      error: undefined
    }));

    try {
      // 2. 获取行情
      const stockData = await fetchStockData(symbol, apiKeys.juhe);
      const stockContext = formatStockDataForPrompt(stockData);
      
      setState(prev => ({ 
          ...prev, 
          status: AnalysisStatus.RUNNING, 
          stockDataContext: stockContext,
          currentStep: 1 
      }));

      // 3. 定义 TIB-OS 线性工作流
      const workflow = [
          AgentRole.P1_RESEARCH,
          AgentRole.P2_STRATEGY,
          AgentRole.P5_BUY
      ];

      // 根据用户选择决定是否加入 P6
      if (includeP6) {
          workflow.push(AgentRole.P6_SELL);
      }

      // 临时存储输出
      let currentOutputs: Partial<Record<AgentRole, string>> = {};

      // 串行执行
      for (let i = 0; i < workflow.length; i++) {
          const role = workflow[i];
          setState(prev => ({ ...prev, currentStep: i + 1 }));

          // 构建上下文
          let context = "";
          if (role === AgentRole.P1_RESEARCH) {
              context = ""; 
          } else {
              context = Object.entries(currentOutputs)
                .map(([r, content]) => `【${state.agentConfigs[r as AgentRole].title} 报告】:\n${content}`)
                .join("\n\n----------------\n\n");
          }

          const config = state.agentConfigs[role];
          
          // 传递持仓成本（仅 P6 需要）
          const currentHoldingCost = (role === AgentRole.P6_SELL && includeP6) ? holdingCost : undefined;

          // 调用生成函数
          const response = await generateAgentResponse(
              config, 
              symbol, 
              apiKeys, 
              context, 
              stockContext,
              currentHoldingCost // 传递成本参数
          );

          // 更新结果
          currentOutputs = { ...currentOutputs, [role]: response };
          setState(prev => ({
              ...prev,
              outputs: currentOutputs
          }));
      }

      setState(prev => ({ ...prev, status: AnalysisStatus.COMPLETED }));

    } catch (error) {
      console.error("Workflow error:", error);
      setState(prev => ({ 
          ...prev, 
          status: AnalysisStatus.ERROR, 
          error: error instanceof Error ? error.message : "未知错误" 
      }));
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const reset = () => {
    setState(prev => ({ ...initialState, apiKeys: prev.apiKeys }));
    setHoldingCost(''); // 重置成本
  };

  // 计算需要渲染的卡片列表
  const getCardsToRender = () => {
      const cards = [AgentRole.P1_RESEARCH, AgentRole.P2_STRATEGY, AgentRole.P5_BUY];
      if (includeP6) {
          cards.push(AgentRole.P6_SELL);
      }
      return cards;
  };

  // 辅助函数
  const isStepLoading = (stepIndex: number) => state.status === AnalysisStatus.RUNNING && state.currentStep === stepIndex;
  const isStepPending = (stepIndex: number) => state.status === AnalysisStatus.IDLE || state.status === AnalysisStatus.FETCHING_DATA || (state.status === AnalysisStatus.RUNNING && state.currentStep < stepIndex);

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* 顶部导航 */}
      <header className="print:hidden border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2 text-white font-bold text-lg">
             <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">TB</div>
             TIB-OS Stock Analyzer
           </div>
           {state.status !== AnalysisStatus.IDLE && (
               <div className="flex gap-2">
                   {state.status === AnalysisStatus.COMPLETED && (
                       <button onClick={handleExportPDF} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-sm transition-colors">
                           <Download className="w-4 h-4" /> 导出报告
                       </button>
                   )}
                   <button onClick={reset} className="flex items-center gap-2 text-slate-400 hover:text-white px-3 py-1.5 rounded text-sm transition-colors border border-slate-700">
                       <RefreshCw className="w-4 h-4" /> 重置
                   </button>
               </div>
           )}
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {state.status === AnalysisStatus.IDLE ? (
           <div className="flex flex-col items-center justify-center mt-20 animate-fade-in-up">
              <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-6">
                 TIB-OS 投资分析系统 v3.0
              </h1>
              <p className="text-slate-400 mb-8 text-center max-w-xl">
                 基于 TIB-OS 核心框架 (P1/P2/P5/P6)。<br/>
                 集成 Gemini 联网调研与 DeepSeek 深度推理，一键生成结构化投研档案。
              </p >
              
              <div className="w-full max-w-2xl">
                  <StockInput onAnalyze={handleAnalyze} disabled={false} />
                  
                  {/* P6 开启/关闭选项 */}
                  <div className="flex flex-col items-center justify-center mt-6 gap-4 animate-fade-in">
                      <div 
                        onClick={() => setIncludeP6(!includeP6)}
                        className="flex items-center gap-2 cursor-pointer group bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-800 hover:border-blue-500/50 transition-all w-fit"
                      >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${includeP6 ? 'bg-blue-600 border-blue-600' : 'border-slate-500 group-hover:border-blue-400'}`}>
                              {includeP6 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className={`text-sm select-none ${includeP6 ? 'text-blue-100' : 'text-slate-400 group-hover:text-slate-300'}`}>
                              启用 P6 - 利润守门员 (卖出/持仓决策)
                          </span>
                      </div>

                      {/* 成本输入框 (修复报错的关键：这里用到了 holdingCost 变量) */}
                      {includeP6 && (
                          <div className="flex items-center gap-3 animate-fade-in-up">
                              <label className="text-slate-400 text-sm">当前持仓成本:</label>
                              <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                  <input 
                                      type="number" 
                                      placeholder="0.00 (选填)"
                                      value={holdingCost} 
                                      onChange={(e) => setHoldingCost(e.target.value)}
                                      className="bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-1.5 pl-6 w-32 focus:outline-none focus:border-blue-500 transition-colors"
                                  />
                              </div>
                              <span className="text-xs text-slate-500">(留空则默认按空仓策略分析)</span>
                          </div>
                      )}
                  </div>
              </div>
           </div>
        ) : (
           <div ref={reportRef} className="print:text-black print:bg-white space-y-8">
              {/* 状态栏 */}
              <div className="flex flex-col gap-2 print:hidden">
                  <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white">
                          分析标的: <span className="text-blue-400">{state.stockSymbol.toUpperCase()}</span>
                      </h2>
                      {state.error && (
                          <div className="flex items-center gap-2 text-red-400 bg-red-400/10 px-3 py-1.5 rounded text-sm">
                              <AlertTriangle className="w-4 h-4" /> {state.error}
                          </div>
                      )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 p-2 rounded w-fit">
                      <Database className="w-3 h-3 text-blue-500" />
                      <span>数据源: 聚合数据 API {state.stockDataContext.includes("无法获取") ? "(离线/Mock)" : "(实时)"}</span>
                  </div>
              </div>

              {/* 报告头部 (打印可见) */}
              <div className="hidden print:block border-b border-black pb-4 mb-8">
                  <h1 className="text-3xl font-bold">
                      {state.stockSymbol.toUpperCase()} 深度分析档案
                  </h1>
                  <p className="text-gray-600 mt-2 text-sm">
                      生成时间: {new Date().toLocaleString()} | 模型: TIB-OS v3.0
                  </p >
                  <div className="mt-4 p-4 bg-gray-100 border border-gray-300 font-mono text-xs">
                      {state.stockDataContext}
                  </div>
              </div>

              {/* 分析卡片流 */}
              <div className="grid grid-cols-1 gap-6">
                  {getCardsToRender().map((role, index) => (
                      <div key={role} className="break-inside-avoid">
                         <AgentCard 
                            config={state.agentConfigs[role]}
                            content={state.outputs[role]}
                            isLoading={state.status === AnalysisStatus.RUNNING && !state.outputs[role] && state.currentStep === index + 1}
                            isPending={state.status === AnalysisStatus.RUNNING && state.currentStep <= index} 
                            isConfigMode={false}
                            onConfigChange={(newConfig) => handleConfigChange(role, newConfig)}
                         />
                      </div>
                  ))}
              </div>
           </div>
        )}
      </main>
      
      <style>{`
        @media print {
          body { background: white; color: black; }
          header, button { display: none !important; }
          .bg-slate-950 { background: white !important; }
          .text-white { color: black !important; }
          .text-slate-400 { color: #666 !important; }
          .bg-slate-900 { background: #f3f4f6 !important; border-color: #ddd !important; }
          .overflow-y-auto { overflow: visible !important; height: auto !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
