from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class MeetingState(TypedDict):
    """Shared state for the ExpertAI multi-agent meeting graph."""

    topic: str
    experts: list[str]
    messages: Annotated[list[AnyMessage], add_messages]
    current_speaker: str
    round_count: int
    memory_summary: str
    blackboard: dict[str, str]
    summary_report: str
