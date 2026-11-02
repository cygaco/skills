---
guide: PUSH_NOTIFICATIONS
anchor: lastmile:module/analytics
shape: walkthrough
timing: at-module
lead_time: "none"
---

# PUSH_NOTIFICATIONS_GUIDE.md - Get Users to Come Back (Without Getting Muted) (for Total Newbies)

> You built an app. Push notifications are how you tap a user on the shoulder after they've closed it — "your order shipped", "Maya replied", "you're 1 workout from a streak". Done right, they bring people back. Done wrong, they get you muted or uninstalled.
>
> **New here?** Read [`README.md`](README.md) once for the human-vs-AI split. This guide focuses on earning the opt-in, not getting muted, and the boring plumbing that decides whether a push actually arrives.

---

## 1. ELI5 - what is a push notification?

Imagine you run a small shop and a regular gives you their phone number so you can text them when their special order arrives. A push notification is that text — a message your app sends even when the app is closed.

One important detail: **you don't text the phone directly.** You hand your message to the phone-maker's post office — **Apple's APNs** for iPhones, **Google's FCM** for Androids — and *they* deliver it. Each install has a unique address (a **token**) you must collect and send to.

The one big risk, in one sentence: **send too many, or the wrong ones, and people mute you or delete the app — and on iPhone you usually can't ask for permission again.** This whole guide is about avoiding that.

The biggest lever of all is **permission**. Most of your users will never see a single push unless you earn the opt-in — and *how you ask* decides whether you keep 40% or 80% of your audience. So we start there.

---

## 2. The permission play (do this first)

This is the section that most changes your outcome. The headline truth:

> **iOS opt-in is the scarce resource.** Android used to auto-grant notifications, so Android opt-in ran much higher than iOS — but Android 13 ended the free lunch. Opt-in rates vary a lot by source and year: roughly **iOS ~44-56%** vs **Android ~67-91%**. *(The exact numbers conflict across vendors and years; treat the direction as solid and the percentages as ballpark.)*

### The golden rules, in order

**Rule 1 - NEVER ask on first launch.** A cold system permission prompt on a brand-new user, before they've seen any value, is the single most destructive mistake. On iPhone the system prompt can only ever be shown **once** — if they decline, you can't ask again in-app. You can only deep-link them to Settings, which almost nobody does. A wasted first-launch prompt **permanently caps your iOS reach.**

**Rule 2 - Use a "soft ask" (a primer) first.** Show your **own** in-app screen before the real prompt: *"Get notified when your order ships?"* with a *Maybe later* / *Sure* choice. Only if they tap *Sure* do you fire the real OS prompt. Because your soft ask is just a normal screen, you can show it as many times as you like — you only "spend" the one-shot OS prompt on people already inclined to say yes. Vendor blogs widely cite a **2-3x higher opt-in** with priming. *([PARTIALLY VERIFIED] — the mechanic ("ask later if they decline") and *why it works* are confirmed by Braze; the exact multiple is a vendor-blog estimate, not a controlled study. The practice is unambiguously a best practice; treat "2-3x" as soft.)*

**Rule 3 - Ask at a value moment, not a time moment.** Trigger the soft ask right after the user does something good — placed a first order ("want shipping updates?"), sent a first message, finished a first workout. The ask should obviously be *for their benefit*, tied to what they just did. (More on timing in Section 3.)

### iOS - Provisional Authorization (the newbie's secret weapon)

Since iOS 12 you can request **provisional** authorization, which grants permission **with no prompt at all.** Notifications arrive **quietly** — straight to Notification Center, no banner, no sound, no lockscreen interruption — each carrying *Keep* / *Turn Off* buttons that let the user promote you to full, prominent delivery.

This is close to a free option. You start sending immediately and let your *content* earn the upgrade, without ever risking the one-shot hard prompt. One experiment write-up found provisional push got **the same opt-in rate** as the hard prompt **with no harm to day-1/3/7 retention**. In Expo you request it via the iOS option `ios: { allowProvisional: true }` in `requestPermissionsAsync`.

### Android 13+ (the easy wins are over)

Android flipped from opt-out to opt-in. Apps targeting Android 13+ (API 33) must declare `POST_NOTIFICATIONS` and **request it at runtime** — a real prompt the user can decline. Opt-in dropped across most app categories after this change (gaming lost nearly a third of opted-in users; finance/transport were least affected). Expo handles the manifest entry and the runtime request through `expo-notifications` when your app targets API 33+.

**So the same soft-ask discipline now applies to Android too — don't fire the Android 13 runtime prompt cold either.**

> **The hard truth to internalize:** iOS's prompt is **one-shot and unrecoverable** once declined. That single fact is why "never ask cold" matters more on iOS than anywhere else. iOS → soft-ask at a value moment, or go provisional to skip the prompt entirely. Android 13+ → also soft-ask before the runtime prompt.

