import { describe, expect, it } from 'vitest';

import { generateId, getIdType, IdType, isIdOfType } from '@worknest/core/lib/id';

describe('id', () => {
  describe('generateId', () => {
    it('generates a string ending with the type suffix', () => {
      const id = generateId(IdType.Node);
      expect(id.endsWith('nd')).toBe(true);
    });

    it('generates unique ids on successive calls', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId(IdType.Node)));
      expect(ids.size).toBe(100);
    });

    it('generates lowercase ids', () => {
      const id = generateId(IdType.Account);
      expect(id).toBe(id.toLowerCase());
    });

    it('produces ids with correct suffix for each type', () => {
      const cases: [IdType, string][] = [
        [IdType.Account, 'ac'],
        [IdType.Workspace, 'wc'],
        [IdType.User, 'us'],
        [IdType.Message, 'ms'],
        [IdType.Database, 'db'],
        [IdType.Page, 'pg'],
        [IdType.File, 'fi'],
        [IdType.Space, 'sp'],
      ];

      for (const [type, suffix] of cases) {
        const id = generateId(type);
        expect(id.endsWith(suffix)).toBe(true);
      }
    });
  });

  describe('isIdOfType', () => {
    it('returns true for matching type', () => {
      const id = generateId(IdType.Node);
      expect(isIdOfType(id, IdType.Node)).toBe(true);
    });

    it('returns false for non-matching type', () => {
      const id = generateId(IdType.Node);
      expect(isIdOfType(id, IdType.Account)).toBe(false);
    });
  });

  describe('getIdType', () => {
    it('extracts the type suffix from an id', () => {
      const id = generateId(IdType.Workspace);
      expect(getIdType(id)).toBe(IdType.Workspace);
    });
  });
});
