# ExpertAI Zeabur Deployment Guide | ExpertAI Zeabur 部署指南

## Quick Answer | 先给结论

English:

This project must be deployed to Zeabur as **two separate services in the same Zeabur project**:

1. `expertai-backend` for FastAPI
2. `expertai-web` for React/Vite

Do not deploy the whole repository as one service.

中文：

这个项目在 Zeabur 上必须拆成**同一个 Project 下的两个独立服务**：

1. `expertai-backend`：FastAPI 后端
2. `expertai-web`：React/Vite 前端

不要把整个仓库当成单个服务部署。

## Why `zeabur auth login` May Open a Broken Page | 为什么 `zeabur auth login` 打开后页面异常

English:

Your local global `zeabur` CLI is outdated. The installed version detected locally is `0.2.9`, while the CLI itself reports a newer version is available. Old versions can fail during browser-based authentication.

Use this command instead of the old global binary:

```bash
npx zeabur@latest auth login
```

If the page still does not load:

1. Manually open `https://zeabur.com/en-US/login` and sign in first.
2. Then rerun:

```bash
npx zeabur@latest auth login
```

3. If browser auth still fails, use token login:

```bash
npx zeabur@latest auth login --token <YOUR_ZEABUR_TOKEN>
```

中文：

你本机全局安装的 `zeabur` CLI 版本过旧。当前检测到的是 `0.2.9`，而 CLI 已提示有更新版本。旧版本在浏览器授权流程中很容易出现页面打不开或授权失败的问题。

请优先改用下面的命令，而不是旧的全局命令：

```bash
npx zeabur@latest auth login
```

如果页面还是打不开，请按下面顺序处理：

1. 先手动打开 `https://zeabur.com/en-US/login` 并登录。
2. 登录网页后，再回终端执行：

```bash
npx zeabur@latest auth login
```

3. 如果浏览器授权仍然失败，改用 Token 登录：

```bash
npx zeabur@latest auth login --token <你的_ZEABUR_TOKEN>
```

## Repository | 仓库地址

English:

Deploy this repository:

```text
https://github.com/happy80064-beep/AI-Expert-002
```

中文：

请部署这个 GitHub 仓库：

```text
https://github.com/happy80064-beep/AI-Expert-002
```

## Architecture | 项目架构

English:

This repository contains:

- frontend at repository root
- backend inside `backend/`

Important frontend files:

- `package.json`
- `App.tsx`
- `components/MeetingRoom.tsx`

Important backend files:

- `backend/main.py`
- `backend/graph.py`
- `backend/llm.py`
- `backend/requirements.txt`

中文：

当前仓库结构如下：

- 前端位于仓库根目录
- 后端位于 `backend/`

关键前端文件：

- `package.json`
- `App.tsx`
- `components/MeetingRoom.tsx`

关键后端文件：

- `backend/main.py`
- `backend/graph.py`
- `backend/llm.py`
- `backend/requirements.txt`

## Environment Variables | 环境变量

### Backend Service | 后端服务

English:

Required for real LLM calls:

```text
OPENAI_API_KEY=your_key
```

Optional:

```text
OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
EXPERTAI_MAX_ROUNDS=6
EXPERTAI_SUMMARY_TRIGGER_ROUND=5
```

For smoke testing without a real model:

```text
EXPERTAI_USE_FAKE_LLM=1
```

中文：

如果你要接真实模型，后端至少需要：

```text
OPENAI_API_KEY=your_key
```

可选配置：

```text
OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
EXPERTAI_MAX_ROUNDS=6
EXPERTAI_SUMMARY_TRIGGER_ROUND=5
```

如果你只想先验证部署链路，不接真实模型，可以临时使用：

```text
EXPERTAI_USE_FAKE_LLM=1
```

### Frontend Service | 前端服务

English:

Required:

```text
VITE_API_BASE_URL=https://your-backend-domain.zeabur.app
```

This must point to the **public backend domain**, not a local address and not an internal-only service address.

中文：

前端必须配置：

```text
VITE_API_BASE_URL=https://你的后端公网域名.zeabur.app
```

这个值必须是**后端公网 HTTPS 域名**，不能填本地地址，也不能填浏览器无法访问的内部地址。

## Recommended Deployment Method | 推荐部署方式

English:

Use the Zeabur dashboard with GitHub integration. That is the simplest and most stable path for this repository.

中文：

推荐使用 Zeabur 控制台 + GitHub 集成方式部署，这是当前仓库最稳妥的方案。

## Step 1: Log In to Zeabur | 第一步：登录 Zeabur

English:

Preferred:

```bash
npx zeabur@latest auth login
```

If browser login fails, open:

```text
https://zeabur.com/en-US/login
```

If that still fails, use token login:

```bash
npx zeabur@latest auth login --token <YOUR_ZEABUR_TOKEN>
```

中文：

优先执行：

```bash
npx zeabur@latest auth login
```

如果浏览器登录失败，先打开：

```text
https://zeabur.com/en-US/login
```

如果仍然失败，改用 Token 登录：

