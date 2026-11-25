'use strict';
/*
 * lib/redlines.js: the red-line screen, the loosening phrases, and the model-only floor
 * phrases that proposals.js checks.
 *
 * screen(text) -> { ask, term, group }
 *   One group per screened item of the twin's red-line floor (see "The red-line screen"
 *   in templates/formats.md). Text over 20,000 characters asks without being matched
 *   ("too long to screen"). Before matching, the text is normalised (normalizeForScreen):
 *   Unicode compatibility forms folded (NFKC), every combining mark (nonspacing, spacing
 *   and enclosing: the whole Unicode mark category) and every
 *   default-ignorable or other invisible character (format characters, the control
 *   characters that are not white space, fillers) removed, common Cyrillic, Greek and
 *   other look-alike letters mapped to Latin ones, lower case, and runs of white space
 *   collapsed. The text is also read a second way, with each invisible character as a
 *   space instead (so one between two words cannot join them into a new word), and with
 *   capital-I look-alikes as l (as in "depIoy"); and once more with each capital I or
 *   capital-I look-alike that touches another letter, in a word of any case, read as i
 *   or as l, each one on its own (DEPIOY, PUBIISH, CREDENTIAI, fuII, CIaude; the
 *   word-by-word checks read it as l). A phrase found in any reading asks. It then
 *   matches words and phrases on word boundaries; a few checks read the words of a
 *   command one by one instead (git, kubectl and helm options before the subcommand, and
 *   curl uploads), and one reads letter case (email followed by a name). Words that are also
 *   everyday programming words (post, token, release, drop, merge, charge, license) count
 *   only inside a phrase that makes the risky meaning clear. The screen only ever asks: a
 *   false match costs one question to the user, a missed one can cost far more, so where
 *   in doubt the list leans wide. It is a phrase list, not an understanding: a request
 *   worded around every phrase can pass, and the agent's own floor is the main guard.
 *   When nothing matches, a text with an invisible or control character directly between
 *   two letters or digits (a combining mark counts as part of the letter it sits on) still
 *   asks, in its own group (hidden-characters). The phrase it
 *   reports shows only text that the redacted copy of the text still holds (printed).
 *
 * loosening(text) -> the matched phrase, or null
 *   Phrases that would let the twin skip asking.
 *
 * modelOnly(text) -> { term, why } or null
 *   Mentions of the two floor items the screen cannot judge: CLAUDE.md, and what users
 *   see, get or are promised. proposals.js flags a proposal that mentions either.
 *
 * Every pattern is linear in the length of the text: a separator (SEP, non-letters) and a
 * word (WORD, letters and digits) never share a character, so a run can be split only
 * one way. The word-by-word checks look at most 40 words past each command word (a quoted
 * file name that starts within them may end anywhere; its end is looked up, not scanned).
 */

const { clip, redact, stripHidden } = require('./redact');

// Non-ASCII characters are built from their code points, so this file stays ASCII.
const cp = (n) => String.fromCodePoint(n);
const APOS = "'";
// Currency signs: dollar, euro, pound, yen, rupee, rouble, won, shekel, lira, peso, dong.
const MONEY_SIGNS = [0x24, 0x20ac, 0xa3, 0xa5, 0x20b9, 0x20bd, 0x20a9, 0x20aa, 0x20ba, 0x20b1, 0x20ab].map(cp);
const MONEY = `[${MONEY_SIGNS.join('')}]`;

const SCREEN_MAX = 20000;
const L = '\\p{L}\\p{N}';
const B = `(?<![${L}_])`; // start of a word
const E = `(?![${L}_])`; // end of a word
const SEP = `[^${L}]+`; // anything between two words (never a letter or digit)
const OPT = `(?:${SEP})?`; // an optional separator
const WORD = `[${L}]+`; // a word (only letters and digits)
const upTo = (n) => `(?:${SEP}${WORD}){0,${n}}?${SEP}`; // up to n words in between
const any = (list) => `(?:${list.join('|')})`;

const DESTROY_VERBS = any([
  'delet(?:e|es|ed|ing|ion)',
  'drop(?:s|ped|ping)?',
  'truncat(?:e|es|ed|ing)',
  'wip(?:e|es|ed|ing)',
  'purg(?:e|es|ed|ing)',
  'overwrit(?:e|es|ing|ten)',
  'eras(?:e|es|ed|ing)',
  'destroy(?:s|ed|ing)?',
  'nuk(?:e|es|ed|ing)',
]);
const DATA_NOUNS = any([
  'data', 'tables?', 'databases?', 'db', 'records?', 'rows', 'columns?', 'schemas?', 'collections?',
  'branch(?:es)?', 'history', 'production', 'prod', 'backups?', 'users', 'accounts', 'buckets?',
  'volumes?', 'repo(?:s|sitory|sitories)?', 'commits', 'indexes', 'keyspaces?',
]);
const FILE_NOUNS = any(['files?', 'folders?', 'director(?:y|ies)', 'documents?']);
const FILE_VERBS = any(['delet(?:e|es|ed|ing)', 'remov(?:e|es|ed|ing)', 'wip(?:e|es|ed|ing)', 'purg(?:e|es|ed|ing)', 'overwrit(?:e|es|ing|ten)', 'eras(?:e|es|ed|ing)', 'destroy(?:s|ed|ing)?']);
const STRONG_NOUNS = any(['databases?', 'db', 'production', 'prod', 'backups?', 'users', 'accounts', 'history', 'branch(?:es)?', 'records', 'tables?']);
const REMOTE = any(['main', 'master', 'origin', 'remote', 'production', 'prod', 'upstream', 'github', 'gitlab', 'bitbucket', 'trunk', 'live', 'staging']);
const PEOPLE = any(['users', 'customers', 'people', 'subscribers', 'members', 'clients', 'patients', 'students', 'employees']);
const PERSON = any(['users?', 'customers?', 'clients?', 'subscribers?', 'members?', 'patients?', 'employees?', 'students?', 'people', 'buyers?', 'visitors?']);
// "the published API" in the code sense: a module's public interface, not the act of
// publishing. Only "published", followed by one of these nouns and used to describe
// something ("in the published API", "of its published interface"), is left out of the
// screen; publish, publishes, publishing, unpublish and every other "published" count.
const API_NOUNS = any(['apis?', 'interfaces?', 'surface', 'signatures?', 'contracts?', 'types', 'methods?', 'functions?', 'exports?']);
const DESCRIBING = `${B}(?:in|of|from|with|by|than|like|for)${SEP}(?:the|its|our|their|this|that|your|my)${SEP}`;
// The closed word lists below are plain words (no pattern syntax), exported as LISTS, so
// the table in templates/formats.md can list them exactly and a test can compare the
// two. A word list becomes a pattern with wordList(): its words, as alternatives;
// a word of several words matches with any separator between them.
const wordList = (list) => any(list.map((w) => w.split(' ').join(SEP)));
const NUMERAL_LIST = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty',
  'ninety', 'hundred', 'hundreds', 'thousand', 'thousands', 'million', 'millions', 'billion', 'billions', 'dozen',
];
// Amounts in words: "ten dollars", "a few bucks", "two hundred and fifty euros".
const NUMBER_WORD_LIST = ['a', 'an', ...NUMERAL_LIST, 'few', 'several', 'couple', 'some'];
const NUMBER_WORDS = wordList(NUMBER_WORD_LIST);
// The words that may follow a currency code or a dollar prefix (USD one hundred, USD
// several hundred, GBP a few, US$ one hundred), with an optional a or an before them.
const AFTER_CODE_LIST = [...NUMERAL_LIST, 'few', 'several', 'couple'];
const AFTER_CODE = wordList(AFTER_CODE_LIST);
// Double quotes: the straight one and the curly ones (left, right, low, reversed) and the
// angle quotes, which normalisation leaves as they are.
const DQ_CURLY = [0x201c, 0x201d, 0x201e, 0x201f, 0xab, 0xbb].map(cp).join('');
const DQ = `["${DQ_CURLY}]`;
// Currency codes (ISO 4217 and a few coins) and currency names, after a number or a
// number word. Codes that are also everyday words (all, top, try, cup, pen, mad, bob,
// cop, ron, php) are left out.
const CURRENCY_CODES = [
  'usd', 'eur', 'gbp', 'cad', 'aud', 'nzd', 'chf', 'jpy', 'cny', 'rmb', 'inr', 'hkd', 'sgd', 'sek', 'nok', 'dkk', 'pln', 'czk',
  'huf', 'rub', 'brl', 'mxn', 'zar', 'krw', 'ils', 'aed', 'sar', 'thb', 'idr', 'myr', 'vnd', 'ngn', 'egp', 'pkr', 'ars', 'clp',
  'uah', 'bgn', 'isk', 'twd', 'kes', 'btc', 'eth', 'usdc', 'usdt',
];
const CURRENCY_NAMES = [
  'dollar', 'dollars', 'bucks', 'euro', 'euros', 'pound', 'pounds', 'quid', 'cent', 'cents', 'pence', 'yen', 'yuan', 'renminbi',
  'rupee', 'rupees', 'franc', 'francs', 'zloty', 'zlotys', 'zloties', 'zlote', 'zlotych', 'krona', 'kronor', 'kronur', 'krone',
  'kroner', 'koruna', 'koruny', 'korun', 'forint', 'forints', 'ruble', 'rubles', 'rouble', 'roubles', 'lira', 'liras', 'lire',
  'peso', 'pesos', 'shekel', 'shekels', 'dirham', 'dirhams', 'riyal', 'riyals', 'rial', 'rials', 'baht', 'ringgit', 'ringgits',
  'rupiah', 'rupiahs', 'naira', 'nairas', 'hryvnia', 'hryvnias', 'reais', 'bitcoin', 'bitcoins',
];
const CURRENCY_WORDS = wordList([...CURRENCY_NAMES, ...CURRENCY_CODES]);
// A currency code before a number (USD 500, CAD500); eth is left out (eth0 is a network
// interface).
const CODE_BEFORE_LIST = CURRENCY_CODES.filter((c) => c !== 'eth');
const CODE_BEFORE = wordList(CODE_BEFORE_LIST);
// The letters before a dollar sign that name a dollar (US$, USD$, AU$, CA$...), before or
// after the amount.
const DOLLAR_PREFIXES = ['us', 'usd', 'au', 'aud', 'ca', 'cad', 'nz', 'nzd', 'hk', 'hkd', 'sg', 'sgd', 'nt', 'mx'];
const DOLLAR_PREFIX = any(DOLLAR_PREFIXES);
// Currency signs after a number (100$, 15 and the euro sign): a subset of MONEY.
const SIGNS_AFTER = [0x24, 0x20ac, 0xa3, 0xa5, 0x20b9, 0x20bd, 0x20a9].map(cp);
// An amount in digits: a number with separators (1,000.50), or a leading decimal point
// (.50). Never preceded by a letter, a digit, an underscore, a dot or a comma.
const AMOUNT = `(?<![${L}_.,])(?:\\d+(?:[.,]\\d+)*|[.,]\\d+)`;
// The pronouns and other people-words after email (email them, email everyone).
const EMAIL_PRONOUNS = [
  'him', 'her', 'them', 'me', 'us', 'you', 'it', 'yourself', 'yourselves', 'myself', 'ourselves', 'himself', 'herself', 'themselves',
  'everyone', 'everybody', 'someone', 'somebody', 'anyone', 'anybody', 'people', 'others', 'both', 'all', 'each other', 'one another',
  'whoever', 'whomever',
];
// email, also with I or l (or a look-alike of either) as either of its last two letters
// (emaiI, emaII, EMAII): readings are lower case, and every I or l look-alike in the
// look-alike table reads as i or l.
const EMAIL_WORD = 'e-?ma[il][il]';
// The sites a post goes on (post on Reddit, posting to Hacker News).
const SOCIAL_SITES = [
  'social', 'twitter', 'x', 'linkedin', 'reddit', 'hacker news', 'facebook', 'instagram', 'pinterest', 'mastodon', 'bluesky',
  'threads', 'tiktok', 'youtube', 'discord', 'slack', 'forum', 'blog', 'product hunt', 'tumblr', 'weibo', 'snapchat', 'vk',
  'whatsapp', 'telegram', 'wechat', 'medium', 'quora', 'truth social', 'lemmy', 'pixelfed', 'flickr', 'nextdoor', 'stack overflow',
];


