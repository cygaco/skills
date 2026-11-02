---
guide: MOBILE_CLIENT_SECURITY
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: standard
maps_to: [mobile-client]
sources:
  - "https://owasp.org/www-project-mobile-top-10/"
  - "https://mas.owasp.org/MASVS/"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html"
  - "https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity"
  - "https://developer.android.com/google/play/integrity"
  - "https://www.rfc-editor.org/rfc/rfc8252"
  - "https://docs.expo.dev/guides/authentication/"
  - "https://reactnative.dev/docs/security"
---

# Mobile Client Security

**A mobile app binary is not a server you control — it is *public, attacker-held code*. The IPA/APK ships to every user and every attacker, who can decompile it, read its strings, intercept its deep links, and inspect its on-device storage. Anything embedded in the binary — a "secret" key, a hidden endpoint, an assumption that "only the app calls this" — is already known to the attacker. The build must treat the mobile client like any other untrusted client: no real secrets in the binary, sensitive tokens in OS-backed secure storage, validated deep links and OAuth redirects, minimal WebView bridges, and device-integrity signals as *evidence*, never as the lock.**

This guide trains your AI to grade the mobile-specific attack surface — the surfaces that server-side RLS, secrets hygiene, and auth correctness don't cover because they live in the shipped client. It's framework-generic with notes for Expo / React Native, the common indie stack.

---

## 1. What this is

Mobile clients add an attack surface that web apps largely don't have, because the *code itself* is in the attacker's hands:

- **The binary is public.** IPA (iOS) and APK/AAB (Android) files are distributed to every device and are trivially decompilable. Strings, URLs, and embedded keys are extractable. There is no "compiled, so hidden."
- **Local storage is reachable.** On a rooted/jailbroken device — or sometimes via backup extraction — app-local storage is readable. Tokens stored in plain `AsyncStorage`/`SharedPreferences`/`UserDefaults` are exposed.
- **Deep links are attacker-influenceable.** Custom URL schemes (`myapp://`) can be claimed or spoofed by other apps; universal/app links and OAuth redirects are prime hijack targets.
- **WebViews bridge web → native.** A JS bridge that exposes native capabilities to in-WebView content is a privilege boundary; untrusted web content reaching it is code execution against the device.
- **APIs can't assume "only my app calls them."** Any endpoint the app hits can be called directly with the same headers; the binary teaches an attacker exactly how.

This maps to the OWASP Mobile Top 10 / MASVS (insecure data storage, insecure authentication, insufficient binary protections, improper platform usage). This domain owns the `mobile-client` vocabulary axis and guides building the mobile client safely, closing the gaps, and asserting the rules in §6.

---

## 2. Why it matters

The recurring founder mistake: doing the *web* hardening right and then assuming the mobile app inherits it. It doesn't. A team that correctly avoids `NEXT_PUBLIC_`-leaking a server key on the web will happily bake the same key into the Expo app config, ship it to the store, and hand it to anyone who unzips the IPA. The binary is the new `NEXT_PUBLIC_*` — except worse, because there's no build step that warns you.

Concrete attack shapes:
- **Decompiled secret** → an embedded API/service/LLM/payment secret is extracted from the binary and used to bypass the app entirely, run up spend, or read data.
- **Custom-scheme hijack** → a malicious app registers the same `myapp://` scheme (or exploits a wildcard OAuth redirect) and intercepts the authorization code/token mid-OAuth, taking over the account.
- **WebView bridge abuse** → a WebView loads attacker-influenced content (an ad, a redirect, injected HTML) that calls a broad native bridge to read files, tokens, or contacts.
- **Stolen local token** → a long-lived session token in plain `AsyncStorage` is lifted off a backup or rooted device.

