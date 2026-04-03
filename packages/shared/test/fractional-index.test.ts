/**
 * Fractional indexing utility tests.
 *
 * Tests the generateKeyBetween, generateNKeysBetween, and isValidSortKey
 * functions exported from @worknest/shared to verify:
 * - Correct default key generation
 * - Insertion before, after, and between existing keys
 * - Bulk key generation
 * - Key validation
 * - Edge cases (adjacent keys, deep nesting, 1000+ consecutive insertions)
 */
import { describe, expect, it } from "vitest";
import {
  generateKeyBetween,
  generateNKeysBetween,
  isValidSortKey,
} from "../src/lib/fractional-index";

// ═══════════════════════════════════════════════════════════════════════
// isValidSortKey
// ═══════════════════════════════════════════════════════════════════════

describe("isValidSortKey", () => {
  it("accepts the default key 'a0'", () => {
    expect(isValidSortKey("a0")).toBe(true);
  });

  it("accepts keys with uppercase integer part", () => {
    expect(isValidSortKey("A0")).toBe(true);
    expect(isValidSortKey("Z0")).toBe(true);
  });

  it("accepts keys with lowercase integer part", () => {
    expect(isValidSortKey("a0")).toBe(true);
    expect(isValidSortKey("z0")).toBe(true);
  });

  it("accepts keys with multi-character fractional parts", () => {
    expect(isValidSortKey("a0V")).toBe(true);
    expect(isValidSortKey("a5A3")).toBe(true);
  });

  it("rejects keys shorter than 2 characters", () => {
    expect(isValidSortKey("a")).toBe(false);
    expect(isValidSortKey("")).toBe(false);
  });

  it("rejects keys with invalid integer part (digit)", () => {
    expect(isValidSortKey("00")).toBe(false);
    expect(isValidSortKey("10")).toBe(false);
  });

  it("rejects keys with invalid fractional characters", () => {
    expect(isValidSortKey("a!")).toBe(false);
    expect(isValidSortKey("a ")).toBe(false);
    expect(isValidSortKey("a-")).toBe(false);
  });

  it("rejects keys with trailing zeros (not normalized)", () => {
    expect(isValidSortKey("a10")).toBe(false);
    expect(isValidSortKey("a100")).toBe(false);
  });

  it("accepts key where fractional part is just '0'", () => {
    expect(isValidSortKey("a0")).toBe(true);
    expect(isValidSortKey("b0")).toBe(true);
  });

  it("rejects non-string values", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
    expect(isValidSortKey(123 as any)).toBe(false);
    // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
    expect(isValidSortKey(null as any)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// generateKeyBetween — basic cases
// ═══════════════════════════════════════════════════════════════════════

describe("generateKeyBetween", () => {
  it("returns 'a0' when both arguments are null", () => {
    expect(generateKeyBetween(null, null)).toBe("a0");
  });

  it("returns 'a0' when both arguments are undefined", () => {
    expect(generateKeyBetween(undefined, undefined)).toBe("a0");
  });

  it("generates a key after a given key (append)", () => {
    const key = generateKeyBetween("a0", null);
    expect(key > "a0").toBe(true);
    expect(isValidSortKey(key)).toBe(true);
  });

  it("generates a key before a given key (prepend)", () => {
    const key = generateKeyBetween(null, "a0");
    expect(key < "a0").toBe(true);
    expect(isValidSortKey(key)).toBe(true);
  });

  it("generates a key between two keys", () => {
    const key = generateKeyBetween("a0", "a1");
    expect(key > "a0").toBe(true);
    expect(key < "a1").toBe(true);
    expect(isValidSortKey(key)).toBe(true);
  });

  it("throws when a >= b", () => {
    expect(() => generateKeyBetween("a1", "a0")).toThrow();
    expect(() => generateKeyBetween("a0", "a0")).toThrow();
  });

  it("throws when a is invalid", () => {
    expect(() => generateKeyBetween("!!", null)).toThrow();
  });

  it("throws when b is invalid", () => {
    expect(() => generateKeyBetween(null, "!!")).toThrow();
  });

  it("all generated keys are valid", () => {
    const keys = [
      generateKeyBetween(null, null),
      generateKeyBetween("a0", null),
      generateKeyBetween(null, "a0"),
      generateKeyBetween("a0", "a1"),
    ];
    for (const k of keys) {
      expect(isValidSortKey(k)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// generateKeyBetween — edge cases
// ═══════════════════════════════════════════════════════════════════════

describe("generateKeyBetween edge cases", () => {
  it("handles adjacent keys with no room (extends fractional part)", () => {
    // '0' and '1' are adjacent in base-62. Midpoint needs extension.
    const key = generateKeyBetween("a0", "a1");
    expect(key > "a0").toBe(true);
    expect(key < "a1").toBe(true);
    expect(isValidSortKey(key)).toBe(true);
  });

  it("handles inserting between very close keys", () => {
    const k1 = generateKeyBetween("a0", "a1");
    const k2 = generateKeyBetween("a0", k1);
    expect(k2 > "a0").toBe(true);
    expect(k2 < k1).toBe(true);
    expect(isValidSortKey(k2)).toBe(true);
  });

  it("handles prepending multiple times", () => {
    let current = "a0";
    for (let i = 0; i < 20; i++) {
      const prev = generateKeyBetween(null, current);
      expect(prev < current).toBe(true);
      expect(isValidSortKey(prev)).toBe(true);
      current = prev;
    }
  });

  it("handles appending multiple times", () => {
    let current = "a0";
    for (let i = 0; i < 20; i++) {
      const next = generateKeyBetween(current, null);
      expect(next > current).toBe(true);
      expect(isValidSortKey(next)).toBe(true);
      current = next;
    }
  });

  it("handles keys with long fractional parts", () => {
    const key = generateKeyBetween("a0V", "a0W");
    expect(key > "a0V").toBe(true);
    expect(key < "a0W").toBe(true);
    expect(isValidSortKey(key)).toBe(true);
  });

  it("handles different integer parts", () => {
    const key = generateKeyBetween("a0", "c0");
    expect(key > "a0").toBe(true);
    expect(key < "c0").toBe(true);
    expect(isValidSortKey(key)).toBe(true);
  });

  it("handles adjacent integer parts", () => {
    const key = generateKeyBetween("a0", "b0");
    expect(key > "a0").toBe(true);
    expect(key < "b0").toBe(true);
    expect(isValidSortKey(key)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// generateKeyBetween — stress: 1000 consecutive insertions
// ═══════════════════════════════════════════════════════════════════════

describe("generateKeyBetween stress tests", () => {
  it("supports 1000 consecutive insertions at the end", () => {
    let current = "a0";
    for (let i = 0; i < 1000; i++) {
      const next = generateKeyBetween(current, null);
      expect(next > current).toBe(true);
      expect(isValidSortKey(next)).toBe(true);
      current = next;
    }
  });

  it("supports 1000 consecutive insertions at the beginning", () => {
    let current = "a0";
    for (let i = 0; i < 1000; i++) {
      const prev = generateKeyBetween(null, current);
      expect(prev < current).toBe(true);
      expect(isValidSortKey(prev)).toBe(true);
      current = prev;
    }
  });

  it("supports 1000 consecutive insertions between same two keys", () => {
    const lower = "a0";
    const upper = "a1";
    let current = lower;

    for (let i = 0; i < 1000; i++) {
      const key = generateKeyBetween(current, upper);
      expect(key > current).toBe(true);
      expect(key < upper).toBe(true);
      expect(isValidSortKey(key)).toBe(true);
      current = key;
    }
  });

  it("produces deterministic results", () => {
    const run1 = generateKeyBetween("a0", "a1");
    const run2 = generateKeyBetween("a0", "a1");
    expect(run1).toBe(run2);

    const keys1 = generateNKeysBetween("a0", "a1", 10);
    const keys2 = generateNKeysBetween("a0", "a1", 10);
    expect(keys1).toEqual(keys2);
  });

  it("keys are lexicographically sortable via string comparison", () => {
    const keys = generateNKeysBetween(null, null, 50);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// generateNKeysBetween
// ═══════════════════════════════════════════════════════════════════════

describe("generateNKeysBetween", () => {
  it("returns empty array for n=0", () => {
    expect(generateNKeysBetween(null, null, 0)).toEqual([]);
  });

  it("returns single key for n=1", () => {
    const keys = generateNKeysBetween(null, null, 1);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe("a0");
  });

  it("generates N keys in ascending order", () => {
    const keys = generateNKeysBetween("a0", "a1", 5);
    expect(keys).toHaveLength(5);

    // All keys should be in order
    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i] < keys[i + 1]).toBe(true);
    }

    // All keys between bounds
    for (const k of keys) {
      expect(k > "a0").toBe(true);
      expect(k < "a1").toBe(true);
      expect(isValidSortKey(k)).toBe(true);
    }
  });

  it("generates N keys between null bounds", () => {
    const keys = generateNKeysBetween(null, null, 10);
    expect(keys).toHaveLength(10);

    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i] < keys[i + 1]).toBe(true);
    }
    for (const k of keys) {
      expect(isValidSortKey(k)).toBe(true);
    }
  });

  it("generates N keys when prepending", () => {
    const keys = generateNKeysBetween(null, "a0", 5);
    expect(keys).toHaveLength(5);

    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i] < keys[i + 1]).toBe(true);
    }
    for (const k of keys) {
      expect(k < "a0").toBe(true);
      expect(isValidSortKey(k)).toBe(true);
    }
  });

  it("generates N keys when appending", () => {
    const keys = generateNKeysBetween("a0", null, 5);
    expect(keys).toHaveLength(5);

    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i] < keys[i + 1]).toBe(true);
    }
    for (const k of keys) {
      expect(k > "a0").toBe(true);
      expect(isValidSortKey(k)).toBe(true);
    }
  });

  it("throws when n is negative", () => {
    expect(() => generateNKeysBetween(null, null, -1)).toThrow();
  });

  it("generates 100 keys between bounds correctly", () => {
    const keys = generateNKeysBetween("a0", "b0", 100);
    expect(keys).toHaveLength(100);

    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i] < keys[i + 1]).toBe(true);
    }
    for (const k of keys) {
      expect(k > "a0").toBe(true);
      expect(k < "b0").toBe(true);
      expect(isValidSortKey(k)).toBe(true);
    }
  });
});
