import * as THREE from 'three';
import { WorkshopScene } from '../scene.js';
import { adjust, massKey, measures, advance, STOP } from './model.js';
const HEIGHT = 7, SCALE = 25;
export class MetricScene extends WorkshopScene {
  makeRoom() {
    super.makeRoom();
    // Quiet classroom backdrop, behind the original desk.
    // The workbench shadow map covers the desk, not this distant backdrop.
    // Sampling it on the wall produces a clipped triangular shadow at its edge.
    const wall=this.box(110, 48, .4, 0xd8dfd0, 0, 18, -32);
    wall.name='classroom-wall'; wall.castShadow=false; wall.receiveShadow=false;
    this.box(30, 12, .45, 0x847453, 1, 15, -31.6);
    this.box(28.8, 10.8, .16, 0x355850, 1, 15, -31.3);
    this.box(31, .35, 1.2, 0xae9a76, 1, 8.9, -30.9);
  }
  mesh(parent, geometry, color, xyz, owner, metalness = .55) {
    const material = new THREE.MeshStandardMaterial({color, metalness, roughness:.4});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...xyz); mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = {part: owner, original: material};
    parent.add(mesh); this.meshes.push(mesh);
    if (owner) this.pickable.push(mesh);
    return mesh;
  }
  block(parent, w,h,d, color, x,y,z, owner) {
    return this.mesh(parent,new THREE.BoxGeometry(w,h,d),color,[x,y,z],owner);
  }
  cylinder(parent,r,h,color,x,y,z,owner) {
    return this.mesh(parent,new THREE.CylinderGeometry(r,r,h,32),color,[x,y,z],owner);
  }
  bored(parent, outer, inner, depth, color, x,y,z, square=false) {
    const shape=new THREE.Shape();
    if(square){shape.moveTo(-outer,-outer);shape.lineTo(outer,-outer);shape.lineTo(outer,outer);shape.lineTo(-outer,outer);shape.closePath();}
    else shape.absarc(0,0,outer,0,Math.PI*2,false);
    const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
    return this.mesh(parent,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:32}),color,[x,y,z-depth/2]);
  }
  setState(state) {
    this.state={...state}; this.motion={angle:0,velocity:0};
    // Own procedural resources are disposed on rebuild; inherited CAD assets stay shared.
    for (const root of [this.moving,this.base]) {
      root.traverse(o=>{o.geometry?.dispose(); if(o.material) {o.material.map?.dispose();o.material.dispose();}});
      root.clear();
    }
    this.meshes=[]; this.pickable=[]; this.hangers={}; this.moving.position.set(0,HEIGHT,0); this.base.position.set(0,0,0);
    const brass=0xb68d46, steel=0x778f91, dark=0x294e4a;
    this.block(this.base,4,.35,4,dark,0,.17,0);
    for (const z of [-1.25,1.25]) {
      this.block(this.base,.55,HEIGHT-.83,.48,steel,0,(HEIGHT-.83)/2+.35,z);
      this.bored(this.base,.58,.245,.5,brass,0,HEIGHT,z);
      for (const x of [-1.4,1.4]) this.cylinder(this.base,.14,.1,brass,x,.4,z);
    }
    const axle=this.cylinder(this.base,.22,3.35,0xcbd6d4,0,HEIGHT,0); axle.rotation.x=Math.PI/2;
    for (const z of [-1.78,1.78]) {
      const cap=this.cylinder(this.base,.35,.18,brass,0,HEIGHT,z); cap.rotation.x=Math.PI/2;
    }
    // Rectangular slotted rail: upper/lower flanges and regularly spaced webs.
    for(const y of [-.34,.34]) this.block(this.moving,25.3,.16,1.7,steel,0,y,0);
    for(let x=-12;x<=12;x++) if(x!==0) this.block(this.moving,.15,.52,1.6,steel,x,0,0);
    this.bored(this.moving,.38,.245,1.7,brass,0,0,0,true);
    for(const x of [-12.7,12.7]) this.block(this.moving,.24,.9,1.85,brass,x,0,0);
    for(let i=-12;i<=12;i++) {
      const line=this.block(this.moving,.024,i%2===0?.22:.12,.018,0x193e39,i,.19,.865);
      line.position.y=.19;
    }
    for (const p of ['a','b']) {
      const x=(p==='a'?-1:1)*state[p]/SCALE, owner=p, col=p==='a'?0x34766d:0xc09140;
      // Carriage straddles the rail; a screw and transverse pin secure the hanger.
      this.block(this.moving,.75,.18,2.25,col,x,.51,0,owner);
      for (const z of [-1.03,1.03]) this.block(this.moving,.65,1.36,.18,col,x,-.08,z,owner);
      this.cylinder(this.moving,.18,.32,brass,x,.75,0,owner);
      const pin=this.cylinder(this.moving,.12,2.5,brass,x,-.62,0,owner); pin.rotation.x=Math.PI/2;
      const hanger=new THREE.Group(); hanger.position.set(x,-.62,1.28); this.moving.add(hanger); this.hangers[p]=hanger;
      const mass=state[massKey(p)], size=Math.cbrt(mass/100), radius=.48*size, h=.55*size;
      // Hangers counter-rotate with the beam, so gravity stays vertical.
      this.cylinder(hanger,.065,1.1,0xc4d1cc,0,-.55,0,owner);
      const eye=this.mesh(hanger,new THREE.TorusGeometry(.2,.065,8,24),brass,[0,-1.2,0],owner);
      eye.rotation.y=Math.PI/2;
      this.cylinder(hanger,.16,.27,brass,0,-1.45,0,owner);
      this.cylinder(hanger,radius,h,col,0,-1.6-h/2,0,owner);
      for (const y of [-1.6,-1.6-h]) this.cylinder(hanger,radius+.065,.12,brass,0,y,0,owner);
      // Mass text lives in a screen-space callout above the apparatus. A sprite
      // attached to one cylinder face would rotate into the metal when orbiting.
    }
    this.highlight(this.hovered); this.dirty=true; this.draw();
  }
  highlight(part) {
    this.hovered=part;
    for(const mesh of this.meshes||[]) {
      mesh.material.emissive.set(mesh.userData.part === (part||this.selected) ? 0x2c8c31 : 0x000000);
      mesh.material.emissiveIntensity=.4;
    }
    this.callbacks.onHover?.(part); this.dirty=true;
  }
  screenPositions() {
    if (!this.state) return {};
    const result={};
    for(const p of ['a','b']) {
      const x=(p==='a'?-1:1)*this.state[p]/SCALE;
      result[p]=this.project(this.moving.localToWorld(new THREE.Vector3(x,1.35,0)));
      result[`${p}foot`]=this.project(this.moving.localToWorld(new THREE.Vector3(x,.65,0)));
      // Screen bounds let callouts clear the entire hanging mass at any angle.
      const bounds=new THREE.Box3().setFromObject(this.hangers[p]);
      const corners=[];
      for(const x of [bounds.min.x,bounds.max.x]) for(const y of [bounds.min.y,bounds.max.y]) for(const z of [bounds.min.z,bounds.max.z]) corners.push(this.project(new THREE.Vector3(x,y,z)));
      result[`${p}bounds`]={left:Math.min(...corners.map(c=>c.x)),right:Math.max(...corners.map(c=>c.x)),top:Math.min(...corners.map(c=>c.y)),bottom:Math.max(...corners.map(c=>c.y))};
    }
    result.pivot=this.project(new THREE.Vector3(0,HEIGHT+.6,0));
    return result;
  }
  frame(time) {
    if (!this.active) {this.frameTime=null;return;}
    const dt=this.frameTime===null?0:Math.min(.1,(time-this.frameTime)/1000); this.frameTime=time;
    const previous=this.motion.angle;
    if(this.state) {
      const m=measures(this.state);
      if(this.held||this.drag) this.motion={angle:0,velocity:0};
      else if(this.reduced) this.motion={angle:m.direction==='balance'?0:m.direction==='a'?STOP:-STOP,velocity:0};
      else this.motion=advance(this.state,this.motion,dt);
    }
    const changed=this.drag?false:this.controls.update();
    if(changed||this.dirty||previous!==this.motion.angle)this.draw();
  }
  draw() {
    if(!this.moving)return;
    this.moving.rotation.z=this.motion.angle;
    for(const hanger of Object.values(this.hangers||{}))hanger.rotation.z=-this.motion.angle;
    this.scene.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);this.dirty=false;
    this.callbacks.onFrame?.({positions:this.screenPositions(),direction:this.state?measures(this.state).direction:'balance',held:this.held||!!this.drag,angle:this.motion.angle});
  }
  resetCamera() {
    const fit=Math.max(1,1.6/(this.host.clientWidth/this.host.clientHeight));
    // A stable composition leaves room for the overlay controls and math tray.
    // Its framing depends only on the viewport, never on panel content/visibility.
    this.controls.target.set(0,5.5,0);
    this.camera.position.set(12*fit,5.5+14*fit,46*fit);
    this.controls.maxDistance=Math.max(65,55*fit);
    this.controls.update();this.draw();
  }
  sideCamera() {
    const fit=Math.max(1,1.6/(this.host.clientWidth/this.host.clientHeight));
    this.controls.target.set(0,5.5,0);
    this.camera.position.set(0,5.6,50*fit);
    this.controls.update();this.draw();
  }
  screenSign() {
    return this.project(new THREE.Vector3(10,HEIGHT,0)).x>=this.project(new THREE.Vector3(-10,HEIGHT,0)).x?1:-1;
  }
  beginDrag(event,part,kind='distance') {
    if(event.button!==0||!event.isPrimary||!this.state)return false;
    this.select(part);
    const a=this.project(new THREE.Vector3(-10,HEIGHT,0)),b=this.project(new THREE.Vector3(10,HEIGHT,0));
    const dx=b.x-a.x,dy=b.y-a.y,denom=dx*dx+dy*dy;
    if(kind==='distance'&&denom<2500){this.callbacks.onNotice?.('Turn the view to see more of the beam, or use the distance control.');return false;}
    event.preventDefault();event.stopImmediatePropagation();
    this.drag={part,kind,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,startState:{...this.state},dx,dy,denom,target:event.currentTarget};
    this.controls.enabled=false;this.drag.target.setPointerCapture?.(event.pointerId);this.motion={angle:0,velocity:0};this.dirty=true;return true;
  }
  installPointers() {
    this.canvas.addEventListener('pointerdown',e=>{const p=this.hit(e);if(p)this.beginDrag(e,p);},true);
    this.canvas.addEventListener('pointermove',e=>{if(!this.drag){const p=this.hit(e);if(p!==this.hovered)this.highlight(p);this.canvas.style.cursor=p?'grab':'default';}});
    this.canvas.addEventListener('pointerleave',()=>{if(!this.drag)this.highlight(null);});
    window.addEventListener('pointermove',e=>{
      const d=this.drag;if(!d||d.pointerId!==e.pointerId)return;
      e.preventDefault();e.stopImmediatePropagation();
      const field=d.kind==='mass'?massKey(d.part):d.part;
      const delta=d.kind==='mass'?(d.startY-e.clientY)*5:((e.clientX-d.startX)*d.dx+(e.clientY-d.startY)*d.dy)/d.denom*500*(d.part==='a'?-1:1);
      const next=adjust(this.state,field,d.startState[field]+delta);
      if(next[field]!==this.state[field])this.callbacks.onChange?.(next);
    },{capture:true,passive:false});
    for(const name of ['pointerup','pointercancel'])window.addEventListener(name,e=>{if(this.drag?.pointerId===e.pointerId)this.finishDrag(name==='pointercancel');},true);
    window.addEventListener('blur',()=>this.finishDrag(true));
    window.addEventListener('keydown',e=>{if(e.key==='Escape')this.finishDrag(true);});
    this.canvas.addEventListener('keydown',e=>{
      if(!this.selected||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();const p=this.selected,vertical=['ArrowUp','ArrowDown'].includes(e.key),field=vertical?massKey(p):p;
      const delta=vertical?(e.key==='ArrowUp'?25:-25):(e.key==='ArrowRight'?25:-25)*this.screenSign()*(p==='a'?-1:1);
      this.callbacks.onChange?.(adjust(this.state,field,this.state[field]+delta));
    });
  }
}
