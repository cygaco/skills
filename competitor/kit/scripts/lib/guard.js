"use strict";
/**
 * lib/guard.js - the URL check run before every fetch, and again on every
 * source record when a report is rendered.
 *
 * The URL is normalised by the WHATWG URL parser first (the global URL class),
 * so numeric host forms such as 2130706433, 0x7f.1, 017700000001, 127.1 or
 * fullwidth digits are judged as the dotted address they really mean.
 *
 * Refused: non-http(s) schemes; credentials; an empty host; whitespace or
 * control characters; localhost, *.localhost, *.local, *.internal, *.home.arpa,
 * *.lan; single-label host names; IPv4 0/8, 10/8, 100.64/10, 127/8,
 * 169.254/16, 172.16/12, 192.168/16, 224/4, 240/4, 255.255.255.255; IPv6 ::,
 * ::1, fe80::/10, fec0::/10, fc00::/7, ff00::/8; and any IPv6 form that embeds a
 * refused IPv4 address (mapped ::ffff:a.b.c.d, compatible ::a.b.c.d, NAT64
 * 64:ff9b::/96, 6to4 2002::/16).
 *
 * The check sees only the URL it is given. It cannot see DNS answers (a public
 * name that resolves to a private address) or where a redirect ends up.
 */

const BLOCKED_NAME_SUFFIXES = ["localhost", "local", "internal", "home.arpa", "lan"];

// [network, prefix length, reason]
const BLOCKED_V4 = [
  ["0.0.0.0", 8, "IPv4 0.0.0.0/8 (this network)"],
  ["10.0.0.0", 8, "IPv4 10.0.0.0/8 (private)"],
  ["100.64.0.0", 10, "IPv4 100.64.0.0/10 (carrier-grade NAT)"],
  ["127.0.0.0", 8, "IPv4 127.0.0.0/8 (loopback)"],
  ["169.254.0.0", 16, "IPv4 169.254.0.0/16 (link-local, cloud metadata)"],
  ["172.16.0.0", 12, "IPv4 172.16.0.0/12 (private)"],
  ["192.168.0.0", 16, "IPv4 192.168.0.0/16 (private)"],
  ["224.0.0.0", 4, "IPv4 224.0.0.0/4 (multicast)"],
  ["255.255.255.255", 32, "IPv4 255.255.255.255 (broadcast)"],
  ["240.0.0.0", 4, "IPv4 240.0.0.0/4 (reserved)"],
];

function v4ToInt(dotted) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(dotted));
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return null;
  return o[0] * 16777216 + o[1] * 65536 + o[2] * 256 + o[3];
}

