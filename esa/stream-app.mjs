const $ = id => document.getElementById(id);
let generation=0, session=null;
const format = value => value == null ? '—' : value.toFixed(1);
function end(reason) {
  generation++;
  if(session){clearTimeout(session.timer);session.abort.abort();session.reader?.cancel().catch(()=>{});session=null;}
  $('start').disabled=false;$('stop').disabled=true;$('status').textContent=reason;
}
function render(s) {
  const sorted=[...s.intervals].sort((a,b)=>a-b),n=sorted.length;
  const median=n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null;
  $('first').textContent=format(s.first);
  $('median').textContent=format(median);
  $('p95').textContent=format(n?sorted[Math.ceil(n*.95)-1]:null);
  $('deviation').textContent=format(n?s.deviations.reduce((a,b)=>a+b,0)/n:null);
  $('count').textContent=s.count+' / 12';$('groups').textContent=String(s.groups);
  $('warning').textContent=s.batched?'疑似缓冲或批量交付：不能把紧密到达的记录解释为低网络延迟':'尚未观察到明显批量交付；这不证明中间链路完全无缓冲';
}
function accept(s,line,arrival) {
  if(!line || line.length>1024)throw Error('记录长度异常');
  const m=JSON.parse(line);
  if(m.type!=='chunk'||m.seq!==s.count||m.totalChunks!==12||m.targetIntervalMs!==250||!Number.isFinite(m.serverElapsedMs)||m.serverElapsedMs<0||m.serverElapsedMs>10000||s.count>=12)throw Error('记录格式或顺序异常');
  if(s.count){
    const server=m.serverElapsedMs-s.previousServer,client=arrival-s.previousArrival;
    if(server<0)throw Error('服务端计时倒退');
    s.intervals.push(client);s.deviations.push(Math.abs(client-server));
    if(client<25&&server>=125)s.batched=true;
  }else{s.first=arrival-s.started;}
  s.previousServer=m.serverElapsedMs;s.previousArrival=arrival;s.count++;
}
async function start() {
  if(document.hidden)return;
  end('正在请求流…');
  const token=generation,s={abort:new AbortController(),reader:null,timer:null,started:performance.now(),first:null,count:0,groups:0,bytes:0,buffer:'',intervals:[],deviations:[],batched:false};session=s;
  $('start').disabled=true;$('stop').disabled=false;$('total').textContent='—';render(s);
  s.timer=setTimeout(()=>{if(session===s)end('流测试超时 · 已停止');},10000);
  try {
    const r=await fetch('/api/stream?nonce='+encodeURIComponent(Date.now()+'-'+Math.random()),{cache:'no-store',credentials:'omit',signal:s.abort.signal});
    if(token!==generation){await r.body?.cancel();return;}
    if(!r.ok||!r.body)throw Error('HTTP '+r.status+' 或缺少响应流');
    if(!(r.headers.get('content-type')||'').includes('application/x-ndjson'))throw Error('响应不是 NDJSON 流');
    s.reader=r.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});
    for(;;){
      const {done,value}=await s.reader.read();if(token!==generation)return;
      if(done){s.buffer+=decoder.decode();if(s.buffer.trim()||s.count!==12)throw Error('流提前结束或末尾记录不完整');break;}
      const arrival=performance.now();s.bytes+=value.byteLength;
      if(s.bytes>32768)throw Error('流数据超过上限');
      if(!value.byteLength)continue;s.groups++;s.buffer+=decoder.decode(value,{stream:true});let completed=0;
      for(;;){const pos=s.buffer.indexOf('\n');if(pos<0)break;const line=s.buffer.slice(0,pos);s.buffer=s.buffer.slice(pos+1);accept(s,line,arrival);completed++;}
      if(s.buffer.length>1024)throw Error('记录超过上限');
      if(completed>1)s.batched=true;
      render(s);$('status').textContent='接收中 · '+s.count+' / 12';
    }
    $('total').textContent=format(performance.now()-s.started);render(s);end('流测试完成 · 12 条记录');
  }catch(error){if(token===generation)end('测试失败 · '+error.message);}
  finally{try{s.reader?.releaseLock();}catch{}}
}
$('start').onclick=start;$('stop').onclick=()=>end('已停止');
document.addEventListener('visibilitychange',()=>{if(document.hidden&&session)end('页面进入后台 · 已停止');});
window.addEventListener('pagehide',()=>end('已停止'));
$('endpoint').textContent=location.origin+'/api/stream';
$('status').textContent='准备就绪 · 手动开始';$('stop').disabled=true;
