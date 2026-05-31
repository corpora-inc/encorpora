#!/usr/bin/env python3
"""Pull the on-device Tutomaton LLM breadcrumb (app Documents/corpan-llm.log)."""
import sys
import inspect
import asyncio

BUNDLE = "com.corpora.corpan"
REMOTE = sys.argv[1] if len(sys.argv) > 1 else "corpan-llm.log"


async def _maybe(v):
    return await v if inspect.isawaitable(v) else v


async def amain() -> int:
    from pymobiledevice3.lockdown import create_using_usbmux
    from pymobiledevice3.services.house_arrest import HouseArrestService
    ld = await _maybe(create_using_usbmux())
    ha = HouseArrestService(ld, True)  # (lockdown, documents_only=True)
    try:
        data = await _maybe(ha.get_file_contents(REMOTE))
    except Exception:
        data = await _maybe(ha.get_file_contents(f"Documents/{REMOTE}"))
    sys.stdout.write(data.decode("utf-8", "replace"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(amain()))
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)
