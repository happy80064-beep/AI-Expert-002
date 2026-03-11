# ExpertAI

中文 | [English](#english)

## 中文

### 项目简介

ExpertAI 是一个多智能体协同分析应用。用户输入项目背景材料后，系统会组织多位 AI 专家进行多轮讨论，由主持人控场，并最终输出结构化的 Markdown 高管报告。

当前版本采用前后端分离架构：

- 前端：React + TypeScript + Vite
- 后端：FastAPI + LangGraph + LangChain
- 流式通信：SSE
- 大模型接入：OpenAI 兼容接口，通过 `langchain-openai`

### 核心能力

- 多专家会议流转：主持人分配发言顺序，专家轮流讨论
- 实时流式输出：前端可看到“某专家正在输入”以及逐段返回的内容
- 黑板模式：专家将阶段性结论写入共享黑板，而不是反复读取全部长对话
- 摘要记忆：当会议轮次较长时，后端自动压缩早期讨论内容，降低上下文和 Token 消耗
- 结构化总结：会议结束后自动生成 Markdown 格式高管报告

### 项目结构

```text
.
├─ backend/                  # FastAPI + LangGraph 后端
│  ├─ graph.py               # 多智能体会议图
│  ├─ llm.py                 # LLM 访问封装
│  ├─ main.py                # API 与 SSE 入口
│  ├─ requirements.txt       # Python 依赖
│  └─ state.py               # MeetingState 定义
├─ components/
│  └─ MeetingRoom.tsx        # 前端会议室组件
├─ App.tsx                   # 前端入口
├─ package.json              # 前端依赖与脚本
└─ DEPLOY_ZEABUR.md          # Zeabur 部署文档（中英文）
```

### 本地开发环境

前置要求：

- Node.js 18+
- Python 3.10+

#### 1. 安装前端依赖

```bash
npm install
```

#### 2. 安装后端依赖

```bash
python -m pip install -r backend/requirements.txt
```

#### 3. 配置后端环境变量

如果使用真实模型，请在项目根目录或运行环境中配置：

```bash
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
```

如果你只想先验证完整流程，可以启用假模型模式：

```bash
EXPERTAI_USE_FAKE_LLM=1
```

#### 4. 启动后端

```bash
npm run dev:backend
```

默认地址：

```text
http://127.0.0.1:8000
```

健康检查接口：

```text
http://127.0.0.1:8000/health
```

#### 5. 启动前端

新开一个终端，执行：

```bash
npm run dev:frontend
```

如需显式指定前端调用的后端地址，可设置：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### 主要接口

#### `GET /health`

用于健康检查，正常返回：

```json
{"status":"ok"}
```

#### `POST /api/start_meeting`

启动多专家会议，并通过 SSE 流式返回事件。

请求体示例：

```json
{
  "topic": "请分析一家消费电子企业在欧洲市场扩张的机会与风险。",
  "experts": ["技术专家", "财务专家", "市场专家"]
}
```

返回的关键 SSE 事件包括：

- `state`：状态更新，例如会议开始、切换发言人、黑板更新、摘要压缩
- `message`：专家逐段输出的文本流
- `summary`：最终 Markdown 总结报告
- `done`：会议结束
- `error`：运行错误

#### `POST /api/chat`

后端代理的通用聊天接口，供前端或其他模块统一通过后端访问模型。

### 部署说明

Zeabur 部署文档见：

- [DEPLOY_ZEABUR.md](D:\AI专家\ExpertAI\DEPLOY_ZEABUR.md)

部署时必须注意：

- 前端和后端必须拆成两个服务
- 后端服务的 `Root Directory` 必须是 `backend`
- 前端服务部署仓库根目录
- 前端环境变量 `VITE_API_BASE_URL` 必须指向后端公网 HTTPS 域名

### 自测建议

推荐至少完成以下检查：

- `python -m compileall backend`
- `npm run build`
- 访问 `/health`
- 用 `EXPERTAI_USE_FAKE_LLM=1` 运行一次完整会议流程
- 验证前端能收到 `summary` 事件并渲染 Markdown 报告

---

## English

### Overview

ExpertAI is a multi-agent collaboration app. A user submits source material, the system orchestrates a panel of AI experts, runs a moderated multi-round discussion, and produces a structured executive report in Markdown.

The current architecture is fully separated:

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + LangGraph + LangChain
- Streaming: SSE
- LLM integration: OpenAI-compatible APIs via `langchain-openai`

### Core Features

- Multi-expert discussion workflow with a facilitator controlling turn-taking
- Real-time streaming so the UI can show speaker changes and incremental output
- Blackboard pattern so experts share distilled conclusions instead of rereading long transcripts
- Summarized memory to compress early rounds and reduce token usage in longer meetings
- Final structured Markdown summary for executives

### Project Structure

```text
.
├─ backend/                  # FastAPI + LangGraph backend
│  ├─ graph.py               # Multi-agent meeting graph
│  ├─ llm.py                 # LLM access layer
│  ├─ main.py                # API and SSE entrypoint
│  ├─ requirements.txt       # Python dependencies
│  └─ state.py               # MeetingState definition
├─ components/
│  └─ MeetingRoom.tsx        # Frontend meeting room component
├─ App.tsx                   # Frontend entry
├─ package.json              # Frontend dependencies and scripts
└─ DEPLOY_ZEABUR.md          # Zeabur deployment guide (bilingual)
```

### Local Development

Prerequisites:

- Node.js 18+
- Python 3.10+

#### 1. Install frontend dependencies

```bash
npm install
```

#### 2. Install backend dependencies

```bash
python -m pip install -r backend/requirements.txt
```

#### 3. Configure backend environment variables

For a real model provider, configure:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
```

For end-to-end smoke testing without a real provider:

```bash
EXPERTAI_USE_FAKE_LLM=1
```

#### 4. Start the backend

```bash
npm run dev:backend
```

Default URL:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

#### 5. Start the frontend

Open another terminal and run:

```bash
npm run dev:frontend
```

To explicitly point the frontend to the backend:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Main APIs

#### `GET /health`

Health check endpoint. Expected response:

```json
{"status":"ok"}
```

#### `POST /api/start_meeting`

Starts a multi-expert meeting and streams events over SSE.

Example request body:

```json
{
  "topic": "Analyze the opportunities and risks of a consumer electronics company expanding into Europe.",
  "experts": ["Technical Expert", "Finance Expert", "Market Expert"]
}
```

Important SSE events:

- `state`: lifecycle updates such as meeting start, speaker changes, blackboard updates, and memory compaction
- `message`: incremental expert text output
- `summary`: final Markdown executive report
- `done`: meeting completed
- `error`: runtime error

#### `POST /api/chat`

Generic backend-proxied chat endpoint so the frontend never talks to the model provider directly.

### Deployment

See the Zeabur deployment guide:

- [DEPLOY_ZEABUR.md](D:\AI专家\ExpertAI\DEPLOY_ZEABUR.md)

Key deployment requirements:

- Frontend and backend must be deployed as two separate services
- The backend service `Root Directory` must be `backend`
- The frontend service should deploy from the repository root
- `VITE_API_BASE_URL` must point to the backend public HTTPS domain

### Recommended Validation

At minimum, verify:

- `python -m compileall backend`
- `npm run build`
- `GET /health`
- one complete meeting flow with `EXPERTAI_USE_FAKE_LLM=1`
- frontend rendering of the final `summary` Markdown event
