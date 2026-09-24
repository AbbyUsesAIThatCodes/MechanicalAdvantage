import {MetricScene} from './scene.js';
import {DEFAULT, PRESETS, GRAVITY, BOUNDS, adjust, massKey, measures, valid} from './model.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const key='mechanical-advantage-v1';
let state={...DEFAULT}, effort='a',showMath=true,tab='balance',held=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,selected=null,scene=null,ready=false,fallback=false;
try {const v=JSON.parse(localStorage.getItem(key));if(valid(v?.state)){state=v.state;effort=v.effort==='b'?'b':'a';showMath=v.showMath!==false;reduced=v.reduced===true||reduced;}}catch{}
const fmt=(n,d=4)=>Number(n.toFixed(d)).toLocaleString('en-US',{maximumFractionDigits:d});
const tips={
 g:'g means gram: a unit of mass. Mass tells how much matter an object has. 1,000 g = 1 kg.',
 kg:'kg means kilogram: 1 kilogram is 1,000 grams.',
 mm:'mm means millimeter: a small unit of length. 10 mm = 1 cm; 1,000 mm = 1 m.',
 m:'m means meter: 1 meter is 1,000 millimeters.',
 N:'N means newton: a unit of force. Here it measures the downward pull of gravity on the mass.',
 'N/kg':'N/kg means newtons per kilogram. Near Earth, gravity pulls with about 9.81 N on each kilogram.',
 'N·m':'N·m means newton-meter: force multiplied by its perpendicular distance from the fulcrum. It measures turning effect (torque).',
 'g·mm':'g·mm means gram-millimeter: mass multiplied by distance. Compare the two sides using this shortcut; both masses feel the same gravity.',
 times:'Multiply: combine a force or mass with its distance. Twice either value gives twice the turning effect.',
 divide:'Divide: find how many times the bottom value fits into the top value.',
 equals:'Equals: both sides have the same value.',
 approx:'Approximately equal: this displayed number is rounded. The model calculates using the full value.',
 ima:'Ideal mechanical advantage (IMA) is effort-arm distance divided by load-arm distance. It describes the advantage provided by the lever’s shape.',
 effort:'Effort is the input force used to balance or move the load. In this lab one hanging weight supplies that force.',
 load:'Load is the force you want the lever to balance or move. The other hanging weight supplies it.',
 fulcrum:'The fulcrum is the fixed axle the lever turns around. Measure each arm from its center to the hanger.',
 balance:'The two turning effects are equal. The lever can remain level when released.',
 }; 
