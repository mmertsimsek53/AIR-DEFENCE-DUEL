// Air Defence Duel — the military base screen (Clash-of-Clans style). Rules live in core/src/base.ts (ADD.base*);
// this file draws the compound, every building model, and the build / upgrade / move editor.
(function(){
'use strict';
const X=window.ADDX,THREE=X.THREE,V=X.V,TAU=X.TAU,rand=X.rand,$=id=>document.getElementById(id);
const T=4;                                   // scene units per grid tile
const BASE={active:false};window.BASE=BASE;
const RES=['gold','petrol','explosives','uranium'];
const RES_UI={gold:{n:'Gold',c:'#ffd34d'},petrol:{n:'Petrol',c:'#ff9f43'},explosives:{n:'Explosives',c:'#ff5a4e'},uranium:{n:'Uranium',c:'#a6ff5c'}};
const CAT_UI=[['defence','Defence'],['resource','Resources'],['storage','Storage'],['production','Weapons'],['core','Core'],['support','Support']];
const CAT_COL={core:0xd84040,resource:0xf2c832,storage:0x9db0c8,production:0xc0855a,defence:0x6fe3ff,support:0x8fc06a};

let bv=null,root=null,ground=null,gridLines=null,nodes={},labels={},sel=null,mode=null,ghost=null,ghostType=null,ghostAt={x:0,y:0},dragGhost=false,saveT=0,shopCat='defence',gridN=0;
const _v=new V();

/* ---------- saving (native file in the app, localStorage in a browser) ---------- */
function save(){const j=ADD.baseSave();if(!j)return;try{window.webkit.messageHandlers.save.postMessage(j);}catch(e){}try{localStorage.setItem('add.base',j);}catch(e){}}
function load(name){let j=window.__savedBase||null;if(!j){try{j=localStorage.getItem('add.base');}catch(e){}}ADD.baseLoad(j,name);}

/* ---------- materials & textures ---------- */
const M=(c,o)=>new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));
const gravelTex=X.canvasTex(128,128,(x,w,h)=>X.noise(x,w,h,'#b9ad8f',['#a99d80','#c6bb9e','#aea284','#9c916f'],2600),[18,18]);
const hazardTex=X.canvasTex(64,16,(x,w,h)=>{x.fillStyle='#1d1d1d';x.fillRect(0,0,w,h);x.fillStyle='#f2c400';for(let i=-16;i<w;i+=16){x.beginPath();x.moveTo(i,h);x.lineTo(i+8,0);x.lineTo(i+16,0);x.lineTo(i+8,h);x.fill();}},[2,1]);
const padTex=X.canvasTex(64,64,(x,w,h)=>{X.noise(x,w,h,'#9a9a94',['#8f8f89','#a5a59f'],400);x.strokeStyle='rgba(0,0,0,.18)';x.lineWidth=2;x.strokeRect(1,1,62,62);x.fillStyle='rgba(255,255,255,.35)';x.font='bold 30px sans-serif';x.textAlign='center';x.fillText('H',32,43);});
const mConc=M(0xcfcac0),mConc2=M(0xa9aaa4),mDark=M(0x2b3036),mSteel=X.steel,mOlive=X.olive,mSand=M(0xc9b88a),mGrass=M(0x6f8a48),mWhite=M(0xf0f2f4),mRed=M(0xc8453a),mGold=M(0xf2c037,{emissive:0x3a2a00}),mGlass=M(0x355a78),mYellow=M(0xe8c22a),mGreenGlow=M(0x9cff5a,{emissive:0x3a8a10}),mHaz=M(0xffffff,{map:hazardTex}),mPad=M(0xffffff,{map:padTex});
const mesh=(geo,mat,x,y,z)=>{const m=X.shadowy(new THREE.Mesh(geo,mat));m.position.set(x||0,y||0,z||0);return m;};
const box=(w,h,d,mat,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,d),mat,x,(y||0)+h/2,z);
const cyl=(rt,rb,h,mat,x,y,z,seg)=>mesh(new THREE.CylinderGeometry(rt,rb,h,seg||16),mat,x,(y||0)+h/2,z);

