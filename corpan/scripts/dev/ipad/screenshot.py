#!/usr/bin/env python3
"""Capture an iPad screenshot via the DVT screenshot service over the already-
running `pymobiledevice3 remote tunneld` (no sudo needed — same RSD path
ipad_cdp.py uses). Usage: screenshot.py /tmp/out.png"""
import asyncio, os, sys
from pymobiledevice3.cli.cli_common import _tunneld
from pymobiledevice3.dtx_service_provider import DtxServiceProvider
from pymobiledevice3.services.dvt.instruments.screenshot import Screenshot

# DVT-over-RSD service name (the base class leaves RSD_SERVICE_NAME unset).
DtxServiceProvider.RSD_SERVICE_NAME = "com.apple.instruments.dtservicehub"


async def main(out: str) -> int:
    rsd = await _tunneld(os.environ.get("CORPAN_IPAD_UDID", ""))
    if rsd is None:
        print("no tunneld RSD; is `sudo pymobiledevice3 remote tunneld` running?", file=sys.stderr)
        return 2
    provider = DtxServiceProvider(lockdown=rsd)
    async with provider:
        screenshot = Screenshot(provider)
        async with screenshot:
            png = await screenshot.get_screenshot()
    with open(out, "wb") as f:
        f.write(png)
    print(out)
    return 0


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/corpan-screen.png"
    sys.exit(asyncio.run(main(out)))