const GROUPS = [
  {
    id: 'destroy',
    floor: 'Deleting or overwriting data, history, files or branches; anything that cannot be undone',
    table: 'Deleting or overwriting',
    phrases: [
      `${DESTROY_VERBS}${upTo(4)}${DATA_NOUNS}`,
      `${DATA_NOUNS}${upTo(3)}${DESTROY_VERBS}`,
      `${FILE_VERBS}${upTo(4)}${FILE_NOUNS}`,
      `remov(?:e|es|ed|ing)${upTo(3)}${STRONG_NOUNS}`,
      // rm, del, Remove-Item, delete, remove or overwrite followed by a file name or a path
      // is read word by word (fileScan, below)
      `reset${SEP}(?:hard|keep)`,
      `rm${SEP}(?:rf|fr|r|f)`,
      'rimraf',
      `remove-item${SEP}(?:recurse|force)`,
      `rewrit(?:e|es|ing|ten)${upTo(2)}history`,
      `history${SEP}rewrite`,
      `force${OPT}push(?:es|ed|ing)?`,
      `push(?:es|ed|ing)?${SEP}(?:f|force(?:${SEP}with${SEP}lease)?)`,
      `git${SEP}clean${SEP}[a-z]*f[a-z]*`,
      `git${SEP}branch${SEP}d`,
      `discard${upTo(2)}(?:changes|work|edits|commits)`,
      // SQL
      `delete${SEP}from`,
      `truncate${SEP}(?:table|only)`,
      // TRUNCATE and a table name, quoted or not, at the end of the statement (with or
      // without a semicolon, or with CASCADE and the like after it)
      // The first character of a dotted name may be a dot (.orders); a leading $ is
      // not matched (it is not in the class; a known gap listed in formats.md).
      { raw: `(?<![${L}_])truncate ["'\`\\[]?[${L}_.][${L}_.$]*["'\`\\]]?(?= ?(?:[;,?!.)]|$|cascade|restart|continue))` },
      // a double-quoted name that holds spaces or a doubled quote (TRUNCATE "order items";,
      // TRUNCATE "a""b";), straight or curly quotes, of any length: a character inside is
      // either not a quote or one of a pair of quotes, so the name splits only one way
      { raw: `(?<![${L}_])truncate ${DQ}(?:[^"${DQ_CURLY}]|${DQ}${DQ})+${DQ}(?= ?(?:[;,?!.)]|$|cascade|restart|continue))` },
      `drop${SEP}(?:table|database|schema|index|view|column|collection|keyspace)s?`,
      `alter${SEP}table${upTo(3)}drop`,
      // infrastructure
      `kubectl${upTo(4)}(?:delete|drain)`,
      `(?:terraform|tofu|pulumi|cdk)${upTo(3)}destroy`,
      `helm${upTo(3)}(?:uninstall|delete)`,
      'irreversibl[ey]',
      `(?:cannot|can${APOS}t|can${SEP}not)${SEP}be${SEP}undone`,
      `permanent(?:ly)?${SEP}(?:delet|remov|eras)[${L}]*`,
    ],
  },
  {
    id: 'ship',
    floor: 'Pushing, deploying, publishing, releasing; sending anything off this machine',
    table: 'Pushing, deploying, publishing, sending',
    phrases: [
      // git push, also with options before push (git -C <dir> push, git -c key=value push)
      `git${upTo(8)}push(?:es|ed|ing)?`,
      `push(?:es|ed|ing)?${upTo(3)}(?:origin|upstream)`,
      `push(?:es|ed|ing)?${upTo(4)}(?:to|into|onto)${SEP}(?:(?:the|a|an|our|my|your|their|that|this)${SEP})?${REMOTE}`,
      `push(?:es|ed|ing)?${SEP}(?:it|this|these|them|everything|now|up|the${SEP}changes|the${SEP}commits?|the${SEP}branch|my${SEP}changes|our${SEP}changes)`,
      `push(?:es|ed|ing)?(?=[^${L}]*$)`,
      `merg(?:e|es|ed|ing)${upTo(4)}(?:to|into|onto)${SEP}(?:the${SEP})?(?:main|master|trunk|production|prod|release)`,
      `merg(?:e|es|ed|ing)${SEP}(?:the${SEP}|this${SEP}|my${SEP}|our${SEP})?(?:pr|prs|pull${SEP}requests?|mr|merge${SEP}requests?)`,
      '(?:re)?deploy(?:s|ed|ing|ment|ments)?',
      '(?:un)?publish(?:es|ing)?',
      `(?:un)?published(?!${SEP}${API_NOUNS}${E})`,
      `(?<!${DESCRIBING})(?:un)?published(?=${SEP}${API_NOUNS}${E})`,
      `cut${SEP}(?:a${SEP}|an${SEP}|the${SEP})?(?:new${SEP})?release`,
      `release${SEP}(?:it|this|that|them)`,
      `release${SEP}to`,
      `new${SEP}release`,
      `releas(?:e|ing)${SEP}v?\\d`,
      `tag${SEP}(?:a${SEP}|the${SEP})?release`,
      `ship${SEP}(?:a${SEP}|the${SEP})?release`,
      `go(?:es|ing)?${SEP}live`,
      `went${SEP}live`,
      `ship(?:s|ped|ping)?${upTo(3)}(?:to|into)${SEP}(?:production|prod|users|customers|the${SEP}store|the${SEP}app${SEP}store)`,
      `ship${SEP}(?:it|this)`,
      `(?:production|prod)${SEP}migrations?`,
      `(?:production|prod)${upTo(2)}migrat[${L}]*`,
      `migrat[${L}]*${upTo(3)}(?:production|prod)`,
      // infrastructure
      `kubectl${upTo(4)}(?:apply|rollout|replace|patch|scale|create)`,
      `(?:terraform|tofu)${upTo(3)}apply`,
      `pulumi${upTo(2)}up`,
      `helm${upTo(3)}(?:install|upgrade|rollback)`,
      // roll out; release the package, the app or a version
      `roll(?:s|ed|ing)?${OPT}out`,
      `releas(?:e|es|ing)${SEP}(?:(?:the|a|an|our|this|that|my|its|their|new|next)${SEP}){0,2}(?:packages?|apps?|application|versions?)`,
      // send a message, report, email or file to someone; send anything to @handle
      `send(?:s|ing)?${upTo(3)}(?:messages?|reports?|e-?mails?|files?)${upTo(4)}to`,
      { raw: `(?<![${L}_])send(?:s|ing)?(?:${SEP}${WORD}){0,6}?${SEP}to ?@(?=[${L}_])` },
      // upload ... to; email a person (a name is read with its letter case, below)
      `upload(?:s|ed|ing)?${upTo(4)}to`,
      `${EMAIL_WORD}(?:s|ed|ing)?${SEP}${wordList(EMAIL_PRONOUNS)}`,
      // an address: a local part of 1 to 64 characters, then @ and a letter, a digit or the
      // [ of a bracketed domain (alice@[192.0.2.1], alice@[IPv6:2001:db8::1])
      { raw: `(?<![${L}_])${EMAIL_WORD}(?:s|ed|ing)?(?: to)? [^\\s@]{1,64}@[${L}\\[]` },
      // an address whose quoted local part holds spaces or backslash escapes ("alice
      // smith"@example.com, "alice\" smith"@example.com), 1 to 64 characters
      { raw: `(?<![${L}_])${EMAIL_WORD}(?:s|ed|ing)?(?: to)? ${DQ}(?:[^"@\\\\${DQ_CURLY}]|\\\\.){1,64}${DQ}@[${L}\\[]` },
      `docker${upTo(3)}push`,
      `vercel${SEP}prod`,
      'dns',
      'nameservers?',
      `send(?:s|ing)?${upTo(3)}(?:e-?mails?|newsletters?|sms|text${SEP}messages?|push${SEP}notifications?|notifications?|invites?|invitations?)`,
      `e-?mail(?:s|ing)?${SEP}(?:the${SEP}|all${SEP}|our${SEP}|every${SEP})?(?:users|customers|subscribers|list|clients|everyone|people)`,
      `mass${SEP}e-?mails?`,
      `e-?mail${SEP}blasts?`,
      'newsletters?',
      `post(?:s|ed|ing)?${upTo(3)}(?:on|to)${SEP}(?:a${SEP}|the${SEP}|our${SEP}|my${SEP})?${wordList(SOCIAL_SITES)}`,
      'tweet(?:s|ed|ing)?',
      `social${SEP}media${SEP}posts?`,
      `notify${SEP}(?:all${SEP}|the${SEP}|our${SEP})?(?:users|customers|subscribers)`,
      `make${SEP}(?:it|this|the${SEP}repo(?:sitory)?|the${SEP}project)${SEP}public`,
      `open${OPT}sourc(?:e|ing)${SEP}(?:it|this|the)`,
      `upload(?:s|ed|ing)?${upTo(3)}to${SEP}(?:the${SEP})?(?:production|prod|s3|cloud|cdn|ftp)`,
    ],
  },
  {
    id: 'spend',
    floor: 'Spending at or above the limit; signups, purchases, paid plans',
    table: 'Spending',
    phrases: [
      // a currency sign next to a number ($30, $ 30, US$30, USD$500, 30EUR sign forms)
      // (also a sign before a decimal point: $.50)
      { raw: `(?<![${L}_$])${MONEY} ?[.,]?\\d` },
      // a dollar prefix (US$) before a number, a decimal point (US$.50, US$ .50) or a
      // number word (US$ one hundred)
      { raw: `(?<![${L}_])${DOLLAR_PREFIX}\\$ ?[.,]?\\d` },
      `${DOLLAR_PREFIX}\\$${OPT}(?:(?:a|an)${SEP})?${AFTER_CODE}`,
      // a number (or a leading decimal point: .50) and a sign after it, glued or after one
      // space, with or without a dollar prefix (100$, .50$, 15 and the euro sign, 100US$)
      { raw: `${AMOUNT} ?(?:${DOLLAR_PREFIX} ?)?[${SIGNS_AFTER.join('')}]` },
      // a currency code before a number (USD 500, USD .50) or a number or quantity word
      // (USD one hundred, USD several hundred, GBP a few), or a number and a code or name
      // (500 CAD, .50 USD, .50 dollars)
      `${CODE_BEFORE}${OPT}\\d+(?:[.,]\\d+)*`,
      `${CODE_BEFORE}${SEP}(?:(?:a|an)${SEP})?${AFTER_CODE}`,
      { raw: `${AMOUNT}${OPT}(?:k${SEP}|m${SEP})?${CURRENCY_WORDS}${E}` },
      `${NUMBER_WORDS}(?:${SEP}(?:${NUMBER_WORDS}|and)){0,4}${SEP}${CURRENCY_WORDS}`,
      'bucks',
      'fees?',
      `(?:monthly|annual|yearly|weekly)${SEP}(?:prices?|pricing|charges?|costs?|plans?|subscriptions?|billing|rates?)`,
      `what${SEP}(?:we|they|you|i|to)${SEP}charge`,
      `what${SEP}should${SEP}(?:we|i|you|they)${SEP}charge`,
      // our price or prices, a price to a number, our rates, raising or doubling prices
      `our${SEP}(?:prices?|rates)`,
      `prices?${SEP}to${SEP}(?:\\d+|${NUMBER_WORDS}${E})`,
      `(?:rais(?:e|es|ed|ing)|increas(?:e|es|ed|ing)|lower(?:s|ed|ing)?|doubl(?:e|es|ed|ing))${SEP}(?:(?:the|our|their|its|all|my)${SEP})?(?:prices?|rates)`,
      // rent a server
      `rent(?:s|ed|ing)?${SEP}(?:(?:a|an|the|another|one|two|more|some)${SEP})?(?:${WORD}${SEP})?servers?`,
      `how${SEP}much${SEP}(?:to|we|they|you|should${SEP}we|do${SEP}we)${SEP}charge`,
      `charg(?:e|es|ed|ing)${SEP}per`,
      `costs?${SEP}to${SEP}(?:the${SEP}|our${SEP})?${PERSON}`,
      `${PERSON}${SEP}(?:pay|pays|paying|will${SEP}pay|would${SEP}pay|are${SEP}charged|get${SEP}charged)`,
      'purchas(?:e|es|ed|ing)',
      'buy(?:s|ing)?',
      'bought',
      `sign(?:s|ing)?${OPT}up${SEP}(?:for|to|with|at)`,
      `signups?${SEP}(?:for|to|with|at)`,
      `creat(?:e|es|ing)${SEP}(?:a${SEP}|an${SEP})?(?:new${SEP})?account${SEP}(?:on|with|at)`,
      `register${SEP}(?:a${SEP}|the${SEP})?(?:domain|account)`,
      `paid${SEP}(?:plans?|tiers?|accounts?|versions?|subscriptions?|services?|api|seats?|add${OPT}ons?)`,
      `upgrad(?:e|es|ed|ing)${upTo(2)}(?:plan|tier|subscription|account)`,
      `upgrad(?:e|es|ed|ing)${SEP}to${SEP}(?:a${SEP}|the${SEP})?(?:pro|premium|team|business|enterprise|paid|plus)`,
      'billing',
      'billed',
      `bill${SEP}(?:the${SEP})?(?:customers?|users?|cards?)`,
      `charg(?:e|es|ed|ing)(?:${SEP}(?:the|a|an|our|their|my|each|every))?${SEP}(?:cards?|customers?|users?|accounts?|clients?|credit${SEP}cards?|them|people|subscribers)`,
      'refund(?:s|ed|ing)?',
      'subscriptions?',
      `subscrib(?:e|es|ed|ing)${SEP}to${SEP}(?:a${SEP}|the${SEP})?(?:paid|pro|premium|plan|service)`,
      `credit${SEP}cards?`,
      'invoic(?:e|es|ed|ing)',
      `pay(?:ing)?${SEP}for`,
      `pay${SEP}(?:the|a|an)${SEP}(?:bill|invoice|fee|vendor)`,
      `spen(?:d|ds|ding|t)${upTo(2)}(?:money|budget|credits|cash|funds|${CURRENCY_WORDS})`,
      `api${SEP}credits`,
      `top${SEP}up`,
      `costs?${SEP}money`,
    ],
  },
  {
    id: 'secrets',
    floor: 'Credentials, keys, tokens, passwords, secrets',
    table: 'Credentials and secrets',
    phrases: [
      'secrets?',
      'passwords?',
      'passwd',
      'passphrases?',
      'passkeys?',
      'credentials?',
      'creds',
      `api${OPT}keys?`,
      'apikeys?',
      'api_keys?',
      `(?:access|refresh|auth|authentication|authorization|bearer|session|login|csrf|jwt|api|oauth|personal${SEP}access|github|gitlab|npm|pypi|slack|discord|bot|deploy|service|security|id)${SEP}tokens?`,
      `(?:session|auth|authentication|login)${SEP}cookies?`,
      `(?:private|ssh|signing|encryption|gpg|pgp|master|root)${SEP}keys?`,
      // JWT (not passport-jwt, the library), .npmrc, npm login, a signing certificate
      `(?<!passport${SEP})jwts?`,
      { raw: `(?<![${L}_])\\.?npmrc(?![${L}_])` },
      `npm${SEP}login`,
      `signing${SEP}cert(?:ificate)?s?`,
      { raw: `(?<![${L}_])\\.ssh(?![${L}_])` },
      'id_(?:rsa|dsa|ecdsa|ed25519)(?:\\.pub)?',
      'authorized_keys',
      'keychain',
      'keystore',
      'keyring',
      { raw: `(?<![${L}_.])\\.env(?:\\.[A-Za-z0-9_-]+)?(?![${L}_])` },
      `rotat(?:e|es|ed|ing)${SEP}(?:the${SEP})?keys?`,
      `(?:recovery|backup|2fa|mfa|otp|totp)${SEP}(?:codes?|seeds?)`,
      `seed${SEP}phrases?`,
    ],
  },
  {
    id: 'money-legal',
    floor: 'Payments, pricing, positioning, legal or compliance',
    table: 'Payments, pricing, legal, compliance',
    phrases: [
      'payments?',
      'paywalls?',
      'stripe',
      'paypal',
      `checkout${SEP}(?:page|flow|session)`,
      'pricing',
      `pric(?:e|es)${SEP}chang(?:e|es|ed|ing)`,
      `chang(?:e|es|ed|ing)${SEP}(?:the${SEP}|our${SEP})?pric(?:e|es|ing)`,
      `(?:rais|lower)(?:e|es|ed|ing)?${SEP}(?:the${SEP}|our${SEP})?prices?`,
      `prices?${SEP}(?:points?|tiers?|plans?|page)`,
      `how${SEP}much${SEP}to${SEP}charge`,
      'discounts?',
      'coupons?',
      `promo${SEP}codes?`,
      'positioning',
      'taglines?',
      `value${SEP}prop(?:osition)?s?`,
      'legal(?:ly)?',
      'lawyers?',
      'attorneys?',
      'lawsuits?',
      'liabilit(?:y|ies)',
      'trademarks?',
      'copyrights?',
      'patents?',
      'ndas?',
      `non${OPT}disclosure`,
      `(?:sign|signs|signed|signing|accept|accepts|accepted|accepting|agree|agrees|agreed|agreeing|countersign(?:s|ed|ing)?)${upTo(4)}(?:contracts?|agreements?|terms|ndas?|msas?|sows?|dpas?|offers?|leases?|deals?)`,
      // adopting or changing to a license by name
      `(?:adopt(?:s|ed|ing)?|switch(?:es|ed|ing)?${SEP}to|chang(?:e|es|ed|ing)${SEP}to|relicens(?:e|es|ed|ing)${SEP}(?:to|under|as))${SEP}(?:(?:the|a|an)${SEP})?(?:mit|apache|gpl|agpl|lgpl|bsd|mpl|isc|eupl|epl|unlicense)`,
      `licen[cs]e${SEP}terms`,
      `terms${SEP}of${SEP}(?:the${SEP})?licen[cs]e`,
      `licen[cs]e${SEP}chang(?:e|es|ed|ing)`,
      `chang(?:e|es|ed|ing)${SEP}(?:the${SEP}|our${SEP})?licen[cs]e`,
      `the${SEP}licen[cs]e`,
      `open${OPT}source${SEP}licen[cs]es?`,
      `(?:mit|apache|gpl|agpl|lgpl|bsd|mpl|isc|bsl|sspl|eupl|epl|unlicense|cc${OPT}by)(?:${SEP}v?\\d+(?:\\.\\d+)*)?${SEP}(?:licen[cs]es?|terms)`,
      're-?licen[cs](?:e|es|ed|ing)',
      'licen[cs]ing',
      `licen[cs]e${SEP}(?:to|from|under)`,
      'a?gpl(?:v?\\d)?',
      'copyleft',
      'complian(?:ce|t)',
      'regulat(?:ion|ions|ory)',
      `terms${SEP}of${SEP}(?:service|use)`,
      `terms${SEP}and${SEP}conditions`,
      'eula',
      'privacy',
      'gdpr',
      'ccpa',
      'cpra',
      'hipaa',
      'coppa',
      'ferpa',
      `pci(?:${OPT}dss)?`,
      `soc${OPT}2`,
      'consent',
      `cookie${SEP}(?:banners?|consent|policy|notice)`,
      'tax(?:es)?',
      'vat',
      'dmca',
      'indemnif[\\p{L}]*',
    ],
  },
  {
    id: 'people-data',
    floor: 'Personal or sensitive data about real people',
    table: 'Personal data',
    phrases: [
      `personal${SEP}(?:data|information|info|details)`,
      `personally${SEP}identifiable`,
      'pii',
      `users?(?:${APOS}s?)?${SEP}data`,
      `customers?(?:${APOS}s?)?${SEP}(?:data|records|information|info|details|e-?mails?|lists?)`,
      `user${SEP}records`,
      `(?:e-?mail${SEP}address(?:es)?|e-?mails|phone${SEP}numbers?|addresses|names)${SEP}(?:of|for|from)${SEP}(?:the${SEP}|our${SEP}|all${SEP}|real${SEP})?${PEOPLE}`,
      `${PEOPLE}(?:${APOS})?${SEP}(?:e-?mails?|e-?mail${SEP}address(?:es)?|phone${SEP}numbers?|home${SEP}address(?:es)?|names|locations?)`,
      `user${SEP}e-?mails`,
      `phone${SEP}numbers`,
      `home${SEP}address(?:es)?`,
      `dates?${SEP}of${SEP}birth`,
      `birth${OPT}dates?`,
      'dob',
      `social${SEP}security`,
      'ssns?',
      `passports?(?!${SEP}(?:js|local|jwt|strateg(?:y|ies)|middleware|session|google|github|oauth\\d*)${E})`,
      `driver${APOS}?s?${SEP}licen[cs]es?`,
      `national${SEP}id`,
      // health: "health check", "health endpoint" and the like are code, not people
      `health(?!${SEP}(?:checks?|checking|endpoints?|probes?|status|route|routes|monitor(?:s|ing)?|bar|points?|pings?)${E})`,
      'medical',
      'clinical',
      'patients?',
      'diagnos(?:is|es|ed|e)',
      'prescriptions?',
      `biometric[${L}]*`,
      // full names, salaries, fingerprints
      `full${SEP}names?`,
      'salar(?:y|ies)',
      'fingerprints?',
      `sensitive${SEP}(?:data|information|info)`,
      `real${SEP}(?:names|people)`,
      `(?:(?:export|dump|download|sell|send|leak|transfer|upload|hand${SEP}over)(?:s|ed|ing)?|shar(?:e|es|ed|ing))${upTo(3)}(?:users|customers|subscribers|members|clients|patients|employees|students|people|records|contacts|profiles)`,
      `(?:user|customer|member|subscriber|client|patient|employee|student)${SEP}(?:records|lists?|database|db|details|profiles|accounts|contacts)`,
      `ip${SEP}address(?:es)?`,
      'geolocation',
      `location${SEP}data`,
    ],
  },
];

