/**
 * Fractional Indexing Utility
 *
 * Generates lexicographically sortable keys for ordering items in a list.
 * Uses base-62 encoding (digits 0-9, uppercase A-Z, lowercase a-z) to
 * produce compact, human-readable sort keys.
 *
 * Algorithm overview:
 * - A key consists of an "integer part" (first character) and a "fractional part"
 *   (remaining characters).
 * - The integer part uses the range A-Z a-z (52 values total), providing
 *   headroom for prepending/appending beyond the initial range.
 * - The fractional part uses the full base-62 character set (0-9 A-Z a-z),
 *   giving 62 possible values per position.
 * - To insert between two keys, the midpoint of the fractional parts is computed.
 *   When two adjacent fractional parts have no room between them, the fractional
 *   part is extended by one digit to create space.
 * - To prepend before the first key, the integer part is decremented.
 * - To append after the last key, the integer part is incremented.
 *
 * Based on the well-known fractional-indexing algorithm by David Greenspan.
 * Implemented without external dependencies for shared use by frontend and backend.
 *
 * This approach supports at least 1000+ consecutive insertions between any
 * two keys without issues, as the fractional part grows only logarithmically.
 *
 * Zero external dependencies. Deterministic and reproducible output.
 */

/**
 * Base-62 character set in lexicographic ASCII order: 0-9, A-Z, a-z.
 * This ordering ensures that standard string comparison (`<`, `>`) yields
 * the correct sort order for generated keys.
 */
const BASE_62_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BASE_62_DIGITS.length; // 62

/**
 * Lookup table: character -> numeric index in the base-62 digit set.
 */
const CHAR_TO_INDEX: Record<string, number> = {};
for (let i = 0; i < BASE; i++) {
  const ch = BASE_62_DIGITS[i] as string;
  CHAR_TO_INDEX[ch] = i;
}

// ── Integer part helpers ──────────────────────────────────────────────

/**
 * Validate that a character is a valid integer part (A-Z or a-z).
 */
