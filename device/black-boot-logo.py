#!/usr/bin/env python3
"""Build a black boot logo for the HY-S101 `resource` partition. Offline: it never touches the frame.

Usage: python3 -I device/black-boot-logo.py <stock resource.img> <output dir>

Reads the stock 16 MiB partition image, refuses anything but the known stock hash, blackens
`logo.bmp` and `logo_kernel.bmp` in place, and writes:
  resource-black.img   the whole patched partition (for comparing readbacks)
  resource-black.seg   only the sectors that hold the two logos (the bytes to write)
  write-plan.txt       seek, count and hashes for the device write
"""

import hashlib
import struct
import sys
from pathlib import Path

STOCK_SHA256 = "9e1f2ebf2b193d999b7ce3a3d88a1e8c1aa2c4c0239c07f72a4b3a8f7de9ead7"
PATCHED_SHA256 = "8c6fe52c46baad89377e0ec45a567eee697a12d72f6640ef9674e62c53093725"
PARTITION_BYTES = 16 * 2**20
SECTOR = 512
LOGOS = ("logo.bmp", "logo_kernel.bmp")


def entries(image: bytes) -> dict[str, tuple[int, int]]:
    if image[:4] != b"RSCE":
        sys.exit("STOP: not a Rockchip RSCE resource image")
    table_sector, entry_sectors = image[9], image[10]
    (count,) = struct.unpack_from("<I", image, 12)
    found = {}
    for index in range(count):
        at = (table_sector + index * entry_sectors) * SECTOR
        if image[at : at + 4] != b"ENTR":
            sys.exit(f"STOP: entry {index} has no ENTR tag")
        name = image[at + 4 : at + 260].split(b"\0")[0].decode()
        found[name] = struct.unpack_from("<II", image, at + 260)
    return found


def blacken(bmp: bytes) -> bytes:
    if bmp[:2] != b"BM":
        sys.exit("STOP: logo is not a BMP")
    (pixels_at,) = struct.unpack_from("<I", bmp, 10)
    (bits,) = struct.unpack_from("<H", bmp, 28)
    if bits != 8 or bmp[54:57] != b"\0\0\0":
        sys.exit("STOP: expected an 8-bit BMP whose palette entry 0 is black")
    return bmp[:pixels_at] + bytes(len(bmp) - pixels_at)


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    stock = Path(sys.argv[1]).read_bytes()
    out = Path(sys.argv[2])
    if (
        len(stock) != PARTITION_BYTES
        or hashlib.sha256(stock).hexdigest() != STOCK_SHA256
    ):
        sys.exit(
            "STOP: input is not the stock HY-S101_Frameo_20260826 resource partition"
        )

    patched = bytearray(stock)
    table = entries(stock)
    spans = []
    for name in LOGOS:
        sector, size = table[name]
        start = sector * SECTOR
        patched[start : start + size] = blacken(stock[start : start + size])
        spans.append((sector, (size + SECTOR - 1) // SECTOR))

    first = min(sector for sector, _ in spans)
    end = max(sector + count for sector, count in spans)
    if hashlib.sha256(patched).hexdigest() != PATCHED_SHA256:
        sys.exit("STOP: patched image does not match the image verified on the frame")
    segment = bytes(patched[first * SECTOR : end * SECTOR])
    if (
        stock[: first * SECTOR] != patched[: first * SECTOR]
        or stock[end * SECTOR :] != patched[end * SECTOR :]
    ):
        sys.exit("STOP: bytes outside the logo sectors changed")

    out.mkdir(parents=True, exist_ok=True)
    (out / "resource-black.img").write_bytes(patched)
    (out / "resource-black.seg").write_bytes(segment)
    stock_segment = stock[first * SECTOR : end * SECTOR]
    plan = (
        f"seek={first} count={end - first} (512-byte sectors)\n"
        f"segment sha256        {hashlib.sha256(segment).hexdigest()}\n"
        f"stock segment sha256  {hashlib.sha256(stock_segment).hexdigest()}\n"
        f"stock partition       {STOCK_SHA256}\n"
        f"patched partition     {PATCHED_SHA256}\n"
    )
    (out / "write-plan.txt").write_text(plan)
    print(plan, end="")


if __name__ == "__main__":
    main()
