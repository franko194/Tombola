from app.services.usecase_assigner import UseCaseInput, assign_use_cases


def test_assign_use_cases_assigns_unique_cases():
    assignments = assign_use_cases(
        team_ids=[1, 2, 3],
        use_cases=[
            UseCaseInput(id=10, title="Caso A"),
            UseCaseInput(id=11, title="Caso B"),
            UseCaseInput(id=12, title="Caso C"),
        ],
        seed=42,
    )

    assigned_case_ids = [use_case.id for use_case in assignments.values()]

    assert set(assignments.keys()) == {1, 2, 3}
    assert len(assigned_case_ids) == len(set(assigned_case_ids))


def test_assign_use_cases_reuses_cases_when_there_are_more_teams_than_cases():
    assignments = assign_use_cases(
        team_ids=[1, 2, 3, 4],
        use_cases=[
            UseCaseInput(id=10, title="Caso A"),
            UseCaseInput(id=11, title="Caso B"),
            UseCaseInput(id=12, title="Caso C"),
        ],
        seed=42,
    )

    assigned_case_ids = [use_case.id for use_case in assignments.values()]

    assert set(assignments.keys()) == {1, 2, 3, 4}
    assert len(assigned_case_ids) == 4
    assert set(assigned_case_ids) == {10, 11, 12}
