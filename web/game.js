// Air Defence Duel — the game screen. The 3D look, models, effects and HUD come from Mert's browser prototype
// (prototype/air-defence-duel.html). All rules (money, turns, battle) come from the shared engine in core.js
// (globalThis.ADD); this file only draws what the engine says and sends the player's commands.
window.__errs=[];addEventListener('error',e=>{if(window.__errs.length<20)window.__errs.push(e.message+' @'+e.lineno+':'+e.colno);});
(function(){
'use strict';
const V=THREE.Vector3,TAU=Math.PI*2,rand=Math.random;
const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let rng=Math.random;

const CAT=ADD.catalogueRaw(),GEO=ADD.geo(),U=GEO.unitsPerKm;
const DEF={};for(const d of CAT.defences)DEF[d.id]=d;
const ATK={};for(const a of CAT.attacks)ATK[a.id]=a;
const SCT={};for(const s of CAT.scouts)SCT[s.id]=s;
const BLD={};for(const b of CAT.buildings)BLD[b.kind]=b;

/* ======================= STYLE ======================= */
const SYS_COL={zu23:0xffd27a,gepard:0xffc04d,korkut:0xffb020,stinger:0x9dffb0,sungur:0x2fd27a,alka:0xff3fc0,ironbeam:0xff6ad5,koral:0x9acc00,
  pantsir:0x3fe0c8,hisara:0x1fb6e0,irondome:0x5fd0ff,irist:0x4f9cff,hisaro:0x2f7fe0,davidsling:0x8aa8ff,siper:0x7a5cff,s400:0xe0204a,patriot:0xff6a2b};
const css=h=>'#'+h.toString(16).padStart(6,'0');
const CLS_CSS={drone:'#ffe066',decoy:'#9aa6b0',uav:'#c48bff',rocket:'#ff9a66',cruise:'#ff8a3d',ballistic:'#ff5a4e',hypersonic:'#ff3380',unk:'#ffb340'};
const CLS_TAG={drone:'dro',decoy:'dec',uav:'uav',rocket:'roc',cruise:'cru',ballistic:'bal',hypersonic:'hyp'};
const CLS_LABEL={drone:'DRN',decoy:'DEC',uav:'UAV',rocket:'RKT',cruise:'CRU',ballistic:'BAL',hypersonic:'HYP'};
const CLS_ORDER=['drone','decoy','uav','rocket','cruise','ballistic','hypersonic'];
const SIZE={ballistic:3.2,decoy:1.3,cruise:2.2,drone:1.1,uav:2.6,rocket:1.2,hypersonic:3.6};
const BLD_COL={command:0xd84040,radar:0x4fd8f0,power:0xf2c832,depot:0x8fae5a,factory:0xc0855a,airbase:0x8aa0c0,finance:0x5fc890};
const SCOUT_PATHS=[['N → S',[0,-5],[0,5]],['W → E',[-5,0],[5,0]],['NW → SE',[-4,-4],[4,4]],['NE → SW',[4,-4],[-4,4]]];

// Rules work in km around the defending city; the scene is the prototype's units (city radius 106).
// Inside the city the scale is linear; outside it is compressed so far-away contacts stay on screen.
const RAD=r=>r<=6?r*U:106+70*Math.log(1+(r-6)/6);
const ALT=a=>a<=0?0:25*Math.pow(a,0.45);
function toScene(x,z,alt,out){const r=Math.hypot(x,z),k=r>1e-6?RAD(r)/r:U;return out.set(x*k,ALT(alt),z*k);}

/* ======================= RENDERER & WORLD ======================= */
const cv=$('c');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});
const MOBILE=/iPhone|iPad|Android/.test(navigator.userAgent)||matchMedia('(pointer:coarse)').matches;
const PR=Math.min(devicePixelRatio||1,MOBILE?1.35:1.75);
renderer.setPixelRatio(PR);renderer.setClearColor(0xa9c4dc);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=MOBILE?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xbfd2e4,0.0021);
const camera=new THREE.PerspectiveCamera(52,1,0.5,5000);
const SUN=new V(0.55,0.75,-0.45).normalize();
scene.add(new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,uniforms:{sd:{value:SUN}},
  vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 sd;varying vec3 vP;void main(){float h=vP.y;vec3 top=vec3(0.20,0.43,0.78);vec3 hor=vec3(0.76,0.85,0.93);vec3 c=mix(hor,top,smoothstep(0.0,0.55,h));float s=max(dot(vP,sd),0.0);c+=vec3(1.0,0.92,0.75)*pow(s,600.0)*1.6+vec3(1.0,0.85,0.6)*pow(s,12.0)*0.18;if(h<0.0)c=hor*0.9;gl_FragColor=vec4(c,1.0);}'
})));
scene.add(new THREE.HemisphereLight(0xcfe3ff,0x6b5f48,0.7));
const sun=new THREE.DirectionalLight(0xfff0d6,1.15);
sun.position.copy(SUN).multiplyScalar(300);sun.castShadow=true;sun.shadow.mapSize.set(MOBILE?1536:2048,MOBILE?1536:2048);
{const c=sun.shadow.camera;c.left=-125;c.right=125;c.top=125;c.bottom=-125;c.near=50;c.far=700;}
sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.4;scene.add(sun);scene.add(sun.target);
const flashes=[0,1,2,3].map(()=>{const l=new THREE.PointLight(0xffa04a,0,140,1.5);scene.add(l);return l;});
let flashIdx=0;
const HILLS=[];
// Ground height under (x,z): hills are cones (apex h−3, base radius w). Low flyers lift over them.
function terrainH(x,z){let y=0;for(const c of HILLS){const d=Math.hypot(x-c.x,z-c.z);if(d<c.w){const hh=c.h*(1-d/c.w)-3;if(hh>y)y=hh;}}return y;}

function canvasTex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.anisotropy=4;return t;}
function noise(x,w,h,base,vars,n){x.fillStyle=base;x.fillRect(0,0,w,h);for(let i=0;i<n;i++){x.fillStyle=vars[(rand()*vars.length)|0];x.globalAlpha=.25+rand()*.35;const s=1+rand()*4;x.fillRect(rand()*w,rand()*h,s,s);}x.globalAlpha=1;}
const grassTex=canvasTex(128,128,(x,w,h)=>noise(x,w,h,'#7c8a55',['#6d7a48','#8a9a5e','#748350','#93a065','#66713f'],2200),[70,70]);
const concreteTex=canvasTex(128,128,(x,w,h)=>noise(x,w,h,'#a7a397',['#9b978b','#b3afa3','#a09c90','#8f8b80'],1600),[30,30]);
const plazaTex=canvasTex(64,64,(x,w,h)=>{noise(x,w,h,'#b9b4a6',['#aca79a','#c4bfb1','#b0ab9e'],500);x.strokeStyle='rgba(0,0,0,.08)';for(let i=0;i<=64;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i,64);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(64,i);x.stroke();}},[3,3]);
const roadTex=canvasTex(64,64,(x,w,h)=>{noise(x,w,h,'#41454b',['#3a3e44','#484c52','#363a40'],500);x.fillStyle='#e8e2c8';x.fillRect(30,0,4,28);x.fillStyle='#d0d0d0';x.fillRect(2,0,2,64);x.fillRect(60,0,2,64);});
const runwayTex=canvasTex(32,128,(x,w,h)=>{noise(x,w,h,'#3c4046',['#35393f','#44484e'],300);x.fillStyle='#f0f0e8';for(let y=6;y<128;y+=20)x.fillRect(15,y,2,10);x.fillRect(2,0,2,128);x.fillRect(28,0,2,128);});
{const ct=canvasTex(128,128,(x,w,h)=>{for(let i=0;i<14;i++){const cx=24+rand()*80,cy=44+rand()*40,r=14+rand()*22;const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);}});
 for(let i=0;i<26;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,transparent:true,opacity:.85,fog:false,depthWrite:false}));const a=rand()*TAU,r=350+rand()*900;s.position.set(Math.cos(a)*r,240+rand()*160,Math.sin(a)*r);const k=180+rand()*220;s.scale.set(k,k*.45,1);scene.add(s);}}
{const g=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({map:grassTex}));g.receiveShadow=true;scene.add(g);
 const hill=new THREE.MeshLambertMaterial({color:0x7a8a58}),hill2=new THREE.MeshLambertMaterial({color:0x8d8a70});
 for(let i=0;i<40;i++){const a=rand()*TAU,r=200+rand()*230,h=20+rand()*70,w=50+rand()*80;const m=new THREE.Mesh(new THREE.ConeGeometry(w,h,8),rand()<.5?hill:hill2);m.position.set(Math.cos(a)*r,h/2-3,Math.sin(a)*r);m.rotation.y=rand()*TAU;scene.add(m);HILLS.push({x:m.position.x,z:m.position.z,h,w});}
 const inst=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2,0),new THREE.MeshLambertMaterial({color:0x4f6b34}),500);const d=new THREE.Object3D();
 for(let i=0;i<500;i++){const a=rand()*TAU,r=112+rand()*80;d.position.set(Math.cos(a)*r,2,Math.sin(a)*r);d.scale.setScalar(.7+rand()*.8);d.rotation.y=rand()*3;d.updateMatrix();inst.setMatrixAt(i,d.matrix);}
 inst.castShadow=true;scene.add(inst);}

/* ======================= PARTICLES ======================= */
const PVS='attribute vec3 pcolor;attribute float psize;attribute float palpha;uniform float scale;varying vec3 vC;varying float vA;void main(){vC=pcolor;vA=palpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(psize*scale/max(1.0,-mv.z),72.0);gl_Position=projectionMatrix*mv;}';
const PFS='varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.0,d);if(a*vA<0.004)discard;gl_FragColor=vec4(vC,a*vA);}';
const psMats=[];let pScale=500;
function makePS(N,blending,order){
  const g=new THREE.BufferGeometry();
  const pos=new Float32Array(N*3),col=new Float32Array(N*3),size=new Float32Array(N),alpha=new Float32Array(N);
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('pcolor',new THREE.BufferAttribute(col,3));
  g.setAttribute('psize',new THREE.BufferAttribute(size,1));g.setAttribute('palpha',new THREE.BufferAttribute(alpha,1));
  const m=new THREE.ShaderMaterial({uniforms:{scale:{value:pScale}},vertexShader:PVS,fragmentShader:PFS,transparent:true,depthWrite:false,blending,toneMapped:false});psMats.push(m);
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;pts.renderOrder=order;scene.add(pts);
  return {N,g,pos,col,size,alpha,vel:new Float32Array(N*3),life:new Float32Array(N),max:new Float32Array(N),s0:new Float32Array(N),s1:new Float32Array(N),a0:new Float32Array(N),drag:new Float32Array(N),grav:new Float32Array(N),cur:0};
}
const SMOKE=makePS(7500,THREE.NormalBlending,2);
const GLOW=makePS(10000,THREE.AdditiveBlending,3);
let quality=1,frameMs=16;
function emit(s,x,y,z,vx,vy,vz,life,s0,s1,r,g,b,a0,drag,grav){
  if(quality<1&&rand()>quality)return;
  const i=s.cur;s.cur=(i+1)%s.N;const j=i*3;
  s.pos[j]=x;s.pos[j+1]=y;s.pos[j+2]=z;s.vel[j]=vx;s.vel[j+1]=vy;s.vel[j+2]=vz;
  s.col[j]=r;s.col[j+1]=g;s.col[j+2]=b;s.life[i]=life;s.max[i]=life;s.s0[i]=s0;s.s1[i]=s1;s.a0[i]=a0;s.drag[i]=drag||0;s.grav[i]=grav||0;s.size[i]=s0;s.alpha[i]=a0;
}
function updPS(s,dt){
  for(let i=0;i<s.N;i++){
    if(s.life[i]<=0){if(s.alpha[i]!==0){s.alpha[i]=0;s.size[i]=0;}continue;}
    s.life[i]-=dt;if(s.life[i]<=0){s.alpha[i]=0;s.size[i]=0;continue;}
    const k=1-s.life[i]/s.max[i],j=i*3,dr=Math.max(0,1-s.drag[i]*dt);
    s.vel[j]*=dr;s.vel[j+1]=s.vel[j+1]*dr-s.grav[i]*dt;s.vel[j+2]*=dr;
    s.pos[j]+=s.vel[j]*dt;s.pos[j+1]+=s.vel[j+1]*dt;s.pos[j+2]+=s.vel[j+2]*dt;
    s.size[i]=s.s0[i]+(s.s1[i]-s.s0[i])*k;s.alpha[i]=s.a0[i]*(1-k)*Math.min(1,k*14+0.2);
  }
  const a=s.g.attributes;a.position.needsUpdate=a.psize.needsUpdate=a.palpha.needsUpdate=a.pcolor.needsUpdate=true;
}

/* ======================= MATERIALS & BUILDING PARTS ======================= */
const WX=GEO.river.x,WZ=GEO.river.z,WA=GEO.river.angle,WC=Math.cos(WA),WS=Math.sin(WA);
const wdist=(x,z)=>Math.abs((x-WX)*WC-(z-WZ)*WS);
function facTex(style){
  return canvasTex(64,128,(x)=>{
    const fac=style==='office'?['#a9b3bc','#9aa6b0','#b8bfc4']:style==='glass'?['#5f86a6','#6e93b0','#557a99']:['#d7c6a8','#cdb89a','#e2d6bf','#c9a98a','#d9cfc0','#e6d9c2'];
    x.fillStyle=fac[(rand()*fac.length)|0];x.fillRect(0,0,64,128);
    for(let r=0;r<16;r++)for(let k=0;k<4;k++){
      if(style==='glass'){x.fillStyle=rand()<.3?'#b6d4ea':'#7fa6c4';x.fillRect(k*16,r*8,15,7);x.fillStyle='rgba(255,255,255,.12)';x.fillRect(k*16,r*8,15,1);}
      else if(style==='office'){x.fillStyle=rand()<.15?'#7d97ab':'#3d4d5c';x.fillRect(k*16+2,r*8+2,12,4);}
      else{x.fillStyle=rand()<.12?'#8fa9bd':'#3a3f45';x.fillRect(k*16+4,r*8+2,8,4);if(r%2===0){x.fillStyle='rgba(0,0,0,.18)';x.fillRect(k*16+2,r*8+6,12,1);}}}
  });
}
const roofMat=new THREE.MeshLambertMaterial({color:0x8a8b8f});
const tileMat=new THREE.MeshLambertMaterial({color:0xb5563b});
const MATS={};
for(const st of ['res','office','glass'])MATS[st]=[0,1].map(()=>{const m=new THREE.MeshLambertMaterial({map:facTex(st)});return [m,m,roofMat,roofMat,m,m];});
const burnt=new THREE.MeshLambertMaterial({color:0x1a1715,emissive:0x220a02});
const burntMats=[burnt,burnt,burnt,burnt,burnt,burnt];
const steel=new THREE.MeshLambertMaterial({color:0x6a7581});
const darkMat=new THREE.MeshLambertMaterial({color:0x2b3036});
const stone=new THREE.MeshLambertMaterial({color:0xeee3cc});
const concrete=new THREE.MeshLambertMaterial({color:0xcfcac0});
const whiteMat=new THREE.MeshLambertMaterial({color:0xf2f4f6});
const padMat=new THREE.MeshBasicMaterial({color:0x6fe3ff,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
const padBeamMat=new THREE.MeshBasicMaterial({color:0x6fe3ff,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
const padRingGeo=new THREE.RingGeometry(3.2,5.4,48).rotateX(-Math.PI/2),padBeamGeo=new THREE.CylinderGeometry(4.4,4.4,40,20,1,true).translate(0,20,0);
function shadowy(m){m.castShadow=true;m.receiveShadow=true;return m;}
function boxPart(g,w,h,d,y0,mats){
  const geo=new THREE.BoxGeometry(w,h,d);geo.translate(0,y0+h/2,0);
  const uv=geo.attributes.uv,su=Math.max(1,Math.round(Math.max(w,d)/8.8)),sv=h/25.6;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);
  const m=shadowy(new THREE.Mesh(geo,mats));g.add(m);return m;
}
function cylPart(g,r,h,y0,mats){
  const geo=new THREE.CylinderGeometry(r,r,h,18,1);geo.translate(0,y0+h/2,0);
  const uv=geo.attributes.uv,su=Math.max(2,Math.round(TAU*r/8.8)),sv=h/25.6;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);
  const m=shadowy(new THREE.Mesh(geo,[mats[0],mats[2],mats[2]]));g.add(m);return m;
}
function mesh(geo,mat,x,y,z){const m=shadowy(new THREE.Mesh(geo,mat));m.position.set(x||0,y||0,z||0);return m;}

/* ======================= CITIES ======================= */
// SIDES[0] = your city, SIDES[1] = the rival's. Same street plan for both; critical buildings sit on fixed plots.
const SIDES=[{},{}];
const SLOTS=GEO.slots.map(s=>({x:s.x*U,z:s.z*U}));
const PADS=GEO.pads.map(p=>({id:p.id,x:p.x*U,z:p.z*U}));
const LANDMARK=[GEO.landmark.x,GEO.landmark.z];

function addGeneric(S,x,z,w,d,h){
  const g=new THREE.Group();g.position.set(x,0,z);const parts=[];let top=h;
  g.rotation.y=(rng()<.5?0:Math.PI/2);
  if(h<8&&rng()<.55){const mats=MATS.res[(rng()*2)|0];parts.push(boxPart(g,w,h,d,0,mats));
    const roof=shadowy(new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.74,2.2,4).rotateY(Math.PI/4),tileMat));roof.scale.set(w/Math.max(w,d),1,d/Math.max(w,d));roof.position.y=h+1.1;g.add(roof);parts.push(roof);top=h+2.2;}
  else{
    const style=h>26?(rng()<.5?'office':'glass'):(rng()<.72?'res':'office'),mats=MATS[style][(rng()*2)|0];
    if(h>30&&rng()<.3)parts.push(cylPart(g,Math.min(w,d)*.55,h,0,mats));else parts.push(boxPart(g,w,h,d,0,mats));
    if(h>26&&rng()<.7){const h2=h*(.16+rng()*.2);parts.push(boxPart(g,w*.62,h2,d*.62,h,mats));top=h+h2;}
    if(h<26&&h>=8){for(let i=0;i<2;i++){const t=shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1.2,8),steel));t.position.set((rng()-.5)*w*.6,h+.6,(rng()-.5)*d*.6);g.add(t);parts.push(t);}}
    if(h>22&&rng()<.6){const len=3+rng()*5;const a=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,len,5),steel);a.position.y=top+len/2;g.add(a);parts.push(a);}
  }
  S.root.add(g);
  S.generic.push({x,z,w,d,h:top,g,parts,mats:parts.map(p=>p.material),dead:false});
}

