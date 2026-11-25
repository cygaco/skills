'use strict';
/*
 * lib/md.js: find sections of the user's Markdown files by their exact headings, and
 * quote text safely.
 *
 * Headings inside fenced code blocks or HTML comments do not count. A section runs from
 * its heading to the next heading of the same or a higher level.
 */

const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})/;

// Unicode line and paragraph separators (code points 2028 and 2029).
const SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');

// mask[i] is true when line i is inside a fenced block or an HTML comment.
function mask(lines) {
  const out = new Array(lines.length).fill(false);
  let fence = null;
  let comment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      out[i] = true;
      const m = FENCE_OPEN.exec(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !line.trim().slice(m[1].length).trim()) fence = null;
      continue;
    }
    if (comment) {
      out[i] = true;
      if (line.includes('-->')) comment = false;
      continue;
    }
    const f = FENCE_OPEN.exec(line);
    if (f) {
      out[i] = true;
      fence = f[1];
      continue;
    }
    if (line.trimStart().startsWith('<!--')) {
      out[i] = true;
      if (!line.slice(line.indexOf('<!--') + 4).includes('-->')) comment = true;
    }
  }
  return out;
}

// The text of each line as a reader of the rendered file sees it: '' for fence lines and
// fenced content, and every HTML comment removed, including one that starts or ends in
// the middle of a line or runs over several lines. An unclosed comment hides the rest of
// the file. Used where a line must count only if it is really visible.
function visibleLines(lines) {
  const out = [];
  let fence = null;
  let comment = false;
  for (const line of lines) {
    if (fence) {
      const m = FENCE_OPEN.exec(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !line.trim().slice(m[1].length).trim()) fence = null;
      out.push('');
      continue;
    }
    if (!comment) {
      const f = FENCE_OPEN.exec(line);
      if (f) {
        fence = f[1];
        out.push('');
        continue;
      }
    }
    let vis = '';
    let i = 0;
    for (;;) {
      if (comment) {
        const j = line.indexOf('-->', i);
        if (j < 0) break;
        comment = false;
        i = j + 3;
        continue;
      }
      const k = line.indexOf('<!--', i);
      if (k < 0) {
        vis += line.slice(i);
        break;
      }
      vis += line.slice(i, k);
      comment = true;
      i = k + 4;
    }
    out.push(vis);
  }
  return out;
}

// The visible lines of the section under an exact heading (its first visible match),
// or null when the heading is not visible anywhere.
function visibleSection(lines, heading) {
  const vis = visibleLines(lines);
  const h = vis.findIndex((l) => l.trimEnd() === heading);
  if (h < 0) return null;
  const level = headingLevel(heading);
  const out = [];
  for (let i = h + 1; i < vis.length; i++) {
    const l = headingLevel(vis[i]);
    if (l && l <= level) break;
    out.push(vis[i]);
  }
  return out;
}

function headingLevel(line) {
  const m = /^(#{1,6})\s/.exec(line);
  return m ? m[1].length : 0;
}

function findHeading(lines, heading, m) {
  const mk = m || mask(lines);
  for (let i = 0; i < lines.length; i++) {
    if (!mk[i] && lines[i].trimEnd() === heading) return i;
  }
  return -1;
}

// [start, end): the body lines of the section whose heading is at index h.
function sectionRange(lines, h, m) {
  const mk = m || mask(lines);
  const level = headingLevel(lines[h]);
  let end = lines.length;
  for (let i = h + 1; i < lines.length; i++) {
    if (mk[i]) continue;
    const l = headingLevel(lines[i]);
    if (l && l <= level) {
      end = i;
      break;
    }
  }
  return [h + 1, end];
}

// Index after the last non-blank line of the section (where new text goes).
function insertionPoint(lines, h, m) {
  const [start, end] = sectionRange(lines, h, m);
  let at = start;
  for (let i = start; i < end; i++) if (lines[i].trim()) at = i + 1;
  return at;
}

// A fence longer than any backtick run in the text, so the text cannot close it.
function fenceFor(text) {
  let longest = 0;
  const re = /`+/g;
  let m;
  while ((m = re.exec(text))) longest = Math.max(longest, m[0].length);
  return '`'.repeat(Math.max(3, longest + 1));
}

// The text without its trailing newlines, by index: a pattern anchored at the end
// (/\n+$/) would rescan a long run of newlines from every position in it.
function dropTrailingNewlines(s) {
  const t = String(s);
  let e = t.length;
  while (e > 0 && t.charCodeAt(e - 1) === 10) e--;
  return t.slice(0, e);
}

function fenced(text, info) {
  const body = dropTrailingNewlines(text);
  const f = fenceFor(body);
  return `${f}${info || 'text'}\n${body}\n${f}`;
}

// One line of user text: line breaks, separators and control characters become spaces,
// runs of spaces one space, trimmed. Nothing is escaped yet.
function flatLine(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/[\r\n]+/g, ' ')
    .replace(SEPARATORS, ' ')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// The escaping step on its own: no HTML comment markers, no leading emphasis that could
// fake a field line. A caller that redacts does so before flatLine and again after it, and
// runs this last (escapeLine(redact(flatLine(redact(s))))): a control character or line
// break that flatLine turns into a space, or an escape, can never split a secret into a
// shape the redactor no longer sees.
function escapeLine(t) {
  let s = String(t).replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;');
  if (/^[#*>]/.test(s)) s = `\\${s}`;
  return s;
}

// One line of user text, safe to place in a Markdown file: no newlines, no heading,
// no HTML comment markers, no leading emphasis that could fake a field line.
function oneLine(s) {
  return escapeLine(flatLine(s));
}

module.exports = { mask, visibleLines, visibleSection, headingLevel, findHeading, sectionRange, insertionPoint, fenceFor, fenced, oneLine, flatLine, escapeLine, dropTrailingNewlines };
