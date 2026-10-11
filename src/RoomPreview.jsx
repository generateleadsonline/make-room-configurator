import React, {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {DOORS,FLOORS,finish,normalizeConfig} from './catalog.js';
import './RoomPreview.css';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const material=(colour,extra={})=>new THREE.MeshStandardMaterial({color:colour,roughness:.8,...extra});
function seeded(seed=8){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function canvasTexture(colour,kind='wood'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
  const ctx=canvas.getContext('2d'),random=seeded(78),base=new THREE.Color(colour);
  ctx.fillStyle=colour;ctx.fillRect(0,0,256,512);
  if(kind==='grass'){
    for(let i=0;i<19000;i++){const x=random()*256,y=random()*512;ctx.strokeStyle=random()>.5?'rgba(207,217,158,.23)':'rgba(38,67,34,.19)';ctx.lineWidth=.5+random();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*3-1.5,y-random()*5);ctx.stroke();}
  }else if(kind==='paint'){
    for(let i=0;i<4000;i++){ctx.fillStyle=random()>.5?'rgba(255,255,255,.035)':'rgba(0,0,0,.045)';ctx.fillRect(random()*256,random()*512,1,1);}
  }else{
    for(let i=0;i<1900;i++){const x=random()*256,y=random()*512,h=5+random()*120;ctx.strokeStyle=random()>.46?'rgba(46,26,9,.16)':'rgba(255,241,204,.1)';ctx.lineWidth=.25+random()*.75;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+random()*5,y+h/3,x+random()*6-3,y+h*2/3,x+random()*4-2,y+h);ctx.stroke();}
    for(let i=0;i<5;i++){const x=random()*256,y=random()*512;ctx.strokeStyle='rgba(45,26,13,.08)';ctx.lineWidth=1;for(let ring=0;ring<4;ring++){ctx.beginPath();ctx.ellipse(x,y,3+ring*2,7+ring*4,.15,0,Math.PI*2);ctx.stroke();}}
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
  return map;
}
function box(parent,w,h,d,x,y,z,mat,shadow=true){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.001,w),Math.max(.001,h),Math.max(.001,d)),mat);mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,radius,height,x,y,z,mat,topRadius=radius,segments=18){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(topRadius,radius,height,segments),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function sphere(parent,radius,x,y,z,mat,scale=[1,1,1]){const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),mat);mesh.position.set(x,y,z);mesh.scale.set(...scale);mesh.castShadow=true;parent.add(mesh);return mesh;}
function dispose(group){const gs=new Set(),ms=new Set(),ts=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){ms.add(m);for(const value of Object.values(m))if(value?.isTexture)ts.add(value);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}

