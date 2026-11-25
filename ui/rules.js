// Pure rules shared by the game and regression checks.
window.GREED_RULES = {
  higherHiddenCard(players, playerId, random = Math.random) {
    const player = players.find(p => p.id === playerId);
    const used = new Set(players.map(p => p.card));
    const choices = Array.from({length: 24}, (_, i) => i + 1).filter(n => n > player.card && !used.has(n));
    return choices.length ? choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))] : player.card;
  },
  drawCost: 18,
  oathDebtRatio: 1.5,
  minimum(players, blindTargetId = null) {
    const alive = players.filter((p) => p.hp > 0);
    const visible = alive.filter((p) => !p.isHuman && p.id !== blindTargetId).map((p) => p.card);
    const known = new Set(players.filter((p) => !p.isHuman && p.id !== blindTargetId && p.card > 0).map((p) => p.card));
    const unknownCount = alive.length - visible.length;
    const smallest = Array.from({ length: 24 }, (_, i) => i + 1).filter((n) => !known.has(n)).slice(0, unknownCount);
    return visible.reduce((a, n) => a + n, 0) + smallest.reduce((a, n) => a + n, 0);
  },
  hasRoom(player, kind) {
    return player.inventory.filter((c) => c.kind === kind).length < (kind === "relic" ? 1 : 2);
  },
  debt(baseReward) { return Math.ceil(baseReward * this.oathDebtRatio); },
  diceOutcome(a, b) {
    const value = (a - 1) * 20 + b;
    if (value <= 20) return { value, label: "大成功", name: "대성공", points: 30, hp: 1 };
    if (value <= 120) return { value, label: "成功", name: "성공", points: 20, hp: 0 };
    if (value <= 280) return { value, label: "평범한 성공", name: "평범한 성공", points: 10, hp: 0 };
    if (value <= 380) return { value, label: "失敗", name: "실패", points: -10, hp: 0 };
    return { value, label: "大失敗", name: "대실패", points: 0, hp: -1 };
  },
  rollD20() {
    const data = new Uint32Array(1);
    // Reject the incomplete final bucket: each face has exactly equal probability.
    do { crypto.getRandomValues(data); } while (data[0] >= 4294967280);
    return data[0] % 20 + 1;
  }
};