```bash
npx zeabur@latest auth login --token <你的_ZEABUR_TOKEN>
```

## Step 2: Link GitHub to Zeabur | 第二步：将 GitHub 关联到 Zeabur

English:

In the Zeabur dashboard:

1. Open `Settings`
2. Open `Integrations`
3. Connect your GitHub account
4. Install the Zeabur GitHub App for the account or organization that owns `AI-Expert-002`

If Zeabur cannot see the repository, the GitHub App installation is usually the missing step.

中文：

在 Zeabur 控制台中：

1. 打开 `Settings`
2. 打开 `Integrations`
3. 绑定你的 GitHub 账号
4. 给拥有 `AI-Expert-002` 仓库的账号或组织安装 Zeabur GitHub App

如果 Zeabur 看不到该仓库，通常就是这一步没有完成。

## Step 3: Create a Zeabur Project | 第三步：创建 Zeabur Project

English:

1. Click `Create Project`
2. Choose a region
3. Enter the empty project workspace

Keep both services in the **same Zeabur project**.

中文：

1. 点击 `Create Project`
2. 选择区域
3. 进入新建的空项目

前后端两个服务建议放在**同一个 Zeabur Project** 下。

## Step 4: Deploy the Backend Service | 第四步：部署后端服务

English:

Create the backend service first.

In the Zeabur project:

1. Click `Deploy New Service`
2. Choose `GitHub`
3. Select repository `AI-Expert-002`
4. Create the service

Then open backend service settings and set:

```text
Root Directory = backend
```

This is mandatory.

Add backend environment variables:

```text
OPENAI_API_KEY=...
OPENAI_BASE_URL=...                 # optional
OPENAI_MODEL=gpt-4o-mini            # optional
OPENAI_TEMPERATURE=0.2              # optional
EXPERTAI_MAX_ROUNDS=6               # optional
EXPERTAI_SUMMARY_TRIGGER_ROUND=5    # optional
```

For smoke testing only:

```text
EXPERTAI_USE_FAKE_LLM=1
```

Zeabur should detect this service as Python automatically because the directory contains `requirements.txt`.

中文：

建议先创建后端服务。

在 Zeabur 项目里：

1. 点击 `Deploy New Service`
2. 选择 `GitHub`
3. 选择仓库 `AI-Expert-002`
4. 创建服务

创建后进入后端服务设置，必须设置：

```text
Root Directory = backend
```

这一步是强制项。

然后添加后端环境变量：

```text
OPENAI_API_KEY=...
OPENAI_BASE_URL=...                 # 可选
OPENAI_MODEL=gpt-4o-mini            # 可选
OPENAI_TEMPERATURE=0.2              # 可选
EXPERTAI_MAX_ROUNDS=6               # 可选
EXPERTAI_SUMMARY_TRIGGER_ROUND=5    # 可选
```

如果只是做联调验证，可临时增加：

```text
EXPERTAI_USE_FAKE_LLM=1
```

因为 `backend` 目录里有 `requirements.txt`，Zeabur 通常会自动识别为 Python 服务。

## Step 5: Expose the Backend Public Domain | 第五步：给后端生成公网域名

English:

In the backend service:

1. Open `Networking` or `Domains`
2. Click `Generate Domain`
3. Get a public URL such as:

```text
https://expertai-backend.zeabur.app
```

Verify:

```text
https://your-backend-domain.zeabur.app/health
```

Expected response:

```json
{"status":"ok"}
```

中文：

在后端服务中：

1. 打开 `Networking` 或 `Domains`
2. 点击 `Generate Domain`
3. 生成一个公网域名，例如：

```text
https://expertai-backend.zeabur.app
```

然后访问：

```text
https://你的后端域名.zeabur.app/health
```

期望返回：

```json
{"status":"ok"}
```

## Step 6: Deploy the Frontend Service | 第六步：部署前端服务

English:

Create a second service from the same repository.

In the same Zeabur project:

1. Click `Deploy New Service`
2. Choose `GitHub`
3. Select repository `AI-Expert-002`
4. Create the service

Then set the frontend root:

```text
Root Directory = /
```

or leave it empty if Zeabur already uses the repo root.

Add:

```text
VITE_API_BASE_URL=https://your-backend-domain.zeabur.app
```

Redeploy after saving environment variables.

Zeabur should detect the repository root as a Node.js/Vite app because it contains `package.json`.

中文：

前端需要作为第二个独立服务，从同一个仓库再次部署一次。

在同一个 Zeabur Project 中：

1. 点击 `Deploy New Service`
2. 选择 `GitHub`
3. 选择仓库 `AI-Expert-002`
4. 创建服务

然后设置前端根目录：

```text
Root Directory = /
```

如果 Zeabur 默认已经识别仓库根目录，也可以保持为空。

再添加前端环境变量：

```text
VITE_API_BASE_URL=https://你的后端公网域名.zeabur.app
```

保存环境变量后重新部署。

因为仓库根目录里有 `package.json`，Zeabur 通常会自动识别为 Node.js / Vite 前端服务。

