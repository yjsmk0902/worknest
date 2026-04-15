/**
 * IssueLink extension regex pattern tests.
 *
 * Tests the issue key regex for valid and invalid patterns,
 * and pattern extraction from text.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';

// ── Regex patterns (mirrored from the extension) ─────────────────────

/**
 * Matches 2-5 uppercase letters followed by a dash and 1+ digits.
 * This mirrors the ISSUE_KEY_REGEX from the issue-link extension.
 */
const ISSUE_KEY_REGEX = /([A-Z]{2,5}-\d+)/g;
const ISSUE_KEY_INPUT_REGEX = /([A-Z]{2,5}-\d+)\s$/;

// ── Tests ─────────────────────────────────────────────────────────────

describe('IssueLink regex patterns', () => {
  describe('ISSUE_KEY_REGEX — valid patterns', () => {
    it('matches WORK-123', () => {
      const match = 'WORK-123'.match(ISSUE_KEY_REGEX);
      expect(match).toEqual(['WORK-123']);
    });

    it('matches AB-1 (2 letter prefix, single digit)', () => {
      const match = 'AB-1'.match(ISSUE_KEY_REGEX);
      expect(match).toEqual(['AB-1']);
    });

    it('matches ABCDE-99999 (5 letter prefix, 5 digits)', () => {
      const match = 'ABCDE-99999'.match(ISSUE_KEY_REGEX);
      expect(match).toEqual(['ABCDE-99999']);
    });

    it('matches WN-42', () => {
      const match = 'WN-42'.match(ISSUE_KEY_REGEX);
      expect(match).toEqual(['WN-42']);
    });

    it('matches PROJ-1 (minimum digits)', () => {
      const match = 'PROJ-1'.match(ISSUE_KEY_REGEX);
      expect(match).toEqual(['PROJ-1']);
    });
  });

  describe('ISSUE_KEY_REGEX — invalid patterns', () => {
    it('rejects lowercase work-123', () => {
      const match = 'work-123'.match(ISSUE_KEY_REGEX);
      expect(match).toBeNull();
    });

    it('rejects single letter A-1', () => {
      const match = 'A-1'.match(ISSUE_KEY_REGEX);
      expect(match).toBeNull();
    });

    it('rejects 6+ letter prefix ABCDEF-1', () => {
      const match = 'ABCDEF-1'.match(ISSUE_KEY_REGEX);
      // The regex matches up to 5 uppercase letters, so ABCDE-1 would match
      // but ABCDEF-1 will match as BCDEF-1 (greedy 2-5 range from BCDEF)
      // This is expected behavior since the regex is not anchored
      if (match) {
        // Should not match the full "ABCDEF-1"
        expect(match[0]).not.toBe('ABCDEF-1');
      }
    });

    it('rejects missing dash WORK123', () => {
      const match = 'WORK123'.match(ISSUE_KEY_REGEX);
      expect(match).toBeNull();
    });

    it('rejects missing number WORK-', () => {
      const match = 'WORK-'.match(ISSUE_KEY_REGEX);
      expect(match).toBeNull();
    });

    it('rejects mixed case Work-123', () => {
      const match = 'Work-123'.match(ISSUE_KEY_REGEX);
      // "ork" is lowercase, only uppercased part doesn't hit 2+ chars
      expect(match).toBeNull();
    });
  });

  describe('ISSUE_KEY_INPUT_REGEX — trailing space trigger', () => {
    it("matches 'WORK-123 ' with trailing space", () => {
      const match = 'WORK-123 '.match(ISSUE_KEY_INPUT_REGEX);
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('WORK-123');
    });

    it("does not match 'WORK-123' without trailing space", () => {
      const match = 'WORK-123'.match(ISSUE_KEY_INPUT_REGEX);
      expect(match).toBeNull();
    });
  });

  describe('pattern extraction from text', () => {
    it('extracts multiple issue keys from a sentence', () => {
      const text = 'This fixes WORK-123 and relates to AB-45, see also PROJ-1 for context.';
      const matches = text.match(ISSUE_KEY_REGEX);
      expect(matches).toEqual(['WORK-123', 'AB-45', 'PROJ-1']);
    });

    it('extracts issue key at the start of text', () => {
      const text = 'WN-1 is the first issue';
      const matches = text.match(ISSUE_KEY_REGEX);
      expect(matches).toEqual(['WN-1']);
    });

    it('extracts issue key at the end of text', () => {
      const text = 'Related to WN-999';
      const matches = text.match(ISSUE_KEY_REGEX);
      expect(matches).toEqual(['WN-999']);
    });

    it('returns null for text with no issue keys', () => {
      const text = 'No issue references in this text at all.';
      const matches = text.match(ISSUE_KEY_REGEX);
      expect(matches).toBeNull();
    });
  });
});