function buildCity(S,side){
  if(S.root){scene.remove(S.root);for(const l of S.labelEls||[])l.remove();}
  rng=mulberry(20261009);
  const root=new THREE.Group();root.visible=false;scene.add(root);
  Object.assign(S,{side,root,generic:[],crit:{},bats:{},fires:[],labelEls:[],scarCount:0,padRings:{}});
  const disc=new THREE.Mesh(new THREE.CircleGeometry(106,72).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({map:concreteTex}));disc.position.y=.03;disc.receiveShadow=true;root.add(disc);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(16,560).rotateX(-Math.PI/2),new THREE.MeshPhongMaterial({color:0x2d6c90,specular:0xffffff,shininess:70}));water.rotation.y=WA;water.position.set(WX,.09,WZ);root.add(water);
  for(const sgn of [-1,1]){const bank=new THREE.Mesh(new THREE.PlaneGeometry(2,560).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0x8f8a78}));bank.rotation.y=WA;bank.position.set(WX+WC*9*sgn,.07,WZ-WS*9*sgn);root.add(bank);}
  for(let k=-9;k<=9;k++){const off=k*11+5.5;if(Math.abs(off)>104)continue;const len=2*Math.sqrt(106*106-off*off);
    const t=roadTex.clone();t.needsUpdate=true;t.repeat.set(1,len/6);const m=new THREE.MeshLambertMaterial({map:t});
    for(const ax of [0,1]){const r=new THREE.Mesh(new THREE.PlaneGeometry(2.4,len),m);r.rotation.x=-Math.PI/2;if(ax)r.rotation.z=Math.PI/2;r.position.set(ax?0:off,0.06,ax?off:0);r.receiveShadow=true;root.add(r);}}
  const deck=new THREE.MeshLambertMaterial({color:0x9a9ea4});
  for(const s of [-38,42]){const cx=WX+WS*s,cz=WZ+WC*s;const d=shadowy(new THREE.Mesh(new THREE.BoxGeometry(24,.8,3.4),deck));d.rotation.y=WA;d.position.set(cx,1.4,cz);root.add(d);
    for(const t of [-6,6]){const tw=shadowy(new THREE.Mesh(new THREE.BoxGeometry(.7,11,.7),deck));tw.position.set(cx+WC*t,5.5,cz-WS*t);root.add(tw);}}
  // Pads (rings shown only when placing).
  for(const p of PADS){const g=new THREE.Group();g.position.set(p.x,.2,p.z);g.add(new THREE.Mesh(padRingGeo,padMat));g.add(new THREE.Mesh(padBeamGeo,padBeamMat));g.visible=false;root.add(g);S.padRings[p.id]=g;}
  // Plazas on every building plot, so the rival cannot tell which plots hold buildings.
  for(const s of SLOTS){const pl=new THREE.Mesh(new THREE.PlaneGeometry(20,20).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({map:plazaTex}));pl.position.set(s.x,.1,s.z);pl.receiveShadow=true;root.add(pl);}
  const blocked=(x,z)=>Math.hypot(x,z)<9||wdist(x,z)<9.5||PADS.some(p=>Math.hypot(x-p.x,z-p.z)<8)||Math.hypot(x-LANDMARK[0],z-LANDMARK[1])<11||SLOTS.some(s=>Math.hypot(x-s.x,z-s.z)<12);
  {const g=new THREE.Group();g.position.set(LANDMARK[0],0,LANDMARK[1]);
   const base=shadowy(new THREE.Mesh(new THREE.BoxGeometry(11,4,11),stone));base.position.y=2;g.add(base);
   const dome=shadowy(new THREE.Mesh(new THREE.SphereGeometry(4.6,24,12,0,TAU,0,Math.PI/2),stone));dome.position.y=4;g.add(dome);
   const lead=new THREE.MeshLambertMaterial({color:0x6d7b86});
   for(const [a,b] of [[-6,-6],[6,-6],[-6,6],[6,6]]){const m=shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.38,.45,16,10),stone));m.position.set(a,8,b);g.add(m);const c=shadowy(new THREE.Mesh(new THREE.ConeGeometry(.5,2.6,10),lead));c.position.set(a,17.3,b);g.add(c);}
   root.add(g);}
  const parkCells=[];
  for(let gx=-9;gx<=9;gx++)for(let gz=-9;gz<=9;gz++){
    const cx=gx*11,cz=gz*11,r=Math.hypot(cx,cz);
    if(r>98||blocked(cx,cz))continue;
    if(rng()<.13){parkCells.push([cx,cz]);continue;}
    const tall=Math.max(0,1-r/62);
    if(rng()<.45){for(const o of [[-2.4,-2.4],[2.4,2.4]])addGeneric(S,cx+o[0],cz+o[1],3.6+rng()*1.2,3.6+rng()*1.2,3+rng()*9+tall*rng()*22);}
    else addGeneric(S,cx,cz,5+rng()*3.4,5+rng()*3.4,4+rng()*12+tall*(8+rng()*34));
  }
  {const g=new THREE.Group();const mats=MATS.glass[0];boxPart(g,4.5,52,4.5,0,mats);boxPart(g,3,6,3,52,mats);const sp=new THREE.Mesh(new THREE.CylinderGeometry(.15,.3,10,6),steel);sp.position.y=63;g.add(sp);root.add(g);}
  const trees=[];for(const [cx,cz] of parkCells)for(let i=0;i<12;i++)trees.push([cx+(rng()-.5)*9,cz+(rng()-.5)*9]);
  for(const s of SLOTS)for(const [a,b] of [[-9,-9],[9,-9],[-9,9],[9,9]])trees.push([s.x+a,s.z+b]);
  for(let i=0;i<160;i++){const a=rng()*TAU,r=100+rng()*12;if(wdist(Math.cos(a)*r,Math.sin(a)*r)>11)trees.push([Math.cos(a)*r,Math.sin(a)*r]);}
  const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.5,0),new THREE.MeshLambertMaterial({color:0xffffff}),trees.length);
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.22,1.6,5),new THREE.MeshLambertMaterial({color:0x6b5038}),trees.length);
  const dm=new THREE.Object3D(),col=new THREE.Color();
  trees.forEach((t,i)=>{const s=.8+rng()*.7;dm.position.set(t[0],.8*s,t[1]);dm.scale.setScalar(s);dm.rotation.set(0,rng()*3,0);dm.updateMatrix();trunk.setMatrixAt(i,dm.matrix);
    dm.position.y=2.2*s;dm.scale.set(s,s*1.15,s);dm.updateMatrix();crown.setMatrixAt(i,dm.matrix);col.setHSL(.24+rng()*.08,.42,.3+rng()*.12);crown.setColorAt(i,col);});
  crown.castShadow=trunk.castShadow=true;crown.receiveShadow=true;root.add(crown);root.add(trunk);
  const NC=110,cars=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.75,2.1),new THREE.MeshLambertMaterial({color:0xffffff}),NC);cars.castShadow=true;
  S.cars=[];const palette=[0xf2f2f2,0x202428,0xb71c1c,0x1e4f9c,0x9ea4aa,0xe0c84a,0x2e6b3a];
  for(let i=0;i<NC;i++){const k=Math.round((rng()-.5)*16),off=k*11+5.5,len=2*Math.sqrt(Math.max(0,106*106-off*off));
    S.cars.push({ax:rng()<.5?0:1,off:off+(rng()<.5?-.6:.6),len,s:(rng()-.5)*len,v:(6+rng()*6)*(rng()<.5?-1:1)});col.setHex(palette[(rng()*palette.length)|0]);cars.setColorAt(i,col);}
  S.carMesh=cars;root.add(cars);
  rng=Math.random;
}

// Burn ordinary buildings around an impact (kept for the rest of the match).
function burnNear(S,x,z,r){
  for(const b of S.generic){if(b.dead)continue;if(Math.hypot(b.x-x,b.z-z)>r+Math.max(b.w,b.d)*.4)continue;
    b.dead=true;b.g.scale.y=0.3;for(const p of b.parts)p.material=Array.isArray(p.material)?burntMats:burnt;S.fires.push({x:b.x,y:b.h*0.3,z:b.z,t:25,w:Math.min(b.w,b.d)*.4});}
}

/* --- critical buildings --- */
function critModel(kind){
  const g=new THREE.Group(),acc=new THREE.MeshBasicMaterial({color:BLD_COL[kind]});let spin=null,stack=null;
  if(kind==='command'){
    g.add(mesh(new THREE.BoxGeometry(14,5,10),concrete,0,2.5,0));g.add(mesh(new THREE.BoxGeometry(9,3.4,7),concrete,0,6.7,0));
    g.add(mesh(new THREE.BoxGeometry(14.1,.5,10.1),acc,0,4.6,0));
    g.add(mesh(new THREE.CylinderGeometry(.15,.2,9,6),steel,4.5,12.9,2));g.add(mesh(new THREE.BoxGeometry(.08,1,1.6),acc,4.5,16.8,2.8));
    g.add(mesh(new THREE.SphereGeometry(1.5,16,8,0,TAU,0,Math.PI/2),whiteMat,-3.5,8.4,1.5));
    g.add(mesh(new THREE.CylinderGeometry(3,3,.15,24),darkMat,0,8.5,-1.5));
  }else if(kind==='radar'){
    g.add(mesh(new THREE.CylinderGeometry(.8,1.1,9,10),steel,0,4.5,0));g.add(mesh(new THREE.BoxGeometry(3.6,.5,3.6),steel,0,9.2,0));
    g.add(mesh(new THREE.BoxGeometry(4,2,4),concrete,4,1,3));
    spin=new THREE.Group();spin.position.y=10.8;g.add(spin);const panel=mesh(new THREE.BoxGeometry(5.5,2.8,.35),acc,0,0,0);panel.rotation.x=-.35;spin.add(panel);
    spin.add(mesh(new THREE.BoxGeometry(5.7,.3,.5),darkMat,0,-1.4,0));
  }else if(kind==='power'){
    for(const x of [-4.5,4.5])g.add(mesh(new THREE.CylinderGeometry(2.8,4,12,20),concrete,x,6,-2));
    g.add(mesh(new THREE.BoxGeometry(9,5,5),new THREE.MeshLambertMaterial({color:0xa9b0b6}),0,2.5,4.5));
    g.add(mesh(new THREE.CylinderGeometry(.6,.8,16,10),new THREE.MeshLambertMaterial({color:0xc85a4a}),5.5,8,5.5));
    g.add(mesh(new THREE.BoxGeometry(9.1,.4,5.1),acc,0,5.1,4.5));
    stack=[new V(-4.5,12.5,-2),new V(4.5,12.5,-2)];
  }else if(kind==='depot'){
    const mound=mesh(new THREE.SphereGeometry(7,20,8,0,TAU,0,Math.PI/2),new THREE.MeshLambertMaterial({color:0x7c8a55}));mound.scale.set(1.2,.42,1);g.add(mound);
    g.add(mesh(new THREE.BoxGeometry(4.4,2.8,2),new THREE.MeshLambertMaterial({color:0x9c9a90}),0,1.4,6.6));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(3,2,.2),darkMat).translateY(1.1).translateZ(7.65));
    g.add(mesh(new THREE.BoxGeometry(4.5,.35,2.1),acc,0,2.9,6.6));
  }else if(kind==='factory'){
    const fm=new THREE.MeshLambertMaterial({color:0xc9c5bb}),rf=new THREE.MeshLambertMaterial({color:0x7a8794});
    g.add(mesh(new THREE.BoxGeometry(14,5,10),fm,0,2.5,0));
    for(let i=0;i<4;i++){const s=mesh(new THREE.CylinderGeometry(1.6,1.6,10,3,1).rotateX(Math.PI/2),rf,-5.2+i*3.5,5.6,0);g.add(s);}
    g.add(mesh(new THREE.CylinderGeometry(.7,.9,12,10),new THREE.MeshLambertMaterial({color:0xa25b45}),5,6,3.5));
    g.add(mesh(new THREE.BoxGeometry(14.1,.4,10.1),acc,0,4.4,0));
    stack=[new V(5,12.5,3.5)];
  }else if(kind==='airbase'){
    const rw=new THREE.Mesh(new THREE.PlaneGeometry(4.5,19).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({map:runwayTex}));rw.position.set(-3,.12,0);rw.receiveShadow=true;g.add(rw);
    const hg=mesh(new THREE.CylinderGeometry(3,3,7,16,1,false,0,Math.PI).rotateZ(Math.PI/2).rotateY(Math.PI/2),new THREE.MeshLambertMaterial({color:0x9aa3ab}),4.5,0,-3);g.add(hg);
    g.add(mesh(new THREE.BoxGeometry(6.2,.3,.4),acc,4.5,3.1,.6));
    for(const [x,z] of [[3.5,4.5],[6.5,5.5]]){const j=new THREE.Group();j.position.set(x,.6,z);j.add(mesh(new THREE.BoxGeometry(.6,.5,3.2),steel));j.add(mesh(new THREE.BoxGeometry(3,.12,1.1),steel,0,0,.2));j.add(mesh(new THREE.BoxGeometry(1.2,.1,.5),steel,0,.1,-1.4));g.add(j);}
  }else{ // finance
    const a=new THREE.Group();a.position.set(-3,0,-2);boxPart(a,6,38,6,0,MATS.glass[0]);g.add(a);
    const b=new THREE.Group();b.position.set(4,0,2);boxPart(b,5,28,5,0,MATS.glass[1]);g.add(b);
    const c=new THREE.Group();c.position.set(-1,0,5);cylPart(c,2.6,22,0,MATS.office[0]);g.add(c);
    g.add(mesh(new THREE.BoxGeometry(6.1,.6,6.1),acc,-3,38.3,-2));
  }
  g.traverse(o=>{if(o.isMesh)o.userData.mat=o.material;});
  return {g,spin,stack};
}
function setBurnt(c,on){c.g.traverse(o=>{if(o.isMesh&&o.userData.mat)o.material=on?(Array.isArray(o.userData.mat)?burntMats:burnt):o.userData.mat;});c.g.scale.y=on?0.6:1;}

