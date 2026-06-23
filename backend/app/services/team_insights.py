import json
import os
from typing import Any

import httpx

from app.schemas import TeamInsightsOut, TeamsResponse


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
    ollama_api_key = os.environ.get("OLLAMA_CLOUD_API_KEY")
    if ollama_api_key:
        try:
            return generate_ollama_team_insights(teams_response, ollama_api_key)
        except Exception:
            return generate_fallback_team_insights(teams_response)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return generate_fallback_team_insights(teams_response)

    try:
        return generate_openai_team_insights(teams_response)
    except Exception:
        return generate_fallback_team_insights(teams_response)


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
    with httpx.Client(timeout=30.0) as client:
        response = client.post(endpoint, json={"prompt": prompt}, headers=headers)
        response.raise_for_status()
        data = response.json()

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
