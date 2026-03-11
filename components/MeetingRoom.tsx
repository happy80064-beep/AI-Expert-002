import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { BookOpenText, FileText, LoaderCircle, MessageSquareMore, Play, Square, Users, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { AIModelConfig } from '../types';
import {
  DEFAULT_MANAGED_MODELS,
  MANAGED_PROVIDER_OPTIONS,
  PROVIDER_ENV_KEYS,
  PROVIDER_MODEL_PRESETS,
  buildManagedModelConfig,
  getManagedProvider,
  resolveDefaultModelId,
  resolveProviderBaseUrl,
} from '../modelProviders';

type ChatMessage = {
  id: string;
  role: 'system' | 'expert';
  speaker: string;
  content: string;
  roundCount?: number;
  streaming?: boolean;
  createdAt: number;
};

type StateEventPayload = {
  type:
    | 'meeting_started'
    | 'speaker_changed'
    | 'round_completed'
    | 'meeting_finished'
    | 'memory_compacted'
    | 'blackboard_updated';
  topic?: string;
  experts?: string[];
  speaker?: string;
  round_count?: number;
  content?: string;
  memory_summary?: string;
  blackboard?: Record<string, string>;
};

type MessageEventPayload = {
  speaker: string;
  delta: string;
  round_count?: number;
};

type SummaryEventPayload = {
  content: string;
  round_count?: number;
  blackboard?: Record<string, string>;
  memory_summary?: string;
};

type DoneEventPayload = {
  status: 'completed';
  round_count?: number;
};

type ErrorEventPayload = {
  message?: string;
};

type MeetingRoomProps = {
  apiBaseUrl?: string;
  initialTopic?: string;
  initialExperts?: string[];
};

const AVATAR_STYLES = [
  'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'bg-sky-100 text-sky-700 ring-sky-200',
  'bg-amber-100 text-amber-700 ring-amber-200',
  'bg-rose-100 text-rose-700 ring-rose-200',
  'bg-violet-100 text-violet-700 ring-violet-200',
  'bg-cyan-100 text-cyan-700 ring-cyan-200',
];

const MODEL_CONFIG_STORAGE_KEY = 'expertai_meeting_model_config';

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const parseExperts = (value: string) => {
  return Array.from(
    new Set(
      value
        .split(/[\n,\uFF0C\u3001]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const speakerStyle = (speaker: string) => {
  const hash = Array.from(speaker).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
};

const getDefaultMeetingModelConfig = (): AIModelConfig => ({
  ...DEFAULT_MANAGED_MODELS[0],
  apiKey: '',
});

const loadStoredMeetingModelConfig = (): AIModelConfig => {
  if (typeof window === 'undefined') {
    return getDefaultMeetingModelConfig();
  }

  try {
    const stored = window.localStorage.getItem(MODEL_CONFIG_STORAGE_KEY);
    if (!stored) {
      return getDefaultMeetingModelConfig();
    }

    return buildManagedModelConfig({
      ...getDefaultMeetingModelConfig(),
      ...JSON.parse(stored),
    });
  } catch {
    return getDefaultMeetingModelConfig();
  }
};

const MeetingRoom: React.FC<MeetingRoomProps> = ({
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
  initialTopic = '',
  initialExperts = ['产品专家', '财务专家', '市场专家'],
}) => {
  const [topic, setTopic] = useState(initialTopic);
  const [expertsInput, setExpertsInput] = useState(initialExperts.join('\n'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [summaryReport, setSummaryReport] = useState('');
  const [memorySummary, setMemorySummary] = useState('');
  const [blackboard, setBlackboard] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [meetingModelConfig, setMeetingModelConfig] = useState<AIModelConfig>(() => loadStoredMeetingModelConfig());

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const experts = useMemo(() => parseExperts(expertsInput), [expertsInput]);
  const managedProvider = getManagedProvider(meetingModelConfig.provider);
  const providerBaseUrl = resolveProviderBaseUrl(managedProvider, meetingModelConfig.baseUrl);
  const providerModelOptions = PROVIDER_MODEL_PRESETS[managedProvider];
  const canStart = topic.trim().length > 0 && experts.length > 0 && !!meetingModelConfig.apiKey?.trim() && !isStreaming;
  const blackboardEntries = Object.entries(blackboard);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, activeSpeaker]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      MODEL_CONFIG_STORAGE_KEY,
      JSON.stringify({
        provider: managedProvider,
        modelId: meetingModelConfig.modelId,
        apiKey: meetingModelConfig.apiKey ?? '',
      }),
    );
  }, [managedProvider, meetingModelConfig.apiKey, meetingModelConfig.modelId]);

  const pushSystemMessage = (content: string) => {
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: 'system',
        speaker: '主持人',
        content,
        createdAt: Date.now(),
      },
    ]);
  };

  const appendExpertDelta = (speaker: string, delta: string, roundCount?: number) => {
    if (!speaker || !delta) {
      return;
    }

    setMessages((current) => {
      const next = [...current];
      const lastMessage = next[next.length - 1];

      if (lastMessage && lastMessage.role === 'expert' && lastMessage.speaker === speaker && lastMessage.streaming) {
        next[next.length - 1] = {
          ...lastMessage,
          content: `${lastMessage.content}${delta}`,
          roundCount,
        };
        return next;
      }

      next.push({
        id: createId(),
        role: 'expert',
        speaker,
        content: delta,
        roundCount,
        streaming: true,
        createdAt: Date.now(),
      });
      return next;
    });
  };

  const finalizeExpertMessage = (speaker: string, content?: string, roundCount?: number) => {
    setMessages((current) => {
      const next = [...current];

      for (let index = next.length - 1; index >= 0; index -= 1) {
        const message = next[index];
        if (message.role === 'expert' && message.speaker === speaker && message.streaming) {
          next[index] = {
            ...message,
            content: content?.trim() ? content : message.content,
            roundCount,
            streaming: false,
          };
          return next;
        }
      }

      if (content?.trim()) {
        next.push({
          id: createId(),
          role: 'expert',
          speaker,
          content,
          roundCount,
          streaming: false,
          createdAt: Date.now(),
        });
      }

      return next;
    });
  };

  const resetMeeting = () => {
    setMessages([]);
    setActiveSpeaker('');
    setError('');
    setSummaryReport('');
    setMemorySummary('');
    setBlackboard({});
    setShowSummary(false);
  };

  const updateMeetingModelConfig = (partial: Partial<AIModelConfig>) => {
    setMeetingModelConfig((current) => buildManagedModelConfig({ ...current, ...partial }));
  };

  const handleProviderChange = (provider: AIModelConfig['provider']) => {
    updateMeetingModelConfig({
      provider,
      modelId: resolveDefaultModelId(provider),
      baseUrl: resolveProviderBaseUrl(provider),
    });
  };

  const stopMeeting = () => {
    if (!selectedModelConfig.apiKey?.trim()) {
      setError('请先填写模型 API Key。');
      return;
    }

    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setActiveSpeaker('');
    pushSystemMessage('会议已手动停止。');
  };

  const startMeeting = async () => {
    const cleanedTopic = topic.trim();
    const cleanedExperts = parseExperts(expertsInput);
    const selectedModelConfig = buildManagedModelConfig(meetingModelConfig);

    if (!cleanedTopic || cleanedExperts.length === 0) {
      setError('请先填写材料内容，并至少提供 1 位专家。');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    resetMeeting();
    setIsStreaming(true);

    try {
      await fetchEventSource(`${apiBaseUrl}/api/start_meeting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: cleanedTopic,
          experts: cleanedExperts,
          modelConfig: {
            provider: selectedModelConfig.provider,
            apiKey: selectedModelConfig.apiKey,
            modelId: selectedModelConfig.modelId,
          },
        }),
        signal: controller.signal,
        openWhenHidden: true,
        async onopen(response) {
          if (!response.ok) {
            throw new Error(`请求失败: ${response.status} ${response.statusText}`);
          }
        },
        onmessage(event) {
          if (!event.data) {
            return;
          }

          const payload = JSON.parse(event.data) as
            | StateEventPayload
            | MessageEventPayload
            | SummaryEventPayload
            | DoneEventPayload
            | ErrorEventPayload;

          if (event.event === 'state') {
            const statePayload = payload as StateEventPayload;

            if (statePayload.type === 'meeting_started') {
              pushSystemMessage(`会议开始，共邀请 ${statePayload.experts?.length ?? cleanedExperts.length} 位专家加入讨论。`);
              return;
            }

            if (statePayload.type === 'speaker_changed' && statePayload.speaker) {
              setActiveSpeaker(statePayload.speaker);
              pushSystemMessage(`${statePayload.speaker} 开始发言。`);
              return;
            }

            if (statePayload.type === 'round_completed' && statePayload.speaker) {
              finalizeExpertMessage(statePayload.speaker, statePayload.content, statePayload.round_count);
              setActiveSpeaker('');
              return;
            }

            if (statePayload.type === 'blackboard_updated' && statePayload.blackboard) {
              setBlackboard(statePayload.blackboard);
              return;
            }

            if (statePayload.type === 'memory_compacted' && statePayload.memory_summary) {
              setMemorySummary(statePayload.memory_summary);
              pushSystemMessage('主持人已压缩早期讨论，上下文切换为“摘要记忆 + 最近 2 轮 + 黑板结论”。');
              return;
            }

            if (statePayload.type === 'meeting_finished') {
              setActiveSpeaker('');
              pushSystemMessage('会议讨论结束，主持人正在生成高管总结报告。');
            }

            return;
          }

          if (event.event === 'message') {
            const messagePayload = payload as MessageEventPayload;
            appendExpertDelta(messagePayload.speaker, messagePayload.delta, messagePayload.round_count);
            return;
          }

          if (event.event === 'summary') {
            const summaryPayload = payload as SummaryEventPayload;
            setSummaryReport(summaryPayload.content);
            setShowSummary(true);
            if (summaryPayload.blackboard) {
              setBlackboard(summaryPayload.blackboard);
            }
            if (summaryPayload.memory_summary) {
              setMemorySummary(summaryPayload.memory_summary);
            }
            pushSystemMessage('高管总结报告已生成。');
            return;
          }

          if (event.event === 'done') {
            setIsStreaming(false);
            setActiveSpeaker('');
            pushSystemMessage('会议流已结束。');
            return;
          }

          if (event.event === 'error') {
            const errorPayload = payload as ErrorEventPayload;
            const nextError = errorPayload.message ?? '会议流发生未知异常。';
            setError(nextError);
            setIsStreaming(false);
            setActiveSpeaker('');
            pushSystemMessage(`连接中断：${nextError}`);
          }
        },
        onclose() {
          setIsStreaming(false);
          setActiveSpeaker('');
          abortRef.current = null;
        },
        onerror(streamError) {
          const nextError = streamError instanceof Error ? streamError.message : '连接失败，请检查后端服务。';
          setError(nextError);
          setIsStreaming(false);
          setActiveSpeaker('');
          abortRef.current = null;
          throw streamError;
        },
      });
    } catch (streamError) {
      if (controller.signal.aborted) {
        return;
      }

      const nextError = streamError instanceof Error ? streamError.message : '启动会议失败。';
      setError(nextError);
      setIsStreaming(false);
      setActiveSpeaker('');
      pushSystemMessage(`启动失败：${nextError}`);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#dfe9e1] px-4 py-6 text-slate-800 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:h-[calc(100vh-3rem)] lg:flex-row">
          <aside className="w-full rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur lg:w-[360px] lg:shrink-0">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <MessageSquareMore size={22} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">ExpertAI</p>
                <h1 className="text-xl font-semibold text-slate-900">多专家会议室</h1>
              </div>
            </div>

            <div className="space-y-5">
              <section className="rounded-3xl bg-[#f7faf7] p-4 ring-1 ring-slate-200/70">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900">项目材料</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    左侧输入背景材料，右侧实时看到多专家会议流和高管总结报告。
                  </p>
                </div>

                <textarea
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="例如：我们正在评估一个面向中小企业的 AI 自动化平台，需要从产品、财务、市场三个角度进行可行性分析。"
                  className="h-64 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </section>

              <section className="rounded-3xl bg-[#f7faf7] p-4 ring-1 ring-slate-200/70">
                <div className="mb-3 flex items-center gap-2">
                  <Users size={16} className="text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-900">参会专家</h2>
                </div>

                <textarea
                  value={expertsInput}
                  onChange={(event) => setExpertsInput(event.target.value)}
                  placeholder={'每行一个专家，例如：\n技术专家\n财务专家\n营销专家'}
                  className="h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  {experts.map((expert) => (
                    <span
                      key={expert}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                    >
                      {expert}
                    </span>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl bg-[#f7faf7] p-4 ring-1 ring-slate-200/70">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-slate-900">模型配置</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    只需要选择提供商、模型并填写你自己的 API Key，系统会自动使用对应的 Base URL。
                  </p>
                </div>

                <div className="grid gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">提供商</label>
                    <select
                      value={managedProvider}
                      onChange={(event) => handleProviderChange(event.target.value as AIModelConfig['provider'])}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    >
                      {MANAGED_PROVIDER_OPTIONS.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">模型</label>
                    <select
                      value={meetingModelConfig.modelId}
                      onChange={(event) => updateMeetingModelConfig({ modelId: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    >
                      {providerModelOptions.map((preset) => (
                        <option key={preset.modelId} value={preset.modelId}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">API Key</label>
                    <input
                      type="password"
                      value={meetingModelConfig.apiKey ?? ''}
                      onChange={(event) => updateMeetingModelConfig({ apiKey: event.target.value })}
                      placeholder="sk-..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>

                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                    <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">Base URL</div>
                    <div className="mt-2 break-all font-mono text-xs text-slate-600">{providerBaseUrl}</div>
                    <div className="mt-2 text-xs text-slate-400">环境变量键：{PROVIDER_ENV_KEYS[managedProvider]}</div>
                  </div>
                </div>
              </section>

              {memorySummary ? (
                <section className="rounded-3xl bg-[#eef7f0] p-4 ring-1 ring-emerald-100">
                  <div className="mb-2 flex items-center gap-2">
                    <BookOpenText size={16} className="text-emerald-600" />
                    <h2 className="text-sm font-semibold text-slate-900">摘要记忆</h2>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{memorySummary}</p>
                </section>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={startMeeting}
                  disabled={!canStart}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Play size={16} />
                  启动会议
                </button>

                <button
                  type="button"
                  onClick={stopMeeting}
                  disabled={!isStreaming}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <Square size={16} />
                  停止
                </button>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              ) : null}
            </div>
          </aside>

          <section className="flex min-h-[640px] flex-1 flex-col overflow-hidden rounded-[32px] border border-white/70 bg-[#eef3ec] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <header className="border-b border-white/80 bg-white/70 px-5 py-4 backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Meeting Flow</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">专家讨论区</h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {summaryReport ? (
                    <button
                      type="button"
                      onClick={() => setShowSummary(true)}
                      className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                    >
                      <FileText size={14} />
                      查看高管报告
                    </button>
                  ) : null}

                  <div className="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                    {messages.filter((message) => message.role === 'expert').length} 条专家消息
                  </div>

                  <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                    {isStreaming ? <LoaderCircle size={14} className="animate-spin" /> : <span className="h-2 w-2 rounded-full bg-slate-300" />}
                    {activeSpeaker ? `${activeSpeaker} 正在输入...` : isStreaming ? '会议进行中' : '等待启动'}
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mx-auto flex max-w-5xl flex-col gap-4">
                {blackboardEntries.length > 0 ? (
                  <div className="rounded-[28px] border border-slate-200 bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className="mb-3 flex items-center gap-2">
                      <BookOpenText size={16} className="text-slate-500" />
                      <h3 className="text-sm font-semibold text-slate-900">黑板结论</h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {blackboardEntries.map(([speaker, note]) => (
                        <div key={speaker} className="rounded-2xl bg-[#f7faf7] px-4 py-3 ring-1 ring-slate-200">
                          <div className="mb-1 text-sm font-semibold text-slate-800">{speaker}</div>
                          <p className="text-sm leading-6 text-slate-600">{note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {messages.length === 0 ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300/70 bg-white/60 px-8 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <MessageSquareMore size={28} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">会议尚未开始</h3>
                    <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
                      在左侧填入项目背景与参会专家，点击“启动会议”后，这里会实时展示主持人调度、专家发言和黑板结论。
                    </p>
                  </div>
                ) : null}

                {messages.map((message) => {
                  if (message.role === 'system') {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <div className="max-w-xl rounded-full bg-white px-4 py-2 text-center text-xs text-slate-500 ring-1 ring-slate-200">
                          {message.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={message.id} className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ${speakerStyle(
                          message.speaker,
                        )}`}
                      >
                        {message.speaker.slice(0, 2)}
                      </div>

                      <div className="max-w-[85%]">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{message.speaker}</span>
                          {message.roundCount ? (
                            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] text-slate-500">
                              第 {message.roundCount} 轮
                            </span>
                          ) : null}
                        </div>

                        <div className="rounded-[22px] rounded-tl-md bg-white px-4 py-3 text-sm leading-7 text-slate-700 shadow-[0_6px_20px_rgba(15,23,42,0.06)] ring-1 ring-slate-200">
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          {message.streaming ? (
                            <div className="mt-3 flex items-center gap-1">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.2s]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.1s]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {activeSpeaker && isStreaming ? (
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ${speakerStyle(
                        activeSpeaker,
                      )}`}
                    >
                      {activeSpeaker.slice(0, 2)}
                    </div>

                    <div className="rounded-[22px] rounded-tl-md bg-[#d8f0dc] px-4 py-3 text-sm text-slate-700 shadow-[0_6px_20px_rgba(15,23,42,0.06)] ring-1 ring-emerald-100">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{activeSpeaker} 正在输入...</span>
                        <div className="flex items-center gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.2s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.1s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </section>
        </div>
      </div>

      {showSummary && summaryReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Executive Summary</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">高管总结报告</h3>
              </div>

              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              <div className="markdown-body prose prose-slate max-w-none prose-headings:font-semibold prose-p:leading-7 prose-li:leading-7">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryReport}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default MeetingRoom;