const tip=(text,keyOrText,cls='')=>`<span class="tip ${cls}" tabindex="0" data-tip="${tips[keyOrText]||keyOrText}">${text}</span>`;
const unit=u=>tip(u,u),op=(symbol,k)=>tip(symbol,k);
const value=(n,u,cls='')=>`<span class="${cls}">${fmt(n)} ${unit(u)}</span>`;
function save(){try{localStorage.setItem(key,JSON.stringify({state,effort,showMath,reduced}));}catch{}}
function notice(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
for(const p of ['a','b']) {
 const name=p.toUpperCase();
 $(`#panel-${p}`).innerHTML=`<h2 id="title-${p}"><span class="identity">${name}</span> Weight ${name}<span id="role-${p}" class="role"></span></h2><label for="mass-${p}">${tip('Mass','g')}</label><div class="numeric"><input id="mass-${p}" type="number" min="25" max="1000" step="25" value="100" aria-label="Mass ${name} in grams">${unit('g')}</div><input id="mass-slider-${p}" type="range" min="25" max="1000" step="25" value="100" aria-label="Mass ${name}"><div class="quick-actions"><button data-scale="${p},mass,0.5" data-tip="Divide this mass by 2. Values snap to 25 g steps." aria-label="Halve mass ${name}">÷ 2</button><button data-scale="${p},mass,2" data-tip="Multiply this mass by 2, up to 1,000 g." aria-label="Double mass ${name}">× 2</button></div><label for="distance-${p}">From ${tip('fulcrum','fulcrum')}</label><div class="numeric"><input id="distance-${p}" type="number" min="50" max="300" step="25" value="150" aria-label="Distance ${name} in millimeters">${unit('mm')}</div><input id="distance-slider-${p}" type="range" min="50" max="300" step="25" value="150" aria-label="Distance ${name}"><div class="quick-actions"><button data-scale="${p},distance,0.5" data-tip="Divide this distance by 2. Values snap to 25 mm steps, with at least 50 mm from the axle." aria-label="Halve distance ${name}">÷ 2</button><button data-scale="${p},distance,2" data-tip="Multiply this distance by 2, up to 300 mm." aria-label="Double distance ${name}">× 2</button></div><p class="panel-force" id="force-${p}"></p>`;
 const wrapper=document.createElement('div');wrapper.className='weight-tag';wrapper.dataset.part=p;
 wrapper.innerHTML=`<button class="tag-select" data-select="${p}" aria-pressed="false" aria-label="Select or drag weight ${name}"><b>${name} · <span id="tag-mass-${p}"></span> g</b><span class="weight-info"><span id="tag-distance-${p}"></span> mm from fulcrum</span></button><div class="gizmo" aria-label="Adjust weight ${name}"><button data-step="${p},left" aria-label="Move ${name} left" data-tip="Move this weight left on your screen, in 25 mm steps.">←</button><button class="mass-drag" data-massdrag="${p}" aria-label="Drag vertically to change mass ${name}" data-tip="Drag up for more mass or down for less mass. Keyboard: use the up and down arrow keys.">↕</button><div class="vertical-buttons"><button data-step="${p},up" aria-label="Add 25 grams to ${name}" data-tip="Add 25 g to this mass.">＋</button><button data-step="${p},down" aria-label="Remove 25 grams from ${name}" data-tip="Remove 25 g from this mass.">−</button></div><button data-step="${p},right" aria-label="Move ${name} right" data-tip="Move this weight right on your screen, in 25 mm steps.">→</button></div>`;
 $('#part-tags').append(wrapper);
}
function setState(next){state={...next};if(ready)scene.setState(state);$('#preset').value=Object.entries(PRESETS).find(([,v])=>Object.keys(v).every(k=>v[k]===state[k]))?.[0]||'custom';render();save();}
function choose(p){selected=p;if(ready)scene.select(p);renderSelection();}
function renderSelection(){for(const p of ['a','b']){$(`[data-select="${p}"]`).setAttribute('aria-pressed',String(p===selected));$(`[data-part="${p}"]`).classList.toggle('active',p===selected);}}
function math() {
 const m=measures(state,effort),e=effort,l=m.load,ec=e==='a'?'a-color':'b-color',lc=l==='a'?'a-color':'b-color';
 const balanced=m.direction==='balance', comparison=m.momentA===m.momentB?'=':m.momentA>m.momentB?'>':'<';
 const ratio=Number.isInteger(m.ima)?`${fmt(m.ima)}×`: `${fmt(m.ima,2)}×`;
 const needed=Number.isInteger(m.neededMass/25)&&m.neededMass>=25&&m.neededMass<=1000;
 const relation=m.ima===1?'Equal arms need equal masses.':`At balance, ${e.toUpperCase()} needs ${m.ima===2?'½':m.ima===3?'⅓':fmt(1/m.ima,3)+'×'}${[2,3].includes(m.ima)?' of':''} ${l.toUpperCase()}’s mass.`;
 $('#balance-math').innerHTML=`<div class="math-grid"><div class="math-cell"><h2>1 · THE ARM LENGTHS</h2><div class="equation">${tip('IMA','ima')} ${op('=','equals')} <span class="fraction"><span>${tip('effort arm','effort')}</span><span>${tip('load arm','load')}</span></span> ${op('=','equals')} <span class="fraction"><span>${value(state[e],'mm',ec)}</span><span>${value(state[l],'mm',lc)}</span></span> ${op(Number(m.ima.toFixed(2))===m.ima?'=':'≈',Number(m.ima.toFixed(2))===m.ima?'equals':'approx')} <span class="math-result">${tip(ratio,'The millimeter units cancel: this ratio has no unit. '+(m.ima>=1?'A longer effort arm needs less force at balance.':'A shorter effort arm needs more force at balance.'))}</span></div><p>${relation}</p></div><div class="math-cell"><h2>2 · COMPARE THE TURNING EFFECTS</h2><div class="turning"><span class="a-color">A: ${value(state.massA,'g')} ${op('×','times')} ${value(state.a,'mm')}</span><b>${fmt(m.momentA)}</b><span class="b-color">B: ${value(state.massB,'g')} ${op('×','times')} ${value(state.b,'mm')}</span><b>${fmt(m.momentB)}</b></div><p>${value(m.momentA,'g·mm')} ${tip(comparison,comparison==='='?'equals':comparison==='>'?'Greater than: A has the larger turning effect.':'Less than: B has the larger turning effect.')} ${value(m.momentB,'g·mm')}</p><p><b>${balanced?'Equal turning effects → balanced.':`Weight ${m.direction.toUpperCase()} has the larger turning effect.`}</b></p></div><div class="math-cell"><h2>3 · MASS NEEDED ON ${e.toUpperCase()}</h2><div class="equation compact"><span class="fraction"><span>${value(state[massKey(l)],'g',lc)} ${op('×','times')} ${value(state[l],'mm',lc)}</span><span>${value(state[e],'mm',ec)}</span></span> ${op(Number(m.neededMass.toFixed(4))===m.neededMass?'=':'≈',Number(m.neededMass.toFixed(4))===m.neededMass?'equals':'approx')} <span class="math-result">${value(m.neededMass,'g',ec)}</span></div><p>${tip('Divide by the effort-arm distance.','divide')} This is the mass ${e.toUpperCase()} needs to balance ${l.toUpperCase()}.</p><p>${needed?'Try it, then release the lever.':'This exact answer is outside the available 25 g steps or mass range. Change a distance or the other mass.'}</p></div></div><p class="math-footnote">${tip('Effort','effort')} = ${e.toUpperCase()} · ${tip('load','load')} = ${l.toUpperCase()} · Lengths are measured from the fixed fulcrum. ${tip('IMA is a prediction from the arms.','ima')} The force ratio equals IMA only at balance.</p>`;
 $('#force-math').innerHTML=`<div class="conversion-grid">${['a','b'].map(p=>{const mass=state[massKey(p)],f=mass/1000*GRAVITY,t=f*state[p]/1000;return `<div><h2 class="${p}-color">${p.toUpperCase()} · mass → force → turning effect</h2><p>${value(mass,'g')} ${tip('÷','Divide by 1,000 to change grams into kilograms.')} ${tip('1,000','There are 1,000 grams in one kilogram.')} ${op('=','equals')} ${value(mass/1000,'kg')}</p><p>${value(mass/1000,'kg')} ${tip('×','Multiply kilograms by Earth’s gravitational field strength to find weight force.')} ${value(GRAVITY,'N/kg')} ${op('=','equals')} ${value(f,'N')}</p><p>${value(state[p],'mm')} ${tip('÷','Divide by 1,000 to change millimeters into meters.')} 1,000 ${op('=','equals')} ${value(state[p]/1000,'m')}</p><p>${value(f,'N')} ${op('×','times')} ${value(state[p]/1000,'m')} ${op(Number(t.toFixed(4))===t?'=':'≈',Number(t.toFixed(4))===t?'equals':'approx')} ${value(t,'N·m')}</p></div>`;}).join('')}<div><h2>Why the mass shortcut works</h2><p>Both masses feel the same gravity. Multiplying both sides by the same number keeps the balance.</p><p>${tip('Load force ÷ effort force','The actual ratio of the two weight forces. This equals the ideal mechanical advantage only when the lever balances.')} ${op('≈','approx')} <b>${fmt(m.forceRatio,3)}</b></p><p>${tip('IMA','ima')} ${op('≈','approx')} <b>${fmt(m.ima,3)}</b> · ${balanced?'the ratios match.':'not balanced yet.'}</p><p class="note">Gravity ≈ 9.81 ${unit('N/kg')}. Turning effects shown at level; displayed results may be rounded.</p></div></div>`;
}
function render() {
 $('#preset').value=Object.entries(PRESETS).find(([,v])=>Object.keys(v).every(k=>v[k]===state[k]))?.[0]||'custom';
 for(const p of ['a','b']) {
   const mass=state[massKey(p)];
   for(const id of [`mass-${p}`,`mass-slider-${p}`])$('#'+id).value=mass;
   for(const id of [`distance-${p}`,`distance-slider-${p}`])$('#'+id).value=state[p];
   $(`#mass-slider-${p}`).setAttribute('aria-valuetext',`${mass} grams`);$(`#distance-slider-${p}`).setAttribute('aria-valuetext',`${state[p]} millimeters from fulcrum`);
   $(`#role-${p}`).textContent=p===effort?'Effort':'Load';
   $(`#tag-mass-${p}`).textContent=fmt(mass);$(`#tag-distance-${p}`).textContent=state[p];
   $(`#force-${p}`).innerHTML=`Weight force: ${value(mass/1000*GRAVITY,'N')}`;
 }
 $('#effort').value=effort;$('#hold').textContent=held?'Release':'Hold level';$('#hold').setAttribute('aria-pressed',String(held));
 $('#math-panel').hidden=!showMath;$('#math-toggle').textContent=showMath?'Hide math':'Show math';$('#math-toggle').setAttribute('aria-expanded',String(showMath));
 math();for(const f of $$('.fraction')){f.classList.add('tip');f.tabIndex=0;f.dataset.tip='A fraction means divide: the entire top value divided by the bottom value.';}renderSelection();updateStatus(measures(state).direction,held);if(fallback)drawFallback();
}
function updateStatus(direction,isHeld) {const label=isHeld?'Held level':direction==='balance'?'Balanced':`Weight ${direction.toUpperCase()} dips`;if($('#beam-status').textContent!==label)$('#beam-status').textContent=label;$('#beam-status').classList.toggle('balanced',direction==='balance'&&!isHeld);}
function onFrame({positions,direction,held:isHeld}) {
 updateStatus(direction,isHeld);if(!positions.pivot)return;
 const stage=$('#stage'),w=stage.clientWidth,h=stage.clientHeight;
 const toolbarBottom=$('#workbench-top').getBoundingClientRect().bottom;
 const compact=matchMedia('(max-width:900px),(max-height:660px)').matches;
 const minX=compact?8:$('#panel-a').getBoundingClientRect().right+12;
 const maxX=compact?w-8:$('#panel-b').getBoundingClientRect().left-12;
 const labels=[];
 for(const p of ['a','b']) {
  const pos=positions[p],foot=positions[p+'foot'],bounds=positions[p+'bounds'];
  const tag=$(`[data-part="${p}"]`);tag.hidden=!pos.visible;
  if(!pos.visible){$(`#measure-${p}`).replaceChildren();continue;}
  const half=tag.offsetWidth/2;
  // The bottom of the callout clears both the carriage and the projected mass.
  const bottom=Math.min(foot.y,bounds.top)-30;
  const y=Math.max(toolbarBottom+tag.offsetHeight+8,Math.min(h-12,bottom));
  const x=Math.max(minX+half,Math.min(maxX-half,pos.x));
  labels.push({p,tag,x,y,half,foot});
  const pivot=positions.pivot,y1=foot.y-13,y2=pivot.y-13,mx=(foot.x+pivot.x)/2,my=(y1+y2)/2;
  $(`#measure-${p}`).innerHTML=`<path d="M${foot.x} ${y1+7}v-14m0 7L${pivot.x} ${y2}m0-7v14" stroke="${p==='a'?'#286052':'#865512'}" stroke-width="2" fill="none"/><rect x="${mx-39}" y="${my-12}" width="78" height="24" rx="6" fill="#fffbed"/><text x="${mx}" y="${my+5}" text-anchor="middle" fill="#193f35" font-size="16" font-family="Comic Sans MS,Comic Neue,sans-serif" font-weight="bold">${state[p]} mm</text>`;
 }
 // Keep both callouts separate even when looking along the beam.
 labels.sort((a,b)=>a.x-b.x);
 if(labels.length===2){
  const [left,right]=labels,gap=left.half+right.half+8;
  if(right.x-left.x<gap){
   left.x=Math.max(minX+left.half,Math.min(maxX-right.half-gap,(left.x+right.x-gap)/2));
   right.x=left.x+gap;
  }
 }
 $('#label-leaders').innerHTML=labels.map(({p,tag,x,y,foot})=>{
  tag.style.left=`${x}px`;tag.style.top=`${y}px`;
  const color=p==='a'?'#286052':'#865512';
  return `<path data-leader="${p}" d="M${x} ${y+3}L${foot.x} ${foot.y}" stroke="${color}" stroke-width="1.5" stroke-opacity=".65" fill="none"/><circle cx="${foot.x}" cy="${foot.y}" r="3" fill="${color}"/>`;
 }).join('');
}
// Only the viewport resizes the renderer. Changes to overlay size just update
// label clearances and the compact-screen tray position.
new ResizeObserver(()=>{
 $('#app').style.setProperty('--toolbar-bottom',`${$('#workbench-top').getBoundingClientRect().bottom}px`);
 if(scene)scene.dirty=true;
}).observe($('#workbench-top'));
$('#weights-toggle').addEventListener('click',()=>{
 const open=$('#weight-controls').classList.toggle('open');
 $('#weights-toggle').setAttribute('aria-expanded',String(open));
 $('#weights-toggle').textContent=open?'Close weights':'Weights';
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&$('#weight-controls').classList.contains('open')){
  $('#weights-toggle').click();$('#weights-toggle').focus();
 }
});

