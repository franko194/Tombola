import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.models import EvaluationCriterion, Judge, SessionModel, TeamScore
from app.routers.evaluation import build_ranking
from app.routers.results import serialize_assignments
from app.routers.teams import serialize_teams
from app.schemas import EvaluationReportOut, TeamJudgeFeedbackOut
from app.services.ai_facilitator_agent import run_facilitator_json
from app.services.team_insights import generate_fallback_team_insights

REPORT_ERROR_FILE = Path(__file__).resolve().parents[1] / "last_report_error.txt"


def _score_label(score: float) -> str:
    if score >= 4.5:
        return "sobresaliente"
    if score >= 3.8:
        return "solido"
    if score >= 3:
        return "correcto"
    if score > 0:
        return "con oportunidades claras de mejora"
    return "sin votos registrados"


def _collect_report_context(db: Session, session: SessionModel) -> dict[str, Any]:
    teams = serialize_teams(db, session.id).teams
    assignments = serialize_assignments(db, session.id)
    ranking = build_ranking(db, session.id)
    criteria = (
        db.query(EvaluationCriterion)
        .filter(EvaluationCriterion.session_id == session.id, EvaluationCriterion.active == True)  # noqa: E712
        .order_by(EvaluationCriterion.order, EvaluationCriterion.id)
        .all()
    )
    scores = db.query(TeamScore).filter(TeamScore.session_id == session.id).all()
    judges = {judge.id: judge for judge in db.query(Judge).all()}

    score_rows = []
    comments_by_team: dict[int, list[str]] = defaultdict(list)
    for score in scores:
        judge = judges.get(score.judge_id)
        criterion = next((item for item in criteria if item.id == score.criterion_id), None)
        row = {
            "team_id": score.team_id,
            "judge": judge.name if judge else f"Jurado {score.judge_id}",
            "criterion": criterion.name if criterion else f"Criterio {score.criterion_id}",
            "score": score.score,
            "comment": score.comment,
        }
        score_rows.append(row)
        if score.comment and score.comment.strip():
            comments_by_team[score.team_id].append(score.comment.strip())

    return {
        "session": session,
        "teams": [team.model_dump() for team in teams],
        "assignments": [item.model_dump() for item in assignments],
        "ranking": [item.model_dump() for item in ranking],
        "criteria": [{"id": item.id, "name": item.name, "max_score": item.max_score} for item in criteria],
        "scores": score_rows,
        "comments_by_team": dict(comments_by_team),
    }


def _local_team_feedback(context: dict[str, Any]) -> list[TeamJudgeFeedbackOut]:
    ranking_by_team = {item["team_id"]: item for item in context["ranking"]}
    assignment_by_team = {item["team_id"]: item for item in context["assignments"]}
    output: list[TeamJudgeFeedbackOut] = []
    for team in context["teams"]:
        ranking = ranking_by_team.get(team["id"], {})
        average_score = float(ranking.get("average_score", 0))
        assignment = assignment_by_team.get(team["id"])
        comments = context["comments_by_team"].get(team["id"], [])
        use_case = assignment["use_case_title"] if assignment else "el caso asignado"
        level = _score_label(average_score)
        output.append(
            TeamJudgeFeedbackOut(
                team_id=team["id"],
                team_name=team["name"],
                summary=f"{team['name']} tuvo un desempeno {level} para {use_case}, con promedio de jurado {average_score}.",
                strengths=[
                    "El equipo cuenta con una composicion clara y roles faciles de distribuir.",
                    "La propuesta puede apoyarse en la mezcla de niveles de IA del equipo.",
                    "Los comentarios del jurado dan senales concretas para ajustar la presentacion.",
                ],
                opportunities=[
                    "Conectar mejor el problema, la solucion y el impacto esperado.",
                    "Explicar con mas evidencia como se usaria IA generativa en el flujo propuesto.",
                    "Cerrar la presentacion con proximos pasos medibles y responsables claros.",
                ],
                final_recommendation="Para presentar el proyecto, abre con el dolor principal, muestra una demo o flujo concreto y termina con impacto de negocio esperado.",
                average_score=average_score,
                judge_comments=comments,
            )
        )
    return output


def _build_markdown(report: EvaluationReportOut) -> str:
    lines = [
        f"# Reporte final IA Friday - {report.session.name}",
        "",
        f"Fecha: {report.session.date}",
        f"Fuente: {report.generated_by}",
        "",
        "## Conclusion ejecutiva",
        report.executive_summary,
        "",
        "## Ranking",
    ]
    for index, item in enumerate(report.ranking, start=1):
        lines.append(f"{index}. {item.team_name} - promedio {item.average_score} ({item.votes_count}/{item.judges_count} jurados)")

    lines.extend(["", "## Feedback por equipo"])
    for feedback in report.team_feedback:
        lines.extend(
            [
                "",
                f"### {feedback.team_name}",
                f"Promedio: {feedback.average_score}",
                "",
                feedback.summary,
                "",
                "Puntos fuertes:",
                *[f"- {item}" for item in feedback.strengths],
                "",
                "Oportunidades de mejora:",
                *[f"- {item}" for item in feedback.opportunities],
                "",
                f"Recomendacion final: {feedback.final_recommendation}",
            ]
        )
        if feedback.judge_comments:
            lines.extend(["", "Comentarios de jurados:", *[f"- {item}" for item in feedback.judge_comments]])

    lines.extend(["", "## Aprendizajes del workshop", *[f"- {item}" for item in report.learnings]])
    lines.extend(["", "## Recomendaciones", *[f"- {item}" for item in report.recommendations]])
    return "\n".join(lines).strip() + "\n"


