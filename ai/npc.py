"""GREED NPCs: imperfect beliefs, temptation, loss chasing and character differences.

The policy never receives its own card. All risk estimates come from combinations
of unseen, unused numbers, not from the authoritative round total.
"""
from dataclasses import dataclass
from itertools import combinations
from math import exp
import random
from typing import Literal


@dataclass(frozen=True)
class Personality:
    greed: float
    caution: float


PERSONALITIES = {
    "hat": Personality(.82, .28),      # 탐욕꾼: high rewards are hard to resist.
    "hood": Personality(.28, .82),     # 속삭임: usually cautious, but can chase losses.
    "monocle": Personality(.56, .55),  # 집행관: opportunistic, especially on rich calls.
}


@dataclass(frozen=True)
class Observation:
    visible_cards: tuple[int, ...]
    known_cards: tuple[int, ...]
    unknown_count: int = 1
    style: str = "hood"
    hp: float = 3
    points: int = 20
    leader_points: int = 20
    debt: int = 0
    momentum: float = 0
    frustration: float = 0
    previous: int = 0
    declaration_count: int = 0
    last_reward: int = 20
    step: int = 1
    head: bool = False
    whistle: bool = False
    zero_reward: bool = False
    reward_penalty: int = 0

    def __post_init__(self):
        visible, known = tuple(self.visible_cards), tuple(self.known_cards)
        object.__setattr__(self, "visible_cards", visible)
        object.__setattr__(self, "known_cards", known)
        if (len(set(known)) != len(known) or len(set(visible)) != len(visible)
                or any(type(n) is not int or not 1 <= n <= 24 for n in known)
                or not set(visible).issubset(known)):
            raise ValueError("Invalid public cards")
        if (type(self.unknown_count) is not int or not 1 <= self.unknown_count <= 4
                or len(visible) + self.unknown_count > 4
                or len(known) + self.unknown_count > 24):
            raise ValueError("Invalid unseen-card count")
        if not (0 < self.hp <= 3 and 0 <= self.previous <= 200 and self.step in (1, 3)):
            raise ValueError("Invalid actor state")


def _clamp(value, low=0., high=1.):
    return max(low, min(high, value))


def possible_totals(view: Observation) -> tuple[int, ...]:
    remaining = [n for n in range(1, 25) if n not in view.known_cards]
    visible = sum(view.visible_cards)
    return tuple(sorted(visible + sum(cards) for cards in combinations(remaining, view.unknown_count)))


def greed_drive(view: Observation) -> float:
    personality = PERSONALITIES.get(view.style, PERSONALITIES["hood"])
    deficit = _clamp((view.leader_points - view.points) / 140, 0, .25)
    desperation = _clamp(view.debt / 200, 0, .15)
    confidence = _clamp(view.momentum, 0, 3) * .045
    loss_chasing = _clamp(view.frustration, 0, 3) * .06
    fear = max(0, 2 - view.hp) * personality.caution * .22
    return _clamp(personality.greed + deficit + desperation + confidence + loss_chasing - fear, .05, .98)


def tier_reward(value: int, view: Observation) -> int:
    if view.declaration_count == 0:
        return 20
    delta = value - view.previous
    return 10 if delta <= 2 else 20 if delta <= 5 else 30 if delta <= 10 else 40


def decide(view: Observation, action: Literal["declare", "challenge"], rng=None) -> dict:
    """Return a stochastic choice; accepts a seeded RNG for reproducible simulations."""
    rng = rng if rng is not None else random
    totals = possible_totals(view)
    drive = greed_drive(view)
    personality = PERSONALITIES.get(view.style, PERSONALITIES["hood"])
    if action == "challenge":
        over = sum(total < view.previous for total in totals) / len(totals)
        gain = max(10, view.last_reward - 10)
        # No knowingly impossible accusations. Uncertainty still permits mistakes.
        if over == 0:
            probability = 0.
        elif over == 1:
            probability = 1.
        else:
            fear = personality.caution * (1 + max(0, 2 - view.hp))
            if view.whistle:
                fear *= 1.7
            probability = _clamp(.03 + .9 * over + .22 * drive * min(1.5, gain / 30)
                                 - .3 * fear * (1 - over), 0, .96)
        return {"call": rng.random() < probability, "probability": probability,
                "belief": over, "drive": drive, "reason": "reward_temptation" if gain >= 20 else "suspicion"}
    if action != "declare":
        raise ValueError("Unknown NPC action")

    minimum = view.previous + view.step
    # Tempting reward boundaries compete with belief quantiles and the safe minimum.
    candidates = {minimum, view.previous + 3, view.previous + 6, view.previous + 11}
    candidates.update(totals[int((len(totals) - 1) * q)] for q in (.25, .5, .7, .9))
    candidates = sorted(n for n in candidates if minimum <= n <= max(minimum, totals[-1]))
    scored = []
    for value in candidates:
        risk = sum(total < value for total in totals) / len(totals)
        base = tier_reward(value, view)
        reward = 0 if view.zero_reward else max(0, base - view.reward_penalty)
        # Greed overvalues the immediate gain and underweights losing that gain.
        retained_reward = reward * (1 - risk * (1 - drive * .65))
        temptation = max(0, reward - 10) * drive * .35
        health_cost = 24 * (3 / view.hp) * (1 - drive * .35)
        score = retained_reward * (1 + drive * .5) + temptation - risk * health_cost
        if view.declaration_count == 0:
            score += (value - minimum) * drive * .22
        scored.append((value, risk, base, score))
    best = max(row[3] for row in scored)
    temperature = 2 + drive * 5
    weights = [exp((row[3] - best) / temperature) for row in scored]
    roll = rng.random() * sum(weights)
    chosen = scored[-1]
    for row, weight in zip(scored, weights):
        roll -= weight
        if roll <= 0:
            chosen = row
            break
    value, risk, base, _ = chosen
    oath = (view.head and base >= 30 and not view.zero_reward
            and rng.random() < (.12 + drive * .75) * (1 - risk * .65)
            / (1 + view.debt / 120))
    if view.frustration > 0 or view.leader_points - view.points >= 30:
        reason = "chasing_losses"
    elif base >= 30 and not view.zero_reward:
        reason = "reward_temptation"
    elif view.momentum >= 2:
        reason = "pressing_luck"
    else:
        reason = "cautious"
    return {"value": value, "oath": bool(oath), "risk": risk, "drive": drive, "reason": reason}