function intToV4(n) {
  return [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join(".");
}

const BLOCKED_V4_INT = BLOCKED_V4.map(([net, len, reason]) => {
  const size = Math.pow(2, 32 - len);
  const base = Math.floor(v4ToInt(net) / size) * size;
  return { base, size, reason };
});

/** Returns the refusal reason for a dotted IPv4 address, or null. */
function blockedV4(dotted) {
  const n = v4ToInt(dotted);
  if (n === null) return null;
  for (const r of BLOCKED_V4_INT) if (n >= r.base && n < r.base + r.size) return r.reason;
  return null;
}

/** Parses an IPv6 literal (no brackets) into 8 16-bit groups, or null. */
function parseV6(text) {
  let s = String(text).toLowerCase();
  if (s.includes("%")) return null; // zone ids: the URL parser refuses them too
  // An embedded dotted IPv4 tail becomes two hex groups.
  const tail = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (tail) {
    const n = v4ToInt(tail[1]);
    if (n === null) return null;
    s = s.slice(0, -tail[1].length) + Math.floor(n / 65536).toString(16) + ":" + (n % 65536).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const part = (h) => (h === "" ? [] : h.split(":"));
  const head = part(halves[0]);
  const rest = halves.length === 2 ? part(halves[1]) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 && missing < 1) return null;
  const groups = head.concat(halves.length === 2 ? new Array(missing).fill("0") : [], rest);
  if (groups.length !== 8) return null;
  const out = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

/** Returns the refusal reason for an IPv6 address given as 8 groups, or null. */
function blockedV6(g) {
  const allZero = (from, to) => g.slice(from, to).every((x) => x === 0);
  const v4At = (i) => intToV4(g[i] * 65536 + g[i + 1]);
  if (allZero(0, 8)) return "IPv6 :: (unspecified)";
  if (allZero(0, 7) && g[7] === 1) return "IPv6 ::1 (loopback)";
  if ((g[0] & 0xffc0) === 0xfe80) return "IPv6 fe80::/10 (link-local)";
  if ((g[0] & 0xffc0) === 0xfec0) return "IPv6 fec0::/10 (site-local)";
  if ((g[0] & 0xfe00) === 0xfc00) return "IPv6 fc00::/7 (unique local)";
  if ((g[0] & 0xff00) === 0xff00) return "IPv6 ff00::/8 (multicast)";
  const embedded = [];
  if (allZero(0, 5) && g[5] === 0xffff) embedded.push(["IPv4-mapped IPv6", v4At(6)]);
  if (allZero(0, 6)) embedded.push(["IPv4-compatible IPv6", v4At(6)]);
  if (g[0] === 0x64 && g[1] === 0xff9b && allZero(2, 6)) embedded.push(["NAT64 IPv6", v4At(6)]);
  if (g[0] === 0x2002) embedded.push(["6to4 IPv6", v4At(1)]);
  for (const [form, v4] of embedded) {
    const why = blockedV4(v4);
    if (why) return `${form} form of ${v4}, ${why}`;
  }
  return null;
}

/** Judges a WHATWG-normalised host name. Returns a reason, or null when it is allowed. */
function refuseHost(hostname) {
  const raw = String(hostname || "");
  if (!raw) return "empty host";
  if (raw.startsWith("[")) {
    const g = parseV6(raw.replace(/^\[|\]$/g, ""));
    if (!g) return "unreadable IPv6 address";
    return blockedV6(g);
  }
  let host = raw.toLowerCase();
  const stripped = host.replace(/\.+$/, "");
  if (!stripped) return "empty host";
  if (stripped !== host) {
    // A trailing dot can hide a numeric host from the parser: normalise again.
    try {
      host = new URL(`http://${stripped}/`).hostname.toLowerCase();
    } catch (e) {
      return "unreadable host";
    }
    if (host.startsWith("[")) return refuseHost(host);
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return blockedV4(host);
  for (const suffix of BLOCKED_NAME_SUFFIXES) {
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      return `local network name (${suffix === "localhost" ? "localhost" : `*.${suffix}`})`;
    }
  }
  if (!host.includes(".")) return "single-label host name (resolves on the local network)";
  return null;
}

// Whitespace, C0/C1 controls, zero-width and bidirectional controls. Checked by
// code point, so this source carries no escaped characters.
function hasUnsafeChar(text) {
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    if (c <= 0x20 || (c >= 0x7f && c <= 0xa0)) return true;
    if ((c >= 0x200b && c <= 0x200f) || c === 0x2028 || c === 0x2029) return true;
    if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069) || c === 0xfeff) return true;
    if (/\s/.test(ch)) return true;
  }
  return false;
}

/**
 * Checks one URL. Returns { ok: true, href, hostname } or { ok: false, reason }.
 * `href` is the WHATWG-normalised URL: the form to fetch and to record.
 */
function checkUrl(input) {
  if (typeof input !== "string") return { ok: false, reason: "not a string" };
  const text = input.trim();
  if (!text) return { ok: false, reason: "empty URL" };
  if (hasUnsafeChar(text)) {
    return { ok: false, reason: "contains whitespace or control characters (percent-encode them)" };
  }
  let u;
  try {
    u = new URL(text);
  } catch (e) {
    return { ok: false, reason: "not a valid absolute URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: `scheme must be http or https, not ${u.protocol.replace(/:$/, "") || "none"}` };
  }
  if (u.username || u.password) return { ok: false, reason: "contains credentials (user:pass@)" };
  const why = refuseHost(u.hostname);
  if (why) return { ok: false, reason: why };
  return { ok: true, href: u.href, hostname: u.hostname };
}

/** The key two URLs are matched on: the normalised URL without fragment or trailing slash. */
function citeKey(input) {
  const r = checkUrl(input);
  if (!r.ok) return null;
  const u = new URL(r.href);
  u.hash = "";
  let s = u.href;
  if (s.endsWith("/") && !u.search) s = s.slice(0, -1);
  return s;
}

module.exports = {
  checkUrl,
  refuseHost,
  hasUnsafeChar,
  blockedV4,
  blockedV6,
  parseV6,
  citeKey,
  BLOCKED_V4,
  BLOCKED_NAME_SUFFIXES,
};
