import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('const SYN='),html.indexOf('/* ---- Mode B: WebLLM'));
const catalog=[
  {repo:'clip-box',label:'Clip box',desc:'Download video and subtitles with yt-dlp',topics:['video','downloader'],clones:2,stars:3,rank:2},
  {repo:'measure-kit',label:'Measure kit',desc:'Benchmark model reasoning',topics:['benchmark'],clones:999,stars:80,forks:9,rank:1},
  {repo:'speech-notes',label:'Speech notes',desc:'Speech transcription and subtitles',topics:['stt','transcription'],clones:10,stars:7,rank:3},
  // v1.96 guide patch: transliterations, morphological variants and generic-name tokens
  {repo:'polaris-agent',label:'Polaris Agent',desc:'A durable local agent runtime with Ollama fan-out',topics:['ai-agent','ollama'],clones:4,stars:0,rank:5,pushed:'2026-10-05'},
  {repo:'im-not-ai-en',label:'Im Not Ai En',desc:'English editing that preserves meaning, voice, and technical precision.',topics:['agent-skills','editing','english'],clones:3,stars:0,rank:6,pushed:'2026-08-14'},
  {repo:'gotty-docker',label:'Gotty Docker',desc:'Run a real Linux terminal in your browser with Docker',topics:['docker','terminal'],clones:9,stars:20,rank:4,pushed:'2026-05-01'},
  {repo:'kubernetes-dashboard-nodeport',label:'Kubernetes Dashboard Nodeport',desc:'kubernetes dashboard using nodeport',topics:[],clones:1,stars:2,rank:7,pushed:'2020-01-01'}
].map(r=>({lang:'Python',visitors:2,views:3,forks:1,pushed:'2026-01-01',...r}));
function search(repos=catalog){
  const ctx={REPOS:repos,LANG:'ko',LIB:null,RESIDENT_DIRECTORY:[],CITY_STATE:null,NPCS:[],ZONES:[],
    window:{},taxiHouseholdHandoff:()=>null,taxiSharedResponse:()=>null,esc:String,t:k=>k,scholarPersona:()=>null};
  runInNewContext(source+'\nlandmarkNav=()=>null;districtNav=()=>null;townLore=()=>null;globalThis.api={localIntent,_coreIntent,searchCandidates,padAlts};',ctx);
  return ctx.api;
}
const api=search();
const cases=[
  ['동영상 다운로드','clip-box'],['영상 내려받는 도구','clip-box'],['video downloader','clip-box'],
  ['download video','clip-box'],['유튜브 영상 저장 도구','clip-box'],['clip-box 설치 방법','clip-box'],
  ['제일 좋은 동영상 다운로드 도구','clip-box'],['best video downloader','clip-box'],
  ['how to use clip-box','clip-box'],['install clip-box','clip-box'],['음성 받아쓰기','speech-notes'],
  ['speech transcription','speech-notes'],['measure-kit','measure-kit'],
  ['클론 수가 가장 많은 레포','measure-kit'],['most cloned repo','measure-kit'],['highest clone count','measure-kit'],
  ['가장 많이 다운로드된 레포','measure-kit'],['most downloaded repository','measure-kit'],
  ['클론 개수가 많은 레포','measure-kit'],['repo with highest clone count','measure-kit'],
  ['스타 수가 가장 많은 레포','measure-kit'],['most stars','measure-kit'],['most popular repo','measure-kit'],
  ['most starred repo','measure-kit'],['which repo has the most forks','measure-kit'],
  ['what did I push recently?','polaris-agent'],['최근에 푸시한 레포','polaris-agent'],['most recently updated repo','polaris-agent'],
  ['도커','gotty-docker'],['도커 레포 보여줘','gotty-docker'],['쿠버네티스 대시보드','kubernetes-dashboard-nodeport'],['쿠버 대시보드','kubernetes-dashboard-nodeport'],
  ['AI 에이전트','polaris-agent'],['AI agents','polaris-agent'],['에이전트로 가자','polaris-agent'],
  ['quantum banana tool',null],['없는도구 찾아줘',null],['설치 방법',null],['안녕',null],['밤하늘 별 보기',null]
];
for(const [q,expected] of cases) assert.equal(api.localIntent(q)?.repo?.repo??null,expected,q);
for(const q of ['동영상 다운로드','clip-box 설치 방법','install clip-box','video downloader'])
  assert(!api._coreIntent(q)?._metric,`${q} must not short-circuit Foundry/WebLLM into a metric ranking`);
const foreign=search(catalog.map(r=>({...r,trafficKnown:false})));
assert.equal(foreign.localIntent('동영상 다운로드').repo.repo,'clip-box');
assert.equal(foreign.localIntent('most cloned repo').message,'publicTrafficUnavailable');
const renamed=search(catalog.map(r=>({...r,repo:'renamed-'+r.repo,label:'renamed',clones:1000-r.clones,score:1e12})));
assert.equal(renamed.localIntent('video downloader').repo.repo,'renamed-clip-box');
assert.equal(renamed.localIntent('quantum banana tool').repo,null,'popularity alone is not a search match');
for(const q of ['video downloader','most cloned repo','random repo','most stars']) assert.equal(search([]).localIntent(q)?.repo??null,null,q);
for(const q of ['anything','Anything!','surprise me','아무거나','random repo']) assert(api.localIntent(q)?.repo,`${q} is a random pick, not a miss`);
assert.equal(api.localIntent('anything about docker').repo?.repo,'gotty-docker','a sentence containing "anything" is still a search');
assert.equal(api.localIntent('quantum banana tool').suggest,true,'a miss carries the suggestion chips flag');
assert.equal(api.localIntent('most starred repo').suggest,undefined,'a hit carries no suggestion chips');
assert.notEqual(api.localIntent('AI 에이전트').repo?.repo,'im-not-ai-en','a two-letter name token alone never wins a topic query');
assert.equal(api.padAlts(catalog[0],[]).length,0,'empty related results stay empty in every search mode');
assert.equal(api.padAlts(catalog[0],[catalog[0],catalog[1],catalog[1]]).length,1,'alternatives are distinct, matching candidates only');
console.log(`Gitber search: ${cases.length+24} intent, scope, phrasing-variant and empty-catalog checks passed`);