**For a security review specifically:** you cannot trust the mobile client to keep anything — treat every byte in the binary and every value in plain local storage as already disclosed. You must affirmatively verify: (a) no *real* secret (server/service key, LLM key, payment secret, DB credential) is embedded in the binary or its config — only public, RLS-bound, origin-restricted values belong client-side; (b) sensitive tokens use Keychain/Keystore/Secure-Enclave-backed storage, not plain `AsyncStorage`/`SharedPreferences`; (c) deep links and OAuth redirect URIs are validated (no custom-scheme hijack, no wildcard redirect, `state`+PKCE present); (d) WebView JS bridges are minimal and origin-restricted; (e) abuse-heavy APIs treat App Attest / DeviceCheck / Play Integrity as a *signal*, never as the sole authentication. The rules in §6 are written so each is an independently checkable PASS/FAIL.

---

## 3. Core principles / techniques

### 3.1 No real secrets in the binary

- **Embedded ≠ hidden.** Anything compiled into the IPA/APK or shipped in app config (Expo `app.config.js`/`extra`, `EXPO_PUBLIC_*`, hardcoded constants, `.env` bundled into JS) is extractable. **`EXPO_PUBLIC_` is the mobile `NEXT_PUBLIC_` — public by definition.**
- **Only public values belong client-side**: the Supabase anon/publishable key (RLS-bound), a public API base URL, publishable (not secret) third-party keys. Server/service-role keys, LLM provider keys, payment **secret** keys, DB credentials, and signing secrets must live **server-side only** and be reached through your backend.
- **Move privileged operations behind your server.** If the mobile app needs to do something that requires a real secret (call an LLM, charge a card), the app calls *your* authenticated endpoint, and the server holds the secret. The app never holds it.

### 3.2 Secure local token storage

- **Use OS-backed secure storage** for sensitive tokens (session/refresh tokens, anything granting access): iOS **Keychain** (Secure-Enclave-backed where available), Android **Keystore**. In Expo/RN this is **`expo-secure-store`** (or `react-native-keychain`); on the web fallback it degrades, so gate accordingly.
- **Avoid plain key-value stores for secrets.** `AsyncStorage` (RN) and plain `SharedPreferences`/`UserDefaults` are **not** encrypted-at-rest by default and are readable on rooted/backup-extracted devices — fine for non-sensitive UI state, wrong for tokens.
- **Minimize token lifetime/scope on-device.** Prefer short-lived access tokens with secure-stored refresh; revoke server-side on logout (overlaps `AUTHENTICATION_AND_SESSION.md` AUTHN-04).

### 3.3 Deep-link & OAuth redirect validation

- **Custom-scheme deep links are spoofable.** Another app can register the same `myapp://` scheme. Prefer **iOS Universal Links / Android App Links** (domain-verified, not claimable by other apps) for anything security-relevant, and **validate/whitelist** the deep-link payload before acting on it — never trust parameters in an incoming link.
- **OAuth on mobile = authorization code + PKCE in a system browser** (RFC 8252, "OAuth 2.0 for Native Apps"): use the system browser / `ASWebAuthenticationSession` / Custom Tabs (not an embedded WebView), **PKCE is mandatory** for public clients, validate `state`, and register an **exact, non-wildcard redirect URI**. A wildcard or loosely-matched redirect lets a malicious app intercept the code.
- In Expo, use the auth-session / proxy patterns that bind the redirect to your app and carry PKCE+state by default; don't roll a raw custom-scheme OAuth flow.

### 3.4 Minimal, origin-restricted WebView bridges

- **A JS→native bridge is a privilege boundary.** Expose the *smallest possible* native surface to WebView content, and only to content from **origins you control** (verify the loaded URL/origin before honoring a bridge call). Never expose a generic "run native / read file / get token" bridge.
- **Don't load untrusted content in a bridged WebView.** Third-party pages, ads, or redirected URLs in a WebView that can reach a native bridge = arbitrary web content driving native capability. If you must render untrusted content, do it in a bridge-less, sandboxed WebView.

### 3.5 Device/app integrity as a signal, not the lock

