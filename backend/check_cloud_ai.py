import os
from app.schemas import BalanceOut, TeamMemberOut, TeamOut, TeamsResponse
from app.services.team_insights import generate_cloud_team_insights, normalize_cloud_url

# Build a small test TeamsResponse
teams_response = TeamsResponse(
    teams=[
        TeamOut(
            id=1,
            name="Equipo A",
            average_ai_level=3.5,
            total_ai_score=21,
            members=[
                TeamMemberOut(id=1, name="Ana", ai_level=4),
                TeamMemberOut(id=2, name="Luis", ai_level=3),
                TeamMemberOut(id=3, name="Marta", ai_level=3),
            ],
        )
    ],
    balance=BalanceOut(highest_average=3.5, lowest_average=3.5, average_gap=0.0),
)

cloud_url = os.environ.get("CLOUD_AI_URL") or "https://ollama.com/v1/chat/completions"
cloud_api_key = os.environ.get("CLOUD_AI_API_KEY") or "tu_api_key_de_ia_aqui"
print("CLOUD_AI_URL:", cloud_url)
print("CLOUD_AI_API_KEY:", cloud_api_key)
print("Normalized endpoint:", normalize_cloud_url(cloud_url))
try:
    result = generate_cloud_team_insights(teams_response, cloud_api_key, cloud_url)
    print("AI result:", result)
except Exception as exc:
    print("AI request failed:", type(exc).__name__, exc)
