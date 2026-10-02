import assert from 'node:assert/strict';
import { exhibitSources } from './repository-exhibit-fixtures.mjs';
import { selectRepositoryGettingStarted } from '../assets/repository-exhibit.js';

export async function runRepositoryExhibitBrowserCases({run,ready,click,screenshot,delay,inside,outside}){
  const baseline=process.env.EXHIBIT_BASELINE==='1';
  const press=async(page,key,modifiers=0)=>{
    const code={' ':'Space'}[key]||key,keyCode={Enter:13,Escape:27,Tab:9,' ':32}[key]||0;
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers,windowsVirtualKeyCode:keyCode,...(key==='Enter'?{text:'\r'}:{})});
    await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers,windowsVirtualKeyCode:keyCode});
  };
  const enterOwner=async(page,name='Repolis')=>{
    await ready(page);
    await page.evaluate("if(!document.getElementById('intro').classList.contains('hidden'))document.getElementById('startBtn').click()");
    await delay(600);
    await page.evaluate(`__card(${JSON.stringify(name)})`);
    await page.until("document.getElementById('modal').classList.contains('show')");
    await click(page,'atelierBtn');await page.until(inside);await delay(300);
  };
  const readmeRequests=s=>s.requestInfo.filter(request=>request.method==='GET'&&/api\.github\.com\/repos\/.+\/readme\?/.test(request.url));
  const openReadme=async page=>{
    await click(page,'atelierExhibitRead');
    await page.until("__repositoryAtelier().exhibit.status!=='loading'",12000);
  };
  const touch=async(page,selector)=>{
    const point=await page.evaluate(`(()=>{
      const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'nearest'});
      const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
    })()`);
    assert(point.hit,'the touch lands on the named control, not a panel overlay');
    await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});
    await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const layout=page=>page.evaluate(`(()=>{
    const panel=document.getElementById('atelierExhibitPanel'),r=panel.getBoundingClientRect(),close=document.getElementById('atelierExhibitClose').getBoundingClientRect();
    return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight},
      fits:document.documentElement.scrollWidth<=innerWidth+1,closeVisible:close.y>=0&&close.bottom<=innerHeight,
      safeMarkup:!panel.querySelector('img,svg,iframe,video,script,[onclick],[onerror]'),
      sourceLinks:[...panel.querySelectorAll('a')].map(a=>a.href),focus:document.activeElement.id};
  })()`);
  for(const mobile of [false,true])for(const lang of ['ko','en']){
    const name=`exhibit-arrival-${lang}-${mobile?'mobile':'desktop'}`;
    await run({name,group:'exhibit',query:`?view=plaza&lang=${lang}&dbg=1`,lang,mobile,lowEnd:mobile,reduced:mobile},async s=>{
      const {page}=s;await ready(page);
      await page.evaluate("if(!document.getElementById('intro').classList.contains('hidden'))document.getElementById('startBtn').click()");
      await delay(700);
      await click(page,'menuBtn');
      await page.evaluate("document.querySelector('[data-intent=\"understand\"]').click()");
      await page.until("!document.getElementById('firstRepoPicker').hidden");
      await page.evaluate("document.getElementById('repoSearch').value='Repolis';document.getElementById('repoSearch').dispatchEvent(new Event('input',{bubbles:true}))");
      await page.until("document.querySelector('.firstRepoRow')");
      const originalDescription=await page.evaluate("document.querySelector('.firstRepoRow .firstRepoDescription').textContent");
      await page.evaluate("document.querySelector('.firstRepoRow').click()");
      await page.until(inside);await page.until('__browserGate.roomCpu.length>=100',20000);
      const state=await page.evaluate(`(()=>{
        const room=__repositoryAtelier(),p=__browserGate;
        const canvases=[];
        p.scene.traverse(o=>{const image=o.material?.map?.image;if(image?.dataset?.atelier&&!canvases.some(c=>c.name===image.dataset.atelier)){
          const bytes=image.getContext('2d').getImageData(0,0,image.width,image.height).data;let hash=2166136261;
          for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i],16777619);
          canvases.push({name:image.dataset.atelier,width:image.width,height:image.height,pixelHash:(hash>>>0).toString(16)});
        }});
        const stats=values=>{const v=values.slice(20).sort((a,b)=>a-b);return {samples:v.length,p50:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)]};};
        return {room,canvases,frame:{cpuSubmissionMs:stats(p.roomCpu),intervalMs:stats(p.roomIntervals)},description:document.getElementById('atelierPurposeText')?.textContent||null,
          owner:document.getElementById('atelierRepoName').textContent,services:REPOLIS_CONFIG.services};
      })()`);
      await screenshot(page,`${baseline?'before':'after'}-${name}`);
      if(!baseline){
        assert(state.owner==='hyeonsangjeon/Repolis');
        assert.equal(state.description,originalDescription);
        assert.equal(state.room.chat.calls,0);assert.equal(state.room.inRoomChat,false);
        assert.equal(state.room.resources.canvasTextures,3);
        assert.equal(state.room.render.exteriorCalls,0);
        assert.equal(s.requests.filter(url=>url.includes('/readme')).length,0,'arrival must not load documentation');
      }
      await click(page,'atelierExit');await page.until(outside);
      return {baseline,...state};
    });
  }
  if(baseline)return;
  for(const source of exhibitSources)for(const mobile of [false,true])for(const lang of ['ko','en']){
    const repo=source.repoName.split('/')[1],name=`exhibit-source-${repo}-${lang}-${mobile?'mobile':'desktop'}`;
    await run({name,group:'exhibit',query:'?dbg=1',lang,mobile,lowEnd:mobile,reduced:mobile,exhibitReadme:'source'},async s=>{
      const {page}=s;await enterOwner(page,repo);
      const before=await page.evaluate('__repositoryAtelier()');
      assert.equal(before.chat.calls,0);assert.equal(readmeRequests(s).length,0);
      await openReadme(page);
      const room=await page.evaluate('__repositoryAtelier()');
      assert.equal(room.exhibit.status,'ready');
      assert.equal(room.exhibit.source.repoName,source.repoName);
      assert.equal(room.exhibit.source.blobSha,source.sha);
      assert.equal(room.exhibit.source.ref,source.ref);
      assert.equal(room.exhibit.documentBytes,source.bytes);
      const expected=selectRepositoryGettingStarted(source.text).sections.flatMap(section=>section.blocks).filter(block=>block.type==='code').map(block=>block.text);
      const actual=await page.evaluate("[...document.querySelectorAll('#atelierExhibitContent pre code')].map(el=>el.textContent)");
      assert.deepEqual(actual,expected,'every displayed command exactly matches the public source fixture');
      assert.equal(readmeRequests(s).length,1);
      assert.equal(readmeRequests(s)[0].url,`https://api.github.com/repos/${source.repoName}/readme?ref=${source.ref}`);
      assert.deepEqual(room.resources,before.resources,'reading creates no scene resources or extra atlas');
      assert.equal(room.render.exteriorCalls,0);
      const state=await layout(page);assert(state.fits&&state.closeVisible&&state.safeMarkup);
      assert(state.sourceLinks.every(url=>/^https?:\/\//.test(url)),'only safe explicit links');
      const ax=await page.send('Accessibility.getFullAXTree'),dialog=ax.nodes.find(node=>!node.ignored&&node.role?.value==='dialog'&&node.name?.value.includes('README'));
      assert(dialog,'the original-text reader is an explicitly named accessible dialog');
      const byId=new Map(ax.nodes.map(node=>[node.nodeId,node])),descendants=[],todo=[dialog.nodeId];
      while(todo.length){const node=byId.get(todo.pop());if(!node)continue;descendants.push(node);todo.push(...node.childIds||[]);}
      const controls=descendants.filter(node=>!node.ignored&&['button','link'].includes(node.role?.value));
      assert(controls.length>3&&controls.every(node=>node.name?.value?.trim()),'all document controls have accessible names');
      const a11y={dialog:dialog.name.value,controls:controls.map(node=>({role:node.role.value,name:node.name.value})),
        documentLive:await page.evaluate("document.getElementById('atelierHud').getAttribute('aria-live')")};
      assert.equal(a11y.documentLive,null,'the whole source document is not a live announcement');
      await page.send('Page.bringToFront');
      if(mobile)await touch(page,'#atelierExhibitContent .exhibitCode button');
      else await page.evaluate("document.querySelector('#atelierExhibitContent .exhibitCode button').click()");
      await page.until("document.getElementById('atelierExhibitStatus').textContent.includes('copied')||document.getElementById('atelierExhibitStatus').textContent.includes('복사했습니다')");
      assert.equal(await page.evaluate('navigator.clipboard.readText()'),expected[0],'actual clipboard equals original code, including line endings');
      await page.evaluate("document.querySelector('#atelierExhibitContent .exhibitCode').scrollIntoView({block:'center'})");
      await screenshot(page,name+'-commands');
      if(mobile){await touch(page,'#atelierExhibitClose');await touch(page,'#atelierExhibitRead');}
      else {await click(page,'atelierExhibitClose');await openReadme(page);}
      assert.equal(readmeRequests(s).length,1,'panel reopen reads visit memory, not GitHub');
      await click(page,'atelierExhibitClose');await click(page,'atelierExit');await page.until(outside);
      const restored=await page.evaluate('__repositoryAtelier()');
      assert.deepEqual(restored.saved,restored.restored,'exact exterior camera and navigation restore');
      await click(page,'atelierBtn');await page.until(inside);
      assert.equal(await page.evaluate('__repositoryAtelier().exhibit.requestsStarted'),0,'new visit starts with empty document memory');
      assert.equal(await page.evaluate('__repositoryAtelier().chat.calls'),0,'new visit never spends a chat call');
      assert.equal(await page.evaluate('__repositoryAtelier().style.roomId'),before.style.roomId,'the same room is reused on reentry');
      assert.deepEqual(await page.evaluate('__repositoryAtelier().resources'),before.resources);
      await click(page,'atelierExit');await page.until(outside);
      return {source:{repoName:source.repoName,sha:source.sha,bytes:source.bytes,ref:source.ref},commands:expected.length,
        clipboardExact:true,readmeRequests:readmeRequests(s),room,layout:state,a11y};
    });
  }
  for(const mobile of [false,true])for(const lang of ['ko','en']){
    const name=`exhibit-controls-${lang}-${mobile?'mobile':'desktop'}`;
    await run({name,group:'exhibit',query:'?dbg=1',lang,mobile,lowEnd:mobile,reduced:mobile,exhibitReadme:'source'},async s=>{
      const {page}=s;await enterOwner(page);await page.evaluate("document.getElementById('atelierExhibitRead').focus()");await press(page,'Enter');
      await page.until("__repositoryAtelier().exhibit.status==='ready'");
      await page.evaluate("document.getElementById('atelierExhibitClose').focus()");
      await press(page,'Tab',8);
      assert.equal(await page.evaluate('document.activeElement.id'),'atelierExhibitQuestion','Shift+Tab wraps within the document dialog');
      await press(page,'Tab');
      assert.equal(await page.evaluate('document.activeElement.id'),'atelierExhibitClose');
      await page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true}))");
      assert(await page.evaluate('__repositoryAtelier().exhibit.panelOpen'),'IME Escape does not dismiss the reading surface');
      const sizes=mobile?[[844,390],[1440,900],[390,844]]:[[390,844],[844,390],[1440,900]];
      const layouts=[];
      for(const [width,height] of sizes){
        await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
        await delay(180);const state=await layout(page);layouts.push(state);
        assert(state.fits&&state.closeVisible&&state.rect.x>=0&&state.rect.y>=0&&state.rect.x+state.rect.width<=width+1);
      }
      const pose=await page.evaluate('JSON.stringify(__perf().player)');
      await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
      await delay(150);
      await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
      assert.equal(await page.evaluate('JSON.stringify(__perf().player)'),pose,'document owns movement keys');
      await page.evaluate("document.getElementById('atelierExit').focus()");await press(page,'Escape');await delay(100);
      assert(await page.evaluate(inside));assert.equal(await page.evaluate('document.activeElement.id'),'atelierExhibitRead');
      await openReadme(page);assert.equal(readmeRequests(s).length,1);
      await click(page,'atelierExhibitBlueprint');
      assert(await page.evaluate('__repositoryAtelier().blueprint.panelOpen&&!__repositoryAtelier().exhibit.panelOpen'));
      assert.equal(await page.evaluate('__repositoryAtelier().blueprint.requestsStarted'),0,'opening Blueprint does not scan');
      await press(page,'Escape');await delay(100);
      assert.equal(await page.evaluate('document.activeElement.id'),'atelierBlueprintToggle','Blueprint returns to a visible control, not the hidden document');
      await openReadme(page);await click(page,'atelierExhibitQuestion');await delay(120);
      assert(await page.evaluate('__repositoryAtelier().inRoomChat&&!__repositoryAtelier().exhibit.panelOpen'));
      assert.equal(await page.evaluate('__repositoryAtelier().chat.calls'),0);
      await press(page,'Escape');await delay(100);
      assert.equal(await page.evaluate('document.activeElement.id'),'atelierExhibitAsk','Gitber returns to the visible optional question control');
      await click(page,'atelierExit');await page.until(outside);await press(page,'Escape');
      assert.equal(await page.evaluate("document.getElementById('modal').classList.contains('show')"),false);
      return {layouts,readmeRequests:readmeRequests(s),chatCalls:0};
    });
  }
  for(const kind of ['missing','ko','hostile','404','403','429','timeout','oversized','malformed','mismatch','redirect']){
    const failure=['404','403','429','timeout','oversized','malformed','mismatch','redirect'].includes(kind);
    await run({name:`exhibit-document-${kind}`,group:'exhibit',query:'?repo=fixture-town/alpha&dbg=1',lang:'en',
      mobile:true,lowEnd:true,reduced:true,exhibitReadme:kind,...(failure?{failure:`readme-${kind}`}:{})},async s=>{
      const {page}=s;await enterOwner(page,'alpha');
      assert.equal(readmeRequests(s).length,0);
      await openReadme(page);
      const room=await page.evaluate('__repositoryAtelier()'),state=await layout(page);
      const expected={404:'not_found',403:'forbidden',429:'rate_limited',timeout:'timeout',oversized:'oversized',malformed:'malformed',mismatch:'scope_mismatch',redirect:'network'}[kind]||'ready';
      assert.equal(room.exhibit.status,expected);
      assert.equal(readmeRequests(s).length,1);
      assert(state.fits&&state.closeVisible&&state.safeMarkup);
      assert.deepEqual(s.errors,[],'intentional HTTP failures do not excuse a JavaScript exception');
      assert(!s.requests.some(url=>url.includes('blocked.invalid')),'redirect:error prevents any destination request');
      assert(s.networkErrors.every(error=>{
        if(error.source!=='network')return false;
        if(kind==='redirect')return /ERR_FAILED/.test(error.text)&&error.url==='https://blocked.invalid/repolis-document';
        const status={403:/403/,404:/404/,429:/429/,timeout:/ERR_ABORTED/}[kind];
        return !!status&&status.test(error.text)&&error.url?.includes('api.github.com/')&&error.url.includes('/readme?');
      }),'only the exact injected document resource failure is allowed');
      assert(!s.requests.some(url=>/tracking\.invalid|javascript:|data:text\/html/.test(url)),'untrusted media and URLs never load');
      const text=await page.evaluate("document.getElementById('atelierExhibitContent').textContent");
      assert(text.includes('No public description has been provided.'),'missing foreign description is not invented');
      if(kind==='missing')assert.equal(room.exhibit.sections.length,0);
      if(kind==='ko')assert(text.includes('이 예제는 테스트 환경에서만 실행합니다.'));
      if(kind==='hostile'){
        assert.equal(await page.evaluate('window.EXHIBIT_PWNED||0'),0);
        assert(text.includes('Windows only.')&&text.includes('<script>literal source, never execute</script>'));
      }
      await screenshot(page,`exhibit-document-${kind}`);
      await click(page,'atelierExhibitClose');await openReadme(page);assert.equal(readmeRequests(s).length,1,'failure is not silently retried');
      await click(page,'atelierExhibitClose');await click(page,'atelierExit');await page.until(outside);
      return {kind,room,layout:state,expectedResourceErrors:s.networkErrors};
    });
  }
  await run({name:'exhibit-strict-direct-atelier',group:'exhibit',query:'?repo=fixture-town/alpha&view=atelier&lang=en',
    lang:'en',mobile:true,direct:true,exhibitReadme:'source'},async s=>{
    const {page}=s;await ready(page);await page.until(inside);
    assert.equal(readmeRequests(s).length,0,'strict direct entry does not fetch documentation');
    assert.equal(await page.evaluate("document.getElementById('atelierRepoName').textContent"),'fixture-town/alpha');
    await touch(page,'#atelierExhibitRead');
    await page.until("document.getElementById('atelierExhibitContent').getAttribute('aria-busy')==='false'&&document.querySelector('#atelierExhibitContent code')");
    assert.equal(readmeRequests(s).length,1);
    const state=await layout(page);assert(state.fits&&state.safeMarkup);
    await touch(page,'#atelierExhibitClose');await click(page,'atelierExit');await page.until(outside);
    return {readmeRequests:readmeRequests(s),layout:state};
  });
  for(const kind of ['archived','empty']){
    await run({name:`exhibit-${kind}-repository`,group:'exhibit',query:'?repo=fixture-town/alpha&dbg=1',lang:'en',mobile:true,
      repoOverrides:{archived:kind==='archived',size:0,description:null,homepage:'https://example.org/project'},
      exhibitReadme:kind==='empty'?'404':'missing',...(kind==='empty'?{failure:'readme-404'}:{})},async s=>{
      const {page}=s;await enterOwner(page,'alpha');
      const homepage=await page.evaluate("({label:document.getElementById('atelierExhibitHomepage').textContent,url:document.getElementById('atelierExhibitHomepage').href})");
      assert.deepEqual(homepage,{label:'Homepage',url:'https://example.org/project'},'a homepage is not advertised as a live demo');
      await openReadme(page);const room=await page.evaluate('__repositoryAtelier()');
      assert.equal(room.exhibit.status,kind==='empty'?'not_found':'ready');
      if(kind==='archived')assert(await page.evaluate("document.getElementById('atelierExhibitContent').textContent.includes('Archived repository')"));
      assert.deepEqual(s.errors,[]);
      assert(s.networkErrors.every(error=>error.source==='network'&&/404/.test(error.text)&&error.url?.includes('/readme?')));
      await click(page,'atelierExit');await page.until(outside);
      return {kind,room,homepage};
    });
  }
  const longRepo='long-public-repository-name-'.repeat(3)+'example';
  await run({name:'exhibit-long-identity',group:'exhibit',query:`?repo=fixture-town/${longRepo}&dbg=1`,lang:'ko',mobile:true,
    repoOverrides:{name:longRepo,full_name:`fixture-town/${longRepo}`,description:'SourceDescriptionWithoutSpaces'.repeat(10)},exhibitReadme:'ko'},async s=>{
    const {page}=s;await enterOwner(page,longRepo);await openReadme(page);
    const state=await layout(page);assert(state.fits&&state.closeVisible);
    assert.equal(await page.evaluate("document.getElementById('atelierExhibitRepo').textContent"),`fixture-town/${longRepo}`);
    assert(await page.evaluate("(()=>{const el=document.getElementById('atelierExhibitRepo');return el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1})()"),'the exact long owner/repo remains readable, not clipped');
    await screenshot(page,'exhibit-long-identity');
    await click(page,'atelierExit');await page.until(outside);return {layout:state,exactRepo:`fixture-town/${longRepo}`};
  });
  await run({name:'exhibit-async-focus-and-copy',group:'exhibit',query:'?dbg=1',lang:'en',exhibitReadme:'deferred'},async s=>{
    const {page}=s;await enterOwner(page);await click(page,'atelierExhibitRead');
    await page.until("__repositoryAtelier().exhibit.status==='loading'");
    await page.exhibitPaused;
    await page.until("document.activeElement.id==='atelierExhibitClose'");
    await page.evaluate("document.querySelector('[data-exhibit-readme]').focus()");
    await page.exhibitRelease();
    await page.until("__repositoryAtelier().exhibit.status==='ready'");
    assert(await page.evaluate("document.activeElement.dataset.exhibitReadme==='true'"),'finishing a read preserves the focused source link');
    await page.evaluate("navigator.clipboard.writeText=()=>Promise.reject(new Error('Injected clipboard rejection'));document.querySelector('.exhibitCode button').click()");
    await page.until("document.getElementById('atelierExhibitStatus').textContent.includes('Copy failed')");
    await page.evaluate("navigator.clipboard.writeText=()=>new Promise(resolve=>{window.__finishExhibitCopy=resolve});document.querySelector('.exhibitCode button').click()");
    assert(await page.evaluate("document.querySelector('.exhibitCode button').disabled"),'one copy per code block can be pending');
    await click(page,'atelierExit');await page.until(outside);
    await page.evaluate("__card('youtube-dl-nas')");await click(page,'atelierBtn');await page.until(inside);
    await page.evaluate('__finishExhibitCopy()');await delay(50);
    assert.equal(await page.evaluate("document.getElementById('atelierExhibitStatus').textContent"),'','late copy cannot overwrite a new visit status');
    assert.equal(await page.evaluate('__repositoryAtelier().exhibit.requestsStarted'),0);
    await click(page,'atelierExit');await page.until(outside);
    return {sourceFocusPreserved:true,copyFailureVisible:true,staleCopyIgnored:true,readmeRequests:readmeRequests(s)};
  });
  await run({name:'exhibit-cancel-rebind',group:'exhibit',query:'?dbg=1',lang:'en',exhibitReadme:'pending'},async s=>{
    const {page}=s;await enterOwner(page);await click(page,'atelierExhibitRead');
    await page.until("__repositoryAtelier().exhibit.status==='loading'");
    await click(page,'atelierExit');await page.until(outside);
    await page.evaluate("__card('youtube-dl-nas')");await click(page,'atelierBtn');await page.until(inside);await delay(300);
    const room=await page.evaluate('__repositoryAtelier()');
    assert.equal(room.exhibit.status,'idle');assert.equal(room.exhibit.requestsStarted,0);assert.equal(room.exhibit.source,null);
    assert.equal(await page.evaluate("document.getElementById('atelierExhibitContent').textContent"),'');
    assert.equal(readmeRequests(s).length,1);
    await click(page,'atelierExit');await page.until(outside);
    return {readmeRequests:readmeRequests(s),newRoom:room};
  });
  await run({name:'exhibit-no-automatic-inference',group:'exhibit',query:'?dbg=1',lang:'en',atelierTransport:true,exhibitReadme:'source'},async s=>{
    await enterOwner(s.page);await openReadme(s.page);await click(s.page,'atelierExhibitQuestion');await delay(150);
    assert.equal(s.fixture.calls.length,0,'a configured local inference endpoint receives no request on entry/read/open chat');
    assert.equal(await s.page.evaluate('__repositoryAtelier().chat.calls'),0);
    await click(s.page,'atelierExit');await s.page.until(outside);
    return {actualModelCalls:0,localChatFixtureCalls:s.fixture.calls.length,readmeRequests:readmeRequests(s)};
  });
}