function plant(parent,x,z,size=.65){
  const pot=material('#9b8b70'),leaf=material('#597852',{roughness:.93}),leaf2=material('#759365');
  cylinder(parent,size*.16,size*.35,x,size*.18,z,pot,size*.2);
  const random=seeded(Math.floor((x+25)*45+z*10));
  for(let i=0;i<13;i++){const a=i*2.4,r=(.05+random()*.19)*size,h=(.35+random()*.55)*size;const stem=new THREE.Mesh(new THREE.CylinderGeometry(.006,.007,h,5),material('#586c41'));stem.position.set(x+Math.cos(a)*r,h/2+size*.3,z+Math.sin(a)*r);stem.rotation.z=(random()-.5)*.45;parent.add(stem);sphere(parent,.105*size,x+Math.cos(a)*r,h+size*.28,z+Math.sin(a)*r,i%2?leaf:leaf2,[1.4,.24,.65]);}
}
function leafTexture(){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');const gradient=ctx.createLinearGradient(25,20,103,110);gradient.addColorStop(0,'#a7b594');gradient.addColorStop(1,'#435d38');ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(64,6);ctx.bezierCurveTo(14,43,19,88,64,122);ctx.bezierCurveTo(107,85,117,42,64,6);ctx.fill();ctx.strokeStyle='rgba(202,216,177,.55)';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(64,15);ctx.lineTo(64,118);ctx.stroke();for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(64,28+i*16);ctx.lineTo(38,43+i*14);ctx.moveTo(64,28+i*16);ctx.lineTo(90,43+i*14);ctx.stroke();}const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;}
function leafCloud(parent,count,positions,random){const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(.16,.22),material('#ffffff',{map:leafTexture(),alphaTest:.48,side:THREE.DoubleSide,roughness:1}),count),dummy=new THREE.Object3D();for(let i=0;i<count;i++){const p=positions(i);dummy.position.set(...p);dummy.rotation.set(random()*Math.PI,random()*Math.PI*2,random()*Math.PI);const s=.60+random()*.75;dummy.scale.set(s,s,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(['#b2c099','#95ad80','#789468','#657d52'][i%4]));}mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function foliage(parent,x,z,height=3){
  const tree=new THREE.Group();tree.position.set(x,0,z);parent.add(tree);
  const bark=material('#817968'),random=seeded(Math.floor((x+30)*23+z*34));
  cylinder(tree,.075,height*.7,0,height*.35,0,bark,.043,10);
  for(let i=0;i<8;i++){const branch=new THREE.Mesh(new THREE.CylinderGeometry(.012,.025,height*.43,8),bark);const angle=i*2.4;branch.position.set(Math.cos(angle)*.22,height*.65,Math.sin(angle)*.22);branch.rotation.z=Math.cos(angle)*.65;branch.rotation.x=Math.sin(angle)*.65;tree.add(branch);}
  leafCloud(tree,1450,()=>{const angle=random()*Math.PI*2,y=.44+random()*.56,crown=Math.sin((y-.37)*Math.PI*.98),radius=Math.sqrt(random())*.67*crown;return[Math.cos(angle)*radius,height*y,Math.sin(angle)*radius];},random);
}
function hedge(parent,w,d){
  const leaves=['#4f674b','#5c7653','#6f885b'].map(c=>material(c,{roughness:1}));
  const z=-d/2-1.5,len=w+3,random=seeded(21);
  box(parent,len,.55,.6,0,.28,z,leaves[0]);
  leafCloud(parent,Math.ceil(len*160),()=>[-len/2+random()*len,.30+random()*.60,z+(random()-.5)*.70],random);
  const fence=material('#c0beb0',{roughness:.9});
  box(parent,len+1.5,1.55,.08,0,.79,z-.6,fence);
  for(let x=-(len+1.5)/2;x<(len+1.5)/2;x+=.2)box(parent,.006,1.55,.004,x,.79,z-.55,material('#aaa99b'),false);
  for(let x=-(len+1.5)/2;x<=(len+1.5)/2;x+=2.1)box(parent,.085,1.65,.12,x,.81,z-.58,material('#a8aa9c'));
}

function furniture(parent,c,w,d){
  const g=new THREE.Group();parent.add(g);const floor=.24;
  const black=material('#303632',{roughness:.5}),wood=material('#c4a477',{map:canvasTexture('#b79a70'),roughness:.65}),cream=material('#dad8c9'),fabric=material('#8e9e89',{roughness:1});
  const iw=w-.38,id=d-.38;
  if(c.use==='office'){
    const deskW=Math.min(1.42,iw*.75),deskD=Math.min(.62,id*.30),x=-iw/2+deskW/2+.10,z=-id/2+deskD/2+.15;
    box(g,deskW,.06,deskD,x,floor+.76,z,wood);for(const dx of[-deskW/2+.07,deskW/2-.07])for(const dz of[-deskD/2+.055,deskD/2-.055])box(g,.035,.75,.035,x+dx,floor+.375,z+dz,black);
    box(g,.55,.32,.032,x+.12,floor+.98,z-.09,black);box(g,.50,.27,.006,x+.12,floor+.99,z-.068,material('#344647',{metalness:.18,roughness:.3}));box(g,.035,.10,.035,x+.12,floor+.8,z-.09,black);box(g,.19,.018,.12,x+.12,floor+.78,z-.08,black);
    box(g,.34,.014,.12,x+.1,floor+.798,z+.19,material('#a2a7a0'));box(g,.21,.026,.27,x-deskW*.25,floor+.8,z+.02,cream);
    const chairZ=Math.min(z+.69,id/2-.36);cylinder(g,.12,.48,x+.12,floor+.24,chairZ,black);box(g,.43,.1,.44,x+.12,floor+.49,chairZ,black);box(g,.43,.48,.07,x+.12,floor+.74,chairZ+.19,fabric);for(let i=0;i<5;i++){const a=i*Math.PI*.4;box(g,.055,.055,.50,x+.12,floor+.05,chairZ,black).rotation.y=a;}
    if(w>3.2){const sofaX=iw/2-.49;box(g,.77,.18,1.35,sofaX,floor+.21,-.12,fabric);box(g,.72,.21,1.2,sofaX,floor+.42,-.12,cream);box(g,.15,.55,1.38,sofaX+.33,floor+.53,-.12,fabric);box(g,.77,.38,.14,sofaX,floor+.50,-.80,fabric);box(g,.77,.38,.14,sofaX,floor+.50,.56,fabric);cylinder(g,.30,.43,sofaX-.75,floor+.22,.10,wood,.32);}
    plant(g,iw/2-.26,-id/2+.33,.83);
  }else if(c.use==='gym'){
    const x=-iw*.18,z=-id*.04;box(g,.76,.06,Math.min(1.6,id*.72),x,floor+.03,z,material('#68796d'));box(g,.59,.05,1.04,x,floor+.12,z,black);box(g,.055,.95,.055,x-.30,floor+.57,z-.45,black);box(g,.055,.95,.055,x+.30,floor+.57,z-.45,black);box(g,.69,.45,.065,x,floor+.9,z-.45,black);box(g,.6,.06,.14,x,floor+.67,z+.27,black);for(const xx of[-.31,.31]){sphere(g,.15,x+xx,floor+.16,z+.50,black,[1,.7,1]);}
    const mirror=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.3,iw*.6),1.55),new THREE.MeshStandardMaterial({color:'#aab7b0',metalness:.65,roughness:.12}));mirror.position.set(iw*.15,1.38,-d/2+.13);g.add(mirror);plant(g,iw/2-.24,-id/2+.24,.9);
    cylinder(g,.09,.055,iw/2-.42,floor+.04,id/2-.65,black);cylinder(g,.09,.055,iw/2-.70,floor+.04,id/2-.65,black);
  }else{
    const sofaW=Math.min(1.8,iw-.22),sofaD=Math.min(.73,id*.38),z=-id/2+sofaD/2+.1;
    box(g,sofaW,.20,sofaD,0,floor+.21,z,fabric);box(g,sofaW-.12,.19,sofaD-.09,0,floor+.40,z+.015,cream);box(g,sofaW,.47,.12,0,floor+.60,z-sofaD/2+.04,fabric);for(const x of[-sofaW/2+.06,sofaW/2-.06])box(g,.13,.41,sofaD,x,floor+.52,z,fabric);
    for(const x of[-sofaW*.25,sofaW*.25])box(g,.32,.30,.09,x,floor+.61,z-.20,material(x<0?'#aa967d':'#b8c1ad'));
    if(id>2)cylinder(g,.42,.34,0,floor+.17,z+1.08,wood,.40);
    const rugMap=canvasTexture('#b5b8a5','wood');rugMap.repeat.set(3,2);box(g,Math.min(1.75,iw*.8),.012,Math.min(1.2,id*.5),0,floor+.006,.25,material('#e0ded0',{map:rugMap,roughness:1}));
    plant(g,iw/2-.28,-id/2+.29,.88);
    if(c.use==='studio'&&w>3){const x=-iw/2+.38;box(g,.54,.055,.38,x,floor+.78,.25,wood);for(const dx of[-.20,.20])box(g,.04,.78,.04,x+dx,floor+.39,.25,black);box(g,.31,.43,.025,x,floor+1.06,.2,material('#e8e2c9'));box(g,.20,.20,.003,x,floor+1.09,.218,material('#9caa8e'));}
  }
  // A pair of modest prints add scale without implying a package inclusion.
  if(w>2.5)for(const x of[-.31,.31]){box(g,.45,.55,.025,x,1.52,-d/2+.125,wood,false);box(g,.39,.49,.01,x,1.52,-d/2+.143,cream,false);box(g,.20,.22,.003,x,1.51,-d/2+.15,material(x<0?'#8b9f7a':'#bda789'),false);}
}