## Step 7: Expose the Frontend Public Domain | 第七步：给前端生成公网域名

English:

In the frontend service:

1. Open `Networking` or `Domains`
2. Click `Generate Domain`
3. Open the generated URL

The frontend should now call the backend through `VITE_API_BASE_URL`.

中文：

在前端服务中：

1. 打开 `Networking` 或 `Domains`
2. 点击 `Generate Domain`
3. 打开生成的公网地址

此时前端应通过 `VITE_API_BASE_URL` 调用后端。

## Step 8: Production Validation Checklist | 第八步：上线前检查清单

English:

After both services are online, verify:

1. The frontend page loads
2. The meeting can be started
3. SSE messages stream in real time
4. Speaker status appears correctly
5. Blackboard updates appear
6. Memory compaction appears in longer runs
7. The final summary modal renders Markdown

中文：

当前后端都上线后，请至少验证：

1. 前端页面可以正常打开
2. 能成功启动会议
3. SSE 事件能实时返回
4. “专家正在输入”状态显示正常
5. 黑板更新能显示
6. 长轮次情况下能看到摘要记忆压缩
7. 最终总结弹窗能渲染 Markdown 报告

## Recommended Service Names | 推荐服务命名

English:

Recommended names:

```text
expertai-backend
expertai-web
```

中文：

推荐使用：

```text
expertai-backend
expertai-web
```

## Critical Notes | 关键注意事项

### Frontend and Backend Must Be Split | 前后端必须拆分

English:

This is not a single-service deployment.

Correct:

- one Python backend service
- one frontend service

Wrong:

- one service for the whole repository

中文：

这个项目不是单服务部署。

正确方式：

- 一个 Python 后端服务
- 一个前端服务

错误方式：

- 整个仓库只部署成一个服务

### Use the Backend Public Domain in the Frontend | 前端必须使用后端公网域名

English:

Do not use:

- `http://127.0.0.1:8000`
- Zeabur internal-only addresses

Use the public HTTPS backend domain instead.

中文：

前端不要使用：

- `http://127.0.0.1:8000`
- 浏览器无法访问的 Zeabur 内部地址

前端必须使用后端公网 HTTPS 域名。

### If Backend Deploys but Model Calls Fail | 如果后端能启动但模型调用失败

English:

Usually this means:

- `OPENAI_API_KEY` is missing
- `OPENAI_BASE_URL` is wrong
- the upstream model provider is not actually OpenAI-compatible

Use `EXPERTAI_USE_FAKE_LLM=1` first if you need to verify the deployment pipeline.

中文：

通常原因包括：

- `OPENAI_API_KEY` 未配置
- `OPENAI_BASE_URL` 配置错误
- 上游模型服务并不兼容 OpenAI 标准接口

如果你只是验证部署链路，可以先使用 `EXPERTAI_USE_FAKE_LLM=1`。

## Troubleshooting | 常见问题排查

### Problem: `zeabur auth login` opens a broken page | 问题：`zeabur auth login` 打开页面异常

English:

Try in this order:

1. `npx zeabur@latest auth login`
2. Sign in first at `https://zeabur.com/en-US/login`
3. `npx zeabur@latest auth login --token <TOKEN>`

中文：

建议按这个顺序尝试：

1. `npx zeabur@latest auth login`
2. 先打开 `https://zeabur.com/en-US/login` 登录
3. `npx zeabur@latest auth login --token <TOKEN>`

### Problem: Zeabur deploys the wrong part of the repo | 问题：Zeabur 识别错了仓库目录

English:

Check `Root Directory`:

- backend service: `backend`
- frontend service: repository root

中文：

检查 `Root Directory`：

- 后端服务：`backend`
- 前端服务：仓库根目录

### Problem: Frontend loads but meeting start fails | 问题：前端能打开，但无法启动会议

English:

Check:

- the backend public domain is reachable
- `VITE_API_BASE_URL` is correct
- `/health` works
- backend environment variables are set

中文：

请检查：

- 后端公网域名是否可访问
- `VITE_API_BASE_URL` 是否正确
- `/health` 是否正常
- 后端环境变量是否配置完整

### Problem: No real AI output | 问题：没有真实 AI 输出

English:

Check backend logs first. Most common causes:

- missing `OPENAI_API_KEY`
- wrong `OPENAI_BASE_URL`
- upstream timeout or provider mismatch

中文：

先看后端日志。最常见原因是：

- `OPENAI_API_KEY` 缺失
- `OPENAI_BASE_URL` 错误
- 上游超时或模型供应商接口不兼容

## Official References | 官方参考

- Zeabur CLI deploy: https://zeabur.com/docs/en-US/deploy/deploy-in-cli
- Zeabur custom root directory: https://zeabur.com/docs/en-US/deploy/root-directory
- Zeabur Python guide: https://zeabur.com/docs/en-US/guides/python
- Zeabur public networking: https://zeabur.com/docs/en-US/networking/public
- Zeabur GitHub integration: https://zeabur.com/docs/en-US/deploy/github
- Zeabur CLI repository: https://github.com/zeabur/cli