// The two floor items only the agent can judge.
const MODEL_ONLY = ['Going against a rule in CLAUDE.md', 'Changing what users see, get or are promised'];

function compile(p) {
  if (typeof p === 'object') return new RegExp(p.raw, 'iu');
  return new RegExp(`${B}(?:${p})${E}`, 'iu');
}

const COMPILED = GROUPS.map((g) => ({ id: g.id, floor: g.floor, res: g.phrases.map(compile) }));

// ------------------------------------------------------------------ word-by-word checks

// How far past a command word the word-by-word checks look.
const SCAN_WORDS = 40;
// A command word and its risky subcommands, with any number of options (and the values
// options take) between them: git -c a=b -C dir push, kubectl --context x apply.
const SUBCOMMANDS = [
  { tool: 'git', subs: ['push'], group: 'ship' },
  { tool: 'kubectl', subs: ['apply', 'rollout', 'replace', 'patch', 'scale', 'create'], group: 'ship' },
  { tool: 'kubectl', subs: ['delete', 'drain'], group: 'destroy' },
  { tool: 'helm', subs: ['install', 'upgrade', 'rollback'], group: 'ship' },
  { tool: 'helm', subs: ['uninstall', 'delete'], group: 'destroy' },
];
// A word trimmed by index of the characters keep() rejects, at both ends (a pattern
// anchored at the end would rescan a long run of them from every position).
function trimBy(w, keepHead, keepTail) {
  let a = 0;
  let b = w.length;
  while (a < b && !keepHead(w[a])) a++;
  while (b > a && !keepTail(w[b - 1])) b--;
  return w.slice(a, b);
}
const bareChar = (c) => (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-';
// The word without anything but a-z, 0-9 and - at its ends.
const bare = (w) => trimBy(w, bareChar, bareChar);

// The words of a normalised text (single spaces), each with where it starts.
function wordsOf(t) {
  const out = [];
  let at = 0;
  for (const w of t.split(' ')) {
    out.push({ w, at, bare: bare(w) });
    at += w.length + 1;
  }
  return out;
}

// A command word, then (within 40 words) only options, a word starting with -, and the
// value each may take, then one of its risky subcommands.
function optionScan(words, il) {
  // il: the either-i-or-l reading. Tool and subcommand names are then matched with i
  // and l folded together, so a command word spelled with capital-I look-alikes still
  // matches whichever of its I's stand for i or l.
  const eq = il ? (a, b) => foldIL(a) === foldIL(b) : (a, b) => a === b;
  for (let i = 0; i < words.length; i++) {
    const tools = SUBCOMMANDS.filter((s) => eq(s.tool, words[i].bare));
    if (!tools.length) continue;
    let value = false;
    for (let j = i + 1; j < words.length && j <= i + SCAN_WORDS; j++) {
      const c = words[j].bare;
      const hit = tools.find((s) => s.subs.some((x) => eq(x, c)));
      if (hit) return { index: words[i].at, term: `${hit.tool} ${c}`, group: hit.group };
      // A word that ends in a backslash is an escaped space (--kubeconfig a\ b\ c);
      // the unquoted option value runs on into the next word, so the scan does not stop.
      // A quoted value (no trailing backslash) ends the value, a known gap.
      const escapedSpace = words[j].w.endsWith('\\');
      if (c.startsWith('-')) {
        value = !c.includes('=') || escapedSpace;
        continue;
      }
      if (value) {
        value = escapedSpace;
        continue;
      }
      break;
    }
  }
  return null;
}

// rm, del, Remove-Item, delete, remove or overwrite followed by a file name or a path.
// A word is file-like when it holds a slash, a backslash or a tilde, a dot followed by
// a letter or digit (a name with an extension), or is a well-known file name without one.
const KNOWN_FILES = new Set([
  'readme', 'license', 'licence', 'makefile', 'gnumakefile', 'dockerfile', 'containerfile', 'changelog', 'copying', 'contributing',
  'codeowners', 'procfile', 'gemfile', 'rakefile', 'jenkinsfile', 'vagrantfile', 'brewfile', 'pipfile', 'justfile', 'podfile',
  'gulpfile', 'gruntfile',
]);
// The rm command and its kin: the first word after their options is their target.
const RM_COMMANDS = new Set(['rm', 'rmdir', 'unlink', 'shred', 'remove-item']);
// Every verb whose target is checked: the rm kin, del and erase, and delete, remove and
// overwrite in their forms (up to three words may sit between them and the file).
const FILE_VERB_WORDS = new Set([
  ...RM_COMMANDS, 'del', 'erase', 'erases', 'erased', 'erasing', 'trash', 'delete', 'deletes', 'deleted', 'deleting', 'remove',
  'removes', 'removed', 'removing', 'overwrite', 'overwrites', 'overwriting', 'overwritten', 'overwrote',
]);
// The words after rm that are code, not files ("rm the helper" asks, "the rm helper"
// does not: only the word right after rm counts).
const CODE_NOUNS = new Set([
  'helper', 'helpers', 'function', 'functions', 'variable', 'variables', 'var', 'vars', 'line', 'lines', 'comment', 'comments',
  'import', 'imports', 'test', 'tests', 'log', 'logs', 'method', 'methods', 'class', 'classes', 'field', 'fields', 'param', 'params',
  'parameter', 'parameters', 'argument', 'arguments', 'arg', 'args', 'prop', 'props', 'property', 'properties', 'type', 'types',
  'interface', 'interfaces', 'call', 'calls', 'statement', 'statements', 'block', 'blocks', 'loop', 'loops', 'condition',
  'conditions', 'check', 'checks', 'case', 'cases', 'branches', 'todo', 'todos', 'warning', 'warnings', 'print', 'prints', 'debug',
  'whitespace', 'space', 'spaces', 'semicolon', 'semicolons', 'bracket', 'brackets', 'brace', 'braces', 'duplicate', 'duplicates',
  'code',
]);
// The quote marks that open and close a quoted file name, by kind: double quotes
// (straight, curly, low, reversed, angle), single quotes (straight, curly, low, reversed;
// readings turn the curly ones into a straight one) and the backtick. A name opened by one
// kind is closed only by the same kind.
// i and l fold together in the either-i-or-l readings. A capital-I look-alike that
// touches a letter reads as i OR l, so a word matches a word-by-word verb if it does under
// either reading (UNIINK is unlink: one I reads as l, the next as i). The folded sets are
// used only in the either readings, which exist only when the text holds such a glyph, so
// the fold only ever widens matches, as the screen leans wide.
const foldIL = (s) => s.replace(/[ilIL]/g, 'l');
const FILE_VERB_WORDS_IL = new Set([...FILE_VERB_WORDS].map(foldIL));
const RM_COMMANDS_IL = new Set([...RM_COMMANDS].map(foldIL));
const KNOWN_FILES_IL = new Set([...KNOWN_FILES].map(foldIL));
const CODE_NOUNS_IL = new Set([...CODE_NOUNS].map(foldIL));
// ONE shared fold for the either-i-or-l reading: ilKey(il) normalises a
// probe word, and each closed list has a <set>_IL copy folded the same way. EVERY
// word-by-word check and EVERY closed-list membership below (file verbs, rm kin, known
// files, code nouns, curl uploads) goes through these helpers, so no check can silently
// skip the fold and let a look-alike-spelled word slip past.
const ilKey = (il) => (il ? foldIL : (x) => x);
const ilHasFileVerb = (w, il) => (il ? FILE_VERB_WORDS_IL : FILE_VERB_WORDS).has(ilKey(il)(w));
const ilHasRm = (w, il) => (il ? RM_COMMANDS_IL : RM_COMMANDS).has(ilKey(il)(w));
const ilHasKnownFile = (w, il) => (il ? KNOWN_FILES_IL : KNOWN_FILES).has(ilKey(il)(w));
const ilHasCodeNoun = (w, il) => (il ? CODE_NOUNS_IL : CODE_NOUNS).has(ilKey(il)(w));
const SQ_CURLY = [0x2018, 0x2019, 0x201a, 0x201b].map(cp).join('');
const QUOTE_KINDS = [`"${DQ_CURLY}`, `'${SQ_CURLY}`, '`'];
const quoteKind = (c) => (c === undefined ? -1 : QUOTE_KINDS.findIndex((k) => k.includes(c)));
// A word without the quote marks (straight and curly), brackets and punctuation around it.
const HEAD_MARKS = `"'\`([{<${DQ_CURLY}${SQ_CURLY}`;
const TAIL_MARKS = `?!.,;:)]}>"'\`${DQ_CURLY}${SQ_CURLY}`;
const wordCore = (w) => trimBy(w, (c) => !HEAD_MARKS.includes(c), (c) => !TAIL_MARKS.includes(c));
// A word holds a file-name character: a slash, a backslash or a tilde, or a dot followed by
// a letter or digit (a name with an extension).
const fileChars = (w) => /[/\\~]/.test(w) || /\.[\p{L}\p{N}]/u.test(w);
const fileLike = (w, il) => {
  const c = wordCore(w);
  return fileChars(c) || ilHasKnownFile(c, il);
};
const SENTENCE_END = /[?!.;]$/;
// A word that ends in a quote mark of kind k, with only punctuation after it.
function closesKind(w, k) {
  const t = trimBy(w, () => true, (c) => !'?!.,;:)]}>'.includes(c));
  return t.length > 0 && QUOTE_KINDS[k].includes(t[t.length - 1]);
}
// PowerShell's colon form of a path parameter (-Path:README, -LiteralPath:Makefile): the
// part after the colon is the target.
const PS_PATH_PARAMS = ['path', 'literalpath', 'lp', 'pspath'];
const PS_PATH = new RegExp(`^-(?:${PS_PATH_PARAMS.join('|')}):`);
/*
 * The quoted names of a text, found once in one pass from the end: for each word and each
 * quote kind, the first word at or after it that closes that kind (closeAt), and how many
 * words before each word are file-like (fileBefore). A word that opens a quote and does
 * not close it starts a quoted name that runs to the first word after it that closes the
 * same kind, of any length (up to the screen's 20,000 characters); the name is file-like
 * when any of its words is (a file-name character, or a known file name: the joined name
 * and its words hold the same characters). Each lookup takes the same time whatever the
 * length.
 */
function quoteIndex(words, il) {
  const n = words.length;
  const closeAt = QUOTE_KINDS.map(() => new Int32Array(n + 1).fill(-1));
  for (let j = n - 1; j >= 0; j--) {
    for (let k = 0; k < QUOTE_KINDS.length; k++) closeAt[k][j] = closesKind(words[j].w, k) ? j : closeAt[k][j + 1];
  }
  const fileBefore = new Int32Array(n + 1);
  for (let j = 0; j < n; j++) fileBefore[j + 1] = fileBefore[j] + (fileLike(words[j].w, il) ? 1 : 0);
  return { closeAt, fileBefore };
}
// The index of the last word of the quoted name that word j (read as head) opens, or -1.
function quotedEnd(head, j, qi) {
  const k = quoteKind(head[0]);
  if (k < 0 || closesKind(head.slice(1), k)) return -1;
  return qi.closeAt[k][j + 1];
}
function fileScan(words, il) {
  // il: the either-i-or-l reading. The verb is matched with i and l folded together,
  // so a file verb spelled with capital-I look-alikes (UNIINK for unlink) is still caught
  // whichever of its I's stand for i or l.
  // verb / rm / known-file / code-noun matching all fold through the shared ilHas* helpers.
  let qi = null;
  for (let i = 0; i < words.length; i++) {
    const verb = wordCore(words[i].w).split(/[\\/]/).pop();
    if (!ilHasFileVerb(verb, il) || SENTENCE_END.test(words[i].w)) continue;
    if (!qi) qi = quoteIndex(words, il);
    const rmLike = ilHasRm(verb, il);
    const hit = (c) => ({ index: words[i].at, term: `${verb} ${c}`, group: 'destroy' });
    let seen = 0;
    let operand = false;
    for (let j = i + 1; j < words.length && j <= i + SCAN_WORDS; j++) {
      let w = words[j].w;
      const ps = PS_PATH.exec(w);
      if (ps) {
        // -Path:<x> takes <x> as its target; -Path: alone, the next word.
        w = w.slice(ps[0].length);
        if (!w) continue;
      }
      const c = wordCore(w);
      if (!c) continue;
      // After the end-of-options marker, whatever follows is a file.
      if (operand) return hit(`-- ${c}`);
      // A quoted word is a name, never an option ("-draft.txt").
      const quoted = quoteKind(w[0]) >= 0;
      if (!quoted && !ps && c === '--') {
        operand = true;
        continue;
      }
      if (!quoted && !ps && c.startsWith('-')) continue;
      const end = quotedEnd(w, j, qi);
      if (end > j) {
        // A quoted name of several words is one operand (joined only for the match).
        if (rmLike || fileLike(w, il) || qi.fileBefore[end + 1] - qi.fileBefore[j + 1] > 0) return hit(wordCore([w, ...words.slice(j + 1, end + 1).map((x) => x.w)].join(' ')));
        seen++;
        if (seen > 3 || /[?!.;:,]$/.test(words[end].w)) break;
        j = end;
        continue;
      }
      if (fileLike(w, il)) return hit(c);
      if (rmLike && !ilHasCodeNoun(c, il)) return hit(c);
      seen++;
      if (rmLike || seen > 3 || /[?!.;:,]$/.test(w)) break;
    }
  }
  return null;
}

// curl sending a file: -T (read lower-cased as -t), --upload-file, or -d, --data...,
// -F, --form with an @file value.
const CURL_DATA = /^(?:-d|--data(?:-binary|-raw|-urlencode|-ascii)?|-f|--form(?:-string)?)$/;
const CURL_DATA_AT = /^(?:-d|--data(?:-binary|-raw|-urlencode|-ascii)?|-f|--form(?:-string)?)=?["']?(?:[^=\s]*=)?@/;
const AT_VALUE = /^["']?(?:[^=\s]*=)?@/;
const CURL_T = /^-t/;
const CURL_UPLOAD = /^--upload-file(?:=|$)/;
// The either-i-or-l fold reaches curl too. foldRe folds i/l in a
// pattern's literal words the same way ilKey folds the probe word, so the command gate and
// every send flag match a look-alike spelling (curl, --upload-file, --data-binary, ...).
const foldRe = (re) => new RegExp(foldIL(re.source), re.flags);
const CURL_T_IL = foldRe(CURL_T);
const CURL_UPLOAD_IL = foldRe(CURL_UPLOAD);
const CURL_DATA_IL = foldRe(CURL_DATA);
const CURL_DATA_AT_IL = foldRe(CURL_DATA_AT);
const AT_VALUE_IL = foldRe(AT_VALUE);
function curlScan(words, il) {
  const k = ilKey(il);
  const tRe = il ? CURL_T_IL : CURL_T;
  const upRe = il ? CURL_UPLOAD_IL : CURL_UPLOAD;
  const dataRe = il ? CURL_DATA_IL : CURL_DATA;
  const dataAtRe = il ? CURL_DATA_AT_IL : CURL_DATA_AT;
  const atRe = il ? AT_VALUE_IL : AT_VALUE;
  for (let i = 0; i < words.length; i++) {
    if (k(words[i].bare) !== 'curl') continue;
    for (let j = i + 1; j < words.length && j <= i + SCAN_WORDS; j++) {
      const w = trimBy(words[j].w, () => true, (c) => !'?,;!)'.includes(c));
      const wk = k(w);
      const sends = tRe.test(wk) || upRe.test(wk) || dataAtRe.test(wk) || (dataRe.test(wk) && j + 1 < words.length && atRe.test(k(words[j + 1].w)));
      if (sends) return { index: words[i].at, term: `curl ${w}`, group: 'ship' };
    }
  }
  return null;
}

// email followed by a capitalised name or an @handle ("Email Alice about it", "Email
// ALICE", "Email AJ", "Email O'Connor", "Email X about it"), read on the text with its
// letter case kept: a capital and at least one more letter, a capital, an apostrophe and a
// letter, or a capital alone as a one-letter word (except I, as in "the email I send").
// The last two letters of email may each be I, i, L or l (EmaII, EMAII). email followed by
// a pronoun is in the phrase list.
const EMAIL_PERSON = new RegExp(`(?<![${L}_])[Ee]-?[Mm][Aa][IiLl][IiLl](?:[Ss]|[Ee][Dd]|[Ii][Nn][Gg])? (?:\\p{Lu}${APOS}?\\p{L}[${L}]*|(?!I(?![${L}_]))\\p{Lu}(?![${L}_])|@[${L}_]+)`, 'u');

// ------------------------------------------------------------------ normalisation

// Look-alike letters, mapped to the Latin letter they imitate (both cases; the text is
// lower-cased afterwards). Cyrillic, Greek, Armenian, NKo, Latin small capitals, the
// Latin dental click and a few Latin letters with a stroke that do not decompose. Each
// character is listed under one letter only.
const LOOKALIKES = {
  a: [0x0430, 0x0410, 0x03b1, 0x0391, 0x0251, 0x1d00],
  b: [0x0412, 0x0432, 0x0392, 0x03b2, 0x0299, 0x0180, 0x0253, 0x044c, 0x042c],
  c: [0x0441, 0x0421, 0x03f2, 0x03f9, 0x1d04],
  d: [0x0501, 0x0500, 0x0257, 0x0111, 0x1d05],
  e: [0x0435, 0x0415, 0x03b5, 0x0395, 0x0454, 0x1d07],
  f: [0x0192, 0xa730],
  g: [0x0261, 0x0262, 0x0581],
  h: [0x04bb, 0x04ba, 0x041d, 0x043d, 0x0397, 0x0570, 0x029c, 0x0127],
  i: [0x0456, 0x0406, 0x03b9, 0x0399, 0x0131, 0x04c0, 0x0269, 0x026a],
  j: [0x0458, 0x0408, 0x03f3, 0x0237, 0x1d0a],
  k: [0x043a, 0x041a, 0x03ba, 0x039a, 0x1d0b],
  l: [0x04cf, 0x01c0, 0x0142, 0x029f],
  m: [0x043c, 0x041c, 0x039c, 0x1d0d],
  n: [0x043f, 0x03b7, 0x039d, 0x0578, 0x0274],
  o: [0x043e, 0x041e, 0x03bf, 0x039f, 0x0585, 0x00f8, 0x1d0f, 0x03c3, 0x07c0],
  p: [0x0440, 0x0420, 0x03c1, 0x03a1, 0x1d18],
  q: [0x051b, 0x051a],
  r: [0x0433, 0x0280],
  s: [0x0455, 0x0405, 0xa731],
  t: [0x0442, 0x0422, 0x03c4, 0x03a4, 0x1d1b, 0x0167],
  u: [0x03c5, 0x057d, 0x1d1c, 0x03bc],
  v: [0x03bd, 0x1d20],
  w: [0x0461, 0x051d, 0x051c, 0x03c9, 0x1d21],
  x: [0x0445, 0x0425, 0x03c7, 0x03a7],
  y: [0x0443, 0x0423, 0x04af, 0x04ae, 0x03b3, 0x03a5, 0x028f],
  z: [0x0396, 0x1d22],
};
const LOOKALIKE_MAP = new Map();
for (const [latin, list] of Object.entries(LOOKALIKES)) for (const n of list) if (!LOOKALIKE_MAP.has(cp(n))) LOOKALIKE_MAP.set(cp(n), latin);
const LOOKALIKE_RE = new RegExp(`[${[...LOOKALIKE_MAP.keys()].join('')}]`, 'gu');
// The look-alikes that NFKD would change into a letter the table does not list (U+03F2
// and U+03F9, the lunate sigmas, become a final sigma and a capital sigma): mapped before
// NFKD as well as after it.
const PRE_NFKD_RE = new RegExp(`[${[...LOOKALIKE_MAP.keys()].filter((c) => c.normalize('NFKD') !== c).join('')}]`, 'gu');
// Capital-I look-alikes (I itself, Greek and Cyrillic capital I, the capital palochka)
// inside a lower-case word, or opening one: read as l in the second reading of the text,
// so "depIoy" is deploy, while API, CI and UI stay as they are.
const I_CHARS = `I${[0x0399, 0x0406, 0x04c0].map(cp).join('')}`;
const CAPITAL_I = new RegExp(`(?<=\\p{Ll})[${I_CHARS}]|(?<![\\p{L}\\p{N}])[${I_CHARS}](?=\\p{Ll})`, 'gu');
// Capital-I look-alikes that touch another letter, in a word of any case (DEPIOY, PUBIISH,
// fuII, CIaude): in the either-i-or-l readings each one stands for i or l, each on its own
// (see eitherIL below). It is held as a private-use character while the reading is built
// (lower-casing would make it an i) and is a capital I in the finished reading, where
// nothing else is upper case. That character (U+E000), where the text already holds it,
// is changed to U+E001 first, so only these can become the capital I.
const I_TOUCHING = new RegExp(`(?<=\\p{L})[${I_CHARS}]|[${I_CHARS}](?=\\p{L})`, 'gu');
const EITHER_HELD = cp(0xe000);
const EITHER_HELD_RE = new RegExp(EITHER_HELD, 'g');
// Apostrophe look-alikes, to a plain apostrophe.
const APOSTROPHES = new RegExp(`[${[0x2018, 0x2019, 0x201b, 0x02bc, 0x2032, 0xff07].map(cp).join('')}]`, 'gu');
// Invisible characters (GAPS): every default-ignorable code point (the soft hyphen,
// zero-width and direction marks, joiners, the byte-order mark, variation selectors, tag
// characters, and unassigned ones such as U+2065), every other format character (Cf), the
// control characters that are not white space (NUL and the like), and the blank fillers
// that are letters or symbols (Hangul fillers, the braille blank). MARKS: every combining
// mark, nonspacing, spacing or enclosing (accents, the combining grapheme joiner, the
// spacing vowel signs of Indic scripts).
const GAP_CHARS = `\\p{Default_Ignorable_Code_Point}\\p{Cf}\\u0000-\\u0008\\u000e-\\u001f\\u007f-\\u009f${[0x115f, 0x1160, 0x3164, 0xffa0, 0x2800, 0x180e].map(cp).join('')}`;
const GAPS = new RegExp(`[${GAP_CHARS}]`, 'gu');
const HAS_GAP = new RegExp(`[${GAP_CHARS}]`, 'u');
const MARKS = /\p{M}/gu;
const INVISIBLE = new RegExp(`[${GAP_CHARS}\\p{M}]`, 'gu');

/*
 * One normalised reading of a text. opts.split: invisible characters become spaces
 * instead of nothing (marks are always removed); opts.capitalL: capital-I look-alikes in
 * a lower-case word become l; opts.keepCase: no lower-casing, and a look-alike capital
 * becomes a Latin capital; opts.eitherIL: every capital-I look-alike that touches another
 * letter becomes a capital I, and the rest is lower case (the either-i-or-l reading; not
 * with keepCase).
 */
function normalizeWith(text, opts) {
  const o = opts || {};
  const strip = o.split ? (s) => s.replace(GAPS, ' ').replace(MARKS, '') : (s) => s.replace(INVISIBLE, '');
  const toLatin = (ch) => {
    const latin = LOOKALIKE_MAP.get(ch);
    return o.keepCase && ch !== ch.toLowerCase() ? latin.toUpperCase() : latin;
  };
  let raw = String(text === undefined || text === null ? '' : text);
  if (o.eitherIL) raw = raw.replace(EITHER_HELD_RE, cp(0xe001));
  raw = raw.replace(PRE_NFKD_RE, toLatin);
  let t = strip(raw.normalize('NFKD')).replace(APOSTROPHES, "'");
  if (o.eitherIL) t = t.replace(I_TOUCHING, EITHER_HELD);
  else if (o.capitalL) t = t.replace(CAPITAL_I, 'l');
  t = t.replace(LOOKALIKE_RE, toLatin);
  if (!o.keepCase) t = t.toLowerCase();
  t = strip(t.normalize('NFKD')).normalize('NFKC').replace(/\s+/g, ' ');
  if (o.eitherIL) t = t.replace(EITHER_HELD_RE, 'I');
  return oneByte(t);
}

// The same text, stored one byte per character when every character fits (look-alikes
// mapped to Latin often leave a wide string behind): the patterns then run as they do on
// plain text, without being compiled a second time for wide strings.
function oneByte(t) {
  return /[^\x00-\xff]/.test(t) ? t : Buffer.from(t, 'latin1').toString('latin1');
}

// The main reading: invisible characters and marks removed, look-alikes mapped, lower case.
function normalizeForScreen(text) {
  return normalizeWith(text);
}

// Every reading the screen matches, without repeats: invisible characters removed or
// read as spaces, and capital-I look-alikes as i or as l. Ordinary text gives one or two.
function readings(text) {
  const out = [];
  for (const split of [false, true]) {
    for (const capitalL of [false, true]) {
      const t = normalizeWith(text, { split, capitalL });
      if (!out.includes(t)) out.push(t);
    }
  }
  return out;
}

// The either-i-or-l readings (invisible characters removed or read as spaces), only when
// the text holds a capital-I look-alike that touches another letter; otherwise none. They
// are matched against eitherIL copies of the phrase lists, so they can only add matches.
function eitherReadings(text) {
  const out = [];
  for (const split of [false, true]) {
    const t = normalizeWith(text, { split, eitherIL: true });
    if (t.includes('I') && !out.includes(t)) out.push(t);
  }
  return out;
}

/*
 * Capital I read as l inside words of any case, as an extra reading (the other readings
 * stay): in an either-i-or-l reading each capital I is one character that may be i or l,
 * so DEPIOY is deploy, PUBIISH publish and CREDENTIAI credential, whichever of their I's
 * stand for l. A copy of each pattern takes it so: every i or l the pattern spells (and
 * every character class that holds one) also takes a capital I. The reading is otherwise
 * lower case and the copy is matched with letter case kept, so a capital I matches only
 * where the pattern has an i or an l. The copy has the same shape as the pattern (one
 * character becomes a class of two), so it stays linear.
 */
const ESCAPE_LEN = /^\\(?:[pPu]\{[^}]*\}|u[0-9A-Fa-f]{4}|x[0-9A-Fa-f]{2}|c[A-Za-z]|[\s\S])/;
const QUANT = /^\{\d+(?:,\d*)?\}/;
const GROUP_OPEN = /^\(\?(?:<[=!]|[:=!])/;
const isIL = (c) => c === 'i' || c === 'l' || c === 'I' || c === 'L';
const coversIL = (lo, hi) => ['i', 'l', 'I', 'L'].some((c) => lo <= c && c <= hi);
function eitherIL(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const rest = c === '\\' || c === '(' || c === '{' ? src.slice(i, i + 64) : '';
    if (c === '\\') {
      const e = ESCAPE_LEN.exec(rest)[0];
      out += e;
      i += e.length;
    } else if (c === '[') {
      let j = i + 1;
      const negated = src[j] === '^';
      if (negated) j++;
      let body = '';
      let il = false;
      while (j < src.length && src[j] !== ']') {
        if (src[j] === '\\') {
          const e = ESCAPE_LEN.exec(src.slice(j, j + 64))[0];
          body += e;
          j += e.length;
        } else if (src[j + 1] === '-' && j + 2 < src.length && src[j + 2] !== ']') {
          if (coversIL(src[j], src[j + 2])) il = true;
          body += src.slice(j, j + 3);
          j += 3;
        } else {
          if (isIL(src[j])) il = true;
          body += /[A-Z]/.test(src[j]) ? src[j].toLowerCase() : src[j];
          j++;
        }
      }
      // The capital I goes first, so a - at the end of the class stays a plain -.
      out += negated ? `[^${body}]` : `[${il ? 'I' : ''}${body}]`;
      i = j + 1;
    } else if (c === '(' && GROUP_OPEN.test(rest)) {
      const g = GROUP_OPEN.exec(rest)[0];
      out += g;
      i += g.length;
    } else if (c === '{' && QUANT.test(rest)) {
      const q = QUANT.exec(rest)[0];
      out += q;
      i += q.length;
    } else if (isIL(c)) {
      out += `[${c.toLowerCase()}I]`;
      i++;
    } else {
      out += /[A-Z]/.test(c) ? c.toLowerCase() : c;
      i++;
    }
  }
  return out;
}
// A phrase compiled as compile() does, in its either-i-or-l copy (letter case kept).
function compileEither(p) {
  if (typeof p === 'object') return new RegExp(eitherIL(p.raw), 'u');
  return new RegExp(`${B}(?:${eitherIL(p)})${E}`, 'u');
}
const EITHER_COMPILED = GROUPS.map((g) => ({ id: g.id, floor: g.floor, res: g.phrases.map(compileEither) }));

/*
 * A zero-width gap read either way. Removing every invisible character joins the words
 * it splits ("pri<ZWSP>vate" is private) but also the words it separates ("private<ZWSP>
 * key" is privatekey); reading each as a space does the opposite. So when a text holds an
 * invisible character, its readings with them removed are also matched against a second
 * copy of the phrase list in which the separator between the words of a phrase may be
 * empty ("privatekey" is then private key). Only the separators written into a phrase are
 * loosened; the "up to n words in between" runs (upTo) keep their separators, so a word
 * still splits only one way and every loosened pattern stays linear.
 */
const LSEP = `[^${L}]*`;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const UPTO_SRC = new RegExp(`(${escapeRe(`(?:${SEP}${WORD}){0,`)}\\d+${escapeRe(`}?${SEP}`)})`);
function loosen(src) {
  return src.split(UPTO_SRC).map((part, k) => (k % 2 ? part : part.split(SEP).join(LSEP))).join('');
}
// The loosened copy of a phrase list: only the phrases that change, compiled as compile()
// does (the raw patterns, which read characters rather than words, are left out).
// (with = compileEither: its either-i-or-l copy.)
const looseList = (phrases, withFn) => phrases.filter((p) => typeof p === 'string' && loosen(p) !== p).map((p) => (withFn || compile)(loosen(p)));
const LOOSE_COMPILED = GROUPS.map((g) => ({ id: g.id, res: looseList(g.phrases) }));
const LOOSE_EITHER = GROUPS.map((g) => ({ id: g.id, res: looseList(g.phrases, compileEither) }));
// The readings with invisible characters removed (capital-I look-alikes as i and as l),
// only when the text holds one; otherwise none.
function joinedReadings(text) {
  if (!HAS_GAP.test(text)) return [];
  const a = normalizeWith(text);
  const b = normalizeWith(text, { capitalL: true });
  return a === b ? [a] : [a, b];
}
// The either-i-or-l reading with invisible characters removed, under the same condition.
function joinedEither(text) {
  if (!HAS_GAP.test(text)) return [];
  const t = normalizeWith(text, { eitherIL: true });
  return t.includes('I') ? [t] : [];
}

// The readings with letter case kept: invisible characters removed or read as spaces,
// and capital-I look-alikes as they are or as l (as in "EmaiI Alice").
function casedReadings(text) {
  const out = [];
  for (const split of [false, true]) {
    for (const capitalL of [false, true]) {
      const t = normalizeWith(text, { keepCase: true, split, capitalL });
      if (!out.includes(t)) out.push(t);
    }
  }
  return out;
}

// A matched phrase as printed: redacted, its white space collapsed, redacted again, cut to
// 60 characters (clip), lower case. No control character is turned into a space first: a
// reading holds none (normalisation removes them or reads them as spaces), and redact
// removes any before its rules run.
function tidyTerm(s) {
  return clip(String(s), 60).toLowerCase();
}

/*
 * The phrase printed for a match (screen, loosening, modelOnly). A match is read from a
 * normalised reading of the text, and a reading can show a secret the redactor never sees
 * in the text itself: an invisible character read as a space ends a secret early, and a
 * match can start or end inside a secret value (email alice@e). So when redacting the
 * whole text changes nothing in it, the matched phrase is printed (tidyTerm); otherwise
 * the phrase is looked up again, the same way, in the redacted copy of the text, and that
 * match is printed, or a fixed note when the redacted copy holds no such phrase. A
 * printed phrase therefore shows only text that the redacted copy still holds.
 */
const NOT_SHOWN = 'a phrase that touches redacted text';
function printed(raw, term, again) {
  const r = redact(raw);
  if (r === stripHidden(raw)) return tidyTerm(term);
  const t = again(r);
  return t === null ? NOT_SHOWN : tidyTerm(t);
}

// The earliest match in one reading, or null: the phrase list, then the word-by-word
// checks; want(group) picks the groups looked at. An either-i-or-l reading (either) is
// matched against the either-i-or-l copy of the phrase list, and its words are read with
// each capital I as l.
function matchIn(t, want, either) {
  let best = null;
  const take = (index, term, group) => {
    if (want(group) && (!best || index < best.index)) best = { index, term, group };
  };
  for (const g of either ? EITHER_COMPILED : COMPILED) {
    if (!want(g.id)) continue;
    for (const re of g.res) {
      const m = re.exec(t);
      if (m) take(m.index, m[0], g.id);
    }
  }
  const words = wordsOf(either ? t.replace(/I/g, 'l') : t);
  for (const scan of [optionScan, curlScan, fileScan]) {
    const h = scan(words, either);
    if (h) take(h.index, h.term, h.group);
  }
  return best;
}

// The first match, as matched (not yet printed), or null; only = a group id limits the
// search to that group. The earliest match in the main reading wins, so the reported
// phrase is the first risky one; the other readings are matched only when the main one
// passes; the either-i-or-l readings come after the others.
function detect(raw, only, views, eitherViews) {
  const want = (g) => !only || g === only;
  for (const t of views || readings(raw)) {
    const best = matchIn(t, want);
    if (best) return best;
  }
  for (const t of eitherViews || eitherReadings(raw)) {
    const best = matchIn(t, want, true);
    if (best) return best;
  }
  const joined = joinedReadings(raw).map((t) => [t, LOOSE_COMPILED]).concat(joinedEither(raw).map((t) => [t, LOOSE_EITHER]));
  for (const [t, list] of joined) {
    let best = null;
    for (const g of list) {
      if (!want(g.id)) continue;
      for (const re of g.res) {
        const m = re.exec(t);
        if (m && (!best || m.index < best.index)) best = { index: m.index, term: m[0], group: g.id };
      }
    }
    if (best) return best;
  }
  if (want('ship')) {
    for (const t of casedReadings(raw)) {
      const m = EMAIL_PERSON.exec(t);
      if (m) return { index: m.index, term: m[0], group: 'ship' };
    }
  }
  return null;
}

// Hidden characters: a default-ignorable code point (zero-width space, joiner, non-joiner,
// word joiner, soft hyphen, byte-order mark, bidi controls and the rest) or a control
// character other than tab, line feed and carriage return, directly between two letters
// or digits. When nothing else matches, a text that holds one asks in its own group
// (hidden-characters): a phrase cut up by them may be read neither with them removed nor
// with them as spaces (r<ZWSP>m<ZWSP>README.md). The run of them is matched once from the
// letter before it, so the check is linear. Combining marks count as part of the letter
// they sit on: the check runs on the text with every combining mark that is not itself
// default-ignorable dropped first, so an accent on either side of the gap
// (r<ZWSP><U+0301>m, r<U+0301><ZWSP>m) cannot hide it. (Variation selectors and the
// combining grapheme joiner are marks that are also default-ignorable: they stay, and
// count as hidden characters.)
const HIDDEN_BETWEEN = new RegExp(`(?<=[${L}])[\\p{Default_Ignorable_Code_Point}\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f-\\x9f]+(?=[${L}])`, 'u');
const VISIBLE_MARKS = /(?!\p{Default_Ignorable_Code_Point})\p{M}/gu;
const hiddenBetween = (raw) => HIDDEN_BETWEEN.test(raw.replace(VISIBLE_MARKS, ''));
const HIDDEN_TERM = 'an invisible or control character between letters';

function screen(text) {
  const raw = String(text === undefined || text === null ? '' : text);
  if (raw.length > SCREEN_MAX) return { ask: true, term: 'too long to screen', group: 'length' };
  const views = readings(raw);
  const eitherViews = eitherReadings(raw);
  if (views.concat(eitherViews).some((t) => t.length > SCREEN_MAX)) return { ask: true, term: 'too long to screen', group: 'length' };
  const hit = detect(raw, null, views, eitherViews);
  if (hit) {
    const again = (r) => {
      const h = detect(r, hit.group);
      return h ? h.term : null;
    };
    return { ask: true, term: printed(raw, hit.term, again), group: hit.group };
  }
  if (hiddenBetween(raw)) return { ask: true, term: HIDDEN_TERM, group: 'hidden-characters' };
  return { ask: false, term: null, group: null };
}

// ------------------------------------------------------------------ proposals

const LOOSENING = [
  `no${SEP}need${SEP}to${SEP}(?:ask|check|confirm|escalate)`,
  `without${SEP}(?:asking|checking|confirm(?:ing|ation)|approval|escalat(?:ing|ion)|permission)`,
  `(?:don${APOS}t|do${SEP}not|never|no${SEP}longer|stop|needn${APOS}t|need${SEP}not|doesn${APOS}t${SEP}need${SEP}to|does${SEP}not${SEP}need${SEP}to)${SEP}(?:bother${SEP})?(?:ask(?:ing)?|escalat(?:e|ing)|check(?:ing)?${SEP}with)`,
  `skip(?:s|ping)?${SEP}(?:the${SEP})?(?:asking|ask|question|escalation|confirmation|approval)`,
  `always${SEP}approve`,
  `auto${OPT}approv[${L}]*`,
  `approv(?:e|es|ed)${SEP}automatically`,
  `automatically${SEP}approv[${L}]*`,
  `(?:can|may|could|should|is${SEP}allowed${SEP}to|is${SEP}free${SEP}to|gets${SEP}to)${SEP}decide`,
  `decides?${SEP}(?:on${SEP}its${SEP}own|alone|by${SEP}itself|itself|without)`,
  `no${SEP}escalation`,
  `(?:never|don${APOS}t|do${SEP}not)${SEP}escalate`,
  `(?:can|may|is${SEP}allowed${SEP}to|is${SEP}free${SEP}to|is${SEP}ok${SEP}to|it${APOS}s${SEP}ok${SEP}to|is${SEP}fine${SEP}to|is${SEP}safe${SEP}to)(?:${SEP}${WORD}){0,2}?${SEP}(?:push|deploy|publish|release|merge|delete|drop|wipe|spend|buy|purchase|sign${SEP}up|charge|refund|share|send|e-?mail|disregard|ignore|override|change)`,
  `treat(?:s|ed)?${SEP}(?:it${SEP}|this${SEP}|them${SEP})?as${SEP}class${SEP}a`,
  `(?:is|are|counts?${SEP}as|becomes?|move${SEP}(?:it${SEP})?(?:in)?to)${SEP}class${SEP}a`,
  `go${SEP}ahead`,
  `pre${OPT}approved`,
  `approved${SEP}in${SEP}advance`,
  `(?:standing|blanket)${SEP}approval`,
  `no${SEP}(?:approval|confirmation|permission)${SEP}(?:is${SEP})?(?:needed|required)`,
];
const LOOSENING_RES = LOOSENING.map((p) => new RegExp(`${B}(?:${p})${E}`, 'iu'));
const LOOSENING_LOOSE = looseList(LOOSENING);
const LOOSENING_EITHER = LOOSENING.map(compileEither);
const LOOSENING_LOOSE_EITHER = looseList(LOOSENING, compileEither);

// The first loosening phrase, as matched, or null.
function looseningIn(raw) {
  const passes = readings(raw).map((t) => [t, LOOSENING_RES]);
  for (const t of eitherReadings(raw)) passes.push([t, LOOSENING_EITHER]);
  for (const t of joinedReadings(raw)) passes.push([t, LOOSENING_LOOSE]);
  for (const t of joinedEither(raw)) passes.push([t, LOOSENING_LOOSE_EITHER]);
  for (const [t, list] of passes) {
    for (const re of list) {
      const m = re.exec(t);
      if (m) return m[0];
    }
  }
  return null;
}

function loosening(text) {
  const raw = String(text === undefined || text === null ? '' : text).slice(0, SCREEN_MAX);
  const m = looseningIn(raw);
  return m === null ? null : printed(raw, m, looseningIn);
}

// The two model-only floor items, as phrases a proposal can be checked against. What
// users, customers or people see, get, receive, access or are shown, now or with will,
// can, should and the like, are or will be able to, are going to, or should be seeing;
// what the product, the app or a page (or pages) shows or displays, now, with a modal
// or with "is going to"; and a promise in any tense.
const MODAL = `(?:will|would|can|could|should|shall|may|might|must|do|does|did|won${APOS}t|can${APOS}t|cannot|don${APOS}t|doesn${APOS}t|wouldn${APOS}t|shouldn${APOS}t)`;
const SEE_GET = '(?:see|sees|saw|seeing|seen|get|gets|got|getting|receive|receives|received|receiving|expect|expects|expected|access|accesses|accessed|accessing)';
const SEEING = '(?:seeing|getting|receiving|accessing)';
// A word that may sit between the subject and the verb ("the product now displays").
const ADV = '(?:now|also|still|already|soon|currently|always|never|only|just)';
const GOING_TO = `(?:are|is|am|were|was)${SEP}going${SEP}to`;
const BE_SHOWN = '(?:shown|told|offered|promised|given|sent|displayed)';
const SHOWN_ON = '(?:product|app|application|site|website|page|homepage|ui|interface|service|dashboard|screen|store|storefront)';
const USERS_WHY = 'mentions what users see, get or are promised';
const MODEL_ONLY_PHRASES = [
  { why: 'mentions CLAUDE.md', re: `claude${OPT}md` },
  { why: USERS_WHY, re: `${PERSON}(?:${APOS}s?)?${SEP}(?:${MODAL}${SEP}(?:not${SEP})?(?:${SEE_GET}|be${SEP}${BE_SHOWN}|get${SEP}to${SEP}see|be${SEP}${SEEING})|${SEE_GET}|(?:are|were|is|was|get|got|have${SEP}been|has${SEP}been)${SEP}${BE_SHOWN})` },
  { why: USERS_WHY, re: `${PERSON}(?:${APOS}s?)?${SEP}(?:${MODAL}${SEP}(?:not${SEP})?be|are|is|am|were|was)${SEP}(?:not${SEP})?able${SEP}to${SEP}${SEE_GET}` },
  { why: USERS_WHY, re: `${PERSON}(?:${APOS}s?)?${SEP}${GOING_TO}${SEP}(?:${SEE_GET}|be${SEP}${BE_SHOWN})` },
  { why: USERS_WHY, re: `promis(?:e|es|ed|ing)${upTo(3)}${PERSON}` },
  { why: USERS_WHY, re: `${PERSON}${upTo(2)}promis(?:e|es|ed|ing)` },
  { why: USERS_WHY, re: 'promised' },
  { why: USERS_WHY, re: `(?:we|i|you|they|it|the${SEP}twin)${SEP}(?:${MODAL}${SEP})?(?:have${SEP}|has${SEP}|had${SEP})?promis(?:e|es|ing)` },
  { why: USERS_WHY, re: `(?:shown|show|shows|showing|display|displays|displayed|visible|presented|offered)${SEP}to${SEP}(?:the${SEP}|our${SEP}|all${SEP})?(?:${PERSON}|the${SEP}public)` },
  { why: USERS_WHY, re: `(?:the|our|this|its|their|a)${SEP}${SHOWN_ON}s?${SEP}(?:${ADV}${SEP})?(?:(?:${MODAL}|${GOING_TO})${SEP}(?:not${SEP})?(?:${ADV}${SEP})?)?(?:shows?|showed|shown|showing|displays?|displayed|displaying)` },
  { why: USERS_WHY, re: `(?:user|customer|client|public)${OPT}(?:facing|visible)` },
];
const MODEL_ONLY_RES = MODEL_ONLY_PHRASES.map((p) => ({ why: p.why, re: new RegExp(`${B}(?:${p.re})${E}`, 'iu') }));
// The same phrases with their separators loosened, for a text that holds an invisible
// character (see loosen above).
const MODEL_ONLY_LOOSE = MODEL_ONLY_PHRASES.filter((p) => loosen(p.re) !== p.re).map((p) => ({ why: p.why, re: compile(loosen(p.re)) }));
// The either-i-or-l copies (see eitherIL above), for the either-i-or-l readings.
const MODEL_ONLY_EITHER = MODEL_ONLY_PHRASES.map((p) => ({ why: p.why, re: compileEither(p.re) }));
const MODEL_ONLY_LOOSE_EITHER = MODEL_ONLY_PHRASES.filter((p) => loosen(p.re) !== p.re).map((p) => ({ why: p.why, re: compileEither(loosen(p.re)) }));

// The first model-only mention, as matched ({ term, why }), or null.
function modelOnlyIn(raw) {
  const passes = readings(raw).map((t) => [t, MODEL_ONLY_RES]);
  for (const t of eitherReadings(raw)) passes.push([t, MODEL_ONLY_EITHER]);
  for (const t of joinedReadings(raw)) passes.push([t, MODEL_ONLY_LOOSE]);
  for (const t of joinedEither(raw)) passes.push([t, MODEL_ONLY_LOOSE_EITHER]);
  for (const [t, list] of passes) {
    let best = null;
    for (const p of list) {
      const m = p.re.exec(t);
      if (m && (!best || m.index < best.index)) best = { index: m.index, term: m[0], why: p.why };
    }
    if (best) return { term: best.term, why: best.why };
  }
  return null;
}

function modelOnly(text) {
  const raw = String(text === undefined || text === null ? '' : text).slice(0, SCREEN_MAX);
  const hit = modelOnlyIn(raw);
  if (!hit) return null;
  const again = (r) => {
    const h = modelOnlyIn(r);
    return h ? h.term : null;
  };
  return { term: printed(raw, hit.term, again), why: hit.why };
}

// The closed lists the table in templates/formats.md names, exactly as the patterns use
// them (the table lists must equal these).
const LISTS = {
  fileVerbs: [...FILE_VERB_WORDS],
  rmCommands: [...RM_COMMANDS],
  knownFiles: [...KNOWN_FILES],
  quoteMarks: QUOTE_KINDS.join('').split(''),
  doubleQuotes: `"${DQ_CURLY}`.split(''),
  psPathParams: PS_PATH_PARAMS.map((p) => `-${p}:`),
  emailPronouns: EMAIL_PRONOUNS,
  socialSites: SOCIAL_SITES,
  signsBefore: MONEY_SIGNS,
  signsAfter: SIGNS_AFTER,
  dollarPrefixes: DOLLAR_PREFIXES.map((p) => `${p}$`),
  codesAfter: CURRENCY_CODES,
  codesBefore: CODE_BEFORE_LIST,
  currencyNames: CURRENCY_NAMES,
  numberWords: NUMBER_WORD_LIST,
  wordsAfterCode: AFTER_CODE_LIST,
};

module.exports = { GROUPS, MODEL_ONLY, SUBCOMMANDS, LISTS, screen, loosening, modelOnly, normalizeForScreen, normalizeWith, readings, SCREEN_MAX };