function label(parent,text,x,y,z,size=.36){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=144;const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(251,253,247,.97)';ctx.beginPath();ctx.roundRect(6,10,500,124,58);ctx.fill();ctx.strokeStyle='rgba(100,122,92,.2)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#3e5440';ctx.font='600 52px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,73);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,depthWrite:false}));sprite.position.set(x,y,z);sprite.scale.set(size*3.55,size,1);sprite.renderOrder=20;parent.add(sprite);return sprite;
}
function line(parent,points,colour='#7f9276'){const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:colour,transparent:true,opacity:.7,depthTest:false}));parent.add(mesh);return mesh;}
function dimensions(w,d){
  const group=new THREE.Group(),y=.255,z=d/2+.55,x=w/2+.58;
  line(group,[[-w/2,y,z],[w/2,y,z]]);for(const xx of[-w/2,w/2])line(group,[[xx,y,z-.13],[xx,y,z+.13]]);label(group,`${w} m`,0,y+.035,z,.28);
  line(group,[[x,y,-d/2],[x,y,d/2]]);for(const zz of[-d/2,d/2])line(group,[[x-.13,y,zz],[x+.13,y,zz]]);label(group,`${d} m`,x,y+.035,0,.28);
  return group;
}

function buildRoom(input){
  const c=normalizeConfig(input),w=c.width,d=c.depth,h=2.5,group=new THREE.Group(),structure=new THREE.Group(),roof=new THREE.Group(),landscape=new THREE.Group();group.add(landscape,structure,roof);
  const timber=c.cladding==='cedar'?'#bc7d43':c.cladding==='thermowood'?'#945f33':finish(c)?.color||'#a77d4e',floorColour=FLOORS.find(f=>f.id===c.floor)?.color||'#c7a976';
  const white=material('#eeeae0'),fascia=material('#303834',{roughness:.58}),foundation=material('#6b7168'),floorMap=canvasTexture(floorColour);floorMap.repeat.set(w*1.15,d*.5);
  box(structure,w,.18,d,0,.09,0,foundation);box(structure,w-.15,.065,d-.15,0,.205,0,material('#ffffff',{map:floorMap,roughness:.7}));
  const floorJoin=material('#7a7465',{transparent:true,opacity:.30});for(let x=-w/2+.09,i=0;x<w/2-.08;x+=.19,i++){box(structure,.002,.001,d-.18,x,.239,0,floorJoin,false);for(let z=-d/2+.14+(i%2)*.50;z<d/2-.12;z+=1.04)box(structure,.186,.001,.002,x+.095,.239,z,floorJoin,false);}
  // Individual slats create real relief and soft shadowed joints.
  const woodMap=canvasTexture(timber,['steel','plank'].includes(c.cladding)?'paint':'wood');const slatMat=material('#ffffff',{map:woodMap,roughness:c.cladding==='steel'?.52:.82,metalness:c.cladding==='steel'?.35:0});
  const horizontal=c.cladding==='plank'||(c.cladding==='slatted'&&finish(c)?.productKey?.includes('HORIZONTAL'));
  const pitch=c.cladding==='steel'?.18:c.cladding==='slatted'?.072:c.cladding==='plank'?.17:.095;
  const clad=(isFront,s,len,high,y,outer)=>{if(horizontal){for(let row=y;row<y+high-.002;row+=pitch){const tall=Math.min(pitch-.008,y+high-row);if(isFront)box(structure,len,tall,.035,s+len/2,row+tall/2,outer,slatMat);else box(structure,.035,tall,len,outer,row+tall/2,s+len/2,slatMat);}}else{for(let position=s;position<s+len-.006;position+=pitch){const actual=Math.min(pitch-.008,s+len-position);if(actual<=0)continue;if(isFront)box(structure,actual,high,.034,position+actual/2,y+high/2,outer,slatMat);else box(structure,.034,high,actual,outer,y+high/2,position+actual/2,slatMat);}}};
  function wall(axis,span,start,zOrX,opening=null){
    const isFront=axis==='front',base=.24,wallH=2.12,sections=opening?[[start,opening.start-start,base,wallH],[opening.start+opening.width,start+span-opening.start-opening.width,base,wallH],[opening.start,opening.width,base+opening.height,wallH-opening.height]]:[[start,span,base,wallH]];
    for(const [s,len,y,high]of sections){if(len<.01||high<.01)continue;const centre=s+len/2;if(isFront)box(structure,len,high,.13,centre,y+high/2,zOrX,white);else box(structure,.13,high,len,zOrX,y+high/2,centre,white);
      const outer=isFront?zOrX+.075:zOrX+Math.sign(zOrX)*.075;
      clad(isFront,s,len,high,y,outer);
    }
  }
  const doorW=clamp(DOORS.find(option=>option.id===c.doors)?.openingWidth||.91,.75,w-.38),doorH=2.06,doorStart=-doorW/2;
  wall('front',w,-w/2,d/2,{start:doorStart,width:doorW,height:doorH});
  // Rear face retains the same material and interior white surface.
  box(structure,w,2.12,.13,0,1.30,-d/2,white);
  clad(true,-w/2,w,2.12,.24,-d/2-.075);
  const glass=new THREE.MeshPhysicalMaterial({color:'#adbfbd',roughness:.08,metalness:.10,transparent:true,opacity:.24,transmission:.16,thickness:.05,ior:1.5,reflectivity:.85,envMapIntensity:.45,side:THREE.DoubleSide,depthWrite:false});
  const glassEdges=material('#2f3734',{roughness:.5,metalness:.25});
  function openingFrame(parent,width,height,x,y,z,rotation=0,panels=1,isDoor=false){
    const frame=new THREE.Group();frame.position.set(x,y,z);frame.rotation.y=rotation;parent.add(frame);const rail=.045;
    box(frame,width+rail*2,rail,.11,0,height/2,0,glassEdges);box(frame,width+rail*2,rail,.11,0,-height/2,0,glassEdges);box(frame,rail,height,.11,-width/2,0,0,glassEdges);box(frame,rail,height,.11,width/2,0,0,glassEdges);
    for(let i=0;i<panels;i++){const panelW=width/panels,px=-width/2+panelW*(i+.5);box(frame,panelW-rail,height-rail*2,.014,px,0,.007,glass,false);if(i)box(frame,rail*.82,height,.065,-width/2+panelW*i,0,.022,glassEdges);if(isDoor&&(c.doors==='french'||c.doors==='single'))box(frame,.017,.115,.035,px+panelW*.32,-.08,.075,material('#b9c2bd',{metalness:.65,roughness:.3}));}
    if(c.doors==='bifold'&&isDoor)for(let i=0;i<panels-1;i++)box(frame,.018,.05,.04,-width/2+width/panels*(i+1),height*.37,.075,material('#171e19'));
    return frame;
  }
  openingFrame(structure,doorW,doorH,0,.24+doorH/2,d/2+.018,0,c.doors==='single'?1:c.doors==='bifold'?3:2,true);
  for(const side of[-1,1]){
    const included=c.windows==='both'||(side===-1?c.windows==='left':c.windows==='right');
    const windowW=Math.min(1.12,d-.65),windowH=1.72,start=-windowW/2;
    wall('side',d,-d/2,side*w/2,included?{start,width:windowW,height:windowH+.30}:null);
    if(included){ // The lower wall below a side window is explicit, rather than an open doorway.
      box(structure,.13,.30,windowW,side*w/2,.39,0,white);clad(false,start,windowW,.30,.24,side*(w/2+.075));
      openingFrame(structure,windowW,windowH,side*(w/2+.012),.54+windowH/2,0,Math.PI/2,1,false);
    }
  }
  const extraFront=c.overhang.includes('front')?.55:.10,extraBack=c.overhang.includes('back')?.55:.10,extraLeft=c.overhang.includes('left')?.55:.10,extraRight=c.overhang.includes('right')?.55:.10;
  box(roof,w+extraLeft+extraRight,.14,d+extraFront+extraBack,(extraRight-extraLeft)/2,2.43,(extraFront-extraBack)/2,fascia);
  box(roof,w+extraLeft+extraRight-.03,.019,d+extraFront+extraBack-.03,(extraRight-extraLeft)/2,2.508,(extraFront-extraBack)/2,material('#383e39',{roughness:.93}));
  const gutter=material('#26312b',{roughness:.45});box(roof,w+.04,.048,.052,0,2.388,-d/2-.125,gutter);cylinder(structure,.022,2.27,w/2-.14,1.15,-d/2-.12,gutter,.022,10);
  // Ceiling lights and exterior fittings match the selected electrical package.
  const lightsCount={standard:4,upgrade:6,premium:8}[c.electrical],lamp=material('#eee9cf',{emissive:'#ffcb79',emissiveIntensity:.12});
  for(let i=0;i<lightsCount;i++){const x=(i%2?1:-1)*w*.25,z=(-d*.28)+(Math.floor(i/2)/(lightsCount/2-1||1))*d*.56;cylinder(roof,.044,.012,x,2.352,z,lamp,.044);}
  const outsideLamps=[];for(const zSign of(c.electrical==='premium'?[1,-1]:[1]))for(const x of[-w/2+.20,w/2-.20]){box(structure,.065,.16,.074,x,1.9,zSign*(d/2+.08),fascia);const spot=new THREE.PointLight('#ffc983',0,3,2);spot.position.set(x,1.87,zSign*(d/2+.17));structure.add(spot);outsideLamps.push(spot);}
  const glow=new THREE.PointLight('#ffcf93',0,Math.max(w,d)*2,2);glow.position.set(0,2,0);structure.add(glow);
  const heaterW={standard:.65,upgrade:.86,premium:.86}[c.electrical];box(structure,Math.min(heaterW,w-.5),.40,.07,0,.61,-d/2+.12,material('#e7e8de'));for(let x=-heaterW*.4;x<heaterW*.4;x+=.06)box(structure,.006,.21,.004,x,.61,-d/2+.16,material('#c2c7bf'),false);
  furniture(structure,c,w,d);
  // Subtle lawn, paving and plants give the room a believable garden context.
  const grassMap=canvasTexture('#92a77b','grass');grassMap.repeat.set((w+5)/1.5,(d+5)/1.5);box(landscape,w+5,.03,d+5,0,-.04,0,material('#ffffff',{map:grassMap,roughness:1}));
  for(let strip=-Math.ceil((w+5)/1.6);strip<Math.ceil((w+5)/1.6);strip++)if(strip%2===0)box(landscape,.80,.002,d+4.95,strip*.8,-.020,0,material('#96a984',{transparent:true,opacity:.17}),false);
  const paving=material('#d6d3c5',{roughness:.88});
  box(landscape,w+.55,.065,.55,0,.002,d/2+.28,paving);
  for(let i=0;i<3;i++)box(landscape,1.20,.035,.48,0,.006,d/2+1.0+i*.71,material(i%2?'#dddacd':'#d3d1c2'));
  for(let x=-w/2;x<w/2;x+=.60)box(landscape,.004,.002,.54,x,.036,d/2+.28,material('#9c9c8e'),false);
  const deckMat=material('#a39377',{map:canvasTexture('#a89c7e'),roughness:.86});
  for(const side of c.decking){const isFront=side==='front'||side==='back',sign=side==='front'||side==='right'?1:-1,span=isFront?w:d,depth=.96;
    if(isFront){box(landscape,w+.20,.10,depth,0,.10,sign*(d/2+depth/2),deckMat);for(let z=.04;z<depth;z+=.13)box(landscape,w+.20,.002,.008,0,.151,sign*(d/2+z),material('#80775f'),false);}else{box(landscape,depth,.10,d+.2,sign*(w/2+depth/2),.10,0,deckMat);for(let x=.04;x<depth;x+=.13)box(landscape,.008,.002,d+.2,sign*(w/2+x),.151,0,material('#80775f'),false);}}
  hedge(landscape,w,d);foliage(landscape,-w/2-1.35,-d/2-.40,3.2);foliage(landscape,w/2+1.45,-d/2-1.13,2.75);
  plant(landscape,-w/2-.45,d/2+.21,.98);plant(landscape,w/2+.41,d/2+.38,.72);
  const grasses=material('#8b9b70');for(let i=0;i<8;i++){const angle=i*.7;const leaf=box(landscape,.028,.67,.026,w/2+.85+Math.cos(angle)*.12,.32,d/2-.25+Math.sin(angle)*.12,grasses);leaf.rotation.z=(i%2?.3:-.3);}
  const dimensionGroup=dimensions(w,d);group.add(dimensionGroup);
  group.userData={roof,landscape,structure,dimensionGroup,lamps:outsideLamps,glow,w,d,c};return group;
}

