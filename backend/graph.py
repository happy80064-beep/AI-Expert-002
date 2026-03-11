import os
from typing import Iterable

from langchain_core.messages import AIMessage, AnyMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from backend.llm import invoke_chat_completion, normalize_text_content
from backend.state import MeetingState

MAX_ROUNDS = int(os.getenv("EXPERTAI_MAX_ROUNDS", "6"))
SUMMARY_TRIGGER_ROUND = int(os.getenv("EXPERTAI_SUMMARY_TRIGGER_ROUND", "5"))
RECENT_ROUNDS_WINDOW = 2
MEMORY_SUMMARY_LIMIT = 300
FINISH_MARKER = "__MEETING_FINISHED__"


def _extract_message_name(message: AnyMessage) -> str | None:
    if isinstance(message, BaseMessage):
        return message.name
    if isinstance(message, dict):
        name = message.get("name")
        return name if isinstance(name, str) else None
    return None


def _extract_message_content(message: AnyMessage) -> str:
    return normalize_text_content(getattr(message, "content", message)).strip()


def _default_speaker_name(message: AnyMessage) -> str:
    if isinstance(message, HumanMessage):
        return "用户"
    if isinstance(message, AIMessage):
        return "专家"
    if isinstance(message, BaseMessage):
        return message.type
    return "未知角色"


def _speaker_name(message: AnyMessage) -> str:
    return _extract_message_name(message) or _default_speaker_name(message)


def _expert_messages(messages: Iterable[AnyMessage]) -> list[AnyMessage]:
    expert_only: list[AnyMessage] = []
    for message in messages:
        if isinstance(message, AIMessage):
            expert_only.append(message)
    return expert_only


def _recent_dialogue(messages: list[AnyMessage], limit: int = RECENT_ROUNDS_WINDOW) -> list[AnyMessage]:
    return _expert_messages(messages)[-limit:]


def _archived_dialogue(messages: list[AnyMessage], limit: int = RECENT_ROUNDS_WINDOW) -> list[AnyMessage]:
    expert_only = _expert_messages(messages)
    if len(expert_only) <= limit:
        return []
    return expert_only[:-limit]


def _format_dialogue(messages: Iterable[AnyMessage]) -> str:
    lines: list[str] = []
    for message in messages:
        content = _extract_message_content(message)
        if not content:
            continue
        lines.append(f"[{_speaker_name(message)}] {content}")
    return "\n".join(lines)


def _format_blackboard(blackboard: dict[str, str]) -> str:
    if not blackboard:
        return "黑板暂无结论。"
    return "\n".join(f"- {speaker}: {note}" for speaker, note in blackboard.items())


def _truncate_text(text: str, max_length: int) -> str:
    normalized = " ".join(text.split())
    if len(normalized) <= max_length:
        return normalized
    return f"{normalized[: max_length - 1]}…"


def _extract_spoken_experts(messages: Iterable[AnyMessage], experts: list[str]) -> list[str]:
    spoken_experts: list[str] = []
    for message in messages:
        speaker_name = _extract_message_name(message)
        if speaker_name in experts and speaker_name not in spoken_experts:
            spoken_experts.append(speaker_name)
    return spoken_experts


def _pick_next_speaker(state: MeetingState) -> str | None:
    experts = state.get("experts", [])
    if not experts:
        return None

    spoken_experts = _extract_spoken_experts(state.get("messages", []), experts)
    for expert in experts:
        if expert not in spoken_experts:
            return expert

    previous_speaker = state.get("current_speaker")
    if previous_speaker in experts:
        next_index = (experts.index(previous_speaker) + 1) % len(experts)
        return experts[next_index]

    return experts[0]


def _build_expert_system_prompt(current_speaker: str) -> str:
    return (
        f"你现在是{current_speaker}，正在参加一场多专家会议。\n"
        "你不能复述整段历史，也不要输出冗长分析。\n"
        "请优先读取黑板上的已有结论，并结合摘要记忆与最近 2 轮对话，给出你的专业判断。\n"
        "必要时可以针对最近观点做简短回应或反驳。\n"
        "请使用中文作答，字数控制在 180 字以内，并明确你的结论。"
    )


def _build_expert_context(state: MeetingState) -> str:
    memory_summary = state.get("memory_summary", "").strip() or "暂无摘要记忆。"
    recent_dialogue = _format_dialogue(_recent_dialogue(state.get("messages", [])))
    blackboard = _format_blackboard(state.get("blackboard", {}))
    return (
        f"会议主题：\n{state.get('topic', '').strip()}\n\n"
        f"摘要记忆（早期讨论压缩版）：\n{memory_summary}\n\n"
        f"黑板状态（只保留各专家当前最终结论）：\n{blackboard}\n\n"
        f"最近 {RECENT_ROUNDS_WINDOW} 轮对话：\n{recent_dialogue or '暂无最近对话。'}"
    )