/* ---------- building models ---------- */
// Each returns {g, anim(dt)}; footprint is size*T units, centred on the origin.
function slab(g,s,mat){g.add(box(s*T-0.8,0.3,s*T-0.8,mat||mConc2));}
function makeModel(type,size,level,sys){
  const g=new THREE.Group(),S=size*T,L=Math.max(1,level),acc=new THREE.MeshBasicMaterial({color:CAT_COL[(BCAT[type]||'core')]});let anim=null;
  if(sys){ // defences: concrete pad + the battery vehicle from the city game
    slab(g,size,mPad);const v=new THREE.Group();const r=X.buildModel(sys,v,g);v.scale.setScalar((S-1.2)/10);v.position.y=.3;v.rotation.y=Math.PI/4;g.add(v);
    if(r.tur&&sys==='koral')anim=dt=>{r.tur.rotation.y+=dt*2;};
    for(let i=0;i<L-1;i++)g.add(box(.5,.5,.5,M(0xffd34d),-S/2+1+i*.8,.3,S/2-1)); // level studs
    return {g,anim};
  }
  switch(type){
  case 'hq':{slab(g,size,mSand);const h=6+L*.6;g.add(box(13,h,10,mConc,0,.3,-1));g.add(box(13.2,.6,10.2,acc,0,.3+h*.55,-1));
    for(let i=0;i<4;i++)g.add(box(11.5,.8,.1,mGlass,0,1.6+i*1.4,4.05));
    g.add(box(8,2.4,6,mConc,0,.3+h,-1.5));g.add(cyl(.12,.15,8,mSteel,4.6,.3+h,-3));g.add(box(.06,1.1,1.8,mRed,4.6,.3+h+7,-2.1));
    const dish=mesh(new THREE.SphereGeometry(1.3,14,8,0,TAU,0,Math.PI/2),mWhite,-3.5,.3+h+2.4,-2);g.add(dish);
    const pad=mesh(new THREE.CylinderGeometry(2.6,2.6,.12,24),mPad,-4.5,.36,5.6);g.add(pad);
    const flag=new THREE.Group();flag.position.set(5.5,.3,5.5);flag.add(cyl(.08,.1,7,mWhite));const fl=mesh(new THREE.BoxGeometry(2,1.2,.05),mRed,1,6.3,0);flag.add(fl);g.add(flag);
    anim=dt=>{fl.rotation.y=Math.sin(performance.now()/400)*.25;};break;}
  case 'builder':{slab(g,size,mSand);g.add(box(4,2.4,2.4,mYellow,-1.4,.3,1.6));g.add(box(4.1,.25,2.5,mDark,-1.4,2.7,1.6));
    const tower=new THREE.Group();tower.position.set(1.8,.3,-1.6);for(let i=0;i<4;i++)tower.add(box(.6,2,.6,mYellow,0,i*2,0));g.add(tower);
    const jib=new THREE.Group();jib.position.set(1.8,8.3,-1.6);jib.add(box(9,.45,.45,mYellow,-2,0,0));jib.add(box(1.6,.9,1,mDark,2.3,-.3,0));jib.add(cyl(.03,.03,4,mDark,-5,-4,0,4));g.add(jib);
    anim=dt=>{jib.rotation.y+=dt*.35;};break;}
  case 'radar':{slab(g,size);g.add(box(3.4,2.2,3.4,mConc,-2.6,.3,2.6));const legs=new THREE.Group();for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const l=cyl(.15,.2,7,mSteel,a*1.2,.3,b*1.2,6);l.rotation.z=a*.08;l.rotation.x=-b*.08;legs.add(l);}g.add(legs);
    g.add(box(3.4,.4,3.4,mSteel,0,7.2,0));const spin=new THREE.Group();spin.position.y=8.5;g.add(spin);
    if(L>=3){spin.add(mesh(new THREE.SphereGeometry(2.4,18,12),mWhite,0,1.2,0));}
    else{const p=mesh(new THREE.BoxGeometry(5.2,2.6,.3),acc,0,.6,0);p.rotation.x=-.3;spin.add(p);spin.add(box(5.4,.25,.4,mDark,0,-.8,0));}
    anim=dt=>{spin.rotation.y+=dt*1.4;};break;}
  case 'power':{slab(g,size);g.add(box(7,4,5,M(0xa9b0b6),-1.5,.3,1.5));g.add(box(7.1,.4,5.1,acc,-1.5,3.6,1.5));
    g.add(cyl(.7,.9,11,mRed,3.5,.3,-3));g.add(box(.9,.6,.9,mWhite,3.5,6,-3));
    for(let i=0;i<3;i++){g.add(box(1.2,1.6,1.2,mDark,-4+i*2,.3,-3.6));g.add(cyl(.08,.08,1.4,mWhite,-4+i*2,1.9,-3.6,6));}
    anim=dt=>{if(rand()<.4)X.emit(X.SMOKE,g.position.x+3.5,11.5,g.position.z-3,(rand()-.5)+.6,2.5+rand(),(rand()-.5),4,1.6,8,.9,.9,.92,.35,.1,-.2);};break;}
  case 'treasury':{slab(g,size,mSand);g.add(box(9,1,7,mConc,0,.3,0));g.add(box(8,4,6,X.stone,0,1.3,0));
    for(let i=0;i<5;i++)g.add(cyl(.32,.36,4,mWhite,-3.2+i*1.6,1.3,3.3,10));
    const roof=mesh(new THREE.ConeGeometry(6.2,2.2,4).rotateY(Math.PI/4),mGold,0,6.4,0);roof.scale.set(1,1,.75);g.add(roof);
    g.add(box(2.4,.6,1.4,mGold,0,1.3,4.2));break;}
  case 'oilwell':{slab(g,size,mSand);g.add(cyl(1.2,1.2,2.2,mWhite,-2.1,.3,2.1));g.add(box(.6,3,.6,mDark,.6,.3,0));
    const beam=new THREE.Group();beam.position.set(.6,3.4,0);beam.add(box(5,.5,.5,mDark,0,-.25,0));const head=mesh(new THREE.BoxGeometry(.9,1.6,.7),mDark,-2.6,-.4,0);beam.add(head);g.add(beam);
    g.add(box(1.4,1,1.2,mRed,2.6,.3,0));
    anim=dt=>{beam.rotation.z=Math.sin(performance.now()/650)*.35;};break;}
  case 'explosives':{slab(g,size);g.add(box(8,3,5,mConc,0,.3,-1));g.add(box(8.05,.6,5.05,mHaz,0,2.7,-1));
    for(let i=0;i<3;i++)g.add(cyl(.5,.5,1.4,mRed,-3+i*1.6,.3,3.5,10));g.add(box(.3,.3,8,mSteel,0,2,2.1));break;}
  case 'uranium':{slab(g,size);g.add(box(7,3.4,4.5,mConc,-1,.3,-1.5));g.add(box(7.05,.5,4.55,M(0x8fbf3a),-1,3.2,-1.5));
    for(let i=0;i<4;i++)g.add(cyl(.45,.45,1.3,mYellow,-3+i*1.3,.3,3.2,10));const glow=mesh(new THREE.SphereGeometry(.9,12,8),mGreenGlow,3.6,1.3,2.6);g.add(glow);
    g.add(cyl(1.4,1.9,5,mWhite,3.4,.3,-2.6));
    anim=dt=>{glow.scale.setScalar(1+Math.sin(performance.now()/300)*.15);};break;}
  case 'goldvault':{slab(g,size);g.add(box(8,5,8,M(0x6c747c),0,.3,0));g.add(box(8.1,.5,8.1,acc,0,4.9,0));
    const door=mesh(new THREE.CylinderGeometry(1.8,1.8,.4,24).rotateX(Math.PI/2),mSteel,0,2.6,4.1);g.add(door);g.add(mesh(new THREE.CylinderGeometry(.3,.3,.6,10).rotateX(Math.PI/2),mGold,0,2.6,4.3));
    for(let i=0;i<Math.min(6,1+L);i++)g.add(box(1,.45,.5,mGold,3.2-(i%3)*1.1,.3+Math.floor(i/3)*.45,4.6));break;}
  case 'fueldepot':{slab(g,size);const n=L>=3?3:2;for(let i=0;i<n;i++){const x=n===3?-3.6+i*3.6:-2+i*4;g.add(cyl(1.6,1.6,4.5,mWhite,x,.3,0,20));g.add(cyl(1.62,1.62,.5,mRed,x,3.2,0,20));}
    g.add(box(10,.3,.3,mSteel,0,1.2,2.4));break;}
  case 'magazine':{slab(g,size);const mound=mesh(new THREE.SphereGeometry(5,20,10,0,TAU,0,Math.PI/2),mGrass,0,.3,-.5);mound.scale.set(1,.5,.9);g.add(mound);
    g.add(box(4,2.6,1.4,mConc,0,.3,3.6));g.add(box(3.2,2,.2,mDark,0,.3,4.35));g.add(box(4.05,.5,1.45,mHaz,0,2.4,3.6));break;}
  case 'uraniumstore':{slab(g,size);for(let i=0;i<4;i++)g.add(cyl(.8,.8,2.2,M(0x7d858c),-1.6+(i%2)*3.2,.3,-1.6+Math.floor(i/2)*3.2,14));g.add(box(1.2,1.2,.1,mYellow,0,.4,3.6));break;}
  case 'missilefactory':{slab(g,size);g.add(box(10,4,7,M(0xc9c5bb),0,.3,-1));for(let i=0;i<4;i++){const s=mesh(new THREE.CylinderGeometry(1.4,1.4,7,3,1).rotateX(Math.PI/2),M(0x7a8794),-3.6+i*2.4,5.2,-1);g.add(s);}
    const cr=new THREE.Group();cr.position.set(0,.3,4.2);cr.add(box(6,.5,.8,mSteel));const ms=mesh(new THREE.CylinderGeometry(.35,.35,5.4,10).rotateZ(Math.PI/2),mWhite,0,1,0);cr.add(ms);cr.add(mesh(new THREE.ConeGeometry(.35,1,10).rotateZ(-Math.PI/2),mRed,3.2,1,0));g.add(cr);break;}
  case 'droneworkshop':{slab(g,size);const arch=mesh(new THREE.CylinderGeometry(3.6,3.6,7,18,1,false,0,Math.PI).rotateZ(Math.PI/2).rotateY(Math.PI/2),M(0x9aa3ab),0,.3,-1);g.add(arch);
    for(let i=0;i<2;i++){const d=new THREE.Group();d.position.set(-2.4+i*4.8,.9,4);d.add(box(3,.15,1.2,mDark));d.add(box(.5,.35,2,mDark));d.rotation.y=Math.PI;g.add(d);}break;}
  case 'rocketpark':{slab(g,size,mSand);for(let i=0;i<2;i++){const tr=new THREE.Group();tr.position.set(-2.4+i*4.8,0,0);X.veh(tr,8,2.6,acc);const tb=X.tubes(tr,4,3,.22,4,.48,false,.6,2.5,-3);tr.scale.setScalar(.85);g.add(tr);}break;}
  case 'airfield':{slab(g,size,mGrass);const rw=mesh(new THREE.BoxGeometry(4,.12,S-1.5),mDark,-4,.36,0);g.add(rw);for(let i=0;i<6;i++)g.add(box(.3,.02,1.4,mWhite,-4,.42,-S/2+2+i*2.4));
    g.add(mesh(new THREE.CylinderGeometry(3.4,3.4,7,16,1,false,0,Math.PI).rotateZ(Math.PI/2).rotateY(Math.PI/2),M(0x9aa3ab),3.8,.3,-3));
    const uav=new THREE.Group();uav.position.set(3.8,1,3.5);uav.add(box(7,.18,1,mWhite));uav.add(box(.7,.6,3.4,mWhite,0,-.2,0));uav.add(box(2.2,.12,.6,mWhite,0,.4,-1.6));g.add(uav);
    g.add(cyl(.12,.12,4,mSteel,6.5,.3,6.5,6));break;}
  case 'cruisesite':{slab(g,size,mSand);g.add(box(5,2.4,4,mConc,-2,.3,-2.5));const tr=new THREE.Group();tr.position.set(1.8,0,1.6);X.veh(tr,8,2.8,acc);X.tubes(tr,2,1,.7,5.5,1.5,true,.55,2.5,-3);tr.scale.setScalar(.8);g.add(tr);break;}
  case 'silo':{slab(g,size);g.add(cyl(4,4.3,.8,mConc,0,.3,0,28));const lid=mesh(new THREE.CylinderGeometry(3,3,.3,24),mSteel,0,1.3,0);g.add(lid);g.add(cyl(3.1,3.1,.1,mHaz,0,1.05,0,24));
    if(L>=2){const nose=mesh(new THREE.ConeGeometry(.9,2.4,14),mWhite,1.2,1.6,0);g.add(nose);lid.position.x=-2.2;}
    break;}
  case 'ammobunker':{slab(g,size);const m=mesh(new THREE.BoxGeometry(9,3,7),mGrass,0,1.5,-.5);g.add(m);g.add(box(5,3,1.4,mConc,0,.3,3.5));g.add(box(3.6,2.2,.2,mSteel,0,.3,4.25));break;}
  case 'rnd':{slab(g,size);g.add(box(9,2.6,5,mWhite,0,.3,1.5));g.add(mesh(new THREE.SphereGeometry(3.2,22,12,0,TAU,0,Math.PI/2),mGlass,-1,2.9,-1.5));
    const ant=cyl(.08,.08,4,mSteel,3.5,2.9,2.5,6);g.add(ant);const b=mesh(new THREE.SphereGeometry(.3,8,6),mRed,3.5,7,2.5);g.add(b);anim=dt=>{b.visible=(performance.now()/500|0)%2===0;};break;}
  case 'academy':{slab(g,size,mSand);g.add(box(9,4,4,M(0xd7c6a8),0,.3,-2.5));g.add(mesh(new THREE.ConeGeometry(6.5,2,4).rotateY(Math.PI/4),M(0xb5563b),0,5.3,-2.5).translateY(0));
    g.add(cyl(.08,.1,6,mWhite,-4,.3,3.5));g.add(box(.05,1,1.6,acc,-4,5.4,4.3));break;}
  case 'barracks':{slab(g,size,mSand);for(let i=0;i<2;i++){const q=mesh(new THREE.CylinderGeometry(1.9,1.9,9,14,1,false,0,Math.PI).rotateZ(Math.PI/2).rotateY(Math.PI/2),mOlive,-2.4+i*4.8,.3,0);g.add(q);}break;}
  case 'repair':{slab(g,size);g.add(box(6,3.2,5,M(0xb0b4b8),0,.3,-.5));g.add(box(3.6,2.6,.1,mDark,0,.3,2.05));g.add(box(6.05,.4,5.05,acc,0,3.1,-.5));break;}
  case 'camo':{const net=mesh(new THREE.BoxGeometry(S-.6,.12,S-.6),M(0x5f7040),0,3.2,0);g.add(net);for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]])g.add(cyl(.1,.1,3.2,mDark,a*(S/2-.8),0,b*(S/2-.8),6));break;}
  case 'decoy':{slab(g,size);g.add(box(9,5,7,M(0xd9d4c7,{transparent:true,opacity:.92}),0,.3,0));g.add(box(9.1,.5,7.1,acc,0,3,0));g.add(cyl(.1,.1,6,mSteel,3,5.3,-2,6));break;}
  default:slab(g,size);g.add(box(S-3,3,S-3,mConc));
  }
  return {g,anim};
}
const BCAT={};

