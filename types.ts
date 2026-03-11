
export type AIProvider =
  | 'OpenAI'
  | 'Gemini'
  | 'Moonshot'
  | 'DeepSeek'
  | 'Google'
  | 'Aliyun'
  | 'ByteDance'
  | 'Zhipu';

export type ExpertRole = 
  | '商业咨询' 
  | '财务融资' 
  | '风险投资' 
  | '运营操盘' 
  | '法律合规' 
  | '技术开发' 
  | '工程建设' 
  | '市场营销'
  | '自定义';

export interface Expert {
  id: string;
  name: string;
  role: ExpertRole;
  avatar: string; // URL
  description: string; // The prompt/persona
  isCustom: boolean;
}

export interface AIModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  modelId: string; // Actual API model string or internal mapped ID
  isEnabled: boolean;
  apiKey?: string; 
  baseUrl?: string; // Endpoint URL
  corsProxy?: string; // Deprecated legacy field kept for backward compatibility
  isVerified?: boolean; // UI state for connection test
}

export interface ExpertInsight {
  expertName: string;
  role: string;
  score: number; // 0-100 approval rating
  sentiment: 'positive' | 'neutral' | 'negative';
  keyPoint: string; // One sentence summary
}

export interface StructuredAnalysis {
  overallScore: number; // 0-100
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  summary: string;
  expertInsights: ExpertInsight[];
}

export interface AnalysisResult {
  id: string;
  modelName: string;
  timestamp: number;
  content: string; // Markdown content
  structuredData?: StructuredAnalysis; // Optional structured data for visualization
  teamComposition: string[];
}

export interface TaskResult {
  id: string;
  expertId: string;
  expertName: string;
  expertAvatar: string;
  taskDescription: string;
  resultContent: string;
  timestamp: number;
  triggerBy?: string; // Name of the expert who triggered this task autonomously
}

export interface AppState {
  experts: Expert[];
  team: Expert[];
  models: AIModelConfig[];
  projectDescription: string;
  analysisHistory: AnalysisResult[];
}