function isValidIntegerPart(c: string): boolean {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

/**
 * Increment a single integer-part character: A -> B -> ... -> Z -> a -> b -> ... -> z.
 * Returns undefined on overflow (z has no successor).
 */
function incrementInteger(c: string): string | undefined {
  if (c === 'Z') return 'a';
  if (c === 'z') return undefined;
  return String.fromCharCode(c.charCodeAt(0) + 1);
}

/**
 * Decrement a single integer-part character: z -> y -> ... -> a -> Z -> ... -> A.
 * Returns undefined on underflow (A has no predecessor).
 */
function decrementInteger(c: string): string | undefined {
  if (c === 'a') return 'Z';
  if (c === 'A') return undefined;
  return String.fromCharCode(c.charCodeAt(0) - 1);
}

// ── Fractional part midpoint ──────────────────────────────────────────

/**
 * Compute the fractional-part midpoint between two digit strings.
 *
 * Both `a` and `b` are strings of base-62 digits representing the fractional
 * portion of a key. `a` must be lexicographically less than `b`.
 *
 * The algorithm works as follows:
 * 1. Scan from left to find the first position where the digits differ.
 * 2. If the gap at that position is > 1, return the prefix up to that position
 *    with the midpoint digit.
 * 3. If the gap is exactly 1, we keep the lower digit and recurse into the
 *    suffix — computing the midpoint between `a`'s remaining suffix and
 *    a "virtual max" (the conceptual upper bound for that slot).
 *
 * This produces the shortest possible key that fits between a and b.
 *
 * @param a - Lower fractional string (may be empty, meaning "all zeros")
 * @param b - Upper fractional string (may be empty, meaning "first digit past integer")
 */
function fractionalMidpoint(a: string, b: string | undefined): string {
  if (b !== undefined && a >= b) {
    throw new Error(
      `fractionalMidpoint: a must be < b, got a="${a}", b="${b}"`,
    );
  }

  if (a === b) {
    // Should not happen given the guard above, but defensive
    throw new Error('Cannot compute midpoint of identical fractional parts');
  }

  // If b is undefined, we're generating between a and "infinity" within the
  // same integer part. We find the midpoint between a's last digit and BASE.
  if (b === undefined) {
    // Find the last non-max digit in a, and increment it halfway to max.
    // This is equivalent to midpoint(a, "zzz...z") but produces a shorter key.
    const digits = fractionalDigits(a);

    // Find rightmost digit that is not max
    let i = digits.length - 1;
    while (i >= 0 && digits[i] === BASE - 1) {
      i--;
    }

    if (i < 0) {
      // All digits are max — extend by one position with a middle digit.
      return a + BASE_62_DIGITS[Math.floor(BASE / 2)];
    }

    // Replace digit at i with midpoint between digits[i] and BASE-1, trim after
    const digitAtI = digits[i] as number;
    const mid = Math.floor((digitAtI + (BASE - 1)) / 2);
    // If mid === digits[i], we need to go deeper
    if (mid === digitAtI) {
      return a.slice(0, i + 1) + BASE_62_DIGITS[Math.floor(BASE / 2)];
    }
    return a.slice(0, i) + BASE_62_DIGITS[mid];
  }

  // Both a and b are defined. Find midpoint between them.
  const aDigits = fractionalDigits(a);
  const bDigits = fractionalDigits(b);

  // Pad a with zeros to be at least as long as b
  while (aDigits.length < bDigits.length) {
    aDigits.push(0);
  }
  // Note: b is NOT padded — if a is longer than b, the extra digits in a
  // are already handled because a < b means b conceptually has trailing 0s
  // which would make the first differing position determine the result.

  // But actually, if a is longer, we need b to have the same length.
  // Since a < b, if b is shorter, then b with trailing zeros would still be > a
  // only if b's prefix is larger. Pad b similarly.
  while (bDigits.length < aDigits.length) {
    bDigits.push(0);
  }

  // Find the first position where digits differ
  let commonPrefixLen = 0;
  while (
    commonPrefixLen < aDigits.length &&
    aDigits[commonPrefixLen] === bDigits[commonPrefixLen]
  ) {
    commonPrefixLen++;
  }

  // At this point, aDigits[commonPrefixLen] < bDigits[commonPrefixLen]
  if (commonPrefixLen >= aDigits.length) {
    // a and b are the same (after padding). This shouldn't happen since a < b.
    throw new Error('Fractional parts are equal after padding');
  }

  const aDigit = aDigits[commonPrefixLen] as number;
  const bDigit = bDigits[commonPrefixLen] as number;
  const gap = bDigit - aDigit;

  if (gap > 1) {
    // There's room — pick the midpoint digit
    const midDigit = Math.floor((aDigit + bDigit) / 2);
    return digitString(aDigits, commonPrefixLen) + BASE_62_DIGITS[midDigit];
  }

  // gap === 1 — adjacent digits at this position.
  // Keep a's digit and find the midpoint of the remaining suffix.
  // Effectively: result = a[..commonPrefixLen] + aDigit + midpoint(aSuffix, "max")
  // Because we need a value > a and < b, and b is aDigit+1 followed by bSuffix,
  // any value with aDigit followed by something > aSuffix will work, up to
  // aDigit+1 followed by 0...0 (which is b's floor).

  // If b has suffix that is all zeros (or b has no suffix past this point),
  // we need to find midpoint between aSuffix and "max" at this integer level.
  // Otherwise, we need midpoint between aSuffix and bFloor.

  const aSuffix = a.slice(commonPrefixLen + 1);

  // Compute midpoint between aSuffix and undefined (meaning "all max")
  // This guarantees result is > aSuffix but still uses aDigit prefix,
  // so the result key < bDigit prefix.
  const midSuffix = fractionalMidpoint(aSuffix, undefined);
  return digitString(aDigits, commonPrefixLen) + BASE_62_DIGITS[aDigit] + midSuffix;
}

/**
 * Convert a fractional string to an array of digit indices.
 */
function fractionalDigits(s: string): number[] {
  const result: number[] = [];
  for (const c of s) {
    result.push(CHAR_TO_INDEX[c] as number);
  }
  return result;
}

/**
 * Convert the first `len` entries of a digit array back to a string.
 */
function digitString(digits: number[], len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += BASE_62_DIGITS[digits[i] as number];
  }
  return s;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate a sort key between two existing keys.
 *
 * - `generateKeyBetween(null, null)` returns `'a0'` (the default initial key)
 * - `generateKeyBetween(null, b)` returns a key strictly less than `b` (insert at start)
 * - `generateKeyBetween(a, null)` returns a key strictly greater than `a` (insert at end)
 * - `generateKeyBetween(a, b)` returns a key strictly between `a` and `b`
 *
 * @param a - The lower bound key (or null/undefined for no lower bound)
 * @param b - The upper bound key (or null/undefined for no upper bound)
 * @returns A new key that sorts between a and b
 *
 * @throws {Error} if `a >= b` when both are provided
 * @throws {Error} if either key has an invalid format
 */
export function generateKeyBetween(
  a: string | null | undefined,
  b: string | null | undefined,
): string {
  if (a != null && !isValidSortKey(a)) {
    throw new Error(`Invalid sort key: ${a}`);
  }
  if (b != null && !isValidSortKey(b)) {
    throw new Error(`Invalid sort key: ${b}`);
  }
  if (a != null && b != null && a >= b) {
    throw new Error(
      `First key must be strictly less than second key: ${a} >= ${b}`,
    );
  }

  // Both null -> return default key
  if (a == null && b == null) {
    return 'a0';
  }

  // ── Prepend: generate a key before b ──
  if (a == null) {
    const bKey = b as string;
    const intB = bKey[0] as string;
    const fracB = bKey.slice(1);

    // If the fractional part allows a midpoint between "0" and fracB,
    // stay in the same integer part.
    if (fracB !== '' && fracB > '0') {
      const mid = fractionalMidpoint('', fracB);
      return intB + mid;
    }

    // Otherwise, decrement the integer part and use a high fractional digit
    const prevInt = decrementInteger(intB);
    if (prevInt == null) {
      throw new Error('Cannot generate key before smallest possible key');
    }
    return prevInt + BASE_62_DIGITS[BASE - 1];
  }

  // ── Append: generate a key after a ──
  if (b == null) {
    const aKey = a as string;
    const intA = aKey[0] as string;
    const fracA = aKey.slice(1);

    // If fractional part is just '0', increment the integer part
    if (fracA === '0') {
      const nextInt = incrementInteger(intA);
      if (nextInt == null) {
        // At max integer, extend the fractional part
        return intA + fracA + BASE_62_DIGITS[Math.floor(BASE / 2)];
      }
      return nextInt + '0';
    }

    // Find midpoint between fracA and "infinity" (conceptual upper bound)
    const mid = fractionalMidpoint(fracA, undefined);
    if (mid > fracA) {
      return intA + mid;
    }

    // Shouldn't reach here, but extend as fallback
    return intA + fracA + BASE_62_DIGITS[Math.floor(BASE / 2)];
  }

  // ── Between: generate a key between a and b ──
  const aKey = a as string;
  const bKey = b as string;
  const intA = aKey[0] as string;
  const intB = bKey[0] as string;
  const fracA = aKey.slice(1);
  const fracB = bKey.slice(1);

  // Same integer part: find midpoint of fractional parts
  if (intA === intB) {
    const mid = fractionalMidpoint(fracA, fracB);
    return intA + mid;
  }

  // Different integer parts: check if there's an integer between them
  const nextInt = incrementInteger(intA);
  if (nextInt != null && nextInt < intB) {
    return nextInt + '0';
  }

  // Adjacent integers (e.g., 'a' and 'b'). Generate within a's integer
  // by finding a key between fracA and "infinity".
  const mid = fractionalMidpoint(fracA, undefined);
  return intA + mid;
}

/**
 * Generate N sort keys evenly distributed between two existing keys.
 *
 * Useful for bulk insertions (e.g., importing multiple issues at once).
 * The returned keys are in ascending order.
 *
 * Uses a divide-and-conquer strategy: first generate the middle key,
 * then recursively generate keys for the left and right halves.
 *
 * @param a - The key before the range (or null for start of list)
 * @param b - The key after the range (or null for end of list)
 * @param n - The number of keys to generate (must be >= 0)
 * @returns An array of N keys in ascending order, all strictly between a and b
 *
 * @throws {Error} if n < 0
 * @throws {Error} if a >= b when both are provided
 */
export function generateNKeysBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  n: number,
): string[] {
  if (n < 0) {
    throw new Error('n must be non-negative');
  }
  if (n === 0) {
    return [];
  }
  if (n === 1) {
    return [generateKeyBetween(a, b)];
  }

  // Divide-and-conquer: generate the middle key, then fill each half recursively.
  const mid = Math.floor(n / 2);
  const midKey = generateKeyBetween(a, b);

  const left = generateNKeysBetween(a, midKey, mid);
  const right = generateNKeysBetween(midKey, b, n - mid - 1);

  return [...left, midKey, ...right];
}

/**
 * Validate that a string is a valid sort key in the fractional indexing format.
 *
 * A valid key:
 * - Has at least 2 characters
 * - First character is the integer part: A-Z or a-z
 * - Remaining characters are the fractional part: 0-9, A-Z, or a-z (base-62)
 * - Does not end with '0' in the fractional part when there are multiple
 *   fractional digits (keys are normalized: trailing zeros are stripped,
 *   except for the mandatory first fractional digit)
 *
 * @param key - The string to validate
 * @returns true if the key has valid fractional indexing format
 */
export function isValidSortKey(key: string): boolean {
  if (typeof key !== 'string') {
    return false;
  }

  // Must have at least 2 characters (integer part + at least one fractional digit)
  if (key.length < 2) {
    return false;
  }

  // First character must be a valid integer part (A-Z or a-z)
  if (!isValidIntegerPart(key[0] as string)) {
    return false;
  }

  // Remaining characters must be valid base-62 digits
  for (let i = 1; i < key.length; i++) {
    if (CHAR_TO_INDEX[key[i] as string] === undefined) {
      return false;
    }
  }

  // Must not have trailing zeros (except when the fractional part is just '0')
  if (key.length > 2 && key[key.length - 1] === '0') {
    return false;
  }

  return true;
}
