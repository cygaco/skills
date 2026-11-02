---
guide: TESTING_ON_PC
anchor: lastmile:day-zero
shape: walkthrough
timing: project-start
lead_time: "acquire/borrow a physical test device + create EAS/device-farm accounts EARLY; iOS verification needs a real iPhone you can borrow by launch week"
---

# TESTING_ON_PC_GUIDE.md - Testing a Phone App on Your Windows PC (for Total Newbies)

> You're building a mobile app on a Windows PC, and you don't own a Mac. Good news: your PC can simulate **most** of a phone, cheaply, and you can do almost all your day-to-day building without touching a real device. The catch: the few things your PC *can't* simulate are exactly the things that sink launches — and the most painful one (iPhone testing) has no shortcut on Windows. This guide tells you what to emulate, when you genuinely need a real phone, and the legitimate ways to test iOS without owning a Mac.
>
> **New here?** Read [`README.md`](README.md) once for the human-vs-AI split and the day-zero rule. This guide leans hard on that day-zero rule: **line up your test devices and cloud accounts at the START of the project, not in launch week.**

---

## 1. ELI5 - your PC is a flight simulator, not a real flight

A phone **emulator** (Android) or **simulator** (iOS) is a fake phone running inside a window on your PC. It's a flight simulator: perfect for practicing 95% of the trip — layout, buttons, navigation, logic, typing, most screens. You'll do the overwhelming majority of your building this way, and it's fast and free.

But a flight simulator can't teach you what a real landing in a crosswind feels like. The emulator can't ring a real push notification through Apple's or Google's servers, can't charge a real credit card, can't open a real camera, and can't show you how your app actually performs on a cheap $120 phone. **Those gaps are exactly where launches break** — a brand-new app that "worked perfectly on my PC" crashes on a tester's real iPhone, or never delivers a single push notification.

So the plan, in one sentence:

> **Emulate every day for speed; put it on a real device before every milestone — and *always* before you submit to a store.**

And the one fact that shapes everything on Windows:

> **There is no legitimate way to run an iPhone simulator on Windows.** The iPhone simulator only comes with Xcode, Xcode only runs on macOS, and macOS only legally runs on Apple hardware. We'll cover the real, legal iPhone options in Section 4 — but internalize now that **you will need access to a real iPhone** (your own or a borrowed one) before you ship to the App Store. Line that up early.

---

## 2. Which tools you use depends on what you built