/* --- batteries (vehicle models from the prototype, extended to all 17 systems) --- */
const olive=new THREE.MeshLambertMaterial({color:0x6b7558});
const tyre=new THREE.MeshLambertMaterial({color:0x1e2124});
const glassMat=new THREE.MeshLambertMaterial({color:0x223344});
const accentMats={};for(const k in SYS_COL)accentMats[k]=new THREE.MeshBasicMaterial({color:SYS_COL[k]});
const ringGeo=(()=>{const p=[];for(let i=0;i<128;i++){const a=i/128*TAU;p.push(Math.cos(a),0,Math.sin(a));}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));return g;})();
const wheelGeo=new THREE.CylinderGeometry(.55,.55,.45,12).rotateZ(Math.PI/2);
function veh(g,len,w,acc){
  const body=shadowy(new THREE.Mesh(new THREE.BoxGeometry(w,1.1,len),olive));body.position.y=1.25;g.add(body);
  const cab=shadowy(new THREE.Mesh(new THREE.BoxGeometry(w*.92,1.4,1.8),olive));cab.position.set(0,2.4,len/2-1);g.add(cab);
  const gl=new THREE.Mesh(new THREE.BoxGeometry(w*.8,.5,.05),glassMat);gl.position.set(0,2.7,len/2-.08);g.add(gl);
  const n=Math.max(2,Math.round(len/2.6));for(let i=0;i<n;i++)for(const sx of [-1,1]){const wh=shadowy(new THREE.Mesh(wheelGeo,tyre));wh.position.set(sx*(w/2-.05),.55,len/2-1-i*(len-1.6)/(n-1));g.add(wh);}
  const strip=new THREE.Mesh(new THREE.BoxGeometry(w+.06,.28,.6),acc);strip.position.set(0,1.9,len/2-2.2);g.add(strip);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(w*.7,.12,1.1),acc);roof.position.set(0,3.16,len/2-1);g.add(roof);
}
function tubes(g,cols,rows,r,len,sp,box,tilt,y,z){
  const grp=new THREE.Group();grp.position.set(0,y,z);grp.rotation.x=-tilt;g.add(grp);
  const geo=box?new THREE.BoxGeometry(r*2,r*2,len).translate(0,0,len/2):new THREE.CylinderGeometry(r,r,len,12).rotateX(Math.PI/2).translate(0,0,len/2);
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const m=shadowy(new THREE.Mesh(geo,box?olive:steel));m.position.set((i-(cols-1)/2)*sp,(j-(rows-1)/2)*sp,0);grp.add(m);}
  return grp;
}
function gunTurret(g,y,z,w,barrels,blen){const tur=new THREE.Group();tur.position.set(0,y,z);g.add(tur);tur.add(shadowy(new THREE.Mesh(new THREE.BoxGeometry(w,1.3,w),olive)));
  for(let i=0;i<barrels;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,blen,6).rotateX(Math.PI/2).translate(0,0,blen*.85),steel);b.position.x=(i-(barrels-1)/2)*1.1;tur.add(b);}return tur;}
function buildModel(key,g,root){
  const acc=accentMats[key]||accentMats.korkut;let tur=null,pulse=null,top=3;
  if(key==='zu23'){const base=shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.2,.6,3.2),olive));base.position.y=.9;g.add(base);for(const sx of [-1,1]){const wh=shadowy(new THREE.Mesh(wheelGeo,tyre));wh.position.set(sx*1.2,.55,0);g.add(wh);}
    tur=gunTurret(g,1.8,0,1.2,2,2.6);g.add(new THREE.Mesh(new THREE.BoxGeometry(1.3,.2,.3),acc).translateY(2.5));top=2;}
  else if(key==='gepard'){veh(g,6.8,2.8,acc);tur=gunTurret(g,2.8,-.8,2.6,2,3.2);const dish=new THREE.Mesh(new THREE.BoxGeometry(1.8,.9,.15),acc);dish.position.set(0,1.3,-.9);tur.add(dish);}
  else if(key==='korkut'){veh(g,6.4,2.6,acc);tur=gunTurret(g,2.7,-.8,2.6,2,3.4);}
  else if(key==='stinger'){veh(g,4.4,2.2,acc);const post=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,1.1,6),steel);post.position.set(0,2.4,-.9);g.add(post);tur=tubes(g,2,2,.17,1.6,.42,false,.4,3.1,-1.4);}
  else if(key==='sungur'){veh(g,4.6,2.2,acc);const post=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,1.2,6),steel);post.position.set(0,2.4,-1);g.add(post);tubes(g,2,2,.2,1.8,.5,false,.5,3.1,-1.6);}
  else if(key==='alka'){veh(g,6,2.4,acc);tur=new THREE.Group();tur.position.set(0,2.8,-1);g.add(tur);tur.add(shadowy(new THREE.Mesh(new THREE.BoxGeometry(2,1.3,2.2),olive)));const lens=new THREE.Mesh(new THREE.SphereGeometry(.5,12,8),acc);lens.position.z=1.2;tur.add(lens);}
  else if(key==='ironbeam'){veh(g,8,2.8,acc);g.add(mesh(new THREE.BoxGeometry(2.6,2,4),new THREE.MeshLambertMaterial({color:0xb8bcb0}),0,2.8,-1.6));tur=new THREE.Group();tur.position.set(0,4.4,-1.6);g.add(tur);
    tur.add(shadowy(new THREE.Mesh(new THREE.CylinderGeometry(1,1,1.2,14),olive)));const lens=new THREE.Mesh(new THREE.SphereGeometry(.65,12,8),acc);lens.position.set(0,.2,1);tur.add(lens);top=4.6;}
  else if(key==='koral'){veh(g,7.5,2.8,acc);const mast=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,8,6),steel);mast.position.set(0,6.2,-1.5);g.add(mast);
    tur=new THREE.Group();tur.position.set(0,9.8,-1.5);g.add(tur);for(let i=0;i<3;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.2,.2),acc);p.rotation.y=i*TAU/3;p.position.set(Math.sin(i*TAU/3)*.6,0,Math.cos(i*TAU/3)*.6);tur.add(p);}
    pulse=new THREE.Mesh(new THREE.RingGeometry(.94,1,64).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:SYS_COL[key],transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));root.add(pulse);top=9;}
  else if(key==='pantsir'){veh(g,8,2.9,acc);tur=new THREE.Group();tur.position.set(0,2.9,-1.4);g.add(tur);tur.add(shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.4,1.4,2.4),olive)));
    for(const sx of [-1.6,1.6]){const pod=tubes(tur,2,3,.16,2.6,.36,false,.35,.3,-.6);pod.position.x=sx;}
    const rad=new THREE.Mesh(new THREE.BoxGeometry(1.6,1,.15),acc);rad.position.set(0,1.2,-.6);tur.add(rad);
    for(const sx of [-.6,.6]){const b=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,2.4,6).rotateX(Math.PI/2).translate(0,0,1.8),steel);b.position.set(sx,-.3,0);tur.add(b);}}
  else if(key==='hisara'){veh(g,6.5,2.6,acc);tubes(g,2,2,.45,3.2,1,true,1.45,2.2,-2.4);top=5;}
  else if(key==='irondome'){veh(g,6.4,2.6,acc);tubes(g,4,5,.2,3.4,.44,true,1.0,2.4,-1.6);top=5;}
  else if(key==='irist'){veh(g,8,2.8,acc);tubes(g,4,2,.32,4.4,.7,false,1.45,2.3,-3.2);top=6;}
  else if(key==='hisaro'){veh(g,7.5,2.8,acc);tubes(g,3,2,.45,3.8,1,true,1.5,2.2,-2.9);top=6;}
  else if(key==='davidsling'){veh(g,8.5,3,acc);tubes(g,3,2,.5,5.5,1.05,true,1.2,2.3,-3.4);top=7;}
  else if(key==='siper'){veh(g,9,3,acc);tubes(g,2,2,.55,7,1.25,false,1,2.3,-3.8);top=8;}
  else if(key==='patriot'){veh(g,8,3,acc);tubes(g,2,2,.6,5.8,1.3,true,.66,2.3,-3.2);top=6.5;}
  else if(key==='s400'){veh(g,9.5,3,acc);tubes(g,2,2,.5,7.6,1.15,false,1.52,2.3,-3.9);top=9;}
  return {tur,pulse,top};
}
const beamGeo=new THREE.CylinderGeometry(.16,.16,1,6).rotateX(Math.PI/2).translate(0,0,.5);
const hexRGB=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];

function makeBattery(S,uid,sys,xu,zu){
  const g=new THREE.Group();g.position.set(xu,0,zu);g.rotation.y=Math.atan2(xu,zu);
  const {tur,pulse,top}=buildModel(sys,g,S.root);S.root.add(g);
  const ring=new THREE.LineLoop(ringGeo,new THREE.LineBasicMaterial({color:SYS_COL[sys]||0xffffff}));ring.position.set(xu,.5,zu);ring.visible=false;ring.scale.setScalar(RAD(DEF[sys].range));S.root.add(ring);
  if(pulse)pulse.position.set(xu,1.2,zu);
  let beam=null;if(DEF[sys].kind==='laser'){beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color:SYS_COL[sys],transparent:true,opacity:.9}));beam.visible=false;S.root.add(beam);}
  return {uid,sys,g,tur,pulse,ring,beam,beamT:0,pT:0,pos:new V(xu,0,zu),muzzle:new V(xu,top,zu),col:hexRGB(SYS_COL[sys]||0xffffff),showT:0};
}
function removeBattery(S,b){S.root.remove(b.g);S.root.remove(b.ring);if(b.pulse)S.root.remove(b.pulse);if(b.beam)S.root.remove(b.beam);}

/* ======================= THREAT & INTERCEPTOR MODELS ======================= */
const threatMat=new THREE.MeshLambertMaterial({color:0x6b737b});
const intMat=new THREE.MeshLambertMaterial({color:0xf2f6fa});
const droneMat=new THREE.MeshLambertMaterial({color:0x2c323a});
const gBody=new THREE.CylinderGeometry(.35,.35,4,8).rotateX(Math.PI/2);
const gNose=new THREE.ConeGeometry(.35,1.3,8).rotateX(Math.PI/2).translate(0,0,2.65);
const gFin1=new THREE.BoxGeometry(1.5,.08,.7).translate(0,0,-1.7);
const gFin2=new THREE.BoxGeometry(.08,1.5,.7).translate(0,0,-1.7);
function makeMissile(scale,mat){const g=new THREE.Group();for(const geo of [gBody,gNose,gFin1,gFin2])g.add(new THREE.Mesh(geo,mat));g.scale.setScalar(scale);scene.add(g);return g;}
const gWing=new THREE.BoxGeometry(3,.15,1.1),gFus=new THREE.BoxGeometry(.5,.4,1.8);
function makeDrone(){const g=new THREE.Group();g.add(new THREE.Mesh(gWing,droneMat));g.add(new THREE.Mesh(gFus,droneMat));scene.add(g);return g;}
const gUW=new THREE.BoxGeometry(9,.2,1.3),gUF=new THREE.BoxGeometry(.9,.8,4.4),gUT=new THREE.BoxGeometry(2.6,.15,.8).translate(0,.3,-2);
function makeUAV(s){const g=new THREE.Group();for(const geo of [gUW,gUF,gUT])g.add(new THREE.Mesh(geo,threatMat));g.scale.setScalar(s||1);scene.add(g);return g;}

/* ======================= AUDIO ======================= */
let ac=null,noiseBuf=null;
function initAudio(){if(ac)return;try{ac=new (window.AudioContext||window.webkitAudioContext)();const n=ac.sampleRate*2;noiseBuf=ac.createBuffer(1,n,ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=rand()*2-1;}catch(e){ac=null;}}
function sfx(kind,vol){
  if(!ac)return;try{
  const t=ac.currentTime,src=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();src.buffer=noiseBuf;
  if(kind==='boom'){f.type='lowpass';f.frequency.setValueAtTime(1100,t);f.frequency.exponentialRampToValueAtTime(50,t+1.5);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(Math.min(1,.8*vol),t+0.015);g.gain.exponentialRampToValueAtTime(0.0001,t+1.7);}
  else if(kind==='launch'){f.type='bandpass';f.Q.value=.8;f.frequency.setValueAtTime(1600,t);f.frequency.exponentialRampToValueAtTime(260,t+1.1);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+0.05);g.gain.exponentialRampToValueAtTime(0.0001,t+1.2);}
  else{f.type='highpass';f.frequency.value=1800;g.gain.setValueAtTime(.045,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.06);}
  src.connect(f);f.connect(g);g.connect(ac.destination);src.start(t,rand());src.stop(t+1.8);}catch(e){}
}

/* ======================= EFFECTS ======================= */
const _a=new V(),_b=new V(),_c=new V(),_prev=new V();
let shake=0;
function flash(p,i){const L=flashes[flashIdx++%flashes.length];L.position.copy(p);L.position.y+=2;L.intensity=i;}
function explode(p,size,ground){
  const n=Math.floor(26*size);
  for(let i=0;i<n;i++){_a.set(rand()-.5,rand()-.5,rand()-.5).normalize();const sp=(4+rand()*12)*size*.6,h=rand();
    emit(GLOW,p.x,p.y,p.z,_a.x*sp,_a.y*sp+(ground?sp*.6:0),_a.z*sp,.3+rand()*.55,1.6*size,5*size,1,.55+h*.35,.18+h*.3,1,2.6,-3);}
  for(let i=0;i<3;i++)emit(GLOW,p.x,p.y,p.z,0,0,0,.22,9*size,3*size,1,.9,.7,1,0,0);
  for(let i=0;i<n*.55;i++){_a.set(rand()-.5,rand()*.6,rand()-.5).normalize();const sp=(1+rand()*5)*size*.5,c=.2+rand()*.14;
    emit(SMOKE,p.x,p.y,p.z,_a.x*sp,_a.y*sp+1,_a.z*sp,2.4+rand()*2.5,2.4*size,11*size,c,c,c*1.05,.65,.9,-1.2);}
  if(ground)for(let i=0;i<n*.6;i++){_a.set(rand()-.5,rand()*.9+.2,rand()-.5);const sp=10+rand()*18;emit(GLOW,p.x,p.y+.5,p.z,_a.x*sp,_a.y*sp,_a.z*sp,.8+rand()*.8,.6,.3,1,.6,.25,1,.4,26);}
  flash(p,2.2*size);sfx('boom',Math.min(1,size/3));
}
function puff(p){emit(GLOW,p.x,p.y,p.z,0,0,0,.12,3,1,1,.8,.5,.9,0,0);emit(SMOKE,p.x,p.y,p.z,(rand()-.5),(rand()-.5),(rand()-.5),1.2,.8,3,.35,.35,.37,.5,.5,0);}
function trail(a,b,kind,col){
  const L=a.distanceTo(b),n=Math.min(5,Math.max(1,Math.ceil(L/0.9)));
  for(let k=1;k<=n;k++){_c.copy(a).lerp(b,k/n);const x=_c.x,y=_c.y,z=_c.z;
    if(kind==='bal'||kind==='hyp'){emit(GLOW,x,y,z,(rand()-.5),(rand()-.5),(rand()-.5),.18,3.2,1,1,.62,.28,.95,0,0);if(rand()<.8)emit(SMOKE,x,y,z,(rand()-.5)*.6,.3,(rand()-.5)*.6,5+rand()*2,1.8,10,.88,.88,.9,.5,.3,-.3);}
    else if(kind==='cru'||kind==='roc'){emit(GLOW,x,y,z,0,0,0,.12,1.7,.6,1,.55,.25,.9,0,0);if(rand()<.6)emit(SMOKE,x,y,z,0,.2,0,2,.8,4,.85,.85,.87,.4,.4,-.2);}
    else if(kind==='dro'){if(k===n)emit(GLOW,x,y,z,0,0,0,.07,1,.6,1,.25,.2,.9,0,0);}
    else if(kind==='uav'){if(k===n)emit(SMOKE,x,y,z,0,0,0,.6,.6,1.6,.92,.92,.94,.35,0,0);}
    else{emit(GLOW,x,y,z,0,0,0,.16,2.4,.8,col[0],col[1],col[2],.95,0,0);if(rand()<.85)emit(SMOKE,x,y,z,(rand()-.5)*.4,.2,(rand()-.5)*.4,3+rand(),1,6,.96,.96,.98,.55,.3,-.3);}
  }
}

