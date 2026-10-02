import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mock } from 'node:test';
import {
  REPOSITORY_EXHIBIT_LIMITS as L, projectRepositoryExhibit, repositoryExhibitLink,
  selectRepositoryGettingStarted, readRepositoryExhibit as readDocument, createRepositoryExhibitVisit,
  loadRepositoryExhibitVisit as loadVisit, cancelRepositoryExhibitVisit,
} from '../assets/repository-exhibit.js';

const root = new URL('./fixtures/repository-exhibit/', import.meta.url);
const readRepositoryExhibit = (value, options) => readDocument(value, { now: () => 1790899200000, ...options });
const loadRepositoryExhibitVisit = (value, options) => loadVisit(value, { now: () => 1790899200000, ...options });
const sources = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'));
const response = (content, target, changes = {}) => {
  const bytes = Buffer.from(content);
  return { type: 'file', path: 'README.md', encoding: 'base64', size: bytes.length,
    content: bytes.toString('base64'), sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
    html_url: `https://github.com/${target.repoName}/blob/${target.defaultBranch}/README.md`, ...changes };
};
const jsonResponse = (raw, status = 200, headers = {}) => new Response(JSON.stringify(raw), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const target = { repoName: 'public-owner/example', defaultBranch: 'main', private: false };
let count = 0;
const check = (condition, message) => { assert(condition, message); count++; };
for (const source of sources) {
  const text = await readFile(new URL(source.file, root), 'utf8'), bytes = Buffer.from(text);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), source.sha);
  const t = { repoName: source.repoName, defaultBranch: source.ref };
  let requested;
  const result = await readRepositoryExhibit(t, { now: () => 1790899200000, fetchImpl: async (url, options) => {
    requested = { url, options }; return jsonResponse(response(text, t));
  } });
  check(result.ok && result.document.sections.length > 0, `${source.file}: real start sections selected`);
  assert.equal(result.document.source.blobSha, source.sha);
  assert.equal(requested.url, `https://api.github.com/repos/${t.repoName}/readme?ref=${t.defaultBranch}`);
  assert.equal(requested.options.credentials, 'omit'); assert.equal(requested.options.redirect, 'error');
  check(!Object.keys(requested.options.headers).some(key => /authorization|cookie/i.test(key)), 'anonymous exact-host request');
  const blocks = result.document.sections.flatMap(section => section.blocks);
  for (const code of blocks.filter(block => block.type === 'code')) check(text.includes(code.text), `${source.file}: copied code is byte-exact source`);
  if (source.file === 'repolis.md') {
    check(blocks.some(block => block.text.includes('python3 -m http.server 8000')), 'Repolis actual zero-build command retained');
    check(blocks.some(block => block.text.includes('No installation or build step is required.')), 'Repolis surrounding no-build condition retained');
  } else {
    check(blocks.some(block => block.text.includes('MY_ID') && block.text.includes('MY_PW') && block.type === 'text'), 'NAS credential condition retained, not just docker command');
    check(blocks.some(block => block.text.includes('--net=host')), 'NAS host-network variant retained with its heading');
    check(blocks.some(block => block.text.includes('Prepare `Auth.json`')), 'NAS local-development prerequisite retained');
  }
}
const conditional = '# Test\n## Windows\nOnly Windows 11.\n### Installation\n```sh\r\nfirst --windows\r\nsecond\r\n```\n## Linux\nRequires a container.\n### Setup\n```sh\nlinux-only\n```\n';
const selected = selectRepositoryGettingStarted(conditional);
check(selected.sections.length === 2 && selected.sections[0].heading === 'Windows', 'nested installation retains complete platform parent');
assert.equal(selected.sections[0].blocks.find(block => block.type === 'code').text, 'first --windows\r\nsecond\r\n');
check(selected.sections[0].blocks.some(block => block.text === 'Only Windows 11.'), 'platform condition kept with commands');
check(selectRepositoryGettingStarted('## Overview\nA thing.\n').sections.length === 0, 'no guessed start instructions');
check(selectRepositoryGettingStarted('## 설치\n먼저 환경을 준비하세요.\n```sh\n원문명령\n```\n').sections.length === 1, 'Korean source headings retained');
for(const heading of ['Install','Installation','Installing','Install\n-------']){
  check(selectRepositoryGettingStarted((heading.includes('\n')?'':'## ')+heading+'\n\n    first\n\n    second\n').sections.length===1,'common install and setext headings are recognized');
}
const indented=selectRepositoryGettingStarted('## Install\n\n    first\n\n    second\n');
assert.equal(indented.sections[0].blocks.filter(block=>block.type==='code').length,1);
assert.equal(indented.sections[0].blocks[0].text,'first\n\nsecond\n');
check(true,'an indented code block retains its internal blank line instead of splitting the procedure');
check(selectRepositoryGettingStarted('## Usage\n```md\n## Installation\nfake\n```\n').sections.length === 0, 'headings inside code do not select a procedure');
check(selectRepositoryGettingStarted('<!--\n## Installation\nhidden\n-->\n').sections.length === 0, 'comments are not instructions');
check(selectRepositoryGettingStarted('## Setup\n```sh\nunterminated\n').limited, 'incomplete fenced section omitted honestly');
check(selectRepositoryGettingStarted('## Setup\n```sh\n' + 'x'.repeat(L.codeBytes) + '\n```\n').limited, 'oversized command is not truncated');
check(selectRepositoryGettingStarted(('## Setup\nx\n').repeat(12)).sections.length === L.sections, 'section count bounded');
check(selectRepositoryGettingStarted('\n'.repeat(L.lines + 1)).limited, 'pathological line count bounded');
check(!projectRepositoryExhibit({ ...target, description: '', homepage: 'javascript:alert(1)' }).description, 'empty description remains absent');
check(!projectRepositoryExhibit({ ...target, private: true }).target, 'known private target refused before request');
for(const invalid of [{...target,private:true},{...target,deleted:true},{...target,defaultBranch:'../main'},{...target,repoName:'../private'}]){
  const result=await readRepositoryExhibit(invalid,{fetchImpl:()=>{throw new Error('Must not request an invalid target');}});
  check(!result.ok&&result.requestsStarted===0,'known private/deleted/malformed target makes zero requests');
}
for (const url of ['javascript:alert(1)', 'data:text/html,hi', '//localhost/path', 'https://user:pass@example.com', 'https://127.0.0.1/x', 'https://example.com\\@evil.com']) {
  check(!repositoryExhibitLink(url, 'https://github.com/public-owner/example/blob/main/README.md'), 'unsafe external URL rejected');
}
assert.equal(repositoryExhibitLink('https://example.org/docs'), 'https://example.org/docs');
let calls = 0;
const fixture = response('## Getting started\nRead this first.\n```sh\nexact command\n```\n', target);
let rejectedSignal;
await readRepositoryExhibit(target,{fetchImpl:async(_url,{signal})=>{
  rejectedSignal=signal;
  return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('error'));}}),{status:403});
}});
check(rejectedSignal.aborted,'rejected HTTP headers cancel the unread body instead of leaving unbounded background traffic');
check((await readRepositoryExhibit(target,{fetchImpl:async()=>new Response('<html>not a GitHub file</html>',{headers:{'content-type':'text/html'}})})).status==='malformed','HTML responses cannot become README content');
for (const [status, expected, headers] of [[404,'not_found'],[403,'forbidden'],[429,'rate_limited'],[403,'rate_limited',{'x-ratelimit-remaining':'0'}],[302,'redirect'],[500,'unavailable']]) {
  const result = await readRepositoryExhibit(target, { fetchImpl: async () => { calls++; return jsonResponse({}, status, headers); } });
  check(result.status === expected && result.requestsStarted === 1 && result.retries === 0, `HTTP ${status}: truthful ${expected}`);
}
for (const [changes, expected] of [
  [{html_url:'https://github.com/other/repo/blob/main/README.md'},'scope_mismatch'],
  [{html_url:'https://github.com/public-owner/example/blob/main/other.md'},'scope_mismatch'],
  [{size:L.documentBytes+1},'oversized'],[{content:'%%%bad'},'malformed'],[{size:1},'malformed'],
  [{path:'../README.md'},'malformed'],[{type:'symlink'},'malformed'],[{encoding:'none'},'malformed'],
]) {
  const result = await readRepositoryExhibit(target, { fetchImpl: async () => jsonResponse({...fixture,...changes}) });
  check(result.status === expected, `document validation ${JSON.stringify(changes)}`);
}
for (const payload of ['{', ' '.repeat(L.responseBytes + 1)]) {
  const result = await readRepositoryExhibit(target, { fetchImpl: async () => new Response(payload,{headers:{'content-type':'application/json'}}) });
  check(!result.ok && ['malformed','oversized'].includes(result.status), 'malformed/oversized encoded response refused');
}
const visit = createRepositoryExhibitVisit(target);
let visitCalls = 0;
const fetchImpl = async () => { visitCalls++; return jsonResponse(fixture); };
await Promise.all([loadRepositoryExhibitVisit(visit,{fetchImpl}),loadRepositoryExhibitVisit(visit,{fetchImpl})]);
await loadRepositoryExhibitVisit(visit,{fetchImpl});
check(visitCalls === 1 && visit.requestsStarted === 1 && visit.status === 'ready', 'one request and visit memory across concurrent actions/reopens');
cancelRepositoryExhibitVisit(visit);
check(visit.result === null && visit.cancelled, 'exit clears document memory');
await loadRepositoryExhibitVisit(visit,{fetchImpl});
assert.equal(visitCalls,1);
const pending = createRepositoryExhibitVisit(target);
const promise = loadRepositoryExhibitVisit(pending,{fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
})});
cancelRepositoryExhibitVisit(pending);
await promise;
check(pending.result === null, 'late aborted request cannot repopulate the departed room');
let resolveLate;
const late = createRepositoryExhibitVisit(target);
const lateRead = loadRepositoryExhibitVisit(late,{fetchImpl:()=>new Promise(resolve=>{resolveLate=resolve;})});
cancelRepositoryExhibitVisit(late);
const nextVisit = createRepositoryExhibitVisit({repoName:'different-owner/next',defaultBranch:'main'});
resolveLate(jsonResponse(fixture));await lateRead;
check(late.result === null && nextVisit.result === null && nextVisit.requestsStarted === 0,'even a transport ignoring abort cannot leak a late success across visits');
mock.timers.enable({apis:['setTimeout']});
try {
  const timeout = readRepositoryExhibit(target,{fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  })});
  mock.timers.tick(8000);
  check((await timeout).status === 'timeout','eight-second deadline bounds response headers without a retry');
  let bodyController;
  const bodyTimeout = readRepositoryExhibit(target,{fetchImpl:async(_url,{signal})=>{
    const body=new ReadableStream({start(controller){bodyController=controller;controller.enqueue(new TextEncoder().encode('{'));}});
    signal.addEventListener('abort',()=>bodyController.error(new DOMException('Aborted','AbortError')),{once:true});
    return new Response(body,{headers:{'content-type':'application/json'}});
  }});
  await Promise.resolve();await Promise.resolve();
  mock.timers.tick(8000);
  check((await bodyTimeout).status === 'timeout','same deadline bounds a stalled body after successful headers');
} finally { mock.timers.reset(); }
const html = await readFile(new URL('../index.html',import.meta.url),'utf8');
const transition = html.slice(html.indexOf('function _repositoryAtelierTransition('),html.indexOf('function _updateRepositoryAtelierAvatar('));
check(!transition.includes('_startRepositoryAtelierChatVisit()'), 'entry transition never starts an AI question');
const reader = html.slice(html.indexOf('function _exhibitElement('),html.indexOf('function _bindRepositoryAtelier('));
check(!/innerHTML|outerHTML|insertAdjacentHTML|createElement\(['"](?:img|iframe|video|script)|\beval\(/.test(reader),'source rendering remains text/DOM only, with no raw markup or auto-loaded media');
console.log(`Repository Exhibit: ${count} checks passed`);
