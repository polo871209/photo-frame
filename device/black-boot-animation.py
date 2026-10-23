#!/usr/bin/env python3
"""Build a black boot animation for the HY-S101 `system` partition. Offline: it never touches the frame.

Usage: python3 -I device/black-boot-animation.py <stock system.img> <output dir>

Finds /system/media/bootanimation.zip as one contiguous run of 4 KiB blocks, refuses anything but the
known stock bytes, and writes a black zip of the same size into the same blocks:
  bootanimation-black.seg   the blocks to write (the zip, then the stock slack of the last block)
  bootanimation-stock.seg   the stock blocks, for the undo
  write-plan.txt            block numbers and hashes for the device write
"""

import hashlib
import io
import struct
import sys
import zipfile
import zlib
from pathlib import Path

STOCK_ZIP_SHA256 = "4a23760fc54f1e4f2219ed0f0577fea6f55ee4468a079fdfddd54927122a7298"
BLACK_ZIP_SHA256 = "d58c535c3fac8ca78b9eab606dd7c14e831f16410726fb528ef9741a747f2451"
ZIP_BYTES = 369653
FIRST_BLOCK = 297532
SYSTEM_START_SECTOR = 1654784
BLOCK = 4096


def black_png(width: int, height: int) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data))
        )

    rows = b"".join(b"\0" + bytes(width * 3) for _ in range(height))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


def black_zip(padding: int) -> bytes:
    entries = (
        ("desc.txt", b"1280 800 1\np 0 0 part0 #000000\n"),
        ("part0/000.png", black_png(1280, 800)),
        ("pad", bytes(padding)),
    )
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as archive:
        for name, data in entries:
            archive.writestr(zipfile.ZipInfo(name, (2026, 10, 23, 0, 0, 0)), data)
    return out.getvalue()


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    out = Path(sys.argv[2])
    blocks = (ZIP_BYTES + BLOCK - 1) // BLOCK
    with open(sys.argv[1], "rb") as system:
        system.seek(FIRST_BLOCK * BLOCK)
        stock_segment = system.read(blocks * BLOCK)
    if hashlib.sha256(stock_segment[:ZIP_BYTES]).hexdigest() != STOCK_ZIP_SHA256:
        sys.exit(
            "STOP: the blocks do not hold the stock HY-S101_Frameo_20260826 bootanimation.zip"
        )

    new_zip = black_zip(ZIP_BYTES - len(black_zip(0)))
    if hashlib.sha256(new_zip).hexdigest() != BLACK_ZIP_SHA256:
        sys.exit("STOP: black zip does not match the zip verified on the frame")
    segment = new_zip + stock_segment[ZIP_BYTES:]

    out.mkdir(parents=True, exist_ok=True)
    (out / "bootanimation-black.seg").write_bytes(segment)
    (out / "bootanimation-stock.seg").write_bytes(stock_segment)
    plan = (
        f"rknand0p11 block {FIRST_BLOCK}, rknand0 block {SYSTEM_START_SECTOR // 8 + FIRST_BLOCK}, count {blocks} (4 KiB blocks)\n"
        f"black segment sha256  {hashlib.sha256(segment).hexdigest()}\n"
        f"stock segment sha256  {hashlib.sha256(stock_segment).hexdigest()}\n"
        f"black zip sha256      {BLACK_ZIP_SHA256}\n"
        f"stock zip sha256      {STOCK_ZIP_SHA256}\n"
    )
    (out / "write-plan.txt").write_text(plan)
    print(plan, end="")


if __name__ == "__main__":
    main()