function drawFallback(){const m=measures(state),cx=400,scale=.94,angle=held||m.direction==='balance'?0:m.direction==='a'?-12:12;$('#fallback-svg').innerHTML=`<path d="M400 140l-24 145h48z" fill="#627f75"/><g transform="rotate(${angle} 400 140)"><rect x="105" y="135" width="590" height="12" rx="4" fill="#839a94"/>${['a','b'].map(p=>{const x=cx+(p==='a'?-1:1)*state[p]*scale;return `<path d="M${x} 145v45" stroke="#8e7044" stroke-width="4"/><rect x="${x-24}" y="190" width="48" height="${25+Math.cbrt(state[massKey(p)])*3}" rx="5" fill="${p==='a'?'#38786c':'#b5893d'}"/><text x="${x}" y="105" text-anchor="middle" font-size="20" fill="#193f35">${p.toUpperCase()}: ${state[massKey(p)]} g</text><text x="${(x+cx)/2}" y="126" text-anchor="middle" font-size="17" fill="#193f35">${state[p]} mm</text>`;}).join('')}</g>`;updateStatus(m.direction,held);}
function holdScene(){scene?.setHeld(held||!!$('dialog[open]'));if(fallback)drawFallback();}
for(const p of ['a','b']) {
 for(const type of ['mass','distance'])for(const suffix of ['', '-slider']) {
  const input=$(`#${type}${suffix}-${p}`),field=type==='mass'?massKey(p):p;
  input.addEventListener(suffix?'input':'change',()=>{if(input.value===''||!input.checkValidity()){notice(`Use ${type==='mass'?'25–1,000 g':'50–300 mm'}, in steps of 25.`);render();return;}setState(adjust(state,field,+input.value));});
 }
 const panel=$(`#panel-${p}`);panel.addEventListener('pointerenter',()=>{if(ready)scene.highlight(p);panel.classList.add('active');});panel.addEventListener('pointerleave',()=>{if(ready)scene.highlight(null);panel.classList.remove('active');});
 const tag=$(`[data-select="${p}"]`);tag.addEventListener('pointerdown',e=>{choose(p);if(ready)scene.beginDrag(e,p);});tag.addEventListener('click',()=>choose(p));
 tag.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();step(p,e.key.slice(5).toLowerCase());}});
 const handle=$(`[data-massdrag="${p}"]`);handle.addEventListener('pointerdown',e=>{choose(p);if(ready)scene.beginDrag(e,p,'mass');});handle.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();step(p,e.key.slice(5).toLowerCase());}});
}
function step(p,action){const vertical=action==='up'||action==='down',field=vertical?massKey(p):p;const delta=vertical?(action==='up'?25:-25):(action==='right'?25:-25)*(ready?scene.screenSign():1)*(p==='a'?-1:1);choose(p);setState(adjust(state,field,state[field]+delta));}
for(const button of $$('[data-step]'))button.addEventListener('click',()=>step(...button.dataset.step.split(',')));
for(const button of $$('[data-scale]'))button.addEventListener('click',()=>{const[p,type,factor]=button.dataset.scale.split(','),field=type==='mass'?massKey(p):p;const wanted=state[field]*Number(factor),next=adjust(state,field,wanted);if(next[field]!==wanted)notice(`The result snaps to ${next[field]} ${type==='mass'?'g':'mm'} within the available steps and range.`);setState(next);});
$('#preset').addEventListener('change',()=>{held=false;holdScene();setState(PRESETS[$('#preset').value]||state);notice('A balanced starting arrangement. Change one thing and predict what happens.');});
$('#effort').addEventListener('change',()=>{effort=$('#effort').value;render();save();});
$('#math-toggle').addEventListener('click',()=>{showMath=!showMath;render();save();});
$('#hold').addEventListener('click',()=>{held=!held;holdScene();render();});
$('#reset').addEventListener('click',()=>{held=false;holdScene();setState(DEFAULT);choose(null);scene?.resetCamera();});
for(const [id,method] of [['view-side','sideCamera'],['view-turn','turn'],['view-reset','resetCamera']])$('#'+id).addEventListener('click',()=>scene?.[method]());
function switchTab(name){tab=name;for(const t of ['balance','force']){const b=$('#tab-'+t);b.setAttribute('aria-selected',String(t===tab));b.tabIndex=t===tab?0:-1;$('#'+t+'-math').hidden=t!==tab;}}
for(const name of ['balance','force']){$('#tab-'+name).addEventListener('click',()=>switchTab(name));$('#tab-'+name).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();switchTab(name==='balance'?'force':'balance');$('#tab-'+tab).focus();}});}
$('#help').addEventListener('click',()=>{$('#help-dialog').showModal();holdScene();});for(const b of $$('.dialog-close'))b.addEventListener('click',()=>b.closest('dialog').close());$('#help-dialog').addEventListener('close',holdScene);
$('#reduced').checked=reduced;$('#reduced').addEventListener('change',()=>{reduced=$('#reduced').checked;if(scene){scene.reduced=reduced;scene.level();}save();});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('Full screen is unavailable in this browser.');}});if(!document.fullscreenEnabled)$('#fullscreen').hidden=true;
// One tooltip surface: hover, keyboard focus and tap all expose the same concise definitions.
let tipTarget=null,tipTimer;
function hideTip(){tipTarget?.removeAttribute('aria-describedby');tipTarget=null;$('#tooltip').hidden=true;}
function showTip(target){clearTimeout(tipTimer);hideTip();tipTarget=target;const box=$('#tooltip');box.textContent=target.dataset.tip;box.hidden=false;target.setAttribute('aria-describedby','tooltip');const r=target.getBoundingClientRect(),b=box.getBoundingClientRect();box.style.left=`${Math.min(innerWidth-b.width-12,Math.max(12,r.left+(r.width-b.width)/2))}px`;box.style.top=`${r.top>b.height+16?r.top-b.height-10:Math.min(innerHeight-b.height-12,r.bottom+10)}px`;}
document.addEventListener('pointerover',e=>{const target=e.target.closest('[data-tip]');if(target)showTip(target);});document.addEventListener('pointerout',e=>{if(e.target.closest('[data-tip]'))tipTimer=setTimeout(hideTip,170);});$('#tooltip').addEventListener('pointerenter',()=>clearTimeout(tipTimer));$('#tooltip').addEventListener('pointerleave',hideTip);
document.addEventListener('focusin',e=>{const t=e.target.closest('[data-tip]');if(t)showTip(t);else hideTip();});document.addEventListener('focusout',hideTip);document.addEventListener('click',e=>{const t=e.target.closest('[data-tip]');if(t)showTip(t);else hideTip();});document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();});window.addEventListener('resize',hideTip);window.addEventListener('scroll',hideTip,true);
function unavailable(){ready=false;fallback=true;if(scene)scene.active=false;$('#scene').hidden=true;$('#fallback').hidden=false;$('#part-tags').hidden=true;$('#dimensions').hidden=true;$$('.camera-controls button').forEach(b=>b.disabled=true);drawFallback();$('#app').dataset.ready='fallback';}
render();
try{scene=new MetricScene($('#scene'),{onChange:setState,onSelect:p=>{selected=p;renderSelection();},onHover:p=>{for(const part of ['a','b'])$(`[data-part="${part}"]`).classList.toggle('active',p===part||selected===part);},onFrame,onNotice:notice,onUnavailable:unavailable,onRelease:holdScene});await scene.init();ready=true;scene.canvas.setAttribute('aria-label','3D millimeter lever. Select a weight and drag left or right. Arrow keys move it; up and down change its mass.');scene.reduced=reduced;scene.setState(state);holdScene();$('#app').dataset.ready='true';}catch(error){console.warn('3D unavailable; using diagram.',error.message);unavailable();}
