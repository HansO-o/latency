import asyncio,json,time,websockets
async def main():
 async with websockets.connect('wss://latency.earth.icu/ws',origin='https://latency.earth.icu',open_timeout=20) as ws:
  hello=json.loads(await asyncio.wait_for(ws.recv(),10));print('HELLO',hello)
  samples=[]
  for seq in range(5):
   started=time.perf_counter();await ws.send(json.dumps({'type':'ping','seq':seq}));p=json.loads(await asyncio.wait_for(ws.recv(),3));assert p=={'type':'pong','seq':seq};samples.append(round((time.perf_counter()-started)*1000,2));await asyncio.sleep(1)
  print('RTT ms from test environment',samples)
asyncio.run(main())
