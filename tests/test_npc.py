"""Reproducible policy simulations; no own-card/authoritative-total inputs."""
from dataclasses import replace
from pathlib import Path
import random
import statistics
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai.npc import Observation, decide, greed_drive, possible_totals


class NpcPolicyTests(unittest.TestCase):
    def setUp(self):
        self.view = Observation((3, 8, 17), (3, 8, 17), previous=35, declaration_count=2)

    def sample(self, view):
        return [decide(view, "declare", random.Random(seed)) for seed in range(600)]

    def test_personalities_take_different_risks(self):
        greedy = self.sample(replace(self.view, style="hat"))
        cautious = self.sample(replace(self.view, style="hood"))
        self.assertGreater(statistics.mean(r["value"] for r in greedy), statistics.mean(r["value"] for r in cautious) + 2)
        self.assertGreater(statistics.mean(r["risk"] for r in greedy), statistics.mean(r["risk"] for r in cautious) + .1)
        # Neither a perfectly safe optimizer nor an always-maximal fixed script.
        self.assertGreater(len({r["value"] for r in greedy}), 2)
        self.assertTrue(any(r["risk"] > .5 for r in greedy))

    def test_losses_and_wins_can_feed_greed_but_low_hp_adds_fear(self):
        calm = statistics.mean(r["value"] for r in self.sample(self.view))
        behind = replace(self.view, leader_points=100, frustration=2)
        self.assertGreater(statistics.mean(r["value"] for r in self.sample(behind)), calm + 1)
        self.assertGreater(greed_drive(replace(self.view, momentum=3)), greed_drive(self.view))
        self.assertGreater(greed_drive(replace(self.view, debt=40)), greed_drive(self.view))
        self.assertLess(statistics.mean(r["value"] for r in self.sample(replace(self.view, hp=1))), calm - 1)

    def test_challenges_can_be_wrong_and_rewards_are_tempting(self):
        rich = decide(replace(self.view, style="hat", previous=43, last_reward=40), "challenge", random.Random(1))
        poor = decide(replace(self.view, style="hat", previous=43, last_reward=10), "challenge", random.Random(1))
        self.assertGreater(rich["probability"], poor["probability"])
        self.assertGreater(rich["belief"], 0)
        self.assertLess(rich["belief"], 1)
        self.assertEqual(decide(replace(self.view, previous=1), "challenge")["probability"], 0)
        self.assertTrue(decide(replace(self.view, previous=96), "challenge")["call"])

    def test_hidden_information_is_not_an_input(self):
        with self.assertRaises(TypeError):
            Observation((3, 8, 17), (3, 8, 17), own_card=24)
        totals = possible_totals(self.view)
        self.assertEqual(totals[0], 29)
        self.assertEqual(totals[-1], 52)
        self.assertEqual(len(totals), 21)
        blinded = Observation((8, 17), (8, 17, 4), unknown_count=2)
        self.assertEqual(possible_totals(blinded)[0], 28)
        self.assertEqual(possible_totals(blinded)[-1], 72)
        with self.assertRaises(ValueError):
            Observation((3, 3), (3, 3))

    def test_legality_and_oath_constraints(self):
        for previous in [0, 10, 35, 60, 100]:
            for step in [1, 3]:
                for zero in [False, True]:
                    view = replace(self.view, previous=previous, step=step, head=True, zero_reward=zero,
                                   declaration_count=0 if previous == 0 else 3)
                    for seed in range(20):
                        choice = decide(view, "declare", random.Random(seed))
                        self.assertGreaterEqual(choice["value"], previous + step)
                        self.assertLessEqual(choice["value"], max(previous + step, possible_totals(view)[-1]))
                        if zero or previous == 0 or choice["value"] - previous < 6:
                            self.assertFalse(choice["oath"])
        self.assertEqual(decide(self.view, "declare", random.Random(72)), decide(self.view, "declare", random.Random(72)))


if __name__ == "__main__":
    unittest.main()
