const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = {window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/rules.js'),'utf8'),context);
const r = context.window.GREED_RULES;
// Hidden upgrades may only increase to an unoccupied number; at the ceiling stay hidden.
const upgradePlayers=[{id:0,card:5},{id:1,card:6},{id:2,card:12},{id:3,card:18}];
for(let i=0;i<100;i++) {
  const value=r.higherHiddenCard(upgradePlayers,0,()=>i/100);
  assert.ok(value>5 && value<=24);
  assert.ok(![6,12,18].includes(value));
}
assert.equal(upgradePlayers[0].card,5);
upgradePlayers[0].card=24;
assert.equal(r.higherHiddenCard(upgradePlayers,0,()=>0),24);
upgradePlayers[0].card=22;upgradePlayers[1].card=23;upgradePlayers[2].card=24;
assert.equal(r.higherHiddenCard(upgradePlayers,0,()=>.5),22);
const players = [
  {id:0,isHuman:true,hp:3,card:24},
  {id:1,hp:3,card:1},{id:2,hp:3,card:2},{id:3,hp:3,card:10}
];
assert.equal(r.minimum(players),16); // 1+2+10 + smallest remaining 3
assert.equal(r.minimum(players,3),10); // 1+2 + smallest remaining 3+4
players[0].card=8;players[3].card=19;
assert.equal(r.minimum(players,3),10); // hidden actual values never affect the bound
players[3].hp=0;
assert.equal(r.minimum(players),6);
players[3].card=3;
assert.equal(r.minimum(players),7); // a public eliminated card is still unavailable in this deal
assert.equal(r.debt(30),45);
assert.equal(r.debt(40),60);
const p={inventory:[{kind:'relic'},{kind:'item'},{kind:'item'}]};
assert.equal(r.hasRoom(p,'relic'),false);assert.equal(r.hasRoom(p,'item'),false);
const histogram={};const values=new Set();
for(let a=1;a<=20;a++)for(let b=1;b<=20;b++){
  const outcome=r.diceOutcome(a,b);values.add(outcome.value);
  histogram[outcome.name]=(histogram[outcome.name]||0)+1;
}
assert.equal(values.size,400);
assert.deepEqual(Object.values(histogram),[20,100,160,100,20]);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/dice.js'),'utf8'),context);
assert.equal(context.window.GREED_DICE.geometry.vertices,12);
assert.equal(context.window.GREED_DICE.geometry.edges,30);
assert.equal(context.window.GREED_DICE.geometry.faces,20);
assert.equal(context.window.GREED_DICE.geometry.regular,true);
console.log('Minimum information bounds, debt ratio, slots and all 400 dice outcomes: passed');
