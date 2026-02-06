"""Generate realistic personas from archetype definitions using Claude API.

Each archetype (e.g. "Seed VC Partner") is expanded into N unique personas
with distinct names, backgrounds, beliefs, and decision-making styles.
"""

import json
import uuid

from anthropic import Anthropic


def generate_personas(
    client: Anthropic,
    archetypes: list[dict],
    context: dict | None = None,
    model: str = "claude-sonnet-4-5-20250929",
) -> list[dict]:
    """Generate full persona profiles from archetype definitions.

    Args:
        client: Anthropic API client.
        archetypes: List of archetype dicts with id, name, count, and optional
            description/characteristics.
        context: Optional experiment context (files, configuration) for
            grounding personas in real data.
        model: Claude model to use for generation.

    Returns:
        List of persona dicts, each with id, name, role, archetype_id,
        archetype_name, background, beliefs, and decision_style.
    """
    all_personas = []

    for archetype in archetypes:
        count = archetype.get("count", 1)
        archetype_id = archetype.get("id", "unknown")
        archetype_name = archetype.get("name", archetype_id)
        description = archetype.get("description", "")
        characteristics = archetype.get("characteristics", [])

        context_section = ""
        if context and context.get("files"):
            context_section = f"\nRelevant context data:\n{json.dumps(context['files'], indent=2, default=str)}"

        characteristics_text = ""
        if characteristics:
            characteristics_text = "\nKey characteristics:\n" + "\n".join(
                f"- {c}" for c in characteristics
            )

        prompt = f"""Generate {count} unique, realistic personas for the archetype "{archetype_name}".

Archetype description: {description}
{characteristics_text}
{context_section}

For each persona, provide a JSON object with these fields:
- "name": A realistic full name (diverse names from different backgrounds)
- "role": Their specific job title
- "company": Company name and brief description
- "background": 2-3 sentences about their professional background
- "beliefs": 2-3 key beliefs or values that drive their decisions
- "decision_style": One sentence describing how they make decisions

Return ONLY a JSON array of {count} persona objects. No other text."""

        response = client.messages.create(
            model=model,
            max_tokens=4096,
            temperature=0.9,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = response.content[0].text.strip()

        # Parse JSON from the response, handling markdown code blocks
        if response_text.startswith("```"):
            # Extract JSON from markdown code block
            lines = response_text.split("\n")
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
            response_text = "\n".join(json_lines)

        try:
            personas_data = json.loads(response_text)
        except json.JSONDecodeError:
            # Fallback: create a basic persona if parsing fails
            personas_data = [
                {
                    "name": f"{archetype_name} #{i + 1}",
                    "role": archetype_name,
                    "company": "Unknown",
                    "background": description or f"A {archetype_name}.",
                    "beliefs": "Makes data-driven decisions.",
                    "decision_style": "Analytical and thorough.",
                }
                for i in range(count)
            ]

        for i, persona_data in enumerate(personas_data[:count]):
            persona = {
                "id": f"{archetype_id}-{uuid.uuid4().hex[:8]}",
                "name": persona_data.get("name", f"{archetype_name} #{i + 1}"),
                "role": persona_data.get("role", archetype_name),
                "archetype_id": archetype_id,
                "archetype_name": archetype_name,
                "company": persona_data.get("company", ""),
                "background": persona_data.get("background", ""),
                "beliefs": persona_data.get("beliefs", ""),
                "decision_style": persona_data.get("decision_style", ""),
            }
            all_personas.append(persona)

    return all_personas
