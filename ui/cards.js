// GREED! 유물 6종 · 일반 아이템 5종. 가격은 통합 무작위 뽑기 규칙을 따른다.
window.GREED_CARDS = {
  relics: [
    {
      id: "head_of_greed",
      name: "탐욕의 머리",
      icon: "head_of_greed",
      short: "큰 선언의 두 배 서약",
      kind: "relic",
      price: 25,
      desc: "기본 보상 30P 이상인 선언에 두 배 서약을 건다. 보상은 2배, 추가 보상의 150%는 빚. 정비 종료 때 미상환 빚이 남으면 신체 기능 하나를 담보로 잡힌다."
    },
    {
      id: "meddling_hand",
      name: "참견의 손",
      icon: "meddling_hand",
      short: "가위바위보 승부",
      kind: "relic",
      price: 25,
      desc: "라운드당 1회: 지목한 상대와 가위바위보 승부. 승자 +15P, 패자 체력 -1. 숫자는 공개하지 않는다."
    },
    {
      id: "executioner_whistle",
      name: "사형집행인의 호루라기",
      icon: "executioner_whistle",
      short: "오발 배상15 · 2배벌",
      kind: "relic",
      price: 20,
      desc: "상대가 내 선언에 GREED! 실패 시 15P 배상. 반대로 내가 GREED! 실패 시 체력 2배 손실."
    },
    {
      id: "empty_slot_contract",
      name: "빈 자리의 계약서",
      icon: "empty_slot_contract",
      short: "빈칸당 +5P",
      kind: "relic",
      price: 15,
      desc: "라운드 종료 시 인벤토리 빈 칸당 +5P. 3칸을 모두 채우면 즉시 파괴됨."
    },
    {
      id: "rusty_dice_box",
      name: "가려진 봉인",
      icon: "rusty_dice_box",
      short: "숫자를 모르게 높이기",
      kind: "relic",
      price: 20,
      desc: "라운드당 1회: 내 카드를 더 큰 미사용 숫자로 봉인한다. 가능한 숫자가 없으면 유지된다. 숫자는 공개하지 않으며 기존 선언은 유지된다. 다음 선언 보상 0P."
    },
    {
      id: "cursed_pawn_ticket",
      name: "저주받은 전당포 티켓",
      icon: "cursed_pawn_ticket",
      short: "체력1→+30P/해제",
      kind: "relic",
      price: 18,
      desc: "정비 시간: 체력 1 소모(체력>1)로 +30P 또는 빚/담보 1개 제거. 다음 라운드 회복 불가."
    }
  ],
  items: [
    {
      id: "fate_bones", name: "운명의 뼛조각", icon: "fate_bones", short: "2d20 · 낮을수록 유리", kind: "item", price: 18,
      desc: "내 차례에 소모. 두 d20을 1~400으로 환산해 판정한다. 대성공(5%): 체력+1·30P, 성공(25%):20P, 평범한 성공(40%):10P, 실패(25%):-10P, 대실패(5%):체력-1. 낮을수록 유리하다."
    },
    {
      id: "smoke_bomb",
      name: "연막탄 봉투",
      icon: "smoke_bomb",
      short: "이번턴 GREED면역",
      kind: "item",
      price: 12,
      desc: "내 턴 사용: 이번 턴 선언 보상 0P 대신 상대가 나에게 GREED! 불가."
    },
    {
      id: "light_indulgence",
      name: "가벼운 면죄부",
      icon: "light_indulgence",
      short: "담보 1R 유예",
      kind: "item",
      price: 10,
      desc: "정비 시간 사용: 빚/감각 제한(눈·입·귀·손) 1개를 다음 1라운드 동안만 일시 해제."
    },
    {
      id: "pickpocket_hook",
      name: "소매치기의 갈고리",
      icon: "pickpocket_hook",
      short: "일반템 1개 강탈",
      kind: "item",
      price: 14,
      desc: "내 턴/정비 사용: 대상의 일반 아이템 1개를 무작위로 훔쳐옴."
    },
    {
      id: "bloody_bandage",
      name: "피의 붕대",
      icon: "bloody_bandage",
      short: "체력+1 · 보상-5P",
      kind: "item",
      price: 12,
      desc: "내 턴 사용: 체력 +1 회복(최대 3). 이번 라운드 내 선언 보상 -5P."
    }
  ]
};
