import { Expert, AIModelConfig } from './types';
import { DEFAULT_MANAGED_MODELS } from './modelProviders';

export const INITIAL_EXPERTS: Expert[] = [
  {
    id: 'exp_1',
    name: 'Sarah Chen',
    role: '风险投资',
    avatar: 'https://picsum.photos/seed/sarah/100/100',
    description: '拥有硅谷 15 年经验的资深风险投资家。专注于可扩展性、TAM（总潜在市场）和单位经济效益。擅长瞬间发现商业模式中的漏洞，极其犀利。',
    isCustom: false,
  },
  {
    id: 'exp_2',
    name: 'Marcus Thorne',
    role: '法律合规',
    avatar: 'https://picsum.photos/seed/marcus/100/100',
    description: '专注于并购和知识产权法的资深公司律师。极度规避风险。主要寻找监管陷阱、合规隐患和合同漏洞。',
    isCustom: false,
  },
  {
    id: 'exp_3',
    name: 'Dr. Elena Vosk',
    role: '技术开发',
    avatar: 'https://picsum.photos/seed/elena/100/100',
    description: '前 FAANG 巨头公司 CTO。痴迷于系统架构、技术债务和可扩展性。对技术热词持怀疑态度，只相信工程可行性证明。',
    isCustom: false,
  },
  {
    id: 'exp_4',
    name: 'James Sterling',
    role: '商业咨询',
    avatar: 'https://picsum.photos/seed/james/100/100',
    description: '来自顶尖咨询公司的战略顾问。专注于竞争优势、护城河和上市策略（GTM）。对模糊的价值主张持严厉批评态度。',
    isCustom: false,
  },
  {
    id: 'exp_5',
    name: 'Linda Wu',
    role: '财务融资',
    avatar: 'https://picsum.photos/seed/linda/100/100',
    description: '拥有 IPO 操盘经验的 CFO。专注于现金流、烧钱率和财务预测。极其讨厌没有数据支持的“曲棍球棒”式增长曲线。',
    isCustom: false,
  },
  {
    id: 'exp_6',
    name: '老罗 (Bob)',
    role: '工程建设',
    avatar: 'https://picsum.photos/seed/bob/100/100',
    description: '土木工程和工业建设领域的资深老兵。专注于物流、材料成本、安全法规和项目工期管理，实干派。',
    isCustom: false,
  }
];

export const INITIAL_MODELS: AIModelConfig[] = DEFAULT_MANAGED_MODELS;
