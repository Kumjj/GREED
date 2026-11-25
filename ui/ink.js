// Adapted from preview.html: fractal noise + radial threshold, with feathered edges.
// Cached alpha frames avoid recomputing live SVG noise/blur on each paint.
(() => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:fixed;width:0;height:0;pointer-events:none;overflow:hidden';
  const defs = document.createElementNS(ns, 'defs');svg.append(defs);document.body.append(svg);
  const node = (tag, attrs, parent) => {
    const element = document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
    parent.append(element);return element;
  };
  const atlasURL=new URL('ink-mask.png',document.currentScript.src).href;
  const atlas=new Image();atlas.src=atlasURL;
  const ready=atlas.decode().catch(()=>{});
  function entrance(t) {
    // Gentler ease-out leaves time to see the wet edge travel: (.25,.55,.4,1).
    if(t<=0)return 0;if(t>=1)return 1;
    let lo=0,hi=1,u=t;
    for(let i=0;i<12;i++) {
      u=(lo+hi)/2;
      const x=3*(1-u)*(1-u)*u*.25+3*(1-u)*u*u*.4+u*u*u;
      if(x<t)lo=u;else hi=u;
    }
    return 3*(1-u)*(1-u)*u*.55+3*(1-u)*u*u+u*u*u;
  }
  function create(element) {
    const keys=['maskImage','maskSize','maskRepeat','maskPosition','maskMode','opacity','willChange'];
    const saved=Object.fromEntries(keys.map(key=>[key,element.style[key]]));
    const rect=element.getBoundingClientRect();
    const w=rect.width,h=rect.height,s=Math.max(w,h);
    element.style.maskImage=`url("${atlasURL}")`;
    element.style.maskSize=s>0?`${8*s}px ${16*s}px`:'800% 1600%';
    element.style.maskRepeat='no-repeat';element.style.maskMode='alpha';
    element.style.willChange='mask-position, opacity';
    let prior=-1;
    return {
      set(progress) {
        const p=Math.max(0,Math.min(1,progress)),frame=Math.round(p*127);
        element.style.opacity=p<=0?'0':'1';
        if(frame===prior)return;prior=frame;
        const col=frame%8,row=Math.floor(frame/8);
        if(s>0){
          const x=-col*s+(w-s)/2,y=-row*s+(h-s)/2;
          element.style.maskPosition=`${x}px ${y}px`;
        }else{
          element.style.maskPosition=`${col/7*100}% ${row/15*100}%`;
        }
        element.dataset.inkFrame=frame;
      },
      remove() {for(const key of keys)element.style[key]=saved[key];delete element.dataset.inkFrame;}
    };
  }
  // wobble_preview.html combines flowing displacement with a periodic haze.
  const vision=node('filter',{id:'vision-wobble',x:'-4%',y:'-5%',width:'108%',height:'110%','color-interpolation-filters':'sRGB'},defs);
  const flow=node('feTurbulence',{type:'fractalNoise',baseFrequency:'.005 .009',numOctaves:2,seed:19,result:'flow'},vision);
  const displacement=node('feDisplacementMap',{in:'SourceGraphic',in2:'flow',scale:0,xChannelSelector:'R',yChannelSelector:'G'},vision);
  window.GREED_INK={create,ready,entrance,vision(time,strength){
    flow.setAttribute('baseFrequency',`${.005+Math.sin(time*.41)*.0007} ${.009+Math.cos(time*.37)*.0008}`);
    displacement.setAttribute('scale',String(strength));
  }};
})();
