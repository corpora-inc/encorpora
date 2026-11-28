#!/usr/bin/env python3
"""A simulated unmanned boat for development: ArduPilot Rover software-in-the-loop
with the `motorboat` frame, headless, and the sensor failures its simulation
parameters can inject.

The simulator is a separate process built from the ArduPilot source (GPLv3);
nothing here links it. Run with a Python that has `pymavlink` (a virtual
environment, never the system Python):

    boat.py start                 # start it, wait until it answers (TCP 5760 is the app's link)
    boat.py inject compass        # or: gps, battery [VOLTS], rc (see FAILURES)
    boat.py clear [compass|...]   # restore what was injected (all when no name)
    boat.py status                # heartbeat, active PreArm texts
    boat.py stop

Environment: HARVEST_ARDUPILOT (the source checkout; default
~/.cache/harvest/raw/ardupilot-src), HARVEST_BOAT_DIR (its working folder;
default ~/.cache/harvest/sim-boat).

Serial 0 (TCP 5760) is left for the app. This tool talks on serial 1 (TCP 5762).
"""
from __future__ import annotations

import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

SRC = Path(os.environ.get("HARVEST_ARDUPILOT", Path.home() / ".cache/harvest/raw/ardupilot-src"))
WORK = Path(os.environ.get("HARVEST_BOAT_DIR", Path.home() / ".cache/harvest/sim-boat"))
BIN = SRC / "build/sitl/bin/ardurover"
DEFAULTS = [SRC / "Tools/autotest/default_params/rover.parm", SRC / "Tools/autotest/default_params/motorboat.parm"]
APP_PORT, TOOL_PORT = 5760, 5762
PID = WORK / "boat.pid"
SAVED = WORK / "injected.json"

# Failure -> the parameters that inject it. The first is the simulation's own;
# the others are the firmware's arming settings a fleet would set, without which
# the boat (in Manual, with the default parameters) does not check the failure:
# ARMING_NEED_LOC makes it need a position, BATT_ARM_VOLT sets the arming voltage.
FAILURES = {
    "gps": [("SIM_GPS1_ENABLE", 0.0), ("ARMING_NEED_LOC", 1.0)],
    "battery": [("SIM_BATT_VOLTAGE", 9.0), ("BATT_ARM_VOLT", 11.0)],
    "compass": [("SIM_MAG1_FAIL", 1.0)],
    "rc": [("SIM_RC_FAIL", 1.0)],
}


def port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


def start() -> None:
    if PID.exists() and _alive(int(PID.read_text())):
        print(f"already running (pid {PID.read_text().strip()})")
        return
    if not BIN.exists():
        sys.exit(f"no simulator at {BIN}: build it first (./waf configure --board sitl && ./waf rover)")
    WORK.mkdir(parents=True, exist_ok=True)
    log = open(WORK / "sitl.log", "w")
    cmd = [str(BIN), "--model", "motorboat", "--defaults", ",".join(str(d) for d in DEFAULTS), "-I0"]
    # A small shell stays as the simulator's parent: it exits when its parent
    # does (SITL_State checks), and this script exits right after start. The
    # shell ignores SIGPIPE so a client hanging up mid-write cannot kill it.
    p = subprocess.Popen(["sh", "-c", 'trap "" PIPE; nice -n 10 "$@"', "sh", *cmd], cwd=WORK,
                         stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                         start_new_session=True)
    PID.write_text(str(p.pid))
    for _ in range(100):
        if f"SERIAL0 on TCP port {APP_PORT}" in (WORK / "sitl.log").read_text():
            break
        time.sleep(0.1)
    else:
        sys.exit("the simulator did not open its port; see " + str(WORK / "sitl.log"))
    # The simulator waits for its first connection on serial 0 before it runs.
    # Hold one briefly so it boots; the app connects on the same port later.
    with socket.create_connection(("127.0.0.1", APP_PORT), timeout=5):
        for _ in range(100):
            if f"SERIAL1 on TCP port {TOOL_PORT}" in (WORK / "sitl.log").read_text():
                break
            time.sleep(0.1)
        time.sleep(1)
    print(f"boat running (pid {p.pid}); the app connects to tcp:127.0.0.1:{APP_PORT}")


def stop() -> None:
    if not PID.exists():
        print("not running")
        return
    pid = int(PID.read_text())
    if _alive(pid):
        os.killpg(pid, signal.SIGTERM)
    PID.unlink()
    print("stopped")


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def link():
    from pymavlink import mavutil  # the venv's

    m = mavutil.mavlink_connection(f"tcp:127.0.0.1:{TOOL_PORT}", source_system=254, source_component=191)
    if not m.wait_heartbeat(timeout=20):
        sys.exit("no heartbeat from the boat")
    return m


def get_param(m, name: str) -> float:
    m.mav.param_request_read_send(m.target_system, m.target_component, name.encode(), -1)
    t0 = time.time()
    while time.time() - t0 < 5:
        msg = m.recv_match(type="PARAM_VALUE", blocking=True, timeout=1)
        if msg and msg.param_id == name:
            return float(msg.param_value)
    sys.exit(f"no value for {name}")


def set_param(m, name: str, value: float) -> None:
    m.mav.param_set_send(m.target_system, m.target_component, name.encode(), value, 9)
    t0 = time.time()
    while time.time() - t0 < 5:
        msg = m.recv_match(type="PARAM_VALUE", blocking=True, timeout=1)
        if msg and msg.param_id == name and abs(msg.param_value - value) < 1e-3:
            return
    sys.exit(f"{name} was not set")


def inject(name: str, value: float | None) -> None:
    if name not in FAILURES:
        sys.exit(f"one of {', '.join(FAILURES)}")
    m = link()
    saved = json.loads(SAVED.read_text()) if SAVED.exists() else {}
    for i, (param, v) in enumerate(FAILURES[name]):
        if param not in saved:
            saved[param] = get_param(m, param)
        if i == 0 and value is not None:
            v = value
        set_param(m, param, v)
        SAVED.write_text(json.dumps(saved))
        print(f"{name}: {param} = {v} (was {saved[param]})")
    # Ask for the pre-arm checks now rather than in 30 seconds.
    m.mav.command_long_send(m.target_system, m.target_component, 401, 0, 0, 0, 0, 0, 0, 0, 0)


def clear(name: str | None) -> None:
    saved = json.loads(SAVED.read_text()) if SAVED.exists() else {}
    params = [p for p, _ in FAILURES[name]] if name else list(saved)
    m = link()
    for p in params:
        if p in saved:
            set_param(m, p, saved.pop(p))
            print(f"{p} restored")
    SAVED.write_text(json.dumps(saved))


def status() -> None:
    m = link()
    m.mav.command_long_send(m.target_system, m.target_component, 401, 0, 0, 0, 0, 0, 0, 0, 0)
    t0, texts = time.time(), []
    while time.time() - t0 < 5:
        msg = m.recv_match(type="STATUSTEXT", blocking=True, timeout=1)
        if msg:
            texts.append(msg.text)
    print(json.dumps({"running": True, "texts": texts}, indent=1))


def main(argv: list[str]) -> None:
    if not argv:
        sys.exit(__doc__)
    cmd, rest = argv[0], argv[1:]
    if cmd == "start":
        start()
    elif cmd == "stop":
        stop()
    elif cmd == "inject":
        inject(rest[0], float(rest[1]) if len(rest) > 1 else None)
    elif cmd == "clear":
        clear(rest[0] if rest else None)
    elif cmd == "status":
        status()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
