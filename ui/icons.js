// Original vector emblems. All cards use the same engraved, single-ink drawing style.
(() => {
  const paths={
    head_of_greed:'<path d="M11 23C6 7 17 5 24 5s18 2 13 18l-6 6v10H17V29Z"/><path d="M15 17l6 2-2 6-5-1Zm18 0-6 2 2 6 5-1ZM24 23l-3 6h6ZM18 33h12m-9-2v8m6-8v8"/><path d="m17 5 2-3 5 2 5-2 2 3M11 41h26"/>',
    meddling_hand:'<path d="M14 27V14c0-4 5-4 5 0v9-14c0-4 5-4 5 0v14-13c0-4 5-4 5 0v14-10c0-4 5-4 5 0v15l4-5c3-3 6 0 4 3l-8 12-3 3H19l-9-10c-3-4 0-7 3-4l5 5"/><path d="M19 41v4h13v-4M22 31l3-4 4 4-4 5Z"/>',
    executioner_whistle:'<path d="M7 22h15l6-7 13 5-5 12-13-3H10ZM10 22v7m15-11 5 9M34 10l3-5m4 9 5-2M19 31c-3 12-12 13-13 6-1-4 3-6 5-3"/><circle cx="28" cy="23" r="2"/>',
    empty_slot_contract:'<path d="M11 7h24v29c0 6-6 8-8 2H7c5-3 4-8 4-12Z"/><path d="M27 38V16h13c2-8-4-11-8-9M16 17h7m-7 6h7m-7 7h7M7 41h29"/>',
    rusty_dice_box:'<path d="m13 5 25 4-5 35-25-4Z"/><path d="m19 11 12 2-2 12-12-2ZM18 33l5-5 4 6m-5-5-2 10"/><path d="M4 10l3-4m31 33 5-1M6 30l-3 1"/>',
    cursed_pawn_ticket:'<path d="M5 13h38v7c-7 0-7 9 0 9v7H5v-7c7 0 7-9 0-9Z"/><path d="M15 13v4m0 5v4m0 5v5M29 19v11m-5-8c7-6 11 3 4 3s-5 8 3 4"/>',
    fate_bones:'<path d="m24 4 18 12-3 22-21 6L5 27 10 10Zm0 0-6 17L5 27m13-6 21 17M18 21l24-5M24 4l15 34M5 27l34 11M10 10l8 11v23"/><path d="m22 25 5-2 3 5-5 3Z"/>',
    smoke_bomb:'<path d="M13 29c-12 1-10 13 0 13h24c8-3 7-11 0-12-2-7-13-10-18-3-3-3-7-1-6 2ZM21 20c-10-4 1-8 1-13M30 23c8-6-5-9 3-16M13 20c-6-3-4-7-1-10"/>',
    light_indulgence:'<path d="M11 36 33 7c5 6 6 14-2 21l-9 2-2 8-8 3m7-15 8 1m-3-8 7 1M8 44l20-27M9 13l-3-3m2 11H3m9-14V3"/>',
    pickpocket_hook:'<path d="M16 5c5-3 11 0 11 5v21c0 12 16 11 16 0l-5 4m5-4v-6M17 10l9 2M10 27l-5 3m7 4-3 5M20 18l6 1"/><circle cx="21" cy="8" r="2"/>',
    bloody_bandage:'<path d="m8 18 10-10c4-4 8-4 12 0l10 10c4 4 4 8 0 12L30 40c-4 4-8 4-12 0L8 30c-4-4-4-8 0-12Z"/><path d="m15 20 5-5 13 13-5 5ZM13 22l-3 3m13-13 3-3m-7 25-3 3m18-18 3-3"/><path d="M24 20c-6 5-4 9 0 9s6-4 0-9Z"/>'
  };
  function markup(id){
    const body=paths[id]||'<path d="M24 5 42 24 24 43 6 24Z"/><path d="M24 15v18m-9-9h18"/>';
    return `<svg class="item-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon="${id}">${body}</svg>`;
  }
  window.GREED_ICONS={markup,mount(element,id){element.innerHTML=markup(id);},has(id){return Boolean(paths[id]);}};
})();
