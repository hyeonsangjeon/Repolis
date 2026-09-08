import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { DIRECT_ENTRY_LIMITS, parseRepoPortalInput } from '../assets/repo-portal.js';

const HTML=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=name=>(HTML.match(new RegExp(`/\\*${name}:START\\*/([\\s\\S]*?)/\\*${name}:END\\*/`))||[])[1];

export async function runFirstVisitTests(check){
  const context={};
  runInNewContext(block('TOWN_SPEECH_CORE')+'\nglobalThis.api={wrapTownSpeech,layoutTownSpeech,TOWN_SPEECH_LIMITS};',context);
  const {wrapTownSpeech:wrap,layoutTownSpeech:layout,TOWN_SPEECH_LIMITS:L}=context.api;
  const measure=text=>Array.from(text).length*10;
  for(const text of ['LongRepositoryNameWithoutAnySpaces','공백없는아주긴공개저장소이름입니다','word '.repeat(70),'😀'.repeat(40)]){
    const lines=wrap(text,measure,100,3);
    check(lines.length<=3&&lines.every(line=>measure(line)<=100),'speech wraps long tokens and Unicode inside the existing canvas');
  }
  check(wrap('one two',measure,70,1).join('')==='one two'&&wrap('',measure,70,3).length===0,'exact-fit and empty speech do not invent an ellipsis');
  const candidate=(id,extra={})=>({id,priority:0,distance:5,x:100,y:500,width:272,height:153,
    speaking:true,eligible:true,selected:false,lastVisibleAt:1000,...extra});
  for(const [width,height] of [[390,844],[1440,900],[390,430]]){
    const list=layout([candidate('a',{x:-90}),candidate('b',{x:width+90}),candidate('c')],width,height,1100);
    check(list.length>=1&&list.length<=2&&list.every(p=>p.x>=L.margin&&p.x+p.width<=width-L.margin&&p.y>=0&&p.y+p.height<=height),
      'fixed speech budget fits the viewport with safe gutters');
  }
  const crowded=layout([candidate('a'),candidate('b'),candidate('c')],390,844,1100);
  check(crowded.length===2&&Math.abs(crowded[0].y-crowded[1].y)>=crowded[0].height+L.margin,
    'overlapping nearby speakers get distinct screen rows rather than covering each other');
  const stable=layout([candidate('new',{distance:1}),candidate('old',{selected:true}),candidate('old2',{selected:true,x:600})],1440,900,1100);
  check(stable.map(p=>p.id).join(',')==='old,old2','selected ambient speakers retain their slot despite distance reordering');
  const priority=layout([candidate('old',{selected:true}),candidate('old2',{selected:true,x:600}),candidate('engaged',{priority:3})],1440,900,1100);
  check(priority[0].id==='engaged'&&priority.length===2,'directly engaged speaker takes priority without exceeding the cap');
  const grace=layout([candidate('edge',{selected:true,eligible:false}),candidate('other'),candidate('new')],1440,900,1200);
  const expired=layout([candidate('edge',{selected:true,eligible:false}),candidate('other'),candidate('new')],1440,900,1400);
  check(grace.some(p=>p.id==='edge'&&!p.visible)&&!expired.some(p=>p.id==='edge'),'brief camera-edge crossings retain, but never draw, an offscreen slot');
  const runtime=block('TOWN_SPEECH_RUNTIME'),ui=block('TOWN_UI_RUNTIME');
  check(!/fetch\(|localStorage|sessionStorage|Math\.random|CanvasTexture|setTimeout|setInterval/.test(runtime),
    'speech presentation adds no requests, storage, RNG calls, textures, or autonomous timers');
  check(/sprite\.center\.set/.test(runtime)&&/sprite\.scale\.set/.test(runtime)&&/textContent=text/.test(runtime),
    'existing sprites carry bounded screen geometry while full original lines remain readable in the menu');
  check(/element\.inert=hidden\|\|modalOpen/.test(ui)&&/event\.key==='Escape'/.test(ui)&&/event\.key!=='Tab'/.test(ui)
    &&/closeTownPanels\(opening\.element\)/.test(ui),'one panel owns focus and input, without stealing focus from an existing modal');
  check(/visualViewport\?\.addEventListener\('resize'/.test(ui)&&/--town-ui-height/.test(HTML)
    &&/e\.type==='pointerup'&&!moveMoved/.test(HTML),'visual keyboard viewport and pointer cancellation cannot leak world actions');
  const tools=HTML.slice(HTML.indexOf('<details id="townTools"'),HTML.indexOf('<div class="badge" id="navBadge"'));
  check(['liveCount','entryCount','entryTotalCount','allCount'].every(id=>tools.includes(`id="${id}"`))
    &&/id="townTools"[\s\S]*?<summary/.test(tools),'one native disclosure retains every existing visitor counter');

  const catalogContext={parseRepoPortalInput};
  runInNewContext(block('FIRST_REPO_CORE')+'\nglobalThis.page=firstRepoPage;',catalogContext);
  const repo=(name,extra={})=>({repo:name,_owner:'octo',url:`https://github.com/octo/${name}`,desc:'Public description',lang:'JavaScript',topics:['topic'],...extra});
  const resolveTarget=r=>{ const target=parseRepoPortalInput(`${r._owner||'octo'}/${r.repo}`); return target.ok&&target.kind==='repo'?target:null; };
  const page=(catalog,q='',index=0)=>catalogContext.page(catalog,'octo',q,index,resolveTarget);
  const catalog=Array.from({length:15},(_,i)=>repo('repo-'+i));
  check(page(catalog).rows.length===6&&page(catalog).rows.map(row=>row.repo.repo).join(',')===catalog.slice(0,6).map(row=>row.repo).join(','),
    'first picker page has six entries in current catalog order, not a new ranking');
  check(page(catalog,'',2).rows.length===3&&page(catalog,'',99).page===2&&page(catalog,'repo-14').rows[0].target.slug==='octo/repo-14',
    'search and bounded paging reach the rest of the already loaded catalog');
  const special=[repo('same'),repo('same',{_owner:'other',url:'https://github.com/other/same'}),repo('wrong',{url:'https://github.com/other/wrong'}),
    repo('private',{private:true}),repo('landmark',{_isLibrary:true}),repo('same')];
  check(page(special).rows.length===1&&page(special).rows[0].target.slug==='octo/same',
    'same names, mismatched owner URLs, private records, landmarks and duplicates cannot misroute selection');
  const absent=page([repo('long'.repeat(25),{desc:null,topics:null,lang:'—',archived:true})]).rows[0];
  check(absent.description===''&&absent.facts.length===0&&absent.repo.archived&&absent.target.repo.length===100,
    'missing facts, archived state and long exact names are retained without fabricated claims');
  check(page([]).total===0&&page(catalog,'no-match').rows.length===0,'empty and no-match catalogs stay explicit');
  const picker=block('FIRST_REPO_RUNTIME'),intent=block('INTENT_LENS');
  check(/enterRepositoryAtelier\(current\.repo,\{autoChat:false\}\)/.test(picker)
    &&/REPOS\.includes\(item\.repo\)/.test(picker)&&/button\.type='button'/.test(picker),
    'a native picker selection revalidates catalog membership and uses the existing no-auto-chat Atelier');
  check(!/fetch\(|localStorage|sessionStorage|new THREE|track\(|StarNudge|loadContributionQuests/.test(picker)
    &&intent.indexOf('intentLensTargetRepo()')<intent.indexOf('openFirstRepoPicker()'),
    'picker adds no network, storage, scene resources or Star requests and explicit Portal targets keep precedence');

  const arrival={};
  runInNewContext(block('ARRIVAL_CORE')+'\nglobalThis.api={createArrivalState,claimArrivalEntry,stepArrival,takeArrivalAction};',arrival);
  const {createArrivalState:create,claimArrivalEntry:claim,stepArrival:step,takeArrivalAction:take}=arrival.api;
  const frame=(now,extra={})=>({now,kind:'town',inside:false,target:null,blocked:false,contextLost:false,...extra});
  const ordinary=create();
  check(step(ordinary,frame(0),DIRECT_ENTRY_LIMITS)===null&&!claim(ordinary,0),'uninitialized scenes cannot reveal or record entry');
  ordinary.initialized=true;
  check(step(ordinary,frame(10),DIRECT_ENTRY_LIMITS)===null&&step(ordinary,frame(30),DIRECT_ENTRY_LIMITS)==='reveal',
    'the ordinary intro is released only after completed scene frames');
  check(step(ordinary,frame(40),DIRECT_ENTRY_LIMITS)===null&&claim(ordinary,40)&&!claim(ordinary,41),
    'reveal and entry claims are idempotent without changing event definitions');
  const direct=create(); Object.assign(direct,{initialized:true,direct:true,target:'octo/same'});
  step(direct,frame(100),DIRECT_ENTRY_LIMITS);
  check(step(direct,frame(1299),DIRECT_ENTRY_LIMITS)===null&&step(direct,frame(1300),DIRECT_ENTRY_LIMITS)==='enter'
    &&step(direct,frame(1301),DIRECT_ENTRY_LIMITS)===null&&claim(direct,1300),
    'direct entry retains the existing initialization minimum and dispatches one entry action');
  for(const extra of [{kind:'town'},{kind:'atelier',inside:false,target:'octo/same'},
    {kind:'atelier',inside:true,target:'other/same'},{kind:'atelier',inside:true,target:'octo/same',contextLost:true},
    {kind:'atelier',inside:true,target:'octo/same',blocked:true}]){
    check(step(direct,frame(2300,extra),DIRECT_ENTRY_LIMITS)===null,'elapsed time cannot release an unready, wrong-owner, blocked, or lost-context scene');
  }
  check(step(direct,frame(2199,{kind:'atelier',inside:true,target:'octo/same'}),DIRECT_ENTRY_LIMITS)===null
    &&step(direct,frame(2300,{kind:'atelier',inside:true,target:'OCTO/same'}),DIRECT_ENTRY_LIMITS)==='reveal',
    'direct Atelier reveals only its completed exact-target interior after the existing cover minimum');
  const action=()=>true; direct.actions.push({at:500,run:action});
  check(take(direct,499,false)===null&&take(direct,900,true)===null&&direct.actions.length===1
    &&take(direct,901,false)===action&&take(direct,902,false)===null,
    'context interruptions retain the pending arrival action until an unblocked frame, without replaying it');
  const recovery=block('ARRIVAL_RECOVERY');
  check(HTML.indexOf('/*ARRIVAL_RECOVERY:START*/')<HTML.indexOf('<script src="repolis.config.js">')
    &&/setTimeout\(\(\)=>fail\('stalled'\),45000\)/.test(recovery)&&/event\.target instanceof HTMLScriptElement/.test(recovery),
    'a standalone bounded recovery UI exists before required scripts and module initialization');
  check(/retry\.onclick=\(\)=>location\.reload\(\)/.test(recovery)&&/home\.href=url\.href/.test(recovery)
    &&/restoring&&!restored/.test(recovery)&&/inertBefore/.test(recovery)
    &&!/fetch\(|setInterval|localStorage|sessionStorage|track\(/.test(recovery),
    'recovery requires explicit navigation or a rendered-frame resume, retains focus ownership, and adds no request or storage');
  check(/FIRST_ARRIVAL\.initialized=true/.test(HTML)&&/_arrivalRendered\('atelier'\)/.test(HTML)
    &&/_arrivalRendered\('town'\)/.test(HTML)&&/if\(!_claimTownEntry\(\)\) return/.test(HTML),
    'runtime uses real completed renders and one entry claim rather than a cover-release timer');
  check(/_reqFocus\.slug\.toLowerCase\(\)/.test(HTML)&&/repoPortalTarget\.slug\.toLowerCase\(\)/.test(HTML)
    &&/window\.REPOLIS_ARRIVAL\.fail\(effErr/.test(HTML),
    'focused and Portal arrivals compare exact owner/repo and keep failure behind explicit recovery');
  check(/if\(BLUEPRINT_DEEP_LINK\.ok&&blueprintDeepLinkBypass\) return;/.test(HTML),
    'Blueprint cancellation stays in the existing town without an automatic room or scan');

  const timers=new Map(); let timerId=0;
  const data={AbortController,Response,TextDecoder,SyntaxError,
    setTimeout:(fn,ms)=>{ timers.set(++timerId,{fn,ms}); return timerId; },clearTimeout:id=>timers.delete(id)};
  runInNewContext(block('ARRIVAL_DATA')+'\nglobalThis.api={fetchArrivalResponse,arrivalDataReason,ARRIVAL_DATA_LIMITS};',data);
  const {fetchArrivalResponse:load,arrivalDataReason:reason,ARRIVAL_DATA_LIMITS:limits}=data.api;
  check(limits.timeoutMs===8000&&limits.maxBytes===2*1024*1024&&limits.optionalTimeoutMs===4000,
    'boot data has fixed request/body bounds and a shorter optional-data deadline');
  let requests=0;
  const response=await load('fixture',{},limits,async()=>{ requests++; return new Response('{"public":true}'); });
  check((await response.json()).public&&requests===1&&timers.size===0,'successful data is consumed once and clears its deadline');
  for(const status of [403,429,404,500]){
    let failure;
    try{ await load('fixture',{},limits,async()=>{ requests++; return new Response('',{status}); }); }catch(error){ failure=error; }
    check(failure?.status===status&&reason(failure)===(status===404?'not_found':(status===500?'http':'rate_limit'))&&timers.size===0,
      'HTTP failures retain their status, classify rate limits, and do not retry');
  }
  check(requests===5,'status cases perform exactly one fetch each');
  let headerFailure,streamFailure,aborted=false;
  try{ await load('fixture',{}, {maxBytes:8},async(_url,options)=>{
    options.signal.addEventListener('abort',()=>{ aborted=true; });
    return new Response('small',{headers:{'content-length':'99'}});
  }); }catch(error){ headerFailure=error; }
  check(reason(headerFailure)==='oversized'&&aborted&&timers.size===0,'declared oversized bodies are aborted before consumption');
  try{ await load('fixture',{}, {maxBytes:8},async()=>new Response(new ReadableStream({
    start(controller){ controller.enqueue(new TextEncoder().encode('한국어한국어')); controller.close(); }
  }))); }catch(error){ streamFailure=error; }
  check(reason(streamFailure)==='oversized'&&timers.size===0,'stream limits count decoded bytes rather than characters or just Content-Length');
  for(const phase of ['headers','body']){
    let failure,reads=0;
    const pending=load('fixture',{},limits,async(_url,options)=>{
      if(phase==='headers') return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
      return new Response(new ReadableStream({start(controller){
        reads++; options.signal.addEventListener('abort',()=>controller.error(new Error('aborted')));
      }}));
    });
    [...timers.values()].at(-1).fn();
    try{ await pending; }catch(error){ failure=error; }
    check(reason(failure)==='timeout'&&timers.size===0&&(phase==='headers'||reads===1),'deadline covers both a hung fetch and a hung response body');
  }
  let malformed;
  try{ const value=await load('fixture',{},limits,async()=>new Response('{')); await value.json(); }catch(error){ malformed=error; }
  check(reason(malformed)==='malformed'&&timers.size===0,'malformed JSON is explicit rather than a successful empty catalog');
  check(/if\(!Array\.isArray\(raw\)\) throw new ArrivalDataError\('malformed'\)/.test(HTML)
    &&/loadResidentManifest\(\{owner:currentUser,fetchImpl:fetchOptionalArrival\}\)/.test(HTML)
    &&/loadLoreFragments\(\{fetchImpl:fetchOptionalArrival\}\)/.test(HTML),
    'public arrays validate before cache writes and awaited optional loaders reuse the same bounded fetch');
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  let count=0; await runFirstVisitTests((ok,message)=>{ if(!ok) throw new Error(message); count++; });
  console.log(`First visit: ${count} checks passed`);
}
