import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function runReadableTownBrowserCases({ run, ready, click, screenshot, delay, inside, outside, output }) {
  const baseline = process.env.READABLE_BASELINE === '1';
  const prefix = baseline ? 'before' : 'after';
  const press = async (page, key, code = key, modifiers = 0) => {
    const windowsVirtualKeyCode = { Enter: 13, Escape: 27, Tab: 9, ' ': 32 }[key] || 0;
    const text = key === 'Enter' ? '\r' : key === ' ' ? ' ' : undefined;
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode, ...(text ? { text, unmodifiedText: text } : {}) });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode });
  };
  const pointerClick = async (page, id, touch = false) => {
    await page.until(`(()=>{let el=document.getElementById(${JSON.stringify(id)});for(;el;el=el.parentElement){
      if(el.getAnimations().some(animation=>animation.playState==='running'))return false;
    }return true;})()`);
    const point = await page.evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.scrollIntoView({block:'nearest'});
      const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})()`);
    assert(point.hit, `${id} center must hit the real control, not an overlay`);
    if (touch) {
      await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
      await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
    }
  };
  for (const mobile of [false, true]) for (const lang of ['ko', 'en']) {
    const suffix = `${lang}-${mobile ? 'mobile' : 'desktop'}`;
    await run({ name: `readable-labels-${suffix}`, group: 'readable-town', query: '?dbg=1', lang, mobile, lowEnd: mobile, reduced: mobile }, async s => {
      const { page } = s;
      await ready(page); await click(page, 'startBtn'); await delay(500);
      await page.evaluate(`(()=>{
        __perfActivity(true);__sky(.38);__setPerfPose({x:0,z:0,yaw:Math.PI,pitch:.42,dist:13,modelVisible:true});
        __freezeWorldForExposure(true);
        const p=__browserGate;p.labelSubjects=[];
        p.scene.traverse(group=>{
          const resident=group.children.find(child=>child._res?._live?.group===group);
          const plate=group._bub&&group.children.find(child=>child.isSprite&&child.renderOrder===5);
          if(resident||plate)p.labelSubjects.push({id:resident?resident._res.id:'scholar-'+p.labelSubjects.length,group,tag:resident||plate});
        });
        p.labelSubjects.forEach((s,i)=>{s.group.position.set(-2.7+(i%5)*1.4,0,-8.5+Math.floor(i/5)*2.8);s.group._bt=999;});
        return p.labelSubjects.length;
      })()`);
      const observations = [];
      for (const [pose, angle, dist] of [['near', 0, 13], ['rotated', .8, 13], ['reverse', Math.PI, 13], ['close', 0, 6]]) {
        await page.evaluate(`__setPerfPose({x:0,z:0,yaw:Math.PI+${angle},pitch:.42,dist:${dist},modelVisible:true});__freezeWorldForExposure(false)`);
        await delay(450); await page.evaluate('__freezeWorldForExposure(true);__perfReset()'); await delay(500);
        const state = await page.evaluate(`(()=>{
          const p=__browserGate,c=p.camera;
          const boxes=p.labelSubjects.filter(s=>s.tag.visible&&s.group.visible&&s.tag.material.opacity>.08).map(s=>{
            const v=s.tag.position.clone();s.tag.getWorldPosition(v);const depth=-v.clone().applyMatrix4(c.matrixWorldInverse).z;
            v.project(c);const scale=s.tag.scale.clone();s.tag.getWorldScale(scale);
            const width=scale.x*c.projectionMatrix.elements[5]*innerHeight/(2*depth),height=width*scale.y/scale.x;
            return {id:s.id,depth,x:(v.x+1)*innerWidth/2-s.tag.center.x*width,y:(1-v.y)*innerHeight/2-(1-s.tag.center.y)*height,width,height};
          });
          const median=a=>a.length?a.sort((a,b)=>a-b)[Math.floor(a.length/2)]:null,frames=__perfHistory(60);
          const textures=new Set(),materials=new Set();let objects=0;p.scene.traverse(o=>{objects++;for(const m of [].concat(o.material||[])){materials.add(m);if(m.map)textures.add(m.map);}});
          const signExtents=[];
          p.scene.traverse(o=>{
            const image=o.material?.map?.image;if(!o.isMesh||o.geometry.type!=='PlaneGeometry'||image?.width!==1020||image?.height!==348)return;
            for(let parent=o;parent;parent=parent.parent)if(!parent.visible)return;
            const w=o.geometry.parameters.width/2,h=o.geometry.parameters.height/2,points=[];
            for(const [x,y] of [[-w,-h],[-w,h],[w,h],[w,-h]]){
              const v=o.position.clone().set(x,y,0).applyMatrix4(o.matrixWorld).project(c);
              if(v.z < -1||v.z > 1)return;
              points.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2});
            }
            signExtents.push({width:Math.max(...points.map(v=>v.x))-Math.min(...points.map(v=>v.x)),
              height:Math.max(...points.map(v=>v.y))-Math.min(...points.map(v=>v.y))});
          });
          const labelPixels=p.labelSubjects.map(s=>{
            const image=s.tag.material.map.image,bytes=image.getContext('2d').getImageData(0,0,image.width,image.height).data;
            let hash=2166136261;for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i],16777619);
            return {id:s.id,width:image.width,height:image.height,hash:(hash>>>0).toString(16)};
          });
          return {boxes,renderer:__perf(),frameSamples:frames.length,renderMedian:median(frames.map(f=>f.renderMs)),
            cadenceMedian:median(frames.map(f=>f.cadenceMs)),scene:{objects,textures:textures.size,materials:materials.size},
            signExtents,labelPixels,
            labelTextureBytes:p.labelSubjects.reduce((sum,s)=>sum+s.tag.material.map.image.width*s.tag.material.map.image.height*4,0),
            labels:window.__townLabels?.()||null};
        })()`);
        const clipped = state.boxes.filter(b => b.depth <= 0 || b.x < 0 || b.y < 0 || b.x + b.width > (mobile ? 390 : 1440) + 1 || b.y + b.height > (mobile ? 844 : 900) + 1);
        const collisions = state.boxes.flatMap((a, i) => state.boxes.slice(i + 1).filter(b =>
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y).map(b => [a.id, b.id]));
        observations.push({ pose, ...state, clipped: clipped.length, collisions });
        if (pose === 'near' || pose === 'rotated') await screenshot(page, `${prefix}-readable-labels-${suffix}-${pose}`);
      }
      await writeFile(join(output, `labels-${suffix}.json`), JSON.stringify({ baseline, observations }, null, 2));
      if (baseline) {
        assert(observations.some(o => o.collisions.length || o.clipped || o.boxes.some(b => b.width > 176)), 'baseline must reproduce oversized/overlapping labels');
        return { baselineReproduced: true, observations };
      }
      for (const state of observations) {
        assert(state.boxes.length <= (mobile ? 4 : 6), 'bounded visible name candidates');
        assert.equal(state.clipped, 0, 'names remain in front of the camera and inside the viewport');
        assert.equal(state.collisions.length, 0, 'world names do not overlap');
        assert(state.boxes.every(box => box.width <= (mobile ? 148 : 176) + .1 && box.height <= 36.1), 'projected name size has a near-camera ceiling');
        assert(state.signExtents.every(box=>box.width<=260.1&&box.height<=84.1),'actual projected sign-plane corners stay inside the near-camera size budget');
      }
      assert(observations.some(o => o.boxes.length > 0), 'do not solve readability by hiding every name');
      await page.evaluate(`(()=>{
        __setPerfPose({x:0,z:0,yaw:Math.PI,pitch:.42,dist:13,modelVisible:true});
        __browserGate.labelSubjects.forEach(s=>s.group.position.set(0,0,-1));
        __freezeWorldForExposure(false);
      })()`);
      await delay(450); await page.evaluate('__freezeWorldForExposure(true);__talk("deepwiki")');
      await page.until("__townLabels().entries.some(e=>e.id==='deepwiki'&&e.visible&&e.priority===3)");
      const priority = await page.evaluate(`({
        entries:__townLabels().entries.filter(e=>e.visible),
        heading:document.querySelector('#chat .ttl').textContent,
        textures:__browserGate.labelSubjects.map(s=>[s.tag.material.uuid,s.tag.material.map.uuid])
      })`);
      assert(priority.heading.includes('RIGEL'));
      assert(priority.entries.every(e => e.id === 'deepwiki'), 'talking partner wins crowded labels while chat owns the view');
      await screenshot(page, `after-readable-priority-${suffix}`);
      const stableIds = [];
      for (const yaw of [.002, -.002, .001, 0]) {
        await page.evaluate(`__setPerfPose({x:0,z:0,yaw:Math.PI+${yaw},pitch:.42,dist:13,modelVisible:true})`); await delay(100);
        stableIds.push(await page.evaluate("__townLabels().entries.filter(e=>e.visible).map(e=>e.id).join(',')"));
      }
      assert(stableIds.every(value => value === stableIds[0]), 'small camera jitter does not alternate a speaking label');
      await press(page, 'Escape'); await page.until("document.getElementById('chat').classList.contains('hidden')");
      await click(page, 'menuBtn'); await page.evaluate("document.getElementById('nearbyPeople').open=true");
      await page.until("document.querySelectorAll('#nearbyPeopleList button:not([hidden])').length>1");
      const accessible = await page.evaluate(`(()=>{
        const buttons=[...document.querySelectorAll('#nearbyPeopleList button:not([hidden])')];
        const resident=buttons.find(button=>__villagers().some(r=>r.id===button.dataset.nearbyPerson));
        resident.focus();
        return {count:buttons.length,names:buttons.map(b=>b.textContent),chosen:resident.dataset.nearbyPerson,
          live:document.getElementById('nearbyPeopleList').closest('[aria-live]')!==null};
      })()`);
      assert.equal(accessible.live, false, 'the moving roster is not a continuous live announcement');
      const ax = await page.send('Accessibility.getFullAXTree');
      assert(ax.nodes.some(node => !node.ignored && node.role?.value === 'button' && accessible.names.includes(node.name?.value)),
        'real name/role dialogue actions exist in the accessibility tree even when world labels are hidden');
      await page.evaluate(`(()=>{
        window.__readableKeyEvents=[];
        for(const type of ['keydown','keyup','click'])document.addEventListener(type,e=>__readableKeyEvents.push({
          type,key:e.key,target:e.target.id||e.target.dataset.nearbyPerson,prevented:e.defaultPrevented}),true);
      })()`);
      await press(page, 'Enter'); await delay(150);
      const selection = await page.evaluate(`({open:!document.getElementById('chat').classList.contains('hidden'),
        focused:document.activeElement.id,events:__readableKeyEvents,npc:__npc(),labels:__townLabels().entries})`);
      assert(selection.open, 'nearby keyboard action opens chat: ' + JSON.stringify(selection));
      assert((await page.evaluate("document.querySelector('#chat .ttl').textContent")).length > 0);
      await press(page, 'Escape'); await delay(120);
      const resourceBefore = await page.evaluate('__townLabels().stats');
      await delay(800);
      const resourceAfter = await page.evaluate(`({stats:__townLabels().stats,textures:__browserGate.labelSubjects.map(s=>[s.tag.material.uuid,s.tag.material.map.uuid])})`);
      assert.deepEqual(resourceAfter.textures, priority.textures, 'selection creates no new label textures or materials');
      assert.equal(resourceAfter.stats.viewportReads, resourceBefore.viewportReads, 'steady frames do not read DOM layout');
      const frameDelta = resourceAfter.stats.frames - resourceBefore.frames;
      const labelsMsPerFrame = (resourceAfter.stats.totalMs - resourceBefore.totalMs) / Math.max(1, frameDelta);
      assert(frameDelta > 10 && labelsMsPerFrame < 1, 'name/sign controller stays below one millisecond mean on this measured browser');
      await page.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
      await delay(250);
      const landscape = await page.evaluate('__townLabels()');
      assert(landscape.entries.filter(e=>e.visible).every(e=>e.left>=12&&e.top>=0&&e.left+e.width<=844&&e.top+e.height<=390),
        'landscape label bounds follow the new viewport');
      const clipping = [];
      for (const [name, x, y, depth] of [['edge', -.9, 0, 8], ['near-plane', 0, 0, .05], ['behind', 0, 0, -1]]) {
        await page.evaluate(`(()=>{
          const p=__browserGate,c=p.camera,target=p.labelSubjects.find(s=>s.tag.userData.townLabelId==='deepwiki');
          for(const subject of p.labelSubjects)subject.group.position.set(150,0,150);
          const v=target.tag.position.clone().set(${x}*(${depth})/c.projectionMatrix.elements[0],${y}*(${depth})/c.projectionMatrix.elements[5],-(${depth})).applyMatrix4(c.matrixWorld);
          target.group.position.copy(v).sub(target.tag.position);
        })()`);
        await delay(100);
        const entry = await page.evaluate("__townLabels().entries.find(e=>e.id==='deepwiki')");
        if (name !== 'edge') assert.equal(entry.visible, false, 'near-plane and behind-camera labels must be absent');
        else if (entry.visible) assert(entry.left >= 12 && entry.left + entry.width <= 844, 'edge labels clamp inside safe gutters');
        clipping.push({ name, entry });
      }
      return { observations, priority, stableIds, accessible, landscape, clipping, labelsMsPerFrame, frameDelta };
    });

    await run({ name: `readable-panels-${suffix}`, group: 'readable-town', query: '?dbg=1', lang, mobile, lowEnd: mobile, reduced: mobile }, async s => {
      const { page } = s;
      await ready(page); await click(page, 'startBtn'); await delay(650);
      await page.evaluate("document.getElementById('menuBtn').focus();__card('Repolis')");
      await page.until("document.activeElement.id==='closeBtn'");
      const before = await page.evaluate(`({chips:[...document.querySelectorAll('.caChip')].map(el=>({tag:el.tagName,role:el.getAttribute('role'),tabIndex:el.tabIndex,text:el.textContent})),
        card:document.getElementById('modal').classList.contains('show')})`);
      await page.evaluate("__atelierEnter('Repolis',{autoChat:false})");
      await page.until(inside);
      await page.send('Emulation.setDeviceMetricsOverride', { width: mobile ? 1440 : 390, height: mobile ? 900 : 844, deviceScaleFactor: 1, mobile: !mobile });
      await page.send('Emulation.setTouchEmulationEnabled', { enabled: !mobile });
      await pointerClick(page, 'atelierExit', !mobile); await page.until(outside); await delay(150);
      const restored = await page.evaluate(`(()=>{
        const el=document.getElementById('closeBtn'),r=el.getBoundingClientRect(),card=document.querySelector('#modal .card').getBoundingClientRect();
        return {open:__modal(),focus:document.activeElement.id,close:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,
          hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))},card:{top:card.top,bottom:card.bottom},viewport:[innerWidth,innerHeight]};
      })()`);
      await screenshot(page, `${prefix}-readable-card-${suffix}-resized`);
      await page.evaluate("document.getElementById('menuBtn').focus()");
      await press(page, 'Escape'); await delay(120);
      const escaped = await page.evaluate("({open:__modal(),inside:document.body.classList.contains('atelier-active'),focus:document.activeElement.id})");
      await writeFile(join(output, `panels-${suffix}.json`), JSON.stringify({ baseline, before, restored, escaped }, null, 2));
      if (baseline) {
        assert(before.chips.some(chip => chip.tag !== 'BUTTON') && (escaped.open || !restored.close.hit), 'baseline must reproduce inaccessible chips and card ownership/close failure');
        return { baselineReproduced: true, before, restored, escaped };
      }
      assert(before.chips.every(chip => chip.tag === 'BUTTON' && chip.tabIndex === 0 && chip.text), 'question shortcuts are named keyboard buttons');
      assert(restored.open && restored.close.hit && restored.close.height >= 44, 'restored card close is visible, unobstructed and touch-sized');
      assert(restored.close.top >= 0 && restored.close.bottom <= restored.viewport[1], 'restored close remains in viewport without manual scroll');
      assert(!escaped.open && !escaped.inside, 'one Escape outside card closes only the restored card');
      assert(escaped.focus, 'card dismissal restores focus to a meaningful control');
      await page.evaluate("__card('Repolis')"); await page.until("document.activeElement.id==='closeBtn'");
      await press(page, 'Tab', 'Tab', 8); // CDP modifier 8 is Shift.
      assert.equal(await page.evaluate('document.activeElement.id'), 'cardCloseAction', 'Shift+Tab wraps to the last card action');
      await press(page, 'Tab');
      assert.equal(await page.evaluate('document.activeElement.id'), 'closeBtn', 'Tab wraps to the fixed close control');
      await page.evaluate("document.getElementById('menuBtn').focus()");
      await press(page, 'Tab');
      assert.equal(await page.evaluate('document.activeElement.id'), 'closeBtn', 'Tab outside the active modal recovers its first control');
      await pointerClick(page, 'closeBtn', !mobile); await page.until('!__modal()');
      await page.evaluate("document.activeElement.blur()");
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW' }); await delay(140);
      await page.evaluate("__card('Repolis')");
      const stopped = await page.evaluate('__pos()'); await delay(180);
      assert.deepEqual(await page.evaluate('__pos()'), stopped, 'opening a card clears already-held movement');
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW' });
      await page.evaluate("document.querySelector('.caChip').focus()");
      const chipName = await page.evaluate('document.activeElement.textContent');
      await press(page, 'Enter'); await page.until("!document.getElementById('chat').classList.contains('hidden')");
      assert(!await page.evaluate('__modal()'), 'chip activation hands ownership to existing chat');
      await delay(300);
      const chatActions = await page.evaluate("[...document.querySelectorAll('#chatLog .ride,#chatLog .alt')].map(el=>({tag:el.tagName,name:el.textContent,tabIndex:el.tabIndex}))");
      assert(chatActions.every(action=>action.tag==='BUTTON'&&action.tabIndex===0&&action.name),'related repository/handoff chat actions use native named buttons');
      await page.evaluate("document.getElementById('chatText').value='보존할 입력';document.getElementById('chatText').focus()");
      const ime = await page.evaluate(`(()=>{
        const input=document.getElementById('chatText'),before=document.getElementById('chatLog').childElementCount;
        input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',isComposing:true,bubbles:true,cancelable:true}));
        input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true,cancelable:true}));
        return {open:!document.getElementById('chat').classList.contains('hidden'),text:input.value,before,after:document.getElementById('chatLog').childElementCount};
      })()`);
      assert(ime.open && ime.text === '보존할 입력' && ime.before === ime.after, 'IME Escape/Enter must not close or submit');
      await press(page, 'Escape'); await page.until("document.getElementById('chat').classList.contains('hidden')");
      await page.evaluate("__card('Repolis')"); await page.until("document.activeElement.id==='closeBtn'");
      await page.evaluate("document.querySelector('.caChip').focus()");
      await press(page, ' ', 'Space'); await page.until("!document.getElementById('chat').classList.contains('hidden')");
      await press(page, 'Escape'); await delay(120);
      await click(page, 'menuBtn'); await delay(120);
      const menuPose = await page.evaluate('__pos()'), menuCamera = await page.evaluate('__cam()');
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 3, y: 240, button: 'left', buttons: 1, clickCount: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 18, y: 270, button: 'left', buttons: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 18, y: 270, button: 'left', buttons: 0, clickCount: 1 });
      await delay(120);
      assert.deepEqual(await page.evaluate('__pos()'), menuPose, 'menu backdrop cannot leak movement');
      const menuCameraAfter = await page.evaluate('__cam()');
      for (const key of ['camYaw', 'camPitch', 'camDist']) assert.equal(menuCameraAfter[key], menuCamera[key], 'menu backdrop cannot leak camera drag');
      if (await page.evaluate("!document.getElementById('panel').classList.contains('hidden')")) await press(page, 'Escape');
      return { before, restored, escaped, chipName, chatActions, ime, menuPose };
    });

    if (!baseline) await run({ name: `readable-fast-return-${suffix}`, group: 'readable-town', query: '?dbg=1',
      lang, mobile, lowEnd: mobile, reduced: mobile }, async s => {
      const { page } = s; await ready(page); await click(page, 'startBtn');
      await page.evaluate("__card('Repolis');__atelierEnter('Repolis',{autoChat:false})");
      await page.until(inside); await delay(120);
      assert.equal(await page.evaluate('__modal()'), false, 'delayed startup hash cannot reopen an exterior card over the room');
      await page.evaluate("__atelierAction('ask')"); await page.until("document.activeElement.id==='chatText'");
      const chatBefore = await page.evaluate('__repositoryAtelier().chat');
      await page.send('Input.insertText', { text: lang === 'ko' ? '전시실 입력 보존' : 'Preserve this room draft' });
      const draft = await page.evaluate("document.getElementById('chatText').value");
      for (const mode of ['lean', 'balanced', 'auto']) {
        await page.evaluate(`__visualGovernor(${JSON.stringify(mode)})`); await delay(100);
        assert.equal(await page.evaluate("document.getElementById('chatText').value"), draft);
        assert.equal(await page.evaluate('__repositoryAtelier().chat.calls'), 0);
      }
      await press(page, 'Escape'); await page.until("document.getElementById('chat').classList.contains('hidden')");
      assert.equal(await page.evaluate("document.body.classList.contains('atelier-active')"), true, 'one Escape closes chat, not the room');
      await page.evaluate('__atelierBlueprintOpen()'); await delay(100);
      const blueprint = await page.evaluate('__atelierBlueprint()');
      await press(page, 'Escape');
      assert.equal(await page.evaluate("document.body.classList.contains('atelier-active')"), true, 'one Escape closes Blueprint, not the room');
      await page.evaluate("__atelierAction('ask')"); await page.until("document.activeElement.id==='chatText'");
      assert.equal(await page.evaluate('__repositoryAtelier().chat.calls'), chatBefore.calls);
      assert.equal(await page.evaluate('__repositoryAtelier().chat.repoName'), 'hyeonsangjeon/Repolis');
      await press(page, 'Escape'); await delay(120);
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, autoRepeat: true });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      assert.equal(await page.evaluate("document.body.classList.contains('atelier-active')"), true, 'a held Escape cannot cascade into room exit');
      await press(page, 'Escape'); await page.until(outside);
      assert.equal(await page.evaluate('__repositoryAtelier().chat'), null);
      assert.equal(await page.evaluate('__modal()'), true, 'room Escape restores exactly the exterior card');
      await press(page, 'Escape'); await page.until('!__modal()');
      await page.evaluate("__atelierEnter('Repolis',{autoChat:false})"); await page.until(inside);
      assert.equal(await page.evaluate('__repositoryAtelier().chat.calls'), 0, 'new room visit resets its call budget');
      await pointerClick(page, 'atelierExit', mobile); await page.until(outside);
      return { chatBefore, blueprint, preservedDraft: draft, reentryCalls: 0 };
    });
  }
}
