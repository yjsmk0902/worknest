import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { ZOD_TEXT_DESCRIPTION } from '@colanode/core/lib/constants';
import { YDoc, encodeState, decodeState, mergeUpdates } from '@colanode/crdt';

const simpleSchema = z.object({
  name: z.string(),
  count: z.number(),
  active: z.boolean().optional(),
});

const textSchema = z.object({
  title: z.string(),
  body: z.string().describe(ZOD_TEXT_DESCRIPTION),
});

const nestedSchema = z.object({
  type: z.literal('database'),
  name: z.string(),
  fields: z.record(
    z.string(),
    z.object({
      id: z.string(),
      type: z.string(),
    })
  ),
});

const arraySchema = z.object({
  tags: z.array(z.string()),
});

describe('YDoc', () => {
  describe('basic operations', () => {
    it('creates empty document and applies initial update', () => {
      const doc = new YDoc();
      const update = doc.update(simpleSchema, {
        name: 'test',
        count: 1,
      });

      expect(update).not.toBeNull();
      expect(update).toBeInstanceOf(Uint8Array);

      const obj = doc.getObject<z.infer<typeof simpleSchema>>();
      expect(obj.name).toBe('test');
      expect(obj.count).toBe(1);
    });

    it('returns null when no changes are made', () => {
      const doc = new YDoc();
      doc.update(simpleSchema, { name: 'test', count: 1 });

      const update = doc.update(simpleSchema, { name: 'test', count: 1 });
      expect(update).toBeNull();
    });

    it('detects changes and returns update', () => {
      const doc = new YDoc();
      doc.update(simpleSchema, { name: 'test', count: 1 });

      const update = doc.update(simpleSchema, { name: 'updated', count: 2 });
      expect(update).not.toBeNull();

      const obj = doc.getObject<z.infer<typeof simpleSchema>>();
      expect(obj.name).toBe('updated');
      expect(obj.count).toBe(2);
    });

    it('handles optional fields', () => {
      const doc = new YDoc();
      doc.update(simpleSchema, { name: 'test', count: 1, active: true });

      const obj = doc.getObject<z.infer<typeof simpleSchema>>();
      expect(obj.active).toBe(true);

      doc.update(simpleSchema, { name: 'test', count: 1 });
      const obj2 = doc.getObject<z.infer<typeof simpleSchema>>();
      expect(obj2.active).toBeUndefined();
    });

    it('throws on invalid data according to schema', () => {
      const doc = new YDoc();
      expect(() => {
        doc.update(simpleSchema, { name: 123, count: 'invalid' });
      }).toThrow();
    });
  });

  describe('text fields (Y.Text)', () => {
    it('handles text fields with character-level diffing', () => {
      const doc = new YDoc();
      doc.update(textSchema, { title: 'Title', body: 'Hello world' });

      const obj = doc.getObject<z.infer<typeof textSchema>>();
      expect(obj.body).toBe('Hello world');
    });

    it('applies incremental text changes', () => {
      const doc = new YDoc();
      doc.update(textSchema, { title: 'T', body: 'Hello' });
      doc.update(textSchema, { title: 'T', body: 'Hello world' });

      const obj = doc.getObject<z.infer<typeof textSchema>>();
      expect(obj.body).toBe('Hello world');
    });

    it('returns null when text does not change', () => {
      const doc = new YDoc();
      doc.update(textSchema, { title: 'T', body: 'Same text' });

      const update = doc.update(textSchema, { title: 'T', body: 'Same text' });
      expect(update).toBeNull();
    });
  });

  describe('nested objects and records', () => {
    it('handles nested record fields', () => {
      const doc = new YDoc();
      doc.update(nestedSchema, {
        type: 'database',
        name: 'DB',
        fields: {
          f1: { id: 'f1', type: 'text' },
          f2: { id: 'f2', type: 'number' },
        },
      });

      const obj = doc.getObject<z.infer<typeof nestedSchema>>();
      expect(obj.fields.f1).toEqual({ id: 'f1', type: 'text' });
      expect(obj.fields.f2).toEqual({ id: 'f2', type: 'number' });
    });

    it('adds and removes record entries', () => {
      const doc = new YDoc();
      doc.update(nestedSchema, {
        type: 'database',
        name: 'DB',
        fields: {
          f1: { id: 'f1', type: 'text' },
        },
      });

      doc.update(nestedSchema, {
        type: 'database',
        name: 'DB',
        fields: {
          f2: { id: 'f2', type: 'number' },
        },
      });

      const obj = doc.getObject<z.infer<typeof nestedSchema>>();
      expect(obj.fields.f1).toBeUndefined();
      expect(obj.fields.f2).toEqual({ id: 'f2', type: 'number' });
    });
  });

  describe('array fields', () => {
    it('handles array fields', () => {
      const doc = new YDoc();
      doc.update(arraySchema, { tags: ['a', 'b', 'c'] });

      const obj = doc.getObject<z.infer<typeof arraySchema>>();
      expect(obj.tags).toEqual(['a', 'b', 'c']);
    });

    it('updates array by replacing elements', () => {
      const doc = new YDoc();
      doc.update(arraySchema, { tags: ['a', 'b'] });
      doc.update(arraySchema, { tags: ['a', 'c'] });

      const obj = doc.getObject<z.infer<typeof arraySchema>>();
      expect(obj.tags).toEqual(['a', 'c']);
    });

    it('truncates array when new value is shorter', () => {
      const doc = new YDoc();
      doc.update(arraySchema, { tags: ['a', 'b', 'c'] });
      doc.update(arraySchema, { tags: ['a'] });

      const obj = doc.getObject<z.infer<typeof arraySchema>>();
      expect(obj.tags).toEqual(['a']);
    });
  });

  describe('state management', () => {
    it('getState returns binary state', () => {
      const doc = new YDoc();
      doc.update(simpleSchema, { name: 'test', count: 1 });

      const state = doc.getState();
      expect(state).toBeInstanceOf(Uint8Array);
      expect(state.length).toBeGreaterThan(0);
    });

    it('getEncodedState returns base64 string', () => {
      const doc = new YDoc();
      doc.update(simpleSchema, { name: 'test', count: 1 });

      const encoded = doc.getEncodedState();
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('restores from binary state', () => {
      const doc1 = new YDoc();
      doc1.update(simpleSchema, { name: 'restored', count: 42 });
      const state = doc1.getState();

      const doc2 = new YDoc(state);
      const obj = doc2.getObject<z.infer<typeof simpleSchema>>();
      expect(obj.name).toBe('restored');
      expect(obj.count).toBe(42);
    });

    it('restores from base64 encoded state', () => {
      const doc1 = new YDoc();
      doc1.update(simpleSchema, { name: 'encoded', count: 7 });
      const encoded = doc1.getEncodedState();

      const doc2 = new YDoc(encoded);
      const obj = doc2.getObject<z.infer<typeof simpleSchema>>();
      expect(obj.name).toBe('encoded');
      expect(obj.count).toBe(7);
    });

    it('restores from array of updates', () => {
      const doc1 = new YDoc();
      const u1 = doc1.update(simpleSchema, { name: 'v1', count: 1 })!;
      const u2 = doc1.update(simpleSchema, { name: 'v2', count: 2 })!;

      const doc2 = new YDoc([u1, u2]);
      const obj = doc2.getObject<z.infer<typeof simpleSchema>>();
      expect(obj.name).toBe('v2');
      expect(obj.count).toBe(2);
    });

    it('applies external updates', () => {
      const doc1 = new YDoc();
      doc1.update(simpleSchema, { name: 'original', count: 1 });
      const state = doc1.getState();

      const doc2 = new YDoc();
      doc2.applyUpdate(state);

      const obj = doc2.getObject<z.infer<typeof simpleSchema>>();
      expect(obj.name).toBe('original');
      expect(obj.count).toBe(1);
    });
  });

  describe('undo and redo', () => {
    it('undoes the last change', () => {
      const doc = new YDoc();
      doc.update(simpleSchema, { name: 'first', count: 1 });
      doc.update(simpleSchema, { name: 'second', count: 2 });

      const undoUpdate = doc.undo();
      expect(undoUpdate).not.toBeNull();

      const obj = doc.getObject<z.infer<typeof simpleSchema>>();
      expect(obj.name).toBe('first');
      expect(obj.count).toBe(1);
    });

    it('redoes an undone change', () => {
      const doc = new YDoc();
      doc.update(simpleSchema, { name: 'first', count: 1 });
      doc.update(simpleSchema, { name: 'second', count: 2 });

      doc.undo();
      const redoUpdate = doc.redo();
      expect(redoUpdate).not.toBeNull();

      const obj = doc.getObject<z.infer<typeof simpleSchema>>();
      expect(obj.name).toBe('second');
      expect(obj.count).toBe(2);
    });

    it('returns null when nothing to undo', () => {
      const doc = new YDoc();
      const update = doc.undo();
      expect(update).toBeNull();
    });

    it('returns null when nothing to redo', () => {
      const doc = new YDoc();
      doc.update(simpleSchema, { name: 'test', count: 1 });

      const update = doc.redo();
      expect(update).toBeNull();
    });
  });

  describe('concurrent editing (conflict resolution)', () => {
    it('merges concurrent changes from two documents', () => {
      const doc1 = new YDoc();
      const initialUpdate = doc1.update(nestedSchema, {
        type: 'database',
        name: 'DB',
        fields: {
          f1: { id: 'f1', type: 'text' },
        },
      })!;

      const doc2 = new YDoc(initialUpdate);

      const u1 = doc1.update(nestedSchema, {
        type: 'database',
        name: 'DB Updated by 1',
        fields: {
          f1: { id: 'f1', type: 'text' },
          f2: { id: 'f2', type: 'number' },
        },
      })!;

      const u2 = doc2.update(nestedSchema, {
        type: 'database',
        name: 'DB',
        fields: {
          f1: { id: 'f1', type: 'text' },
          f3: { id: 'f3', type: 'boolean' },
        },
      })!;

      // Apply each other's updates
      doc1.applyUpdate(u2);
      doc2.applyUpdate(u1);

      const obj1 = doc1.getObject<z.infer<typeof nestedSchema>>();
      const obj2 = doc2.getObject<z.infer<typeof nestedSchema>>();

      // Both docs should converge to the same state
      expect(obj1.fields.f2).toEqual({ id: 'f2', type: 'number' });
      expect(obj1.fields.f3).toEqual({ id: 'f3', type: 'boolean' });
      expect(obj2.fields.f2).toEqual({ id: 'f2', type: 'number' });
      expect(obj2.fields.f3).toEqual({ id: 'f3', type: 'boolean' });
    });
  });
});

describe('encoding utilities', () => {
  it('encodeState and decodeState are inverse operations', () => {
    const doc = new YDoc();
    doc.update(simpleSchema, { name: 'test', count: 1 });
    const state = doc.getState();

    const encoded = encodeState(state);
    const decoded = decodeState(encoded);

    expect(decoded).toEqual(state);
  });

  it('mergeUpdates combines multiple updates', () => {
    const doc = new YDoc();
    const u1 = doc.update(simpleSchema, { name: 'first', count: 1 })!;
    const u2 = doc.update(simpleSchema, { name: 'second', count: 2 })!;

    const merged = mergeUpdates([u1, u2]);
    expect(merged).toBeInstanceOf(Uint8Array);

    const newDoc = new YDoc(merged);
    const obj = newDoc.getObject<z.infer<typeof simpleSchema>>();
    expect(obj.name).toBe('second');
    expect(obj.count).toBe(2);
  });
});