/* ---------- scaffolding for construction ---------- */
function scaffold(size){const g=new THREE.Group(),S=size*T-1,h=4,poleM=M(0xd8a24a),plM=M(0x8a6a3a);
  for(let i=0;i<=3;i++)for(let j=0;j<=3;j++){if(i&&j&&i<3&&j<3)continue;g.add(box(.18,h,.18,poleM,-S/2+i*S/3,0,-S/2+j*S/3));}
  for(const y of [1.4,2.8,4])for(const side of [-1,1]){g.add(box(S,.12,.4,plM,0,y,side*S/2));g.add(box(.4,.12,S,plM,side*S/2,y,0));}
  return g;}

/* ---------- scene ---------- */
const tileToWorld=(tx,ty,size)=>({x:(tx+size/2-gridN/2)*T,z:(ty+size/2-gridN/2)*T});
const worldToTile=(wx,wz,size)=>({x:Math.round(wx/T+gridN/2-size/2),y:Math.round(wz/T+gridN/2-size/2)});

function buildGround(){
  if(ground){root.remove(ground);root.remove(gridLines);}
  const W=gridN*T;
  ground=new THREE.Group();
  const pl=new THREE.Mesh(new THREE.PlaneGeometry(W+12,W+12).rotateX(-Math.PI/2),M(0xffffff,{map:gravelTex}));pl.position.y=.05;pl.receiveShadow=true;ground.add(pl);
  const edge=new THREE.Mesh(new THREE.RingGeometry(0,1,4),new THREE.MeshBasicMaterial({color:0}));edge.visible=false;ground.add(edge);
  const line=M(0xe8c22a);for(const s of [-1,1]){ground.add(box(W+12,.06,.5,line,0,.08,s*(W/2+6)));ground.add(box(.5,.06,W+12,line,s*(W/2+6),.08,0));}
  // Watchtowers at the corners and floodlights along the edge (decoration, not walls).
  for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const p=new THREE.Group();p.position.set(a*(W/2+6),0,b*(W/2+6));
    for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[1,1]])p.add(cyl(.12,.15,7,mSteel,u*.9,0,v*.9,6));
    p.add(box(2.6,.25,2.6,M(0x7a6a4a),0,7,0));p.add(box(2.6,1.2,.15,M(0x7a6a4a),0,7.25,1.25));p.add(box(2.6,1.2,.15,M(0x7a6a4a),0,7.25,-1.25));
    p.add(mesh(new THREE.ConeGeometry(2.1,1.2,4).rotateY(Math.PI/4),mOlive,0,9.2,0));ground.add(p);}
  for(let i=1;i<4;i++)for(const s of [-1,1]){const f=W/2+6,o=-f+i*f/2;for(const [x,z] of [[o,s*f],[s*f,o]]){const l=new THREE.Group();l.position.set(x,0,z);l.add(cyl(.1,.12,5,mSteel,0,0,0,6));l.add(box(.9,.3,.5,mWhite,0,5,0));ground.add(l);}}
  // A few parked trucks and sandbag rows for life.
  for(const [x,z,r] of [[-W/2-2,W/4,0],[W/2+2,-W/5,Math.PI]]){const tr=new THREE.Group();tr.position.set(x,0,z);tr.rotation.y=r;X.veh(tr,6,2.4,new THREE.MeshBasicMaterial({color:0x6b7558}));tr.scale.setScalar(.8);ground.add(tr);}
  root.add(ground);
  gridLines=new THREE.GridHelper(W,gridN,0x2a3a40,0x2a3a40);gridLines.position.y=.12;gridLines.material.transparent=true;gridLines.material.opacity=.0;root.add(gridLines);
}

