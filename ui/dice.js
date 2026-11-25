// Real rigid-body poses from cannon-es; no timed spin, target rotation or landing snap.
(() => {
  const phi=(1+Math.sqrt(5))/2;
  const norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const vertices=[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(norm);
  const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  const normals=faces.map(f=>norm(f.reduce((a,i)=>a.map((x,k)=>x+vertices[i][k]),[0,0,0])));
  const edges=new Set(faces.flatMap(f=>[[f[0],f[1]],[f[1],f[2]],[f[2],f[0]]].map(e=>e.sort((a,b)=>a-b).join(':'))));
  const lengths=[...edges].map(e=>{const[a,b]=e.split(':').map(Number);return Math.hypot(...vertices[a].map((v,i)=>v-vertices[b][i]));});
  function rotate(v,q){
    const u=q.slice(0,3),uv=cross(u,v),uuv=cross(u,uv);
    return v.map((x,i)=>x+2*(q[3]*uv[i]+uuv[i]));
  }
  function interpolate(a,b,t){
    let d=dot(a,b);if(d<0){b=b.map(x=>-x);d=-d;}
    if(d>.9995)return norm(a.map((x,i)=>x+(b[i]-x)*t));
    const theta=Math.acos(Math.min(1,d)),s=Math.sin(theta);
    return a.map((x,i)=>(x*Math.sin((1-t)*theta)+b[i]*Math.sin(t*theta))/s);
  }
  function faceBasis(index,corner=0){
    const n=normals[index],v=vertices[faces[index][corner]],projection=dot(n,v);
    const u=norm(v.map((x,i)=>x-n[i]*projection));return {n,u,v:cross(n,u)};
  }
  // Icosahedral symmetry is an initial numbered-die orientation, not a change to its motion.
  // Pick it before the first frame; every label then remains attached to the same physical face.
  function numbering(value,top,corner=0){
    const source=faceBasis(value-1),target=faceBasis(top,corner),labels=Array(20);
    normals.forEach((n,i)=>{
      const mapped=n.map((_,k)=>target.u[k]*dot(n,source.u)+target.v[k]*dot(n,source.v)+target.n[k]*dot(n,source.n));
      let best=-Infinity,index=0;normals.forEach((candidate,j)=>{const d=dot(mapped,candidate);if(d>best){best=d;index=j;}});
      labels[index]=i+1;
    });
    return labels;
  }
  const tilt=Math.PI/3,sin=Math.sin(tilt),cos=Math.cos(tilt);
  const view=v=>[v[0],-v[1]*cos+v[2]*sin,v[1]*sin+v[2]*cos];
  function project(v,w,h,scale){const c=view(v),p=18/(18-c[2]);return [w/2+c[0]*scale*p,h*.68+c[1]*scale*p];}
  function render(ctx,poses,labels,topFaces,w,h,settled){
    const scale=Math.min(80,(w-30)/7.6),radius=.82;
    ctx.clearRect(0,0,w,h);
    poses.forEach(pose=>{
      const floor=project([pose.p[0],0,pose.p[2]],w,h,scale),height=Math.max(0,pose.p[1]-.65);
      ctx.save();ctx.fillStyle=`rgba(0,0,0,${.34/(1+height*.7)})`;ctx.shadowBlur=12+height*4;ctx.shadowColor='#0009';
      ctx.beginPath();ctx.ellipse(floor[0],floor[1],scale*(.8+height*.06),scale*.24,0,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    const order=[0,1].sort((a,b)=>view(poses[a].p)[2]-view(poses[b].p)[2]);
    for(const die of order){
      const pose=poses[die],rotated=vertices.map(v=>rotate(v,pose.q)),world=rotated.map(v=>v.map((x,k)=>pose.p[k]+x*radius));
      const normalWorld=normals.map(n=>rotate(n,pose.q));
      const cameraDirection=norm([-pose.p[0],18*sin-pose.p[1],18*cos-pose.p[2]]);
      const visible=faces.map((f,index)=>({f,index,depth:f.reduce((s,i)=>s+view(world[i])[2],0)/3})).filter(f=>dot(normalWorld[f.index],cameraDirection)>.025).sort((a,b)=>a.depth-b.depth);
      for(const face of visible){
        const pts=face.f.map(i=>project(world[i],w,h,scale)),n=normalWorld[face.index];
        const light=.66+.34*Math.max(0,dot(n,norm([-.4,1,.7]))),palette=die===0?[233,215,174]:[184,207,190];
        ctx.beginPath();ctx.moveTo(...pts[0]);ctx.lineTo(...pts[1]);ctx.lineTo(...pts[2]);ctx.closePath();
        ctx.fillStyle=`rgb(${palette.map(c=>Math.round(c*light)).join(',')})`;ctx.fill();
        ctx.strokeStyle=settled&&face.index===topFaces[die]?'#ffe3a2':'#a99c7c';ctx.lineWidth=settled&&face.index===topFaces[die]?1.8:.8;ctx.stroke();
        const center=face.f.reduce((a,i)=>a.map((x,k)=>x+world[i][k]/3),[0,0,0]);
        const u=norm(world[face.f[1]].map((x,k)=>x-world[face.f[0]][k])),v=cross(n,u),xy=project(center,w,h,scale);
        const px=project(center.map((x,k)=>x+u[k]*.2),w,h,scale),py=project(center.map((x,k)=>x-v[k]*.2),w,h,scale);
        ctx.save();ctx.translate(...xy);ctx.transform((px[0]-xy[0])/(.2*scale),(px[1]-xy[1])/(.2*scale),(py[0]-xy[0])/(.2*scale),(py[1]-xy[1])/(.2*scale),0,0);
        ctx.font=`bold ${scale*.29}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#1b2c25';ctx.fillText(String(labels[die][face.index]),0,0);ctx.restore();
      }
    }
  }
  window.GREED_DICE={
    geometry:{vertices:vertices.length,edges:edges.size,faces:faces.length,regular:Math.max(...lengths)-Math.min(...lengths)<1e-10},
    simulate(seed){return window.GREED_DICE_PHYSICS.simulate(vertices,faces,seed);},numbering,
    async roll(a,b,result){
      const scene=window.GREED_SCENE,host=document.getElementById('central-theatre');
      const seed=crypto.getRandomValues(new Uint32Array(1))[0];
      const simulation=this.simulate(seed),labels=[numbering(a,simulation.upFaces[0],seed%3),numbering(b,simulation.upFaces[1],(seed>>>8)%3)];
      host.replaceChildren();host.style.cssText='';host.className='central-theatre dice-theatre';host.hidden=false;
      const canvas=document.createElement('canvas');canvas.className='dice-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`20면체 주사위 ${a}, ${b}`);
      canvas.dataset.physics='cannon-es';canvas.dataset.seed=String(seed);canvas.dataset.sleeping=String(simulation.sleeping);canvas.dataset.contacts=String(simulation.groundContacts);canvas.dataset.collisions=String(simulation.collisions);
      const w=Math.min(innerWidth-20,640),h=innerWidth<=760?320:420,dpr=Math.min(devicePixelRatio||1,2),ctx=canvas.getContext('2d');
      canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;ctx.scale(dpr,dpr);
      const copy=document.createElement('div');copy.className='dice-result';host.append(canvas,copy);
      let elapsed=0,last=null;
      await new Promise(resolve=>{
        function tick(now){
          if(!canvas.isConnected){resolve();return;}
          if(last!==null&&!scene.paused)elapsed+=Math.max(0,Math.min((now-last)/1000,.06));last=now;
          const time=scene.motion?Math.min(elapsed,simulation.duration):simulation.duration;
          const index=Math.max(0,Math.min(simulation.frames.length-1,Math.floor(time/simulation.step))),next=Math.min(index+1,simulation.frames.length-1),alpha=(time/simulation.step)-index;
          const poses=simulation.frames[index].map((pose,i)=>({p:pose.p.map((v,k)=>v+(simulation.frames[next][i].p[k]-v)*alpha),q:interpolate(pose.q,simulation.frames[next][i].q,alpha)}));
          const settled=time>=simulation.duration;
          render(ctx,poses,labels,simulation.upFaces,w,h,settled);
          if(settled){
            canvas.dataset.result=`${labels[0][simulation.upFaces[0]]},${labels[1][simulation.upFaces[1]]}`;
            copy.textContent=`${a} · ${b}　→　${result.value} / 400　${result.name}`;copy.classList.add(result.points<0||result.hp<0?'bad':'good');resolve();
          }else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
      if(!canvas.isConnected)return;
      await scene.wait(1100);await scene.animate(host,[{opacity:1},{opacity:0,filter:'blur(10px)'}],{duration:400});
      if(!canvas.isConnected)return;
      host.hidden=true;host.style.cssText='';
    }
  };
})();
