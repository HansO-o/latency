import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createProbeStream, STREAM_COUNT, STREAM_INTERVAL_MS, STREAM_LIMIT_MS} from './stream.mjs';
import worker from './function.mjs';
test('real default TransformStream returns immediate first record and paced subsequent records',async()=>{
 const before=performance.now();const response=await worker.fetch(new Request('https://esa.example/api/stream'));
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('cache-control'),/no-transform/);
 const reader=response.body.getReader(),decoder=new TextDecoder(), records=[],arrivals=[];
 for(;;){const {done,value}=await reader.read();if(done)break;arrivals.push(performance.now());records.push(JSON.parse(decoder.decode(value)))}
 assert.equal(records.length,STREAM_COUNT);assert.ok(arrivals[0]-before<1000,'first record must arrive before whole stream completes');
 for(let i=0;i<records.length;i++){assert.equal(records[i].seq,i);assert.equal(records[i].totalChunks,STREAM_COUNT);assert.equal(records[i].targetIntervalMs,STREAM_INTERVAL_MS);if(i)assert.ok(arrivals[i]-arrivals[i-1]>=STREAM_INTERVAL_MS-35,'timed records should not be pre-buffered by implementation')}
 assert.ok(arrivals.at(-1)-before>=STREAM_INTERVAL_MS*(STREAM_COUNT-1)-100);assert.ok(arrivals.at(-1)-before<STREAM_LIMIT_MS);
});
test('reader cancellation stops producer and clears pending delay promptly',async()=>{
 const {readable,finished}=createProbeStream({count:20,intervalMs:500,limitMs:3000});const r=readable.getReader();await r.read();const before=performance.now();await r.cancel('user stopped');await finished;assert.ok(performance.now()-before<250);
});
test('blocked reader has bounded deadline; no continuing production',async()=>{
 const {readable,finished}=createProbeStream({count:20,intervalMs:20,limitMs:80});const r=readable.getReader();await r.read();await new Promise(resolve=>setTimeout(resolve,140));
 // Drain a write already pending at the deadline, then observe the abort.
 try {while(!(await r.read()).done){}}catch(error){assert.match(error.message,/duration limit/)}await finished;
});
test('stream endpoint only accepts GET and does not read CF/Upgrade headers',async()=>{
 assert.equal((await worker.fetch(new Request('https://esa.example/api/stream',{method:'POST'}))).status,405);
 const response=await worker.fetch({method:'GET',url:'https://esa.example/api/stream',get headers(){throw Error('No header access');},get cf(){throw Error('No CF');}});await response.body.cancel();
});
