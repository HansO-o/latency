import {stats} from './stats.mjs';
const $=id=>document.getElementById(id);
let ws=null,timer=null,deadline=null,helloTimer=null,seq=0,values=[],timeouts=0,pending=null,active=false;
const endpoint=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws';
$('endpoint').textContent=endpoint;
function status(text){$('status').textContent=text;}
function render(){const s=stats(values); for(const id of ['current','median','p95','jitter'])$(id).textContent=s?s[id].toFixed(1):'—';$('count').textContent=values.length+' / '+timeouts;
  const max=Math.max(...values,1);$('line').setAttribute('points',values.map((v,i)=>(i/119*800).toFixed(1)+','+(96-v/max*90).toFixed(1)).join(' '));$('range').textContent=s?s.min.toFixed(1)+' – '+s.max.toFixed(1)+' ms':'等待样本';}
function stop(reason){active=false;clearTimeout(timer);clearTimeout(deadline);clearTimeout(helloTimer);pending=null;const old=ws;ws=null;if(old&&old.readyState<2)old.close(1000,'Test stopped');$('stop').disabled=true;$('start').disabled=false;status(reason);}
function schedule(){if(!active)return;if(seq>=120){stop('测试完成 · 120 次');return;}timer=setTimeout(ping,1000);}
function ping(){if(!active||!ws||ws.readyState!==WebSocket.OPEN)return;const id=seq++;pending={seq:id,sent:performance.now()};ws.send(JSON.stringify({type:'ping',seq:id}));deadline=setTimeout(()=>{pending=null;timeouts++;render();schedule();},3000);}
function start(){if(document.hidden)return;stop('正在建立连接…');seq=0;values=[];timeouts=0;render();$('colo').textContent='等待连接';$('handshake').textContent='—';active=true;$('start').disabled=true;$('stop').disabled=false;const before=performance.now();const socket=new WebSocket(endpoint);ws=socket;
  helloTimer=setTimeout(()=>{if(ws===socket)stop('连接超时 · 请检查网络后重试');},10000);
  socket.onopen=()=>{if(ws!==socket)return;$('handshake').textContent=(performance.now()-before).toFixed(1)+' ms（含连接准备及握手）';};
  socket.onmessage=event=>{if(ws!==socket||!active)return;let msg;try{msg=JSON.parse(event.data)}catch{return;}if(msg.type==='hello'){clearTimeout(helloTimer);$('colo').textContent=msg.colo+' · Cloudflare 入口';status('已连接 · 每秒采样');ping();return;}if(msg.type==='pong'&&pending&&msg.seq===pending.seq){const rtt=performance.now()-pending.sent;pending=null;clearTimeout(deadline);values.push(rtt);render();schedule();}};
  socket.onerror=()=>{if(ws===socket)stop('连接失败 · 请检查网络后重试');};socket.onclose=event=>{if(ws===socket)stop('连接已断开（'+event.code+'）· 可重新测试');};
}
$('start').onclick=start;$('stop').onclick=()=>stop('已停止');document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)stop('页面进入后台 · 已停止');});window.addEventListener('pagehide',()=>stop('已停止'));start();
