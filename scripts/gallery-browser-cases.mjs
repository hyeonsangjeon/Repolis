import assert from 'node:assert/strict';

const owner='hyeonsangjeon', external='fixture-town';
const introVisible="!document.getElementById('intro').classList.contains('hidden')";
const entries="__events().filter(event=>event.ev==='town_enter').length";
const locale=lang=>lang==='ko'?'en':'ko';
const galleryQuery=(user,lang)=>`?user=${user}&ref=gallery${lang?`&lang=${lang}`:''}`;

async function press(page,selector){
  const point=await page.evaluate(`(()=>{
    const el=document.querySelector(${JSON.stringify(selector)});
    el.scrollIntoView({block:'center',behavior:'instant'});
    const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    return {x,y,hit:el.contains(document.elementFromPoint(x,y))};
  })()`);
  assert(point.hit,`visible clickable control: ${selector}`);
  const {x,y}=point;
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
}

async function type(page,selector,value){
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await page.send('Input.insertText',{text:value});
}

export async function runGalleryBrowserCases({run,ready,click,screenshot,delay,apiRequests}){
  const baseline=process.env.GALLERY_BASELINE==='1';
  const stored=page=>page.evaluate("localStorage.getItem('repolisLang')");
  const hits=(s,path)=>s.requests.filter(value=>new URL(value).pathname===path).length;
  const publicRequests=s=>apiRequests(s).filter(value=>new URL(value).pathname===`/users/${external}/repos`).length;
  const boot=page=>page.evaluate('__browserGate.boot');
  const navigation=page=>page.evaluate('performance.timeOrigin');
  async function town(page,user,direct){
    await ready(page);
    assert.equal(await page.evaluate(introVisible),!direct,'only direct routes skip the intro');
    assert.equal(await page.evaluate(entries),Number(direct),'one automatic entry or none at the manual intro');
    const state=await page.evaluate('__city()');
    assert.equal(state.user,user);
    assert.equal(state.mode,user===owner?'owner':'public');
    assert(state.repoCount>0);
    assert(await page.evaluate('__browserGate.firstDraw>0'));
    return state;
  }
  async function oneEntry(page){
    await click(page,'startBtn'); await click(page,'startBtn');
    assert.equal(await page.evaluate(entries),1,'repeat activation cannot enter twice');
  }

  for(const mobile of [false,true]) for(const lang of ['en','ko']){
    const suffix=`${lang}-${mobile?'390':'1440'}`;
    for(const maker of [false,true]){
      const name=`gallery-${maker?'maker':'tile'}-${suffix}`,user=maker?external:owner;
      await run({name,group:'gallery',query:`gallery.html?lang=${lang}`,lang:baseline?locale(lang):lang,stored:locale(lang),
        mobile,slow:maker},async s=>{
        const {page}=s;
        await page.until("document.querySelector('#towns .town > a img')?.naturalWidth>0");
        assert.equal(await page.evaluate('document.documentElement.lang'),lang);
        const query=galleryQuery(user,baseline?null:lang);
        const selectors=maker?['#resultWalk','#resultCardLink']:['#towns .town > a','#towns .town .meta a'];
        if(maker){
          await type(page,'#login',`https://github.com/${external}/alpha`);
          await press(page,'#maker button[type=submit]');
          await page.until("document.querySelector('#resultCard')?.naturalWidth>0");
          assert.match(await page.evaluate("document.getElementById('resultNote').textContent"),/@fixture-town/);
        }
        const links=await page.evaluate(`${JSON.stringify(selectors)}.map(s=>new URL(document.querySelector(s).href).search)`);
        assert.deepEqual(links,[query,query]);
        await screenshot(page,`${name}-gallery`);
        await press(page,selectors[maker?0:(mobile?1:0)]);
        await page.until(`location.search===${JSON.stringify(query)}&&!!document.getElementById('loadingText')`,55000);
        const first=await boot(page);
        assert.equal(first.lang,baseline?locale(lang):lang);
        assert.equal(first.text,first.lang==='ko'?'레포 도시를 짓는 중…':'Building Repolis…');
        let fetching=null;
        if(maker){
          fetching=await page.until("document.getElementById('loadingText').textContent.match(/Fetching|레포를 불러오는 중/)&&document.getElementById('loadingText').textContent");
          assert.equal(fetching,first.lang==='ko'?`${external} 님의 레포를 불러오는 중…`:`Fetching ${external}'s repos…`);
          if(mobile) await screenshot(page,`${name}-loading`);
        }
        let cover=null;
        if(!baseline){
          cover=await page.until(`(()=>{
            const loading=document.getElementById('loading');
            return loading?.classList.contains('direct-entry')&&{
              visible:getComputedStyle(loading).display!=='none',introInert:document.getElementById('intro').inert,
              text:document.getElementById('loadingText').textContent};
          })()`,55000);
          assert(cover.visible&&cover.introInert,'the cover owns the UI until a playable town is ready');
          assert.equal(cover.text,lang==='ko'?`${user} 님의 마을로 이동하는 중…`:`Entering ${user}'s town…`);
        }
        const state=await town(page,user,!baseline);
        assert.equal(await stored(page),locale(lang),'a Walk link does not write the town language preference');
        assert.equal(hits(s,'/data/gallery.json'),1);
        assert.equal(hits(s,'/repos.json'),maker?0:1);
        assert.equal(apiRequests(s).length,maker?1:0);
        assert.equal(publicRequests(s),maker?1:0);
        assert.equal(state.source,maker?'github-public':'owner-ci');
        await screenshot(page,`${name}-destination`);
        await oneEntry(page);
        await delay(1000);
        assert.equal(await page.evaluate(introVisible),false);
        assert.equal(await page.evaluate(entries),1);
        let moved=null;
        if(!baseline&&!mobile&&lang==='en'&&maker){
          const position="__browserGate.camera.position.toArray().map(n=>+n.toFixed(2))";
          const before=await page.evaluate(position);
          await page.send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w',windowsVirtualKeyCode:87});
          try{ await page.until(`JSON.stringify(${position})!==${JSON.stringify(JSON.stringify(before))}`,5000); }
          finally{ await page.send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87}); }
          moved={before,after:await page.evaluate(position)};
        }
        return {links,boot:first,fetching,cover,destination:baseline?'manual-intro':'walkable-town',stored:await stored(page),state,moved};
      });
    }
    await run({name:`gallery-launch-owner-${suffix}`,group:'gallery',query:'?launch=1',lang,mobile},async({page})=>{
      await town(page,owner,false);
      assert.equal(await page.evaluate('document.activeElement.id'),'introUser');
      await screenshot(page,`gallery-launch-owner-${suffix}-input`);
      const initial=await navigation(page);
      await type(page,'#introUser',`@${owner.toUpperCase()}`);
      await press(page,'#introLaunchForm button[type=submit]');
      if(baseline){
        await page.until("location.search===''&&!!document.getElementById('loading')",55000);
        await town(page,owner,false);
        assert.notEqual(await navigation(page),initial);
      }else{
        await page.until(`!(${introVisible})`);
        await oneEntry(page);
        assert.equal(await navigation(page),initial,'already loaded owner town need not navigate again');
      }
      await screenshot(page,`gallery-launch-owner-${suffix}-destination`);
      return {sameDocument:await navigation(page)===initial,search:await page.evaluate('location.search'),introVisible:await page.evaluate(introVisible)};
    });
  }

  await run({name:'gallery-launch-owner-from-public',group:'gallery',query:`?user=${external}`,lang:'ko',mobile:true},async({page})=>{
    await town(page,external,false);
    await press(page,'#introTryAnother');
    await type(page,'#introUser',owner);
    await press(page,'#introLaunchForm button[type=submit]');
    const search=baseline?'':'?view=plaza&lang=ko';
    await page.until(`location.search===${JSON.stringify(search)}&&!!document.getElementById('loading')`,55000);
    const state=await town(page,owner,!baseline);
    if(!baseline) await oneEntry(page);
    return {search,state};
  });

  for(const twin of [false,true]){
    const name=twin?'gallery-launch-owner-twin-conflict':'gallery-launch-owner-plain';
    const query=`?user=${owner}${twin?`&twin=${external}`:''}`;
    await run({name,group:'gallery',query,lang:'en'},async({page})=>{
      await town(page,owner,false);
      if(twin){
        await page.until("document.getElementById('twinModal').classList.contains('show')");
        await press(page,'#twinClose');
      }
      const initial=await navigation(page);
      await type(page,'#introUser',owner);
      await press(page,'#introLaunchGo');
      if(twin||baseline){
        await page.until("location.search===''&&!!document.getElementById('loading')",55000);
        await town(page,owner,false);
        assert.notEqual(await navigation(page),initial,'conflicting links retain the previous clean-root navigation');
      }else{
        await page.until(`!(${introVisible})`);
        await oneEntry(page);
        assert.equal(await navigation(page),initial);
      }
      return {sameDocument:await navigation(page)===initial,search:await page.evaluate('location.search'),introVisible:await page.evaluate(introVisible)};
    });
  }

  for(const [name,user,variant] of [
    ['legacy-owner',owner,{}],['legacy-public',external,{}],
    ['partial',external,{partial:true}],['fresh-cache',external,{publicCache:'fresh'}],
    ['stale-cache',external,{publicCache:'stale',failure:'api-429'}],
  ]){
    const legacy=name.startsWith('legacy');
    const lang=legacy||baseline?'ko':'en';
    await run({name:`gallery-${name}`,group:'gallery',query:galleryQuery(user,legacy?null:'en'),lang,stored:'ko',...variant},async s=>{
      const state=await town(s.page,user,!baseline);
      assert.equal(await stored(s.page),'ko');
      assert.equal(apiRequests(s).length,user===owner||variant.publicCache==='fresh'?0:1);
      assert.equal(hits(s,'/repos.json'),user===owner?1:0);
      if(user===external){
        assert.equal(state.source,variant.publicCache==='fresh'?'cache':variant.publicCache==='stale'?'stale-cache':'github-public');
        assert.equal(state.coverage.partial,!!variant.partial);
        assert.equal(state.coverage.error,variant.publicCache==='stale'?'rate_limit':null);
      }
      await screenshot(s.page,`gallery-${name}`);
      return {boot:await boot(s.page),state};
    });
  }

  for(const [name,user,variant,reason] of [
    ['public-404',external,{failure:'api-404'},'not_found'],
    ['public-rate-limit',external,{failure:'api-429'},'rate_limit'],
    ['public-empty',external,{empty:true},'empty'],
    ['public-malformed',external,{failure:'api-malformed'},'malformed'],
    ['public-timeout',external,{failure:'api-hung'},'timeout'],
    ['owner-snapshot-missing',owner,{failure:'static',failPath:'/repos.json'},'data_load'],
    ...(!baseline?[['owner-snapshot-empty',owner,{emptyOwner:true},'empty']]:[]),
    ['required-module',external,{failure:'module',failPath:'/assets/repo-route.js'},'script'],
  ]){
    const lang=name==='public-404'||name==='required-module'?'ko':'en';
    const expected=baseline?locale(lang):lang;
    await run({name:`gallery-${name}`,group:'gallery',query:galleryQuery(user,lang),mobile:lang==='ko',lang:expected,stored:locale(lang),...variant},async s=>{
      const {page}=s;
      await page.until("window.REPOLIS_ARRIVAL?.blocked",55000);
      assert.equal((await boot(page)).lang,expected);
      assert.equal(await page.evaluate("document.getElementById('cityError').dataset.reason"),reason);
      assert.equal(await page.evaluate('document.activeElement.id'),'arrivalRetry');
      assert.equal(await page.evaluate("document.querySelector('#arrivalRetry').textContent"),expected==='ko'?'같은 링크 다시 시도':'Retry the same link');
      assert.equal(await page.evaluate("window.__events?.().filter(event=>event.ev==='town_enter').length||0"),0);
      assert.equal(hits(s,'/repos.json'),user===owner?1:0,'never use the owner catalog for a failed public town');
      assert.equal(apiRequests(s).length,user===owner||name==='required-module'?0:1);
      assert.equal(await stored(page),locale(lang));
      const github=await page.evaluate("document.getElementById('arrivalGithub')?.href||null");
      if(!baseline||name!=='required-module') assert.equal(github,`https://github.com/${user}`);
      await screenshot(page,`gallery-${name}`);
      return {boot:await boot(page),reason,github};
    });
  }

  for(const [name,query] of [
    ['ordinary-user',`?user=${external}`],
    ['card',`?user=${external}&ref=card`],
    ['profile-readme',`?user=${external}&ref=profile-readme`],
    ['duplicate-user',galleryQuery(external,'ko')+`&user=${owner}`],
    ['duplicate-lang',galleryQuery(external,'ko')+'&lang=en'],
    ['malformed-lang',galleryQuery(external,'KO')],
    ['launch-conflict',galleryQuery(external,'ko')+'&launch=1'],
    ['hash-conflict',galleryQuery(external,'ko')+'#repo=alpha'],
  ]){
    await run({name:`gallery-preserve-${name}`,group:'gallery',query,lang:'en'},async({page})=>{
      const state=await town(page,external,false);
      assert.equal((await boot(page)).lang,'en');
      await oneEntry(page);
      if(name==='hash-conflict') await page.until("document.getElementById('modal').classList.contains('show')&&document.getElementById('modal')._repoKey==='alpha'");
      return {query,mode:state.mode,source:state.source,autoEntries:0};
    });
  }
}
