import httpx
import asyncio
import time

async def main():
    try:
        t0 = time.time()
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get('https://orca-backend-anp5.onrender.com/health')
            print(f"Success in {time.time()-t0:.2f}s: {resp.status_code}")
    except Exception as e:
        print(f"Error in {time.time()-t0:.2f}s: {type(e).__name__} - {str(e)}")

asyncio.run(main())
