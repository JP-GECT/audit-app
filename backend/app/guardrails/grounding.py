from app.models.schemas import AgentResult


def require_citations(result: AgentResult, retrieved_chunks: list) -> AgentResult:
    if not retrieved_chunks:
        return result.model_copy(
            update={
                "status": "insufficient_data",
                "citations": [],
                "summary": f"{result.summary} (no supporting evidence retrieved)",
            }
        )
    return result