def _build_memory_summary_prompt(existing_summary: str, archived_dialogue: str) -> list[BaseMessage]:
    existing = existing_summary or "暂无历史摘要。"
    return [
        SystemMessage(
            content=(
                "你负责维护会议的摘要记忆。"
                "请把给定的历史讨论压缩成不超过 300 字的中文摘要，保留核心共识、关键分歧、风险点和待确认事项。"
                "禁止抄写原文，禁止输出项目符号外的冗余解释。"
            )
        ),
        HumanMessage(
            content=(
                f"现有摘要：\n{existing}\n\n"
                f"需要并入的新历史讨论：\n{archived_dialogue}"
            )
        ),
    ]


def _build_summary_system_prompt() -> str:
    return (
        "你现在是这场会议的主持人兼投资委员会秘书。"
        "你必须基于会议摘要记忆、黑板结论和最近对话，输出一份严谨、可执行、面向管理层的 Markdown 报告。\n\n"
        "强制要求：\n"
        "1. 只能输出 Markdown 正文，不要输出额外寒暄。\n"
        "2. 必须严格包含以下三级标题，标题文字不得改写：\n"
        "### 【核心共识】\n"
        "### 【主要分歧与风险点】\n"
        "### 【各专业维度行动指南 (Action Items)】\n"
        "3. 每个部分都必须有内容；如果信息不足，也要明确写出缺口与补充建议。\n"
        "4. Action Items 必须包含负责人角色、行动建议、优先级、时间窗口。\n"
        "5. 语气必须严格、克制、专业。"
    )


def _build_summary_context(state: MeetingState) -> str:
    transcript = _format_dialogue(state.get("messages", []))
    recent_dialogue = _format_dialogue(_recent_dialogue(state.get("messages", []), limit=4))
    return (
        f"会议主题：\n{state.get('topic', '').strip()}\n\n"
        f"摘要记忆：\n{state.get('memory_summary', '').strip() or '暂无摘要记忆。'}\n\n"
        f"黑板结论：\n{_format_blackboard(state.get('blackboard', {}))}\n\n"
        f"最近对话：\n{recent_dialogue or '暂无最近对话。'}\n\n"
        f"完整会议记录（用于校正细节）：\n{transcript}"
    )


def facilitator_node(state: MeetingState) -> dict[str, object]:
    if state.get("round_count", 0) >= MAX_ROUNDS:
        return {"current_speaker": FINISH_MARKER}

    next_speaker = _pick_next_speaker(state)
    if not next_speaker:
        return {"current_speaker": FINISH_MARKER}

    return {"current_speaker": next_speaker}


async def expert_node(state: MeetingState) -> dict[str, object]:
    current_speaker = state.get("current_speaker", "").strip()
    if not current_speaker or current_speaker == FINISH_MARKER:
        return {}

    response_text = await invoke_chat_completion(
        [
            SystemMessage(content=_build_expert_system_prompt(current_speaker)),
            HumanMessage(content=_build_expert_context(state)),
        ]
    )

    expert_reply = AIMessage(content=response_text, name=current_speaker)
    blackboard = dict(state.get("blackboard", {}))
    blackboard[current_speaker] = _truncate_text(response_text, 120)

    return {
        "messages": [expert_reply],
        "round_count": state.get("round_count", 0) + 1,
        "blackboard": blackboard,
    }


async def memory_manager_node(state: MeetingState) -> dict[str, object]:
    archived_messages = _archived_dialogue(state.get("messages", []))
    if state.get("round_count", 0) <= SUMMARY_TRIGGER_ROUND or not archived_messages:
        return {}

    archived_dialogue = _format_dialogue(archived_messages)
    if not archived_dialogue:
        return {}

    summary_text = await invoke_chat_completion(
        _build_memory_summary_prompt(
            existing_summary=state.get("memory_summary", ""),
            archived_dialogue=archived_dialogue,
        )
    )

    return {
        "memory_summary": _truncate_text(summary_text, MEMORY_SUMMARY_LIMIT),
    }


async def summary_node(state: MeetingState) -> dict[str, object]:
    response_text = await invoke_chat_completion(
        [
            SystemMessage(content=_build_summary_system_prompt()),
            HumanMessage(content=_build_summary_context(state)),
        ]
    )
    return {"summary_report": response_text}


def router(state: MeetingState) -> str:
    if state.get("current_speaker") == FINISH_MARKER:
        return "summary"
    return "expert"


def build_graph():
    builder = StateGraph(MeetingState)

    builder.add_node("facilitator", facilitator_node)
    builder.add_node("expert", expert_node)
    builder.add_node("memory_manager", memory_manager_node)
    builder.add_node("summary", summary_node)

    builder.add_edge(START, "facilitator")
    builder.add_conditional_edges("facilitator", router)
    builder.add_edge("expert", "memory_manager")
    builder.add_edge("memory_manager", "facilitator")
    builder.add_edge("summary", END)

    return builder.compile()


app_graph = build_graph()
