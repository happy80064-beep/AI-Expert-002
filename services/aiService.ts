import * as mammoth from 'mammoth/mammoth.browser';

import { AIModelConfig, AnalysisResult, Expert, StructuredAnalysis, TaskResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const callBackendChat = async (
  messages: ChatMessage[],
  options?: {
    modelConfig?: AIModelConfig;
    jsonMode?: boolean;
  },
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      jsonMode: options?.jsonMode ?? false,
      modelConfig: options?.modelConfig
        ? {
            apiKey: options.modelConfig.apiKey,
            baseUrl: options.modelConfig.baseUrl,
            modelId: options.modelConfig.modelId,
          }
        : undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '';
};

const parseJsonBlock = <T>(text: string, fallback: T): T => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return fallback;
  }

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch (error) {
    console.warn('JSON parse failed:', error);
    return fallback;
  }
};

export const extractContentFromFile = async (file: File): Promise<string> => {
  if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve((event.target?.result as string) || '');
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return `[Word Document Content]\n${result.value}`;
  }

  throw new Error('PDF or image extraction has been disabled on the frontend. Move this workflow to the backend.');
};

export const testModelConnection = async (config: AIModelConfig): Promise<{ success: boolean; msg: string }> => {
  try {
    await callBackendChat([{ role: 'user', content: 'ping' }], { modelConfig: config });
    return { success: true, msg: 'Connected successfully' };
  } catch (error) {
    return {
      success: false,
      msg: error instanceof Error ? error.message : 'Connection failed',
    };
  }
};

export const generateExpertPersona = async (
  role: string,
  customPrompt: string,
  customAvatar?: string,
  customName?: string,
): Promise<Expert> => {
  const responseText = await callBackendChat(
    [
      {
        role: 'system',
        content:
          'You are an expert system designer. Return JSON only with keys name and description.',
      },
      {
        role: 'user',
        content: customName
          ? `Create a persona for ${customName} as a ${role}. ${customPrompt}`
          : `Create a persona for a ${role}. ${customPrompt}`,
      },
    ],
    { jsonMode: true },
  );

  const persona = parseJsonBlock<{ name?: string; description?: string }>(responseText, {});

  return {
    id: `custom_${Date.now()}`,
    name: customName || persona.name || 'New Expert',
    role: role as Expert['role'],
    avatar: customAvatar || `https://picsum.photos/seed/${Date.now()}/100/100`,
    description: persona.description || 'No description available.',
    isCustom: true,
  };
};

export const runExpertTask = async (
  expert: Expert,
  taskDescription: string,
  projectContext: string,
  teamMembers: Expert[] = [],
  _depth = 0,
  modelConfig?: AIModelConfig,
): Promise<TaskResult> => {
  const teammates = teamMembers
    .filter((member) => member.id !== expert.id)
    .map((member) => `- ${member.name} (${member.role})`)
    .join('\n');

  const resultContent = await callBackendChat(
    [
      {
        role: 'system',
        content: `You are ${expert.name}, an expert in ${expert.role}. Respond in Chinese using Markdown.`,
      },
      {
        role: 'user',
        content: [
          `Project context:\n${projectContext}`,
          `Task:\n${taskDescription}`,
          teammates ? `Team members:\n${teammates}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    { modelConfig },
  );

  return {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    expertId: expert.id,
    expertName: expert.name,
    expertAvatar: expert.avatar,
    taskDescription,
    resultContent,
    timestamp: Date.now(),
  };
};

export const runTeamAnalysis = async (
  projectText: string,
  team: Expert[],
  modelConfig: AIModelConfig,
): Promise<AnalysisResult> => {
  const expertsContext = team
    .map((expert) => `Name: ${expert.name}, Role: ${expert.role}, Desc: ${expert.description}`)
    .join('\n');

  const responseText = await callBackendChat(
    [
      {
        role: 'system',
        content:
          'You are an investment committee assistant. Return JSON only with overallScore, riskLevel, summary, expertInsights[].',
      },
      {
        role: 'user',
        content: `Analyze this project:\n${projectText}\n\nExperts:\n${expertsContext}`,
      },
    ],
    {
      modelConfig,
      jsonMode: true,
    },
  );

  const structuredData = parseJsonBlock<StructuredAnalysis | undefined>(responseText, undefined);

  return {
    id: `analysis_${Date.now()}`,
    modelName: modelConfig.name,
    timestamp: Date.now(),
    content: responseText,
    structuredData,
    teamComposition: team.map((expert) => expert.role),
  };
};

export const callOpenAICompatibleAPI = async (
  config: AIModelConfig,
  messages: ChatMessage[],
  jsonMode = false,
): Promise<string> => {
  return callBackendChat(messages, {
    modelConfig: config,
    jsonMode,
  });
};