const RoomPreview=forwardRef(function RoomPreview({config,view='perspective',lighting='day',onCapture,className='',showHint=false},ref){
  const host=useRef(null),engine=useRef(null),configRef=useRef(config),viewRef=useRef(view),lightingRef=useRef(lighting),readyRef=useRef(onCapture);
  const[failed,setFailed]=useState(false),[ready,setReady]=useState(false),[photoFailed,setPhotoFailed]=useState(false);
  configRef.current=config;viewRef.current=view;lightingRef.current=lighting;readyRef.current=onCapture;
  useImperativeHandle(ref,()=>({capture:(mode)=>engine.current?.capture(mode)||null,captureAll:()=>engine.current?.captureAll()||{},reset:()=>engine.current?.setView(viewRef.current,true),zoom:(direction)=>engine.current?.zoom(direction)}),[]);
  useEffect(()=>{
    let renderer,observer,frame,contextLost;
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.97;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.domElement.className='mro-preview-canvas';renderer.domElement.setAttribute('aria-hidden','true');host.current.appendChild(renderer.domElement);
      const scene=new THREE.Scene();scene.background=new THREE.Color('#e7ede5');scene.fog=new THREE.Fog('#e7ede5',30,70);
      const pmrem=new THREE.PMREMGenerator(renderer),studio=new RoomEnvironment(),environment=pmrem.fromScene(studio,.025);scene.environment=environment.texture;studio.dispose();pmrem.dispose();
      const camera=new THREE.PerspectiveCamera(34,1,.1,120),planCamera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);
      const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!window.matchMedia('(prefers-reduced-motion:reduce)').matches;controls.dampingFactor=.085;controls.enablePan=false;controls.maxPolarAngle=Math.PI/2-.04;controls.minPolarAngle=.18;controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;
      const ambient=new THREE.HemisphereLight('#f8fcf2','#72815c',1.20);scene.add(ambient);
      const sun=new THREE.DirectionalLight('#fff3da',2.85);sun.position.set(-5,7,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;sun.shadow.normalBias=.020;sun.shadow.bias=-.00010;scene.add(sun);
      const fill=new THREE.DirectionalLight('#dce8f1',.55);fill.position.set(7,4,-6);scene.add(fill);
      const ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150),material('#e7ede5',{roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.058;ground.receiveShadow=true;scene.add(ground);
      const e={scene,camera,planCamera,controls,renderer,ambient,sun,fill,ground,environment,room:null,needsRender:true,mode:'perspective',sizeKey:'',activeCamera:camera};engine.current=e;
      const render=()=>{renderer.render(scene,e.activeCamera);e.needsRender=false;};
      const fit=(direction)=>{
        const c=normalizeConfig(configRef.current),w=c.width,d=c.depth,top=2.6,centre=new THREE.Vector3(0,.96,.12),dir=(direction||camera.position.clone().sub(controls.target)).normalize();
        if(dir.length()<.2)dir.set(1,.65,1.15).normalize();
        const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize(),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=0;
        const bounds=[[[-w/2-.70,w/2+.70],[.08,top],[-d/2-.3,d/2+.5]],[[-w/2-.6,w/2+.6],[0,.25],[-d/2-.55,d/2+1.15]]];
        for(const b of bounds)for(const x of b[0])for(const y of b[1])for(const z of b[2]){const p=new THREE.Vector3(x,y,z).sub(centre),toward=p.dot(dir);distance=Math.max(distance,Math.abs(p.dot(up))/tan+toward,Math.abs(p.dot(right))/(tan*camera.aspect)+toward);}
        distance*=1.05;controls.target.copy(centre);camera.position.copy(centre).addScaledVector(dir,distance);controls.minDistance=Math.max(3,distance*.48);controls.maxDistance=Math.max(22,distance*2.2);camera.updateProjectionMatrix();controls.update();e.needsRender=true;
      };
      e.setView=(mode='perspective',force=false)=>{
        const previousMode=e.mode;e.mode=mode;const data=e.room?.userData;if(!data)return;
        const plan=mode==='plan',inside=mode==='inside';data.roof.visible=!plan&&!inside;data.landscape.visible=!plan;data.dimensionGroup.visible=plan||mode==='front';controls.enabled=!plan;controls.enableRotate=!plan;
        if(plan){const w=data.w,d=data.d,aspect=camera.aspect,spanH=Math.max(d+1.5,(w+1.85)/aspect);planCamera.left=-spanH*aspect/2;planCamera.right=spanH*aspect/2;planCamera.top=spanH/2;planCamera.bottom=-spanH/2;planCamera.position.set(.05,18,.001);planCamera.up.set(0,0,-1);planCamera.lookAt(.05,0,.05);planCamera.updateProjectionMatrix();e.activeCamera=planCamera;}
        else{e.activeCamera=camera;const direction=!force&&previousMode===mode&&camera.position.length()>.1?camera.position.clone().sub(controls.target):new THREE.Vector3(...(mode==='front'?[0,.12,1]:inside?[.50,1.32,1.15]:mode==='rear'?[-1,.50,-1.20]:[1,.46,1.30]));fit(direction);}
        e.needsRender=true;render();
      };
      e.applyLighting=()=>{
        const evening=lightingRef.current==='evening',bg=evening?'#45574f':'#e7ede5';scene.background.set(bg);scene.fog.color.set(bg);ground.material.color.set(bg);ambient.intensity=evening?.65:1.20;sun.intensity=evening?.6:2.85;sun.color.set(evening?'#becddd':'#fff3da');fill.intensity=evening?.30:.55;renderer.toneMappingExposure=evening?1.05:.97;
        const data=e.room?.userData;if(data){for(const lamp of data.lamps)lamp.intensity=evening?4:0;data.glow.intensity=evening?8:0;}e.needsRender=true;
      };
      e.zoom=(direction)=>{if(e.mode==='plan')return;const factor=direction>0?.83:1.2,offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(factor);offset.clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(offset);controls.update();e.needsRender=true;};
      e.capture=(mode)=>{
        const original=e.mode,pos=camera.position.clone(),target=controls.target.clone();
        try{if(mode)e.setView(mode,true);render();const source=renderer.domElement,canvas=document.createElement('canvas'),width=Math.min(source.width,1600);canvas.width=width;canvas.height=Math.round(source.height*width/source.width);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.93);}
        catch{return null;}finally{if(mode){e.setView(original);camera.position.copy(pos);controls.target.copy(target);controls.update();render();}}
      };
      e.captureAll=()=>{const shots={};for(const mode of['perspective','front','plan','inside','rear'])shots[mode]=e.capture(mode);shots.hero=shots.perspective;shots.interior=shots.inside;return shots;};
      e.room=buildRoom(configRef.current);scene.add(e.room);e.applyLighting();
      const resize=()=>{if(!host.current)return;const w=host.current.clientWidth,h=host.current.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();e.setView(viewRef.current);};observer=new ResizeObserver(resize);observer.observe(host.current);resize();
      const draw=()=>{frame=requestAnimationFrame(draw);const changed=controls.update();if(changed||e.needsRender)render();};draw();
      contextLost=(event)=>{event.preventDefault();setFailed(true);};renderer.domElement.addEventListener('webglcontextlost',contextLost);
      readyRef.current?.({capture:e.capture,captureAll:e.captureAll,captureViews:e.captureAll,reset:()=>e.setView(viewRef.current,true),zoom:e.zoom});setReady(true);
    }catch{setFailed(true);readyRef.current?.({capture:()=>null,captureAll:()=>({}),captureViews:()=>({})});}
    return()=>{cancelAnimationFrame(frame);observer?.disconnect();if(engine.current){engine.current.controls.dispose();engine.current.environment.dispose();dispose(engine.current.scene);engine.current=null;}if(renderer){renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.dispose();renderer.domElement.remove();}};
  },[]);
  useEffect(()=>{const e=engine.current;if(!e)return;const next=buildRoom(config);e.scene.remove(e.room);dispose(e.room);e.room=next;e.scene.add(next);e.applyLighting();e.setView(viewRef.current);},[config]);
  useEffect(()=>{engine.current?.setView(view,true);},[view]);
  useEffect(()=>{engine.current?.applyLighting();},[lighting]);
  const c=normalizeConfig(config),description=`Interactive design preview of your ${c.width} by ${c.depth} metre Make Room garden room, ${c.cladding} cladding, ${c.doors} doors, ${c.windows} side glazing. Furniture and landscaping are illustrative.`;
  const keyHandler=event=>{const e=engine.current;if(!e||view==='plan')return;const step=.12;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(event.key)){event.preventDefault();if(event.key==='+'||event.key==='-'){e.zoom(event.key==='+'?1:-1);return;}const offset=e.camera.position.clone().sub(e.controls.target),spherical=new THREE.Spherical().setFromVector3(offset);if(event.key==='ArrowLeft')spherical.theta-=step;if(event.key==='ArrowRight')spherical.theta+=step;if(event.key==='ArrowUp')spherical.phi=clamp(spherical.phi-step,.18,Math.PI/2-.04);if(event.key==='ArrowDown')spherical.phi=clamp(spherical.phi+step,.18,Math.PI/2-.04);e.camera.position.copy(e.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));e.controls.update();e.needsRender=true;}};
  return <div className={`mro-preview ${lighting==='evening'?'is-evening':''} ${className}`}>
    <div className="mro-preview-host" ref={host} role="img" aria-label={description} tabIndex={failed?-1:0} onKeyDown={keyHandler} hidden={failed}/>
    {!ready&&!failed&&<div className="mro-preview-loading" role="status"><span/>Bringing your room to life…</div>}
    {failed&&<div className="mro-preview-fallback">{!photoFailed&&<img src="/assets/real-room.webp" alt="A completed Make Room garden room for inspiration" onError={()=>setPhotoFailed(true)}/>}<div className="mro-preview-fallback-copy" role="status"><strong>Your design choices are ready.</strong>3D is unavailable on this device. {photoFailed?'Your selected specification is saved below.':'This completed Make Room room is shown for inspiration.'} You can still customise your room and request its quote and design pack.</div></div>}
    {ready&&!failed&&<>{showHint&&<div className="mro-preview-hint">{view==='plan'?'Your layout · external dimensions':view==='inside'?'Roof removed to explore your space':<><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M9 7V4m-5 8H1m7 7-2 2m12-9h5M9 8c3-4 10-1 9 4-1 4-7 7-10 7-4-1-5-8-3-10 1-1 3 0 4 1V6c0-3 3-3 3 0v5"/></svg>Drag to explore · pinch to zoom</>}</div>}<div className="mro-preview-note">Design illustration.<br/>Furniture & garden for inspiration.</div></>}
  </div>;
});
export default RoomPreview;
