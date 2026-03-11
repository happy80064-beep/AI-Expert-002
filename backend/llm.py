import json
import os
from functools import lru_cache
from typing import Any, Sequence

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, BaseMessage
from langchain_openai import ChatOpenAI

load_dotenv()

FAKE_LLM_FLAGS = {"1", "true", "yes", "on"}


def use_fake_llm() -> bool:
    """Enable deterministic local responses for development and testing."""
    return os.getenv("EXPERTAI_USE_FAKE_LLM", "").strip().lower() in FAKE_LLM_FLAGS


def normalize_text_content(content: Any) -> str:
    """Convert LangChain content payloads into plain text."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
            else:
                parts.append(str(item))
        return "".join(parts)
    if isinstance(content, dict):
        text = content.get("text")
        if isinstance(text, str):
            return text
        return json.dumps(content, ensure_ascii=False)
    return str(content)


def _resolve_model_settings(model_config: dict[str, Any] | None = None) -> dict[str, Any]:
    config = model_config or {}
    return {
        "api_key": config.get("apiKey") or os.getenv("OPENAI_API_KEY"),
        "base_url": config.get("baseUrl") or os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_API_BASE"),
        "model": config.get("modelId") or os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "temperature": float(config.get("temperature") or os.getenv("OPENAI_TEMPERATURE", "0.2")),
    }


@lru_cache(maxsize=16)
def _build_model(
    api_key: str,
    base_url: str | None,
    model: str,
    temperature: float,
    json_mode: bool,
) -> ChatOpenAI:
    kwargs: dict[str, Any] = {
        "api_key": api_key,
        "model": model,
        "temperature": temperature,
    }
    if base_url:
        kwargs["base_url"] = base_url
    if json_mode:
        kwargs["model_kwargs"] = {"response_format": {"type": "json_object"}}
    return ChatOpenAI(**kwargs)


def _fake_json_response(text: str) -> str:
    lower_text = text.lower()
    if "overallscore" in lower_text or "expertinsights" in lower_text:
        return json.dumps(
            {
                "overallScore": 78,
                "riskLevel": "Medium",
                "summary": "Mock analysis summary generated without an external LLM.",
                "expertInsights": [
                    {
                        "expertName": "Mock Product Expert",
                        "role": "product",
                        "score": 80,
                        "sentiment": "positive",
                        "keyPoint": "Demand looks credible but execution sequencing matters.",
                    },
                    {
                        "expertName": "Mock Finance Expert",
                        "role": "finance",
                        "score": 72,
                        "sentiment": "neutral",
                        "keyPoint": "Unit economics require validation before scaling.",
                    },
                ],
            },
            ensure_ascii=False,
        )
    if "persona" in lower_text or "expert system designer" in lower_text:
        return json.dumps(
            {
                "name": "Mock Expert",
                "description": "A mock expert persona generated in local fake mode.",
            },
            ensure_ascii=False,
        )
    return json.dumps({"result": "mock"}, ensure_ascii=False)


def _fake_text_response(text: str) -> str:
    if "Action Items" in text or "投资委员会秘书" in text:
        return (
            "### 【核心共识】\n"
            "- 目标市场存在明确需求，但交付节奏与资源约束必须同步校正。\n"
            "- 当前方案适合先做小范围验证，再决定是否扩大投入。\n\n"
            "### 【主要分歧与风险点】\n"
            "- 分歧集中在商业化节奏、投入强度与组织准备度。\n"
            "- 风险主要来自需求验证不足、成本失控与跨团队协同不清。\n\n"
            "### 【各专业维度行动指南 (Action Items)】\n"
            "- 产品负责人：两周内完成核心场景验证，优先级 P0，时间窗口 14 天。\n"
            "- 财务负责人：一周内重算试点期预算与回收周期，优先级 P0，时间窗口 7 天。\n"
            "- 市场负责人：两周内补齐首批目标客户访谈与转化假设，优先级 P1，时间窗口 14 天。"
        )
    if "300字以内" in text or "压缩摘要" in text or "摘要记忆" in text:
        return "前期讨论已压缩：团队初步确认存在需求与试点价值，但对成本结构、交付节奏、风险边界仍有保留。建议保持小范围验证策略，以黑板结论为准推进下一轮决策。"
    if "你现在是" in text and "多专家会议" in text:
        speaker = "专家"
        start = text.find("你现在是")
        if start >= 0:
            end = text.find("，", start)
            if end > start:
                speaker = text[start + 4 : end]
        return f"{speaker}意见：建议基于当前黑板结论先聚焦最关键假设验证，避免一次性铺开。优先确认高价值场景、试点预算与执行负责人。"
    return "Mock response generated in local fake mode."


def fake_completion(messages: Sequence[BaseMessage], json_mode: bool = False) -> str:
    """Generate deterministic content without calling an external model."""
    text = "\n".join(normalize_text_content(message.content) for message in messages)
    if json_mode:
        return _fake_json_response(text)
    return _fake_text_response(text)


async def invoke_chat_completion(
    messages: Sequence[BaseMessage],
    model_config: dict[str, Any] | None = None,
    json_mode: bool = False,
) -> str:
    """Run a chat completion against an OpenAI-compatible backend or fake mode."""
    if use_fake_llm():
        return fake_completion(messages, json_mode=json_mode)

    settings = _resolve_model_settings(model_config)
    api_key = settings["api_key"]
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Configure it, or enable EXPERTAI_USE_FAKE_LLM=1 for local testing."
        )

    model = _build_model(
        api_key=api_key,
        base_url=settings["base_url"],
        model=settings["model"],
        temperature=settings["temperature"],
        json_mode=json_mode,
    )
    response = await model.ainvoke(list(messages))
    return normalize_text_content(response.content).strip()


def to_openai_like_response(content: str) -> dict[str, Any]:
    """Return a minimal OpenAI-compatible response envelope for legacy callers."""
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": content,
                }
            }
        ]
    }
