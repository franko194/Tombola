import random
from dataclasses import dataclass


@dataclass
class UseCaseInput:
    id: int
    title: str


def assign_use_cases(
    team_ids: list[int],
    use_cases: list[UseCaseInput],
    seed: int | None = None,
) -> dict[int, UseCaseInput]:
    if not use_cases:
        raise ValueError("There must be at least one use case")

    randomizer = random.Random(seed)
    assignments: dict[int, UseCaseInput] = {}
    available: list[UseCaseInput] = []

    for team_id in team_ids:
        if not available:
            available = use_cases[:]
            randomizer.shuffle(available)
        assignments[team_id] = available.pop(0)

    return assignments
