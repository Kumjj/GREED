// A fixed-step rigid-body simulation. Rendering replays its poses without steering or snapping.
(() => {
  function simulate(vertices, faces, seed) {
    const C=window.CANNON;
    if(!C)throw new Error('주사위 물리 엔진을 불러오지 못했습니다.');
    let bits=seed>>>0||0x735a2d91;
    const random=()=>{bits^=bits<<13;bits^=bits>>>17;bits^=bits<<5;return(bits>>>0)/4294967296;};
    const world=new C.World({gravity:new C.Vec3(0,-19.6,0),allowSleep:true});
    world.solver.iterations=24;world.solver.tolerance=1e-8;
    const felt=new C.Material('felt'),bone=new C.Material('bone');
    world.addContactMaterial(new C.ContactMaterial(bone,felt,{friction:.5,restitution:.38}));
    world.addContactMaterial(new C.ContactMaterial(bone,bone,{friction:.32,restitution:.5}));
    const floor=new C.Body({mass:0,material:felt,shape:new C.Plane()});
    floor.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(floor);
    function wall(x,z,hx,hz){const body=new C.Body({mass:0,material:felt,shape:new C.Box(new C.Vec3(hx,1.5,hz))});body.position.set(x,1.5,z);world.addBody(body);}
    wall(-3.65,0,.12,2.5);wall(3.65,0,.12,2.5);wall(0,-2.45,3.65,.12);wall(0,2.45,3.65,.12);
    const radius=.82;
    const shape=new C.ConvexPolyhedron({vertices:vertices.map(v=>new C.Vec3(...v.map(n=>n*radius))),faces:faces.map(f=>[...f])});
    const bodies=[0,1].map(i=>{
      const body=new C.Body({mass:1,material:bone,shape,allowSleep:true,sleepSpeedLimit:.18,sleepTimeLimit:.55,linearDamping:.12,angularDamping:.16});
      body.position.set(i===0?-1.45:1.4,2.7+random()*.9+i*.65,(random()-.5)*.65);
      body.velocity.set((i===0?1:-1)*(1+random()*1.4),-1.5-random()*2,(random()-.5)*2.3);
      body.angularVelocity.set((random()-.5)*25,(random()-.5)*27,(random()-.5)*25);
      const u=random(),v=random()*Math.PI*2,w=random()*Math.PI*2;
      body.quaternion.set(Math.sqrt(1-u)*Math.sin(v),Math.sqrt(1-u)*Math.cos(v),Math.sqrt(u)*Math.sin(w),Math.sqrt(u)*Math.cos(w));
      world.addBody(body);return body;
    });
    let collisions=0,groundContacts=0;
    bodies.forEach(body=>body.addEventListener('collide',event=>{if(bodies.includes(event.body))collisions++;if(event.body===floor)groundContacts++;}));
    const frames=[];
    const snapshot=()=>bodies.map(body=>({p:[body.position.x,body.position.y,body.position.z],q:[body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w]}));
    frames.push(snapshot());
    let sleeping=false;
    for(let step=0;step<120*9;step++){
      world.step(1/120);frames.push(snapshot());
      if(step>120&&bodies.every(body=>body.sleepState===C.Body.SLEEPING)){sleeping=true;break;}
    }
    const upFaces=bodies.map(body=>{
      let best=-Infinity,face=0;
      faces.forEach((indices,i)=>{
        const normal=indices.reduce((a,index)=>a.map((n,k)=>n+vertices[index][k]),[0,0,0]);
        const n=new C.Vec3(...normal);n.normalize();const rotated=body.quaternion.vmult(n);
        if(rotated.y>best){best=rotated.y;face=i;}
      });
      return face;
    });
    return {frames,upFaces,seed,step:1/120,duration:(frames.length-1)/120,sleeping,collisions:collisions/2,groundContacts,
      finalSpeed:bodies.map(b=>({linear:b.velocity.length(),angular:b.angularVelocity.length()}))};
  }
  window.GREED_DICE_PHYSICS={simulate};
})();