/* ======================= UI HELPERS ======================= */
const msgEl=$('msg');let msgTimer=0,bannerTimer=0;
function msg(t,cls){msgEl.textContent=t;msgEl.className='msg show '+(cls||'');msgTimer=2.8;}
function banner(t,s,dur){$('bTitle').textContent=t;$('bSub').textContent=s||'';$('banner').classList.add('show');bannerTimer=dur||2.8;}
const fmt=v=>{const a=Math.abs(v),s=v<0?'−':'';if(a>=1000)return s+'$'+(a/1000).toFixed(2)+'B';if(a===0)return '$0';if(a<1)return s+'$'+Math.round(a*1000)+'k';return s+'$'+(a>=100?a.toFixed(0):a>=10?a.toFixed(1):a.toFixed(2).replace(/\.?0+$/,''))+'M';};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ======================= GAME STATE ======================= */
let view=null,running=false,T=0;
let viewSide=0,choice=0,tab=null,placing=null,selected=null,plan=newPlan(),upSeg='def';
function newPlan(){return {counts:{},target:null,scouts:{},scoutPath:{},scoutPathU:{},bearing:null,route:null,routeU:null};}
let drawMode=null,showAllDef=false,showAllAtk=false;
let lastTurnKey='',sheetSig='',sheetT=0,useShadows=true;
const TV=new Map(),IV=new Map();   // threat and interceptor visuals by uid

function cmd(c){const r=ADD.cmdRaw(c);view=ADD.viewRaw();if(!r.ok){msg(r.error,'bad');return false;}sheetSig='';return true;}
const canShop=()=>view&&(view.phase==='setup'||(view.phase==='turn'&&view.myTurn));
const myTurn=()=>view&&view.phase==='turn'&&view.myTurn;

function startGame(demo){
  initAudio();
  const name=($('nameIn').value||'').trim()||'You';
  try{localStorage.setItem('add.name',name);}catch(e){}
  ADD.newSandbox((Math.random()*1e9)|0,name,!!demo);
  view=ADD.viewRaw();
  buildCity(SIDES[0],0);buildCity(SIDES[1],1);
  clearBattle();choice=0;tab=demo?null:'build';placing=null;selected=null;plan=newPlan();lastTurnKey='';sheetSig='';
  $('menu').hidden=true;$('report').hidden=true;running=true;
  cam.theta=0.7;cam.phi=1.05;
  refreshUI();
}
$('startBtn').onclick=()=>startGame(false);
try{$('nameIn').value=localStorage.getItem('add.name')||'';}catch(e){}

function showSide(i){if(i!==viewSide){cam.tx=0;cam.tz=0;}viewSide=i;SIDES[0].root&&(SIDES[0].root.visible=i===0);SIDES[1].root&&(SIDES[1].root.visible=i===1);for(const S of SIDES)for(const el of S.labelEls||[])el.hidden=true;}
function wantedSide(){if(!view)return 0;const b=view.battle;if(b&&(view.phase==='battle'||view.phase==='report'))return b.iDefend?0:1;return choice;}

/* ---------- keep the scene in step with the rules ---------- */
function syncCity(S,isHome){
  const v=view;
  // Batteries.
  const list=isHome?v.me.batteries.map(b=>({uid:b.uid,sys:b.sys,x:v.me.pads[b.pad].x,z:v.me.pads[b.pad].z,hold:b.holdFire})):v.enemy.batteries.map(b=>({uid:b.uid,sys:b.sys,x:b.x,z:b.z,hold:false}));
  const seen=new Set();
  for(const b of list){seen.add(b.uid);if(!S.bats[b.uid]){S.bats[b.uid]=makeBattery(S,b.uid,b.sys,b.x*U,b.z*U);S.bats[b.uid].showT=isHome?3:0;}}
  for(const id in S.bats)if(!seen.has(+id)){removeBattery(S,S.bats[id]);delete S.bats[id];}
  // Critical buildings.
  const blds=isHome?v.me.buildings:v.enemy.buildings;const seenB=new Set();
  for(const b of blds){seenB.add(b.uid);let c=S.crit[b.uid];
    if(!c){c=critModel(b.kind);c.uid=b.uid;c.kind=b.kind;c.down=false;c.x=b.x*U;c.z=b.z*U;c.g.position.set(c.x,0,c.z);S.root.add(c.g);
      const el=document.createElement('div');el.className='ind';el.style.setProperty('--c',css(BLD_COL[b.kind]));el.hidden=true;$('tags').appendChild(el);c.el=el;S.labelEls.push(el);S.crit[b.uid]=c;}
    const down=b.down>0;if(down!==c.down){c.down=down;setBurnt(c,down);if(down)S.fires.push({x:c.x,y:3,z:c.z,t:9999,w:4,crit:b.uid});else S.fires=S.fires.filter(f=>f.crit!==b.uid);}
    const txt=(BLD[b.kind]?BLD[b.kind].name:b.kind).toUpperCase()+(down?' · DOWN '+b.down:'');
    c.txt=txt;c.revealed=isHome&&b.revealed;}
  for(const id in S.crit)if(!seenB.has(+id)){S.root.remove(S.crit[id].g);S.crit[id].el.remove();delete S.crit[id];}
  // Impact scars.
  const scars=isHome?v.me.scars:v.enemy.scars;
  while(S.scarCount<scars.length){const s=scars[S.scarCount++];if(s.d>0)burnNear(S,s.x*U,s.z*U,3+s.d*.12);}
}

function clearBattle(){for(const t of TV.values()){scene.remove(t.mesh);t.tag.remove();}TV.clear();for(const i of IV.values())scene.remove(i.mesh);IV.clear();}

function threatShown(t){if(t.scout)return 'uav';if(t.decoy)return 'decoy';return t.cls||null;}
function syncBattle(){
  const b=view.battle;
  if(!b||view.phase!=='battle'){if(TV.size||IV.size)clearBattle();return;}
  const seen=new Set();
  for(const t of b.threats){
    seen.add(t.uid);let tv=TV.get(t.uid);
    if(!tv){
      const look=t.scout?'uav':(t.cls||t.looksLike);
      const meshFor=look==='decoy'?t.looksLike:look;
      let m;
      if(t.scout)m=makeUAV(.8);
      else if(meshFor==='drone')m=makeDrone();
      else if(meshFor==='uav')m=makeUAV(1);
      else if(meshFor==='ballistic'||meshFor==='hypersonic')m=makeMissile(1.5,threatMat);
      else if(meshFor==='rocket')m=makeMissile(.6,threatMat);
      else m=makeMissile(1,threatMat);
      const el=document.createElement('div');el.className='tag';el.hidden=true;el.innerHTML='<i></i><span></span>';$('tags').appendChild(el);
      tv={mesh:m,tag:el,span:el.lastChild,key:'',pos:new V(),trail:meshFor==='drone'?'dro':meshFor==='uav'?'uav':meshFor==='rocket'?'roc':meshFor==='cruise'?'cru':meshFor==='hypersonic'?'hyp':'bal',fresh:true};
      TV.set(t.uid,tv);
    }
    _prev.copy(tv.pos);toScene(t.x,t.z,t.alt,tv.pos);if(Math.hypot(tv.pos.x,tv.pos.z)>150){const g=terrainH(tv.pos.x,tv.pos.z)+5;if(tv.pos.y<g)tv.pos.y=g;}
    if(tv.fresh){tv.fresh=false;_prev.copy(tv.pos);}
    else{trail(_prev,tv.pos,tv.trail);_b.copy(tv.pos).sub(_prev);if(_b.lengthSq()>1e-6){_b.add(tv.pos);tv.mesh.lookAt(_b);}}
    tv.mesh.position.copy(tv.pos);tv.data=t;
  }
  for(const [id,tv] of TV)if(!seen.has(id)){scene.remove(tv.mesh);tv.tag.remove();TV.delete(id);}
  const seenI=new Set();
  for(const i of b.interceptors){
    seenI.add(i.uid);let iv=IV.get(i.uid);
    if(!iv){iv={mesh:makeMissile(.75,intMat),pos:new V(),col:hexRGB(SYS_COL[i.sys]||0xffffff),fresh:true};IV.set(i.uid,iv);}
    _prev.copy(iv.pos);toScene(i.x,i.z,i.alt,iv.pos);if(Math.hypot(iv.pos.x,iv.pos.z)>150){const g=terrainH(iv.pos.x,iv.pos.z)+5;if(iv.pos.y<g)iv.pos.y=g;}
    if(iv.fresh){iv.fresh=false;_prev.copy(iv.pos);}else{trail(_prev,iv.pos,'int',iv.col);_b.copy(iv.pos).sub(_prev);if(_b.lengthSq()>1e-6){_b.add(iv.pos);iv.mesh.lookAt(_b);}}
    iv.mesh.position.copy(iv.pos);
  }
  for(const [id,iv] of IV)if(!seenI.has(id)){scene.remove(iv.mesh);IV.delete(id);}
}

function nearestBattery(S,sys,x,z){let best=null,bd=1e9;for(const id in S.bats){const b=S.bats[id];if(b.sys!==sys)continue;const d=Math.hypot(b.pos.x-x,b.pos.z-z);if(d<bd){bd=d;best=b;}}return best;}
function handleEvents(list){
  const S=SIDES[viewSide];const iDefend=view.battle&&view.battle.iDefend;
  for(const e of list){
    if(e.t==='kill'){toScene(e.x,e.z,e.alt,_a);explode(_a.clone(),(SIZE[e.cls]||1.5)*.8,false);if(iDefend&&(e.cls==='ballistic'||e.cls==='hypersonic'))msg('Ballistic missile intercepted','good');}
    else if(e.t==='miss'){toScene(e.x,e.z,e.alt,_a);explode(_a.clone(),.6,false);}
    else if(e.t==='impact'){toScene(e.x,e.z,0,_a);_a.y=.5;const s=e.damage>0?Math.min(4,1+e.damage/25):.8;explode(_a.clone(),s,true);if(e.damage>0)shake=Math.max(shake,reduced?0:s*.55);}
    else if(e.t==='launch'){toScene(e.x,e.z,0,_a);const b=nearestBattery(S,e.sys,_a.x,_a.z);const m=b?b.muzzle:_a;
      for(let k=0;k<26;k++){const a=rand()*TAU,s=3+rand()*8;emit(SMOKE,m.x,1+rand()*2,m.z,Math.cos(a)*s,rand()*2,Math.sin(a)*s,2.5+rand()*2,2,9,.88,.88,.89,.6,1.4,-.6);}
      emit(GLOW,m.x,m.y,m.z,0,0,0,.25,10,3,1,.8,.5,1,0,0);flash(m,1.6);sfx('launch');}
    else if(e.t==='gun'){toScene(e.fx,e.fz,0,_a);const b=nearestBattery(S,e.sys,_a.x,_a.z);toScene(e.tx,e.tz,e.alt,_c);const m=b?b.muzzle:_a;
      if(b&&b.tur)b.tur.lookAt(_c);const d=m.distanceTo(_c),tt=d/190;_b.copy(_c).sub(m).normalize();
      for(let s=0;s<3;s++)emit(GLOW,m.x+_b.x*3.5,m.y+_b.y*3.5,m.z+_b.z*3.5,_b.x*190+(rand()-.5)*8,_b.y*190+(rand()-.5)*8,_b.z*190+(rand()-.5)*8,tt,1,.8,1,.75,.3,1,0,0);
      emit(GLOW,m.x+_b.x*3.5,m.y+_b.y*3.5,m.z+_b.z*3.5,0,0,0,.05,2.8,1.5,1,.8,.4,1,0,0);if(!e.kill)puff(_c.clone());if(rand()<.5)sfx('gun');}
    else if(e.t==='laser'){toScene(e.fx,e.fz,0,_a);const b=nearestBattery(S,e.sys,_a.x,_a.z);toScene(e.tx,e.tz,e.alt,_c);
      if(b&&b.beam){if(b.tur)b.tur.lookAt(_c);_a.copy(b.muzzle);_a.y+=.2;b.beam.visible=true;b.beam.position.copy(_a);b.beam.lookAt(_c);b.beam.scale.set(1,1,_a.distanceTo(_c));b.beamT=.35;}
      for(let k=0;k<6;k++)emit(GLOW,_c.x,_c.y,_c.z,(rand()-.5)*3,(rand()-.5)*3,(rand()-.5)*3,.25,1.6,.4,1,.4,.8,1,0,0);}
    else if(e.t==='reveal'){if(!iDefend)msg('Target revealed','good');}
    else if(e.t==='msg'){msg(e.text,e.tone==='bad'?'bad':e.tone==='good'?'good':'');}
  }
}

/* ======================= PHASE CHANGES ======================= */
function onPhase(){
  const v=view,key=v.phase+'|'+v.turnNo+'|'+v.active;
  if(key===lastTurnKey)return;lastTurnKey=key;
  closeInfo();if(drawMode)setDraw(null);if(v.phase!=='battle')rebuildPlanGfx();
  if(v.phase==='turn'){
    if(v.myTurn){plan=newPlan();choice=0;tab='attack';const r=v.me.lastRestock;
      banner('YOUR TURN','+'+fmt(v.me.income)+' income'+(r&&r.n?' · '+r.n+' missiles restocked':''),2);
      if(r&&r.short)setTimeout(()=>msg(m_factoryDown()?'Factory down: no missiles restocked':'Not enough money to restock every spare missile','warn'),2700);}
    else{tab=null;setPlacing(null);banner(v.enemy.name.toUpperCase()+"'S TURN",'They are planning a strike',2);}
  }else if(v.phase==='battle'){
    setPlacing(null);tab=null;cam.phi=1.0;cam.r=Math.max(170,Math.min(cam.r,230));cam.tx=0;cam.tz=0;
    if(v.battle.iDefend){banner('INCOMING STRIKE','From the '+compass(v.battle.bearing)+' · tap a contact to fire at it first',2.8);
      const empty=v.me.batteries.filter(b=>b.load&&b.ammo===0);if(empty.length)setTimeout(()=>msg(empty.map(b=>DEF[b.sys].name).join(', ')+': no missiles loaded!','bad'),2900);}
    else banner('STRIKE LAUNCHED','Watching '+v.enemy.name+"'s city",2.2);
  }else if(v.phase==='report'){showReport();}
  else if(v.phase==='over'){showOver();}
  if(v.phase!=='report'&&v.phase!=='over')$('report').hidden=true;
  sheetSig='';refreshUI();
}

