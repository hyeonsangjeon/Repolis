import assert from 'node:assert/strict';

export async function runDiscoveryBrowserCases({run,ready,click,screenshot,delay,inside,outside}){
  const baseline=process.env.DISCOVERY_BASELINE==='1',prefix=baseline?'before':'after';
  const poseExpression=`({position:__browserGate.camera.position.toArray(),quaternion:__browserGate.camera.quaternion.toArray(),
    near:__browserGate.camera.near,far:__browserGate.camera.far,zoom:__browserGate.camera.zoom,
    view:__browserGate.camera.view?{...__browserGate.camera.view}:null,player:__pos()})`;
  const pose=page=>page.evaluate(poseExpression);
  const worldExpression=`({pose:${poseExpression},sky:__sky(),fog:{near:__browserGate.scene.fog.near,far:__browserGate.scene.fog.far},
    lod:__buildingLodPrototype().entries?.map(e=>({repo:e.repo,tier:e.tier,forced:e.forced})),controls:__cam()})`;
  async function sampleNode(page,point){
    const shot=await page.send('Page.captureScreenshot',{format:'png'});
    return page.evaluate(`(async()=>{const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(${JSON.stringify(shot.data)}),c=>c.charCodeAt(0))],{type:'image/png'}));
      const canvas=document.createElement('canvas');canvas.width=canvas.height=7;const ctx=canvas.getContext('2d');
      ctx.drawImage(bitmap,${Math.round(point.x)-3},${Math.round(point.y)-3},7,7,0,0,7,7);bitmap.close();return [...ctx.getImageData(0,0,7,7).data];})()`);
  }
  const layout=page=>page.evaluate(`(()=>{
    const rect=id=>{const e=document.getElementById(id);if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right,visible:r.y>=0&&r.bottom<=innerHeight&&r.x>=0&&r.right<=innerWidth};};
    return {viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth,
      card:rect('cardScroll'),title:rect('cardName'),description:rect('cardDesc'),primary:rect('atelierBtn'),close:rect('closeBtn'),search:rect('repoSearch'),
      blueprint:rect('atelierBlueprintPanel'),resources:{...__browserGate.renderer.info.memory,calls:__browserGate.renderer.info.render.calls},
      nodes:Array.from({length:__atelierBlueprint?.()?.nodes||0},(_,i)=>__atelierBlueprintPoint(i))};
  })()`);
  if(process.env.DISCOVERY_DEPTH_PROBE==='1'){
    for(const mobile of [false,true])await run({name:`discovery-depth-${mobile?'mobile':'desktop'}`,group:'discovery',query:'?dbg=1',lang:'en',mobile,lowEnd:mobile,reduced:true},async s=>{
      const {page}=s;await ready(page);await click(page,'startBtn');await delay(600);await page.evaluate('__growthOpen(null,false);__growthFinish()');await delay(2500);
      await page.evaluate('__freezeWorldForExposure(true)');
      const poseBefore=await pose(page);await screenshot(page,`depth-${mobile?'mobile':'desktop'}-near-original`);
      await page.evaluate('__browserGate.camera.near=5;__browserGate.camera.updateProjectionMatrix()');await delay(300);
      await screenshot(page,`depth-${mobile?'mobile':'desktop'}-near-5`);
      return {poseBefore,poseAfter:await pose(page)};
    });
    return;
  }
  for(const mobile of [false,true])for(const lang of ['ko','en']){
    const name=`discovery-${lang}-${mobile?'mobile':'desktop'}`;
    await run({name,group:'discovery',query:'?dbg=1',lang,mobile,lowEnd:mobile,reduced:mobile},async s=>{
      const {page}=s;await ready(page);await delay(350);
      await screenshot(page,`${prefix}-${name}-entry`);
      const entry=await page.evaluate("({ready:document.getElementById('loading').dataset.ready,intro:getComputedStyle(document.getElementById('intro')).backgroundColor,draws:__browserGate.draws})");
      await click(page,'startBtn');await delay(700);
      await click(page,'menuBtn');await delay(250);
      const menu=await layout(page);await screenshot(page,`${prefix}-${name}-menu`);
      if(!baseline){
        assert(menu.search.visible,'current-town search is visible without expanding feature lists');
        await page.evaluate("document.querySelector('#wayfindingTools > summary').focus()");
        await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
        await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        assert.equal(await page.evaluate("document.getElementById('wayfindingTools').open"),true,'feature disclosure works from the keyboard');
        assert.equal(await page.evaluate("['tourReplayBtn','questMenuBtn','creatorMenuBtn','repoRouteMenuBtn','growthMenuBtn','twinMenuBtn','postcardMenuBtn'].every(id=>document.getElementById(id).getClientRects().length>0)"),true,'all existing tools remain reachable');
      }
      await click(page,'menuBtn');
      const search=await page.evaluate("__taxiLocal('동영상 다운로드')");
      if(!baseline)assert.equal(search.repo,'youtube-dl-nas');
      if(!baseline&&process.env.DISCOVERY_RIDE==='1'&&lang==='ko'&&!mobile){
        await click(page,'taxiBtn');await page.evaluate("document.getElementById('chatText').focus()");
        await page.send('Input.insertText',{text:'동영상 다운로드'});await click(page,'chatSend');
        await page.until("document.querySelector('#chatLog .ride')");
        await page.evaluate("document.querySelector('#chatLog .ride').click()");
        await page.until("!__ride()&&__modal()",60000);
        assert((await page.evaluate("document.getElementById('cardStars').textContent")).includes('youtube-dl-nas'),'the actual chat ride reaches the matching repository');
      }else await page.evaluate("__card('youtube-dl-nas')");
      await delay(300);
      const card=await layout(page);await screenshot(page,`${prefix}-${name}-card`);
      if(!baseline){assert(card.primary.visible&&card.close.visible&&card.title.visible);assert(card.primary.height>=44);assert(!card.overflow);}
      await click(page,'atelierBtn');await page.until(inside);await delay(500);
      const before=await page.evaluate(`(()=>{const before=${poseExpression};document.getElementById('atelierBlueprintToggle').click();return before;})()`);
      await click(page,'atelierBlueprintScan');
      await page.until("['ready','partial','truncated'].includes(__atelierBlueprint().status)");await delay(800);
      const blueprint=await layout(page),state=await page.evaluate('__repositoryAtelier()');
      await screenshot(page,`${prefix}-${name}-blueprint`);
      if(!baseline){
        const free=blueprint.nodes.filter(p=>p&&p.x>10&&p.x<blueprint.viewport.width-10&&p.y>60&&p.y<blueprint.viewport.height-10
          &&!(p.x>=blueprint.blueprint.x&&p.x<=blueprint.blueprint.right&&p.y>=blueprint.blueprint.y&&p.y<=blueprint.blueprint.bottom));
        assert.equal(free.length,blueprint.nodes.length,'every fixture source node is visible outside the file panel');
        assert.equal(state.blueprint.requestsStarted,1);assert.equal(state.chat.calls,0);assert.equal(state.resources.canvasTextures,3);
        const shown=await sampleNode(page,blueprint.nodes[0]);
        await page.evaluate("__browserGate.scene.getObjectByName('RepositoryBlueprintTable').visible=false");await delay(120);
        const hidden=await sampleNode(page,blueprint.nodes[0]);
        await page.evaluate("__browserGate.scene.getObjectByName('RepositoryBlueprintTable').visible=true");
        blueprint.rootPixelDifference=shown.reduce((sum,value,i)=>sum+Math.abs(value-hidden[i]),0)/shown.length;
        assert(blueprint.rootPixelDifference>20,'the selected source node is actually painted, not only projected into view');
        const framed=await pose(page);await page.evaluate('__atelierBlueprintFocus(1)');assert.deepEqual(await pose(page),framed,'selection does not move the camera');
        if(mobile){
          await page.evaluate("document.querySelector('#atelierBlueprintFiles > summary').click()");await delay(150);
          await screenshot(page,`${prefix}-${name}-blueprint-files`);
          assert(await page.evaluate("document.getElementById('atelierBlueprintOutline').clientHeight>20"),'expanded mobile file list has usable scroll space');
          await page.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await delay(250);
          const landscape=await layout(page);await screenshot(page,`${prefix}-${name}-blueprint-landscape`);
          assert(landscape.nodes.every(p=>p.x>0&&p.x<landscape.blueprint.x&&p.y>60&&p.y<390),'rotation keeps the model outside the file panel');
          await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(250);
        }
      }
      const closedPose=await page.evaluate(`document.getElementById('atelierBlueprintClose').click();${poseExpression}`);
      if(!baseline)assert.deepEqual(closedPose,before,'source-map close restores the exact room pose synchronously');
      await click(page,'atelierExit');await page.until(outside);await delay(400);
      if(await page.evaluate("document.getElementById('modal').classList.contains('show')"))await click(page,'closeBtn');
      await page.evaluate('__sky(.38);__freezeWorldForExposure(false)');
      const growthBefore=await page.evaluate(`(()=>{const before=${worldExpression};__growthOpen(null,false);return before;})()`);await delay(400);
      const growth=[];
      for(const step of [0,3,999]){
        await page.evaluate(`__growthStep(Math.min(${step},__townGrowth().steps-1))`);await delay(2200);
        growth.push(await page.evaluate(`(()=>{const frames=__perfHistory(60),median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)]??null;
          const materials=new Set(),geometries=new Set();let objects=0;__browserGate.scene.traverse(o=>{objects++;if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m);});
          return {...__townGrowth(),measured:{...__browserGate.renderer.info.memory,calls:__browserGate.renderer.info.render.calls,materials:materials.size,geometries:geometries.size,objects,
            samples:frames.length,renderMedian:median(frames.map(f=>f.renderMs)),cadenceMedian:median(frames.map(f=>f.cadenceMs))}};})()`));
        await screenshot(page,`${prefix}-${name}-growth-${step}`);
      }
      if(mobile){
        await page.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await delay(400);
        await screenshot(page,`${prefix}-${name}-growth-landscape`);
        if(!baseline)assert(await page.evaluate(`(()=>{const r=document.querySelector('#growthReplay .growthPanel').getBoundingClientRect(),v=__browserGate.camera.view;
          return r.left>innerWidth*.5&&r.top<100&&r.bottom<=innerHeight&&innerWidth/2-v.offsetX<r.left;})()`),'landscape keeps replay controls beside the visible town, not over it');
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(250);
      }
      const restored=await page.evaluate(`__growthClose();${worldExpression}`);
      if(!baseline)assert.deepEqual(restored,growthBefore,'growth restores camera planes, pose and player');
      const url=await page.evaluate('location.href');
      await page.send('Page.navigate',{url});await ready(page);
      assert.equal(await page.evaluate("document.getElementById('intro').classList.contains('hidden')"),false,'returning ordinary visits still offer entry');
      await click(page,'startBtn');
      assert.equal(await page.evaluate("__events().filter(e=>e.ev==='town_enter').length"),1,'a returning document records one explicit entry');
      return {entry,menu,search,card,blueprint,room:state,growth,baseline,returnVisit:true,rideVerified:process.env.DISCOVERY_RIDE==='1'&&lang==='ko'&&!mobile};
    });
  }
  if(!baseline)for(const mobile of [false,true]){
    const name='long-repository-name-'.repeat(4),description='SourceDescriptionWithoutSpaces'.repeat(18);
    await run({name:`discovery-long-archived-${mobile?'mobile':'desktop'}`,group:'discovery',query:`?repo=fixture-town/${name}&dbg=1`,
      lang:mobile?'ko':'en',mobile,lowEnd:mobile,reduced:mobile,repoOverrides:{name,full_name:`fixture-town/${name}`,description,archived:true,homepage:null}},async s=>{
      const {page}=s;await ready(page);await click(page,'startBtn');await page.until(inside);
      await click(page,'atelierExit');await page.until(outside);await page.evaluate(`__card(${JSON.stringify(name)})`);await delay(250);
      const card=await layout(page);await screenshot(page,`after-discovery-long-archived-${mobile?'mobile':'desktop'}`);
      assert(card.primary.visible&&card.close.visible&&card.title.visible&&!card.overflow,'long identity and primary action fit');
      assert.equal(await page.evaluate("document.getElementById('cardDesc').textContent"),description.slice(0,500),'the complete public projection remains scrollable within the existing 500-character input bound');
      assert.equal(await page.evaluate("document.querySelector('#cardActions .live')===null"),true,'missing homepage does not invent a demo');
      assert.equal(await page.evaluate("document.querySelector('#cardExtraActions .gh').href"),`https://github.com/fixture-town/${name}`);
      return {card,archived:true,foreign:true};
    });
  }
}