function syncScene(){
  if(gridN!==bv.grid){gridN=bv.grid;buildGround();for(const id in nodes){root.remove(nodes[id].g);delete nodes[id];}}
  const seen=new Set();
  for(const b of bv.buildings){
    seen.add(b.id);BCAT[b.type]=b.cat;
    const key=b.type+'|'+b.level+'|'+(b.building?1:0)+'|'+b.x+'|'+b.y;
    let n=nodes[b.id];
    if(!n||n.key!==key){
      if(n)root.remove(n.g);
      const g=new THREE.Group();const p=tileToWorld(b.x,b.y,b.size);g.position.set(p.x,0,p.z);
      let anim=null;
      if(b.level>0){const m=makeModel(b.type,b.size,b.level,b.sys);g.add(m.g);anim=m.anim;}
      else{const f=new THREE.Group();slab(f,b.size,M(0x8d8a7e));g.add(f);}
      if(b.building)g.add(scaffold(b.size));
      root.add(g);n=nodes[b.id]={g,anim,key,b};
    }
    n.b=b;
  }
  for(const id in nodes)if(!seen.has(+id)){root.remove(nodes[id].g);delete nodes[id];if(labels[id]){labels[id].remove();delete labels[id];}}
}

/* ---------- selection ring & range ---------- */
const selRing=new THREE.Group();let selKey='';
function updSelRing(){
  const b=sel!=null&&bv?bv.buildings.find(x=>x.id===sel):null;const key=b?b.id+'|'+b.x+'|'+b.y+'|'+b.level:'';
  if(key===selKey)return;selKey=key;while(selRing.children.length)selRing.remove(selRing.children[0]);
  if(!b)return;const p=tileToWorld(b.x,b.y,b.size),S=b.size*T;
  const mat=new THREE.MeshBasicMaterial({color:0x6fe3ff,transparent:true,opacity:.9,depthWrite:false});
  for(const s of [-1,1]){selRing.add(mesh(new THREE.BoxGeometry(S,.2,.35),mat,p.x,.25,p.z+s*S/2));selRing.add(mesh(new THREE.BoxGeometry(.35,.2,S),mat,p.x+s*S/2,.25,p.z));}
  if(b.sys){const d=CAT.defences.find(x=>x.id===b.sys);if(d){const r=d.range/0.25*T;const ring=new THREE.Mesh(new THREE.RingGeometry(r-.6,r,96).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:X.SYS_COL[b.sys]||0x6fe3ff,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide}));ring.position.set(p.x,.3,p.z);selRing.add(ring);}}
}
const CAT=ADD.catalogueRaw();

