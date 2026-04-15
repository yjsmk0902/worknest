/**
 * Issue constants tests.
 *
 * Tests the type icon mapping, priority configuration,
 * and getTypeIcon utility function.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { PRIORITY_CONFIG, TYPE_ICON_MAP, getTypeIcon } from '../../src/lib/issue-constants';

// ── Tests ─────────────────────────────────────────────────────────────

describe('issue-constants', () => {
  describe('TYPE_ICON_MAP', () => {
    it('maps all known icon names', () => {
      const expectedKeys = ['check-circle', 'bug', 'book-open', 'rocket'];

      for (const key of expectedKeys) {
        expect(TYPE_ICON_MAP[key]).toBeDefined();
        expect(typeof TYPE_ICON_MAP[key]).toBe('function');
      }
    });

    it('has exactly 4 entries', () => {
      expect(Object.keys(TYPE_ICON_MAP).length).toBe(4);
    });

    it("maps 'check-circle' to a component", () => {
      expect(TYPE_ICON_MAP['check-circle']).toBeDefined();
    });

    it("maps 'bug' to a component", () => {
      expect(TYPE_ICON_MAP.bug).toBeDefined();
    });

    it("maps 'book-open' to a component", () => {
      expect(TYPE_ICON_MAP['book-open']).toBeDefined();
    });

    it("maps 'rocket' to a component", () => {
      expect(TYPE_ICON_MAP.rocket).toBeDefined();
    });
  });

  describe('getTypeIcon', () => {
    it('returns the correct component for a known icon name', () => {
      const icon = getTypeIcon('bug');
      expect(icon).toBe(TYPE_ICON_MAP.bug);
    });

    it("returns the correct component for 'check-circle'", () => {
      const icon = getTypeIcon('check-circle');
      expect(icon).toBe(TYPE_ICON_MAP['check-circle']);
    });

    it("returns the correct component for 'rocket'", () => {
      const icon = getTypeIcon('rocket');
      expect(icon).toBe(TYPE_ICON_MAP.rocket);
    });

    it('returns default (CircleCheck) for unknown icon name', () => {
      const icon = getTypeIcon('unknown-icon');
      // Default should be the same as check-circle (CircleCheck)
      expect(icon).toBe(TYPE_ICON_MAP['check-circle']);
    });

    it('returns default (CircleCheck) for undefined', () => {
      const icon = getTypeIcon(undefined);
      expect(icon).toBe(TYPE_ICON_MAP['check-circle']);
    });

    it('returns default (CircleCheck) for null', () => {
      const icon = getTypeIcon(null);
      expect(icon).toBe(TYPE_ICON_MAP['check-circle']);
    });

    it('returns default (CircleCheck) for empty string', () => {
      const icon = getTypeIcon('');
      // Empty string is falsy, so falls through to default
      expect(icon).toBe(TYPE_ICON_MAP['check-circle']);
    });
  });

  describe('PRIORITY_CONFIG', () => {
    const allPriorities = ['urgent', 'high', 'medium', 'low', 'none'] as const;

    it('has all priority levels defined', () => {
      for (const priority of allPriorities) {
        expect(PRIORITY_CONFIG[priority]).toBeDefined();
      }
    });

    it('has exactly 5 priority levels', () => {
      expect(Object.keys(PRIORITY_CONFIG).length).toBe(5);
    });

    for (const priority of allPriorities) {
      describe(`priority: ${priority}`, () => {
        it('has a label string', () => {
          expect(typeof PRIORITY_CONFIG[priority].label).toBe('string');
          expect(PRIORITY_CONFIG[priority].label.length).toBeGreaterThan(0);
        });

        it('has an icon component', () => {
          expect(typeof PRIORITY_CONFIG[priority].icon).toBe('function');
        });

        it('has a color string', () => {
          expect(typeof PRIORITY_CONFIG[priority].color).toBe('string');
          expect(PRIORITY_CONFIG[priority].color.length).toBeGreaterThan(0);
        });
      });
    }

    it("urgent has label 'Urgent'", () => {
      expect(PRIORITY_CONFIG.urgent.label).toBe('Urgent');
    });

    it("high has label 'High'", () => {
      expect(PRIORITY_CONFIG.high.label).toBe('High');
    });

    it("medium has label 'Medium'", () => {
      expect(PRIORITY_CONFIG.medium.label).toBe('Medium');
    });

    it("low has label 'Low'", () => {
      expect(PRIORITY_CONFIG.low.label).toBe('Low');
    });

    it("none has label 'None'", () => {
      expect(PRIORITY_CONFIG.none.label).toBe('None');
    });

    it('urgent has red color class', () => {
      expect(PRIORITY_CONFIG.urgent.color).toContain('red');
    });

    it('high has orange color class', () => {
      expect(PRIORITY_CONFIG.high.color).toContain('orange');
    });

    it('medium has yellow color class', () => {
      expect(PRIORITY_CONFIG.medium.color).toContain('yellow');
    });

    it('low has blue color class', () => {
      expect(PRIORITY_CONFIG.low.color).toContain('blue');
    });
  });
});
