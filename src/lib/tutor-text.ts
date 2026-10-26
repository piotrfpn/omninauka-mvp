/**
 * Safe HTML entity normalization and prompt-tag escaping utilities for AI Tutor.
 *
 * Security & rendering invariants:
 * - Decodes named, decimal (`&#39;`), and hexadecimal (`&#x27;`) HTML entities into
 *   plain Unicode characters for safe React text / ReactMarkdown rendering.
 * - Collapses repeated `&amp;` / `&#38;` / `&#x26;` prefixes in a single pass so that
 *   single-, double-, and triple-encoded entities (`&#x27;`, `&amp;#x27;`, `&amp;amp;#x27;`,
 *   `&amp;amp;lt;`) converge immediately and satisfy strict idempotency:
 *   `decodeTutorEntities(decodeTutorEntities(x)) === decodeTutorEntities(x)`.
 * - Never decodes NUL, C0/C1 control characters, or UTF-16 surrogate code points.
 * - Never introduces `dangerouslySetInnerHTML` or executable HTML.
 */

export const MAX_ENTITY_DECODE_PASSES = 2;

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  amp: '&',
  lt: '<',
  gt: '>',
  nbsp: '\u00A0',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  lsquo: '\u2018',
  rsquo: '\u2019',
  sbquo: '\u201A',
  ldquo: '\u201C',
  rdquo: '\u201D',
  bdquo: '\u201E',
  laquo: '\u00AB',
  raquo: '\u00BB',
  bull: '\u2022',
  middot: '\u00B7',
  times: '\u00D7',
  divide: '\u00F7',
  minus: '\u2212',
  plusmn: '\u00B1',
  le: '\u2264',
  ge: '\u2265',
  ne: '\u2260',
  equiv: '\u2261',
  approx: '\u2248',
  asymp: '\u2248',
  infin: '\u221E',
  radic: '\u221A',
  deg: '\u00B0',
  permil: '\u2030',
  sup2: '\u00B2',
  sup3: '\u00B3',
  frac12: '\u00BD',
  frac14: '\u00BC',
  frac34: '\u00BE',
  rarr: '\u2192',
  larr: '\u2190',
  harr: '\u2194',
  rArr: '\u21D2',
  lArr: '\u21D0',
  hArr: '\u21D4',
  alpha: '\u03B1',
  beta: '\u03B2',
  gamma: '\u03B3',
  delta: '\u03B4',
  Delta: '\u0394',
  pi: '\u03C0',
  Pi: '\u03A0',
  sigma: '\u03C3',
  Sigma: '\u03A3',
  omega: '\u03C9',
  Omega: '\u03A9',
  micro: '\u00B5',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  euro: '\u20AC',
  pound: '\u00A3',
  sect: '\u00A7',
};

const ENTITY_PATTERN =
  /&((?:amp;|#0*38;|#[xX]0*26;)*)(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,15}));/gi;

function isSafeDecodedCodePoint(cp: number): boolean {
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) return false;
  if (cp === 0x09 || cp === 0x0a || cp === 0x0d) return true;
  if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) return false;
  if (cp >= 0xd800 && cp <= 0xdfff) return false;
  return true;
}

function decodeEntitiesSinglePass(input: string): string {
  return input.replace(
    ENTITY_PATTERN,
    (match, ampChain: string, dec?: string, hex?: string, named?: string) => {
      if (dec !== undefined) {
        const cp = Number.parseInt(dec, 10);
        if (isSafeDecodedCodePoint(cp)) {
          return String.fromCodePoint(cp);
        }
        return ampChain ? `&${match.slice(1 + ampChain.length)}` : match;
      }
      if (hex !== undefined) {
        const cp = Number.parseInt(hex, 16);
        if (isSafeDecodedCodePoint(cp)) {
          return String.fromCodePoint(cp);
        }
        return ampChain ? `&${match.slice(1 + ampChain.length)}` : match;
      }
      if (named !== undefined) {
        if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, named)) {
          return NAMED_ENTITIES[named];
        }
        const lower = named.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower)) {
          return NAMED_ENTITIES[lower];
        }
        return ampChain ? `&${named};` : match;
      }
      return match;
    },
  );
}

/**
 * Decodes HTML character entities in AI Tutor text into their literal characters.
 * Idempotent: `decodeTutorEntities(decodeTutorEntities(x)) === decodeTutorEntities(x)`.
 */
export function decodeTutorEntities(
  input: string,
  maxPasses: number = MAX_ENTITY_DECODE_PASSES,
): string {
  if (typeof input !== 'string' || input.length === 0 || !input.includes('&')) {
    return typeof input === 'string' ? input : '';
  }

  const passes = Math.max(1, Math.min(maxPasses, MAX_ENTITY_DECODE_PASSES));
  let current = input;
  for (let pass = 0; pass < passes; pass++) {
    if (!current.includes('&')) break;
    const next = decodeEntitiesSinglePass(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Sandboxes text placed inside XML-style prompt delimiter tags
 * (`<trusted_lesson_material>`, `<student_question>`, etc.) by escaping only
 * tag-delimiter angle brackets (`<` and `>`), preserving natural apostrophes (`'`),
 * quotation marks (`"`), and ampersands (`&`).
 */
export function escapeForPromptTag(s: string): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
