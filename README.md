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

## ESA Stream API measurement (optional `/stream/`)

Use the “Stream API 流式测试” link on the ESA HTTP page, or visit `/stream/`. Click Start to make one same-origin `GET /api/stream` request. The function creates a real `TransformStream`, returns `readable` immediately in its Response, and asynchronously writes 12 newline-delimited JSON records roughly 250 ms apart (about 2.75 seconds). It never calls an origin or Cloudflare. The producer stops on reader cancellation/write rejection and has an 8-second deadline; the browser has its own timeout and cancellation. HTTP echo remains available separately; Cloudflare WebSocket source/configuration is unchanged.

This is a small response-stream timing experiment, **not WebSocket, bidirectional ping/pong RTT, one-way network delay, or a bandwidth/speed test**:

- First-record latency includes request/connection preparation, edge processing, delivery, parsing and browser scheduling; it is not isolated TCP/TLS time or exact first-byte time.
- Record interval median/P95 describes arrival spacing at this browser.
- Interval deviation compares successive browser arrival spacing with the server's successive elapsed-time spacing; the two clocks' absolute values are never subtracted. This still includes buffering and scheduling, so is not pure network jitter.
- Completion time covers fetching and consuming the entire response.
- Multiple records in one reader read, or unexpectedly tight arrival spacing despite separated server writes, produces a “suspected batching” warning. A read is not guaranteed to correspond to a server write, HTTP chunk, or TCP packet.

The endpoint sends `Cache-Control: no-store, no-cache, max-age=0, no-transform` and `X-Accel-Buffering: no`; these are hints, not a guarantee of streaming flushes across ESA/proxies/compression. The browser uses `cache: no-store` and a nonce. A runtime or network path may still buffer data: the UI reports that rather than converting it into a fictitious RTT. No Content-Length, Transfer-Encoding, Connection, or Upgrade header is set by the function.

### Runtime and verification notes

The official ESA Stream API page describes TransformStream and warns about async buffering/deadlocks; it also says the ReadableStream constructor is not implemented, so this endpoint deliberately does not instantiate ReadableStream. Writes are not awaited before returning the Response. Current Functions and Pages documentation lists a 120-second response limit and a 10-second no-data wait; this experiment starts immediately and is bounded well below those limits. Timers and buffering remain subject to the actual ESA runtime.

    node esa/build.mjs
    node --test esa/test.mjs esa/stream-test.mjs esa/stream-client-test.mjs
    npm run build
    npm test

Local tests include real timed TransformStream reads, early first record, paced records, cancellation, blocked-reader deadline, endpoint boundaries and browser parsing/lifecycle behavior. Node tests do not prove ESA production flush timing. The user deploys manually; verify the deployed `/stream/` count, read groups and batching warning before interpreting measurements. This commit does not implement screen sharing or cross-device rooms.

References:
- https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/stream-api
- https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/what-is-functions-and-pages/

### WebSocket network-plan distinction

ESA's documented network WebSocket feature connects clients through ESA to a WebSocket origin. That does not establish a WebSocket server API inside Functions and Pages. Its January 2026 announcement says new free plans cannot enable WebSocket after January 13; previously enabled free plans retain it, but disabling it prevents re-enabling it. Basic and higher plans support the network feature. Do not toggle a grandfathered free-plan switch merely as a diagnostic. This project has made no plan or switch changes. Edge Containers are a separate product; the current official support table lists Enterprise only, so they are not a drop-in free replacement.

- https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/network-optimization
- https://www.alibabacloud.com/zh/notice/entrance_plan_announcement_on_websocket_feature_adjustments_for_edge_security_acceleration_esa_66c
- https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/overview-of-edge-containers/