function m_factoryDown(){return view.me.buildings.some(b=>b.kind==='factory'&&b.down>0);}
function showReport(){
  const v=view,r=v.report;if(!r)return;
  const attackerIsMe=v.battle?!v.battle.iDefend:false;
  const lines=[['Contacts launched',r.launched],['Stopped',r.stopped],['Hits',r.hits],['City damage',Math.round(r.damage)],
    ['Interceptors fired',r.interceptorsUsed+' · '+fmt(r.defenceSpent)],['Strike cost',fmt(r.attackSpent)]];
  if(r.knockedOut.length)lines.push(['Knocked out',r.knockedOut.join(', ')]);
  lines.push([(attackerIsMe?v.enemy.name:'Your')+' buildings known to the attacker',r.revealed+' of '+(attackerIsMe?'7+':v.me.buildings.length)]);
  $('repEyebrow').textContent='Turn '+v.turnNo+' · '+(attackerIsMe?'your strike on '+v.enemy.name:v.enemy.name+"'s strike on you");
  $('repTitle').textContent=attackerIsMe?(r.damage>60?'HEAVY DAMAGE':r.damage>0?'STRIKE LANDED':'STRIKE STOPPED'):(r.damage===0?'STRIKE REPELLED':r.damage<60?'CITY DAMAGED':'HEAVY DAMAGE');
  $('repBody').innerHTML=lines.map(l=>'<div class="kv"><span>'+esc(l[0])+'</span><b style="text-align:right">'+esc(l[1])+'</b></div>').join('');
  $('repBtn').textContent='Continue';$('repMenu').hidden=true;$('report').hidden=false;
}
function showOver(){
  const v=view;
  $('repEyebrow').textContent='Duel over';$('repTitle').textContent=v.iWon?'VICTORY':'DEFEAT';
  const why=v.endReason==='conceded'?(v.iWon?v.enemy.name+' accepted defeat.':'You accepted defeat.'):(v.iWon?v.enemy.name+"'s city is destroyed.":'Your city is destroyed.');
  $('repBody').innerHTML='<div class="kv"><span>Result</span><b style="text-align:right">'+esc(why)+'</b></div><div class="kv"><span>Your city</span><b>'+Math.round(v.me.health)+'</b></div><div class="kv"><span>'+esc(v.enemy.name)+'</span><b>'+Math.round(v.enemy.health)+'</b></div>';
  $('repBtn').textContent='Play again';$('repMenu').hidden=false;$('report').hidden=false;
}
$('repBtn').onclick=()=>{if(view&&view.phase==='over'){startGame(false);return;}$('report').hidden=true;cmd({c:'continue'});};
$('repMenu').onclick=()=>{toMenu();};
function toMenu(){running=false;ADD.quit();view=null;clearBattle();for(const S of SIDES)if(S.root){scene.remove(S.root);for(const el of S.labelEls)el.remove();S.root=null;}
  $('report').hidden=true;$('gameMenu').hidden=true;$('menu').hidden=false;tab=null;setPlacing(null);closeInfo();
  buildCity(SIDES[0],0);showSide(0);SIDES[0].root.visible=true;refreshUI();}

/* ======================= PANELS ======================= */
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setTab(tab===b.dataset.tab?null:b.dataset.tab));
function setTab(t){tab=t;if(t!=='build')setPlacing(null);sheetSig='';refreshUI();}
$('endBtn').onclick=()=>{
  if(!view)return;
  if(view.phase==='setup'){cmd({c:'endSetup'});return;}
  if(myTurn())launch();
};
$('quickBtn').onclick=quickStrike;
$('waitBtn').onclick=()=>{if(myTurn()&&cmd({c:'wait'}))msg('You hold fire and save money','money');};
function toggleCity(){if(!view)return;if(view.phase==='battle'||view.phase==='report'){msg('The view follows the strike','');return;}choice=choice?0:1;setPlacing(null);closeInfo();
  msg(choice?'Viewing '+view.enemy.name+"'s city · revealed buildings are labelled":'Back to your city','good');refreshUI();}
$('cityBtn').onclick=toggleCity;$('cityTab').onclick=toggleCity;
$('menuBtn').onclick=()=>{if(view)$('gameMenu').hidden=false;};
$('gmBack').onclick=()=>{$('gameMenu').hidden=true;};
$('gmConcede').onclick=()=>{$('gameMenu').hidden=true;if(view&&view.phase!=='over')cmd({c:'concede'});};
$('gmShadows').onclick=()=>{useShadows=!useShadows;renderer.shadowMap.enabled=useShadows;sun.castShadow=useShadows;$('gmShadows').textContent=useShadows?'Shadows on':'Shadows off';
  scene.traverse(o=>{if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.needsUpdate=true);}});};

const planGfx=new THREE.Group();scene.add(planGfx);
const ray=new THREE.Raycaster(),groundPlane=new THREE.Plane(new V(0,1,0),0),_ndc=new THREE.Vector2();
function groundAt(x,y){_ndc.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);ray.setFromCamera(_ndc,camera);const p=new V();return ray.ray.intersectPlane(groundPlane,p)?p:null;}
// Scene units → km around the city (inverse of RAD).
function toKm(p){const r=Math.hypot(p.x,p.z),kr=r<=106?r/U:6+6*(Math.exp((r-106)/70)-1),k=r>1e-6?kr/r:1/U;return {x:Math.round(p.x*k*1000)/1000,z:Math.round(p.z*k*1000)/1000};}
function polyMesh(pts,col,arrow){const g=new THREE.Group();if(pts.length<2)return g;
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,depthTest:false});
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=Math.hypot(b.x-a.x,b.z-a.z);if(L<.2)continue;
    const bar=new THREE.Mesh(new THREE.BoxGeometry(2.2,.6,L+1),mat);bar.position.set((a.x+b.x)/2,3,(a.z+b.z)/2);bar.lookAt(b.x,3,b.z);bar.renderOrder=9;g.add(bar);}
  const e=pts[pts.length-1],p=pts[Math.max(0,pts.length-3)];
  if(arrow){const c=new THREE.Mesh(new THREE.ConeGeometry(5,12,12).rotateX(Math.PI/2),mat);c.position.set(e.x,3,e.z);c.lookAt(e.x+(e.x-p.x),3,e.z+(e.z-p.z));c.renderOrder=9;g.add(c);}
  const s0=new THREE.Mesh(new THREE.SphereGeometry(3.2,12,8),mat);s0.position.set(pts[0].x,3,pts[0].z);s0.renderOrder=9;g.add(s0);
  return g;}
let drawPts=null;
function rebuildPlanGfx(){while(planGfx.children.length)planGfx.remove(planGfx.children[0]);
  if(plan.routeU)planGfx.add(polyMesh(plan.routeU,0xff5a4e,true));
  for(const k in plan.scoutPathU){const p=plan.scoutPathU[k];if(p&&plan.scoutPath[k])planGfx.add(polyMesh(p,0xc48bff,false));}
  if(drawPts&&drawPts.length>1)planGfx.add(polyMesh(drawPts,drawMode==='route'?0xff5a4e:0xc48bff,drawMode==='route'));}
function setDraw(mode){drawMode=mode;drawPts=null;setPlacing(null);closeInfo();
  if(mode){choice=1;cam.phi=.45;cam.r=270;cam.tx=0;cam.tz=0;$('placing').hidden=false;$('placing').style.borderColor=mode==='route'?'#ff5a4e':'#c48bff';
    $('placeText').innerHTML=mode==='route'?'Draw the strike route with your finger: <b>start far out</b>, go around as you like, <b>end at the city</b>':'Draw the <b>'+esc(SCT[mode].name)+'</b> flight path with your finger across the enemy city';}
  else $('placing').hidden=true;
  sheetSig='';refreshUI();}
function drawAdd(x,y){const p=groundAt(x,y);if(!p)return;const r=Math.hypot(p.x,p.z);if(r>420){p.x*=420/r;p.z*=420/r;}
  if(!drawPts)drawPts=[p];else{const l=drawPts[drawPts.length-1];if(Math.hypot(p.x-l.x,p.z-l.z)>=4)drawPts.push(p);}}
function finishDraw(){
  const pts=drawPts,mode=drawMode;drawPts=null;
  let L=0;if(pts)for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);
  if(!pts||pts.length<2||L<20){msg('Draw a longer path','warn');rebuildPlanGfx();return;}
  const u=pts.map(p=>({x:p.x,z:p.z})),km=u.map(toKm);
  if(mode==='route'){plan.route=km;plan.routeU=u;plan.bearing=Math.atan2(km[0].z,km[0].x);msg('Route set · strike comes from the '+compass(plan.bearing),'good');}
  else{plan.scoutPath[mode]=km;plan.scoutPathU[mode]=u;msg(SCT[mode].name+' will fly this path','good');}
  drawMode=null;$('placing').hidden=true;tab='attack';sheetSig='';rebuildPlanGfx();refreshUI();}
const REC_DEF=[['vs drones',['korkut','sungur']],['vs missiles',['hisara','irondome']],['vs ballistic',['davidsling','patriot']]];
const REC_ATK=['shahed','trg300','som','tayfun','tb2s'];
const TARGET_ORDER=['factory','command','power','radar','finance','depot','airbase'];
function quickStrike(){
  const v=view,m=v.me;if(!myTurn())return;
  plan={...newPlan(),bearing:plan.bearing,route:plan.route,routeU:plan.routeU};
  const tg=v.enemy.buildings.filter(b=>b.down===0).sort((a,b)=>TARGET_ORDER.indexOf(a.kind)-TARGET_ORDER.indexOf(b.kind))[0];
  if(tg)plan.target=tg.uid;
  const parts=[];
  for(const w of CAT.attacks){const st=m.stock[w.id]||0;if(!st)continue;const n=w.reusable?st:Math.min(st,m.caps[w.id]||0);if(n>0){plan.counts[w.id]=n;parts.push(n+' '+w.name);}}
  if(v.enemy.buildings.length<7){const sc=CAT.scouts.find(s=>(m.scouts[s.id]||0)>0);
    if(sc){const b=plan.bearing!=null?plan.bearing:-Math.PI/2+(v.turnNo%3-1)*0.8;const p=[{x:Math.cos(b)*5,z:Math.sin(b)*5},{x:-Math.cos(b)*5,z:-Math.sin(b)*5}];plan.scoutPath[sc.id]=p;plan.scoutPathU[sc.id]=p.map(q=>({x:q.x*U,z:q.z*U}));parts.push('scout '+sc.name);}}
  if(!parts.length){msg('Nothing in stock: buy weapons in Attack, or press Wait','warn');tab='attack';refreshUI();return;}
  msg('Planned: '+parts.join(', ')+(tg?' → '+BLD[tg.kind].name:'')+' · press GO','good');tab='attack';sheetSig='';rebuildPlanGfx();refreshUI();
}
function planEmpty(){for(const k in plan.counts)if(plan.counts[k]>0)return false;for(const k in plan.scoutPath)if(plan.scoutPath[k])return false;return true;}
function launch(){
  const strikes=[];
  for(const k in plan.counts){const n=plan.counts[k];if(!n)continue;
    const tgt=plan.target;if(ATK[k].precise&&tgt!=null&&view.enemy.buildings.some(b=>b.uid===tgt))strikes.push({weapon:k,n,target:tgt});else strikes.push({weapon:k,n});}
  const scouts=[];for(const k in plan.scoutPath){const p=plan.scoutPath[k];if(p&&(view.me.scouts[k]||0)>0)scouts.push({scout:k,path:p});}
  if(!strikes.length&&!scouts.length){quickStrike();if(!planEmpty())setTimeout(()=>msg('Nothing was chosen, so Quick strike filled it in · check it and press GO again','warn'),2900);return;}
  const go={c:'go',strikes,scouts};if(plan.route)go.route=plan.route;else if(plan.bearing!=null)go.bearing=plan.bearing;
  if(cmd(go)){plan=newPlan();}
}

function vsChips(hit,col){return '<div class="vs">'+CLS_ORDER.filter(k=>hit[k]).map(k=>'<i class="y" style="--c:'+CLS_CSS[k]+'">'+CLS_LABEL[k]+' '+Math.round(hit[k])+'%</i>').join('')+'</div>';}
function sig(){const v=view,m=v.me;return [v.phase,v.myTurn,tab,upSeg,m.budget,JSON.stringify(m.stock),JSON.stringify(m.launchers),JSON.stringify(m.scouts),JSON.stringify(m.interceptors),JSON.stringify(m.econ),JSON.stringify(m.radar),JSON.stringify(m.offUp),
  m.batteries.map(b=>b.uid+':'+b.level+':'+b.ammo).join(','),m.buildings.map(b=>b.down).join(','),v.enemy.buildings.map(b=>b.uid+':'+b.down).join(','),JSON.stringify(plan),placing].join('|');}