/* ---------- ghost (placing / moving) ---------- */
function makeGhost(type,size){
  if(ghost)root.remove(ghost.g);
  const sys=bv.shop.find(s=>s.id===type)?.sys;const m=makeModel(type,size,1,sys);
  m.g.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(x=>{const c=x.clone();c.transparent=true;c.opacity=.6;return c;}):(()=>{const c=o.material.clone();c.transparent=true;c.opacity=.6;return c;})();o.castShadow=false;}});
  const foot=new THREE.Mesh(new THREE.PlaneGeometry(size*T,size*T).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x39d353,transparent:true,opacity:.45,depthWrite:false}));foot.position.y=.2;
  const g=new THREE.Group();g.add(m.g);g.add(foot);root.add(g);ghost={g,foot,size,type};placeGhost(ghostAt.x,ghostAt.y);
}
function placeGhost(tx,ty){if(!ghost)return;const g=gridN,s=ghost.size;tx=Math.max(0,Math.min(g-s,tx));ty=Math.max(0,Math.min(g-s,ty));ghostAt={x:tx,y:ty};
  const p=tileToWorld(tx,ty,s);ghost.g.position.set(p.x,0,p.z);
  const ok=ADD.baseCanPlace(ghost.type,tx,ty,mode==='move'?sel:undefined);ghost.ok=ok;ghost.foot.material.color.set(ok?0x39d353:0xff4a3d);}
