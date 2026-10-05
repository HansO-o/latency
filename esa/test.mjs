import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './function.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('ESA HTTP echo and no-cache response without CF or Upgrade APIs', async () => {
  const request = {url:'https://esa.example/api/ping?seq=0',method:'GET',get cf(){throw Error('CF API');},get headers(){throw Error('Forbidden headers');}};
  const r = await worker.fetch(request);
  assert.equal(r.status,200); assert.match(r.headers.get('cache-control'),/no-store/);
  assert.deepEqual(await r.json(),{type:'pong',seq:0,provider:'Alibaba ESA',transport:'http',colo:null});
});
test('ESA route, method, and bounded sequence validation',async()=>{
  for (const [path,method,status] of [['/ws','GET',404],['/api/ping?seq=0','POST',405],['/api/ping','GET',400],['/api/ping?seq=-1','GET',400],['/api/ping?seq=120','GET',400],['/api/ping?seq=1.5','GET',400],['/api/ping?seq=01','GET',400],['/api/ping?seq=119','GET',200]]) assert.equal((await worker.fetch(new Request('https://esa.example'+path,{method}))).status,status);
});
function harness(autoStart = true) {
 let time=0,next=0;const timers=new Map(),els=new Map(),events={},requests=[];
 const el=id=>{if(!els.has(id))els.set(id,{textContent:'',setAttribute(){}});return els.get(id)};
 const doc={hidden:false,getElementById:el,addEventListener:(key,fn)=>events[key]=fn};
 const fetch=(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}));
 vm.runInNewContext(readFileSync(new URL('../esa-dist/app.js',import.meta.url),'utf8'),{document:doc,window:{addEventListener:(key,fn)=>events[key]=fn},location:{origin:'https://esa.example'},performance:{now:()=>time},AbortController,fetch,Date,Math,setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:time+ms});return id;},clearTimeout:id=>timers.delete(id)});
 if (autoStart) el('start').onclick();
 return {el,doc,events,requests,tick(ms){time+=ms;for(const[id,t]of[...timers])if(t.at<=time){timers.delete(id);t.fn();}},async pong(n){const req=requests[n];req.resolve({ok:true,json:async()=>({type:'pong',seq:Number(new URL(req.url,'https://esa.example').searchParams.get('seq')),transport:'http'})});await new Promise(setImmediate)}};
}
test('ESA UI success, no cache, stop/restart ignores stale response and background stops',async()=>{
 const h=harness();h.tick(20);await h.pong(0);assert.equal(h.el('current').textContent,'20.0');assert.equal(h.requests[0].options.cache,'no-store');h.tick(1000);h.el('stop').onclick();h.el('start').onclick();await h.pong(1);assert.equal(h.el('count').textContent,'0 / 0');h.tick(30);await h.pong(2);assert.equal(h.el('current').textContent,'30.0');h.doc.hidden=true;h.events.visibilitychange();h.tick(2000);assert.equal(h.requests.length,3);assert.match(h.el('status').textContent,/后台/);
});
test('ESA UI bounded to 120 samples',async()=>{const h=harness();for(let i=0;i<120;i++){h.tick(20);await h.pong(i);h.tick(1000)}assert.equal(h.requests.length,120);assert.equal(h.el('status').textContent,'测试完成 · 120 次')});

test('ESA landing never auto-starts or claims WSS support',()=>{const h=harness(false);assert.equal(h.requests.length,0);h.tick(10000);assert.equal(h.requests.length,0);assert.match(h.el('status').textContent,/WebSocket 尚未适配/);assert.equal(h.el('start').textContent,'开始 HTTP 测试')});
