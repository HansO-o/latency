import {HTML,APP} from './assets.mjs';
export function validatePing(raw) {
  if(typeof raw !== 'string' || raw.length>128) return null;
  try {const p=JSON.parse(raw); return p.type==='ping' && Number.isSafeInteger(p.seq) && p.seq>=0 && p.seq<600 ? p.seq : null;} catch {return null;}
}
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
export default { async fetch(request) {
  const url=new URL(request.url);
  if(request.method!=='GET') return new Response('Method not allowed',{status:405,headers});
  if(url.pathname==='/') return new Response(HTML,{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
  if(url.pathname==='/app.js') return new Response(APP,{headers:{...headers,'content-type':'text/javascript; charset=utf-8'}});
  if(url.pathname!=='/ws') return new Response('Not found',{status:404,headers});
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket') return new Response('WebSocket upgrade required',{status:426,headers});
  if(request.headers.get('Origin')!==url.origin) return new Response('Same-origin browser required',{status:403,headers});
  const [client,server]=Object.values(new WebSocketPair());
  server.accept();
  let last=-1, tokens=4, refill=Date.now(), count=0;
  const started=Date.now();
  server.send(JSON.stringify({type:'hello',colo:request.cf?.colo||'UNKNOWN',endpoint:'wss://'+url.host+'/ws',mode:'worker',maxSamples:120}));
  server.addEventListener('message',event=>{
    const now=Date.now(); tokens=Math.min(4,tokens+(now-refill)/1000);refill=now;
    if(tokens<1 || ++count>150 || now-started>180000){server.close(1008,'Session limit');return;} tokens--;
    const seq=validatePing(event.data);
    if(seq===null || seq<=last){server.close(1008,'Invalid ping');return;}
    last=seq;server.send(JSON.stringify({type:'pong',seq}));
  });
  return new Response(null,{status:101,webSocket:client});
}};
