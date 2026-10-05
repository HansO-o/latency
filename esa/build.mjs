import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const out = new URL('esa-dist/', root); mkdirSync(out, {recursive:true});
let html = read('index.html').replaceAll('Cloudflare', 'Alibaba ESA').replace('CLOUDFLARE NETWORK','ALIBABA ESA NETWORK').replace('用一条 WebSocket 连接，观察当前网络到 Alibaba ESA 入口的真实往返时间。','ESA WebSocket 终止尚未实现。下方是可选 HTTP 往返测试，点击后才开始，不能替代原 WebSocket 指标。').replace('浏览器 ⇄ Worker · WebSocket echo','浏览器 ⇄ ESA 函数 · HTTP echo').replace(/<p class="note">[\s\S]*?<\/p>/, '<p class="note">此版本使用 HTTP echo，并非 WebSocket 测试。RTT 包含 HTTP 请求、网络、边缘函数处理与浏览器调度，不能与 WebSocket RTT 直接等同。首个请求可能包含连接建立时间。节点标识不可用，不推断城市或最近节点。每次请求不使用缓存，每秒最多一个请求，最多 120 次；后台即停止。不保存历史，不显示 IP。</p>').replace('1 Hz / WSS','1 Hz / HTTPS');
writeFileSync(new URL('index.html', out), html);
writeFileSync(new URL('app.js', out), read('stats.mjs').replace('export function','function') + '\n' + read('esa/app.mjs').replace("import {stats} from '../stats.mjs';", ''));
