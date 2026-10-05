// ESA edge HTTP echo. This is deliberately not a WebSocket implementation.
export default {
  async fetch(request) {
    const headers = {'cache-control': 'no-store, max-age=0', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff'};
    const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
    const url = new URL(request.url);
    if (url.pathname !== '/api/ping') return reply({error: 'Not found'}, 404);
    if (request.method !== 'GET') return reply({error: 'Method not allowed'}, 405);
    const seq = url.searchParams.get('seq');
    if (!/^(0|[1-9][0-9]{0,2})$/.test(seq || '') || Number(seq) >= 120) return reply({error: 'Invalid sequence'}, 400);
    return reply({type: 'pong', seq: Number(seq), provider: 'Alibaba ESA', transport: 'http', colo: null});
  }
};