Your testing toolchain depends on *how* your app was built. Find your stack below. (If you followed the mobile default in [`default-stacks.md`](../playbooks/default-stacks.md), you're almost certainly on **Expo / React Native**.)

### Expo / React Native (the default for most vibe-coders)

This is the easiest stack to test on Windows, because Expo was built for exactly this situation. You get three test surfaces:

| Surface | What it is | When to use it |
|---|---|---|
| **Expo Go** | A free app you install on a real phone (iPhone *or* Android) from the store. You scan a QR code and your app loads instantly — **no build, no Mac.** | Day-to-day iteration in the early phase. **Limit:** it only includes the native features Expo bundles in. The moment you add a custom native module (some payment SDKs, certain camera/Bluetooth libs), Expo Go can't run it. |
| **Development build (`expo-dev-client`)** | Your *own* app shell with your *own* native code baked in, built by Expo's cloud (EAS) so you don't need a Mac. | **The real choice once you add any native dependency.** This is what you graduate to. It behaves like the actual app, not a generic host. |
| **Web mode (`npx expo start`, press `w`)** | Runs your app as a web page in your PC browser. | Fastest possible look at layout/logic. **Proves the least** — it is not a phone; treat it as a sketchpad, not a test. |

**Golden rule for Expo:** start on Expo Go for speed, and switch to a **development build** the day you add your first native dependency. Staying on Expo Go after that point means you're testing a different app than the one you'll ship.

### Flutter

- **Windows desktop target** — Flutter can build your app as a normal Windows program. Great for fast iteration on UI and logic. *(It's not a phone, so it won't catch mobile-only behavior — use it like the web sketchpad above.)*
- **Android emulator** — your source of truth on Windows. Run your app on a real-ish Android (see Section 3).
- **iOS** — needs a Mac or a cloud build, same as everyone (Section 4).

### PWA / web-wrapped apps

If your "app" is really a website (a PWA, or a web app wrapped in something like Capacitor), your main tool is **Chrome or Edge DevTools "device mode"** (press F12, then click the little phone/tablet icon).

- **What it proves:** your layout adapts to phone-sized screens, your tap targets aren't tiny, text doesn't overflow.
- **What it does NOT prove:** how the app behaves in **real iOS Safari** (iPhones use Apple's WebKit engine, which has its own quirks DevTools does not reproduce), real mobile performance, the "Add to Home Screen" install flow, or push-notification quirks. *(Confidence: high — this is a well-documented gap.)* DevTools device mode is a layout check, not a substitute for a real phone.

### Native Android

Use **Android Studio** and its built-in **AVD (Android Virtual Device)** emulator — covered next.

---

## 3. Android emulation that actually works in 2026

Android emulation on Windows is fully viable — but a lot of tutorials online are **years out of date** and will send you down a dead end. Here's the current truth.

### The acceleration story (read this before you follow any old tutorial)

An Android emulator runs slowly unless it's "hardware accelerated." There used to be several ways to do this. In 2026, only one is worth starting on:

> **Use WHPX (Windows Hypervisor Platform, powered by Hyper-V). It works on both Intel and AMD chips, and it's the path the official Android docs recommend.** *(Confidence: high — verified against the Android developer docs and Microsoft Learn.)*

Two old options you'll see in stale guides — **ignore them:**

- **HAXM** is **dead.** It was Intel-only and has been removed from the Android Emulator (gone as of emulator version 36.2.x and later). If a tutorial tells you to install HAXM, the tutorial is obsolete.
- **AEHD** is a fallback that **sunsets on December 31, 2026.** Don't build your setup on something with an expiry date — go straight to WHPX.

### Setup steps

**🔴 YOU MUST DO THIS — turn on virtualization in your BIOS/UEFI.** This is a hardware switch your AI assistant cannot flip for you. It's usually called "Intel VT-x", "AMD-V", "SVM Mode", or "Virtualization Technology", and it lives in your PC's BIOS/UEFI settings (you reach it by pressing a key like F2 or Del as the PC boots). Without it, the emulator either won't start or crawls. *(If you're unsure, search your exact PC model + "enable virtualization in BIOS" — it's a 2-minute change.)*

**🤖 AI CAN DO THIS — the rest.** Installing Android Studio, creating the virtual device, enabling Windows features like Hyper-V/Windows Hypervisor Platform, and picking the right system image (prefer an **x86_64 image *with Google Play Services*** so things like in-app billing and Google sign-in are testable) — hand all of that to your assistant.

**Memory:** the emulator is RAM-hungry. **8 GB of RAM is the minimum; 16 GB is comfortable.** If your PC has 8 GB and the emulator makes everything else grind, that's expected — close other apps, or test on a real Android device instead.

---

## 4. The iOS-on-Windows truth (the section newbies need most)

This is the part nobody tells beginners clearly, so here it is plainly:

> **There is NO legitimate iOS Simulator on Windows. None.** The simulator ships only inside Xcode; Xcode is macOS-only; and Apple's license agreement forbids running macOS on non-Apple hardware. **"Hackintosh" setups and macOS-in-a-VM violate Apple's terms and break constantly** with every update. This guide will not teach them, and you should not waste days on them.

So how do you test an iPhone app from a Windows PC? There are four legitimate paths, ranked from cheapest/easiest to most expensive. Most solo founders use #1 and #2.

### Path 1 — A real iPhone + Expo Go (free, instant)

If your app is an Expo app with no custom native modules, borrow or use any iPhone, install **Expo Go** from the App Store, scan your QR code, and your app runs. **No Mac, no build, no cost.** This is the fastest possible iPhone test and where you should start. *(Limit: same as Section 2 — once you add native modules, Expo Go can't run them and you move to Path 2.)*

### Path 2 — EAS cloud builds + TestFlight (free tier, no Mac needed)

Expo's build service (**EAS Build**) compiles a real, signed iPhone app **in the cloud** — you never touch a Mac. You then install it on a real iPhone, or distribute it to testers through **TestFlight** (Apple's official beta-testing app).

- **Cost:** the EAS free tier includes roughly **15 iOS builds per month** (and ~15 Android builds), which is plenty for a solo founder iterating. Beyond that, paid plans start around $19/month. *(Confidence: high — verified against Expo's published pricing; tiers change, so check the link in Section 8 before relying on a number.)*
- **You still need:** a paid Apple Developer account ($99/year — see [`DEV_SETUP_GUIDE.md`](DEV_SETUP_GUIDE.md)) and a real iPhone to install on.

This is the standard "I build on Windows but ship to iPhone" path.

### Path 3 — Cloud device farms (rent real phones by the browser)

These services let you drive a **real physical phone** sitting in a data center, through your browser — useful for a pre-launch sweep across many device models you don't own.

- **Firebase Test Lab** — free tier gives roughly **5 physical-device test runs per day** (plus ~10 virtual). Beyond that it's about $5/hour for physical devices. Good for automated and screenshot checks. *(Confidence: high — verified against Firebase's pricing docs.)*
- **BrowserStack / AWS Device Farm** — thousands of real devices on demand; free trial, then paid from roughly $12–13/month. Good for manual "does it look right on a Samsung?" checks.

Device farms are for **pre-launch compatibility sweeps**, not daily building.

### Path 4 — Mac-in-the-cloud rental (last resort, $$)

You can rent a remote Mac (e.g., MacStadium, MacinCloud) by the hour or month to run real Xcode. Only reach for this if you genuinely need Xcode's debugger or simulator temporarily. **For most newbie apps, Paths 1–2 cover everything** — don't pay for this until you've hit a wall the cheaper paths can't clear. (Buying a cheap used Mac mini, ~$300–800, is often a better long-term move than renting if iOS becomes serious.)

> **The iOS bottom line:** build on Windows with EAS, test on a borrowed/owned real iPhone via Expo Go or TestFlight, and use a device farm for a final spread of models. You do **not** need to own a Mac to ship an iPhone app — but you **do** need access to a real iPhone.

---

## 5. Windows-specific traps that waste a newbie's afternoon

These are the "my phone can't connect to my app" problems that are pure Windows networking pain, not bugs in your code. *(Confidence: high — each is well-documented.)*

1. **Firewall blocks your dev server.** When you run `npx expo start` (or Metro/Vite), your PC hosts a little server your phone connects to over Wi-Fi. **Windows Defender Firewall often blocks it,** so the phone just spins. **Fix:** allow Node.js through the firewall for **Private** networks when Windows prompts you (or add an inbound rule for the dev port, usually TCP 8081). If LAN refuses to cooperate, use **Expo's "tunnel" mode** (`npx expo start --tunnel`) — slower, but it routes around the firewall entirely.

2. **Phone and PC must be on the same Wi-Fi.** Expo Go connects over your local network. If your phone is on guest Wi-Fi, mobile data, or a corporate/VPN network that isolates devices, it can't see your PC. **Same Wi-Fi, or use tunnel mode.**

3. **Developing inside WSL2?** If your project lives in Windows Subsystem for Linux, the dev server is on a *different* network than your phone by default. You'll need port-forwarding (a `netsh interface portproxy` rule) and a firewall exception, or you'll just use tunnel mode. *(If "WSL2" means nothing to you, you're not using it — skip this one.)*

4. **Android USB debugging drivers.** To plug an Android phone in by cable, you must enable **Developer Options → USB debugging** on the phone, use a real **data** cable (not a charge-only one), and sometimes install your phone-maker's USB driver before `adb devices` sees it.

5. **Talking to a local API from the Android emulator.** Inside the Android emulator, `localhost` means *the emulator itself*, not your PC. To reach an API running on your PC, use the special address **`10.0.2.2`** instead of `localhost`.

6. **Keep your project out of OneDrive.** Building inside a OneDrive/synced folder makes file-watchers and builds flaky. Keep the project in a plain local folder.

---

## 6. What you CANNOT trust an emulator to validate

Here's the heart of the guide. The following things **behave differently (or don't work at all) on an emulator** and *must* be checked on a real device before you launch. *(Confidence: high — this list is corroborated across the research.)* Treat it as a pre-launch checklist:

- [ ] **Push notifications, end to end** — emulators don't reliably ring real notifications through Apple's APNs / Google's FCM. (See [`PUSH_NOTIFICATIONS_GUIDE.md`](PUSH_NOTIFICATIONS_GUIDE.md).)
- [ ] **In-app purchases & subscriptions** — buying, restoring a purchase, and subscription entitlements only work against real store accounts on a real device.
- [ ] **Camera, microphone, photos, GPS, biometrics, sensors** — the emulator fakes these; real hardware behaves differently (and permission-denied paths matter).
- [ ] **Real performance on low-end hardware** — your beefy PC makes everything feel fast. A $120 Android phone is the truth. Scrolling jank, slow loads, and memory crashes show up only here.
- [ ] **Deep links from a cold start** — tapping a link or notification when the app was fully closed (killed) routes differently than when it's already open. This is a classic miss.
- [ ] **iOS-specific UI: safe areas, the notch, Dynamic Island, the home indicator** — layouts that look fine in a simulator can have content hidden behind the notch on a real iPhone.
- [ ] **Sign in with Apple / Google sign-in** — the real OAuth flow behaves differently than a faked one.
- [ ] **The release build itself** — your debug build and your *signed release* build are not the same. Minification/optimization can break things that worked in debug. **Always smoke-test a release-like build (TestFlight / Play Internal Testing / signed APK), not just the debug build.**

> **The launch rule:** if it hasn't been installed and smoke-tested on a **real target device** from a **release-like build**, it has not been tested for launch. An emulator-green app is not a launch-ready app.

---

## 7. Your minimum device kit (and WHEN to get it)

You don't need a drawer full of phones. A solo founder's minimum kit:

| Device | Spec | Price band | When to acquire |
|---|---|---|---|
| **One cheap/refurbished Android** | Low-or-mid range, *not* a flagship — you want to feel the slow case | **~$80–$200** | **Early** — as soon as you have any mobile UI to look at. This is your daily reality check. |
| **Access to a real iPhone** | A currently-supported iOS version; owned or borrowed | borrow free / ~refurb if you'll iterate weekly | **Before** you build push, in-app purchases, deep links, or camera features — and *definitely* before you submit to the App Store |

*(Confidence: medium on the exact price band — it's a sensible 2026 estimate, not a hard quote; phone prices move.)*

**Why a *cheap* Android on purpose?** A flagship hides performance problems. A budget device surfaces the jank, memory limits, and OEM quirks (Samsung/Xiaomi battery managers, text truncation) that your real users will hit. Test on the worst phone your users might own, not the best.

> **🔴 The day-zero rule applies here too.** Borrowing or buying a test iPhone is a *human* task with lead time — you might not own one, and you can't borrow one at 2am on launch night. **Line up device access at the START of the project.** If you'll use cloud builds or device farms, create those accounts early too (see [`README.md`](README.md)'s day-zero doctrine). The setup is cheap; scrambling for an iPhone in launch week is the expensive part. 🤖 Wiring up the test scripts and build config is something your AI assistant can do — *acquiring the physical device is on you.*

---

## 8. Minimum viable setup

```
TESTING ON A WINDOWS PC - MINIMUM VIABLE
[ ] Virtualization is enabled in BIOS (🔴 human step)
[ ] Android emulator runs, accelerated via WHPX/Hyper-V (NOT HAXM/AEHD)
[ ] Emulator uses an x86_64 image WITH Google Play Services
[ ] Expo Go (or a dev build) runs the app on a real phone over same Wi-Fi
[ ] Switched from Expo Go to a development build after adding native deps
[ ] Node is allowed through Windows Firewall (or tunnel mode works)
[ ] iOS plan chosen: real iPhone + Expo Go / EAS cloud build + TestFlight
[ ] One cheap/refurbished Android acquired early
[ ] Access to a real iPhone lined up BEFORE launch week
[ ] A release-like build (not just debug) smoke-tested on a real device
[ ] Section 6 checklist run on a real device before store submission
```

**Done when:** you can build all day in the emulator for speed, push a development build to a real Android and a real iPhone whenever you want, and you've run the Section 6 real-device checklist against a release build — so nothing in the "emulator can't test this" list is a surprise on launch day.

---

## 9. Top newbie mistakes (and the fix)

1. **Believing "it works on my PC" means it's ready to ship.** → Emulator is for iteration; a real-device pass on a release build is non-negotiable before launch.
2. **Hunting for an iPhone simulator on Windows.** → There isn't one. Use a real iPhone + Expo Go, or EAS cloud builds + TestFlight.
3. **Trying Hackintosh / macOS-in-a-VM.** → Against Apple's terms, breaks constantly, wastes days. Don't.
4. **Following a HAXM tutorial in 2026.** → HAXM is removed; use WHPX/Hyper-V. AEHD sunsets Dec 31 2026 — skip it too.
5. **Forgetting to enable virtualization in BIOS.** → The emulator won't start or crawls; flip the BIOS switch first (🔴 human step).
6. **Phone can't connect to the dev server.** → Same Wi-Fi, allow Node through the firewall, or use Expo tunnel mode.
7. **Staying on Expo Go after adding native modules.** → Expo Go can't run them; switch to a development build.
8. **Testing only on a flagship phone (or only your own).** → Test on a *cheap* Android to catch real performance and OEM quirks.
9. **Never testing the release build.** → Debug ≠ release; optimization can break things. Smoke-test the signed/TestFlight build.
10. **Leaving the iPhone scramble for launch week.** → Line up real-device access on day zero; iPhone verification has human lead time.

---

## 10. Cross-references

- [`PUSH_NOTIFICATIONS_GUIDE.md`](PUSH_NOTIFICATIONS_GUIDE.md) - push is the #1 thing you cannot validate on an emulator; test it on a real iPhone AND a budget Android.
- [`DEV_SETUP_GUIDE.md`](DEV_SETUP_GUIDE.md) - the Apple Developer + Google Play accounts you need before EAS builds and TestFlight (start these on day zero).
- [`APP_STORE_GUIDE.md`](APP_STORE_GUIDE.md) - TestFlight, signing, and the review process your real-device build feeds into.
- [`DEPLOYMENT_INFRA_GUIDE.md`](DEPLOYMENT_INFRA_GUIDE.md) - smoke tests and the release-vs-debug build distinction.

---

## 11. Official sources

- Android Studio - emulator acceleration (WHPX recommended): https://developer.android.com/studio/run/emulator-acceleration
- Microsoft Learn - Android emulator hardware acceleration (HAXM deprecation / AEHD sunset): https://learn.microsoft.com/en-us/dotnet/maui/android/emulator/hardware-acceleration
- Expo - development builds vs Expo Go: https://docs.expo.dev/develop/development-builds/introduction/
- Expo - EAS Build pricing & free tier: https://docs.expo.dev/billing/plans/
- Firebase Test Lab - usage quotas & pricing: https://firebase.google.com/docs/test-lab/usage-quotas-pricing
- Firebase Test Lab - iOS getting started: https://firebase.google.com/docs/test-lab/ios/get-started
- BrowserStack - testing iOS apps on Windows: https://www.browserstack.com/guide/test-ios-apps-on-windows

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. Emulator tooling, free tiers, and device prices change frequently — treat the numbers here as directional and check each "Official sources" link before you rely on one. The one rule that won't change: emulate to build, real-device to launch.*
