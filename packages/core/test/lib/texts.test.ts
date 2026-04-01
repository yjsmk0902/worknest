import { describe, expect, it } from 'vitest';

import { extractBlockTexts, extractDocumentText } from '@worknest/core/lib/texts';

describe('texts', () => {
  describe('extractBlockTexts', () => {
    it('returns null for null or undefined blocks', () => {
      expect(extractBlockTexts('root', null)).toBeNull();
      expect(extractBlockTexts('root', undefined)).toBeNull();
    });

    it('returns null for empty blocks', () => {
      expect(extractBlockTexts('root', {})).toBeNull();
    });

    it('extracts text from a simple block', () => {
      const blocks = {
        root: {
          id: 'root',
          type: 'paragraph',
          parentId: '',
          index: 'a',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      };
      const result = extractBlockTexts('root', blocks);
      expect(result).toBe('Hello world');
    });

    it('concatenates text from multiple leaf nodes', () => {
      const blocks = {
        root: {
          id: 'root',
          type: 'paragraph',
          parentId: '',
          index: 'a',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world' },
          ],
        },
      };
      const result = extractBlockTexts('root', blocks);
      expect(result).toBe('Hello world');
    });

    it('extracts text from nested children in index order', () => {
      const blocks = {
        root: {
          id: 'root',
          type: 'paragraph',
          parentId: '',
          index: 'a',
          content: [{ type: 'text', text: 'Parent' }],
        },
        child2: {
          id: 'child2',
          type: 'paragraph',
          parentId: 'root',
          index: 'b',
          content: [{ type: 'text', text: 'Second' }],
        },
        child1: {
          id: 'child1',
          type: 'paragraph',
          parentId: 'root',
          index: 'a',
          content: [{ type: 'text', text: 'First' }],
        },
      };

      const result = extractBlockTexts('root', blocks);
      expect(result).toBe('Parent\nFirst\nSecond');
    });

    it('handles blocks without content', () => {
      const blocks = {
        root: {
          id: 'root',
          type: 'paragraph',
          parentId: '',
          index: 'a',
        },
      };
      const result = extractBlockTexts('root', blocks);
      expect(result).toBeNull();
    });
  });

  describe('extractDocumentText', () => {
    it('delegates to extractBlockTexts with document blocks', () => {
      const content = {
        blocks: {
          doc: {
            id: 'doc',
            type: 'paragraph',
            parentId: '',
            index: 'a',
            content: [{ type: 'text', text: 'Document text' }],
          },
        },
      };
      const result = extractDocumentText('doc', content);
      expect(result).toBe('Document text');
    });
  });
});