function freeSpot(type,size){const g=gridN,c=Math.floor(g/2-size/2);for(let r=0;r<g;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=c+dx,y=c+dy;if(ADD.baseCanPlace(type,x,y))return {x,y};}return {x:0,y:0};}
function endGhost(){if(ghost){root.remove(ghost.g);ghost=null;}mode=null;dragGhost=false;gridLines.material.opacity=0;$('bPlace').hidden=true;refreshUI(true);}

/* ---------- open / close ---------- */
BASE.open=function(){
  const name=(($('nameIn')&&$('nameIn').value)||'').trim()||'Commander';
  load(name);
  X.hideCities();
  if(!root){root=new THREE.Group();X.scene.add(root);root.add(selRing);}
  root.visible=true;BASE.active=true;sel=null;mode=null;gridN=0;
  bv=ADD.baseView();syncScene();
  X.cam.theta=0.75;X.cam.phi=0.85;X.cam.r=Math.max(56,gridN*T*0.7);X.cam.tx=0;X.cam.tz=0;
  $('menu').hidden=true;$('baseUI').hidden=false;document.body.classList.add('base-mode');
  refreshUI(true);
};
BASE.close=function(){save();BASE.active=false;if(root)root.visible=false;$('baseUI').hidden=true;document.body.classList.remove('base-mode');
  for(const id in labels){labels[id].remove();delete labels[id];}endGhost();X.showMenuCity();$('menu').hidden=false;};

/* ---------- input ---------- */
BASE.pointer=function(type,e,n){
  if(!mode||n!==1)return false;
  const g=X.groundAt(e.clientX,e.clientY);
  if(type==='down'&&g&&ghost){const p=ghost.g.position,h=ghost.size*T/2+T;if(Math.abs(g.x-p.x)<h&&Math.abs(g.z-p.z)<h){dragGhost=true;return true;}}
  if(type==='move'&&dragGhost&&g){const t=worldToTile(g.x,g.z,ghost.size);placeGhost(t.x,t.y);return true;}
  if(type==='up'&&dragGhost){dragGhost=false;return true;}
  return false;
};
BASE.tap=function(x,y){
  const g=X.groundAt(x,y);if(!g)return;
  if(mode&&ghost){const t=worldToTile(g.x,g.z,ghost.size);placeGhost(t.x,t.y);return;}
  let hit=null;for(const b of bv.buildings){const p=tileToWorld(b.x,b.y,b.size),h=b.size*T/2;if(Math.abs(g.x-p.x)<=h&&Math.abs(g.z-p.z)<=h){hit=b;break;}}
  sel=hit?hit.id:null;win=hit?'info':null;refreshUI(true);
};

/* ---------- UI ---------- */
const resLine=c=>RES.filter(r=>c&&c[r]).map(r=>'<i style="--r:'+RES_UI[r].c+'">'+Math.ceil(c[r])+'</i>').join(' ')||'<i>free</i>';
const canAfford=c=>RES.every(r=>!c||!c[r]||bv.res[r]>=c[r]);
const tfmt=s=>s>=3600?Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m':s>=60?Math.floor(s/60)+'m '+(s%60)+'s':s+'s';
let uiSig='';
function topHTML(){return RES.map(r=>{const v=bv.res[r],c=bv.cap[r];if(r==='uranium'&&c<=0&&v<=0)return '';const full=v>=c-0.5;
  return '<div class="rchip" style="--r:'+RES_UI[r].c+'"><b>'+Math.floor(v)+'</b><span>/'+c+'</span><small>'+RES_UI[r].n+(bv.perHour[r]?' · +'+Math.round(bv.perHour[r])+'/h':'')+(full?' · FULL':'')+'</small></div>';}).join('')+
  '<div class="rchip hqchip"><b>HQ '+bv.hq+'</b><small>Teams '+(bv.builders-bv.buildersBusy)+'/'+bv.builders+' free</small></div>';}
