# MOBILE_DEV_LOOP_ON_WINDOWS

## Purpose

Keep mobile-first products buildable and testable from a Windows PC. Stack choice determines whether the daily dev loop runs on the PC or stalls on missing Apple hardware.

## Doctrine (verified 2026-06)

- **Pick a PC-testable stack.** Expo/React Native (Expo Go for bundled modules → `expo-dev-client` once native deps land; web target for fast iteration) or Flutter (Windows desktop target + Android emulator) keep the loop on the PC. Pure-native iOS development has no Windows loop.
- **Android emulation:** WHPX/Hyper-V is the supported acceleration path on Intel AND AMD. HAXM is dead (removed from emulator 36.2.x+); AEHD sunsets 2026-12-31 — don't start new setups on either.
- **iOS from Windows:** there is NO legitimate iOS Simulator on Windows (Hackintosh/macOS-VM routes violate Apple's EULA and are fragile — never recommend them). The honest path: physical iPhone + Expo Go for iteration, EAS cloud builds (free tier ≈15 iOS builds/mo) + TestFlight for real builds, cloud device farms (Firebase Test Lab free tier ≈5 physical-device runs/day; BrowserStack/AWS Device Farm) for matrix checks, Mac-in-cloud as last resort.
- **Emulators lie at the edges.** Push notifications end-to-end, in-app purchases, camera/sensors/biometrics, low-end-device performance, cold-start deep links, and iOS-specific UI need a REAL device before launch.
- **Device kit is a day-zero item:** a cheap/refurbished Android early; arranged access to a physical iPhone by launch-validation week.

## Rules

- `STACK-WINMOB-01 PASS`: A mobile product built on Windows selects a stack with a PC-native dev loop (Expo/RN, Flutter, or PWA) and names its iOS build path (EAS or equivalent).
- `STACK-WINMOB-02 FAIL`: Emulator setup instructions rely on HAXM, or on AEHD beyond 2026-12-31, instead of WHPX/Hyper-V.
- `STACK-WINMOB-03 FAIL`: Any plan assumes an iOS simulator on Windows or recommends Hackintosh/macOS-VM routes.
- `STACK-WINMOB-04 PASS`: The launch plan lists the real-device-only validations (push, IAP, sensors, performance, deep links) and when they run.
- `STACK-WINMOB-05 WARN`: No physical test device (or device-farm account) is arranged by the first validation milestone.

*Last reviewed: 2026-06.*
