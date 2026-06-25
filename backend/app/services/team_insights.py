import json
from pathlib import Path

from app.schemas import TeamInsightsOut, TeamsResponse
from app.services.ai_facilitator_agent import run_facilitator_json


CLOUD_ERROR_FILE = Path(__file__).resolve().parents[1] / "last_cloud_error.txt"


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
    try:
        return generate_cloud_team_insights(teams_response)
    except Exception as exc:
        try:
            with CLOUD_ERROR_FILE.open("w", encoding="utf-8") as f:
                import traceback

                f.write("Facilitator agent cloud call failed. Falling back to local insights.\n")
                traceback.print_exception(type(exc), exc, exc.__traceback__, file=f)
        except Exception:
            pass
        return generate_fallback_team_insights(teams_response)


def generate_cloud_team_insights(teams_response: TeamsResponse, *_args, **_kwargs) -> TeamInsightsOut:
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
    parsed = run_facilitator_json(prompt)
    return TeamInsightsOut(
        summary=str(parsed.get("summary", "")).strip(),
        strengths=[str(item).strip() for item in parsed.get("strengths", []) if str(item).strip()],
        recommendations=[str(item).strip() for item in parsed.get("recommendations", []) if str(item).strip()],
        generated_by="cloud",
    )