let win=null;const openSecs=new Set(['defence']);
const colOf=cat=>'#'+(CAT_COL[cat]||0x6fe3ff).toString(16).padStart(6,'0');
function shopWinHTML(){
  let h='<div class="head"><h2>Build</h2><button class="close" data-bwin="close">✕</button></div><div class="sub">Headquarters level '+bv.hq+' · '+(bv.builders-bv.buildersBusy)+' of '+bv.builders+' construction teams free</div>';
  for(const [k,n] of CAT_UI){
    const items=bv.shop.filter(s=>s.cat===k&&s.id!=='hq');const avail=items.filter(s=>!s.locked&&s.have<s.allowed).length;const open=openSecs.has(k);
    h+='<div class="sec-h'+(open?' open':'')+'" data-bsec="'+k+'"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:'+colOf(k)+'"></span>'+n+' <span class="cnt">'+avail+' available</span><span class="chev">›</span></div>';
    if(!open)continue;h+='<div class="sec-body">';
    for(const s of items){const full=s.have>=s.allowed,dis=s.locked||full||!canAfford(s.cost);
      const sub=s.locked?'Needs Headquarters '+s.unlock:full?'Built '+s.have+' of '+s.allowed+' · upgrade HQ for more':resLine(s.cost)+' · '+tfmt(s.time);
      const v=s.produces?'+'+s.produces.perHour+'/h':s.stores?'holds '+s.stores.cap:'';
      h+='<button class="wrow" data-bshop="'+s.id+'" style="--c:'+colOf(s.cat)+'"'+(dis?' disabled':'')+'><span class="dot"></span><span class="t"><b>'+X.esc(s.name)+'</b><span>'+sub+'</span></span><span class="v">'+v+'</span><span class="chev">›</span></button>';}
    h+='</div>';}
  return h;}
function infoWinHTML(b){
  const s=bv.shop.find(x=>x.id===b.type),d=b.sys?CAT.defences.find(x=>x.id===b.sys):null;
  let h='<div class="head"><span class="dot" style="width:12px;height:12px;border-radius:50%;background:'+colOf(b.cat)+'"></span><h2>'+X.esc(b.name)+'</h2><button class="close" data-bwin="close">✕</button></div><div class="sub">'+X.esc(s.role)+'</div>';
  h+='<div class="stat"><span>Level</span><b>'+(b.level||'—')+(b.building?' → '+b.building.toLevel:'')+'</b></div>';
  if(s.produces)h+='<div class="stat"><span>Produces</span><b>'+RES_UI[s.produces.res].n+'</b></div>';
  if(s.stores)h+='<div class="stat"><span>Stores</span><b>'+RES_UI[s.stores.res].n+'</b></div>';
  if(d)h+='<div class="stat"><span>Range</span><b>'+d.range+' km · '+Math.round(d.range/0.25)+' tiles</b></div>';
  h+='<div class="stat"><span>Strength</span><b>'+b.hp+'</b></div>';
  if(b.building)h+='<div class="stat"><span>Ready in</span><b>'+tfmt(b.building.left)+'</b></div><div class="bar"><i style="width:'+Math.round(100*(1-b.building.left/Math.max(1,b.building.total)))+'%"></i></div>';
  h+='<div class="actions">';
  if(b.building)h+='<button class="btn primary" data-binfo="speed"'+(bv.res.gold<b.building.speedUp?' disabled':'')+'>Finish now · '+b.building.speedUp+' Gold</button><button class="btn danger" data-binfo="cancel">Cancel</button>';
  else if(b.nextCost&&!b.maxed&&!b.hqLocked)h+='<button class="btn primary" data-binfo="up"'+(!canAfford(b.nextCost)||bv.buildersBusy>=bv.builders?' disabled':'')+'>Upgrade to level '+(b.level+1)+'</button>';
  h+='<button class="btn" data-binfo="move">Move</button></div>';
  if(!b.building&&b.nextCost&&!b.maxed&&!b.hqLocked)h+='<div class="sub" style="margin:0">Upgrade costs '+resLine(b.nextCost)+' · takes '+tfmt(b.nextTime)+(bv.buildersBusy>=bv.builders?' · <span style="color:var(--orange)">all construction teams are busy</span>':'')+'</div>';
  else if(b.maxed)h+='<div class="sub" style="margin:0">Top level reached.</div>';
  else if(b.hqLocked)h+='<div class="sub" style="margin:0">Upgrade your Headquarters to go higher.</div>';
  return h;}
function refreshUI(force){
  if(!bv)return;
  const top=topHTML();if($('bTop').dataset.h!==top){$('bTop').dataset.h=top;$('bTop').innerHTML=top;}
  const b=win==='info'&&sel!=null?bv.buildings.find(x=>x.id===sel):null;if(win==='info'&&!b)win=null;
  $('bWin').hidden=!win;
  if(win){const h=win==='shop'?shopWinHTML():infoWinHTML(b);const box=$('bWinBox');if(force||box.dataset.h!==h){const st=box.scrollTop;box.dataset.h=h;box.innerHTML=h;box.scrollTop=st;}}
  document.body.classList.remove('sheet-open');
}
function cmd(c){const r=ADD.baseCmd(c);bv=ADD.baseView();syncScene();if(!r.ok)X.msg(r.error,'bad');else saveT=0.5;refreshUI(true);return r.ok;}

