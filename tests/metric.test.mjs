import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DEFAULT,PRESETS,GRAVITY,adjust,measures,torque,advance,STOP,valid} from '../src/metric/model.js';
import {MetricScene} from '../src/metric/scene.js';

test('metric lab: equal, double and triple presets balance with exact ratios',()=>{
 for(const [key,expected] of [['equal',1],['double',2],['triple',3]]) {
  const s=PRESETS[key],m=measures(s); assert.equal(m.direction,'balance');assert.equal(m.ima,expected);assert.equal(m.neededMass,s.massA);assert.equal(torque(s),0);
  assert.ok(Math.abs(measures(s,'b').ima-1/expected)<1e-12);
 }
 const doubled=adjust(DEFAULT,'a',300);assert.equal(measures(doubled).direction,'a');
 assert.equal(measures(adjust(doubled,'massA',50)).direction,'balance');
});
test('metric lab: SI torque, gravitational cancellation and role reversal across legal grid',()=>{
 for(let a=50;a<=300;a+=25)for(let b=50;b<=300;b+=25)for(let ma=25;ma<=1000;ma+=25)for(let mb=25;mb<=1000;mb+=25){
  const s={a,b,massA:ma,massB:mb},m=measures(s),reverse=measures(s,'b');
  assert.equal(m.direction,ma*a===mb*b?'balance':ma*a>mb*b?'a':'b');
  assert.ok(Math.abs(torque(s)-(ma*a-mb*b)*GRAVITY/1e6)<1e-12);
  assert.equal(reverse.direction,m.direction);assert.ok(Math.abs(reverse.ima*m.ima-1)<1e-12);
  if(m.direction==='balance')assert.ok(Math.abs(m.forceRatio-m.ima)<1e-12);
 }
 assert.ok(Math.abs(measures(PRESETS.double).forceA-.981)<1e-12);assert.ok(Math.abs(measures(PRESETS.double).torqueA-.1962)<1e-12);
});
test('metric lab: animation cannot cross travel stops or invent balance',()=>{
 const s={a:300,b:50,massA:1000,massB:25};
 for(const fps of [24,60,120]){let motion={angle:0,velocity:0};for(let t=0;t<3*fps;t++)motion=advance(s,motion,1/fps);assert.equal(motion.angle,STOP);assert.equal(motion.velocity,0);}
 assert.deepEqual(advance(DEFAULT,{angle:0,velocity:0},.1),{angle:0,velocity:0});
 assert.equal(measures({a:275,b:300,massA:1000,massB:925}).direction,'b');
});
test('metric lab: corrupt values, bounds and quantization are safe',()=>{
 assert.equal(valid(DEFAULT),true);assert.equal(valid({...DEFAULT,a:0}),false);assert.equal(valid({...DEFAULT,massB:NaN}),false);
 assert.equal(adjust(DEFAULT,'a',-100).a,50);assert.equal(adjust(DEFAULT,'massA',5000).massA,1000);
 assert.equal(adjust(DEFAULT,'b',112.5).b,125);assert.deepEqual(adjust(DEFAULT,'a',NaN),DEFAULT);
});
test('metric lab: procedural hangers fit the rail, rotate vertically, and clear the desk at both stops',()=>{
 const scene=new MetricScene({});scene.scene=new THREE.Scene();scene.moving=new THREE.Group();scene.base=new THREE.Group();scene.scene.add(scene.moving,scene.base);
 scene.draw=()=>{};scene.textLabel=()=>new THREE.Group();
 for(const distance of [50,300])for(const mass of [25,1000]){
  scene.setState({a:distance,b:distance,massA:mass,massB:mass});
  for(const sign of [-1,1]){
   scene.moving.rotation.z=sign*STOP;Object.values(scene.hangers).forEach(h=>h.rotation.z=-sign*STOP);scene.scene.updateMatrixWorld(true);
   for(const p of ['a','b']){
    const h=scene.hangers[p],box=new THREE.Box3().setFromObject(h);assert.ok(box.min.y>0,'hanging mass stays above table');
    assert.ok((p==='a'?box.max.x<-.3:box.min.x>.3),'hanging mass clears center support');
    const q=h.getWorldQuaternion(new THREE.Quaternion());assert.ok(Math.abs(q.z)<1e-8,'hangers stay vertical');
   }
  }
 }
 // The same state drives geometry and the displayed arm distances.
 scene.setState(PRESETS.double);scene.moving.rotation.z=0;scene.scene.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(0,7,5),new THREE.Vector3(0,0,-1));
 assert.equal(ray.intersectObjects(scene.moving.children,true).length,0,'axle passes through an actual bore, not a solid beam');
 assert.equal(scene.hangers.a.position.x*25,-200);assert.equal(scene.hangers.b.position.x*25,100);
});