- **App Attest / DeviceCheck (iOS)** and **Play Integrity (Android)** let your server gain *evidence* that a request came from a genuine, unmodified app on a genuine device. Use them to **raise the cost of abuse** on high-abuse endpoints (free-tier signup, OTP/credit grants, scraping-prone APIs).
- **Never make them the sole authentication or authorization.** Attestation can be bypassed/relayed and isn't available on every device; it's one input to a risk decision, layered on top of real auth + server-side authz (which `AUTHZ_AND_TENANT_ISOLATION.md` and `AUTHENTICATION_AND_SESSION.md` own). Failing-open when attestation is absent is fine; treating a passing attestation as a login is not.

---

## 4. Concrete examples (build terms)

**Secret in the binary — DON'T / DO**
- DON'T: put an LLM/payment secret in `app.config.js` `extra` or a hardcoded constant in RN code — both ship in the IPA/APK and are decompiled out.
- DO: keep the Supabase **anon** key + public base URL client-side; call your own authenticated `/api/ai` and `/api/checkout` endpoints, which hold the LLM/payment **secret** server-side.

**Token storage — DON'T / DO**
- DON'T: write a refresh token via `AsyncStorage.setItem(...)` — plaintext on disk, readable on a rooted/backup-extracted device.
- DO: store it via `SecureStore.setItemAsync(...)` (Keychain/Keystore-backed); keep only non-sensitive UI state in `AsyncStorage`.

**Deep link / OAuth redirect — DON'T / DO**
- DON'T: OAuth redirect `myapp://*` (wildcard) via a custom scheme in an embedded WebView, no PKCE/state — a sibling app claims the scheme and steals the code.
- DO: use Universal/App Links or an exact registered redirect, run the flow in the system browser/`ASWebAuthenticationSession` with PKCE + `state`, and validate every deep-link parameter before acting.

**WebView bridge — DON'T / DO**
- DON'T: expose `window.native.readFile`/`getAuthToken` to a WebView that can navigate to arbitrary/third-party URLs.
- DO: expose a tiny, purpose-specific bridge, verify `event.origin` / the loaded URL is your own domain before honoring a call, and render untrusted content in a bridge-less WebView.

**Device integrity — DON'T / DO**
- DON'T: gate "is this a real user?" *solely* on a Play Integrity / App Attest pass, granting access on attestation alone.
- DO: require real auth + server-side authz, and use App Attest/DeviceCheck/Play Integrity as an *additional* abuse signal on high-abuse endpoints (fail-open when unavailable, never auth on it alone).

---

## 5. Common failure modes

| Failure | How it bites | How to detect |
|---|---|---|
| Real secret embedded in the binary/config | Decompiled key bypasses the app, runs up spend, reads data | Server/service/LLM/payment-secret/DB value in RN code, `app.config`/`extra`, `EXPO_PUBLIC_*`, or bundled `.env`; grep the JS bundle / unzip the IPA/APK |
| Sensitive token in plain `AsyncStorage`/`SharedPreferences` | Token lifted off a rooted device or backup extract | Long-lived/session/refresh token written to `AsyncStorage`/plain `SharedPreferences`/`UserDefaults` instead of SecureStore/Keychain/Keystore |
| Custom-scheme deep link trusted | Sibling app claims the scheme; payload spoofed | Security-relevant action keyed off a `myapp://` custom-scheme link with no domain verification / payload validation |
| Wildcard or loose OAuth redirect | Malicious app intercepts the authorization code | OAuth redirect URI is a wildcard/custom scheme; flow runs in an embedded WebView; PKCE/`state` missing |
| OAuth in an embedded WebView | App can read credentials; phishing-prone; violates native-app BCP | OAuth flow rendered in an in-app `WebView` rather than system browser / `ASWebAuthenticationSession` / Custom Tabs |
| Broad WebView JS bridge | Untrusted web content drives native capability (read files/tokens) | A native bridge exposing generic/file/token access reachable by content from origins not under your control |
| Device integrity used as sole auth | Attestation bypass/relay grants access; non-attesting devices locked out or spoofed in | Access granted on App Attest/DeviceCheck/Play Integrity alone, with no real auth + server-side authz behind it |