def _local_report(db: Session, session: SessionModel, generated_by: str = "local") -> EvaluationReportOut:
    context = _collect_report_context(db, session)
    teams_response = serialize_teams(db, session.id)
    balance = generate_fallback_team_insights(teams_response)
    team_feedback = _local_team_feedback(context)
    ranking = build_ranking(db, session.id)
    report = EvaluationReportOut(
        session=session,
        generated_by=generated_by,
        executive_summary=f"{balance.summary} El reporte consolida ranking, equipos, casos asignados y feedback de jurados para orientar la siguiente iteracion.",
        learnings=[
            "Los criterios de evaluacion ayudan a comparar propuestas con una base comun.",
            "Los comentarios cualitativos del jurado son clave para convertir el ranking en acciones concretas.",
            "La combinacion de perfiles por nivel IA permite distribuir apoyo tecnico dentro de cada equipo.",
        ],
        recommendations=[
            "Usar el feedback por equipo como backlog de mejoras para una segunda iteracion.",
            "Pedir a cada equipo una version corta de pitch enfocada en problema, solucion, IA e impacto.",
            "Guardar este reporte como insumo para medir progreso entre workshops.",
        ],
        ranking=ranking,
        team_feedback=team_feedback,
        markdown="",
    )
    report.markdown = _build_markdown(report)
    return report


def _cloud_report(db: Session, session: SessionModel) -> EvaluationReportOut:
    context = _collect_report_context(db, session)
    prompt = f"""Actua como facilitador senior de workshops de innovacion con IA generativa.
Genera feedback automatico de jurado y un reporte final ejecutivo para esta sesion.

Incluye:
- resumen por equipo
- puntos fuertes por equipo
- oportunidades de mejora por equipo
- recomendacion final para presentar el proyecto por equipo
- conclusion ejecutiva
- aprendizajes del workshop
- recomendaciones de continuidad

Datos:
{json.dumps({k: v for k, v in context.items() if k != "session"}, ensure_ascii=False)}

Devuelve solo JSON valido con esta forma:
{{
  "executive_summary": "parrafo ejecutivo",
  "learnings": ["aprendizaje 1", "aprendizaje 2", "aprendizaje 3"],
  "recommendations": ["recomendacion 1", "recomendacion 2", "recomendacion 3"],
  "team_feedback": [
    {{
      "team_id": 1,
      "team_name": "Equipo A",
      "summary": "resumen breve",
      "strengths": ["punto fuerte 1", "punto fuerte 2"],
      "opportunities": ["mejora 1", "mejora 2"],
      "final_recommendation": "recomendacion para presentar"
    }}
  ]
}}"""
    parsed = run_facilitator_json(prompt)
    local_feedback = {item.team_id: item for item in _local_team_feedback(context)}
    team_feedback: list[TeamJudgeFeedbackOut] = []
    for item in parsed.get("team_feedback", []):
        if not isinstance(item, dict):
            continue
        team_id = int(item.get("team_id", 0) or 0)
        local = local_feedback.get(team_id)
        if not local:
            continue
        team_feedback.append(
            TeamJudgeFeedbackOut(
                team_id=team_id,
                team_name=str(item.get("team_name") or local.team_name),
                summary=str(item.get("summary") or local.summary),
                strengths=[str(value) for value in item.get("strengths", []) if str(value).strip()] or local.strengths,
                opportunities=[str(value) for value in item.get("opportunities", []) if str(value).strip()] or local.opportunities,
                final_recommendation=str(item.get("final_recommendation") or local.final_recommendation),
                average_score=local.average_score,
                judge_comments=local.judge_comments,
            )
        )

    if len(team_feedback) < len(local_feedback):
        existing = {item.team_id for item in team_feedback}
        team_feedback.extend(item for team_id, item in local_feedback.items() if team_id not in existing)

    report = EvaluationReportOut(
        session=session,
        generated_by="cloud",
        executive_summary=str(parsed.get("executive_summary", "")).strip() or "Reporte generado a partir de ranking, equipos, casos asignados y feedback de jurados.",
        learnings=[str(item).strip() for item in parsed.get("learnings", []) if str(item).strip()],
        recommendations=[str(item).strip() for item in parsed.get("recommendations", []) if str(item).strip()],
        ranking=build_ranking(db, session.id),
        team_feedback=team_feedback,
        markdown="",
    )
    if not report.learnings:
        report.learnings = _local_report(db, session).learnings
    if not report.recommendations:
        report.recommendations = _local_report(db, session).recommendations
    report.markdown = _build_markdown(report)
    return report


def generate_evaluation_report(db: Session, session: SessionModel) -> EvaluationReportOut:
    try:
        return _cloud_report(db, session)
    except Exception as exc:
        try:
            with REPORT_ERROR_FILE.open("w", encoding="utf-8") as f:
                import traceback

                f.write("Facilitator agent report call failed. Falling back to local report.\n")
                traceback.print_exception(type(exc), exc, exc.__traceback__, file=f)
        except Exception:
            pass
        return _local_report(db, session, generated_by="local")
