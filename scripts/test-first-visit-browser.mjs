/* Local-only browser gate. Requires an existing static server and isolated Chrome CDP endpoint.
 * REPOLIS_TEST_URL=http://127.0.0.1:8000/ BROWSER_CDP_URL=http://127.0.0.1:9222 node scripts/test-first-visit-browser.mjs
 * FIRST_VISIT_GROUP=matrix|failures|policy|viewport and FIRST_VISIT_CASE=<substring> select a smaller run.
 * FIRST_VISIT_REFERENCE=<commit SHA> replays only viewport observations against historical HTML.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createRepositoryBlueprintDeepLink, parseRepoPortalInput } from '../assets/repo-portal.js';
import { createRepoRouteUrl } from '../assets/repo-route.js';

const base=new URL(process.env.REPOLIS_TEST_URL||'http://127.0.0.1:8000/');
const endpoint=new URL(process.env.BROWSER_CDP_URL||'http://127.0.0.1:9222/');
for(const url of [base,endpoint]) assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Failure injection is local-only');
const output=process.env.FIRST_VISIT_OUTPUT||await mkdtemp(join(tmpdir(),'repolis-first-visit-'));
await mkdir(output,{recursive:true});
const results=[],group=process.env.FIRST_VISIT_GROUP||'',only=process.env.FIRST_VISIT_CASE||'';
const reference=process.env.FIRST_VISIT_REFERENCE||'';
assert(['','matrix','failures','policy','viewport'].includes(group),'Unknown browser gate group');
if(reference) assert(group==='viewport'&&/^[a-f0-9]{7,40}$/.test(reference),'Historical observations require a commit SHA and the viewport group');
const referenceHtml=reference?execFileSync('git',['show',`${reference}:index.html`],{encoding:'utf8',maxBuffer:5*1024*1024}):null;
const version=await (await fetch(new URL('/json/version',endpoint))).json();
const ownerCatalog=JSON.parse(await readFile(new URL('../repos.json',import.meta.url),'utf8'));
const ownerRepo=ownerCatalog.find(repo=>repo.repo==='Repolis')||ownerCatalog[0];
const target=parseRepoPortalInput('fixture-town/alpha');
const publicRepo=(name,index=0)=>({name,full_name:`fixture-town/${name}`,owner:{login:'fixture-town'},private:false,
  description:index?'Existing public repository description':null,language:'JavaScript',topics:['fixture'],archived:index===2,
  stargazers_count:20-index,forks_count:1,size:10,created_at:`${2020+index}-01-01T00:00:00Z`,pushed_at:'2026-09-01T00:00:00Z',default_branch:'main'});
const publicCatalog=['alpha','beta','archive'].map(publicRepo);
const treeItem=(path,type='blob')=>({path,type,sha:'a'.repeat(40),mode:type==='tree'?'040000':'100644',
  url:`https://api.github.com/repos/fixture-town/alpha/git/${type==='tree'?'trees':'blobs'}/${'a'.repeat(40)}`});
const tree={sha:'a'.repeat(40),url:`https://api.github.com/repos/fixture-town/alpha/git/trees/${'a'.repeat(40)}`,
  truncated:false,tree:[treeItem('src','tree'),treeItem('src/entry.js'),treeItem('README.md')]};
const probe=`(${function(){
  let seed=120121122;
  Math.random=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const NativeDate=Date,fixed=Date.parse('2026-09-08T14:00:00Z');
  window.Date=class extends NativeDate{ constructor(...args){super(...(args.length?args:[fixed]));} static now(){return fixed;} };
  window.__browserGate={draws:0,firstDraw:null};
  window.__THREE_DEVTOOLS__=new EventTarget();
  __THREE_DEVTOOLS__.addEventListener('observe',event=>{
    const renderer=event.detail; if(!renderer.isWebGLRenderer) return;
    __browserGate.renderer=renderer; const render=renderer.render;
    renderer.render=function(scene,camera){
      const result=render.call(this,scene,camera);
      if(scene.isScene&&camera.isPerspectiveCamera){ __browserGate.draws++; __browserGate.firstDraw??=performance.now(); __browserGate.scene=scene; __browserGate.camera=camera; }
      return result;
    };
  });
}.toString()})();`;

class CDP{
  constructor(url){
    this.socket=new WebSocket(url); this.pending=new Map(); this.handlers=new Map(); this.sequence=0;
    this.ready=new Promise((resolve,reject)=>{ this.socket.addEventListener('open',resolve,{once:true}); this.socket.addEventListener('error',reject,{once:true}); });
    this.socket.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(message.id){
        const item=this.pending.get(message.id); if(!item) return;
        clearTimeout(item.timer); this.pending.delete(message.id);
        if(message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result);
      }else for(const handler of this.handlers.get(message.method)||[]) handler(message.params);
    });
  }
  async send(method,params={}){
    await this.ready; const id=++this.sequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{ this.pending.delete(id); reject(new Error('CDP deadline: '+method)); },60000);
      this.pending.set(id,{resolve,reject,timer}); this.socket.send(JSON.stringify({id,method,params}));
    });
  }
  on(name,handler){ const list=this.handlers.get(name)||[]; list.push(handler); this.handlers.set(name,list); }
  async evaluate(expression){
    const result=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  }
  async until(expression,timeout=12000){
    const end=Date.now()+timeout;
    while(Date.now()<end){ const value=await this.evaluate(expression); if(value) return value; await delay(80); }
    throw new Error('Condition timed out: '+expression.slice(0,150));
  }
  close(){ this.socket.close(); }
}

async function session(test){
  const browser=new CDP(version.webSocketDebuggerUrl),context=await browser.send('Target.createBrowserContext');
  const tab=await browser.send('Target.createTarget',{url:'about:blank',browserContextId:context.browserContextId});
  const tabs=await (await fetch(new URL('/json/list',endpoint))).json();
  const page=new CDP(tabs.find(item=>item.id===tab.targetId).webSocketDebuggerUrl);
  const errors=[],networkErrors=[],requests=[],requestInfo=[],interceptionErrors=[]; let failedRequests=0;
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Network.enable'); await page.send('Log.enable');
  page.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails.exception?.description||event.exceptionDetails.text));
  page.on('Runtime.consoleAPICalled',event=>{ if(event.type==='error') errors.push(event.args.map(arg=>arg.description||arg.value).join(' ')); });
  page.on('Log.entryAdded',event=>{ if(event.entry.level==='error') networkErrors.push({source:event.entry.source,text:event.entry.text}); });
  page.on('Network.requestWillBeSent',event=>{ requests.push(event.request.url); requestInfo.push({url:event.request.url,method:event.request.method}); });
  const fulfill=(event,status,body,contentType='application/json')=>page.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:status,
    responseHeaders:[{name:'Content-Type',value:contentType},{name:'Access-Control-Allow-Origin',value:'*'},
      {name:'Access-Control-Allow-Headers',value:'accept,x-github-api-version'},{name:'Access-Control-Allow-Methods',value:'GET,OPTIONS'}],
    body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')});
  const intercept=async event=>{
    const url=new URL(event.request.url),fail=test.failure;
    if(referenceHtml&&url.origin===base.origin&&url.pathname===base.pathname) return fulfill(event,200,referenceHtml,'text/html');
    if(test.failPath&&url.pathname.endsWith(test.failPath)&&(!test.retry||failedRequests===0)){
      failedRequests++;
      if(fail==='hung-module'||fail==='hung-static') return;
      if(fail==='malformed-static') return fulfill(event,200,'{');
      return fulfill(event,404,{message:'Local test: missing resource'});
    }
    if(url.hostname==='api.github.com'){
      if(event.request.method==='OPTIONS') return fulfill(event,204,'');
      if(fail&&fail.startsWith('api-')&&(!test.retry||failedRequests===0)){
        failedRequests++;
        if(fail==='api-hung') return;
        if(fail==='api-malformed') return fulfill(event,200,'{');
        if(fail==='api-shape') return fulfill(event,200,{message:'Not a catalog'});
        if(fail==='api-oversized') return fulfill(event,200,' '.repeat(2*1024*1024+1));
        return fulfill(event,Number(fail.slice(4)),{message:'Local test: public API failure'});
      }
      if(test.slow&&!failedRequests){ failedRequests++; await delay(1800); }
      if(url.pathname.includes('/git/trees/')) return fulfill(event,200,tree);
      if(url.pathname.startsWith('/users/')) return fulfill(event,200,test.empty?[]:publicCatalog);
      if(test.mismatched) return fulfill(event,200,{...publicRepo('alpha'),full_name:'wrong-owner/alpha',owner:{login:'wrong-owner'}});
      return fulfill(event,200,publicRepo('alpha'));
    }
    return page.send('Fetch.continueRequest',{requestId:event.requestId});
  };
  page.on('Fetch.requestPaused',event=>{ intercept(event).catch(error=>interceptionErrors.push(String(error))); });
  await page.send('Fetch.enable',{patterns:[{urlPattern:'*api.github.com/*'},...(test.failPath?[{urlPattern:'*'+test.failPath+'*'}]:[]),
    ...(referenceHtml?[{urlPattern:base.origin+base.pathname+'*',resourceType:'Document'}]:[])]});
  await page.send('Network.setBlockedURLs',{urls:['*workers.dev*']});
  await page.send('Emulation.setDeviceMetricsOverride',{width:test.mobile?390:1440,height:test.mobile?844:900,deviceScaleFactor:1,mobile:!!test.mobile});
  await page.send('Emulation.setTouchEmulationEnabled',{enabled:!!test.mobile});
  if(test.reduced) await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const stored=test.direct?(test.lang==='ko'?'en':'ko'):test.lang;
  let source=probe+`\nlocalStorage.setItem('repolisLang','${stored}');`;
  if(test.lowEnd) source+="\nObject.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});Object.defineProperty(navigator,'deviceMemory',{get:()=>4});";
  if(test.failure==='webgl') source+=`\nconst nativeContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:nativeContext.call(this,type,...args);};`;
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source});
  return {page,errors,networkErrors,requests,requestInfo,interceptionErrors,
    async close(){ page.close(); await browser.send('Target.disposeBrowserContext',context); browser.close(); }};
}

const visible=id=>`(()=>{const el=document.getElementById('${id}');if(!el)return false;const s=getComputedStyle(el);return !el.hidden&&!el.classList.contains('hidden')&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.01;})()`;
const inside="document.body.classList.contains('atelier-active')&&!document.getElementById('atelierFade').classList.contains('blocking')";
const outside="!document.body.classList.contains('atelier-active')&&!document.getElementById('atelierFade').classList.contains('blocking')";
const apiRequests=s=>s.requestInfo.filter(item=>item.method==='GET'&&new URL(item.url).hostname==='api.github.com').map(item=>item.url);
const treeRequests=s=>apiRequests(s).filter(url=>url.includes('/git/trees/'));
async function click(page,id){ await page.evaluate(`document.getElementById('${id}').click()`); }
async function snapshot(page){
  return page.evaluate(`({
    lang:document.documentElement.lang,ready:document.getElementById('loading').dataset.ready||false,
    blocked:window.REPOLIS_ARRIVAL?.blocked,reason:document.getElementById('cityError').dataset.reason||null,
    message:document.getElementById('ceMsg').textContent,blueprintStatus:document.getElementById('atelierBlueprintStatus').textContent,focus:document.activeElement.id,
    city:window.__city?.(),portal:window.__repoPortal?.(),
    entries:window.__events?.().filter(event=>event.ev==='town_enter').length,
    pageLoads:window.__events?.().filter(event=>event.ev==='page_load').length,
    firstDraw:window.__browserGate?.firstDraw,
    resources:window.__browserGate?.renderer?{...__browserGate.renderer.info.memory,programs:__browserGate.renderer.info.programs.length}:null,
    services:window.REPOLIS_CONFIG?.services
  })`);
}
async function screenshot(page,name){
  const image=await page.send('Page.captureScreenshot',{format:'jpeg',quality:72});
  await writeFile(join(output,name+'.jpg'),Buffer.from(image.data,'base64'));
}
async function ready(page){
  await page.until("document.getElementById('loading')?.dataset.ready==='true'||window.REPOLIS_ARRIVAL?.blocked",55000);
  assert.equal(await page.evaluate('REPOLIS_ARRIVAL.blocked'),false,JSON.stringify(await snapshot(page)));
}
async function assertOneEntry(page){
  await click(page,'startBtn'); await click(page,'startBtn');
  assert.equal(await page.evaluate("__events().filter(event=>event.ev==='town_enter').length"),1,'repeated activation cannot duplicate entry');
  assert.equal(await page.evaluate("__events().filter(event=>event.ev==='page_load').length"),1,'one page load per document');
}
async function run(test,work){
  if((group&&group!==test.group)||(only&&!test.name.includes(only))) return;
  const s=await session(test); let result;
  try{
    await s.page.send('Page.navigate',{url:new URL(test.query||'',base).href});
    const evidence=await work(s,test);
    const state=await snapshot(s.page);
    assert.equal(state.lang,test.lang,'initial language matches the route or existing language preference');
    assert.equal(s.requests.filter(url=>url.includes('workers.dev')).length,0,'no upstream service traffic');
    if(state.services) assert(Object.values(state.services).every(value=>!value),'localhost optional services stay closed');
    assert.equal(s.interceptionErrors.length,0,JSON.stringify(s.interceptionErrors));
    if(!test.failure){ assert.deepEqual(s.errors,[]); assert.deepEqual(s.networkErrors,[]); }
    result={name:test.name,group:test.group,ok:true,emulation:{mobile:!!test.mobile,lowEnd:!!test.lowEnd,reduced:!!test.reduced},
      state,requests:s.requests.length,apiRequests:apiRequests(s),preflights:s.requestInfo.filter(item=>item.method==='OPTIONS').length,
      consoleErrors:s.errors,resourceErrors:s.networkErrors,evidence};
    console.log(JSON.stringify({name:test.name,ok:true,requests:result.requests,apiRequests:result.apiRequests.length,expectedErrors:s.errors.length+s.networkErrors.length}));
  }catch(error){
    result={name:test.name,group:test.group,ok:false,error:String(error),state:await snapshot(s.page),consoleErrors:s.errors,resourceErrors:s.networkErrors};
    await screenshot(s.page,'failed-'+test.name);
    console.error(JSON.stringify(result)); throw error;
  }finally{
    if(result){ results.push(result); await writeFile(join(output,'results.json'),JSON.stringify({browser:version.Browser,at:new Date().toISOString(),base:base.href,reference:reference||null,results},null,2)); }
    await s.close();
  }
}

for(const mobile of [false,true]) for(const lang of ['en','ko']){
  const suffix=`${lang}-${mobile?'mobile':'desktop'}`;
  for(const kind of ['default','launch','plaza','public','portal','atelier','blueprint','route','focus','growth']){
    const queries={
      default:'',launch:'?launch=1',plaza:`?view=plaza&lang=${lang}`,public:'?user=fixture-town',
      portal:'?repo=fixture-town/alpha&user=wrong-town',atelier:`?repo=fixture-town/alpha&view=atelier&lang=${lang}`,
      blueprint:new URL(createRepositoryBlueprintDeepLink(target,'src/entry.js',base.href)).search,
      route:new URL(createRepoRouteUrl('fixture-town',['alpha','beta'],base.href,'hyeonsangjeon')).search,
      focus:'?user=fixture-town&focus=beta&ref=repo-portal',growth:'?user=fixture-town&growth=2020'
    };
    await run({name:`${kind}-${suffix}`,group:'matrix',kind,query:queries[kind],lang,mobile,direct:['plaza','atelier'].includes(kind)},async(s,test)=>{
      const {page}=s; await ready(page);
      assert(await page.evaluate('__browserGate.firstDraw>0'),'a real scene has been rendered');
      if(!test.direct){
        assert(await page.evaluate(visible('intro')),'ordinary links retain confirmation');
        if(kind==='launch') assert.equal(await page.evaluate('document.activeElement.id'),'introUser','launch input receives focus after readiness');
        assert.equal(treeRequests(s).length,0,'Blueprint remains unrequested at confirmation');
        await click(page,kind==='blueprint'?'introBlueprintLoad':'startBtn');
      }
      if(['portal','atelier','blueprint','focus'].includes(kind)){
        await page.until(inside);
        const expected=kind==='focus'?'fixture-town/beta':'fixture-town/alpha';
        assert.equal(await page.evaluate("document.getElementById('atelierPortalGithub').href"),'https://github.com/'+expected);
        if(kind==='blueprint'){
          await page.until("document.querySelectorAll('#atelierBlueprintOutline [data-blueprint-index]').length>0||document.getElementById('atelierBlueprintStatus').dataset.tone==='error'");
          assert(await page.evaluate("document.querySelectorAll('#atelierBlueprintOutline [data-blueprint-index]').length>0"),JSON.stringify(await snapshot(page)));
          assert.equal(treeRequests(s).length,1,'explicit confirmation starts exactly one Tree request');
          assert((await page.evaluate("document.querySelector('#atelierBlueprintOutline [aria-current=\"true\"]')?.textContent")).includes('entry.js'),'Blueprint restores the exact shared path');
          await click(page,'atelierBlueprintClose');
        }else assert.equal(treeRequests(s).length,0);
        await assertOneEntry(page);
        await click(page,'atelierExit'); await page.until(outside);
        assert.equal(await page.evaluate('__city().user'),'fixture-town','exit retains the loaded town owner');
      }else{
        await assertOneEntry(page);
        if(kind==='route'){
          await page.until(visible('repoRouteHud'));
          await click(page,'repoRouteHudClose');
          assert.equal(await page.evaluate("document.getElementById('repoRouteHud').classList.contains('hidden')"),true);
        }else if(kind==='growth'){
          await page.until(visible('growthReplay'));
          await click(page,'growthClose');
          await page.until("document.getElementById('growthReplay').classList.contains('hidden')");
        }
      }
      if(['public','portal','atelier','focus','route','growth'].includes(kind)) assert.equal(apiRequests(s).length,1,'one existing public data request');
      assert.equal(await page.evaluate('REPOLIS_ARRIVAL.blocked'),false);
    });
  }
  await run({name:`blueprint-cancel-${suffix}`,group:'matrix',query:new URL(createRepositoryBlueprintDeepLink(target,'src/entry.js',base.href)).search,lang,mobile},async(s)=>{
    await ready(s.page); await click(s.page,'introBlueprintTown'); await delay(1300);
    assert.equal(await s.page.evaluate("document.body.classList.contains('atelier-active')"),false,'Enter town instead must not enter the exhibition');
    assert.equal(treeRequests(s).length,0,'cancelling Blueprint performs no scan');
    await assertOneEntry(s.page);
  });
}

const failures=[
  {name:'required-script',failure:'script',failPath:'/scholars.js',query:'?view=plaza&lang=en',direct:true},
  {name:'required-module',failure:'module',failPath:'/assets/repo-route.js',query:'?view=plaza&lang=ko',direct:true,lang:'ko',mobile:true},
  {name:'module-watchdog',failure:'hung-module',failPath:'/assets/repo-route.js',query:'?launch=1'},
  {name:'optional-static',failure:'optional',failPath:'/council/council.config.json',optional:true},
  {name:'optional-deadline',failure:'hung-static',failPath:'/data/lore/fragments.json',optional:true,lang:'ko',mobile:true},
  {name:'catalog-malformed',failure:'malformed-static',failPath:'/repos.json'},
  {name:'catalog-missing',failure:'static',failPath:'/repos.json',lang:'ko',mobile:true},
  {name:'webgl-unavailable',failure:'webgl',query:'?repo=fixture-town/alpha&view=atelier&lang=en',direct:true},
  ...[403,429,404].flatMap(status=>[
    {name:`public-${status}`,failure:`api-${status}`,query:'?user=fixture-town',lang:'ko',mobile:true},
    {name:`portal-${status}`,failure:`api-${status}`,query:`?repo=wrong-town/${ownerRepo.repo}`,home:status===404}
  ]),
  {name:'api-deadline',failure:'api-hung',query:'?repo=fixture-town/alpha',lang:'ko'},
  {name:'api-malformed',failure:'api-malformed',query:'?user=fixture-town'},
  {name:'api-invalid-shape',failure:'api-shape',query:'?user=fixture-town',lang:'ko',mobile:true},
  {name:'api-oversized',failure:'api-oversized',query:'?repo=fixture-town/alpha',mobile:true},
  {name:'explicit-retry',failure:'api-429',query:'?repo=fixture-town/alpha&view=atelier&lang=ko',lang:'ko',direct:true,retry:true},
  {name:'mismatched-owner',failure:'mismatched',query:'?repo=fixture-town/alpha',mismatched:true},
  {name:'missing-focus',failure:'target',query:'?user=fixture-town&focus=missing&dbg=1',enteredFailure:true,mobile:true,lang:'ko'},
  {name:'empty-public',failure:'empty',query:'?user=fixture-town',empty:true,mobile:true}
];
for(const failure of failures) await run({lang:'en',...failure,name:failure.name,group:'failures'},async(s,test)=>{
  const {page}=s;
  if(test.optional){
    await ready(page); await click(page,'startBtn'); await assertOneEntry(page); return;
  }
  if(test.enteredFailure){ await ready(page); await click(page,'startBtn'); }
  await page.until('window.REPOLIS_ARRIVAL?.blocked',55000);
  const state=await snapshot(page);
  assert.equal(await page.evaluate("document.getElementById('loading').style.display"),'none','failure does not leave a loading cover');
  assert(state.message.length>20,'failure has actionable explanatory text');
  assert.equal(state.focus,'arrivalRetry','recovery owns keyboard focus');
  const ax=await page.send('Accessibility.getFullAXTree');
  assert(ax.nodes.some(node=>!node.ignored&&node.role?.value==='alertdialog'&&node.name?.value),'recovery is a named accessibility dialog');
  assert(await page.evaluate("[...document.querySelectorAll('#ceActions button,#ceActions a')].every(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44})"),'recovery tap targets are at least 44px');
  const contrast=await page.evaluate(`(()=>{
    const rgb=value=>(value.match(/[\\d.]+/g)||[]).map(Number);
    const luminance=values=>values.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
    const card=rgb(getComputedStyle(document.querySelector('#cityError .ceCard')).backgroundColor);
    const background=card.slice(0,3).map(v=>v*(card[3]??1)),retry=getComputedStyle(document.getElementById('arrivalRetry'));
    return {body:ratio(rgb(getComputedStyle(document.getElementById('ceMsg')).color),background),
      primary:[...retry.backgroundImage.matchAll(/rgba?\\([^)]+\\)/g)].map(match=>ratio(rgb(retry.color),rgb(match[0])))};
  })()`);
  assert(contrast.body>=4.5&&contrast.primary.length===2&&contrast.primary.every(ratio=>ratio>=4.5),'recovery text passes contrast even over a black backdrop');
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',modifiers:8});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',modifiers:8});
  assert.equal(await page.evaluate('document.activeElement.id'),'arrivalHome','reverse Tab stays in recovery');
  const destination=await page.evaluate("document.getElementById('arrivalHome').href");
  assert.equal(new URL(destination).search,`?view=plaza&lang=${test.lang}`,'explicit default preserves language and removes failed target');
  if(test.query?.includes('repo=')){
    const slug=new URLSearchParams(test.query).get('repo');
    assert.equal(await page.evaluate("document.getElementById('arrivalGithub')?.href"),'https://github.com/'+slug,'original GitHub stays exact');
  }
  if(test.enteredFailure) assert.equal(await page.evaluate("document.getElementById('arrivalGithub').href"),'https://github.com/fixture-town/missing');
  if(test.name==='module-watchdog') assert.equal(state.reason,'stalled');
  if(test.name==='api-deadline') assert.equal(state.reason,'timeout');
  if(test.name==='api-oversized') assert.equal(state.reason,'oversized');
  await delay(250);
  if(await page.evaluate("typeof __events==='function'")){ await click(page,'startBtn'); assert.equal(await page.evaluate("__events().filter(e=>e.ev==='town_enter').length"),test.enteredFailure?1:0,'failed links cannot force or repeat an entry'); }
  assert.equal(await page.evaluate("document.body.classList.contains('atelier-active')"),false,'same-named fallback never opens a wrong-owner room');
  if(['portal-429','required-module','webgl-unavailable'].includes(test.name)) await screenshot(page,'arrival-'+test.name);
  if(test.retry){
    const original=await page.evaluate('location.href');
    await click(page,'arrivalRetry'); await page.until("!document.getElementById('cityError')||!window.REPOLIS_ARRIVAL?.blocked");
    await ready(page); await page.until(inside);
    assert.equal(await page.evaluate('location.href'),original,'retry preserves the exact original route');
    assert.equal(apiRequests(s).length,2,'only explicit retry adds a second request');
    await assertOneEntry(page);
  }else if(test.home){
    await click(page,'arrivalHome'); await page.until("location.search.startsWith('?view=plaza')");
    await ready(page); await assertOneEntry(page);
  }
});

for(const variant of [
  {name:'slow-public',query:'?user=fixture-town&dbg=1',slow:true},
  {name:'low-end',query:'?dbg=1',lowEnd:true},
  {name:'reduced-mobile',query:'?dbg=1',lowEnd:true,reduced:true,mobile:true,lang:'ko'},
  {name:'context-pending-direct',query:'?repo=fixture-town/alpha&view=atelier&lang=en',direct:true,pendingContext:true},
  {name:'context-town',query:'?dbg=1',context:true},
  {name:'context-chat',query:'?dbg=1',context:true,chat:true},
  {name:'context-atelier-mobile',query:'?repo=fixture-town/alpha&dbg=1',context:true,mobile:true,lang:'ko'}
]) await run({lang:'en',...variant,name:variant.name,group:'policy'},async(s,test)=>{
  const {page}=s;
  if(test.pendingContext){
    await page.until("typeof __events==='function'&&__events().some(e=>e.ev==='town_enter')&&!document.body.classList.contains('atelier-active')");
    assert.equal(await page.evaluate("document.getElementById('loading').dataset.ready"),undefined);
    await page.evaluate("__browserGate.contextControl=__browserGate.renderer.getContext().getExtension('WEBGL_lose_context');__browserGate.contextControl.loseContext()");
    await page.until('REPOLIS_ARRIVAL.blocked'); await delay(700);
    await page.evaluate('__browserGate.contextControl.restoreContext()');
    await page.until("!!document.getElementById('arrivalResume')");
    await click(page,'arrivalResume'); await ready(page); await page.until(inside);
    assert.equal(await page.evaluate("document.getElementById('atelierPortalGithub').href"),'https://github.com/fixture-town/alpha');
    await assertOneEntry(page); await click(page,'atelierExit'); await page.until(outside); return;
  }
  await ready(page); await click(page,'startBtn');
  if(test.name.includes('atelier')) await page.until(inside); else await delay(900);
  if(test.chat){
    await page.evaluate("__talk('deepwiki')");
    await page.until("document.activeElement.id==='chatText'&&!document.getElementById('chatText').disabled");
    await page.send('Input.insertText',{text:'Keep this draft through context restoration.'});
  }
  const before=await page.evaluate('({pose:__pos(),perf:__perf(),sceneObjects:(()=>{let n=0;__browserGate.scene.traverse(()=>n++);return n})()})');
  if(test.lowEnd) assert.equal(before.perf.tier.lowEnd,true,'emulated hardware takes the existing LOW_END path');
  if(test.reduced) assert.equal(await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),true);
  if(test.context){
    await page.evaluate("__browserGate.contextControl=__browserGate.renderer.getContext().getExtension('WEBGL_lose_context');__browserGate.contextControl.loseContext()");
    await page.until("document.getElementById('cityError').dataset.reason==='context_lost'&&REPOLIS_ARRIVAL.blocked");
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
    await delay(150);
    await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
    assert.deepEqual(await page.evaluate('__pos()'),before.pose,'lost context cannot move the player');
    await page.evaluate("__browserGate.contextControl.restoreContext()");
    await page.until("!!document.getElementById('arrivalResume')");
    assert.equal(await page.evaluate('REPOLIS_ARRIVAL.blocked'),true,'restored rendering waits for explicit resume');
    assert.deepEqual(await page.evaluate('__pos()'),before.pose,'restored cover preserves player position');
    await screenshot(page,'arrival-'+test.name);
    await click(page,'arrivalResume'); await page.until('!REPOLIS_ARRIVAL.blocked');
    assert.equal(await page.evaluate('(()=>{let n=0;__browserGate.scene.traverse(()=>n++);return n})()'),before.sceneObjects,'context restoration reuses the existing scene');
    if(test.chat){
      assert.equal(await page.evaluate("document.getElementById('chatText').value"),'Keep this draft through context restoration.');
      assert.equal(await page.evaluate('document.activeElement.id'),'chatText','resuming returns focus to the interrupted input');
      assert.equal(await page.evaluate("__npc().active"),'deepwiki','resuming keeps the same conversation');
    }
    if(test.name.includes('atelier')){ await click(page,'atelierExit'); await page.until(outside); }
  }else{
    await page.evaluate('document.activeElement.blur()');
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
    await delay(200);
    await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
    assert.notDeepEqual(await page.evaluate('__pos()'),before.pose,'actual player movement works after readiness');
  }
  await assertOneEntry(page);
});

for(const mobile of [false,true]) for(const lang of ['en','ko']) await run({
  name:`mixed-speech-${lang}-${mobile?'mobile':'desktop'}`,group:'viewport',query:'?dbg=1',lang,mobile,lowEnd:mobile,reduced:mobile
},async(s,test)=>{
  const {page}=s;
  if(reference) await page.until("typeof __setPerfPose==='function'&&__browserGate.draws>1");
  else await ready(page);
  await click(page,'startBtn'); await delay(1000);
  await page.evaluate("__perfActivity(true);__sky(.38);__setPerfPose({x:0,z:0,yaw:Math.PI,pitch:.42,dist:13,modelVisible:true})");
  await delay(700);
  const line=lang==='ko'?'아주긴공개저장소이름에도줄바꿈이필요합니다. 이 마을의 공개 정보를 읽고 궁금한 레포를 골라 보세요. 원래 문장은 읽기 메뉴에서도 확인할 수 있어요.':
    'A very long public repository name: extraordinarilylongpublicrepositorynamewithoutspaces. Read the existing public facts and choose a repository. The original sentence remains available to read.';
  const population=await page.evaluate(`(()=>{
    __freezeWorldForExposure(true); const p=__browserGate; p.speakers=[];
    p.scene.traverse(g=>{
      if(g._bub) p.speakers.push({id:'scholar-'+p.speakers.length,kind:'scholar',group:g,bubble:g._bub});
      const tag=g.children.find(child=>child._res?._live?.group===g);
      if(tag) p.speakers.push({id:tag._res.id,kind:'resident',group:g,bubble:tag._res._live.bub});
    });
    let index=0;
    for(const speaker of p.speakers){
      speaker.group.position.set(-2.7+(index%5)*1.4,0,-8.5+Math.floor(index/5)*2.8); speaker.group._bt=999;
      speaker.bubble.say(${JSON.stringify(line)},speaker.kind==='scholar'?'deepwiki':'#9375a5'); index++;
    }
    return {residents:p.speakers.filter(s=>s.kind==='resident').length,scholars:p.speakers.filter(s=>s.kind==='scholar').length};
  })()`);
  assert(population.residents>=3&&population.scholars>=2,'fixture uses multiple real resident and scholar factories');
  const observations=[];
  for(const angle of [0,.8,Math.PI,0]){
    await page.evaluate(`__setPerfPose({x:0,z:0,yaw:Math.PI+${angle},pitch:.42,dist:13,modelVisible:true});__freezeWorldForExposure(false)`);
    await delay(650); await page.evaluate('__freezeWorldForExposure(true);__perfReset()'); await delay(900);
    const state=await page.evaluate(`(()=>{
      const p=__browserGate,c=p.camera,visible=p.speakers.filter(s=>s.bubble.sprite.visible&&s.bubble.sprite.material.opacity>.08);
      const boxes=visible.map(s=>{
        const sprite=s.bubble.sprite,v=sprite.position.clone();sprite.getWorldPosition(v);
        const depth=-v.clone().applyMatrix4(c.matrixWorldInverse).z;v.project(c);
        const scale=sprite.scale.clone();sprite.getWorldScale(scale);
        const width=scale.x*c.projectionMatrix.elements[5]*innerHeight/(2*depth),height=width*scale.y/scale.x;
        return {id:s.id,kind:s.kind,x:(v.x+1)*innerWidth/2-sprite.center.x*width,y:(1-v.y)*innerHeight/2-(1-sprite.center.y)*height,
          width,height,line:sprite.userData.currentLine};
      });
      const frames=__perfHistory(60),median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
      const geometries=new Set(),materials=new Set();let objects=0;
      p.scene.traverse(o=>{objects++;if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m)});
      return {boxes,nearby:document.getElementById('nearbySpeechText')?.textContent||'',camera:c.position.toArray(),
        perf:__perf(),frameSamples:frames.length,renderMedian:median(frames.map(f=>f.renderMs)),cadenceMedian:median(frames.map(f=>f.cadenceMs)),
        scene:{objects,geometries:geometries.size,materials:materials.size}};
    })()`);
    if(observations.length) assert(state.camera.some((n,i)=>Math.abs(n-observations.at(-1).camera[i])>.1),'camera rotation changes the actual rendered viewpoint');
    const clipped=state.boxes.filter(b=>b.x<0||b.y<0||b.x+b.width>(mobile?390:1440)||b.y+b.height>(mobile?844:900));
    if(!reference){
      assert(state.boxes.length<=2&&clipped.length===0,'mixed speech remains capped and inside the rotated viewport');
      for(const box of state.boxes) assert(box.width<=(mobile?224:272)+.01,'world-space scale respects the screen ceiling');
      if(state.boxes.length===2){
        const [a,b]=state.boxes;
        assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'selected bubble rectangles never overlap');
      }
      for(const box of state.boxes) assert(state.nearby.includes(box.line),'the complete selected line remains available as DOM text');
    }
    observations.push({angle,clipped:clipped.length,...state});
    if(observations.length<=2) await screenshot(page,`${reference?'before':'after'}-${test.name}-${observations.length===1?'near':'rotated'}`);
  }
  const transitions=[];
  if(!reference){
    const readable=observations.at(-1).boxes.find(box=>box.line)?.line;
    assert(readable&&observations.some(state=>state.boxes.some(box=>box.kind==='resident')),'nearby resident dialogue is actually displayed');
    await click(page,'menuBtn'); await page.evaluate("document.getElementById('nearbySpeech').open=true");
    const ax=await page.send('Accessibility.getFullAXTree');
    assert(ax.nodes.some(node=>!node.ignored&&node.name?.value?.includes(readable)),'complete dialogue is exposed in the accessibility tree');
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
    await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
    await page.evaluate("__talk('deepwiki')");
    await page.until("document.activeElement.id==='chatText'&&!document.getElementById('chatText').disabled");
    await page.send('Input.insertText',{text:'Keep this draft while graphics change.'});
    assert.equal(await page.evaluate("document.getElementById('chatText').value"),'Keep this draft while graphics change.','the focused chat receives the draft');
    const camera=await page.evaluate('__cam()'),position=await page.evaluate('__pos()');
    for(const force of ['balanced','lean','full','auto']){
      const governor=await page.evaluate(`__visualGovernor(${JSON.stringify(force)})`); await delay(180);
      assert.equal(await page.evaluate("document.getElementById('chatText').value"),'Keep this draft while graphics change.');
      assert.equal(await page.evaluate('document.activeElement.id'),'chatText');
      assert.equal(await page.evaluate("__npc().active"),'deepwiki');
      assert.equal(await page.evaluate('__browserGate.speakers.some(s=>s.bubble.sprite.visible)'),false,'chat owns the view over ambient speech');
      transitions.push({force,tier:governor.tier});
    }
    await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:mobile?25:900,y:260,button:'left',buttons:1,clickCount:1});
    await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:mobile?100:1050,y:310,button:'left',buttons:1});
    await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:mobile?100:1050,y:310,button:'left',buttons:0,clickCount:1});
    await delay(120);
    assert.deepEqual(await page.evaluate('__pos()'),position,'pointer gestures behind chat cannot move the player');
    const after=await page.evaluate('__cam()');
    for(const key of ['camDist','camPitch','camYaw']) assert.equal(after[key],camera[key],'chat cannot leak a camera drag');
    assert.equal(await page.evaluate("__repositoryAtelier().state"),'outside','chat cannot click through into a repository room');
  }
  return {population,observations,transitions,historicalObservation:!!reference};
});
assert(results.length>0,'No browser scenarios matched the requested selector');
console.log(`First-visit browser gate: ${results.length} passed; evidence: ${output}`);