function hideSheet(){$('sheet').hidden=true;document.body.classList.remove('sheet-open');}
function renderSheet(){
  const sh=$('sheet');
  if(placing||drawMode){sh.hidden=true;document.body.classList.remove('sheet-open');return;}
  if(!tab||!canShop()&&tab!=='city'||!view||(view.phase!=='setup'&&view.phase!=='turn')){hideSheet();return;}
  const s=sig();if(s===sheetSig&&!sh.hidden)return;sheetSig=s;
  const keep=sh.scrollTop;
  sh.hidden=false;document.body.classList.add('sheet-open');sh.innerHTML=sheetHTML();
  sh.scrollTop=keep;
}
function sheetHTML(){
  const v=view,m=v.me,B=m.budget;
  if(tab==='build'){
    let h='';
    if(m.batteries.length){
      h+='<h3>Your defences <span class="small">· spare missiles are re-bought automatically at the start of each of your turns</span></h3><div class="items">'+m.batteries.map(b=>{const s=DEF[b.sys],spare=m.interceptors[b.sys]||0,rc=s.shot*s.load;
        const count=s.load?'<b class="big'+(b.ammo===0?' bad':'')+'">'+b.ammo+'</b><span> loaded</span> <b class="big">'+spare+'</b><span> spare</span>':'<b class="big">∞</b><span> '+(s.kind==='gun'?fmt(s.shot)+'/burst':'no ammo')+'</span>';
        return '<div class="item" style="--c:'+css(SYS_COL[b.sys])+'"><div class="nm"><b>'+esc(s.name)+'</b><span>Level '+b.level+' · range '+s.range+' km</span></div><div class="cnt">'+count+'</div><div class="acts">'+
          (s.load?'<div class="stepper"><span class="small">Keep spare</span><button class="step" data-act="rsdec" data-k="'+b.sys+'"'+((m.restock[b.sys]||0)<=0?' disabled':'')+'>−</button><output>'+(m.restock[b.sys]||0)+'</output><button class="step" data-act="rsinc" data-k="'+b.sys+'">+</button></div>'+
            '<button class="mini" data-act="reload" data-k="'+b.uid+'"'+(B<rc?' disabled':'')+'>Buy '+s.load+' now · '+fmt(rc)+'</button>':'')+
          (b.upgradeCost!=null?'<button class="mini" data-act="upBat" data-k="'+b.uid+'"'+(B<b.upgradeCost?' disabled':'')+'>Upgrade '+fmt(b.upgradeCost)+'</button>':'')+'</div></div>';}).join('')+'</div>';
    }
    const card=(s,role)=>{const col=css(SYS_COL[s.id]),best=CLS_ORDER.filter(k=>s.hit[k]&&k!=='decoy').sort((x,y)=>s.hit[y]-s.hit[x]).slice(0,3);
      return '<button class="tile'+(placing===s.id?' sel':'')+'" type="button" data-act="place" data-k="'+s.id+'" style="--c:'+col+'"'+(B<s.price?' disabled':'')+'>'+(role?'<span class="role">'+role+'</span>':'')+'<b class="tn">'+esc(s.name)+'</b>'+
        '<span class="meta"><b>'+fmt(s.price)+'</b> · '+s.range+' km</span><span class="hits">'+best.map(k=>'<i style="--k:'+CLS_CSS[k]+'">'+CLS_LABEL[k]+' '+Math.round(s.hit[k])+'</i>').join('')+'</span></button>';};
    h+='<h3>Buy a defence <span class="small">· tap one, then a glowing + in your city</span></h3>';
    if(!showAllDef){h+='<div class="tiles">';for(const [title,ids] of REC_DEF)h+=ids.map(id=>card(DEF[id],title)).join('');h+='</div>';}
    else h+='<div class="tiles">'+CAT.defences.map(s=>card(s)).join('')+'</div>';
    h+='<button class="mini" data-act="showall" data-k="def">'+(showAllDef?'Show recommended only':'Show all '+CAT.defences.length+' systems')+'</button>';
    return h;
  }
  if(tab==='attack'){
    const mine=myTurn(),targets=v.enemy.buildings;let h='';
    const owned=CAT.attacks.filter(w=>(m.launchers[w.id]||0)>0||(m.stock[w.id]||0)>0);
    const ownedS=CAT.scouts.filter(s=>(m.scouts[s.id]||0)>0);
    if(owned.length||ownedS.length){
      h+='<h3>'+(mine?'Choose what to launch':'Your weapons')+'</h3><div class="items">';
      for(const w of owned){const st=m.stock[w.id]||0,cap=w.reusable?st:(m.caps[w.id]||0),fire=Math.min(st,cap),buyN=w.reusable?1:Math.max(1,cap-st),q=Math.min(plan.counts[w.id]||0,fire);plan.counts[w.id]=q;
        h+='<div class="item" style="--c:'+CLS_CSS[w.cls]+'"><div class="nm"><b>'+esc(w.name)+'</b><span>'+(w.reusable?'reusable UAV':(m.launchers[w.id]||0)+' launcher · fires '+cap+'/turn')+' · '+(w.precise?'precise':'unguided')+'</span></div>'+
          '<div class="cnt"><b class="big'+(st===0?' bad':'')+'">'+st+'</b><span> in stock</span></div><div class="acts">'+
          '<button class="mini" data-act="units" data-k="'+w.id+'" data-n="'+buyN+'"'+(B<w.unit*buyN?' disabled':'')+'>Buy '+buyN+' · '+fmt(w.unit*buyN)+'</button>'+
          '</div>'+(mine?'<div class="launch'+(q>0?' on':'')+'"><span>LAUNCH</span><button class="step" data-act="sdec" data-k="'+w.id+'"'+(q<=0?' disabled':'')+'>−</button><output>'+q+'<small> of '+fire+'</small></output><button class="step" data-act="sinc" data-k="'+w.id+'"'+(q>=fire?' disabled':'')+'>+</button><button class="mini" data-act="sall" data-k="'+w.id+'"'+(fire===0||q===fire?' disabled':'')+'>All</button></div>':'')+'</div>';}
      for(const s of ownedS){const n=m.scouts[s.id]||0;
        h+='<div class="item" style="--c:'+CLS_CSS.uav+'"><div class="nm"><b>'+esc(s.name)+'</b><span>scout · reveals '+s.reveal+' km either side</span></div><div class="cnt"><b class="big">'+n+'</b><span> ready</span></div><div class="acts">'+
          (mine?(plan.scoutPath[s.id]?'<span class="small" style="color:var(--money)">Path drawn ✓</span><button class="mini" data-act="drawscout" data-k="'+s.id+'">Redraw</button><button class="mini" data-act="clearscout" data-k="'+s.id+'">Stay home</button>':'<button class="mini" data-act="drawscout" data-k="'+s.id+'">Draw flight path</button>'):'<button class="mini" data-act="scout" data-k="'+s.id+'"'+(B<s.price?' disabled':'')+'>Buy '+fmt(s.price)+'</button>')+'</div></div>';}
      h+='</div>';
    }else h+='<div class="note">You have no weapons yet. Pick some below.</div>';
    if(mine){
      h+='<div class="strikebar"><span>Route</span><b>'+(plan.route?'from the '+compass(plan.bearing):'straight from the north')+'</b>'+(plan.route?'<button class="mini" data-act="drawroute">Redraw</button><button class="mini" data-act="clearroute">Clear</button>':'<button class="mini" data-act="drawroute">Draw route</button>')+
        '<span class="small">Drones & UAVs follow it exactly · cruise missiles follow it smoothly · rockets & ballistic missiles only take its direction</span></div>';
      h+='<div class="strikebar"><span>Target for precise weapons</span><select class="mini" data-act="target"><option value="">Whole city</option>'+targets.map(b=>'<option value="'+b.uid+'"'+(plan.target===b.uid?' selected':'')+'>'+esc(BLD[b.kind].name)+(b.down>0?' (down)':'')+'</option>').join('')+'</select>'+
        (targets.length?'':'<span class="small" style="color:var(--threat)">No buildings found yet · fly a UAV first</span>')+'</div>';
    }
    const rest=CAT.attacks.filter(w=>!owned.includes(w)&&(showAllAtk||REC_ATK.includes(w.id))),restS=CAT.scouts.filter(s=>!ownedS.includes(s)&&(showAllAtk||REC_ATK.includes(s.id)));
    const wt=(id,name,col,meta,act,price,n)=>'<button class="tile" type="button" data-act="'+act+'" data-k="'+id+'"'+(n?' data-n="'+n+'"':'')+' style="--c:'+col+'"'+(B<price?' disabled':'')+'><b class="tn">'+esc(name)+'</b><span class="meta">'+meta+'</span><span class="meta"><b>'+fmt(price)+'</b></span></button>';
    h+='<h3>Add a weapon <span class="small">· tap to buy its launcher (or the UAV)</span></h3><div class="tiles">'+
      rest.map(w=>w.reusable?wt(w.id,w.name,CLS_CSS[w.cls],'armed UAV · reusable','units',w.unit,1):wt(w.id,w.name,CLS_CSS[w.cls],threatLabel(w.cls)+' · '+fmt(w.unit)+' each · '+w.perTurn+'/turn','launcher',w.launcher)).join('')+
      restS.map(sc=>wt(sc.id,sc.name,CLS_CSS.uav,'scout UAV · sees '+sc.reveal+' km','scout',sc.price)).join('')+'</div>';
    h+='<button class="mini" data-act="showall" data-k="atk">'+(showAllAtk?'Show recommended only':'Show all weapons')+'</button>';
    h+='<div class="note">'+(mine?'Set how many to launch, then press GO. Nothing launches if the clock runs out.':'A launcher is bought once and sets how many can fly each turn. You launch strikes on your turn.')+'</div>';
    return h;
  }
  if(tab==='upgrades'){
    let h='<div class="seg"><button class="mini'+(upSeg==='def'?' on':'')+'" data-act="seg" data-k="def">Defensive</button><button class="mini'+(upSeg==='off'?' on':'')+'" data-act="seg" data-k="off">Offensive</button><button class="mini'+(upSeg==='eco'?' on':'')+'" data-act="seg" data-k="eco">Economy</button></div>';
    if(upSeg==='def'){
      const R=CAT.radar;const row=(t,key,vf)=>{const lv=m.radar[key];const c=R.cost[lv+1];
        return '<div class="row" style="--c:#6fe3ff"><div class="nm"><b>'+t+' · L'+lv+'</b><span>'+R.names[lv]+'</span></div><div class="st">'+vf(lv)+(lv<3?'<br><span>Next: '+vf(lv+1)+'</span>':'')+'</div><div class="acts">'+(lv<3?'<button class="mini" data-act="radar" data-k="'+key+'"'+(B<c?' disabled':'')+'>'+fmt(c)+'</button>':'<span class="small">Max</span>')+'</div><div></div></div>';};
      const inf=x=>x==null||x>999;
      h+='<h3>Radar</h3><div class="rows">'+row('Range','range',l=>R.range[l]+' km warning')+row('Identification','identify',l=>inf(R.identify[l])?'type on detection':'type at '+R.identify[l]+' km')+row('Decoy detection','decoy',l=>R.decoy[l]===0?'never':inf(R.decoy[l])?'on detection':'at '+R.decoy[l]+' km')+
        '<div class="row"><div class="nm"><b>Extra radar site</b><span>Backup if a radar site is knocked out</span></div><div class="st">'+m.buildings.filter(b=>b.kind==='radar').length+' sites</div><div class="acts"><button class="mini" data-act="radarSite"'+(B<CAT.extraRadar?' disabled':'')+'>Build '+fmt(CAT.extraRadar)+'</button></div><div></div></div></div>';
      h+='<h3>Batteries</h3>'+(m.batteries.length?'<div class="rows">'+m.batteries.map(b=>'<div class="row" style="--c:'+css(SYS_COL[b.sys])+'"><div class="nm"><b>'+esc(b.name)+' · L'+b.level+'</b><span>Each level: hit chance +8 pts, load +25%</span></div><div class="st">'+(b.load?b.ammo+'/'+b.load+' loaded':'')+'</div><div class="acts">'+(b.upgradeCost!=null?'<button class="mini" data-act="upBat" data-k="'+b.uid+'"'+(B<b.upgradeCost?' disabled':'')+'>L'+(b.level+1)+' · '+fmt(b.upgradeCost)+'</button>':'<span class="small">Max</span>')+'</div><div></div></div>').join('')+'</div>':'<div class="note">Buy defence systems in the Defence tab first.</div>');
    }else if(upSeg==='off'){
      const owned=CAT.attacks.filter(w=>(m.launchers[w.id]||0)>0||(m.stock[w.id]||0)>0);
      if(!owned.length)h+='<div class="note">Buy a launcher or UAV in the Weapons tab first.</div>';
      for(const w of owned){h+='<h3 style="color:'+CLS_CSS[w.cls]+'">'+esc(w.name)+'</h3><div class="rows">';
        for(const k of ['warhead','guidance','stealth','capacity']){if(k==='capacity'&&w.reusable)continue;const tr=CAT.offUpgrades[k],lv=(m.offUp[w.id]||{})[k]||0;
          h+='<div class="row" style="--c:'+CLS_CSS[w.cls]+'"><div class="nm"><b>'+tr.label+' · L'+lv+'</b><span>'+tr.effect+'</span></div><div class="st"></div><div class="acts">'+(lv<3?'<button class="mini" data-act="upOff" data-k="'+w.id+'" data-t="'+k+'"'+(B<tr.cost[lv]?' disabled':'')+'>'+fmt(tr.cost[lv])+'</button>':'<span class="small">Max</span>')+'</div><div></div></div>';}
        h+='</div>';}
    }else{
      const E=CAT.economy;const er=(key,u,note)=>{const tr=E[key],lv=m.econ[key];
        return '<div class="row" style="--c:#9dffc4"><div class="nm"><b>'+tr.label+' · L'+lv+'</b><span>'+(note||'')+'</span></div><div class="st">'+u(tr.values[lv])+(lv<tr.cost.length?'<br><span>Next: '+u(tr.values[lv+1])+'</span>':'')+'</div><div class="acts">'+(lv<tr.cost.length?'<button class="mini" data-act="eco" data-k="'+key+'"'+(B<tr.cost[lv]?' disabled':'')+'>'+fmt(tr.cost[lv])+'</button>':'<span class="small">Max</span>')+'</div><div></div></div>';};
      h+='<div class="rows">'+er('income',x=>'+'+fmt(x)+'/turn','On top of the '+fmt(CAT.rules.income)+' everyone gets')+er('storage',x=>x+' protected slots','Stock above this is lost if the depot is hit · stored now '+m.storage.used)+er('logistics',x=>x+' reloads per strike','Batteries reloaded from the depot during a strike')+er('repair',x=>x+' turns','Time to repair a knocked-out building')+'</div>';
    }
    return h;
  }
  if(tab==='city'){
    return '<h3>Critical buildings</h3><div class="rows">'+m.buildings.map(b=>{const spec=BLD[b.kind];
      return '<div class="row" style="--c:'+css(BLD_COL[b.kind])+'"><div class="nm"><b>'+esc(spec.name)+(b.revealed?' <span style="color:var(--danger)">· KNOWN TO ENEMY</span>':'')+'</b><span>If hit: '+esc(spec.effect)+'</span></div><div class="st">'+(b.down>0?'<span style="color:var(--danger)">Down '+b.down+' turn'+(b.down===1?'':'s')+'</span>':'Working')+'</div><div class="acts">'+(b.down>0&&canShop()?'<button class="mini" data-act="repair" data-k="'+b.uid+'"'+(B<spec.repairNow?' disabled':'')+'>Repair '+fmt(spec.repairNow)+'</button>':'')+'</div><div></div></div>';}).join('')+
      '</div><div class="note">Your buildings are hidden from '+esc(v.enemy.name)+' until a UAV flies over them or they are hit. Enemy buildings you have found: '+v.enemy.buildings.length+'.</div>';
  }
  return '';
}
$('sheet').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b||b.disabled||!view)return;const k=b.dataset.k,a=b.dataset.act;
  if(a==='target')return;
  switch(a){
    case 'place':setPlacing(placing===k?null:k);break;
    case 'launcher':if(cmd({c:'buyLauncher',weapon:k}))msg(ATK[k].name+' launcher bought','money');break;
    case 'units':cmd({c:'buyUnits',weapon:k,n:+b.dataset.n});break;
    case 'scout':if(cmd({c:'buyScout',scout:k}))msg(SCT[k].name+' ready','money');break;
    case 'seg':upSeg=k;break;
    case 'radar':if(cmd({c:'upgradeRadar',track:k}))msg('Radar upgraded','money');break;
    case 'radarSite':if(cmd({c:'buyRadarSite'}))msg('Radar site built','money');break;
    case 'upBat':cmd({c:'upgradeBattery',uid:+k});break;
    case 'upOff':cmd({c:'upgradeOffence',weapon:k,track:b.dataset.t});break;
    case 'eco':if(cmd({c:'upgradeEconomy',track:k}))msg(CAT.economy[k].label+' upgraded','money');break;
    case 'rsinc':case 'rsdec':{const cur=view.me.restock[k]||0,step=DEF[k].load;cmd({c:'setRestock',sys:k,n:a==='rsinc'?cur+step:Math.max(0,cur-step)});}break;
    case 'reload':{const bat=view.me.batteries.find(x=>x.uid===+k);if(bat&&cmd({c:'buyInterceptors',sys:bat.sys,n:DEF[bat.sys].load}))msg(DEF[bat.sys].load+' spare '+DEF[bat.sys].name+' missiles bought','money');}break;
    case 'repair':if(cmd({c:'repairNow',uid:+k}))msg('Repaired','money');break;
    case 'sinc':plan.counts[k]=(plan.counts[k]||0)+1;break;
    case 'sdec':plan.counts[k]=Math.max(0,(plan.counts[k]||0)-1);break;
    case 'sall':{const w=ATK[k],st=view.me.stock[k]||0;plan.counts[k]=w.reusable?st:Math.min(st,view.me.caps[k]||0);}break;
    case 'drawroute':setDraw('route');return;
    case 'clearroute':plan.route=plan.routeU=null;plan.bearing=null;rebuildPlanGfx();break;
    case 'drawscout':setDraw(k);return;
    case 'clearscout':delete plan.scoutPath[k];delete plan.scoutPathU[k];rebuildPlanGfx();break;
    case 'showall':if(k==='def')showAllDef=!showAllDef;else showAllAtk=!showAllAtk;break;
  }
  sheetSig='';refreshUI();
});
$('sheet').addEventListener('change',e=>{const s=e.target.closest('select');if(!s)return;
  if(s.dataset.act==='target')plan.target=s.value===''?null:+s.value;
  sheetSig='';});

function setPlacing(k){placing=k;if(k)$('placing').hidden=false;if(k&&choice!==0){choice=0;}if(k){drawMode=null;$('placeText').innerHTML='Tap a glowing <b>+</b> to deploy <b>'+esc(DEF[k].name)+'</b> · '+fmt(DEF[k].price)+'<br><span class="small">'+esc(DEF[k].role)+(DEF[k].load?' · '+DEF[k].load+' missiles, '+fmt(DEF[k].shot)+' each':'')+'</span>';$('placing').style.borderColor=css(SYS_COL[k]);closeInfo();padMat.color.set(SYS_COL[k]);padBeamMat.color.set(SYS_COL[k]);
    cam.r=Math.max(cam.r,215);cam.phi=Math.min(cam.phi,.8);cam.tx=0;cam.tz=0;}else{padMat.color.set(0x6fe3ff);padBeamMat.color.set(0x6fe3ff);if(!drawMode)$('placing').hidden=true;}sheetSig='';}
$('cancelPlace').onclick=()=>{if(drawMode)setDraw(null);else setPlacing(null);};

