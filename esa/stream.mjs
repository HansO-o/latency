// ESA documents TransformStream; its older API page does not implement the
// ReadableStream constructor. Generate via writer, return readable immediately.
export const STREAM_COUNT = 12;
export const STREAM_INTERVAL_MS = 250;
export const STREAM_LIMIT_MS = 8000;
export function createProbeStream({count = STREAM_COUNT, intervalMs = STREAM_INTERVAL_MS, limitMs = STREAM_LIMIT_MS} = {}) {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const started = Date.now();
  let stopped = false, delayTimer, wakeDelay;
  const stop = () => {
    if (stopped) return;
    stopped = true; clearTimeout(delayTimer); wakeDelay?.();
  };
  const hardDeadline = setTimeout(() => {
    stop(); writer.abort(new Error('Stream duration limit')).catch(() => {});
  }, limitMs);
  // Both success and rejection handlers avoid unhandled cancellation promises.
  writer.closed.then(stop, stop);
  const finished = (async () => {
    try {
      for (let seq = 0; seq < count && !stopped; seq++) {
        if (seq) await new Promise(resolve => {
          wakeDelay = resolve;
          delayTimer = setTimeout(resolve, intervalMs);
        });
        wakeDelay = undefined;
        if (stopped) break;
        const record = {type:'chunk', seq, serverElapsedMs:Date.now()-started, targetIntervalMs:intervalMs, totalChunks:count};
        await writer.write(encoder.encode(JSON.stringify(record) + '\n'));
      }
      if (!stopped) await writer.close();
    } catch {
      // Reader cancellation rejects writes. There is no retry or origin fetch.
    } finally {
      stop(); clearTimeout(hardDeadline); writer.releaseLock();
    }
  })();
  return {readable:stream.readable, finished};
}
export function streamResponse() {
  const {readable} = createProbeStream();
  return new Response(readable, {headers:{
    'content-type':'application/x-ndjson; charset=utf-8',
    'cache-control':'no-store, no-cache, max-age=0, no-transform',
    'x-content-type-options':'nosniff',
    // A hint, not a guarantee that an intermediary/runtime flushes every write.
    'x-accel-buffering':'no'
  }});
}
