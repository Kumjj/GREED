// Motion, presentation and pause clock. No game rules or hidden-card information here.
(() => {
  const camera = document.getElementById("scene-camera");
  const overlay = document.getElementById("impact-overlay");
  const message = document.getElementById("sensory-message");
  const theatre = document.getElementById("central-theatre");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = false, generation = 0;
  let previous = new Map(), pausedAnimations = [], messageTimer;
  let targetX = 0, targetY = 0, viewX = 0, viewY = 0, clock = 0, lastFrame = 0;
  let pointerVX=0,pointerVY=0;
  let healthTarget=3,health=3;
  const inkAnimations=new Map();
  const recoil={x:0,y:0,r:0,vx:0,vy:0,vr:0};
  let dialogueVersion = 0, firstVisit = true;
  const moving = () => !reduced.matches;
  function syncMotion() {
    document.body.classList.toggle("motion-off", !moving());
  }
  reduced.addEventListener("change", syncMotion);syncMotion();
  function frame(now) {
    const dt = Math.min(.05, (now - (lastFrame || now)) / 1000);lastFrame = now;
    if (!paused && moving()) {
      clock += dt;
        health+=(healthTarget-health)*(1-Math.exp(-dt*3));
      const limit=innerWidth<=1100?16:38;
      // Independent springs add pointer motion and impact to the uninterrupted idle clock.
      pointerVX+=((Math.max(-limit,Math.min(limit,targetX))-viewX)*80-pointerVX*18)*dt;
      pointerVY+=((targetY-viewY)*80-pointerVY*18)*dt;
      viewX+=pointerVX*dt;viewY+=pointerVY*dt;
      for(const [position,velocity] of [["x","vx"],["y","vy"],["r","vr"]]) {
        recoil[velocity]+=(-recoil[position]*105-recoil[velocity]*15)*dt;
        recoil[position]+=recoil[velocity]*dt;
      }
        const weakness=Math.max(0,3-health),sway=1+weakness*.28;
        const x = (Math.sin(clock * .57) * 5.2 + Math.sin(clock * 1.17) * 2.2 + Math.sin(clock * 3.71) * .55 + Math.sin(clock * 10.4) * .13)*sway;
        const y = (Math.sin(clock * .7 + .8) * 3.8 + Math.sin(clock * 1.61 + .8) * 1.5 + Math.sin(clock * 4.33) * .38)*sway;
        const r = (Math.sin(clock * .93) * .34 + Math.sin(clock * 3.2) * .045)*sway;
      camera.style.transform = `translate(${viewX+x+recoil.x}px,${viewY+y+recoil.y}px) scale(${innerWidth<=1100?1.065:1.11}) rotate(${r+viewX*.014+recoil.r}deg)`;
        const pulse=Math.pow(Math.max(0,Math.sin(clock*1.12)),2);
        const haze=Math.max(0,2-health)*1.8*pulse;
        const blur=Math.min(2.5,Math.hypot(recoil.vx,recoil.vy)*.008)+haze;
        if(haze>.025)GREED_INK.vision(clock,haze*4);
        camera.dataset.healthBlur=haze.toFixed(3);camera.dataset.swayGain=sway.toFixed(3);
        camera.style.filter=(haze>.025?'url("#vision-wobble") ':'')+(blur>.025?`blur(${blur}px)`:'');
    } else if (!moving()) { camera.style.transform = "none";camera.style.filter=""; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.querySelector(".stage-room").addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const b = e.currentTarget.getBoundingClientRect();
    targetX = -((e.clientX-b.left)/b.width-.5)*(innerWidth<=1100?32:76);
    targetY = -((e.clientY-b.top)/b.height-.5)*(innerWidth<=1100?24:44);
  });
  document.querySelector(".stage-room").addEventListener("pointerleave", () => { targetX=0;targetY=0; });
  function wait(ms) {
    const token=generation;
    return new Promise((resolve) => {
      let elapsed=0,last=performance.now();
      function tick(now) {
        if(token!==generation)return;
        if(!paused)elapsed+=Math.min(now-last,80);
        last=now;
        if(elapsed>=ms)resolve();else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }
  async function animate(element, frames, options) {
    if(!moving()) {
      const final = frames[frames.length-1];
      for(const [key,value] of Object.entries(final)) if(key!=="offset"&&key!=="easing"&&key in element.style) element.style[key]=value;
      await wait(90);return;
    }
    const animation=element.animate(frames,options);
    if(paused) { animation.pause();pausedAnimations.push(animation); }
    try { await animation.finished; } catch {}
  }
  function ink(element,duration,out=false) {
    inkAnimations.get(element)?.();
    if(!moving())return wait(90);
    const token=generation,fx=GREED_INK.create(element);
    fx.set(out?1:0);
    let elapsed=0,last=performance.now();
    return new Promise(resolve=>{
      const finish=()=>{fx.remove();inkAnimations.delete(element);resolve();};
      inkAnimations.set(element,finish);
      function tick(now) {
        if(inkAnimations.get(element)!==finish)return;
        if(token!==generation||!element.isConnected){finish();return;}
        if(!paused)elapsed+=Math.min(now-last,60);last=now;
        const p=Math.min(1,elapsed/duration);
        fx.set(out?1-p:GREED_INK.entrance(p));
        if(p===1)finish();else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function announce(text) {
    clearTimeout(messageTimer);message.textContent=text;message.classList.add("visible");
    messageTimer=setTimeout(()=>message.classList.remove("visible"),2600);
  }
  function clearSeizure() {
    clearTimeout(messageTimer);message.classList.remove("visible","seizure-voice");
    overlay.getAnimations().forEach(a=>a.cancel());
    overlay.style.opacity="0";
  }
  async function present({title,eyebrow="",detail="",icon="",kind="action"}) {
    const token=generation;
    await GREED_INK.ready;
    if(token!==generation)return;
    theatre.replaceChildren();theatre.style.cssText="";theatre.className=`central-theatre ${kind}`;theatre.hidden=false;
    const wash=document.createElement("div");wash.className="ink-wash";
    const copy=document.createElement("div");copy.className="theatre-copy";
    for(const [tag,cls,txt] of [["span","theatre-kicker",eyebrow],["span","theatre-icon",icon],["strong","theatre-title",title],["span","theatre-detail",detail]]) {
      if(!txt)continue;const el=document.createElement(tag);el.className=cls;if(cls === "theatre-icon" && txt) el.innerHTML=GREED_ICONS.markup(txt); else el.textContent=txt;copy.appendChild(el);
    }
    theatre.append(wash,copy);
    await Promise.all([
      ink(wash,1750),
      ink(copy,1900)
    ]);
    if(token!==generation)return;
    await wait(kind==="verdict"?2000:kind==="region"?900:kind==="declaration"?260:450);
    if(token!==generation)return;
    await Promise.all([ink(wash,240,true),ink(copy,240,true)]);
    if(token===generation){theatre.hidden=true;theatre.style.cssText="";theatre.getAnimations().forEach(a=>a.cancel());}
  }
  async function travel(element, destination, start, options = {}) {
    const token=generation;
    let elapsed=0,last=performance.now();
    const duration=options.duration||700;
    return new Promise(resolve=>{
      function tick(now){
        if(token!==generation||!element.isConnected)return;
        if(!paused)elapsed+=Math.min(now-last,60);last=now;
        const progress=Math.min(1,elapsed/duration);
        const t=1-Math.pow(1-progress,3);
        const target=destination();
        const cx=start.x+(target.x-start.x)*t;
        const cy=start.y+(target.y-start.y)*t-Math.sin(Math.PI*t)*(options.arc||65);
        const sx=1+(target.width/start.width-1)*t;
        const sy=1+(target.height/start.height-1)*t;
        const angle=(options.startAngle||0)*(1-t)+(target.angle||0)*t+Math.sin(Math.PI*t)*(options.bend||-10);
        element.style.left=`${cx-start.width/2}px`;element.style.top=`${cy-start.height/2}px`;
        element.style.transform=`perspective(1000px) rotateY(${options.front?180:Math.sin(Math.PI*t)*20}deg) rotate(${angle}deg) scale(${sx},${sy})`;
        if(progress===1)resolve();else requestAnimationFrame(tick);
      }
      tick(performance.now());
    });
  }
  function cardDestination(element){
    const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
    const world=element.closest('.scene-camera')?new DOMMatrix(getComputedStyle(camera).transform):new DOMMatrix();
    const local=new DOMMatrix(style.transform==='none'?undefined:style.transform);
    const scale=Math.hypot(world.a,world.b);
    return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,width:parseFloat(style.width)*scale,height:parseFloat(style.height)*scale,angle:(Math.atan2(world.b,world.a)+Math.atan2(local.b,local.a))*180/Math.PI};
  }
  async function fly(from,to,label,duration=600){
    if(!from||!to)return;
    const token=generation,a=from.getBoundingClientRect();
    const card=document.createElement('div');card.className='fx-card fluid-card';card.textContent=label;card.dataset.destination=to.id;
    if(label!=='?')card.classList.add('arriving-number');
    if(to.querySelector('.blurred'))card.classList.add('concealed-flight');
    const sourcePose=cardDestination(from);
    const start={x:a.x+a.width/2,y:a.y+a.height/2,width:sourcePose.width>5?sourcePose.width:49,height:sourcePose.height>5?sourcePose.height:66};
    const destinationFace=to.querySelector('.card-front');
    if(destinationFace){
      const logicalWidth=parseFloat(getComputedStyle(to).width),logicalHeight=parseFloat(getComputedStyle(to).height);
      if(logicalWidth>5){
        start.height=start.width*logicalHeight/logicalWidth;
        card.style.fontSize=`${parseFloat(getComputedStyle(destinationFace).fontSize)*start.width/logicalWidth}px`;
      }
    }
    card.style.width=`${start.width}px`;card.style.height=`${start.height}px`;
    const fromCard=from.classList.contains('num-card'),toCard=to.classList.contains('num-card');
    if(fromCard)from.classList.add('card-in-flight');
    if(toCard)to.classList.add('card-in-flight');
    document.getElementById('fx-layer').append(card);
    await travel(card,()=>cardDestination(to),start,{duration:moving()?Math.max(580,duration*1.5):100,arc:85,startAngle:sourcePose.angle});
    if(token!==generation)return;
    card.remove();
    if(fromCard)from.classList.remove('card-in-flight');
    if(toCard)to.classList.remove('card-in-flight');
  }
  async function drawCard(card, origin, destination) {
    const token=generation;theatre.replaceChildren();theatre.style.cssText="";theatre.hidden=false;theatre.className=`central-theatre card-drawing ${card.kind === "relic" ? "relic-drawing" : ""}`;
    const stack=document.createElement("div");stack.className="draw-stack";stack.innerHTML="<i></i><i></i><i></i>";
    const startX=origin?origin.x+origin.width/2-innerWidth/2:-100;
    const startY=origin?origin.y+origin.height/2-innerHeight/2:70;
    stack.style.transform=`translate(${startX}px,${startY}px) rotate(-8deg)`;
    const leaf=document.createElement("div");leaf.className="draw-leaf";
    leaf.dataset.destination=destination.closest('#relic-slot')?'relic':'item';
    const back=document.createElement("div");back.className="draw-back";back.textContent="GREED!";
    const front=document.createElement("div");front.className="draw-front";
    const icon=document.createElement("span");icon.innerHTML=GREED_ICONS.markup(card.id);
    const name=document.createElement("strong");name.textContent=card.name;
    const desc=document.createElement("small");desc.textContent=card.short;
    front.append(icon,name,desc);leaf.append(back,front);theatre.append(stack,leaf);
    await animate(leaf,[{transform:`translate(${startX}px,${startY}px) rotate(-8deg) rotateY(0deg) scale(.65)`},{transform:`translate(${startX*.6}px,${startY-120}px) rotate(-14deg) rotateY(0deg) scale(.9)`,offset:.4},{transform:"translate(0,-20px) rotate(4deg) rotateY(0deg) scale(1)"}],{duration:800,easing:"cubic-bezier(.2,.7,.2,1)",fill:"forwards"});
    if(token!==generation)return;
    await animate(leaf,[{transform:"translate(0,-20px) rotate(4deg) rotateY(0deg) skewY(0deg)",borderRadius:"5px"},{transform:"translate(0,-45px) rotate(-3deg) rotateY(85deg) skewY(-9deg)",borderRadius:"24px 5px 25px 5px",offset:.5},{transform:"translate(0,-20px) rotate(0deg) rotateY(180deg) skewY(0deg)",borderRadius:"5px"}],{duration:1000,easing:"cubic-bezier(.25,.65,.2,1)",fill:"forwards"});
    if(token!==generation)return;
    if(card.kind==='relic'){
      const sigil=document.createElement('div');sigil.className='relic-sigil';sigil.setAttribute('aria-hidden','true');
      sigil.innerHTML='<span>?</span><i></i><i></i>';theatre.prepend(sigil);
      const sparks=Array.from({length:12},(_,i)=>{const spark=document.createElement('b');spark.className='relic-spark';spark.style.setProperty('--angle',`${i*30}deg`);theatre.append(spark);return spark;});
      animate(sigil,[{opacity:0,scale:'.6',filter:'blur(12px)'},{opacity:1,scale:'1',filter:'blur(0px)'}],{duration:650,fill:'forwards'});
      await wait(1300);
      animate(sigil,[{opacity:1},{opacity:0,scale:'1.3'}],{duration:350,fill:'forwards'});
      sparks.forEach(spark=>animate(spark,[{opacity:1},{opacity:0}],{duration:350,fill:'forwards'}));
    }else await wait(650);
    if(token!==generation)return;
    const rect=leaf.getBoundingClientRect();
    leaf.getAnimations().forEach(a=>a.cancel());
    leaf.style.position='fixed';leaf.style.width=`${rect.width}px`;leaf.style.height=`${rect.height}px`;
    leaf.style.transformOrigin='50% 50%';leaf.style.borderRadius='3px';
    animate(stack,[{opacity:1},{opacity:0}],{duration:300,fill:'forwards'});
    destination.classList.add('landing-reserved');
    await travel(leaf,()=>{const b=destination.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,width:b.width,height:b.height,angle:0};},
      {x:rect.x+rect.width/2,y:rect.y+rect.height/2,width:rect.width,height:rect.height},
      {front:true,startAngle:0,duration:moving()?850:100,arc:40,bend:8});
    if(token!==generation)return;
    return () => {
      if(token!==generation)return;
      destination.classList.remove('landing-reserved');theatre.hidden=true;theatre.replaceChildren();theatre.style.cssText='';
    };
  }
  function impact(player) {
    if(!moving())return;
    if(player.isHuman){
      recoil.vx-=155;recoil.vy+=115;recoil.vr-=18;
      overlay.classList.remove('collateral');
      animate(overlay,[{opacity:0},{opacity:.65,offset:.12},{opacity:0}],{duration:950});
    }else{
      const target=document.querySelector(`#seat-${player.id} .standee`);if(!target)return;
      const frames=Array.from({length:61},(_,i)=>{const t=i/60*1.1,envelope=Math.exp(-5*t);return {translate:`${-18*envelope*Math.sin(12*t)}px ${6*envelope*Math.sin(10*t)}px`,rotate:`${-2*envelope*Math.sin(12*t)}deg`,offset:i/60};});
      animate(target,frames,{duration:1100,easing:'linear'});
    }
  }
  async function seize(limb,debt) {
    const token=generation;
    message.textContent=`아직 ${debt}P… 네 ${limb}, 내가 가져가마.`;
    message.classList.add("visible","seizure-voice");
    overlay.classList.add("collateral");
    animate(overlay,[{opacity:0},{opacity:1,offset:.08},{opacity:.3,offset:.3},{opacity:0}],{duration:850});
    await animate(camera,[{translate:"0 0",filter:"blur(0px)"},{translate:"-26px 9px",filter:"blur(6px)",offset:.08},{translate:"16px -6px",filter:"blur(3px)",offset:.18},{translate:"-8px 2px",filter:"blur(2px)",offset:.4},{translate:"0 0",filter:"blur(0px)"}],{duration:1500});
    await wait(1000);
    if(token===generation)clearSeizure();
  }
  function inkDialogue() {
    const version=++dialogueVersion,box=document.querySelector(".vn-dialogue");
    inkAnimations.get(box)?.();
    box.getAnimations().forEach(a=>a.cancel());
    if(!moving())return;
    // An old wash dissolves as the fresh ink opens from the centre.
    const echo=box.cloneNode(true);echo.removeAttribute("aria-live");echo.setAttribute("aria-hidden","true");echo.classList.add("dialogue-echo");
    echo.querySelectorAll("[id]").forEach(el=>el.removeAttribute("id"));echo.querySelectorAll("button").forEach(el=>el.tabIndex=-1);
    box.before(echo);
    ink(echo,220,true).then(()=>echo.remove());
    ink(box,1650).then(()=>{if(version!==dialogueVersion)return;});
  }
  let litSeat = null;
  function positionLight() {
    const light = document.getElementById("turn-spotlight");
    light.hidden = litSeat === null;
    document.body.classList.toggle("player-lit", litSeat === 0);
    if(litSeat === null) return;
    light.dataset.seat = litSeat;
    const seat = document.getElementById("seat-" + litSeat);
    const row = seat?.parentElement;
    const x = litSeat === 0 ? camera.clientWidth / 2 : camera.clientWidth / 2 - row.offsetWidth / 2 + seat.offsetLeft + seat.offsetWidth / 2;
    light.style.setProperty("--spot-x", x + "px");
    light.style.setProperty("--spot-y", (litSeat === 0 ? camera.clientHeight : seat.offsetTop + row.offsetTop + seat.offsetHeight * .9) + "px");
    light.style.setProperty("--spot-width", litSeat === 0 ? "46%" : "115px");
  }
  addEventListener("resize", positionLight);
  window.GREED_SCENE={
    turn(id) { litSeat = id; positionLight(); },
    wait,animate,present,drawCard,fly,seize,inkDialogue,clearSeizure,
    get paused(){return paused;},get motion(){return moving();},
    pause(value){
      paused=value;document.body.classList.toggle("game-paused",value);
      if(value){pausedAnimations=document.getAnimations().filter(a=>a.playState==="running");pausedAnimations.forEach(a=>a.pause());}
      else {pausedAnimations.forEach(a=>{if(a.playState==="paused")a.play();});pausedAnimations=[];}
    },
    reset(){
      [...inkAnimations.values()].forEach(cancel=>cancel());
      health=healthTarget=3;
      generation++;previous.clear();clearSeizure();targetX=targetY=viewX=viewY=pointerVX=pointerVY=0;Object.keys(recoil).forEach(key=>recoil[key]=0);
      document.querySelectorAll(".fx-card,.dialogue-echo").forEach(el=>el.remove());
      theatre.hidden=true;theatre.replaceChildren();
      document.getAnimations().forEach(a=>{if(a.effect?.target?.closest?.("#central-theatre,.scene-camera,.sensory-message"))a.cancel();});
      theatre.style.opacity="";theatre.style.transform="";
      if(firstVisit){firstVisit=false;present({title:"THE UNDERGROUND",eyebrow:"地 下",kind:"region"});}
    },
    observe(players){
      const me=players[0];healthTarget=me.hp;camera.classList.toggle("eye-lost",me.limbs.includes("눈")&&me.suppressedLimb!=="눈");
      const token=generation;
      for(const player of players){const old=previous.get(player.id);if(old&&player.hp<old.hp)requestAnimationFrame(()=>{if(token===generation)impact(player);});previous.set(player.id,{hp:player.hp});}
    }
  };
})();
