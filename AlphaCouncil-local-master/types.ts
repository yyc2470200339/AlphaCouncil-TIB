// types.ts

// 智能体角色枚举 (已更新为 TIB-OS 核心流程)
export enum AgentRole {
  P1_RESEARCH = 'P1_RESEARCH', // 个股初始调研
  P2_STRATEGY = 'P2_STRATEGY', // 战场定性
  P5_BUY = 'P5_BUY',           // 买入决策
  P6_SELL = 'P6_SELL'          // 卖出/持有决策
}

// 分析流程状态
export enum AnalysisStatus {
  IDLE = 'IDLE',          // 空闲
  FETCHING_DATA = 'FETCHING_DATA', // 正在获取API数据
  RUNNING = 'RUNNING',    // AI分析进行中
  COMPLETED = 'COMPLETED',// 完成
  ERROR = 'ERROR'         // 出错
}

// 模型提供商
export enum ModelProvider {
  GEMINI = 'GEMINI',
  DEEPSEEK = 'DEEPSEEK',
  QWEN = 'QWEN'
}

// 智能体配置接口
export interface AgentConfig {
  id: AgentRole;
  name: string;        // 英文名
  title: string;       // 中文展示名
  description: string; // 职责描述
  icon: string;        // 图标名
  color: string;       // 主题色
  temperature: number; // 随机性参数
  systemPrompt: string;// 系统提示词 (包含模板变量)
  modelProvider: ModelProvider; // 使用的模型厂商
  modelName: string;   // 具体模型名称
}

// 智能体输出结果
export interface AgentOutput {
  role: AgentRole;
  content: string;
  timestamp: number;
}

// API 密钥存储
export interface ApiKeys {
  gemini?: string;
  deepseek?: string;
  qwen?: string;
  juhe?: string;
}

// 全局工作流状态
export interface SavedReport {
  id: string;             // 唯一ID (时间戳)
  timestamp: number;      // 排序用
  dateStr: string;        // 展示用日期
  symbol: string;         // 股票代码
  stockDataContext: string; // 当时的行情数据
  outputs: Partial<Record<AgentRole, string>>; // 当时的AI分析结果
}
export interface WorkflowState {
  status: AnalysisStatus;
  currentStep: number; // 0: Idle, 1..N: Steps
  stockSymbol: string;
  stockDataContext: string; // 存储格式化后的聚合数据
  outputs: Partial<Record<AgentRole, string>>; // 各智能体的输出内容
  error?: string;
  agentConfigs: Record<AgentRole, AgentConfig>; // 可动态修改的配置
  apiKeys: ApiKeys;
}