from app.config import settings


async def explain(prompt: str, context: str = "") -> str:
    if not settings.anthropic_api_key:
        return f"[stub explanation - no ANTHROPIC_API_KEY set] {prompt[:200]}"

    from langchain_anthropic import ChatAnthropic

    llm = ChatAnthropic(model="claude-sonnet-5", api_key=settings.anthropic_api_key)
    response = await llm.ainvoke(f"{context}\n\n{prompt}" if context else prompt)
    return str(response.content)
