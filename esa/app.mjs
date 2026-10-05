import {stats} from '../stats.mjs';
const $ = id => document.getElementById(id);
let generation = 0, active = false, timer, controller, seq = 0, values = [], timeouts = 0;
$('endpoint').textContent = location.origin + '/api/ping';
$('colo').textContent = 'Alibaba ESA · 节点标识不可用';
$('handshake').textContent = 'HTTP 模式 · 不单独测量握手';
function render() {
  const s = stats(values);
  for (const id of ['current','median','p95','jitter']) $(id).textContent = s ? s[id].toFixed(1) : '—';
  $('count').textContent = values.length + ' / ' + timeouts;
  const max = Math.max(...values, 1);
  $('line').setAttribute('points', values.map((v,i) => (i / 119 * 800).toFixed(1) + ',' + (96 - v / max * 90).toFixed(1)).join(' '));
  $('range').textContent = s ? s.min.toFixed(1) + ' – ' + s.max.toFixed(1) + ' ms' : '等待样本';
}
function stop(reason) {
  active = false; generation++; clearTimeout(timer); controller?.abort(); controller = null;
  $('start').disabled = false; $('stop').disabled = true; $('status').textContent = reason;
}
async function ping(token) {
  if (!active || token !== generation) return;
  const id = seq++, abort = new AbortController(); controller = abort;
  const deadline = setTimeout(() => abort.abort(), 3000), before = performance.now();
  try {
    const response = await fetch('/api/ping?seq=' + id + '&nonce=' + encodeURIComponent(Date.now() + '-' + Math.random()), {cache:'no-store', credentials:'omit', signal:abort.signal});
    const msg = await response.json();
    if (!active || token !== generation) return;
    if (!response.ok || msg.type !== 'pong' || msg.seq !== id || msg.transport !== 'http') throw new Error('Invalid echo');
    values.push(performance.now() - before);
  } catch (error) {
    if (!active || token !== generation) return;
    if (error.name === 'AbortError') timeouts++;
    else { stop('HTTP 测试失败 · 请检查部署后重试'); return; }
  } finally { clearTimeout(deadline); if (controller === abort) controller = null; }
  render();
  if (seq >= 120) { stop('测试完成 · 120 次'); return; }
  timer = setTimeout(() => ping(token), 1000);
}
function start() {
  if (document.hidden) return;
  stop('正在测量 HTTP 往返延迟'); seq = 0; values = []; timeouts = 0; render();
  active = true; $('start').disabled = true; $('stop').disabled = false; ping(generation);
}
$('start').onclick = start; $('stop').onclick = () => stop('已停止');
document.addEventListener('visibilitychange', () => { if (document.hidden && active) stop('页面进入后台 · 已停止'); });
window.addEventListener('pagehide', () => stop('已停止'));
$('status').textContent = 'ESA WebSocket 尚未适配 · 可手动选择 HTTP 测试';
$('start').textContent = '开始 HTTP 测试';
$('stop').disabled = true;
