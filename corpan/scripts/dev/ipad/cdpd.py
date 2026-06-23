#!/usr/bin/env python3
"""
Persistent device daemon — the speed fix for the iPad debug/test loop.

The old path (`cdp.sh` → `ipad_cdp.py` per call) does a FULL WebInspector
reconnect every eval (tunneld + connect + pick page + new session + await
target), which is multi-second and flaky ("cdp failed after N attempts"). This
daemon does that handshake ONCE, holds the session open, and serves evals over a
Unix socket — so each call is a millisecond round-trip. It auto re-acquires the
session when the page reloads (the target id changes), and falls back to a full
reconnect if the inspector connection itself drops.

Run (in the pymobiledevice3 venv, same as screenshot.py), leave it up:
  PMD=$(pipx environment --value PIPX_LOCAL_VENVS)/pymobiledevice3/bin/python
  "$PMD" scripts/dev/ipad/cdpd.py            # prints "cdpd ready ..." then serves
Clients: `cdpc.py` (stdlib-only) or `cdp.sh` (auto-uses the daemon when up).

Prereq: `sudo pymobiledevice3 remote tunneld` running, Web Inspector ON, app
foregrounded (same as the rest of the pipeline).
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ipad_cdp as C  # reuse the connection primitives + helpers

SOCK = os.environ.get("CDPD_SOCK", "/tmp/corpan-cdpd.sock")
EVAL_TIMEOUT = float(os.environ.get("CDPD_EVAL_TIMEOUT", "8"))


class Device:
    """Holds one live WebInspector session; serializes + auto-heals evals."""

    def __init__(self) -> None:
        self.inspector = None
        self.session = None
        self.lock = asyncio.Lock()

    async def connect(self) -> None:
        # WebInspector.connect is flaky on the first try (the per-call path
        # retries past it); the daemon does it once, so retry here too. Use a
        # longer connect timeout than the per-call default.
        C._install_target_capture()
        rsd = await C._tunneld(os.environ.get("CORPAN_IPAD_UDID", ""))
        if rsd is None:
            raise RuntimeError("no tunneld-connected device (sudo pymobiledevice3 remote tunneld?)")
        last: Exception | None = None
        for attempt in range(6):
            try:
                self.inspector = C.WebinspectorService(lockdown=rsd)
                await self.inspector.connect(15.0)
                await self._new_session()
                return
            except Exception as e:  # noqa: BLE001 - retry the flaky handshake
                last = e
                try:
                    await self.inspector.close()
                except Exception:
                    pass
                await asyncio.sleep(2.0)
        raise RuntimeError(f"WebInspector connect failed after retries: {last}")

    async def _new_session(self) -> None:
        page = await C.pick_corpan_page(self.inspector)
        proto = C.SessionProtocol(
            self.inspector, str(uuid.uuid4()).upper(), page.application, page.page, method_prefix=""
        )
        self.session = await C.InspectorSession.create(proto, wait_target=False)
        await C._await_target(self.session)
        try:
            await self.session.runtime_enable()
        except Exception:
            pass

    async def _eval_once(self, expr: str):
        return await asyncio.wait_for(
            self.session.runtime_evaluate(expr, return_by_value=True), EVAL_TIMEOUT
        )

    async def evaluate(self, expr: str):
        async with self.lock:
            try:
                return await self._eval_once(expr)
            except Exception:
                # Page likely reloaded → re-acquire the target and retry once.
                try:
                    await self._new_session()
                    return await self._eval_once(expr)
                except Exception:
                    # Inspector connection itself may be dead → full reconnect.
                    try:
                        await self.inspector.close()
                    except Exception:
                        pass
                    await self.connect()
                    return await self._eval_once(expr)


DEV = Device()


async def _handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        line = await reader.readline()
        req = json.loads(line.decode() or "{}")
        val = await DEV.evaluate(req["expr"])
        payload = json.dumps({"ok": True, "value": val}, ensure_ascii=False)
    except Exception as e:  # noqa: BLE001 - dev daemon, report + stay up
        payload = json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"})
    try:
        writer.write((payload + "\n").encode())
        await writer.drain()
        writer.close()
    except Exception:
        pass


async def main() -> None:
    await DEV.connect()
    if os.path.exists(SOCK):
        os.unlink(SOCK)
    server = await asyncio.start_unix_server(_handle, path=SOCK)
    print(f"cdpd ready on {SOCK}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
