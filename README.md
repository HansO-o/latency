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

## Alibaba ESA: separate build and explicit capability boundary

The Cloudflare files and deployment remain unchanged. This repository now also contains `esa.jsonc`, `esa/function.mjs`, `esa/build.mjs`, and an ESA-specific generated asset directory `esa-dist`. This is **ESA Functions and Pages**, not Alibaba Function Compute (FC).

**This is not an ESA WebSocket implementation.** The current official ESA runtime reference does not document a WebSocket termination API equivalent to Cloudflare's `WebSocketPair`; the Fetch API documentation lists `Upgrade` and `Connection` among headers that cannot be read. ESA's documented WebSocket origin forwarding is a different feature. Therefore copying the Cloudflare handler or merely changing its entry path is not a verified solution. Without the original ESA build log, the exact build error has not been reproduced.

The ESA landing page says WebSocket termination is not implemented. It does not start measurements automatically. The user can explicitly click “开始 HTTP 测试” to run the optional, clearly labeled HTTP echo experiment. It uses the same statistics and visual layout, but HTTP RTT is not directly comparable with WebSocket RTT. There is no forwarding to Cloudflare or any other origin. `/ws` intentionally returns 404 on ESA.

### ESA Git build settings

- Root: repository root (`/`)
- Project: `latency` in `esa.jsonc`; change this name to your existing ESA project name before using the CLI if it differs
- Install command: `node --version` (no dependencies)
- Build command: `node esa/build.mjs`
- Function entry: `./esa/function.mjs`
- Static assets: `./esa-dist` (never `./dist`, which contains the Cloudflare bundle)
- Node build version: 20 or newer
- No SPA fallback: `/api/ping` must reach the function

ESA's `esa.jsonc` settings override corresponding console build settings. The ESA entry is an ES-module default object with `fetch(request)` and uses only Request, URL, and Response APIs. No Cloudflare bindings, `request.cf`, Node server listener, or FC handler is used. The optional HTTP echo always returns `Cache-Control: no-store`; the browser also disables cache and uses a fresh nonce. No actual edge node identifier is available to this implementation: it reports `colo: null` and “节点标识不可用”, never a guessed city/IP. The browser bounds a run to 120 sequential requests, at most one outstanding request, 3-second timeout, one-second pause between requests, and stops on background/Stop. This client limit is not a server-wide cost or abuse cap.

### Local verification

    node esa/build.mjs
    node --test esa/test.mjs
    npm run build
    npm test

On 2026-10-05, ESA build/syntax checks and five adapter/client tests passed; the six original Cloudflare tests also passed. Tests cover HTTP route/method/sequence/no-cache behavior without Cloudflare APIs, start/stop/restart/stale replies/background stop, and 120-sample termination. They do not emulate Alibaba's production runtime. ESA cloud build and live HTTP/WSS have **not** been verified: the ESA console requires login. A Git push is not proof of an ESA deployment, even when Git-triggered builds are configured. No CF deployment, DNS, route, or paid plan was changed.

Official references checked:
- https://www.alibabacloud.com/help/en/edge-security-acceleration/esa/user-guide/build-pages
- https://github.com/aliyun/alibabacloud-esa-cli/blob/master/docs/Config_en.md
- https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/runtimeapi-manual
- https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/fetch-1
- https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/network-optimization-rules
