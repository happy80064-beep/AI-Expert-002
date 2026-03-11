from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from sse_starlette import EventSourceResponse

try:
    from backend.graph import FINISH_MARKER, app_graph
    from backend.llm import invoke_chat_completion, to_openai_like_response
    from backend.state import MeetingState
except ModuleNotFoundError:
    from graph import FINISH_MARKER, app_graph
    from llm import invoke_chat_completion, to_openai_like_response
    from state import MeetingState


class StartMeetingRequest(BaseModel):
    topic: str = Field(..., min_length=1, description="Discussion topic or source material.")
    experts: list[str] = Field(..., min_length=1, description="Expert role names.")
    modelConfig: ModelConfigPayload | None = None


class ChatMessagePayload(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ModelConfigPayload(BaseModel):
    provider: str | None = None
    apiKey: str | None = None
    baseUrl: str | None = None
    modelId: str | None = None
    temperature: float | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessagePayload]
    modelConfig: ModelConfigPayload | None = None
    jsonMode: bool = False


app = FastAPI(title="ExpertAI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _sse_event(event: str, payload: dict[str, Any]) -> dict[str, str]:
    return {
        "event": event,
        "data": json.dumps(payload, ensure_ascii=False),
    }


def _content_to_text(content: Any) -> str:
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


def _message_to_text(message: Any) -> str:
    return _content_to_text(getattr(message, "content", message))


def _chunk_text(text: str, chunk_size: int = 24) -> list[str]:
    return [text[index : index + chunk_size] for index in range(0, len(text), chunk_size)] or [""]


def _to_langchain_messages(messages: list[ChatMessagePayload]) -> list[SystemMessage | HumanMessage | AIMessage]:
    converted: list[SystemMessage | HumanMessage | AIMessage] = []
    for message in messages:
        if message.role == "system":
            converted.append(SystemMessage(content=message.content))
        elif message.role == "assistant":
            converted.append(AIMessage(content=message.content))
        else:
            converted.append(HumanMessage(content=message.content))
    return converted


async def meeting_streamer(
    topic: str,
    experts: list[str],
    model_config: dict[str, Any] | None,
    request: Request,
) -> AsyncIterator[dict[str, str]]:
    initial_state: MeetingState = {
        "topic": topic,
        "experts": experts,
        "messages": [
            HumanMessage(
                content=f"会议背景材料如下，请各位专家围绕它展开讨论：\n{topic}",
                name="user",
            )
        ],
        "current_speaker": "",
        "round_count": 0,
        "memory_summary": "",
        "blackboard": {},
        "summary_report": "",
        "model_config": model_config or {},
    }

    active_speaker = ""
    completed_rounds = 0
    streamed_text = ""
    has_token_stream = False
    latest_memory_summary = ""
    latest_blackboard: dict[str, str] = {}

    yield _sse_event(
        "state",
        {
            "type": "meeting_started",
            "topic": topic,
            "experts": experts,
            "round_count": completed_rounds,
        },
    )

    try:
        async for mode, chunk in app_graph.astream(
            initial_state,
            stream_mode=["updates", "messages"],
        ):
            if await request.is_disconnected():
                break

            if mode == "updates":
                if not isinstance(chunk, dict):
                    continue

                for node_name, node_update in chunk.items():
                    if not isinstance(node_update, dict):
                        continue

                    if node_name == "facilitator":
                        next_speaker = node_update.get("current_speaker")

                        if next_speaker == FINISH_MARKER:
                            yield _sse_event(
                                "state",
                                {
                                    "type": "meeting_finished",
                                    "round_count": completed_rounds,
                                },
                            )
                            continue

                        if isinstance(next_speaker, str) and next_speaker:
                            active_speaker = next_speaker
                            streamed_text = ""
                            has_token_stream = False
                            yield _sse_event(
                                "state",
                                {
                                    "type": "speaker_changed",
                                    "speaker": active_speaker,
                                    "round_count": completed_rounds + 1,
                                },
                            )

                    if node_name == "expert":
                        round_count = node_update.get("round_count")
                        if isinstance(round_count, int):
                            completed_rounds = round_count

                        blackboard = node_update.get("blackboard")
                        if isinstance(blackboard, dict):
                            latest_blackboard = {str(key): str(value) for key, value in blackboard.items()}
                            yield _sse_event(
                                "state",
                                {
                                    "type": "blackboard_updated",
                                    "blackboard": latest_blackboard,
                                    "speaker": active_speaker,
                                    "round_count": completed_rounds,
                                },
                            )

                        latest_text = ""
                        new_messages = node_update.get("messages", [])
                        if isinstance(new_messages, list) and new_messages:
                            latest_text = _message_to_text(new_messages[-1]).strip()

                        if latest_text and not has_token_stream:
                            for piece in _chunk_text(latest_text):
                                if await request.is_disconnected():
                                    return
                                yield _sse_event(
                                    "message",
                                    {
                                        "speaker": active_speaker,
                                        "delta": piece,
                                        "round_count": completed_rounds,
                                    },
                                )
                                await asyncio.sleep(0)
                            streamed_text = latest_text

                        yield _sse_event(
                            "state",
                            {
                                "type": "round_completed",
                                "speaker": active_speaker,
                                "round_count": completed_rounds,
                                "content": streamed_text or latest_text,
                            },
                        )

                    if node_name == "memory_manager":
                        memory_summary = node_update.get("memory_summary")
                        if isinstance(memory_summary, str) and memory_summary.strip() and memory_summary != latest_memory_summary:
                            latest_memory_summary = memory_summary
                            yield _sse_event(
                                "state",
                                {
                                    "type": "memory_compacted",
                                    "memory_summary": latest_memory_summary,
                                    "round_count": completed_rounds,
                                },
                            )

                    if node_name == "summary":
                        summary_report = node_update.get("summary_report")
                        if isinstance(summary_report, str) and summary_report.strip():
                            yield _sse_event(
                                "summary",
                                {
                                    "content": summary_report,
                                    "round_count": completed_rounds,
                                    "blackboard": latest_blackboard,
                                    "memory_summary": latest_memory_summary,
                                },
                            )

            if mode == "messages":
                if not isinstance(chunk, tuple) or len(chunk) != 2:
                    continue

                message_chunk, metadata = chunk
                if not isinstance(metadata, dict):
                    continue
                if metadata.get("langgraph_node") != "expert":
                    continue

                delta = _message_to_text(message_chunk)
                if not delta:
                    continue

                has_token_stream = True
                streamed_text += delta
                yield _sse_event(
                    "message",
                    {
                        "speaker": active_speaker,
                        "delta": delta,
                        "round_count": completed_rounds + 1,
                    },
                )

        if not await request.is_disconnected():
            yield _sse_event(
                "done",
                {
                    "status": "completed",
                    "round_count": completed_rounds,
                },
            )
    except Exception as exc:
        if not await request.is_disconnected():
            yield _sse_event("error", {"message": str(exc)})


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat")
async def chat_completion(payload: ChatRequest) -> dict[str, Any]:
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    content = await invoke_chat_completion(
        _to_langchain_messages(payload.messages),
        model_config=payload.modelConfig.model_dump(exclude_none=True) if payload.modelConfig else None,
        json_mode=payload.jsonMode,
    )
    return to_openai_like_response(content)


@app.post("/api/start_meeting")
async def start_meeting(
    payload: StartMeetingRequest,
    request: Request,
) -> EventSourceResponse:
    topic = payload.topic.strip()
    experts = [expert.strip() for expert in payload.experts if expert.strip()]
    model_config = payload.modelConfig.model_dump(exclude_none=True) if payload.modelConfig else None

    if not topic:
        raise HTTPException(status_code=400, detail="topic cannot be empty")
    if not experts:
        raise HTTPException(status_code=400, detail="experts cannot be empty")

    return EventSourceResponse(
        meeting_streamer(topic, experts, model_config, request),
        media_type="text/event-stream",
        ping=15,
    )
