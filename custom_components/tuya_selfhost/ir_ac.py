"""Air conditioner states written straight into a learned infrared code.

An air conditioner remote sends its whole state on every press: power, mode,
temperature and fan. So no key means "+"; each combination is its own code.
When a learned code turns out to be a protocol we can read, any other
combination is the same code with a few bits changed.

TCL112 (TCL, Agratto and other TCL-made units): two 14-byte frames, the second
carrying the state. Byte layout as documented by IRremoteESP8266 (ir_Tcl.h).
"""

from __future__ import annotations

import base64
import binascii
import statistics
import struct
from dataclasses import dataclass

FRAME_BITS = 112
# Header mark, header space, 112 bit pairs, end mark, gap: the second frame starts here.
SECOND_FRAME = 228
CODE_LENGTH = 2 * SECOND_FRAME
HEADER = (0x23, 0xCB, 0x26)
BIT_ONE = 700

MIN_TEMP = 16
MAX_TEMP = 31

MODES = {"heat": 1, "dry": 2, "cool": 3, "fan_only": 7, "auto": 8}
FANS = {"auto": 0, "low": 2, "medium": 3, "high": 5}


@dataclass
class AcState:
    power: bool
    mode: str
    temperature: int
    fan: str


def _timings(code: str) -> list[int] | None:
    try:
        raw = base64.b64decode(code, validate=True)
    except binascii.Error, ValueError:
        return None
    if len(raw) != 2 * CODE_LENGTH:
        return None
    return list(struct.unpack(f"<{CODE_LENGTH}H", raw))


def _state_bytes(timings: list[int]) -> list[int]:
    spaces = [timings[SECOND_FRAME + 3 + 2 * i] for i in range(FRAME_BITS)]
    bits = [1 if space > BIT_ONE else 0 for space in spaces]
    return [sum(bits[b + k] << k for k in range(8)) for b in range(0, FRAME_BITS, 8)]


def recognize(code: str) -> AcState | None:
    """The state a learned code carries, or None when it is not TCL112."""
    timings = _timings(code)
    if timings is None:
        return None
    state = _state_bytes(timings)
    if tuple(state[:3]) != HEADER or sum(state[:13]) & 0xFF != state[13]:
        return None
    mode = next((m for m, v in MODES.items() if v == state[6] & 0x0F), None)
    fan = next((f for f, v in FANS.items() if v == state[8] & 0x07), None)
    if mode is None or fan is None:
        return None
    return AcState(
        power=bool(state[5] & 0x04),
        mode=mode,
        temperature=31 - (state[7] & 0x0F),
        fan=fan,
    )


def encode(template: str, wanted: AcState) -> str:
    """The template code, rewritten to carry `wanted`; untouched bits stay learned."""
    timings = _timings(template)
    if timings is None or recognize(template) is None:
        raise ValueError("Not a TCL112 code")
    state = _state_bytes(timings)
    temperature = min(MAX_TEMP, max(MIN_TEMP, int(wanted.temperature)))
    state[5] = (state[5] & ~0x04 & 0xFF) | (0x04 if wanted.power else 0)
    state[6] = (state[6] & 0xF0) | MODES[wanted.mode]
    state[7] = (state[7] & 0xF0) | (31 - temperature)
    state[8] = (state[8] & 0xF8) | FANS[wanted.fan]
    state[13] = sum(state[:13]) & 0xFF

    spaces = [timings[SECOND_FRAME + 3 + 2 * i] for i in range(FRAME_BITS)]
    one = round(statistics.median(s for s in spaces if s > BIT_ONE))
    zero = round(statistics.median(s for s in spaces if s <= BIT_ONE))
    for i in range(FRAME_BITS):
        bit = (state[i // 8] >> (i % 8)) & 1
        if bit != (spaces[i] > BIT_ONE):
            timings[SECOND_FRAME + 3 + 2 * i] = one if bit else zero
    return base64.b64encode(struct.pack(f"<{CODE_LENGTH}H", *timings)).decode()


def template_of(codes: dict, preferred: list[str]) -> tuple[str, AcState] | None:
    """The best learned code to build on: a powered-on one, the named keys first."""
    found = None
    for name in [*preferred, *codes]:
        value = codes.get(name)
        code = value[0] if isinstance(value, list) and value else value
        if not isinstance(code, str):
            continue
        state = recognize(code)
        if state is None:
            continue
        if state.power:
            return code, state
        found = found or (code, state)
    return found
