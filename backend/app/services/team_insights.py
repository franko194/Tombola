import json
import os
from pathlib import Path
from typing import Any

import httpx
import certifi
import re

from app.schemas import TeamInsightsOut, TeamsResponse


def load_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv()


def normalize_cloud_url(endpoint: str) -> str:
    normalized = endpoint.strip().rstrip("/")
    if normalized.endswith("/api"):
        return normalized + "/generate"
    if normalized.endswith("/v1/chat/completions") or normalized.endswith("/chat/completions"):
        return normalized
    if normalized.endswith("/generate"):
        return normalized
    return normalized


def parse_cloud_response(data: Any, raw_text: str) -> dict[str, Any]:
    def _strip_code_fence(s: str) -> str:
        if not isinstance(s, str):
            return s
        text = s.strip()
        # Remove ```lang\n...``` or ```...``` fences
        if text.startswith("```") and text.endswith("```"):
            # strip leading ```lang or ```\n
            inner = text[3:]
            if inner.startswith("json"):
                inner = inner[4:]
            # remove one leading newline if present
            if inner.startswith("\n"):
                inner = inner[1:]
            # strip trailing backticks/newlines
            inner = inner.rstrip("`\n\r ")
            return inner.strip()
        return text

    def _extract_json_like(s: str) -> str | None:
        if not isinstance(s, str):
            return None
        # Try fenced ```json { ... } ```
        m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", s, flags=re.S)
        if m:
            return m.group(1)
        # Fallback: extract first {...} span
        start = s.find("{")
        end = s.rfind("}")
        if start != -1 and end != -1 and end > start:
            return s[start:end+1]
        return None

    if isinstance(data, dict) and {"summary", "strengths", "recommendations"}.issubset(data.keys()):
        return data

    if isinstance(data, dict):
        if "choices" in data and isinstance(data["choices"], list) and data["choices"]:
            first_choice = data["choices"][0]
            if isinstance(first_choice, dict):
                message = first_choice.get("message")
                if isinstance(message, dict) and "content" in message:
                    try:
                        cleaned = _strip_code_fence(message["content"])
                        parsed = json.loads(cleaned)
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        # try regex extraction
                        inner = _extract_json_like(message["content"]) or _strip_code_fence(message["content"])
                        if inner:
                            try:
                                parsed = json.loads(inner)
                                if isinstance(parsed, dict):
                                    return parsed
                            except json.JSONDecodeError:
                                pass
                    if isinstance(message["content"], str):
                        try:
                            cleaned = _strip_code_fence(message["content"])
                            parsed = json.loads(cleaned)
                            if isinstance(parsed, dict):
                                return parsed
                        except json.JSONDecodeError:
                            inner = _extract_json_like(message["content"]) or _strip_code_fence(message["content"])
                            if inner:
                                try:
                                    parsed = json.loads(inner)
                                    if isinstance(parsed, dict):
                                        return parsed
                                except json.JSONDecodeError:
                                    pass
                        return {"summary": message["content"], "strengths": [], "recommendations": []}
                if "text" in first_choice and isinstance(first_choice["text"], str):
                    try:
                        cleaned = _strip_code_fence(first_choice["text"])
                        parsed = json.loads(cleaned)
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        inner = _extract_json_like(first_choice["text"]) or _strip_code_fence(first_choice["text"])
                        if inner:
                            try:
                                parsed = json.loads(inner)
                                if isinstance(parsed, dict):
                                    return parsed
                            except json.JSONDecodeError:
                                pass

        content = data.get("output") or data.get("text") or data.get("response") or data.get("output_text") or data.get("content")
        if isinstance(content, dict):
            if {"summary", "strengths", "recommendations"}.issubset(content.keys()):
                return content
            content = content.get("text", "")
        if isinstance(content, str) and content.strip():
            try:
                cleaned = _strip_code_fence(content)
                parsed = json.loads(cleaned)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                inner = _extract_json_like(content) or _strip_code_fence(content)
                if inner:
                    try:
                        parsed = json.loads(inner)
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        pass

        result = data.get("result")
        if isinstance(result, list) and result:
            first = result[0]
            if isinstance(first, dict):
                return parse_cloud_response(first, raw_text)
            if isinstance(first, str):
                try:
                    parsed = json.loads(first)
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    pass

    if isinstance(data, str):
        try:
            cleaned = _strip_code_fence(data)
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            inner = _extract_json_like(data) or _strip_code_fence(data)
            if inner:
                try:
                    parsed = json.loads(inner)
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    pass

    try:
        cleaned = _strip_code_fence(raw_text)
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        inner = _extract_json_like(raw_text) or _strip_code_fence(raw_text)
        if inner:
            try:
                parsed = json.loads(inner)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

    raise ValueError("Could not parse cloud AI response into JSON")


