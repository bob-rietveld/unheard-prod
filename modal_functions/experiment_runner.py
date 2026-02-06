"""Utility functions for experiment execution.

This module contains helper functions used by the Modal app.
The actual Modal function decorators live in app.py.
"""

import time


def build_persona_system_prompt(persona: dict) -> str:
    """Build a system prompt that puts Claude into character as a persona.

    Args:
        persona: Persona dict with name, role, background, beliefs, etc.

    Returns:
        System prompt string for the Claude API call.
    """
    beliefs_text = persona.get("beliefs", "")
    if isinstance(beliefs_text, list):
        beliefs_text = "\n".join(f"- {b}" for b in beliefs_text)

    return f"""You are {persona['name']}, a {persona['role']}.

Company: {persona.get('company', 'N/A')}

Background:
{persona.get('background', '')}

Your beliefs and values:
{beliefs_text}

Decision-making style: {persona.get('decision_style', '')}

Respond to the following scenario fully in character. Be specific and authentic
to your persona's perspective, experience level, and decision-making style.
Do not break character or acknowledge that you are an AI."""


def execute_persona(
    client,
    persona: dict,
    stimulus: str,
    model: str = "claude-sonnet-4-5-20250929",
    temperature: float = 0.7,
    max_tokens: int = 500,
) -> dict:
    """Execute a single persona's response to the stimulus.

    Args:
        client: Anthropic API client instance.
        persona: Persona dict with name, role, background, beliefs, etc.
        stimulus: The experiment prompt text.
        model: Claude model identifier.
        temperature: Sampling temperature.
        max_tokens: Max response tokens.

    Returns:
        Dict with persona_id, response text, sentiment score, token usage,
        and timing information.
    """
    from modal_functions.sentiment import analyze_sentiment

    start_time = time.time()
    system_prompt = build_persona_system_prompt(persona)

    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": stimulus}],
        )

        response_text = response.content[0].text
        sentiment = analyze_sentiment(response_text)
        elapsed = time.time() - start_time

        return {
            "persona_id": persona["id"],
            "persona_name": persona["name"],
            "archetype_id": persona.get("archetype_id", ""),
            "archetype_name": persona.get("archetype_name", ""),
            "response": response_text,
            "sentiment": sentiment,
            "tokens": {
                "input": response.usage.input_tokens,
                "output": response.usage.output_tokens,
            },
            "model": model,
            "elapsed_seconds": round(elapsed, 2),
            "error": None,
        }

    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "persona_id": persona["id"],
            "persona_name": persona["name"],
            "archetype_id": persona.get("archetype_id", ""),
            "archetype_name": persona.get("archetype_name", ""),
            "response": None,
            "sentiment": 0.0,
            "tokens": {"input": 0, "output": 0},
            "model": model,
            "elapsed_seconds": round(elapsed, 2),
            "error": f"{type(e).__name__}: {str(e)}",
        }