---

## 3. When to trigger the soft ask (timing & priming)

Permission timing is a product decision, so it's worth its own short list. Trigger the soft ask:

- **After a high-value action**, not on a timer. "Just finished onboarding" or "just placed an order" beats "30 seconds after open."
- **When the benefit is obvious and immediate** — the notification you're about to enable is something they're *waiting on* (the order, the reply, the match), not a future "we'll send you stuff."
- **Tied to what they just did**: the copy should reference the moment ("Want a ping when this ships?"), not be a generic "Enable notifications?"
- **Pairing the primer with a visual cue** (a small illustration or a screenshot of an example notification) is cited as adding lift. *([UNVERIFIED magnitude] — "up to ~30%" is a vendor estimate; the practice helps, the exact number is soft.)*

Concrete triggers: after the first order is placed → "want shipping updates?"; after the first message sent → "get notified when they reply?"; after the first workout/lesson → "remind you tomorrow?".

---

## 4. "Sent" does not mean "delivered" does not mean "seen"

This is where vibe-coders lose hours. A push goes through three stages, and each one can quietly fail.

**Your server → Expo/gateway → the phone → the user's eyes.** When the gateway says `ok`, that only means *your message reached the gateway's servers* — **not** that it reached the user.

The plumbing you must get right:

1. **Re-fetch and re-save the token on EVERY app launch.** Tokens are not permanent — they change on reinstall, OS updates, restored backups, and occasional rotation. This is the **#1 reason "delivery rate" silently rots over months.**
2. **Prune dead tokens.** When a token dies, the gateway tells you: Expo returns a **`DeviceNotRegistered`** error, and the docs are explicit — stop sending to that token. Delete it from your database the moment you see this.
3. **Check receipts, not just the send.** With Expo you get a **ticket** immediately (`ok` = "Expo received it") and then a **receipt** ~15 minutes later that says whether APNs/FCM actually accepted it. "Sent" is the ticket; "delivered-to-gateway" is the receipt.

### Why silent (background) push is unreliable — don't lean on it

A **silent push** wakes your app in the background to fetch data, with no visible message. It is **throttled and unreliable by design:**

- **iOS:** Apple says don't send more than ~2-3 background pushes per hour, and background pushes are **"never guaranteed to be delivered."** Worse — **if the user force-quit your app, a silent push won't wake it at all.**
- **Android:** OEM "battery killers" (Samsung, Xiaomi, Oppo, Vivo, Huawei) aggressively Force Stop apps swiped from recents, and Doze/Adaptive Battery delay delivery. Device/OS-level restrictions are cited as accounting for **~20-40% of push failures.** Telling affected users to set your app to "Unrestricted"/"Not optimized" is the only real fix, and it's out of your hands.

**Rule: never rely on silent push for anything the user must see. Use a visible notification.**

> **Debugging ladder when a push "doesn't arrive":** (1) Is the token valid — did a receipt return `DeviceNotRegistered`? (2) Did the *receipt* say `ok`, or did the gateway reject it (bad credentials, payload too big)? (3) Is it a *device* problem — battery optimization, force-quit, Do Not Disturb? Most lost pushes are #1 or #3, **not your code.**

---

## 5. Frequency & not getting muted

Over-notifying is the **top driver** of opt-out and uninstall. The exact studies vary, but the direction is rock-solid and echoed by Apple's own guidelines.

- "64% of users may stop using an app if they get **more than five** pushes per week"; "46% would disable push at **2-5** messages per week."
- **6-10 pushes/week → ~32% uninstall.**
- One 2026 benchmark cites users getting **>6 pushes/week from one brand were 3.4x more likely to uninstall** within 30 days. *([UNVERIFIED] — single secondary source; the primary report could not be located. Use as directional, not gospel.)*

Apple's guideline, verbatim: *"Don't send multiple notifications for the same thing... you fill up Notification Center, and users may turn off notifications from your app."*

### The levers that fight fatigue

