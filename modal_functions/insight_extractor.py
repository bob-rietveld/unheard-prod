"""AI-powered insight extraction from experiment results.

Takes all persona responses + experiment config and uses Claude to extract
structured insights: themes, recommendations, concerns, and archetype patterns.

This is a pure Python helper module -- no Modal decorators.
"""

import json


def extract_insights(
    client,
    results: list[dict],
    body: dict,
) -> dict:
    """Extract structured insights from all persona responses.

    Args:
        client: Anthropic API client instance.
        results: List of persona result dicts (from Phase 2).
        body: The original request body (experiment config).

    Returns:
        Dict with themes[], recommendations[], concerns[],
        and archetype_patterns{}.
    """
    successful = [r for r in results if r.get("error") is None]
    if not successful:
        return _empty_insights()

    # Build a condensed summary of all responses for Claude
    responses_summary = []
    for r in successful:
        responses_summary.append({
            "persona": r.get("persona_name", "Unknown"),
            "archetype": r.get("archetype_name", "Unknown"),
            "sentiment": r.get("sentiment", 0.0),
            "response": r.get("response", "")[:1000],  # Truncate long responses
        })

    stimulus = body.get("stimulus", {}).get("template", "")

    prompt = f"""Analyze the following experiment results. The experiment asked {len(successful)} synthetic personas to respond to this stimulus:

---
{stimulus[:500]}
---

Here are all persona responses:

{json.dumps(responses_summary, indent=2, default=str)}

Extract the following structured insights as JSON:

1. "themes": An array of objects, each with:
   - "theme": A short label for the theme
   - "count": How many personas touched on this theme
   - "examples": 1-2 brief quotes from responses that illustrate this theme

2. "recommendations": An array of 3-5 actionable recommendation strings for the decision-maker

3. "concerns": An array of objects, each with:
   - "concern": A short description of the concern
   - "frequency": How many personas raised this concern

4. "archetype_patterns": An object keyed by archetype name, each with:
   - "avg_sentiment": Average sentiment score for that archetype
   - "key_themes": 2-3 themes most common in that archetype

Return ONLY valid JSON with these four top-level keys. No markdown, no explanation."""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            json_lines = []
            in_block = False
            for line in lines:
                if line.startswith("```") and not in_block:
                    in_block = True
                    continue
                elif line.startswith("```") and in_block:
                    break
                elif in_block:
                    json_lines.append(line)
            text = "\n".join(json_lines)

        insights = json.loads(text)

        # Ensure expected keys exist
        insights.setdefault("themes", [])
        insights.setdefault("recommendations", [])
        insights.setdefault("concerns", [])
        insights.setdefault("archetype_patterns", {})

        return insights

    except Exception:
        # Fallback: return basic archetype-level analysis computed locally
        return _fallback_insights(successful)


def _empty_insights() -> dict:
    """Return an empty insights structure."""
    return {
        "themes": [],
        "recommendations": [],
        "concerns": [],
        "archetype_patterns": {},
    }


def _fallback_insights(results: list[dict]) -> dict:
    """Compute basic insights without Claude when the API call fails."""
    archetype_patterns = {}
    for r in results:
        arch = r.get("archetype_name", "unknown")
        if arch not in archetype_patterns:
            archetype_patterns[arch] = {"sentiments": [], "key_themes": []}
        archetype_patterns[arch]["sentiments"].append(r.get("sentiment", 0.0))

    for arch, data in archetype_patterns.items():
        sentiments = data["sentiments"]
        archetype_patterns[arch] = {
            "avg_sentiment": round(sum(sentiments) / len(sentiments), 3) if sentiments else 0.0,
            "key_themes": [],
        }

    return {
        "themes": [],
        "recommendations": ["Review individual persona responses for detailed insights."],
        "concerns": [],
        "archetype_patterns": archetype_patterns,
    }
