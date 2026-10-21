import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section=(start,end)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`${start} is present`);return html.slice(a,b);
};
const pacing=runInNewContext(section('function growthMilestoneSeconds(', 'function _renderTownGrowthReplay(')
  +'\ngrowthMilestoneSeconds',{_growthRepoLabel:name=>name});
assert.equal(pacing(null),2.8);
const sparse=pacing({added:['a']}),busy=pacing({added:['alpha','bravo','charlie','delta','echo']});
assert(busy>sparse&&sparse>1.35,'busy years stay readable longer than sparse years');
assert.equal(pacing({added:Array(100).fill('x'.repeat(200))}),5.85,'bounded names cannot stall the replay');
for(let n=0;n<30;n++)assert(pacing({added:Array(n).fill('repo')})>=2.8&&pacing({added:Array(n).fill('repo')})<=6);
const vector=values=>({values:[...values],toArray(){return [...this.values];},fromArray(v){this.values=[...v];}});
const camera={position:vector([1,2,3]),quaternion:vector([0,0,0,1]),zoom:1.7,
  view:{enabled:true,offsetX:4,offsetY:6,width:1440,height:900,fullWidth:1440,fullHeight:900},
  updateProjectionMatrix(){},updateMatrixWorld(){}};
const B={framingKey:'changed'},ctx={camera,camYaw:.2,camPitch:.4,camDist:7,REPOSITORY_ATELIER:{blueprint:B}};
runInNewContext(section('function _repositoryBlueprintCameraSnapshot(', 'function _frameRepositoryBlueprint(')
  +section('function _restoreRepositoryBlueprintCamera(', 'function repositoryBlueprintOpen(')
  +'\nglobalThis.snapshot=_repositoryBlueprintCameraSnapshot;globalThis.restore=_restoreRepositoryBlueprintCamera;',ctx);
for(const view of [null,camera.view]){
  camera.view=view;B.cameraOnOpen=ctx.snapshot();const saved=JSON.stringify(B.cameraOnOpen);
  if(camera.view)camera.view.offsetX=100;
  camera.position.fromArray([4,5,6]);camera.zoom=.4;ctx.camDist=100;ctx.restore();
  assert.equal(JSON.stringify(ctx.snapshot()),saved,'camera pose, projection and controller restore exactly');
  assert.equal(B.framingKey,null);
}
const card=section('<div class="cardScroll"','<div id="libModal"');
assert(card.indexOf('id="cardDesc"')<card.indexOf('id="cardActions"'));
assert(card.indexOf('id="cardActions"')<card.indexOf('id="cardDetails"'));
assert(!/<details id="cardDetails"[^>]*\bopen/.test(card),'card details are opt-in');
const intro=section('<div id="intro"','<div id="tourCap"');
assert(intro.indexOf('id="startBtn"')<intro.indexOf('id="introLaunchForm"'),'forks and ready targets keep entry first in markup order');
assert(html.includes("if(on&&introLaunch.nextElementSibling!==introStartBtn) inner.insertBefore(introLaunch,introStartBtn);")
  &&html.includes("const landing=!ready&&!blueprintReady&&cityMode==='owner'&&!cityError&&window.REPOLIS_CONFIG?.town?.canonical===true;"),
  'only the canonical owner landing moves the login form ahead of the sample city');
assert(!/<details id="introControls"[^>]*\bopen/.test(intro));
assert(html.includes("document.getElementById('cardDetails').open=false"),'each arrival starts compact');
assert(html.includes('camera.near=5; camera.far=1100'),'aerial precision is scoped to replay');
assert(html.includes('camera.near=saved.cameraNear'),'walking near plane is restored');
assert.equal(html.split('A.materials.terminal,blueprintNodeCapacity').length-1,2,'both bounded node batches reuse the existing material');
console.log('Discovery UI: pacing, exact camera restoration and progressive-disclosure guards passed');
