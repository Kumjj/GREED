(() => {
  const { relics: RELICS, items: ITEMS } = window.GREED_CARDS;
  const LIMBS = ["눈", "입", "귀", "손"];
  const RULES = window.GREED_RULES;

  function calcTierReward(delta, isFirst = false) {
    if (isFirst) return 20;
    if (delta <= 2) return 10;
    if (delta <= 5) return 20;
    if (delta <= 10) return 30;
    return 40;
  }

  function getMyVisibleSum() {
    const me = state.players[0];
    const blindId = me.limbs.includes("눈") && me.suppressedLimb !== "눈" ? me.blindTargetId : null;
    return RULES.minimum(state.players, blindId);
  }

  function formatHearts(hp, maxHp, owner = "me") {
    const path = "M12 21S2 15 2 8.5C2 2.5 9 1 12 6c3-5 10-3.5 10 2.5C22 15 12 21 12 21Z";
    return `<span class="heart-meter" role="img" aria-label="체력 ${hp} / ${maxHp}">${Array.from({ length: maxHp }, (_, i) => {
      const fill = Math.max(0, Math.min(1, hp - i)) * 100;
      const id = `heart-${owner}-${i}`;
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${id}"><stop offset="${fill}%" stop-color="#dc8272"/><stop offset="${fill}%" stop-color="#263c34"/></linearGradient></defs><path d="${path}" fill="url(#${id})" stroke="#b97768" stroke-width="1.2"/></svg>`;
    }).join("")}</span>`;
  }

  const state = {
    round: 1,
    phase: "dealing", // dealing | turn | maintenance | gameover
    players: [],
    turnIdx: 0,
    declCount: 0,
    maxDecl: 0,
    realDecl: 0,
    lastDeclPlayer: null,
    lastDeclReward: 0,
    lastDeclBySmoke: false,
    oathArmed: false,
    busy: false,
    awaitingReaction: false,
    reactionVersion: 0,
    pendingChallenger: null,
    challengerChecked: false,
    revealing: false,
    dealtSeats: new Set(),
    roundRevealSum: null,
    timers: [],
    runId: 0
  };

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => window.GREED_SCENE.wait(ms);

  function createPlayer(id, name, color, style, isHuman = false) {
    return {
      id, name, color, style, isHuman,
      hp: 3, maxHp: 3, points: 20,
      card: 0,
      mood: "neutral",
      inventory: [],
      debt: 0,
      limbs: [],
      suppressedLimb: null,
      debtDeferred: false,
      blindTargetId: null,
      usedHandThisRound: false,
      usedSwapThisRound: false,
      swapZeroNext: false,
      smokeActive: false,
      bandagePenalty: 0,
      noHealNextRound: false,
      noHealThisRound: false,
      handSealedThisRound: false
    };
  }

  function hasCard(p, cardId) {
    return p.inventory.some((c) => c.id === cardId);
  }

  function pickBlindCard(player) {
    const relicRoom = RULES.hasRoom(player, "relic"), itemRoom = RULES.hasRoom(player, "item");
    if (!relicRoom && !itemRoom) return null;
    const pool = relicRoom && (!itemRoom || Math.random() < .25) ? RELICS : ITEMS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function addToInventory(p, cardObj) {
    if (!RULES.hasRoom(p, cardObj.kind)) return false;
    p.inventory.push({ ...cardObj });
    if (p.inventory.length === 3 && hasCard(p, "empty_slot_contract")) {
      p.inventory = p.inventory.filter((c) => c.id !== "empty_slot_contract");
      say("안내", `${p.name}의 가방이 3칸이 되어 [빈 자리의 계약서]가 부서졌습니다.`);
    }
    return true;
  }

  function removeOneItem(p, cardId) {
    const idx = p.inventory.findIndex((c) => c.id === cardId);
    if (idx >= 0) p.inventory.splice(idx, 1);
  }

  function say(speaker, text) {
    window.GREED_SCENE.inkDialogue();
    $("vn-speaker").textContent = speaker;
    document.querySelectorAll(".opp-seat").forEach((seat) => {
      const p = state.players.find((player) => `seat-${player.id}` === seat.id);
      seat.classList.toggle("speaking", Boolean(p && p.name === speaker));
      const bubble = seat.querySelector(".speech-bubble");
      if (bubble) {
        bubble.hidden = !p || p.name !== speaker;
        if (!bubble.hidden) {
          bubble.textContent = text.match(/"([^"]+)"/)?.[1] || text;
          bubble.classList.remove("arrive");
          void bubble.offsetWidth;
          bubble.classList.add("arrive");
        }
      }
    });
    const el = $("vn-text");
    el.classList.remove("rise", "revealed");
    void el.offsetWidth;
    el.setAttribute("aria-label", text);
    el.replaceChildren();
    const fragment = document.createDocumentFragment();
    Array.from(text).forEach((char, i) => {
      const glyph = document.createElement("span");
      glyph.className = "dialogue-glyph";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = char;
      glyph.style.setProperty("--delay", `${Math.min(i * 18, 2200)}ms`);
      fragment.appendChild(glyph);
    });
    el.appendChild(fragment);
    el.classList.add("rise");
  }

  // --- 캐릭터별 개성 있는 스탠디 SVG ---
  async function animateCardFlight(fromEl, toEl, label = "?", duration = 560) {
    await window.GREED_SCENE.fly(fromEl, toEl, label, duration);
  }

  function spawnFloatText(targetEl, text, cls = "pts") {
    if (!targetEl) return;
    const r = targetEl.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = `fx-float ${cls}`;
    el.textContent = text;
    el.style.left = `${r.left + r.width / 2 - 18}px`;
    el.style.top = `${r.top + 8}px`;
    $("fx-layer").appendChild(el);
    el.animate([
      { translate: "0px 0px", scale: 0.85, opacity: 1 },
      { translate: "0px -36px", scale: 1.15, opacity: 0 }
    ], { duration: 900, easing: "ease-out" }).finished.then(() => el.remove());
  }

  function seatTargetEl(player) {
    return player.isHuman ? $("my-status-panel") : $(`seat-${player.id}`);
  }

  function updateDeclarePreview() {
    const me = state.players[0];
    const inp = $("declare-input");
    const val = inp.value === "" ? Number(inp.min) : Number(inp.value);
    const isFirst = state.lastDeclPlayer === null;
    const delta = Math.max(1, val - state.maxDecl);
    const baseReward = calcTierReward(delta, isFirst);
    const canOath = hasCard(me, "head_of_greed") && baseReward >= 30 && !me.swapZeroNext && !me.smokeActive && !state.busy && state.turnIdx === 0;
    if (!canOath) state.oathArmed = false;
    $("btn-toggle-oath").disabled = !canOath;
    $("btn-toggle-oath").classList.toggle("armed", state.oathArmed);
    $("btn-toggle-oath").setAttribute("aria-pressed", String(state.oathArmed));
    $("btn-toggle-oath").textContent = state.oathArmed ? `×2 · 빚 +${RULES.debt(baseReward)}` : "서약 ×2";
    $("btn-toggle-oath").title = "기본 보상 30P 이상인 선언에만 적용";
    let pts = me.swapZeroNext ? 0 : calcTierReward(delta, isFirst);
    if (state.oathArmed && hasCard(me, "head_of_greed")) pts *= 2;
    if (me.bandagePenalty > 0 && pts > 0) pts = Math.max(0, pts - me.bandagePenalty);
    $("decl-preview-pts").textContent = `+${pts}P`;
  }

  // --- UI 렌더링 ---
  function render() {
    const me = state.players[0];
    const isMyTurn = state.phase === "turn" && state.turnIdx === 0 && !state.busy && !targetSelection && me.hp > 0;
    document.body.classList.toggle("reaction-pending", state.awaitingReaction);
    window.GREED_SCENE.observe(state.players);
    window.GREED_SCENE.turn(state.phase === "turn" ? state.turnIdx : null);
    document.body.classList.toggle("your-turn", isMyTurn);

    $("round-label").textContent = `ROUND ${state.round}`;
    $("phase-label").textContent =
      state.phase === "dealing" ? "카드 배분" :
      state.phase === "turn" ? (state.awaitingReaction ? "당신의 판단을 기다리는 중" : `${state.players[state.turnIdx]?.name}의 차례`) :
      state.phase === "maintenance" ? "정비 시간" : "종료";

    const earSealed = me.limbs.includes("귀") && me.suppressedLimb !== "귀";
    const visibleSum = getMyVisibleSum();
    $("current-decl-num").textContent = state.maxDecl > 0 ? (earSealed ? "??" : state.maxDecl) : "—";
    $("current-decl-by").textContent = state.lastDeclPlayer
      ? `${state.lastDeclPlayer.name}의 선언`
      : "";
    $("current-decl-num").hidden = state.maxDecl === 0;
    $("visible-sum").textContent = visibleSum;
    $("smoke-badge").classList.toggle("hidden", !state.lastDeclBySmoke);

    // 내 앞자리 숨겨진 카드
    const hideMyCard = state.phase === "turn" || (state.phase === "dealing" && !state.revealing);
    $("seat-0").innerHTML = `
      <div class="num-card ${hideMyCard || me.card === 0 ? "flipped" : ""}" id="card-seat-0">
        <div class="card-face card-front" aria-hidden="${hideMyCard}"><span>${hideMyCard ? "?" : (me.card || "?")}</span></div>
        <div class="card-face card-back" aria-hidden="${!hideMyCard}">?</div>
      </div>
      <span class="my-card-caption">내 카드</span>
    `;

    // 맞은편 상대 3명 (상대 아이템/유물 목록은 숨김!)
    state.players.slice(1).forEach((p) => {
      const seat = $(`seat-${p.id}`);
      const isTurn = state.phase === "turn" && state.turnIdx === p.id;
      seat.classList.toggle("active-turn", isTurn);
      seat.classList.toggle("dead", p.hp <= 0);

      const blurredByEye = me.limbs.includes("눈") && me.suppressedLimb !== "눈" && me.blindTargetId === p.id;
      const hearts = formatHearts(p.hp, p.maxHp, p.id);

      const delivered = state.dealtSeats.has(p.id);
      const signature = JSON.stringify([p.card, p.hp, p.points, p.debt, p.mood, blurredByEye, delivered]);
      if (seat.dataset.signature !== signature) {
        const template = document.createElement("template");
        template.innerHTML = `
          <div class="character-presence">
            ${window.greedPortrait(p)}
            <div class="speech-bubble" hidden></div>
            <div class="num-card ${p.card === 0 ? "flipped" : ""}" id="card-seat-${p.id}">
              <div class="card-face card-front ${blurredByEye ? "blurred" : ""}">
                <span>${!delivered ? "" : blurredByEye ? "?" : p.card || "?"}</span>
              </div>
              <div class="card-face card-back">?</div>
            </div>
          </div>
          <div class="seat-card-plate">
            <div class="seat-name">
              <span>${p.name}<small>${p.style === "hat" ? "THE DEALER" : p.style === "hood" ? "THE WHISPER" : "THE EXECUTOR"}</small></span>
              <span class="hp-hearts">${hearts}</span>
            </div>
            <div class="seat-meta">
              <span>${p.points}P</span>
              <span>${p.debt > 0 ? `빚 ${p.debt}P` : "—"}</span>
            </div>
          </div>
        `;
        const existing = seat.querySelector(".character-presence");
        const portraitKey = `${p.style}:${p.mood}:${p.hp <= 0}`;
        if (!existing) seat.replaceChildren(template.content);
        else {
          const card = existing.querySelector(".num-card");
          const nextCard = template.content.querySelector(".num-card");
          card.innerHTML = nextCard.innerHTML;
          card.classList.toggle("flipped", nextCard.classList.contains("flipped"));
          const plate = template.content.querySelector(".seat-card-plate");
          seat.querySelector(".seat-card-plate").replaceChildren(...plate.childNodes);
          if (seat.dataset.portraitKey !== portraitKey) {
            const oldPortrait = existing.querySelector(".standee");
            const phases = new Map(oldPortrait.getAnimations({subtree:true}).map(a=>[a.animationName,a.currentTime]));
            const nextPortrait = template.content.querySelector(".standee");
            oldPortrait.replaceWith(nextPortrait);
            nextPortrait.getAnimations({subtree:true}).forEach(a=>{if(phases.has(a.animationName))a.currentTime=phases.get(a.animationName);});
          }
        }
        seat.dataset.portraitKey = portraitKey;
      }
      seat.dataset.signature = signature;
      seat.querySelector(".num-card").classList.toggle("waiting-card", !state.dealtSeats.has(p.id));
      const bubble = seat.querySelector(".speech-bubble");
      if (p.name === $("vn-speaker").textContent && bubble) {
        const text = $("vn-text").getAttribute("aria-label") || "";
        bubble.hidden = false;
        bubble.textContent = text.match(/"([^"]+)"/)?.[1] || text;
      }
    });

    // 하단 내 상태 + 빚 즉시 상환 버튼
    $("my-hp").innerHTML = formatHearts(me.hp, me.maxHp);
    $("my-points").textContent = `${me.points}P`;

    const debuffBox = $("my-debuffs");
    debuffBox.innerHTML = "";
    if (me.debt > 0) {
      const tag = document.createElement("span");
      tag.className = "debuff-tag";
      tag.textContent = `빚 ${me.debt}P`;
      debuffBox.appendChild(tag);

      const payBtn = document.createElement("button");
      payBtn.type = "button";
      payBtn.className = "btn-pay-debt";
      payBtn.textContent = "갚기";
      payBtn.disabled = me.points <= 0 || state.busy;
      payBtn.onclick = payMyDebt;
      debuffBox.appendChild(payBtn);
    }
    me.limbs.forEach((l) => {
      if (me.suppressedLimb !== l) {
        const t = document.createElement("span");
        t.className = "debuff-tag";
        t.textContent = `${l} 담보`;
        debuffBox.appendChild(t);
      }
    });
    if (me.noHealThisRound) {
      const t = document.createElement("span");
      t.className = "debuff-tag";
      t.textContent = "회복불가";
      debuffBox.appendChild(t);
    }

    // 아이콘 중심 인벤토리 3칸
    const invEl = $("my-inventory");
    const relic = me.inventory.find((c) => c.kind === "relic");
    const items = me.inventory.filter((c) => c.kind === "item");
    for (let i = 0; i < 3; i++) {
      const card = i === 0 ? relic : items[i - 1];
      const parent = i === 0 ? $("relic-slot") : invEl;
      const kind = i === 0 ? "relic" : "item";
      let slot = parent.querySelector(`[data-slot-index="${i}"]`);
      if (!slot) {
        slot = document.createElement("button");
        slot.type = "button";
        slot.dataset.slotKind = kind;
        slot.dataset.slotIndex = i;
        slot.onclick = () => { if (slot.card) openCardDetail(slot.card, slot); };
        slot.onpointerenter = (event) => {
          if (event.pointerType === "mouse" && slot.card) openCardDetail(slot.card, slot);
        };
        slot.onfocus = () => { if (slot.card) openCardDetail(slot.card, slot); };
        parent.appendChild(slot);
      }
      slot.card = card;
      slot.disabled = !card;
      slot.setAttribute("aria-label", card ? card.name : kind === "relic" ? "빈 유물 슬롯" : "빈 아이템 슬롯");
      const usable = card && canClickInventoryCard(me, card);
      const signature = `${card?.id || "empty"}:${Boolean(usable)}`;
      if (slot.dataset.signature === signature) continue;
      slot.dataset.signature = signature;
      if (!card) {
        slot.className = "inv-slot";
        slot.innerHTML = `<span class="inv-empty-txt">${i === 0 ? "유물" : "·"}</span>`;
      } else {
        slot.className = `inv-slot filled ${card.kind} ${usable ? "usable" : ""}`;
        slot.innerHTML = `
          <span class="inv-icon">${GREED_ICONS.markup(card.id)}</span>
          <span class="inv-slot-name">${card.name}</span>
          <span class="inv-slot-short">${card.short}</span>
        `;
      }
    }
    if (inspectedCard && inspectionAnchor?.card?.id !== inspectedCard.id) closeInspection();

    // 내 턴 컨트롤 + 보이는 숫자 합계 하한선(placeholder) 적용
    const step = me.limbs.includes("입") && me.suppressedLimb !== "입" ? 3 : 1;
    const minVal = Math.max(state.maxDecl + step, visibleSum);
    const input = $("declare-input");
    input.min = minVal;
    input.placeholder = String(minVal);
    if (input.value !== "" && Number(input.value) < minVal) input.value = minVal;
    if (isMyTurn && input.value === "") input.value = String(minVal);
    const handReady = state.players.filter(p => p.hp > 0).every(p => state.dealtSeats.has(p.id));
    $("visible-sum").textContent = handReady ? `${visibleSum}${me.limbs.includes("눈") && me.suppressedLimb !== "눈" ? "?" : ""}` : "—";

    $("action-hint").textContent = "선언 숫자";
    $("btn-declare").disabled = !isMyTurn;
    $("btn-dec-minus").disabled = !isMyTurn;
    $("btn-dec-plus").disabled = !isMyTurn;
    input.disabled = !isMyTurn;

    const showOath = hasCard(me, "head_of_greed");
    if (!showOath) state.oathArmed = false;

    $("btn-toggle-oath").classList.toggle("hidden", !showOath);
    $("btn-toggle-oath").classList.toggle("armed", state.oathArmed);

    const canGreed = state.phase === "turn" && !state.busy && me.hp > 0 &&
      (state.awaitingReaction || isMyTurn) &&
      state.lastDeclPlayer && !state.lastDeclPlayer.isHuman &&
      !state.lastDeclBySmoke;
    $("btn-greed").disabled = !canGreed;
    $("btn-pass").hidden = false;
    $("btn-pass").disabled = !state.awaitingReaction || state.busy;
    $("decl-input-row").hidden = false;
    $("reaction-note").hidden = false;
    $("reaction-note").textContent = state.awaitingReaction ? `${state.lastDeclPlayer.name} · ${earSealed ? "??" : state.maxDecl}` : "";
    refreshInspection();

    updateDeclarePreview();
  }

  function payMyDebt() {
    const me = state.players[0];
    if (me.debt <= 0 || me.points <= 0 || state.busy) return;
    const pay = Math.min(me.debt, me.points);
    me.points -= pay;
    me.debt -= pay;
    if (me.debt === 0) {
      me.limbs = [];
      me.suppressedLimb = null;
      me.blindTargetId = null;
      me.handSealedThisRound = false;
      window.GREED_SCENE.clearSeizure();
    }
    say("안내", `빚 ${pay}P를 갚았습니다. ${me.debt === 0 ? "모든 담보가 풀렸습니다!" : `남은 빚: ${me.debt}P`}`);
    render();
  }

  function canClickInventoryCard(me, card) {
    if (state.busy || targetSelection || me.hp <= 0) return false;
    if (state.phase !== "turn" || state.turnIdx !== 0) return false;
    if (card.id === "meddling_hand") return !me.usedHandThisRound;
    if (card.id === "rusty_dice_box") return !me.usedSwapThisRound;
    if (card.kind === "item" && me.handSealedThisRound) return false;
    if (card.id === "bloody_bandage" && (me.noHealThisRound || me.hp >= me.maxHp)) return false;
    return ["smoke_bomb", "pickpocket_hook", "bloody_bandage", "fate_bones"].includes(card.id);
  }

  // --- 게임 시작 & 라운드 ---
  function startNewGame() {
    clearTargetChoice();
    state.runId++;
    state.awaitingReaction = false;
    window.GREED_SCENE.reset();
    document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
    closeInspection();
    state.timers.forEach(clearTimeout);
    state.timers = [];
    state.round = 1;
    state.busy = false;
    state.oathArmed = false;
    state.players = [
      createPlayer(0, "YOU", "#2d4a6e", "none", true),
      createPlayer(1, "탐욕꾼", "#5e2429", "hat"),
      createPlayer(2, "속삭임", "#3c2d5c", "hood"),
      createPlayer(3, "집행관", "#224844", "monocle")
    ];
    say("안내", "자리에 앉았다. 곧 시작한다.");
    startRound();
  }

  async function startRound() {
    const runId = state.runId;
    state.revealing = false;
    state.dealtSeats.clear();
    state.reactionVersion++;
    state.pendingChallenger = null;
    state.challengerChecked = false;
    state.roundRevealSum = null;
    $("declare-input").value = "";
    state.awaitingReaction = false;
    state.phase = "dealing";
    state.busy = true;
    state.declCount = 0;
    state.maxDecl = 0;
    state.realDecl = 0;
    state.lastDeclPlayer = null;
    state.lastDeclReward = 0;
    state.lastDeclBySmoke = false;
    state.oathArmed = false;

    const deck = Array.from({ length: 24 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    state.players.forEach((p) => {
      p.card = p.hp > 0 ? deck.pop() : 0;
      p.mood = p.hp > 0 ? "neutral" : "dead";
      p.usedHandThisRound = false;
      p.usedSwapThisRound = false;
      p.swapZeroNext = false;
      p.smokeActive = false;
      p.bandagePenalty = 0;
      p.noHealThisRound = p.noHealNextRound;
      p.noHealNextRound = false;
      p.handSealedThisRound = p.limbs.includes("손") && p.suppressedLimb !== "손";
    });

    const me = state.players[0];
    if (me.limbs.includes("눈") && me.suppressedLimb !== "눈") {
      const aliveCpus = state.players.filter((p) => !p.isHuman && p.hp > 0);
      me.blindTargetId = aliveCpus.length ? aliveCpus[Math.floor(Math.random() * aliveCpus.length)].id : null;
    } else {
      me.blindTargetId = null;
    }

    render();
    say("안내", `라운드 ${state.round}. 카드를 나눕니다.`);

    const deckEl = $("center-deck");
    for (let i = 0; i < state.players.length; i++) {
      if (state.players[i].hp <= 0) continue;
      const concealed = i === 0 || (me.limbs.includes("눈") && me.suppressedLimb !== "눈" && me.blindTargetId === i);
      await animateCardFlight(deckEl, $(`card-seat-${i}`), concealed ? "?" : String(state.players[i].card), 300);
      if (runId !== state.runId) return;
      state.dealtSeats.add(i);
      // Populate the previously empty face only after the moving card arrives.
      render();
    }

    state.phase = "turn";
    state.turnIdx = state.players.findIndex((p) => p.hp > 0);
    state.busy = false;
    render();
    if (state.turnIdx === 0) say("당신의 차례", "상대들의 숫자를 살피고, 감당할 수 있는 숫자를 부르세요.");
    else runCpuTurn();
  }

  function actualSum() {
    return state.players.reduce((acc, p) => acc + (p.hp > 0 ? p.card : 0), 0);
  }

  // --- 선언 처리 (첫 선언 20P 확정, 이후 10~40P 구간 보상) ---
  async function performDeclaration(player, realVal, { doubleOath = false } = {}) {
    const runId = state.runId;
    state.reactionVersion++;
    state.awaitingReaction = false;
    state.pendingChallenger = null;
    state.challengerChecked = false;
    state.busy = true;
    render();
    await window.GREED_SCENE.present({ title: String(realVal), eyebrow: player.name, detail: doubleOath ? "두 배 서약" : "선언", kind: "declaration" });
    if (runId !== state.runId) return;
    const isFirst = state.declCount === 0;
    state.declCount++;
    const delta = Math.max(1, realVal - state.maxDecl);
    let reward = calcTierReward(delta, isFirst);

    if (player.swapZeroNext) {
      reward = 0;
      player.swapZeroNext = false;
    } else if (player.smokeActive) {
      reward = 0;
    } else {
      if (doubleOath && hasCard(player, "head_of_greed") && reward >= 30) {
        player.debt += RULES.debt(reward);
        reward *= 2;
      } else {
        doubleOath = false;
      }
      if (player.bandagePenalty > 0) reward = Math.max(0, reward - player.bandagePenalty);
    }

    const shownVal = realVal;

    player.points += reward;
    if (reward > 0) spawnFloatText(seatTargetEl(player), `+${reward}P`, "pts");

    const sum = actualSum();
    state.players.forEach((p) => {
      if (p.hp <= 0) return;
      if (p.id === player.id) p.mood = realVal > sum ? "sweat" : "smug";
      else p.mood = realVal > sum - 3 ? "sweat" : "neutral";
    });

    state.maxDecl = shownVal;
    state.realDecl = realVal;
    state.lastDeclPlayer = player;
    state.lastDeclReward = reward;
    state.lastDeclBySmoke = player.smokeActive;
    player.smokeActive = false;

    render();
    if (player.isHuman) {
      say("YOU", doubleOath ? `"${shownVal}... 두 배 서약으로 걸지." (+${reward}P)` : `"${shownVal}." (+${reward}P)`);
    } else {
      const line = doubleOath ? `"${shownVal}! 두 배 서약을 걸겠다." (+${reward}P)` : `"${shownVal}... 이 정도는 넘겠지." (+${reward}P)`;
      say(player.name, line);
    }
    await sleep(800);
    if (runId !== state.runId) return;
    state.pendingChallenger = state.lastDeclBySmoke ? null : pickCpuChallenger(player);
    state.challengerChecked = true;
    if (!player.isHuman && state.players[0].hp > 0) {
      state.awaitingReaction = true;
      state.busy = false;
      render();
      // Reapply the bubble after the final render without replacing the dialogue.
      const bubble = $(`seat-${player.id}`).querySelector(".speech-bubble");
      if (bubble) { bubble.hidden = false; bubble.textContent = `"${shownVal}." 당신의 반응을 기다린다.`; }
      if (state.pendingChallenger) {
        const version = state.reactionVersion;
        const challenger = state.pendingChallenger;
        (async () => {
          await sleep(2200 + Math.random() * 1000);
          if (runId !== state.runId || version !== state.reactionVersion || !state.awaitingReaction || state.busy || state.phase !== "turn") return;
          await resolveGreed(challenger);
        })();
      }
      return;
    }
    await finishDeclaration();
  }

  async function finishDeclaration() {
    const challenger = state.challengerChecked ? state.pendingChallenger : (!state.lastDeclBySmoke ? pickCpuChallenger(state.lastDeclPlayer) : null);
    state.reactionVersion++;
    state.pendingChallenger = null;
    state.challengerChecked = false;
    state.awaitingReaction = false;
    state.busy = true;
    render();
    if (!state.lastDeclBySmoke) {
      if (challenger) {
        await resolveGreed(challenger);
        return;
      }
    }

    if (state.declCount >= 8) {
      say("안내", "아무도 GREED!를 외치지 않아 라운드가 조용히 끝났습니다.");
      await sleep(700);
      await endRound();
      return;
    }

    advanceTurn();
  }

  function pickCpuChallenger(declarer) {
    const sum = actualSum();
    for (const cpu of state.players) {
      if (cpu.isHuman || cpu.hp <= 0 || cpu.id === declarer.id) continue;
      const estimatedTotal = (sum - cpu.card) + 12.5;
      const risk = state.realDecl - estimatedTotal;
      if (risk > 5 && Math.random() < 0.72) return cpu;
      if (risk > 1 && Math.random() < 0.25) return cpu;
    }
    return null;
  }

  // --- GREED! 적발 판정 ---
  async function resolveGreed(caller) {
    if ((caller.isHuman && state.busy) || !state.lastDeclPlayer) return;
    const runId=state.runId;
    state.reactionVersion++;
    state.pendingChallenger=null;
    state.challengerChecked=false;
    state.awaitingReaction=false;state.busy=true;
    const accused=state.lastDeclPlayer,sum=actualSum();
    const success=state.realDecl>sum;
    state.roundRevealSum=sum;
    let gain=0;
    if(success){
      accused.hp=Math.max(0,accused.hp-1);accused.mood='shock';
      const priorReward=state.lastDeclReward;
      accused.points=Math.max(0,accused.points-priorReward+10);
      state.lastDeclReward=10;
      gain=Math.max(10,priorReward-10);caller.points+=gain;caller.mood='smug';
    }else{
      const damage=hasCard(caller,'executioner_whistle')?2:1;
      caller.hp=Math.max(0,caller.hp-damage);caller.mood='shock';
    }
    render();
    if(gain)spawnFloatText(seatTargetEl(caller),`+${gain}P`,'pts');
    const verdict=success?"적발 성공":"적발 실패";
    say(caller.name, `"GREED!" ${accused.name}의 선언 ${state.realDecl}. ${verdict}, 합계는 ${sum}.`);
    await window.GREED_SCENE.present({title:String(sum),eyebrow:`${caller.name} · GREED! · ${verdict}`,detail:`${accused.name}의 선언 ${state.realDecl} · 내 카드 ${state.players[0].card}`,kind:'verdict'});
    if(runId!==state.runId)return;
    await endRound();
  }

  function advanceTurn() {
    state.awaitingReaction = false;
    let next = state.turnIdx;
    for (let i = 0; i < 4; i++) {
      next = (next + 1) % 4;
      if (state.players[next].hp > 0) break;
    }
    state.turnIdx = next;
    if (next === 0) $("declare-input").value = "";
    state.busy = false;
    render();
    if (next === 0) say("당신의 차례", "이전 숫자보다 높게 선언하거나, 상대의 허세를 GREED!로 찌르세요.");
    else runCpuTurn();
  }

  async function runCpuTurn() {
    const cpu = state.players[state.turnIdx];
    await sleep(950);
    if (state.phase !== "turn" || state.turnIdx !== cpu.id || cpu.hp <= 0) return;

    const est = Math.round((actualSum() - cpu.card) + 12);
    const minReq = state.maxDecl + 1;
    const target = minReq > est + 4 ? minReq : Math.max(minReq, Math.min(minReq + 4, est));
    const useDouble = hasCard(cpu, "head_of_greed") && calcTierReward(target - state.maxDecl, state.declCount === 0) >= 30 && target <= est && Math.random() < 0.45;
    await performDeclaration(cpu, target, { doubleOath: useDouble });
  }

  // --- 라운드 종료 ---
  async function endRound() {
    const runId=state.runId;
    const alreadyRevealed=state.roundRevealSum!==null;
    const sum=state.roundRevealSum??actualSum();
    state.revealing=true;state.awaitingReaction=false;state.phase='dealing';state.busy=true;
    if(!alreadyRevealed)await window.GREED_SCENE.present({title:String(sum),eyebrow:'합계',detail:`내 카드 ${state.players[0].card}`,kind:'verdict'});
    if(runId!==state.runId)return;
    const deckEl=$('center-deck');
    for(let i=0;i<state.players.length;i++){
      if(!state.dealtSeats.has(i))continue;
      const card=$(`card-seat-${i}`);
      card.classList.add('waiting-card');
      await animateCardFlight(card,deckEl,String(state.players[i].card),300);
      if(runId!==state.runId)return;
      state.dealtSeats.delete(i);
    }
    state.busy=false;
    if(!checkGameOver())openMaintenance();
  }

  function checkGameOver() {
    const alive=state.players.filter(p=>p.hp>0);
    if(state.players[0].hp>0&&alive.length>1)return false;
    state.phase='gameover';state.busy=false;state.awaitingReaction=false;
    const ranked=[...state.players].sort((a,b)=>Number(b.hp>0)-Number(a.hp>0)||b.points-a.points||b.hp-a.hp);
    const winner=ranked[0];
    $("gameover-title").textContent=winner.id===0&&winner.hp>0?"승리":"거래 종료";
    $("gameover-desc").textContent=state.players[0].hp<=0?"더는 테이블에 남을 수 없다.":`${winner.name}의 승리. ${winner.points}P.`;
    $("gameover-standings").replaceChildren(...ranked.map((p,i)=>{
      const row=document.createElement('div');
      row.textContent=`${i+1}. ${p.name} · ${p.points}P${p.hp<=0?' · 탈락':''}`;
      return row;
    }));
    render();
    if(!$("gameover-dialog").open)$("gameover-dialog").showModal();
    return true;
  }

  function openMaintenance() {
    state.phase = "maintenance";
    state.busy = false;
    $("drawn-result").classList.add("hidden");

    state.players.filter((p) => !p.isHuman && p.hp > 0).forEach((cpu) => {
      if (cpu.debt > 0 && cpu.points >= cpu.debt) {
        cpu.points -= cpu.debt;
        cpu.debt = 0;
        cpu.limbs = [];
      }
      if (cpu.inventory.length < 3 && cpu.points >= RULES.drawCost && Math.random() < 0.6) {
        cpu.points -= RULES.drawCost;
        addToInventory(cpu, pickBlindCard(cpu));
      }
    });

    renderMaintenanceDialog();
    $("shop-dialog").showModal();
    render();
  }

  function renderMaintenanceDialog() {
    const me = state.players[0];
    $("shop-pts-info").textContent = `${me.points}P (${me.inventory.length}/3)`;

    const maintBox = $("shop-maintenance-actions");
    maintBox.innerHTML = "";

    if (me.debt > 0) {
      const btnPay = document.createElement("button");
      btnPay.className = "btn-ghost";
      btnPay.disabled = me.points <= 0;
      btnPay.onclick = () => { payMyDebt(); renderMaintenanceDialog(); };
      btnPay.textContent = "갚기";
      const settlement = document.createElement("div");
      settlement.className = "debt-settlement";
      const balance = document.createElement("span");
      balance.textContent = `미상환 ${me.debt}P`;
      settlement.append(balance, btnPay);
      maintBox.appendChild(settlement);
    }

    if (hasCard(me, "cursed_pawn_ticket") && me.hp > 1) {
      const btnPawn = document.createElement("button");
      btnPawn.className = "btn-ghost";
      btnPawn.innerHTML = `${GREED_ICONS.markup("cursed_pawn_ticket")} 체력1 → +30P`;
      btnPawn.onclick = () => {
        me.hp -= 1;
        me.points += 30;
        me.noHealNextRound = true;
        spawnFloatText(seatTargetEl(me), "+30P", "pts");
        renderMaintenanceDialog();
        render();
      };
      maintBox.appendChild(btnPawn);

      if (me.debt > 0 || me.limbs.length > 0) {
        const btnClear = document.createElement("button");
        btnClear.className = "btn-ghost";
        btnClear.innerHTML = `${GREED_ICONS.markup("cursed_pawn_ticket")} 체력1 → 빚/담보 해제`;
        btnClear.onclick = () => {
          me.hp -= 1;
          if (me.limbs.length > 0) me.limbs.pop();
          else me.debt = 0;
          me.noHealNextRound = true;
          renderMaintenanceDialog();
          render();
        };
        maintBox.appendChild(btnClear);
      }
    }

    if (hasCard(me, "light_indulgence") && (me.debt > 0 || me.limbs.length > 0)) {
      const btnInd = document.createElement("button");
      btnInd.className = "btn-ghost";
      btnInd.innerHTML = `${GREED_ICONS.markup("light_indulgence")} 면죄부 사용 (1R 유예)`;
      btnInd.onclick = () => {
        removeOneItem(me, "light_indulgence");
        if (me.limbs.length > 0) me.suppressedLimb = me.limbs[0];
        else me.debtDeferred = true;
        renderMaintenanceDialog();
        render();
      };
      maintBox.appendChild(btnInd);
    }

    $("btn-draw-card").disabled = state.busy || me.points < RULES.drawCost || me.inventory.length >= 3;
    $("btn-next-round").disabled = state.busy;
  }

  async function drawRandomCard() {
    const me = state.players[0];
    if (state.busy || state.phase !== "maintenance" || me.points < RULES.drawCost || me.inventory.length >= 3) return;
    const runId = state.runId;
    const picked = pickBlindCard(me);
    state.busy = true;
    me.points -= RULES.drawCost;
    const origin = document.querySelector(".physical-deck").getBoundingClientRect();
    $("shop-dialog").close();
    render();
    const destination=document.querySelector(`[data-slot-kind="${picked.kind}"]:not(.filled)`);
    const completeLanding=await window.GREED_SCENE.drawCard(picked,origin,destination);
    if (runId !== state.runId) return;
    addToInventory(me, picked);
    state.busy = false;
    const res = $("drawn-result");
    res.innerHTML = `${GREED_ICONS.markup(picked.id)} <strong>${picked.name}</strong>`;
    res.classList.remove("hidden");
    renderMaintenanceDialog();
    render();
    completeLanding?.();
    $("shop-dialog").showModal();
  }

  async function finishMaintenance() {
    if (state.busy) return;
    const runId = state.runId;
    state.busy = true;
    $("shop-dialog").close();
    render();
    for (const p of state.players) {
      if (p.debtDeferred) { p.debtDeferred = false; continue; }
      if (p.hp > 0 && p.debt > 0 && hasCard(p, "head_of_greed")) {
        const avail = LIMBS.filter((l) => !p.limbs.includes(l));
        if (avail.length > 0) {
          const taken = avail[Math.floor(Math.random() * avail.length)];
          p.limbs.push(taken);
          if (p.isHuman) {
            say("탐욕의 머리", `"아직 ${p.debt}P가 남았지. 네 ${taken}, 내가 가져가마."`);
            await window.GREED_SCENE.seize(taken, p.debt);
            if (runId !== state.runId) return;
          }
        }
      }
    }
    state.round++;
    startRound();
  }

  // --- 인벤토리 카드 사용 ---
  async function onUseInventoryCard(card) {
    const me = state.players[0];
    if (!canClickInventoryCard(me, card)) return;
    const runId = state.runId;
    state.busy = true;
    render();
    await window.GREED_SCENE.present({ title: card.name, eyebrow: card.kind === "relic" ? "RELIC" : "ITEM", icon: card.icon, kind: "item" });
    if (runId !== state.runId) return;
    state.busy = false;
    if (card.id === "fate_bones") {
      state.busy = true;
      removeOneItem(me, card.id);
      render();
      const a = RULES.rollD20(), b = RULES.rollD20();
      const result = RULES.diceOutcome(a, b);
      await window.GREED_DICE.roll(a, b, result);
      if (runId !== state.runId) return;
      me.points = Math.max(0, me.points + result.points);
      if (result.hp < 0 || !me.noHealThisRound) me.hp = Math.max(0, Math.min(me.maxHp, me.hp + result.hp));
      state.busy = false;
      say("운명", `${a} · ${b} → ${result.value}/400. ${result.name}.`);
      render();
      checkGameOver();
    } else
    if (card.id === "smoke_bomb") {
      removeOneItem(me, "smoke_bomb");
      me.smokeActive = true;
      say("YOU", "연막탄을 터뜨렸다. 이번 턴에는 아무도 날 적발할 수 없어.");
      render();
    } else if (card.id === "bloody_bandage") {
      if (me.noHealThisRound || me.hp >= me.maxHp) {
        say("안내", "지금은 체력을 회복할 수 없습니다.");
        render();
        return;
      }
      removeOneItem(me, "bloody_bandage");
      me.hp = Math.min(me.maxHp, me.hp + 1);
      me.bandagePenalty += 5;
      spawnFloatText(seatTargetEl(me), "+1♥", "heal");
      say("YOU", "피의 붕대로 상처를 감았다. (+1♥, 이번 라운드 선언 보상 -5P)");
      render();
    } else if (card.id === "rusty_dice_box") {
      me.usedSwapThisRound = true;
      me.swapZeroNext = true;
      state.busy = true;
      render();
      $("card-seat-0").classList.add("waiting-card");
      await animateCardFlight($("card-seat-0"), $("center-deck"), "?");
      if (runId !== state.runId) return;
      me.card = RULES.higherHiddenCard(state.players, me.id);
      await animateCardFlight($("center-deck"), $("card-seat-0"), "?");
      if (runId !== state.runId) return;
      state.busy = false;
      say("YOU", "새 봉인을 덧씌웠다. 숫자는 여전히 알 수 없다.");
      render();
    } else if (card.id === "pickpocket_hook") {
      openTargetChoice("소매치기의 갈고리", "일반 아이템을 훔칠 상대를 선택하세요.", (target) => {
        removeOneItem(me, "pickpocket_hook");
        const targetItems = target.inventory.filter((c) => c.kind === "item");
        if (targetItems.length === 0) {
          say("안내", `${target.name}의 주머니엔 훔칠 일반 아이템이 없었습니다.`);
        } else {
          const stolen = targetItems[Math.floor(Math.random() * targetItems.length)];
          removeOneItem(target, stolen.id);
          addToInventory(me, stolen);
          say("YOU", `${target.name}에게서 [${stolen.name}]을(를) 슬쩍했습니다.`);
        }
        render();
      });
    } else if (card.id === "meddling_hand") {
      openMeddlingHandModal();
    }
  }

  let targetSelection = null;
  function clearTargetChoice() {
    targetSelection = null;
    document.body.classList.remove("targeting");
    document.getElementById("target-prompt")?.remove();
    document.querySelectorAll(".opp-seat").forEach(seat => {
      seat.classList.remove("targetable", "target-hover");
      seat.removeAttribute("role"); seat.removeAttribute("tabindex");
    });
  }
  function openTargetChoice(title, desc, onPick) {
    clearTargetChoice();
    targetSelection = {onPick, runId: state.runId};
    document.body.classList.add("targeting");
    const prompt = document.createElement("div");
    prompt.id = "target-prompt";
    prompt.textContent = "상대를 가리킨 뒤 클릭 · Esc 취소";
    document.querySelector(".stage-room").append(prompt);
    state.players.filter(p => !p.isHuman && p.hp > 0).forEach(p => {
      const seat = $("seat-" + p.id);
      seat.classList.add("targetable"); seat.tabIndex = 0;
      seat.setAttribute("role", "button"); seat.setAttribute("aria-label", p.name + " 지목");
    });
    render();
  }
  function openMeddlingHandModal() {
    openTargetChoice("참견의 손", "", openRpsBattle);
  }
  document.querySelectorAll(".opp-seat").forEach(seat => {
    seat.addEventListener("pointerenter", () => seat.classList.toggle("target-hover", seat.classList.contains("targetable")));
    seat.addEventListener("pointerleave", () => seat.classList.remove("target-hover"));
    const choose = () => {
      if (!targetSelection || !seat.classList.contains("targetable")) return;
      const selection = targetSelection;
      const target = state.players.find(p => "seat-" + p.id === seat.id);
      clearTargetChoice();
      if (selection.runId === state.runId && target?.hp > 0) selection.onPick(target);
      render();
    };
    seat.addEventListener("click", choose);
    seat.addEventListener("keydown", e => { if (["Enter", " "].includes(e.key)) {e.preventDefault(); choose();} });
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && targetSelection) {clearTargetChoice(); render();} });

  function openRpsBattle(cpu) {
    const me = state.players[0];
    $("choice-title").textContent = `${cpu.name}와(과) 가위바위보`;
    $("choice-desc").textContent = "승자 +15P, 패자 -1♥";
    const box = $("choice-options");
    box.innerHTML = "";
    ["가위", "바위", "보"].forEach((pick, idx) => {
      const btn = document.createElement("button");
      btn.className = "btn-primary";
      btn.textContent = pick;
      btn.onclick = () => {
        me.usedHandThisRound = true;
        const cpuIdx = Math.floor(Math.random() * 3);
        const cpuPick = ["가위", "바위", "보"][cpuIdx];
        if (idx === cpuIdx) {
          say(cpu.name, `"${cpuPick}... 비겼군."`);
        } else if ((idx - cpuIdx + 3) % 3 === 1) {
          me.points += 15;
          cpu.hp = Math.max(0, cpu.hp - 1);
          cpu.mood = "shock";
          spawnFloatText(seatTargetEl(me), "+15P", "pts");
          spawnFloatText(seatTargetEl(cpu), "-1♥", "dmg");
          say(cpu.name, `"젠장... (${pick} vs ${cpuPick}) 네가 이겼군."`);
        } else {
          cpu.points += 15;
          me.hp = Math.max(0, me.hp - 1);
          cpu.mood = "smug";
          spawnFloatText(seatTargetEl(me), "-1♥", "dmg");
          say(cpu.name, `"${cpuPick}! 내 손은 못 이기지."`);
        }
        $("choice-dialog").close();
        render();
        checkGameOver();
      };
      box.appendChild(btn);
    });
    $("choice-dialog").showModal();
  }

  let inspectedCard = null;
  let inspectionAnchor = null;
  let inspectionHideTimer;
  let inspectionVersion = 0;
  let inspectionMotion = null;
  let inspectionGhost = null;
  function closeInspection() {
    clearTimeout(inspectionHideTimer);
    inspectedCard=null;inspectionAnchor=null;
    const version=++inspectionVersion,panel=$("card-detail-dialog");
    inspectionGhost?.remove();inspectionGhost=null;
    const opacity=getComputedStyle(panel).opacity;
    inspectionMotion?.cancel();
    if(!panel.classList.contains("hidden")) {
      panel.classList.add("departing");
      const motion=panel.animate([{opacity,translate:"0 0"},{opacity:0,translate:"0 -4px"}],{duration:100,easing:"linear",fill:"forwards"});
      inspectionMotion=motion;
      motion.finished.then(()=>{
        if(version!==inspectionVersion)return;
        panel.classList.add("hidden");panel.classList.remove("departing");motion.cancel();inspectionMotion=null;
      }).catch(()=>{});
    }
    $("rules-dialog").classList.add("hidden");
  }
  function refreshInspection() {
    if (!inspectedCard) return;
    const usable = canClickInventoryCard(state.players[0], inspectedCard);
    $("btn-cd-use").disabled = !usable;
    $("btn-cd-use").classList.toggle("hidden", !usable);
    const me = state.players[0];
    $("cd-note").textContent = inspectedCard.id === "bloody_bandage"
      ? me.hp >= me.maxHp ? "체력이 이미 가득 찼어." : me.noHealThisRound ? "이번 라운드에는 회복할 수 없어." : ""
      : "";
  }
  function openCardDetail(card, anchor) {
    clearTimeout(inspectionHideTimer);
    const panel=$("card-detail-dialog");
    if(inspectedCard?.id===card.id && inspectionAnchor===anchor) {refreshInspection();return;}
    const replacing=!panel.classList.contains("hidden");
    const oldBounds=replacing?panel.getBoundingClientRect():null;
    const oldOpacity=replacing?Number(getComputedStyle(panel).opacity):0;
    inspectionGhost?.remove();inspectionGhost=null;
    inspectionMotion?.cancel();inspectionMotion=null;
    if(replacing && oldOpacity>.02) {
      const ghost=panel.cloneNode(true);
      ghost.removeAttribute("id");ghost.setAttribute("aria-hidden","true");ghost.className="inspect-panel inspection-echo";
      ghost.querySelectorAll("[id]").forEach(el=>el.removeAttribute("id"));
      ghost.querySelectorAll("button").forEach(el=>el.tabIndex=-1);
      Object.assign(ghost.style,{left:oldBounds.left+"px",top:oldBounds.top+"px",bottom:"auto",width:oldBounds.width+"px",translate:"0 0"});
      panel.before(ghost);inspectionGhost=ghost;
      const fade=ghost.animate([{opacity:oldOpacity},{opacity:0}],{duration:90,easing:"linear",fill:"forwards"});
      fade.finished.then(()=>{ghost.remove();if(inspectionGhost===ghost)inspectionGhost=null;}).catch(()=>{});
    }
    const bounds=anchor?.getBoundingClientRect?.();
    if(bounds) {
      const width=Math.min(340,innerWidth-24);
      panel.style.width=width+"px";
      panel.style.left=Math.max(12,Math.min(innerWidth-width-12,bounds.x+bounds.width/2-width/2))+"px";
      panel.style.right="auto";panel.style.bottom=Math.max(140,innerHeight-bounds.top+14)+"px";
    }
    const version=++inspectionVersion;
    inspectedCard=card;inspectionAnchor=anchor;
    $("cd-title").innerHTML=`${GREED_ICONS.markup(card.id)} <span>${card.name}</span>`;
    $("cd-kind").textContent=card.kind==="relic"?"RELIC":"ITEM";
    $("cd-desc").textContent=card.desc;
    panel.classList.remove("hidden","departing","arrive");
    $("btn-cd-use").onclick=()=>{if(canClickInventoryCard(state.players[0],card)){closeInspection();onUseInventoryCard(card);}};
    refreshInspection();
    const next=panel.getBoundingClientRect();
    const dx=oldBounds?oldBounds.left-next.left:0,dy=oldBounds?oldBounds.top-next.top:4;
    const motion=panel.animate([
      {opacity:replacing?Math.min(.5,oldOpacity):0,translate:`${dx}px ${dy}px`},
      {opacity:1,translate:"0 0"}
    ],{duration:160,easing:"cubic-bezier(.16,1,.3,1)",fill:"forwards"});
    inspectionMotion=motion;
    motion.finished.then(()=>{if(version===inspectionVersion){motion.cancel();inspectionMotion=null;}}).catch(()=>{});
  }

  // --- 이벤트 바인딩 ---
  $("btn-dec-minus").onclick = () => {
    const inp = $("declare-input");
    const cur = inp.value === "" ? Number(inp.min) : Number(inp.value);
    inp.value = Math.max(Number(inp.min), cur - 1);
    updateDeclarePreview();
  };
  $("btn-dec-plus").onclick = () => {
    const inp = $("declare-input");
    const cur = inp.value === "" ? Number(inp.min) : Number(inp.value);
    inp.value = Math.min(96, cur + 1);
    updateDeclarePreview();
  };
  $("declare-input").oninput = () => {
    const inp = $("declare-input");
    if (inp.value !== "" && Number(inp.value) > 96) inp.value = 96;
    updateDeclarePreview();
  };
  $("declare-input").onblur = () => {
    const inp = $("declare-input");
    if (inp.value !== "" && Number(inp.value) < Number(inp.min)) {
      inp.value = inp.min;
      updateDeclarePreview();
    }
  };

  $("btn-toggle-oath").onclick = () => {
    state.oathArmed = !state.oathArmed;
    render();
  };

  $("btn-declare").onclick = () => {
    if (state.busy || state.awaitingReaction || state.phase !== "turn" || state.turnIdx !== 0) return;
    const me = state.players[0];
    const inp = $("declare-input");
    const minReq = Number(inp.min);
    const val = inp.value === "" ? minReq : Number(inp.value);
    if (val < minReq) {
      inp.value = minReq;
      updateDeclarePreview();
      return say("안내", `보이는 합계/이전 선언(${minReq}) 미만은 입력할 수 없습니다.`);
    }
    const doubleOath = state.oathArmed;
    state.oathArmed = false;
    performDeclaration(me, val, { doubleOath });
  };

  $("btn-greed").onclick = () => { if (!$("btn-greed").disabled) resolveGreed(state.players[0]); };
  $("btn-pass").onclick = () => { if (state.awaitingReaction && !state.busy) finishDeclaration(); };
  $("btn-draw-card").onclick = drawRandomCard;
  $("btn-next-round").onclick = finishMaintenance;
  $("btn-choice-cancel").onclick = () => $("choice-dialog").close();
  document.querySelectorAll(".inventory-panel,.relic-panel,#card-detail-dialog").forEach((region) => {
    region.addEventListener("pointerenter", () => clearTimeout(inspectionHideTimer));
    region.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") inspectionHideTimer = setTimeout(closeInspection, 220); });
    region.addEventListener("focusout", (event) => {
      if (!event.relatedTarget?.closest(".inventory-panel,.relic-panel,#card-detail-dialog")) inspectionHideTimer = setTimeout(closeInspection, 120);
    });
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" && !event.target.closest(".inventory-panel,.relic-panel,#card-detail-dialog")) closeInspection();
  });
  $("btn-rules").onclick = () => {
    const wasOpen = !$("rules-dialog").classList.contains("hidden");
    closeInspection();
    if (wasOpen) return;
    $("pause-menu").appendChild($("rules-dialog"));
    $("rules-dialog").classList.remove("hidden");
    $("btn-close-rules").focus({ preventScroll: true });
  };
  $("btn-close-rules").onclick = closeInspection;
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeInspection(); });
  document.querySelector(".vn-dialogue").onclick = () => $("vn-text").classList.add("revealed");
  const menu = $("pause-menu");
  function openMenu() { if (!menu.open) { clearTargetChoice(); window.GREED_SCENE.pause(true); menu.showModal(); } }
    function resumeGame() { menu.close(); closeInspection(); window.GREED_SCENE.pause(false); render(); }
  $("btn-menu").onclick = openMenu;
  $("btn-resume").onclick = resumeGame;
  menu.addEventListener("cancel", (event) => { event.preventDefault(); resumeGame(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && !menu.open) { event.preventDefault(); openMenu(); }
    if (menu.open || event.target.matches("input,textarea")) return;
      const slots = [...document.querySelectorAll(".relic-panel button.filled,.inventory-panel button.filled")];
    if (["1", "2", "3"].includes(event.key)) { event.preventDefault(); slots[Number(event.key)-1]?.focus(); }
    if (["ArrowLeft", "ArrowRight"].includes(event.key) && slots.includes(document.activeElement)) {
      event.preventDefault();const i=slots.indexOf(document.activeElement);slots[(i+(event.key==="ArrowRight"?1:slots.length-1))%slots.length]?.focus();
    }
    if (event.key === "ArrowDown" && slots.includes(document.activeElement) && !$("btn-cd-use").classList.contains("hidden")) { event.preventDefault(); $("btn-cd-use").focus(); }
  });
  $("btn-restart").onclick = () => { resumeGame(); startNewGame(); };
  $("btn-play-again").onclick = () => { $("gameover-dialog").close(); startNewGame(); };

  startNewGame();
})();