function openInfo(uid){
  selected=uid;const v=view,b=v.me.batteries.find(x=>x.uid===uid);if(!b){closeInfo();return;}
  const s=DEF[b.sys],el=$('info'),shop=canShop();el.style.setProperty('--c',css(SYS_COL[b.sys]));
  const hit={};for(const k in s.hit)hit[k]=Math.min(98,s.hit[k]+(b.level-1)*8);
  const reloadCost=s.load?s.shot*s.load:0;
  el.innerHTML='<h3>'+esc(s.name)+'<small>Level '+b.level+'</small></h3><p>'+esc(s.role)+'</p>'+
    '<div class="kv"><span>Range</span><b>'+s.range+' km</b></div>'+(s.load?'<div class="kv"><span>Loaded</span><b>'+b.ammo+' / '+b.load+' · depot '+(v.me.interceptors[b.sys]||0)+'</b></div>':'<div class="kv"><span>Ammunition</span><b>'+(s.kind==='gun'?fmt(s.shot)+' per burst':'none needed')+'</b></div>')+
    vsChips(hit)+'<div class="kv"><span>Kills</span><b>'+b.kills+'</b></div>'+
    '<div class="tabs">'+(shop&&s.load?'<button class="btn" type="button" data-i="reload"'+(v.me.budget<reloadCost?' disabled':'')+'>+1 reload · '+fmt(reloadCost)+'</button>':'')+
    (shop&&b.upgradeCost!=null?'<button class="btn primary" type="button" data-i="up"'+(v.me.budget<b.upgradeCost?' disabled':'')+'>Upgrade · '+fmt(b.upgradeCost)+'</button>':'')+
    '<button class="btn'+(b.holdFire?' danger':'')+'" type="button" data-i="hold">'+(b.holdFire?'Holding fire':'Hold fire')+'</button>'+
    (shop?'<button class="btn danger" type="button" data-i="sell">Sell · +'+fmt(s.price/2)+'</button>':'')+'<button class="btn" type="button" data-i="close">Close</button></div>';
  el.hidden=false;
}
$('info').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b||b.disabled||selected==null)return;const uid=selected,bat=view.me.batteries.find(x=>x.uid===uid);if(!bat)return closeInfo();
  const i=b.dataset.i;
  if(i==='reload'){if(cmd({c:'buyInterceptors',sys:bat.sys,n:DEF[bat.sys].load}))msg('Reload bought','money');}
  else if(i==='up'){if(cmd({c:'upgradeBattery',uid}))msg(DEF[bat.sys].name+' upgraded','money');}
  else if(i==='hold')cmd({c:'holdBattery',uid});
  else if(i==='sell'){if(cmd({c:'sellBattery',uid})){msg(DEF[bat.sys].name+' sold','money');closeInfo();return;}}
  else if(i==='close'){closeInfo();return;}
  openInfo(uid);});
function closeInfo(){selected=null;$('info').hidden=true;}

function ammoHTML(){
  const v=view,m=v.me,g={};
  for(const b of m.batteries){const s=DEF[b.sys];if(!s.load)continue;const e=g[b.sys]||(g[b.sys]={n:0,ammo:0,load:0});e.n++;e.ammo+=b.ammo;e.load+=b.load;}
  const keys=Object.keys(g);
  let h='<div class="lbl">Missiles · loaded / spare</div>';
  if(!keys.length)h+='<div class="small">No missile defences yet</div>';
  for(const k of keys){const e=g[k],sp=m.interceptors[k]||0,cls=e.ammo===0&&sp===0?'empty':e.ammo<e.load||sp<(m.restock[k]||0)?'low':'';
    h+='<div class="arow '+cls+'"><span style="color:'+css(SYS_COL[k])+'">'+esc(DEF[k].name)+(e.n>1?' ×'+e.n:'')+'</span><b>'+e.ammo+'/'+e.load+'</b><b class="sp">+'+sp+'</b></div>';}
  if(keys.length&&canShop()){const c=m.topUpCost||0;h+='<button class="btn primary topup" data-act="topup" type="button"'+(c<=0||m.budget<Math.min(c,0.01)?' disabled':'')+'>'+(c>0?'Top up all · '+fmt(c):'All full')+'</button>';}
  return h;}
function hintHTML(){
  const v=view,m=v.me;if(!v)return '';
  const empty=m.batteries.filter(b=>b.load&&b.ammo+(m.interceptors[b.sys]||0)===0);
  const low=m.batteries.filter(b=>b.load&&b.ammo+(m.interceptors[b.sys]||0)>0&&b.ammo+(m.interceptors[b.sys]||0)<=Math.max(1,b.load/2));
  const ammoWarn=empty.length?'<span class="warn">'+esc(DEF[empty[0].sys].name)+' is out of missiles</span> · Defence → Buy now':low.length?'<span class="warn">'+esc(DEF[low[0].sys].name)+' is low: '+(low[0].ammo+(m.interceptors[low[0].sys]||0))+' left</span>':'';
  const hasAtk=Object.values(m.stock).some(n=>n>0),hasScout=Object.values(m.scouts).some(n=>n>0);
  const ballistic=m.batteries.some(b=>DEF[b.sys].hit.ballistic);
  if(placing)return '<b>NEXT</b> Tap a glowing <b>+</b> in your city';
  if(drawMode)return '<b>NEXT</b> Draw with your finger on the enemy city';
  if(v.phase==='setup'){
    if(!m.batteries.length)return '<b>NEXT</b> Tap <b>Defence</b> and place your first defence';
    if(!Object.values(m.launchers).some(n=>n>0)&&!hasAtk)return '<b>NEXT</b> Tap <b>Attack</b> and buy a launcher, e.g. Shahed-136 drones';
    if(!hasScout)return '<b>NEXT</b> Buy a <b>scout UAV</b> in Attack: it finds their buildings';
    if(!ballistic)return '<b>TIP</b> Nothing in your city can stop ballistic missiles · then press <b>Ready</b>';
    return ammoWarn||'<b>NEXT</b> Press <b>Ready</b> when you are done';
  }
  if(v.phase==='turn'&&v.myTurn){
    if(ammoWarn)return ammoWarn;
    if(planEmpty())return v.enemy.buildings.length===0&&hasScout?'<b>NEXT</b> Tap <b>Quick strike</b>, or Attack → draw your scout\'s path and your route':'<b>NEXT</b> Tap <b>Quick strike</b> or set weapons in Attack, then <b>GO</b>';
    return '<b>READY</b> Press <b>GO</b> to launch'+(plan.bearing!=null?' from the '+compass(plan.bearing):'');
  }
  if(v.phase==='turn')return v.enemy.name+' is planning a strike'+(ammoWarn?' · '+ammoWarn:'');
  if(v.phase==='battle')return v.battle.iDefend?'<b>DEFEND</b> Tap a contact to fire at it first · long-press to ignore it':'Watching your strike on '+esc(v.enemy.name);
  return '';
}
const threatLabel=c=>({drone:'drone',decoy:'decoy',uav:'UAV',rocket:'rocket',cruise:'cruise',ballistic:'ballistic',hypersonic:'hypersonic'}[c]||c);
function compass(b){const deg=(Math.atan2(Math.cos(b),-Math.sin(b))*180/Math.PI+360)%360;return ['north','north-east','east','south-east','south','south-west','west','north-west'][Math.round(deg/45)%8];}
function intelHTML(){
  const v=view,m=v.me,w=[];
  if(v.phase==='setup')return '<b>SETUP</b> · Buy and place defences, buy launchers and weapons, a surveillance UAV helps you find their buildings. Press <b>Ready</b> when done.';
  for(const b of m.batteries){const s=DEF[b.sys];if(s.load&&b.ammo+(m.interceptors[b.sys]||0)===0)w.push(s.name+' has no missiles left.');}
  if(m.buildings.some(b=>b.kind==='factory'&&b.down>0))w.push('Factory down: no new missiles this turn.');
  if(m.buildings.some(b=>b.kind==='power'&&b.down>0))w.push('Power down: lasers and Koral are off.');
  if(m.storage.used>m.storage.safe)w.push((m.storage.used-m.storage.safe)+' items sit unprotected above ground.');
  if(v.weatherBad&&m.batteries.some(b=>b.sys==='ironbeam'))w.push('Bad weather: Iron Beam at half strength.');
  return '<b>TURN '+v.turnNo+'</b> · +'+fmt(m.income)+' income · '+v.enemy.buildings.length+' enemy buildings known'+(w.length?'<br><span class="warn">'+w.join(' ')+'</span>':'<br><span class="ok">Plan a strike in the Strike tab and press GO, or Wait to save money.</span>');
}

function refreshUI(){
  const v=view,plan_=canShop();
  $('intel').hidden=true;
  const hint=v&&v.phase!=='over'&&v.phase!=='report'?hintHTML():'';$('hint').hidden=!hint;if(hint&&$('hint').innerHTML!==hint)$('hint').innerHTML=hint;
  $('quickBtn').hidden=!myTurn();
  const showAmmo=v&&v.phase!=='over'&&v.me.batteries.some(b=>DEF[b.sys].load);$('ammoBox').hidden=!showAmmo;
  if(showAmmo){const a=ammoHTML();if($('ammoBox').dataset.h!==a){$('ammoBox').dataset.h=a;$('ammoBox').innerHTML=a;}
    const tl=document.querySelector('.tl').getBoundingClientRect();$('ammoBox').style.top=(tl.bottom+6)+'px';}
  $('tabs').hidden=!plan_;$('actions').hidden=!plan_;
  $('waitBtn').hidden=!myTurn();
  if(v&&v.phase==='setup'){$('endBtn').textContent=v.me.ready?'Waiting…':'Ready';$('endBtn').disabled=v.me.ready;$('endBtn').className='btn primary';}
  else{$('endBtn').textContent='GO';$('endBtn').disabled=false;$('endBtn').className='btn go';}
  for(const t of document.querySelectorAll('.tab'))t.classList.toggle('on',t.dataset.tab===tab);
  $('status').hidden=!(v&&v.phase==='battle');
  const S=SIDES[0];if(S.padRings&&v){const taken=new Set(v.me.batteries.map(b=>b.pad));for(const id in S.padRings)S.padRings[id].visible=!!placing&&!taken.has(+id)&&viewSide===0;}
  $('cityBtn').textContent=choice?'My city':'Enemy city';$('cityTab').textContent=choice?'My city':'Enemy city';$('cityTab').classList.toggle('primary',!!choice);
  renderSheet();updHud();
}

/* ======================= INPUT ======================= */
const cam={theta:0.7,phi:1.05,r:160,tx:0,tz:0};
let pmid=null;
const midPt=()=>{const p=[...ptrs.values()];return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};};
// Two-finger drag slides the map: move the look-at point along the ground, in screen directions.
function pan(dx,dy){ // finger right → map follows right; finger down → map follows down (see further out)
  const k=cam.r/innerHeight*1.2,c=Math.cos(cam.theta),sn=Math.sin(cam.theta),fk=k/Math.max(.45,Math.cos(cam.phi*0.7));
  cam.tx+=-c*dx*k-sn*dy*fk;cam.tz+=sn*dx*k-c*dy*fk;
  const r=Math.hypot(cam.tx,cam.tz),max=160;if(r>max){cam.tx*=max/r;cam.tz*=max/r;}}
const ptrs=new Map();let downX=0,downY=0,dragged=false,pinch=0,pressT=null;
const pinchDist=()=>{const p=[...ptrs.values()];return Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1;};
cv.addEventListener('pointerdown',e=>{initAudio();try{cv.setPointerCapture(e.pointerId);}catch(_){}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(drawMode&&ptrs.size===1){drawPts=null;drawAdd(e.clientX,e.clientY);dragged=true;return;}
  if(ptrs.size===1){downX=e.clientX;downY=e.clientY;dragged=false;clearTimeout(pressT);pressT=setTimeout(()=>{if(!dragged&&ptrs.size===1){dragged=true;longPress(downX,downY);}},520);}
  if(ptrs.size===2){pinch=pinchDist();pmid=midPt();dragged=true;clearTimeout(pressT);}});
cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(drawMode&&drawPts&&ptrs.size===1){drawAdd(e.clientX,e.clientY);rebuildPlanGfx();return;}
  if(ptrs.size===1){if(Math.hypot(e.clientX-downX,e.clientY-downY)>8){dragged=true;clearTimeout(pressT);}if(dragged){if(e.shiftKey||(e.buttons&2))pan(dx,dy);else{cam.theta-=dx*0.006;cam.phi=Math.min(1.42,Math.max(0.42,cam.phi-dy*0.005));}}}
  else if(ptrs.size===2){const d=pinchDist();cam.r=Math.min(380,Math.max(40,cam.r*pinch/d));pinch=d;const mp=midPt();if(pmid)pan(mp.x-pmid.x,mp.y-pmid.y);pmid=mp;}});
function up(e){clearTimeout(pressT);pmid=null;if(drawMode&&drawPts&&ptrs.size===1&&e.type==='pointerup'){ptrs.delete(e.pointerId);finishDraw();return;}if(ptrs.has(e.pointerId)&&ptrs.size===1&&!dragged&&e.type==='pointerup')tap(e.clientX,e.clientY);ptrs.delete(e.pointerId);}
cv.addEventListener('contextmenu',e=>e.preventDefault());cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{e.preventDefault();cam.r=Math.min(380,Math.max(40,cam.r*(1+e.deltaY*0.001)));},{passive:false});
function project(p){_c.copy(p).project(camera);return _c.z<1&&_c.z>-1?{x:(_c.x*.5+.5)*innerWidth,y:(-_c.y*.5+.5)*innerHeight}:null;}
function nearestThreat(x,y){let best=null,bd=56;for(const [uid,tv] of TV){const s=project(tv.pos);if(!s)continue;const d=Math.hypot(s.x-x,s.y-y);if(d<bd){bd=d;best=uid;}}return best;}
function placeAt(padId){const k=placing;if(!k)return;if(cmd({c:'buyBattery',sys:k,pad:padId})){msg(DEF[k].name+' deployed · −'+fmt(DEF[k].price),'money');setPlacing(null);refreshUI();}}
function tap(x,y){
  if(!view)return;
  if(placing&&canShop()&&viewSide===0){const taken=new Set(view.me.batteries.map(b=>b.pad));let best=null,bd=46;
    for(const p of PADS){if(taken.has(p.id))continue;const s=project(_b.set(p.x,1,p.z));if(!s)continue;const d=Math.hypot(s.x-x,s.y-y);if(d<bd){bd=d;best=p;}}
    if(!best){msg('Tap one of the glowing + rings in your city','');return;}
    placeAt(best.id);return;}
  if(drawMode)return;
  if(view.phase==='battle'&&view.battle.iDefend){const uid=nearestThreat(x,y);if(uid!=null){const t=view.battle.threats.find(q=>q.uid===uid);if(cmd({c:'priority',uid}))msg(t&&t.priority?'Priority cleared':'Priority target · batteries engage it first','good');return;}}
  if(viewSide===0){let best=null,bd=44;for(const id in SIDES[0].bats){const b=SIDES[0].bats[id];const s=project(_b.copy(b.pos).setY(2));if(!s)continue;const d=Math.hypot(s.x-x,s.y-y);if(d<bd){bd=d;best=+id;}}
    if(best!=null){openInfo(best);return;}}
  if(selected!=null)closeInfo();
}
function longPress(x,y){
  if(!view||view.phase!=='battle'||!view.battle.iDefend)return;
  const uid=nearestThreat(x,y);if(uid==null)return;const t=view.battle.threats.find(q=>q.uid===uid);
  if(cmd({c:'holdThreat',uid}))msg(t&&t.hold?'Firing allowed again':'Holding fire on that contact','warn');
}