def generate_fallback_team_insights(teams_response: TeamsResponse) -> TeamInsightsOut:
    teams = teams_response.teams
    if not teams:
        return TeamInsightsOut(
            summary="Aun no hay equipos generados para analizar.",
            strengths=[],
            recommendations=["Genera equipos antes de pedir una explicacion de balance."],
            generated_by="local",
        )

    balance = teams_response.balance
    team_summaries = [
        f"{team.name}: promedio {team.average_ai_level}, score {team.total_ai_score}, {len(team.members)} integrantes"
        for team in teams
    ]
    if balance.average_gap <= 0.5:
        balance_comment = "Los equipos quedaron muy equilibrados en promedio de experiencia IA."
    elif balance.average_gap <= 1.0:
        balance_comment = "Los equipos tienen una brecha moderada, aceptable para un workshop mixto."
    else:
        balance_comment = "Existe una brecha relevante entre equipos; conviene revisar si el contexto del reto requiere mentoria adicional."

    return TeamInsightsOut(
        summary=f"{balance_comment} La brecha entre el promedio mas alto y el mas bajo es {balance.average_gap}.",
        strengths=[
            "La asignacion evita concentrar todos los perfiles expertos en un solo equipo.",
            "Los equipos quedan con tamanos comparables y scores visibles para facilitar la revision.",
            "La mezcla de niveles permite que participantes con mas experiencia apoyen a quienes estan empezando.",
        ],
        recommendations=[
            "Usa los promedios como guia, pero considera tambien afinidad de areas si el reto lo requiere.",
            "Pide a los perfiles avanzados que asuman un rol de facilitacion tecnica dentro de cada equipo.",
            f"Resumen operativo: {'; '.join(team_summaries)}.",
        ],
        generated_by="local",
    )


def generate_team_insights(teams_response: TeamsResponse) -> TeamInsightsOut:
    # Prefer the explicitly configured cloud AI endpoint. If it's present
    # attempt a call and only fall back to the local deterministic generator
    # when the cloud call fails. Do not try other providers automatically.
    cloud_url = os.environ.get("CLOUD_AI_URL")
    cloud_api_key = os.environ.get("CLOUD_AI_API_KEY")
    if cloud_url and cloud_api_key:
        try:
            return generate_cloud_team_insights(teams_response, cloud_api_key, cloud_url)
        except Exception as exc:
            try:
                err_path = Path(__file__).resolve().parent.parent / 'last_cloud_error.txt'
                with open(err_path, 'w', encoding='utf-8') as f:
                    import traceback

                    f.write('Cloud AI call failed:\n')
                    traceback.print_exception(type(exc), exc, exc.__traceback__, file=f)
            except Exception:
                pass
            return generate_fallback_team_insights(teams_response)

    # No cloud AI configured: use local fallback only.
    return generate_fallback_team_insights(teams_response)


