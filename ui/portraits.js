// Original vector character art, sized for a visual-novel stage.
window.greedPortrait = function (p) {
  const id = `portrait-${p.id}`;
  const hood = p.style === "hood";
  const hat = p.style === "hat";
  const startled = p.mood === "shock" || p.mood === "sweat";
  const eyes = p.hp <= 0
    ? '<path d="m121 137 15 10m-15 0 15-10m30 0 15 10m-15 0 15-10"/>'
    : `<path d="M119 ${startled ? 136 : 140}q9 ${startled ? -8 : -3} 18 0M163 ${startled ? 136 : 140}q9 ${startled ? -8 : -3} 18 0"/><path d="M129 139v5m43-5v5" stroke="#e4cfa3" stroke-width="3"/>`;
  return `<svg class="standee" viewBox="0 0 300 400" role="img" aria-label="${p.name}의 상반신">
    <defs>
      <linearGradient id="${id}-coat" x1="0" x2="1"><stop stop-color="#111a1b"/><stop offset=".48" stop-color="${hood ? '#424b46' : hat ? '#68433c' : '#3e5556'}"/><stop offset="1" stop-color="#11191c"/></linearGradient>
      <linearGradient id="${id}-skin" x1="0" x2="1"><stop stop-color="#776b58"/><stop offset=".45" stop-color="#c1ad86"/><stop offset="1" stop-color="#64584b"/></linearGradient>
    </defs>
    <path d="M38 400 44 282Q51 246 112 230L185 230Q247 241 258 282L270 400Z" fill="url(#${id}-coat)" stroke="#101516" stroke-width="4"/>
    <path d="m109 229 42 34 38-34-12 82-29 39-32-39Z" fill="#a79a7d"/>
    <path d="m145 267-10 16 13 54 15-54-12-16" fill="#242427"/>
    <path d="m106 229-28 19 31 39-17 14 56 56-23-96m64-32 29 20-31 38 16 14-55 56 22-96" fill="url(#${id}-coat)" stroke="#8d8268" stroke-width="1.4"/>
    <g class="portrait-head">
    <path d="M124 192v44q25 29 53 0v-44" fill="url(#${id}-skin)" stroke="#2b2826" stroke-width="3"/>
    ${hood ? '<path d="M83 240Q57 173 83 101 104 47 151 42 216 45 229 115L222 244 185 226 112 230Z" fill="#303e38" stroke="#151e1c" stroke-width="5"/>' : ''}
    <path d="M102 122Q98 83 149 80 201 80 200 125L194 179Q182 210 151 218 120 208 106 178Z" fill="url(#${id}-skin)" stroke="#2b2826" stroke-width="3"/>
    <path d="m105 153 13 24 13 7m62-31-13 24-13 7M150 137l-9 31 15 3" fill="none" stroke="#695a48" stroke-width="2"/>
    <path d="M111 123q17-10 29-1m19 0q14-9 29 1" fill="none" stroke="#302d29" stroke-width="5"/>
    <g class="portrait-eyes" fill="none" stroke="#292b27" stroke-width="3" stroke-linecap="round">${eyes}</g>
    <path d="${startled ? 'M139 188q12-10 24 0l-3 9h-18Z' : p.mood === 'smug' ? 'M131 185q22 16 42-4' : 'M135 190q16 4 32-1'}" fill="${startled ? '#332a28' : 'none'}" stroke="#443b31" stroke-width="2.5"/>
    ${hat ? '<path d="M96 116 104 75Q150 59 192 77L204 116Z" fill="#252628"/><path d="m77 112 25-19 94 2 28 19q-69 24-147-2Z" fill="#242b2c" stroke="#727266" stroke-width="2"/><path d="m104 88 91 2 4 14-99-2Z" fill="#75463d"/>' : hood ? '<path d="M84 152Q75 69 151 51 216 67 217 156L189 105 151 87 110 112Z" fill="#35433c" stroke="#68725e" stroke-width="2"/>' : '<path d="M100 129Q82 68 145 67 207 63 201 128L177 93 155 106 130 99Z" fill="#797e75" stroke="#333c38" stroke-width="3"/><path d="m106 112 21-28m60 22-19-24" stroke="#b4b4a0" fill="none" stroke-width="2"/><circle cx="173" cy="143" r="18" fill="#9cbbba" fill-opacity=".12" stroke="#c8ad73" stroke-width="2"/><path d="M191 147q24 80 5 126" fill="none" stroke="#a48f61" stroke-width="2"/>'}
    </g>
    ${hood ? '<path d="m115 222 36 39 38-40" fill="none" stroke="#7f8a70" stroke-width="3"/><ellipse cx="151" cy="269" rx="9" ry="12" fill="#b09a67"/><path d="m147 269 4-6 4 6-4 6Z" fill="#53655b"/>' : '<path d="M80 321h41m-21 0v14m106-20h25" stroke="#a3906c" stroke-width="2"/>'}
    <path d="M49 319q26-22 47 9l25 51-35 21H33Z" fill="url(#${id}-coat)" stroke="#141c1d" stroke-width="3"/>
    <path d="M251 319q-26-22-47 9l-25 51 35 21h53Z" fill="url(#${id}-coat)" stroke="#141c1d" stroke-width="3"/>
    <path d="m101 367 19-17q8-5 12 3l-7 13 22-6q10 1 6 9l-27 23-22-3Z" fill="url(#${id}-skin)" stroke="#3d3b32" stroke-width="2"/>
    <path d="m200 367-19-17q-8-5-12 3l7 13-22-6q-10 1-6 9l27 23 22-3Z" fill="url(#${id}-skin)" stroke="#3d3b32" stroke-width="2"/>
  </svg>`;
};
