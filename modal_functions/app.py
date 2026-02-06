"""Modal app definition and web endpoint for experiment execution.

Exposes a POST /run-experiment endpoint that:
1. Receives experiment config (JSON)
2. Generates personas from archetypes using Claude
3. Runs all persona responses in parallel
4. Streams results back as newline-delimited JSON (NDJSON)

This is the single entry point for `modal deploy`. All Modal-decorated
functions live here; helper modules (persona_generator, experiment_runner,
sentiment) are pure Python with no Modal dependencies.
"""

import json
import time

import modal

app = modal.App("unheard-experiments")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("anthropic>=0.40.0", "fastapi[standard]")
    .add_local_python_source("modal_functions")
)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("anthropic-key")],
    timeout=120,
    retries=1,
)
def execute_single_persona(
    persona: dict,
    stimulus: str,
    model: str = "claude-sonnet-4-5-20250929",
    temperature: float = 0.7,
    max_tokens: int = 500,
) -> dict:
    """Execute a single persona's response as an isolated Modal function.

    Delegates to the pure-Python helper so this function body stays minimal.
    """
    from anthropic import Anthropic
    from modal_functions.experiment_runner import execute_persona

    client = Anthropic()
    return execute_persona(
        client=client,
        persona=persona,
        stimulus=stimulus,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("anthropic-key")],
    timeout=600,
)
@modal.concurrent(max_inputs=10)
@modal.fastapi_endpoint(method="POST")
def run_experiment(body: dict):
    """Run a complete experiment and stream results as NDJSON.

    Request body:
        experiment_id: str - Unique experiment identifier
        personas: dict - Archetype definitions and generation config
            archetypes: list - Archetype objects with id, name, count, etc.
            count: int - Total persona count
            generationType: str - "standard" or "fromContext"
        stimulus: dict - Prompt template
            template: str - The resolved stimulus text
        execution: dict - Model and execution settings
            model: str - Claude model identifier
            temperature: float - Sampling temperature
            maxTokens: int - Max tokens per response
            timeout: int - Per-response timeout in seconds
        context: dict (optional) - Context files information

    Response: Streaming NDJSON with types:
        status - Progress updates
        persona_generated - Individual persona created
        response_complete - Individual persona response finished
        experiment_complete - All results with aggregate metrics
    """
    from anthropic import Anthropic
    from starlette.responses import StreamingResponse

    from modal_functions.persona_generator import generate_personas

    experiment_id = body.get("experiment_id", "unknown")
    personas_config = body.get("personas", {})
    stimulus_config = body.get("stimulus", {})
    execution_config = body.get("execution", {})
    context_config = body.get("context", {})

    stimulus_text = stimulus_config.get("template", "")
    resp_model = execution_config.get("model", "claude-sonnet-4-5-20250929")
    temperature = execution_config.get("temperature", 0.7)
    max_tokens = execution_config.get("maxTokens", 500)

    # Map config model names to valid Anthropic model IDs
    model_mapping = {
        "claude-sonnet-4-5-20250929": "claude-sonnet-4-5-20250929",
        "claude-haiku-4-5-20251001": "claude-haiku-4-5-20251001",
        "claude-sonnet": "claude-sonnet-4-5-20250929",
        "claude-haiku": "claude-haiku-4-5-20251001",
    }
    resp_model = model_mapping.get(resp_model, resp_model)

    # Use a faster model for persona generation to save time/cost
    generation_model = "claude-haiku-4-5-20251001"

    def stream_results():
        start_time = time.time()
        total_tokens = {"input": 0, "output": 0}

        # Phase 1: Generate personas
        yield _ndjson_line({
            "type": "status",
            "message": "Generating personas...",
            "experiment_id": experiment_id,
        })

        client = Anthropic()

        archetypes = personas_config.get("archetypes", [])
        personas = generate_personas(
            client=client,
            archetypes=archetypes,
            context=context_config,
            model=generation_model,
        )

        for persona in personas:
            yield _ndjson_line({
                "type": "persona_generated",
                "experiment_id": experiment_id,
                "persona_id": persona["id"],
                "name": persona["name"],
                "role": persona["role"],
                "archetype_id": persona["archetype_id"],
                "archetype_name": persona["archetype_name"],
            })

        # Phase 2: Execute all personas in parallel via Modal .map()
        yield _ndjson_line({
            "type": "status",
            "message": f"Running {len(personas)} persona responses in parallel...",
            "experiment_id": experiment_id,
        })

        results = []
        for result in execute_single_persona.map(
            personas,
            kwargs={
                "stimulus": stimulus_text,
                "model": resp_model,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        ):
            results.append(result)
            total_tokens["input"] += result.get("tokens", {}).get("input", 0)
            total_tokens["output"] += result.get("tokens", {}).get("output", 0)

            yield _ndjson_line({
                "type": "response_complete",
                "experiment_id": experiment_id,
                "persona_id": result["persona_id"],
                "persona_name": result["persona_name"],
                "archetype_id": result.get("archetype_id", ""),
                "archetype_name": result.get("archetype_name", ""),
                "response": result["response"],
                "sentiment": result["sentiment"],
                "tokens": result.get("tokens", {}),
                "error": result.get("error"),
            })

        # Phase 3: Compute aggregate metrics
        elapsed = round(time.time() - start_time, 2)
        successful = [r for r in results if r.get("error") is None]
        failed = [r for r in results if r.get("error") is not None]

        sentiments = [r["sentiment"] for r in successful]
        avg_sentiment = (
            round(sum(sentiments) / len(sentiments), 3) if sentiments else 0.0
        )

        # Group results by archetype
        by_archetype = {}
        for r in successful:
            arch = r.get("archetype_name", "unknown")
            if arch not in by_archetype:
                by_archetype[arch] = []
            by_archetype[arch].append(r["sentiment"])

        archetype_sentiments = {
            arch: round(sum(scores) / len(scores), 3)
            for arch, scores in by_archetype.items()
        }

        yield _ndjson_line({
            "type": "experiment_complete",
            "experiment_id": experiment_id,
            "results": results,
            "metrics": {
                "total_personas": len(personas),
                "successful_responses": len(successful),
                "failed_responses": len(failed),
                "avg_sentiment": avg_sentiment,
                "archetype_sentiments": archetype_sentiments,
                "total_tokens": total_tokens,
                "elapsed_seconds": elapsed,
            },
        })

    return StreamingResponse(
        stream_results(),
        media_type="application/x-ndjson",
        headers={
            "X-Experiment-Id": experiment_id,
            "Cache-Control": "no-cache",
        },
    )


def _ndjson_line(data: dict) -> str:
    """Serialize a dict as a single NDJSON line (JSON + newline)."""
    return json.dumps(data, default=str) + "\n"