def generate_cloud_team_insights(teams_response: TeamsResponse, api_key: str, endpoint: str) -> TeamInsightsOut:
    endpoint = normalize_cloud_url(endpoint)
    model = os.environ.get("CLOUD_AI_MODEL", "minimax-m3:cloud")
    payload = {
        "balance": teams_response.balance.model_dump(),
        "teams": [team.model_dump() for team in teams_response.teams],
    }
    prompt = f"""Actua como facilitador senior de workshops de innovacion con IA.
Explica brevemente por que estos equipos estan balanceados para una dinamica corporativa.

Datos:
{json.dumps(payload, ensure_ascii=False)}

Devuelve solo JSON valido con esta forma:
{{
  "summary": "parrafo breve",
  "strengths": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "recommendations": ["recomendacion 1", "recomendacion 2", "recomendacion 3"]
}}"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    is_chat = endpoint.endswith("/v1/chat/completions") or endpoint.endswith("/chat/completions")
    if is_chat:
        request_body = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "temperature": 0.3,
        }
    else:
        request_body = {
            "model": model,
            "prompt": prompt,
            "temperature": 0.3,
            "stream": False,
        }

    # Force skipping TLS verification per user request
    verify_value = False
    with httpx.Client(timeout=60.0, verify=verify_value) as client:
        response = client.post(endpoint, json=request_body, headers=headers)
        response.raise_for_status()
        data = response.json()

    parsed = parse_cloud_response(data, response.text)
    return TeamInsightsOut(
        summary=str(parsed.get("summary", "")).strip(),
        strengths=[str(item).strip() for item in parsed.get("strengths", []) if str(item).strip()],
        recommendations=[str(item).strip() for item in parsed.get("recommendations", []) if str(item).strip()],
        generated_by="cloud",
    )


def generate_ollama_team_insights(teams_response: TeamsResponse, api_key: str) -> TeamInsightsOut:
    model = os.environ.get("OLLAMA_MODEL", "llama2")
    endpoint = f"https://cloud.ollama.com/predict/{model}"
    payload = {
        "balance": teams_response.balance.model_dump(),
        "teams": [team.model_dump() for team in teams_response.teams],
    }
    prompt = f"""
Actua como facilitador senior de workshops de innovacion con IA.
Explica brevemente por que estos equipos estan balanceados para una dinamica corporativa.

Datos:
{json.dumps(payload, ensure_ascii=False)}

Devuelve solo JSON valido con esta forma:
{{
  "summary": "parrafo breve",
  "strengths": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "recommendations": ["recomendacion 1", "recomendacion 2", "recomendacion 3"]
}}
"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    # Force skipping TLS verification per user request
    verify_value = False
    with httpx.Client(timeout=60.0, verify=verify_value) as client:
        response = client.post(endpoint, json=request_body, headers=headers)
        data = response.json()

    # persist raw cloud response for debugging
    try:
        debug_path = Path(__file__).resolve().parent.parent / 'cloud_last_response.txt'
        with open(debug_path, 'w', encoding='utf-8') as f:
            f.write(response.text)
    except Exception:
        pass

    parsed = parse_cloud_response(data, response.text)

    content = None
    if isinstance(data, dict):
        content = data.get("output") or data.get("text")
        if content is None and isinstance(data.get("result"), list):
            first_result = data["result"][0] if data["result"] else {}
            if isinstance(first_result, dict):
                content = first_result.get("content", {}).get("text") or first_result.get("output")
    if content is None:
        content = response.text
    if isinstance(content, list):
        content = "\n".join(str(item) for item in content)

    parsed = json.loads(content)
    return TeamInsightsOut(
        summary=str(parsed.get("summary", "")).strip(),
        strengths=[str(item).strip() for item in parsed.get("strengths", []) if str(item).strip()],
        recommendations=[str(item).strip() for item in parsed.get("recommendations", []) if str(item).strip()],
        generated_by="ollama",
    )


def generate_openai_team_insights(teams_response: TeamsResponse) -> TeamInsightsOut:
    from openai import OpenAI

    client = OpenAI()
    payload = {
        "balance": teams_response.balance.model_dump(),
        "teams": [team.model_dump() for team in teams_response.teams],
    }
    prompt = f"""
Actua como facilitador senior de workshops de innovacion con IA.
Explica brevemente por que estos equipos estan balanceados para una dinamica corporativa.

Datos:
{json.dumps(payload, ensure_ascii=False)}

Devuelve solo JSON valido con esta forma:
{{
  "summary": "parrafo breve",
  "strengths": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "recommendations": ["recomendacion 1", "recomendacion 2", "recomendacion 3"]
}}
"""
    response = client.responses.create(
        model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
        input=prompt,
    )
    content = getattr(response, "output_text", "")
    parsed: dict[str, Any] = json.loads(content)
    return TeamInsightsOut(
        summary=str(parsed.get("summary", "")).strip(),
        strengths=[str(item).strip() for item in parsed.get("strengths", []) if str(item).strip()],
        recommendations=[str(item).strip() for item in parsed.get("recommendations", []) if str(item).strip()],
        generated_by="openai",
    )
