# Cloudflare WebSocket latency probe

Live: https://latency.earth.icu/

A dependency-free Worker serves the Chinese mobile-friendly UI and terminates a same-origin WebSocket at `/ws`. The client measures application-level round-trip latency using a monotonic browser clock and sequence IDs. No arbitrary host, forwarding, throughput test, database, Durable Object, or client-IP display is included.

## Run / deploy

Node 20+ is sufficient to build and run logic tests:

    npm run build
    npm test

Install Cloudflare Wrangler from its official npm package if needed, authenticate with your own Cloudflare account, then:

    npx wrangler dev
    npx wrangler deploy

The already built `dist/worker.mjs` can also be uploaded as a single ES module using the Cloudflare API/dashboard. No secrets or bindings are required. The live deployment has custom domain `latency.earth.icu`; the generic Wrangler config does not change DNS or existing routes. Domain provisioning must be done explicitly in your account. Existing other projects are independent.

## Measurement definitions

- RTT: time from sending an application ping to receiving its matching pong, in milliseconds. Includes network, Worker processing and browser scheduling; not one-way delay.
- Median: middle sorted sample, averaging the middle pair for even counts.
- P95: nearest-rank 95th percentile over successful samples in the current session.
- Jitter: mean absolute difference between successive successful RTT samples. Timeouts are excluded; sample order is preserved.
- Handshake: browser time from WebSocket construction to the open event, including any connection preparation. It is not a separately isolated TLS measurement.
- Colo: `request.cf.colo` from the actual upgrade request. This identifies the data center the request hit. It does not prove geographically nearest routing, an endpoint IP, or Durable Object placement.
- Browser APIs do not expose the actual remote socket IP here. The page displays its endpoint hostname and colo rather than claiming a DNS-resolved anycast IP is the actual remote socket.

## Limits and privacy

The client starts automatically and sends no faster than one probe per second, one outstanding ping at a time. Responses schedule the next probe after one second; timeout is 3 seconds. A session has at most 120 sends and stops when hidden; it does not auto-reconnect. Server bounds messages to 128 characters, a 4-token burst with 1/second refill, monotonically increasing sequence IDs, and 150 received messages / 180-second active-message window. This is per connection, not a global DDoS or billing hard cap. Idle sockets rely on the client/platform lifecycle.

No application logging, persistent history, analytics, third-party scripts, or storage is used. Cloudflare still processes connection metadata under its platform policies. Public endpoints remain subject to account plan limits and normal billing. No new paid subscription was created.

## Verification (2026-10-05 UTC)

- Build and syntax check pass.
- Six Node tests pass: statistics, input validation, routing/origin boundary, client stop/restart/stale events/background stop, timeout, and 120-probe termination.
- HTTPS live page returns 200.
- Independent live WSS client received colo ORD and five valid matching replies (RTT 10.31, 30.43, 9.98, 6.13, 11.07 ms from the verification environment only).
- Cloud browser displayed the real live graph/metrics and ORD colo. The local Playwright mock UI harness is included but could not launch in the shell's socket-restricted runtime; live cloud-browser QA was used instead. Mobile layout uses a responsive two-column metric grid; mobile viewport screenshot was not independently captured.

Official API references:
- https://developers.cloudflare.com/workers/runtime-apis/websockets/
- https://developers.cloudflare.com/workers/runtime-apis/request/
