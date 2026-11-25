const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const warnings=[];
const c={window:{},performance,console:{log(){},warn(...a){warnings.push(a.join(' '));},error(...a){warnings.push(a.join(' '));}}};
vm.createContext(c);
for(const file of ['vendor/cannon-es.js','dice-physics.js','dice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui',file),'utf8'),c);
const dice=c.window.GREED_DICE;
let collisions=0,maxTime=0;
for(let seed=1;seed<=60;seed++){
  const roll=dice.simulate(seed);maxTime=Math.max(maxTime,roll.duration);
  assert.equal(roll.sleeping,true,`seed ${seed} did not settle`);
  assert(roll.groundContacts>0);collisions+=roll.collisions;
  for(const speed of roll.finalSpeed){assert.equal(speed.linear,0);assert.equal(speed.angular,0);}
  const first=roll.frames[0],last=roll.frames.at(-1);
  assert(last[0].p[1]<first[0].p[1]);assert(last[1].p[1]<first[1].p[1]);
  for(let die=0;die<2;die++)for(let value=1;value<=20;value++){
    const labels=dice.numbering(value,roll.upFaces[die],seed%3);
    assert.equal(labels[roll.upFaces[die]],value);
    assert.equal(new Set(labels).size,20);
    assert.equal(Math.min(...labels),1);assert.equal(Math.max(...labels),20);
  }
}
assert(collisions>0);assert.equal(warnings.length,0);
assert.equal(JSON.stringify(dice.simulate(31).frames),JSON.stringify(dice.simulate(31).frames));
assert.notEqual(JSON.stringify(dice.simulate(31).frames),JSON.stringify(dice.simulate(32).frames));
console.log(`60 rigid-body rolls settled naturally; contacts, collisions, consistent numbering and repeatable seeds passed (max ${maxTime.toFixed(2)}s)`);
