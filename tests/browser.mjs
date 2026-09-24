import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { verifyMetric } from './metric-browser.mjs';
const url='http://127.0.0.1:4173/MechanicalAdvantage/';
let server;
try { await fetch(url); } catch {
  server=spawn(process.execPath,['scripts/serve.mjs'],{stdio:'ignore'});
  for(let i=0;i<30;i++){try{await fetch(url);break;}catch{await new Promise(r=>setTimeout(r,100));}}
}
const args=['--no-sandbox'];
if(process.env.BROWSER_SOFTWARE_GL==='1')args.push('--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader');
const browser=await chromium.launch({headless:true,args,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
const errors=[],external=[];
await mkdir('artifacts',{recursive:true});
const page=await browser.newPage({viewport:{width:1366,height:768}});
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
try {
  await verifyMetric(page,url);
  // The standalone application also works without a repository URL prefix.
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(()=>document.querySelector('#app').dataset.ready==='true');
  assert.match(await page.title(),/Mechanical Advantage/);
  const fallback=await browser.newPage({viewport:{width:1024,height:768}});
  fallback.on('pageerror',e=>errors.push(e.message));
  await fallback.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...rest){return kind.startsWith('webgl')?null:getContext.call(this,kind,...rest);};
    Object.defineProperty(window,'localStorage',{get(){throw Error('Storage disabled');}});
  });
  await fallback.goto(url);
  await fallback.locator('#fallback').waitFor({state:'visible'});
  await fallback.getByRole('button',{name:'Double distance A',exact:true}).click();
  await fallback.getByRole('button',{name:'Halve mass A',exact:true}).click();
  assert.equal(await fallback.locator('#beam-status').innerText(),'Balanced');
  await fallback.close();
  assert.deepEqual(errors,[],'no unhandled browser errors');
  assert.deepEqual(external,[],'all runtime assets are local');
  console.log('PASS: standalone root, GitHub Pages prefix, 3D interactions, mobile, WebGL/storage fallback and local assets.');
} catch(error) {
  await page.screenshot({path:'artifacts/browser-failure.png'});
  throw error;
} finally {await browser.close();server?.kill();}
