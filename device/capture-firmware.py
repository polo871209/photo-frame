#!/usr/bin/env python3
"""Back up the HY-S101 firmware (logical NAND sectors 0 to the start of userdata) and verify it. Read-only.

Usage, from the repo root with the frame on USB ADB:
  mise exec -- python3 -I device/capture-firmware.py

Writes backups/hy-s101/nand-firmware-0-6669312.img.gz and firmware-validation.json. Each partition
is read as its owner (`su <uid> dd`), because this `su` cannot read files owned by other users.
"""

import gzip
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "backups" / "hy-s101"
IMAGE = OUT / "nand-firmware-0-6669312.img.gz"
REPORT = OUT / "firmware-validation.json"
CHUNK = 64 * 1024 * 1024
BS = 65536
USERDATA_START = 6669312


def adb(*args, binary=False):
    return (
        subprocess.run(["adb", *args], check=True, capture_output=True).stdout
        if binary
        else subprocess.run(
            ["adb", *args], check=True, capture_output=True, text=True
        ).stdout.replace("\r", "")
    )


def regions():
    table = []
    for n in range(1, 16):
        start, size = (
            int(adb("shell", f"cat /sys/block/rknand0/rknand0p{n}/{f}"))
            for f in ("start", "size")
        )
        table.append((f"rknand0p{n}", start, size))
    return check([("rknand0", 0, table[0][1])] + table)


def owner(name):
    return int(adb("shell", f"stat -c %u /dev/block/{name}"))


def check(found):
    end = 0
    for name, start, size in found:
        if start != end or (size * 512) % BS:
            sys.exit(
                f"STOP: {name} start={start} size={size} breaks contiguity or 64 KiB alignment"
            )
        end = start + size
    if end != USERDATA_START:
        sys.exit(f"STOP: firmware region ends at {end}, expected {USERDATA_START}")
    return found


def identity():
    model = adb("shell", "getprop ro.product.model").strip()
    build = adb("shell", "getprop ro.build.display.id").strip()
    if (model, build) != ("HY-S101", "HY-S101_Frameo_20260826"):
        sys.exit(f"STOP: this is {model} {build}, not the HY-S101 this script was written for")


def main():
    identity()
    OUT.mkdir(parents=True, exist_ok=True)
    found = regions()
    stream = hashlib.sha256()
    result = {"regions": [], "cc_blocks": 0}
    filler = bytes([0xCC]) * 4096
    started = time.monotonic()
    total = sum(size * 512 for _, _, size in found)
    done = 0
    with gzip.open(IMAGE.with_suffix(".gz.partial"), "wb", compresslevel=6) as out:
        for name, start, size in found:
            region_hash = hashlib.sha256()
            uid = owner(name)
            length = size * 512
            offset = 0
            while offset < length:
                want = min(CHUNK, length - offset)
                data = adb(
                    "exec-out",
                    f"su {uid} dd if=/dev/block/{name} bs={BS} skip={offset // BS} count={want // BS} 2>/dev/null",
                    binary=True,
                )
                if len(data) != want:
                    sys.exit(
                        f"STOP: {name} offset {offset}: got {len(data)} bytes, expected {want}"
                    )
                result["cc_blocks"] += sum(
                    data[i : i + 4096] == filler for i in range(0, want, 4096)
                )
                stream.update(data)
                region_hash.update(data)
                out.write(data)
                offset += want
                done += want
                rate = done / (time.monotonic() - started) / 2**20
                print(
                    f"{name} {offset}/{length}  total {done * 100 // total}%  {rate:.1f} MiB/s",
                    flush=True,
                )
            result["regions"].append(
                {
                    "name": name,
                    "start": start,
                    "sectors": size,
                    "sha256": region_hash.hexdigest(),
                }
            )
    IMAGE.with_suffix(".gz.partial").rename(IMAGE)
    result["bytes"] = total
    result["stream_sha256"] = stream.hexdigest()

    readback = hashlib.sha256()
    with gzip.open(IMAGE, "rb") as f:
        while block := f.read(CHUNK):
            readback.update(block)
    result["gzip_readback_sha256"] = readback.hexdigest()

    mismatches = []
    for region in result["regions"]:
        name = region["name"]
        if name == "rknand0":
            cmd = f"su 0 sh -c 'dd if=/dev/block/rknand0 bs={BS} count={region['sectors'] * 512 // BS} 2>/dev/null | sha256sum'"
        else:
            cmd = f"su {owner(name)} sha256sum /dev/block/{name}"
        region["device_sha256"] = adb("shell", cmd).split()[0]
        if region["device_sha256"] != region["sha256"]:
            mismatches.append(name)
    result["mismatches"] = mismatches
    result["ok"] = (
        not mismatches
        and result["cc_blocks"] == 0
        and result["stream_sha256"] == result["gzip_readback_sha256"]
    )
    REPORT.write_text(json.dumps(result, indent=2))
    print(
        json.dumps({k: result[k] for k in ("bytes", "cc_blocks", "mismatches", "ok")}),
        flush=True,
    )
    sys.exit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
