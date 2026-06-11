from dataclasses import dataclass, field
from math import ceil


@dataclass
class ParticipantInput:
    id: int
    name: str
    ai_level: int


@dataclass
class BalancedTeam:
    name: str
    members: list[ParticipantInput] = field(default_factory=list)
    total_score: int = 0
    average_score: float = 0


def generate_snake_draft_teams(
    participants: list[ParticipantInput],
    number_of_teams: int,
) -> list[BalancedTeam]:
    if number_of_teams < 1:
        raise ValueError("number_of_teams must be greater than 0")

    if len(participants) < number_of_teams:
        raise ValueError("There must be at least one participant per team")

    return generate_score_balanced_teams(participants, number_of_teams)


def generate_score_balanced_teams(
    participants: list[ParticipantInput],
    number_of_teams: int,
) -> list[BalancedTeam]:
    if number_of_teams < 1:
        raise ValueError("number_of_teams must be greater than 0")

    if len(participants) < number_of_teams:
        raise ValueError("There must be at least one participant per team")

    sorted_participants = sorted(participants, key=lambda item: item.ai_level, reverse=True)
    teams = [BalancedTeam(name=f"Equipo {chr(65 + index)}") for index in range(number_of_teams)]
    max_team_size = ceil(len(participants) / number_of_teams)

    # Greedy score balancing: place stronger participants into the currently weakest team,
    # while respecting a max size so averages stay comparable and teams remain even.
    for participant in sorted_participants:
        available_teams = [team for team in teams if len(team.members) < max_team_size]
        target_team = min(
            available_teams,
            key=lambda team: (
                sum(member.ai_level for member in team.members),
                len(team.members),
                team.name,
            ),
        )
        target_team.members.append(participant)

    for team in teams:
        recalculate_team_score(team)

    improve_average_balance_with_swaps(teams)

    return teams


def recalculate_team_score(team: BalancedTeam) -> None:
    team.total_score = sum(member.ai_level for member in team.members)
    team.average_score = round(team.total_score / len(team.members), 2)


def average_gap(teams: list[BalancedTeam]) -> float:
    averages = [team.average_score for team in teams]
    return round(max(averages) - min(averages), 4)


def improve_average_balance_with_swaps(teams: list[BalancedTeam]) -> None:
    improved = True
    while improved:
        improved = False
        current_gap = average_gap(teams)

        for left_index, left_team in enumerate(teams):
            for right_team in teams[left_index + 1:]:
                for left_member_index, left_member in enumerate(left_team.members):
                    for right_member_index, right_member in enumerate(right_team.members):
                        if left_member.ai_level == right_member.ai_level:
                            continue

                        left_team.members[left_member_index], right_team.members[right_member_index] = right_member, left_member
                        recalculate_team_score(left_team)
                        recalculate_team_score(right_team)
                        next_gap = average_gap(teams)

                        if next_gap < current_gap:
                            improved = True
                            current_gap = next_gap
                        else:
                            left_team.members[left_member_index], right_team.members[right_member_index] = left_member, right_member
                            recalculate_team_score(left_team)
                            recalculate_team_score(right_team)

                        if improved:
                            break
                    if improved:
                        break
                if improved:
                    break
            if improved:
                break
