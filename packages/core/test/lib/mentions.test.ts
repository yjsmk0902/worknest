import { describe, expect, it } from 'vitest';

import { extractBlocksMentions } from '@worknest/core/lib/mentions';

describe('mentions', () => {
  describe('extractBlocksMentions', () => {
    it('returns empty array for null or undefined blocks', () => {
      expect(extractBlocksMentions('root', null)).toEqual([]);
      expect(extractBlocksMentions('root', undefined)).toEqual([]);
    });

    it('returns empty array when no mentions exist', () => {
      const blocks = {
        root: {
          id: 'root',
          type: 'paragraph',
          parentId: '',
          index: 'a',
          content: [{ type: 'text', text: 'No mentions here' }],
        },
      };
      expect(extractBlocksMentions('root', blocks)).toEqual([]);
    });

    it('extracts mentions from block content', () => {
      const blocks = {
        root: {
          id: 'root',
          type: 'paragraph',
          parentId: '',
          index: 'a',
          content: [
            {
              type: 'mention',
              attrs: { id: 'mention1', target: 'user1' },
            },
            { type: 'text', text: ' and ' },
            {
              type: 'mention',
              attrs: { id: 'mention2', target: 'user2' },
            },
          ],
        },
      };

      const mentions = extractBlocksMentions('root', blocks);
      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({ id: 'mention1', target: 'user1' });
      expect(mentions[1]).toEqual({ id: 'mention2', target: 'user2' });
    });

    it('extracts mentions from nested children', () => {
      const blocks = {
        root: {
          id: 'root',
          type: 'paragraph',
          parentId: '',
          index: 'a',
          content: [],
        },
        child: {
          id: 'child',
          type: 'paragraph',
          parentId: 'root',
          index: 'a',
          content: [
            {
              type: 'mention',
              attrs: { id: 'mention1', target: 'user1' },
            },
          ],
        },
      };

      const mentions = extractBlocksMentions('root', blocks);
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toEqual({ id: 'mention1', target: 'user1' });
    });

    it('ignores mention-type leaves without target or id', () => {
      const blocks = {
        root: {
          id: 'root',
          type: 'paragraph',
          parentId: '',
          index: 'a',
          content: [
            { type: 'mention', attrs: { id: 'mention1' } },
            { type: 'mention', attrs: { target: 'user1' } },
            { type: 'mention' },
          ],
        },
      };

      const mentions = extractBlocksMentions('root', blocks);
      expect(mentions).toHaveLength(0);
    });
  });
});