---

## 6. ✅ Agent-applicable RULES (the payoff)

Each rule is a PASS/FAIL assertion you or your AI can apply when building, fixing or reviewing. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

**Binary secrecy**
- **[MOB-01] critical — No real secret is embedded in the mobile binary or its shipped config — only public, RLS-bound/origin-restricted values are client-side.** → `mobile-client`. Detect: an API secret, service-role key, LLM key, payment **secret** key, or DB credential present in RN code, `app.config`/`extra`, an `EXPO_PUBLIC_*` var, a bundled `.env`, or extractable from the IPA/APK = FAIL (observed embedded secret, expected server-side only).

**Local storage**
- **[MOB-02] serious — Sensitive local tokens use Keychain/Keystore/Secure-Enclave-backed storage (e.g. `expo-secure-store`/`react-native-keychain`), not plain key-value stores.** → `mobile-client`. Detect: a long-lived/session/refresh token in `AsyncStorage`, plain `SharedPreferences`, or `UserDefaults` = FAIL/WARN.

**Deep links & OAuth**
- **[MOB-03] serious — Deep links and OAuth redirect URIs are validated: domain-verified (Universal/App Links) or exact-match, with `state` + PKCE, no wildcard/custom-scheme hijack risk, and OAuth runs in the system browser (not an embedded WebView).** → `mobile-client`. Detect: a custom-scheme/wildcard redirect, missing `state`/PKCE, unvalidated deep-link payload, or OAuth in an embedded WebView = FAIL.

**WebView bridges**
- **[MOB-04] serious — WebView JS↔native bridges are minimal and origin-restricted; untrusted web content cannot reach a privileged native bridge.** → `mobile-client`. Detect: arbitrary/third-party web content able to call a generic or privileged native bridge (file/token/exec) = FAIL.

**Device integrity**
- **[MOB-05] minor — Abuse-heavy APIs treat App Attest / DeviceCheck / Play Integrity as a signal layered on real auth + server-side authz, never as the sole authentication.** → `mobile-client`. Detect: a high-abuse mobile API with no device/app-integrity signal (WARN), or one that authenticates on attestation alone with no real auth behind it (FAIL) = WARN/FAIL.

> **Coverage note:** MOB-01 (embedded secret) and MOB-02 (`AsyncStorage` token) are largely grep/binary-inspection-detectable. MOB-03 (redirect/deep-link/OAuth flow), MOB-04 (bridge origin restriction), and MOB-05 (integrity-as-signal vs sole-auth) require reading the auth/deep-link/WebView wiring and are judgment checks — written as assertions so a reasoning reviewer can evaluate each independently. Maps to OWASP Mobile Top 10 / MASVS (insecure data storage, insecure authentication, improper platform usage, insufficient binary protections).

---

## 7. Sources

- OWASP — *Mobile Top 10* — https://owasp.org/www-project-mobile-top-10/ (insecure data storage, insecure auth, improper platform usage, insufficient binary protections)
- OWASP — *MASVS (Mobile Application Security Verification Standard)* — https://mas.owasp.org/MASVS/ (storage, crypto, auth, platform-interaction, resilience requirements)
- OWASP — *Mobile Application Security Cheat Sheet* — https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html (secure storage, WebView, deep-link guidance)
- Apple — *Establishing your app's integrity (App Attest / DeviceCheck)* — https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity (attestation as a server-verified signal)
- Google — *Play Integrity API* — https://developer.android.com/google/play/integrity (genuine app/device signal for abuse-heavy endpoints)
- IETF — *RFC 8252: OAuth 2.0 for Native Apps* — https://www.rfc-editor.org/rfc/rfc8252 (system browser, PKCE mandatory, exact redirect, no embedded WebView)
- Expo — *Authentication* — https://docs.expo.dev/guides/authentication/ (auth-session/PKCE patterns, `expo-secure-store`)
- React Native — *Security* — https://reactnative.dev/docs/security (no secrets in the bundle, secure storage, deep-link/WebView caution)