1. **A sane cap.** A few high-value pushes per week beats daily blasts. Start conservative — you can always send more once you've proven people want it.
2. **Quiet hours.** Never ship pushes at 3am local time. Respect the user's timezone; send at plausible-awake hours.
3. **Android notification channels = a free, built-in preference center.** Since Android 8 you must post to a **channel**, and users can disable a *single* channel (e.g. "Promotions") instead of muting everything. **Create separate channels for Transactional vs Reminders vs Promotions from day one.** Once a channel is created you can't change its importance — only the user can. In Expo: `setNotificationChannelAsync(...)` per category.
4. **A preference center.** Let users choose *which* categories they get (it's also a legal requirement for marketing — see Section 7). A user who can turn off "promos" but keep "order updates" is a user you don't lose entirely.
5. **Segment.** A relevant push to the right 10% beats a generic blast to 100% — higher taps, lower opt-outs.

### Deep-link every push to the right screen

Tapping a notification should land the user on the **exact** relevant screen, never a cold home screen. Put a target route/id in the payload's `data`, and on tap, read it and navigate.

Two cases newbies forget:
- App **already running** → handle the response listener.
- App was **killed** and the tap launched it → you must read the *initial* notification (`getLastNotificationResponseAsync()` in Expo) or the deep link is lost.

Apple even bakes this into its rules: *"Avoid telling people to open your app, navigate to specific screens, tap specific buttons..."* The fix is deep linking — **take** them there, don't **instruct** them.

---

## 6. Copywriting - what makes a push convert

The formula: **Specific + Personalized + Value-forward + one clear CTA + short.** Generic broadcast = ignored. Specific + personal = tapped.

Keep it short enough not to truncate: aim for a **~25-50 char title**, **~150 char body**, ≤2 lines. iOS truncates around ~178 characters total; Android titles around ~65. Don't include your app name or icon (the system already shows them). Sentence case, real punctuation, complete sentences.

| Bad | Good | Why |
|---|---|---|
| "We have news for you!" | "Your order #1432 shipped - arriving Thursday" | Specific, transactional, answers "so what?" |
| "Check out our app today" | "Maya replied to your message" | A real, personal event |
| "Don't miss our biggest sale ever!!!" | "Your size is back in stock - 3 left" | Concrete + scarcity, not hype |
| "You have notifications waiting" | "You're 1 workout from a 7-day streak" | Progress + one clear next step |
| "New features available now" | "You can now split bills - try it on your last receipt" | Ties the feature to *their* context |
| "Hey! Long time no see" | "Your cart's still here - the jacket you saved is 20% off today" | Re-engagement tied to a real item + a reason now |
| "Important update inside" | "Rain expected at 5pm - leave 10 min early" | Genuinely useful, time-relevant |
| "Tap to open the app and go to Rewards" | "You earned 500 points - redeem for a free coffee" | Don't instruct navigation; deep-link instead |

**Anti-patterns to avoid:** ALL CAPS, multiple exclamation marks, clickbait that doesn't match where the tap lands (kills trust and downstream conversion), more than one call-to-action, and "open the app to see" (Apple explicitly discourages task-instructions).

---

## 7. Store + legal rules (the ones that get apps rejected or fined)

### Apple App Store

Apple's review guidelines are strict about push:

1. **You cannot require push to use the app.** Don't gate any core feature behind enabling notifications.
2. **Marketing/promotional push needs explicit opt-in.** Show clear consent copy in your UI, and keep proof of consent. (Transactional push — order shipped, password reset — is fine without this.)
3. **You must provide an in-app opt-out** — a preference toggle inside the app, not just "go turn it off in iOS Settings."

Abusing push can get your push privileges revoked. Never put sensitive/confidential data in a notification.

### GDPR / EU consent

- **Transactional = send it.** Order, shipping, security, password reset — these are part of the service (legitimate interest / contract). No marketing consent needed.
- **Marketing = only with a clear yes.** Consent must be freely given, specific, and unambiguous — an opt-in, never a pre-ticked box. And you need an easy way to say no (a preference center / opt-out).
- **The trap:** the moment you slip a promo into a transactional push ("your order shipped — you might also like…"), the promo part needs marketing consent.

> **The one rule to remember:** the **OS permission grant is NOT the same as marketing consent.** A user tapping "Allow notifications" lets you *send*; it does **not** mean they agreed to *marketing*. For promotional push you need both: the OS permission **and** a recorded marketing opt-in, plus an easy opt-out.

---

## 8. Tooling ladder - what to reach for, and when

Your default stack is **Expo / React Native**, so start at the top and only climb when a real need pushes you up.

| Tool | What it's for | Newbie verdict |
|---|---|---|
| **Expo Push Service** | Free hosted relay — one token, one endpoint, Expo holds your APNs/FCM creds. Push working in an afternoon. | **Start here.** Zero cost, least config, perfect for MVP → PMF. No segmentation/scheduling/analytics UI — you script the sends yourself. |
| **Firebase Cloud Messaging (FCM)** | The raw infrastructure everything sits on; free at large scale. | Drop down to it when you outgrow Expo's relay or want Google's console. More setup; still mostly "send", not "campaign management." |
| **OneSignal** | "Just get push working **with a dashboard**" — free tier with real segmentation, scheduling, A/B. | **Best step-up** when you want a campaign UI + basic segments without enterprise pricing. The common graduation from Expo Push. |
| **Customer.io** | Event-driven journeys, behavioral segmentation, automation logic. | Reach for it when push becomes part of a **lifecycle journey** (onboarding drips, behavior-triggered sequences), not one-off blasts. |
| **Braze** | Enterprise omnichannel (push + in-app + email + SMS), expensive. | **Overkill for a newbie.** Only at real scale, with a marketing team and a budget. |

**The decision rule:** *Expo Push to launch → OneSignal when you want a dashboard + segments → Customer.io when push becomes journey-based → Braze only at scale.* **Don't pay** for Customer.io/Braze before you've proven retention on the free path.

A couple of plumbing facts that bite newbies regardless of tool:
- You **must test on a real physical device** — push tokens aren't issued on a bare simulator.
- Test on **both an iPhone and a budget Android** (Xiaomi/Samsung) — that's how you catch OEM battery-killing and text truncation before your users do.

---

## 9. Minimum viable setup

```
PUSH NOTIFICATIONS - MINIMUM VIABLE
[ ] Permission is NEVER requested on first launch
[ ] A soft-ask / primer screen gates the real OS prompt (fired at a value moment)
[ ] iOS: provisional auth OR a value-moment soft-ask before the one-shot prompt
[ ] Android 13+: POST_NOTIFICATIONS requested at runtime, after a soft-ask
[ ] Token is re-fetched and re-saved on EVERY app launch
[ ] Tokens are pruned when the gateway returns DeviceNotRegistered
[ ] Every push deep-links to the right screen (including the app-was-killed case)
[ ] Android channels split Transactional / Reminders / Promotions
[ ] A frequency cap + quiet hours are in place
[ ] An in-app opt-out / preference toggle exists
[ ] Marketing push has recorded consent; nothing core is gated behind push
[ ] Tested on a real iPhone AND a budget Android
```

**Done when:** a new user reaches a value moment, sees *your* primer, opts in, taps a real notification, and lands on exactly the right screen — and you can stop sending to a phone that uninstalled without spamming a dead token.

---

## 10. Top newbie mistakes (and the fix)

1. **Asking permission on first launch.** → Soft-ask at a value moment; on iOS consider provisional auth to skip the prompt.
2. **Wasting the iOS one-shot prompt on uninterested users.** → Gate the real OS prompt behind your own *Sure/Later* screen.
3. **Forgetting the Android 13+ runtime permission.** → Target API 33+ correctly, request `POST_NOTIFICATIONS`, soft-ask first.
4. **Never refreshing or pruning tokens.** → Re-fetch on every launch, delete on `DeviceNotRegistered`.
5. **Treating "sent" as "delivered/seen."** → Check receipts; track delivery and open separately.
6. **Relying on silent push for must-see content.** → It's throttled and dies on iOS force-quit — use a visible notification.
7. **Over-notifying.** → Cap frequency, add quiet hours, use Android channels + a preference center.
8. **Dumping users on the home screen.** → Deep-link to the exact screen, including the cold-start case.
9. **Marketing push without consent / opt-out.** → Explicit opt-in + in-app opt-out; OS permission ≠ marketing consent.
10. **Vague, hype-y, multi-CTA copy.** → Specific + personalized + value-forward + one CTA, within character limits.
11. **Testing only on your own phone.** → Test on a budget Android too, or you'll miss OEM battery-killing and truncation bugs.

---

## 11. Cross-references

- [`ANALYTICS_TELEMETRY_GUIDE.md`](ANALYTICS_TELEMETRY_GUIDE.md) - opt-in, delivery, open, and conversion are events; measure the chain, not just "sent".
- [`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md) - consent records, preference center, the marketing-vs-transactional line.
- [`APP_STORE_GUIDE.md`](APP_STORE_GUIDE.md) - Apple's push rules are part of review; don't gate features behind push.
- [`AUTH_GUIDE.md`](AUTH_GUIDE.md) - you need a stable user id to map tokens to people.

---

## 12. Official sources

- Expo Push Notifications: https://docs.expo.dev/push-notifications/overview/
- Expo - sending notifications (tickets, receipts, errors): https://docs.expo.dev/push-notifications/sending-notifications/
- Apple App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple Human Interface Guidelines - Notifications: https://developer.apple.com/design/human-interface-guidelines/
- Android - notification runtime permission: https://developer.android.com/develop/ui/views/notifications/notification-permission
- Android - notification channels: https://developer.android.com/training/notify-user/channels
- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging/
- OneSignal - iOS provisional push: https://documentation.onesignal.com/docs/ios-provisional-push-notifications

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. Push benchmarks vary by year, vendor, and platform, and OS rules change frequently — treat the percentages here as directional and check the provider docs before launch.*