document.addEventListener('click',e=>{
  if(!BASE.active)return;
  if(e.target.id==='bWin'){win=null;sel=null;refreshUI(true);return;}           // tap outside the window closes it
  const t=e.target.closest('[data-bsec],[data-bwin],[data-bshop],[data-binfo],[data-bbtn],[data-bplace]');if(!t)return;
  if(t.dataset.bsec){const k=t.dataset.bsec;openSecs.has(k)?openSecs.delete(k):openSecs.add(k);refreshUI(true);return;}
  if(t.dataset.bwin==='close'){win=null;sel=null;refreshUI(true);return;}
  if(t.dataset.bshop){const s=bv.shop.find(x=>x.id===t.dataset.bshop);win=null;sel=null;mode='place';ghostType=s.id;ghostAt=freeSpot(s.id,s.size);makeGhost(s.id,s.size);gridLines.material.opacity=.5;
    $('bPlace').hidden=false;$('bPlaceTxt').innerHTML='Drag <b>'+X.esc(s.name)+'</b> into place · '+resLine(s.cost);refreshUI(true);}
  else if(t.dataset.bplace==='ok'){if(!ghost)return;if(!ghost.ok){X.msg('It doesn\'t fit there','bad');return;}
    if(mode==='place'){if(cmd({c:'place',type:ghost.type,x:ghostAt.x,y:ghostAt.y})){X.msg(bv.shop.find(x=>x.id===ghost.type).name+' construction started','money');X.sfx('launch');endGhost();}}
    else if(mode==='move'){if(cmd({c:'move',id:sel,x:ghostAt.x,y:ghostAt.y}))endGhost();}}
  else if(t.dataset.bplace==='cancel'){const n=sel!=null&&nodes[sel];if(n)n.g.visible=true;endGhost();}
  else if(t.dataset.binfo){const b=bv.buildings.find(x=>x.id===sel);if(!b)return;const a=t.dataset.binfo;
    if(a==='up'){if(cmd({c:'upgrade',id:b.id}))X.msg('Upgrade to level '+(b.level+1)+' started','money');}
    else if(a==='speed'){if(cmd({c:'speedUp',id:b.id}))X.msg(b.name+' finished','good');}
    else if(a==='cancel'){if(cmd({c:'cancel',id:b.id}))X.msg('Cancelled · half the cost refunded','warn');}
    else if(a==='move'){win=null;mode='move';ghostAt={x:b.x,y:b.y};nodes[b.id].g.visible=false;makeGhost(b.type,b.size);gridLines.material.opacity=.5;$('bPlace').hidden=false;$('bPlaceTxt').innerHTML='Drag <b>'+X.esc(b.name)+'</b> to its new place';refreshUI(true);}
    else if(a==='close'){sel=null;refreshUI(true);}}
  else if(t.dataset.bbtn){const a=t.dataset.bbtn;
    if(a==='build'){win=win==='shop'?null:'shop';sel=null;refreshUI(true);}
    else if(a==='menu')BASE.close();
    else if(a==='attack')X.msg('Battles on bases come in the next step · try the city duel from the menu meanwhile','warn');}
});

/* ---------- labels: level badges and construction timers ---------- */
function updLabels(){
  for(const b of bv.buildings){
    let el=labels[b.id];if(!el){el=document.createElement('div');el.className='blabel';$('tags').appendChild(el);labels[b.id]=el;}
    const n=nodes[b.id];if(!n||!n.g.visible){el.hidden=true;continue;}
    const p=tileToWorld(b.x,b.y,b.size);const s=X.project(_v.set(p.x,b.size*T*.9+2,p.z));
    if(!s||win){el.hidden=true;continue;}
    const html=b.building?'<b>'+tfmt(b.building.left)+'</b><i style="width:'+Math.round(100*(1-b.building.left/Math.max(1,b.building.total)))+'%"></i>':(sel===b.id?X.esc(b.name)+' · ':'')+'L'+b.level;
    if(el.dataset.h!==html){el.dataset.h=html;el.innerHTML=html;}
    el.className='blabel'+(b.building?' busy':'')+(sel===b.id?' sel':'');
    el.hidden=false;el.style.transform='translate('+s.x.toFixed(0)+'px,'+s.y.toFixed(0)+'px)';
  }
}

/* ---------- frame ---------- */
let tickT=0;
BASE.step=function(dt){
  tickT-=dt;if(tickT<=0){tickT=.25;ADD.baseTick();bv=ADD.baseView();syncScene();refreshUI(false);}
  for(const id in nodes){const n=nodes[id];if(n.anim&&n.g.visible){try{n.anim(dt);}catch(e){}}}
  for(const id in nodes){const n=nodes[id];if(n.b&&n.b.building&&rand()<.06){const p=n.g.position;X.emit(X.SMOKE,p.x+(rand()-.5)*6,1,p.z+(rand()-.5)*6,0,1.5,0,2,1.5,5,.8,.75,.65,.4,.2,0);}}
  updSelRing();updLabels();
  if(saveT>0){saveT-=dt;if(saveT<=0)save();}
};
setInterval(()=>{if(BASE.active)save();},15000);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&BASE.active)save();});
})();
