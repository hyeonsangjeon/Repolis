import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { parseRepoPortalInput } from '../assets/repo-portal.js';

const HTML=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=name=>(HTML.match(new RegExp(`/\\*${name}:START\\*/([\\s\\S]*?)/\\*${name}:END\\*/`))||[])[1];

export function runFirstVisitTests(check){
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
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  let count=0; runFirstVisitTests((ok,message)=>{ if(!ok) throw new Error(message); count++; });
  console.log(`First visit: ${count} checks passed`);
}