/* ======================= RADAR & HUD ======================= */
const rc=$('radar'),rx=rc.getContext('2d');
function drawRadar(){
  const S=rc.width,C=S/2,R=C-6;rx.clearRect(0,0,S,S);
  rx.fillStyle='rgba(4,12,18,.92)';rx.beginPath();rx.arc(C,C,R,0,TAU);rx.fill();
  rx.strokeStyle='rgba(111,227,255,.16)';rx.lineWidth=1;for(const f of [.25,.5,.75,1]){rx.beginPath();rx.arc(C,C,R*f,0,TAU);rx.stroke();}
  const sw=T*2.2;rx.save();rx.translate(C,C);
  if(rx.createConicGradient){const g=rx.createConicGradient(sw-0.9,0,0);g.addColorStop(0,'rgba(111,227,255,0)');g.addColorStop(0.14,'rgba(111,227,255,.26)');g.addColorStop(0.145,'rgba(111,227,255,0)');rx.fillStyle=g;rx.beginPath();rx.arc(0,0,R,0,TAU);rx.fill();}
  rx.strokeStyle='rgba(111,227,255,.7)';rx.beginPath();rx.moveTo(0,0);rx.lineTo(Math.cos(sw)*R,Math.sin(sw)*R);rx.stroke();rx.restore();
  if(!view)return;
  const b=view.battle,inBattle=b&&view.phase==='battle';
  const range=inBattle&&!b.iDefend?300:Math.max(20,view.me.radarRange);
  $('radarLbl').textContent=(inBattle&&!b.iDefend?'Strike view':'Radar')+' · '+Math.round(range)+' km';
  const ct=Math.cos(cam.theta),st=Math.sin(cam.theta),sc=R/range,map=(x,z)=>[C+(x*ct-z*st)*sc,C+(x*st+z*ct)*sc];
  rx.fillStyle='rgba(255,200,120,.14)';rx.beginPath();rx.arc(C,C,Math.max(3,6*sc),0,TAU);rx.fill();
  const S0=SIDES[viewSide];if(S0.bats)for(const id in S0.bats){const bb=S0.bats[id];const [a,c]=map(bb.pos.x/U,bb.pos.z/U);rx.fillStyle=css(SYS_COL[bb.sys]);rx.fillRect(a-1.5,c-1.5,3,3);}
  if(inBattle){for(const t of b.threats){const d=Math.hypot(t.x,t.z);if(d>range*1.02)continue;const [a,c]=map(t.x,t.z);const k=threatShown(t);rx.fillStyle=k?CLS_CSS[k]:CLS_CSS.unk;rx.beginPath();rx.arc(a,c,k==='drone'?1.6:2.8,0,TAU);rx.fill();}
    rx.fillStyle='#d6e8ee';for(const i of b.interceptors){const [a,c]=map(i.x,i.z);rx.fillRect(a-1,c-1,2,2);}}
}
const padMarks={},ammoTags={};
function markEl(pool,id,cls){let el=pool[id];if(!el){el=document.createElement('div');el.className=cls;$('tags').appendChild(el);pool[id]=el;}return el;}
let dockLeft=1e9;
function behindDock(sx){return document.body.classList.contains('sheet-open')&&sx>dockLeft-10;}
function updMarkers(){
  dockLeft=document.body.classList.contains('sheet-open')?$('dock').getBoundingClientRect().left:1e9;
  const v=view,show=v&&placing&&viewSide===0&&canShop();
  const taken=v?new Set(v.me.batteries.map(b=>b.pad)):new Set();
  for(const p of PADS){const el=markEl(padMarks,p.id,'padmark');
    if(!show||taken.has(p.id)){el.hidden=true;continue;}const s=project(_b.set(p.x,6,p.z));if(!s){el.hidden=true;continue;}
    if(!el.onclick)el.onclick=()=>placeAt(p.id);
    el.hidden=false;el.textContent='+';el.style.transform='translate('+s.x.toFixed(0)+'px,'+s.y.toFixed(0)+'px)';el.style.setProperty('--c',css(SYS_COL[placing]||0x6fe3ff));}
  const showA=v&&viewSide===0&&v.phase!=='over';const seen=new Set();
  if(showA)for(const b of v.me.batteries){seen.add(b.uid);const vb=SIDES[0].bats&&SIDES[0].bats[b.uid];const el=markEl(ammoTags,b.uid,'ammo');if(!vb){el.hidden=true;continue;}
    const s=project(_b.copy(vb.pos).setY(vb.muzzle.y+5));if(!s){el.hidden=true;continue;}
    const spare=v.me.interceptors[b.sys]||0;
    const txt=b.load?(b.reloading>0?'reloading':b.ammo+'/'+b.load+(spare?' +'+spare:'')):'';
    if(!txt||behindDock(s.x)){el.hidden=true;continue;}
    el.hidden=false;el.textContent=txt;el.className='ammo'+(b.load&&b.ammo===0&&!spare?' empty':b.load&&b.ammo<=Math.max(1,b.load/4)?' low':'');
    el.style.transform='translate('+s.x.toFixed(0)+'px,'+s.y.toFixed(0)+'px)';}
  for(const id in ammoTags)if(!seen.has(+id))ammoTags[id].hidden=true;
}
function updTags(){
  updMarkers();
  for(const [uid,tv] of TV){const t=tv.data;if(!t){tv.tag.hidden=true;continue;}
    const s=project(tv.pos);if(!s){tv.tag.hidden=true;continue;}
    tv.tag.hidden=false;tv.tag.style.transform='translate('+s.x.toFixed(1)+'px,'+s.y.toFixed(1)+'px)';
    const k=threatShown(t),cls=k?CLS_TAG[k]:'unk';
    let txt=t.scout?'SCOUT UAV':t.decoy?'DECOY':!t.cls?'UNKNOWN':k==='drone'?'':t.name.toUpperCase();
    if(t.engaged&&txt)txt+=' · ENG';if(t.priority)txt+=(txt?' · ':'')+'PRIORITY';if(t.hold)txt+=(txt?' · ':'')+'HOLD';
    const key=cls+t.engaged+t.priority+t.hold+txt;
    if(key!==tv.key){tv.key=key;tv.tag.className='tag '+cls+(t.engaged?' eng':'')+(t.priority?' prio':'')+(t.hold?' hold':'');tv.span.textContent=txt;}
  }
  const S=SIDES[viewSide],showL=view&&view.phase!=='over'&&(!document.body.classList.contains('sheet-open')||tab==='city');const placed=[];
  if(S.crit)for(const id in S.crit){const c=S.crit[id];if(!showL){c.el.hidden=true;continue;}const s=project(_a.set(c.x,22,c.z));if(!s){c.el.hidden=true;continue;}
    if(behindDock(s.x)||placed.some(r=>Math.abs(r.x-s.x)<130&&Math.abs(r.y-s.y)<20)){c.el.hidden=true;continue;}placed.push(s);
    c.el.hidden=false;c.el.style.transform='translate('+s.x.toFixed(0)+'px,'+s.y.toFixed(0)+'px)';c.el.classList.toggle('dead',c.down);
    const html=esc(c.txt)+(c.revealed?'<span class="eye">◉</span>':'');if(c.el.innerHTML!==html)c.el.innerHTML=html;}
}
function updHud(){
  const v=view;if(!v)return;const m=v.me;
  $('pname').textContent=m.name.toUpperCase();$('turnNo').textContent=v.turnNo?'Turn '+v.turnNo:'';
  $('role').textContent=v.phase==='setup'?'Setup':v.phase==='battle'?(v.battle.iDefend?'Under attack':'Striking '+v.enemy.name):v.phase==='turn'?(v.myTurn?'Your turn':v.enemy.name+"'s turn"):v.phase==='report'?'Strike report':'Match over';
  $('budget').textContent=fmt(m.budget);$('income').textContent='+'+fmt(m.income)+'/turn';
  let intc=0;for(const b of m.batteries)if(b.load)intc+=b.ammo;for(const k in m.interceptors)intc+=m.interceptors[k];
  let atk=0;for(const k in m.stock)atk+=m.stock[k];for(const k in m.scouts)atk+=m.scouts[k];
  $('arsDef').textContent=intc;$('arsAtk').textContent=atk;
  $('hp').textContent=Math.round(m.health);const hb=$('hpBar');hb.style.width=Math.max(0,m.health/10)+'%';hb.classList.toggle('low',m.health<400);
  $('oppName').textContent=v.enemy.name;$('ohp').textContent=Math.round(v.enemy.health);$('ohpBar').style.width=Math.max(0,v.enemy.health/10)+'%';
  const showClock=v.phase==='setup'||v.phase==='turn'||v.phase==='report';
  $('phaseName').textContent=v.phase==='setup'?'SETUP':v.phase==='turn'?(v.myTurn?'YOUR TURN':'ENEMY TURN'):v.phase==='battle'?(v.battle.iDefend?'DEFEND':'STRIKE'):v.phase==='report'?'NEXT TURN':'OVER';
  $('clock').textContent=showClock?v.secondsLeft:(v.battle?Math.round(v.battle.time)+'s':'');$('clock').classList.toggle('low',showClock&&v.secondsLeft<=10&&v.phase!=='report');
  $('phaseName2').textContent=$('phaseName').textContent;$('clock2').textContent=$('clock').textContent;document.querySelector('.tclock').classList.toggle('low',showClock&&v.secondsLeft<=10&&v.phase!=='report');
  $('phaseSub').textContent=v.phase==='turn'&&!v.myTurn?'planning':v.weatherBad&&v.phase==='turn'?'bad weather':'';
  if(v.phase==='battle'){const b=v.battle;let ld=0;for(const bb of m.batteries)if(bb.load)ld+=bb.ammo;
    $('status').innerHTML='<span>Contacts</span> '+b.threats.length+' <span>Stopped</span> '+b.stats.stopped+' <span>Hits</span> '+b.stats.hits+(b.iDefend?' <span>Loaded</span> '+ld+' <span>Reloads</span> '+m.reloadsLeft+' <span>Budget</span> '+fmt(m.budget)+' <button class="chip '+(m.autoFire?'on':'bad')+'" id="autoBtn" type="button">Auto-fire '+(m.autoFire?'on':'off')+'</button>':' <span>Damage</span> '+Math.round(b.stats.damage));}
}
$('ammoBox').addEventListener('click',e=>{if(e.target.closest('[data-act=topup]')&&view){const c=view.me.topUpCost;if(cmd({c:'topUp'}))msg('Topped up · '+fmt(c),'money');refreshUI();}});
$('status').addEventListener('click',e=>{if(e.target.id==='autoBtn'&&view)cmd({c:'setAutoFire',on:!view.me.autoFire});});

/* ======================= LOOP ======================= */
function resize(){
  renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  const s=innerHeight*PR*0.5/Math.tan(camera.fov*Math.PI/360);pScale=s;for(const m of psMats)m.uniforms.scale.value=s;
}
addEventListener('resize',resize);resize();
cam.r=innerWidth<innerHeight?230:160;
buildCity(SIDES[0],0);showSide(0);SIDES[0].root.visible=true;
let last=performance.now(),hudT=0;
const dummy=new THREE.Object3D();
function frame(now){
  requestAnimationFrame(frame);
  const real=Math.max(0,Math.min(0.25,(now-last)/1000));last=Math.max(last,now); // rAF times can lag performance.now()
  // Adaptive quality: if frames take longer than ~22 ms, thin out particles and soften shadows; recover when smooth.
  frameMs=frameMs*.92+real*1000*.08;
  if(frameMs>24&&quality>.35){quality=Math.max(.35,quality-.02);if(quality<.7&&sun.shadow.mapSize.x>1024){sun.shadow.mapSize.set(1024,1024);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}}
  else if(frameMs<17&&quality<1)quality=Math.min(1,quality+.005);
  step(real,true);
}
function step(real,draw){
  const dt=Math.min(0.05,real);T+=dt;
  if(running){
    ADD.tick(real); // the game clock follows real time even if frames drop
    view=ADD.viewRaw();
    const want=wantedSide();if(want!==viewSide||!SIDES[viewSide].root.visible)showSide(want);
    syncCity(SIDES[0],true);syncCity(SIDES[1],false);
    syncBattle();handleEvents(ADD.eventsRaw());
    onPhase();
    sheetT-=dt;if(sheetT<=0){sheetT=.3;refreshUI();}
  }else cam.theta+=dt*0.05;
  const S=SIDES[viewSide];
  if(S.bats)for(const id in S.bats){const b=S.bats[id];if(b.pulse){b.pT+=dt;const k=(b.pT%2)/2;b.pulse.scale.setScalar(.5+k*RAD(DEF[b.sys].range)*.35);b.pulse.material.opacity=(1-k)*.35;}
    if(b.sys==='koral'&&b.tur)b.tur.rotation.y+=dt*2;if(b.beam&&b.beamT>0){b.beamT-=dt;if(b.beamT<=0)b.beam.visible=false;}
    const sel=selected===+id&&viewSide===0;if(b.showT>0)b.showT-=dt;b.ring.visible=sel||b.showT>0;}
  if(placing&&viewSide===0&&S.padRings){const k=1+Math.sin(T*6)*.18;for(const id in S.padRings)S.padRings[id].children[0].scale.setScalar(k);padBeamMat.opacity=.16+Math.sin(T*6)*.08;}
  if(S.crit)for(const id in S.crit){const c=S.crit[id];if(c.spin&&!c.down)c.spin.rotation.y+=dt*1.6;if(c.stack&&!c.down&&rand()<.35)for(const p of c.stack){const q=_a.copy(p).add(c.g.position);emit(SMOKE,q.x,q.y,q.z,(rand()-.5)+.8,2+rand(),(rand()-.5),4+rand()*2,2,9,.92,.92,.94,.35,.1,-.2);}}
  planGfx.visible=viewSide===1&&!!view&&(myTurn()||!!drawMode||(view.phase==='battle'&&!view.battle.iDefend));
  if(S.cars){const cm=S.carMesh;S.cars.forEach((c,i)=>{c.s+=c.v*dt;if(c.s>c.len/2)c.s=-c.len/2;if(c.s<-c.len/2)c.s=c.len/2;
    const x=c.ax?c.s:c.off,z=c.ax?c.off:c.s;dummy.position.set(x,.45,z);dummy.rotation.set(0,c.ax?Math.PI/2:0,0);dummy.scale.setScalar(wdist(x,z)<9?0:1);dummy.updateMatrix();cm.setMatrixAt(i,dummy.matrix);});cm.instanceMatrix.needsUpdate=true;}
  for(const L of flashes)L.intensity*=Math.exp(-dt*7);
  if(S.fires)for(const f of S.fires){if(f.t<=0)continue;f.t-=dt;const k=Math.min(1,f.t/6);
    if(rand()<.7*k)emit(GLOW,f.x+(rand()-.5)*f.w,f.y,f.z+(rand()-.5)*f.w,(rand()-.5),3+rand()*3,(rand()-.5),.6+rand()*.4,2.2,.6,1,.45+rand()*.2,.12,.9,0,0);
    if(rand()<.28*k){const c=.12+rand()*.06;emit(SMOKE,f.x,f.y+1,f.z,(rand()-.5)*1.5+1.2,4+rand()*2,(rand()-.5)*1.5,5+rand()*2,3,18,c,c,c,.6,.15,0);}}
  updPS(SMOKE,dt);updPS(GLOW,dt);
  const sp=Math.sin(cam.phi);
  camera.position.set(cam.tx+cam.r*sp*Math.sin(cam.theta),8+cam.r*Math.cos(cam.phi),cam.tz+cam.r*sp*Math.cos(cam.theta));
  camera.lookAt(cam.tx,10,cam.tz);
  if(shake>0.01){camera.position.x+=(rand()-.5)*shake;camera.position.y+=(rand()-.5)*shake;shake*=Math.exp(-dt*5);}
  if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)msgEl.classList.remove('show');}
  if(bannerTimer>0){bannerTimer-=dt;if(bannerTimer<=0)$('banner').classList.remove('show');}
  hudT-=dt;if(hudT<=0){hudT=0.15;updHud();}
  if(!draw)return;
  renderer.render(scene,camera);
  updTags();drawRadar();
}
// Test hook: advance the game by `sec` seconds in 50 ms steps, drawing only the last step.
window.__padXY=id=>{const p=PADS.find(q=>q.id===id);return p&&project(_b.set(p.x,1,p.z));};
window.__advance=sec=>{const n=Math.max(1,Math.round(sec/0.05));for(let i=0;i<n;i++)step(0.05,i===n-1);return view&&{phase:view.phase,turn:view.turnNo,me:view.me.health,foe:view.enemy.health};};
requestAnimationFrame(frame);
if(/[?&]demo=1/.test(location.search)){$('nameIn').value='Demo';startGame(true);}
})();
