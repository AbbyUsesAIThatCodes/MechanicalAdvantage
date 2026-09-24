import assert from 'node:assert/strict';
// Runs inside the repository's existing browser CI and software-WebGL configuration.
export async function verifyMetric(page, root) {
  await page.setViewportSize({width:1366,height:768});
  await page.goto(root);
  await page.waitForFunction(()=>document.querySelector('#app').dataset.ready==='true');
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  await page.getByRole('button',{name:'Double distance A',exact:true}).click();
  assert.equal(await page.locator('#beam-status').innerText(),'Weight A dips');
  await page.getByRole('button',{name:'Halve mass A',exact:true}).click();
  assert.equal(await page.locator('#beam-status').innerText(),'Balanced');
  await page.getByRole('combobox',{name:'Try',exact:true}).selectOption('double');
  assert.equal(await page.locator('#mass-a').inputValue(),'100');
  assert.equal(await page.locator('#mass-b').inputValue(),'200');
  await page.mouse.move(1020,65);await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));
  await page.screenshot({path:'artifacts/metric-workshop.png'});
  const tag=page.locator('[data-select="a"]');
  await tag.click();
  await page.screenshot({path:'artifacts/metric-selected.png'});
  await tag.press('ArrowUp');
  assert.equal(await page.locator('#mass-a').inputValue(),'125');
  await tag.press('ArrowDown');
  await page.getByRole('button',{name:'Hold level',exact:true}).click();
  assert.equal(await page.locator('#beam-status').innerText(),'Held level');
  await page.getByRole('button',{name:'Release',exact:true}).click();
  assert.equal(await page.locator('#beam-status').innerText(),'Balanced');
  // Direct label drag and vertical mass handle both use pointer capture.
  const box=await tag.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();await page.mouse.move(box.x+box.width/2+90,box.y+box.height/2,{steps:10});await page.mouse.up();
  assert.ok(Number(await page.locator('#distance-a').inputValue())<200);
  const grip=await page.locator('[data-massdrag="a"]').boundingBox();
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2-25,{steps:10});await page.mouse.up();
  assert.ok(Number(await page.locator('#mass-a').inputValue())>100);
  await page.getByRole('button',{name:'Hide math',exact:true}).click();assert.equal(await page.locator('#math-panel').isVisible(),false);
  await page.getByRole('button',{name:'Show math',exact:true}).click();
  await page.getByRole('combobox',{name:'Try',exact:true}).selectOption('triple');
  await page.getByRole('tab',{name:'Grams → newtons'}).click();
  assert.match(await page.locator('#force-math').innerText(),/2\.943 N/);
  await page.mouse.move(1020,65);await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));
  await page.screenshot({path:'artifacts/metric-newtons.png'});
  await page.getByRole('tab',{name:'Balance & advantage'}).click();
  await page.getByRole('button',{name:'Orbit ↻'}).click();await page.getByRole('button',{name:'Orbit ↻'}).click();
  await page.getByRole('combobox',{name:'Try',exact:true}).selectOption('equal');
  await tag.click();await page.getByRole('button',{name:'Move A right',exact:true}).click();
  assert.equal(await page.locator('#distance-a').inputValue(),'175','screen-right reverses after half orbit');
  await page.getByRole('button',{name:'Fit view'}).click();
  // Regression: wrapping the required-mass note and toggling math must never
  // change canvas dimensions, its drawing buffer, or the lever's projection.
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  await page.getByRole('button',{name:'Hold level',exact:true}).click();
  const setNumber=async(id,value)=>{await page.locator(id).fill(String(value));await page.locator(id).press('Tab');};
  await setNumber('#distance-a',175);
  assert.match(await page.locator('#balance-math').innerText(),/outside the available/);
  const viewport=()=>page.evaluate(()=>{
    const canvas=document.querySelector('#scene canvas'),r=canvas.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height,buffer:[canvas.width,canvas.height],projection:document.querySelector('#measure-a path').getAttribute('d')};
  });
  const before=await viewport();
  assert.equal(before.width,1366);assert.equal(before.height,768);assert.equal(before.x,0);assert.equal(before.y,0);
  await setNumber('#mass-b',175);
  assert.match(await page.locator('#balance-math').innerText(),/Try it, then release/);
  assert.deepEqual(await viewport(),before,'changing note length does not resize or reframe');
  await page.getByRole('button',{name:'Hide math',exact:true}).click();
  await page.waitForTimeout(150);
  assert.deepEqual(await viewport(),before,'hiding math does not resize or reframe');
  await page.screenshot({path:'artifacts/metric-immersive.png'});
  await page.getByRole('button',{name:'Show math',exact:true}).click();
  await page.getByRole('tab',{name:'Grams → newtons'}).click();
  await page.waitForTimeout(150);
  assert.deepEqual(await viewport(),before,'switching math tabs does not resize or reframe');
  await page.getByRole('tab',{name:'Balance & advantage'}).click();
  const toolbar=await page.locator('.lab-tools').boundingBox();assert.ok(toolbar.y+toolbar.height<160,'camera and balance controls at top');
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  await tag.click();
  // Callouts stay above the rail and separate through side and reverse views.
  for(let i=0;i<4;i++){
    const a=await page.locator('[data-part="a"]').boundingBox(),b=await page.locator('[data-part="b"]').boundingBox();
    assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x,'weight callouts remain separate');
    for(const p of ['a','b']){
      const tagBox=await page.locator(`[data-part="${p}"]`).boundingBox();
      const point=await page.locator(`[data-leader="${p}"]`).evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength());return {x:p.x,y:p.y};});
      assert.ok(tagBox.y+tagBox.height<point.y-15,'label and arrows clear the carriage');
    }
    if(i===2)await page.screenshot({path:'artifacts/metric-rear.png'});
    await page.getByRole('button',{name:'Orbit ↻'}).click();
  }
  await page.getByRole('button',{name:'Side view'}).click();
  await page.screenshot({path:'artifacts/metric-side.png'});
  await page.getByRole('button',{name:'Fit view'}).click();
  for(const size of [{width:390,height:844},{width:844,height:390},{width:1024,height:768}]){
    await page.setViewportSize(size);
    await page.waitForTimeout(200);
    const compact=size.width<=900||size.height<=660;
    const canvas=await page.locator('#scene canvas').boundingBox();
    assert.equal(canvas.width,size.width);assert.equal(canvas.height,size.height);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),'viewport has no document overflow');
    if(compact){
      await page.getByRole('button',{name:'Weights',exact:true}).click();
      await page.getByRole('button',{name:'Double mass A',exact:true}).click();
      await page.getByRole('button',{name:'Close weights',exact:true}).click();
      await page.getByRole('tab',{name:'Grams → newtons'}).click();
      await page.locator('#force-math .note').last().scrollIntoViewIfNeeded();
      await page.getByRole('tab',{name:'Balance & advantage'}).click();
    }
    await page.mouse.move(0,0);await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));
    await page.screenshot({path:`artifacts/metric-${size.width}x${size.height}.png`});
  }
  await page.setViewportSize({width:1366,height:768});
  console.log('PASS: metric 3D interactions, stable full-screen viewport, wrapping notes, overlays, callout clearance, reverse view, conversions and compact trays.');
}
