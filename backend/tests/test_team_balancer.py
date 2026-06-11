from app.services.team_balancer import ParticipantInput, generate_snake_draft_teams


def test_snake_draft_creates_requested_number_of_teams():
    participants = [
        ParticipantInput(id=1, name="Ana", ai_level=5),
        ParticipantInput(id=2, name="Pedro", ai_level=4),
        ParticipantInput(id=3, name="Juan", ai_level=3),
        ParticipantInput(id=4, name="Sofia", ai_level=2),
    ]

    teams = generate_snake_draft_teams(participants, 2)

    assert len(teams) == 2
    assert teams[0].name == "Equipo A"
    assert teams[1].name == "Equipo B"


def test_snake_draft_balances_experience_levels():
    participants = [
        ParticipantInput(id=1, name="P1", ai_level=5),
        ParticipantInput(id=2, name="P2", ai_level=5),
        ParticipantInput(id=3, name="P3", ai_level=4),
        ParticipantInput(id=4, name="P4", ai_level=3),
        ParticipantInput(id=5, name="P5", ai_level=2),
        ParticipantInput(id=6, name="P6", ai_level=1),
    ]

    teams = generate_snake_draft_teams(participants, 3)
    totals = [team.total_score for team in teams]

    assert max(totals) - min(totals) <= 3
    assert all(len(team.members) == 2 for team in teams)


def test_team_generation_balances_average_for_skewed_levels():
    participants = [
        ParticipantInput(id=1, name="P1", ai_level=5),
        ParticipantInput(id=2, name="P2", ai_level=5),
        ParticipantInput(id=3, name="P3", ai_level=5),
        ParticipantInput(id=4, name="P4", ai_level=5),
        ParticipantInput(id=5, name="P5", ai_level=5),
        ParticipantInput(id=6, name="P6", ai_level=0),
        ParticipantInput(id=7, name="P7", ai_level=0),
        ParticipantInput(id=8, name="P8", ai_level=0),
        ParticipantInput(id=9, name="P9", ai_level=0),
        ParticipantInput(id=10, name="P10", ai_level=0),
    ]

    teams = generate_snake_draft_teams(participants, 3)
    averages = [team.average_score for team in teams]
    sizes = [len(team.members) for team in teams]

    assert max(averages) - min(averages) <= 1.7
    assert max(sizes) - min(sizes) <= 1


def test_snake_draft_rejects_more_teams_than_participants():
    participants = [ParticipantInput(id=1, name="Ana", ai_level=3)]

    try:
        generate_snake_draft_teams(participants, 2)
    except ValueError as error:
        assert "at least one participant per team" in str(error)
    else:
        raise AssertionError("Expected ValueError")
