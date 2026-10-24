# HY-S101 frame: how it was opened up

This is the reference for the one frame this dashboard runs on. It records what the frame is, every change made to it on 2026-10-22 and 2026-10-23, the commands that did each change, and how to undo each one. The public, shorter version is [`docs/hy-s101-rk3326.md`](https://github.com/polo871209/photo-frame-dashboard/blob/hy-s101-record/docs/hy-s101-rk3326.md) in [wesbos/photo-frame-dashboard PR #235](https://github.com/wesbos/photo-frame-dashboard/pull/235).

The frame now runs plain Android 8.1 with no vendor apps and no Frameo. Its Home app is the Home HQ kiosk, which shows the dashboard, and it shows black screens while it boots. WebView is still the stock 106.

## Rules for any work on the frame

These come from the upstream repo's [rules we learned the hard way](https://github.com/wesbos/photo-frame-dashboard#rules-we-learned-the-hard-way). They apply to every change below.

1. Make sure that a verified firmware backup exists before any write to flash or `/system`.
2. Record the undo before you make the change.
3. Before a write, make sure that the target has the expected hash. After the write, read it back and compare. If a hash is wrong, stop.
4. Before you remove the app or path you came in through, make sure by hand on the panel that you can still reach Android Settings → Apps and that USB debugging is on.
5. Keep backups, dumps and serial numbers out of git. `backups/` is ignored for that.

## The frame

| Field                      | Value                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Model, brand, manufacturer | `HY-S101` / `zyf` / `rockchip`                                                                             |
| Firmware                   | `HY-S101_Frameo_20260826`                                                                                  |
| Fingerprint                | `rockchip/rk3326_go/rk3326_go:8.1.0/OC/032555:user/release-keys`                                           |
| SoC                        | Rockchip RK3326, 32-bit userspace (`armeabi-v7a`)                                                          |
| Android                    | 8.1.0 (API 27), Android Go, security patch 2020-06-05, kernel 4.4.138                                      |
| Build flags                | `ro.debuggable=0`, `ro.adb.secure=1`, SELinux permissive, verified boot `orange`, `ro.boot.flash.locked=0` |
| RAM                        | 976,868 kB, with a 360 MB `zram0` swap                                                                     |
| Screen                     | 1280×800 at 160 dpi, touch                                                                                 |
| Storage                    | Logical NAND `/dev/block/rknand0`, 60,555,264 sectors of 512 bytes                                         |
| WebView                    | `com.android.webview` 106.0.5249.126 in `/system/app/webview`                                              |
| Time zone                  | `Asia/Kuala_Lumpur`, automatic time zone off                                                               |

The board and partition map are the same as the Akimart ZN-DP1002 in the upstream repo, but the firmware is different.

### Partition map

From `/sys/block/rknand0/rknand0p<N>/start`, `size` and `uevent`, in 512-byte sectors.

| Node | Name     | Start   | Sectors  | Notes                                                                             |
| ---- | -------- | ------- | -------- | --------------------------------------------------------------------------------- |
| p1   | uboot    | 16384   | 8192     |                                                                                   |
| p2   | trust    | 24576   | 8192     |                                                                                   |
| p3   | misc     | 32768   | 8192     |                                                                                   |
| p4   | resource | 40960   | 32768    | Boot logos and device tree. Changed, see [the boot logo](#5-black-boot-logo)      |
| p5   | kernel   | 73728   | 65536    |                                                                                   |
| p6   | boot     | 139264  | 65536    |                                                                                   |
| p7   | recovery | 204800  | 262144   |                                                                                   |
| p8   | backup   | 466944  | 393216   |                                                                                   |
| p9   | security | 860160  | 8192     |                                                                                   |
| p10  | cache    | 868352  | 786432   |                                                                                   |
| p11  | system   | 1654784 | 3932160  | ext4, mounted read-only. Changed, see [the boot animation](#5-black-boot-screens) |
| p12  | metadata | 5586944 | 32768    |                                                                                   |
| p13  | vendor   | 5619712 | 786432   | ext4, read-only                                                                   |
| p14  | oem      | 6406144 | 262144   | ext4, read-only                                                                   |
| p15  | frp      | 6668288 | 1024     | Owned by `system` (uid 1000)                                                      |
| p16  | userdata | 6669312 | 53885888 | `/data`                                                                           |

## Tools

`mise.toml` pins `adb` 37.0.1 from Google's platform-tools, with its SHA-256. Run every command through mise, for example `mise exec -- adb devices`. `ffmpeg` is needed only to make the boot video.

## Getting in

### USB needs a USB-A cable

The frame has one USB-C port. A USB-C to USB-C cable from the Mac gives power but no data. A USB-C to USB-A adapter on the Mac plus a USB-A to USB-C cable works. With ADB on, the frame shows as USB `2207:0006`.

### ADB comes from Frameo's switch

Frameo had an official switch, so no exploit was needed.

1. On the frame, open Frameo **Settings → About → Beta Program**, then turn on **ADB Access**.
2. Connect the cable and run `mise exec -- adb devices`.
3. Accept "Allow USB debugging" on the frame and tick "Always allow". The Mac's key is now in `/data/misc/adb/adb_keys`, so ADB keeps working with Frameo gone.

`adb devices` prints the frame's serial number. Keep that output out of notes and commits.

### Root is `su <uid>`, with two capabilities

`/system/xbin/su` ships with the firmware (`-rwsr-sr-x root shell`) and asks nothing.

```sh
mise exec -- adb shell su 0 id                     # uid=0(root) ... context=u:r:shell:s0
mise exec -- adb shell "su 0 cat /proc/self/status" | grep CapEff   # 00000000000000c0
```

The root shell has only `CAP_SETUID` and `CAP_SETGID`. That decides what works:

- `su 0 <cmd>` works. `su -c <cmd>` fails with `su: invalid uid/gid '-c'`.
- Root cannot open files owned by another user. Become that user instead: `su 1000` for `system` files (for example `/data/system`) and the `frp` partition, and `su 1023` for `media_rw` files.
- `/system`, `/vendor` and `/oem` cannot be remounted read-write, so files in them cannot change. Partitions owned by root can be read and written as raw blocks with `su 0 dd`.
- zram cannot be resized. It needs `CAP_SYS_ADMIN`.
- This firmware's `dd` rejects every `conv=` option (`dd: conv option disabled`). The shell has no `awk`. `sha256sum`, `gzip` and `toybox` are present.
- `adb exec-out "su 0 dd ..."` sends binary data to the Mac unchanged. `adb shell` does not, because it can change line endings.

## 1. Firmware backup

`device/capture-firmware.py` reads logical NAND sectors 0 to 6,669,311, which is everything before userdata. It does not write to the frame.

```sh
mise exec -- python3 -I device/capture-firmware.py
```

- It stops if the model or firmware string differs, or if the partitions are not contiguous.
- It reads the first 8 MiB of `rknand0`, then p1 to p15, in 64 MiB chunks, each as the partition's owner (`su 0` or `su 1000`).
- It writes `backups/hy-s101/nand-firmware-0-6669312.img.gz` and `firmware-validation.json`.
- It checks every chunk length, the gzip readback, `0xCC` filler blocks, and the on-device SHA-256 of all 16 regions. `"ok": true` in the JSON means all checks passed.

The backup taken on 2026-10-22 is 3,414,687,744 bytes before compression, and every check passed. It is in `backups/hy-s101/` of the local `photo-frame-dashboard` checkout, and nowhere else. Restore is untested. There is no userdata backup.

To get one partition out of the backup, skip to its start sector. For example, `resource`:

```sh
gzip -dc backups/hy-s101/nand-firmware-0-6669312.img.gz | dd bs=512 skip=40960 count=32768 of=resource.img
shasum -a 256 resource.img   # 9e1f2ebf2b193d999b7ce3a3d88a1e8c1aa2c4c0239c07f72a4b3a8f7de9ead7 for the stock firmware
```

## 2. Launcher as Home

Frameo was the Home app, so another launcher had to take over before Frameo could go.

```sh
# Rootless Pixel Launcher 3.9.1 from F-Droid
curl -LO https://f-droid.org/repo/amirz.rootless.nexuslauncher_30911.apk
shasum -a 256 amirz.rootless.nexuslauncher_30911.apk
# 7fa44d560dc4577374d45176220de2c0b00a71e09d6d148cdea4e0a52d38404a
mise exec -- adb install amirz.rootless.nexuslauncher_30911.apk
mise exec -- adb shell cmd package set-home-activity --user 0 \
  amirz.rootless.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity
```

Then check by hand on the panel that the launcher opens Settings → Apps, and that Developer options → USB debugging is on.

Undo: `cmd package set-home-activity --user 0 net.frameo.frame/.ui.activities.AWaitForDeferredInitCompleted`, then `adb uninstall amirz.rootless.nexuslauncher`.

## 3. Remove the vendor apps, Frameo and AOSP extras

`pm uninstall --user 0` removes a package for user 0 and keeps it from starting. The APK stays in `/system`, so `cmd package install-existing <package>` brings it back. On a sibling S101 board upstream, `pm disable-user` did not keep `PERSISTENT` apps such as the stress test from starting after a reboot, so this frame used `pm uninstall --user 0` for all of them.

First, back up the file that records the change. If Android does not boot later, copying it back undoes every removal at once:

```sh
mise exec -- adb shell su 1000 cp /data/system/users/0/package-restrictions.xml /data/system/package-restrictions.xml.bak
```

Then remove the packages:

```sh
for p in com.adups.fota android.rockchip.update.service com.DeviceTest com.cghs.stresstest \
         android.rk.RockVideoPlayer com.android.rk net.frameo.frame; do
  mise exec -- adb shell pm uninstall --user 0 "$p"
done
```

| Package                                        | What it is                                         |
| ---------------------------------------------- | -------------------------------------------------- |
| `com.adups.fota`                               | Adups firmware updater                             |
| `android.rockchip.update.service`              | Rockchip OTA updater, runs as `system`             |
| `com.DeviceTest`, `com.cghs.stresstest`        | Factory test apps, run as `system`                 |
| `android.rk.RockVideoPlayer`, `com.android.rk` | Rockchip video player and demo                     |
| `net.frameo.frame`                             | Frameo. Removing it deletes its pairing and photos |

The same loop removed 39 AOSP packages that a wall dashboard does not use. All are `com.android.<name>` except the last: `calculator2`, `music`, `musicfx`, `gallery3d`, `egg`, `dreams.basic`, `dreams.phototable`, `wallpaper.livepicker`, `wallpaperpicker`, `wallpapercropper`, `wallpaperbackup`, `bips`, `printservice.recommendation`, `printspooler`, `bookmarkprovider`, `htmlviewer`, `smspush`, `mms.service`, `providers.calendar`, `providers.downloads.ui`, `managedprovisioning`, `onetimeinitializer`, `provision`, `backupconfirm`, `sharedstoragebackup`, `companiondevicemanager`, `cts.ctsshim`, `cts.priv.ctsshim`, `bluetoothmidiservice`, `statementservice`, `storagemanager`, `vpndialogs`, `proxyhandler`, `pacprocessor`, `captiveportallogin`, `documentsui`, `mtp`, `location.fused`, and `com.svox.pico`. 27 packages are left (`pm list packages | wc -l`).

### Wait about 10 s before you reboot

Android writes each removal to `package-restrictions.xml` about 10 s after the command. A reboot before that brought Frameo back once. Before you reboot, make sure that the last package has `inst="false"`:

```sh
mise exec -- adb shell "su 1000 grep 'name=\"net.frameo.frame\"[^>]*inst=\"false\"' /data/system/users/0/package-restrictions.xml"
```

Undo one package: `mise exec -- adb shell cmd package install-existing <package>`. Undo all: `su 1000 cp /data/system/package-restrictions.xml.bak /data/system/users/0/package-restrictions.xml`, then reboot.

## 4. Settings and logs

```sh
mise exec -- adb shell settings put secure screensaver_enabled 0              # was 1
mise exec -- adb shell settings put secure screensaver_activate_on_dock 0     # was 1
mise exec -- adb shell settings put secure location_providers_allowed -gps    # was gps
mise exec -- adb shell settings put global package_verifier_enable 0          # was 1
mise exec -- adb shell settings put global captive_portal_mode 0              # was unset
mise exec -- adb shell settings put global ble_scan_always_enabled 0          # was unset
```

Undo: `settings put` the old value, or `settings delete global <name>` for the two that were unset.

The logs and Frameo leftovers were deleted once, with no undo: `logcat -b all -c`, `/data/system/dropbox`, `/data/tombstones`, `/data/anr`, `/data/system/usagestats`, `/data/system/procstats`, `/data/system/heapdump`, the contents of `/cache/recovery`, and `/sdcard/frameo`, `/sdcard/frameo_files`, `/sdcard/removed_indicators.txt`. Root cannot delete files it does not own, so delete each path as its owner, for example `su 1000 rm -r` for the folders that `system` owns.

## 5. Black boot screens

While it starts, the frame shows the boot logo from the bootloader and kernel, then Android's boot animation. Both showed the Frameo logo.

### Boot animation: a black zip in the stock zip's blocks

The stock boot animation is `/system/media/bootanimation.zip`, the Frameo logo on white (`870 432 15`, four parts). Rockchip's `libbootanimation.so` plays `/oem/media/bootanimation.zip` or `/system/media/bootanimation.zip` if either exists. It plays `/data/local/bootanimation.ts` only if neither zip exists and `persist.sys.bootvideo.enable` is `true`. A video in `/data` therefore cannot replace the stock zip, and `/system` is read-only.

On 2026-10-22 a black video in `/data/local/bootanimation.ts` with `persist.sys.bootvideo.enable` set to `1` was tried, and the Frameo animation still played. On 2026-10-23 both were removed with `su 0 setprop persist.sys.bootvideo.enable 0` and `su 0 rm /data/local/bootanimation.ts`.

The fix writes a black zip into the data blocks of the stock zip. The zip fills 91 contiguous 4 KiB blocks from block 297,532 of `system`. The black zip has the stock size of 369,653 bytes, so no ext4 metadata changes. ext4 does not checksum file data, and `/system` is mounted straight from `rknand0p11` with no dm-verity device, so the change survives a reboot.

1. Cut `system` out of the backup (start 1,654,784, 3,932,160 sectors) and build the patch:

   ```sh
   python3 -I device/black-boot-animation.py system.img out/
   ```

   It writes `out/bootanimation-black.seg`, `out/bootanimation-stock.seg` and the hashes:

   | What                        | SHA-256                                                            |
   | --------------------------- | ------------------------------------------------------------------ |
   | Stock zip                   | `4a23760fc54f1e4f2219ed0f0577fea6f55ee4468a079fdfddd54927122a7298` |
   | Black zip                   | `d58c535c3fac8ca78b9eab606dd7c14e831f16410726fb528ef9741a747f2451` |
   | Segment to write            | `4c8f066b33984e3a57fa3771c03cd802b1ed8d7de96f613d5041a4c3053f561b` |
   | Stock segment, for the undo | `113dc6a5680dbcd9f9a005fe1d87d31a5341425fdfaa2d0578ee3ad5fa598e71` |

2. Push the segment and make sure that it arrived intact:

   ```sh
   mise exec -- adb push out/bootanimation-black.seg /data/local/tmp/
   mise exec -- adb shell sha256sum /data/local/tmp/bootanimation-black.seg   # must be 4c8f066b…
   ```

3. Android sets the read-only flag on `rknand0p11` (`blockdev --getro` prints 1), so `dd` to it fails with `Operation not permitted`. Write through the whole disk `rknand0` instead, where the same blocks start at block 504,380 (1,654,784 ÷ 8 + 297,532). Make sure that the live blocks are still stock. If it prints anything else, stop.

   ```sh
   mise exec -- adb shell 'su 0 sh -c "dd if=/dev/block/rknand0 bs=4096 skip=504380 count=91 2>/dev/null | sha256sum"'   # must be 113dc6a5…
   ```

4. Write, flush, and read back:

   ```sh
   mise exec -- adb shell su 0 dd if=/data/local/tmp/bootanimation-black.seg of=/dev/block/rknand0 bs=4096 seek=504380 count=91
   mise exec -- adb shell su 0 sync
   mise exec -- adb shell "su 0 sh -c 'echo 3 > /proc/sys/vm/drop_caches'"
   mise exec -- adb shell 'su 0 sh -c "dd if=/dev/block/rknand0 bs=4096 skip=504380 count=91 2>/dev/null | sha256sum"'   # must be 4c8f066b…
   mise exec -- adb shell su 0 sha256sum /system/media/bootanimation.zip                                          # must be d58c535c…
   mise exec -- adb shell rm /data/local/tmp/bootanimation-black.seg
   ```

5. Reboot. On 2026-10-23 the zip was still `d58c535c…` after the reboot, and logcat showed `BootAnimation` running.

The stock zip and `bootanimation-stock.seg` are in `backups/hy-s101/` of this repo.

Undo: push `bootanimation-stock.seg` (hash `113dc6a5…`), make sure that the live blocks are `4c8f066b…`, then write it with `seek=504380 count=91` and make sure that `/system/media/bootanimation.zip` reads back as `4a23760f…`.

### Black boot logo

This was the first write to flash. The logos are in `resource` (p4), a 16 MiB Rockchip `RSCE` image with three entries:

| Entry             | Sector | Bytes     |
| ----------------- | ------ | --------- |
| `rk-kernel.dtb`   | 4      | 106,832   |
| `logo.bmp`        | 213    | 1,025,076 |
| `logo_kernel.bmp` | 2216   | 1,025,076 |

Both logos are the same 800×1280 8-bit BMP with palette entry 0 black. `device/black-boot-logo.py` keeps each BMP header and sets every pixel to entry 0. It runs offline, refuses any input except the stock partition, and makes sure that the result matches the image that was verified on the frame.

1. Get the stock partition from the backup (see [the backup](#1-firmware-backup)) and build the patch:

   ```sh
   python3 -I device/black-boot-logo.py resource.img out/
   ```

   It writes `out/resource-black.seg` (sectors 213 to 4,218, 4,006 sectors) and prints the hashes:

   | What                        | SHA-256                                                            |
   | --------------------------- | ------------------------------------------------------------------ |
   | Stock partition             | `9e1f2ebf2b193d999b7ce3a3d88a1e8c1aa2c4c0239c07f72a4b3a8f7de9ead7` |
   | Patched partition           | `8c6fe52c46baad89377e0ec45a567eee697a12d72f6640ef9674e62c53093725` |
   | Segment to write            | `e6fc62077afed27e0c9742b6942d2410e4bcc8f99b8b362fd8900dc6df81f725` |
   | Stock segment, for the undo | `5b0bccbc56e78617da9a8be2d7c84a08da87f4d71b3be973a00b7545703dd87a` |

2. Push the segment and make sure that it arrived intact:

   ```sh
   mise exec -- adb push out/resource-black.seg /data/local/tmp/
   mise exec -- adb shell sha256sum /data/local/tmp/resource-black.seg      # must be e6fc6207…
   ```

3. Make sure that the live partition is still stock. If it prints anything else, stop.

   ```sh
   mise exec -- adb shell su 0 sha256sum /dev/block/rknand0p4               # must be 9e1f2ebf…
   ```

4. Write only the logo sectors, flush, and read back:

   ```sh
   mise exec -- adb shell su 0 dd if=/data/local/tmp/resource-black.seg of=/dev/block/rknand0p4 bs=512 seek=213 count=4006
   mise exec -- adb shell su 0 sync
   mise exec -- adb shell "su 0 sh -c 'echo 3 > /proc/sys/vm/drop_caches'"
   mise exec -- adb shell su 0 sha256sum /dev/block/rknand0p4               # must be 8c6fe52c…
   ```

5. Reboot, and read the partition hash once more. On 2026-10-22 it was `8c6fe52c…` after the reboot too.

Undo: write the stock sectors back the same way. Cut `dd bs=512 skip=213 count=4006` out of the stock `resource.img` (hash `5b0bccbc…`), push it, make sure that the live partition is `8c6fe52c…`, then write it with `seek=213 count=4006` and make sure that the partition reads back as `9e1f2ebf…`.

## 6. Time zone

To set the time zone, open Android Settings → System → Date & time, turn off automatic time zone, and select Kuala Lumpur. Check it with `getprop persist.sys.timezone`, which prints `Asia/Kuala_Lumpur`. The dashboard follows it (see `AGENTS.md`). Without Wi-Fi, the frame has no NTP, so the clock drifts.

## 7. Home HQ kiosk as Home

Home HQ is the kiosk app from `dashboard/kiosk` in `wesbos/photo-frame-dashboard`. It shows `https://photoframe.lochingpo.com/` full screen in WebView 106, retries every 5 s when the page fails to load, and opens native controls on a two-finger hold of 1.5 s. Its README lists every feature. Our build adds the client certificate and `window.HomeHQ.setBacklight(on)`, which `pnpm frame screen off` uses (see `AGENTS.md`).

### Build

The APK was built on 2026-10-24 from upstream commit `f1e0820` with `homehq.patch` from this folder applied. The patch adds the TLS client certificate (see [Client certificate](#client-certificate)) and the `HomeHQ.setBacklight` JavaScript bridge, and sets the version to 1.2-mtls (version code 4). Build-tools 37.0.0 and platform 37.2 come from `sdkmanager`, and JDK Temurin 17 comes from mise. Upstream's `build.sh` hard-codes platform 34, so the build uses a copy with the platform path changed:

```sh
git clone https://github.com/wesbos/photo-frame-dashboard.git && cd photo-frame-dashboard
git checkout f1e0820
git apply ~/app/photo-frame/device/homehq.patch
sdkmanager --sdk_root=$ANDROID_HOME "build-tools;37.0.0" "platforms;android-37.2"
sed 's#platforms/android-34/#platforms/android-37.2/#' dashboard/kiosk/build.sh > dashboard/kiosk/build-latest.sh
mise exec java@temurin-17 -- env BUILD_TOOLS=$ANDROID_HOME/build-tools/37.0.0 bash dashboard/kiosk/build-latest.sh
```

The result is `com.wesbos.homehq` 1.2-mtls (version code 4), minSdk 23, targetSdk 28, signed with APK Signature Scheme v2 and v3. Its SHA-256 was `fde5d459919a46d082c9d548d58a13b0f7b33b233662126fdf68aa1c8fe7046f`. It was installed with `adb install -r` on 2026-10-24 and replaced these builds:

| Version  | Code | SHA-256                                                            | Patch                                                       |
| -------- | ---- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1.1-mtls | 3    | `f9c77bc545de2c0821e4cf7f2426f239fb92ca0ef6e67c8e635f9aaaad80b81b` | `homehq-client-cert.patch`, in git history before this file |
| 1.1      | 2    | `c1633c68785b9d479543fbff976ad3c6af5b488a26920ff738cf655d3e8c02de` | none                                                        |

To undo the bridge, build 1.1-mtls with the patch from `git show 599a484:device/homehq-client-cert.patch`, and install it with `adb install -r -d`. Without the bridge, `pnpm frame screen off` shows a black screen at full backlight. targetSdk stays at 28 because a higher target changes nothing on Android 8.1, and upstream says that 30 and higher need manifest changes.

The APK is signed with `~/.android/debug.keystore` on the Mac that built it. An update with `adb install -r` must be signed with the same key. With another key, uninstall first.

### Install

```sh
mise exec -- adb install homehq.apk
mise exec -- adb shell am start -n com.wesbos.homehq/.MainActivity --es url https://photoframe.lochingpo.com/
mise exec -- adb shell am start -n com.wesbos.homehq/.MainActivity --ez home true
mise exec -- adb shell cmd package set-home-activity --user 0 com.wesbos.homehq/.Home
```

Then give the kiosk the client certificate, as [Client certificate](#client-certificate) describes. Without it, the worker answers 404.

Wait 30 s before you reboot, because Android saves the Home choice a few seconds later. Then make sure that it is saved:

```sh
mise exec -- adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME   # com.wesbos.homehq/.Home
mise exec -- adb shell "su 1000 grep -A1 '<preferred-activities' /data/system/users/0/package-restrictions.xml"
```

If the kiosk shows "Can't reach the dashboard" and logcat shows `HomeHQ: Load failed (net::ERR_NAME_NOT_RESOLVED)`, the router or Android has cached a "no such host" answer. Cloudflare's negative TTL for `lochingpo.com` is 1800 s, and `ndc resolver clearnetdns` does not clear Android's copy, so wait for it to expire. To prevent it, do not look up a new hostname before the deploy that creates it.

To reach Android Settings or Pixel Launcher from the kiosk, hold two fingers on the screen for 1.5 s, then tap **Android settings** or **Open launcher**.

Undo: `cmd package set-home-activity --user 0 amirz.rootless.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity`, then `am start -n com.wesbos.homehq/.MainActivity --ez home false`, then `adb uninstall com.wesbos.homehq`.

### Client certificate

The frame proves itself with a TLS client certificate (mTLS), and the worker answers 404 to every request without one. `README.md` describes the Cloudflare side.

The key is ECDSA P-256, made on the Mac on 2026-10-24. The files are in `~/.config/photo-frame/mtls/` with mode 600: `frame.key` (PEM), `frame.key.der` (PKCS#8 DER), `frame.csr`, and `frame.crt` (from the Cloudflare-managed CA). Never commit, log or screenshot `frame.key` or `frame.key.der`.

The certificate is `CN=hy-s101-frame` from the Cloudflare-managed CA, valid until 2036-10-21. It went on the frame on 2026-10-24. The same day the saved URL lost its `?key=`, because the worker no longer reads a key.

To give the kiosk the certificate, run from this repository:

```sh
d=~/.config/photo-frame/mtls
mise exec -- adb shell am start -n com.wesbos.homehq/.MainActivity \
  --es client_key "$(base64 -i $d/frame.key.der)" \
  --es client_cert "$(openssl x509 -in $d/frame.crt -outform DER | base64)"
mise exec -- adb logcat -d -s HomeHQ | grep 'Client certificate'   # Client certificate saved for photoframe.lochingpo.com
```

The kiosk checks that the key matches the certificate, then saves both in its app data, which anyone with ADB and root can read. It offers them only to the host of the saved URL at the time of the save. After a host change, send the certificate again.

If the frame shows "Not found" with a valid certificate saved, restart the kiosk with `am force-stop com.wesbos.homehq`, then `am start -n com.wesbos.homehq/.MainActivity`. WebView reuses TLS connections and sessions, and one opened without a certificate stays without one. On 2026-10-24, connections from before mTLS was on for the host got 404 until this restart.

Undo: `am start -n com.wesbos.homehq/.MainActivity --ez forget_client_cert true`. The frame then gets 404 until the worker stops checking for a certificate.

## Not done yet

### WebView 138

LineageOS WebView 138.0.7204.63 is the newest build for API 27. `adb install` fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, because its signing key differs from the stock WebView in `/system`. With no `/system` remount, the remaining route is an offline edit of the `system` image, as the upstream repo did on a Pastigio FRAME156:

1. Make sure that the live `rknand0p11` hash matches the backup.
2. Cut `system` out of the backup (start 1,654,784, 3,932,160 sectors).
3. In a Linux container, use `debugfs` to replace `/system/app/webview/webview.apk`, delete its `oat/` folder, and add `lib/arm/libwebviewchromium.so` and `lib/arm/libcrashpad_handler_trampoline.so` from the APK. Run `e2fsck -n` on the result.
4. Write only the changed blocks with the same compare, write and readback steps as the boot logo.
5. Reboot. `dumpsys webviewupdate` must show 138.0.7204.63, and logcat must not show `Failed to load library`.

| File                                               | SHA-256                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `webview-138.0.7204.63-arm.apk` (90,257,078 bytes) | `b7268786318f404bdad53eaaec889619ff30100b935541a9e393e32efed3cf11` |
| `lib/arm/libwebviewchromium.so`                    | `d217fc3847fad5cecc1f37ffa8461b95fc2bb32586f63f01285381239c11b03d` |
| `lib/arm/libcrashpad_handler_trampoline.so`        | `e16d7cd6d1669d6da68997099425501f8bb6d6f0ae3bb6c8dbbb0bc8e0f4441d` |

Measure memory and page load on 106 first, so you can tell whether 138 is better. If it is worse, write the original blocks back from the backup.

### More swap

`zram0` is 360 MB. Making it larger needs `CAP_SYS_ADMIN`, which this `su` does not have.
