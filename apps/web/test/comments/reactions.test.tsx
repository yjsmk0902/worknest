import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
/**
 * Reactions component tests.
 *
 * Tests reaction pills rendering, self-reacted styling, toggle behavior,
 * emoji picker popover, and optimistic toggle via parent callback.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('@worknest/ui', () => ({
  Popover: ({
    children,
    open,
  }: { children: React.ReactNode; open?: boolean; onOpenChange?: (v: boolean) => void }) =>
    React.createElement('div', { 'data-testid': 'popover', 'data-open': open }, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'popover-content' }, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'popover-trigger' }, children),
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => ({
  SmilePlus: ({ className, size }: { className?: string; size?: number }) =>
    React.createElement('span', { 'data-testid': 'smile-plus-icon', className }),
}));

vi.mock('@worknest/shared', () => ({
  ALLOWED_EMOJIS: [
    '👍',
    '❤️',
    '😄',
    '👀',
    '🚀',
    '🎉',
    '😕',
    '👎',
    '✅',
    '❌',
    '🔥',
    '💯',
    '🙏',
    '😱',
    '💡',
    '🤔',
    '😂',
    '🥳',
    '👏',
    '🙌',
  ],
}));

// ── Import component after mocks ─────────────────────────────────────

import { Reactions } from '../../src/components/comments/reactions';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeReaction(overrides: Record<string, unknown> = {}) {
  return {
    id: `reaction-${Math.random().toString(36).slice(2, 8)}`,
    commentId: 'comment-1',
    userId: 'other-user',
    emoji: '👍',
    createdAt: '2025-06-01T10:00:00Z',
    user: {
      id: 'other-user',
      name: 'Other User',
      avatarUrl: null,
    },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Reactions', () => {
  const onToggle = vi.fn();

  beforeEach(() => {
    onToggle.mockClear();
  });

  it('renders reaction pills with emoji and count', () => {
    const reactions = [
      makeReaction({
        id: 'r1',
        emoji: '👍',
        userId: 'u1',
        user: { id: 'u1', name: 'Alice', avatarUrl: null },
      }),
      makeReaction({
        id: 'r2',
        emoji: '👍',
        userId: 'u2',
        user: { id: 'u2', name: 'Bob', avatarUrl: null },
      }),
      makeReaction({
        id: 'r3',
        emoji: '❤️',
        userId: 'u1',
        user: { id: 'u1', name: 'Alice', avatarUrl: null },
      }),
    ];

    render(
      React.createElement(Reactions, {
        reactions,
        currentUserId: 'u3',
        onToggle,
      }),
    );

    // Should show 2 pills: one for thumbs up (count 2) and one for heart (count 1)
    const thumbsUpButton = screen.getByLabelText('👍 2개 리액션');
    expect(thumbsUpButton).toBeDefined();
    expect(thumbsUpButton.textContent).toContain('2');

    const heartButton = screen.getByLabelText('❤️ 1개 리액션');
    expect(heartButton).toBeDefined();
    expect(heartButton.textContent).toContain('1');
  });

  it('self-reacted reaction has bg-primary/10 styling', () => {
    const reactions = [
      makeReaction({
        id: 'r1',
        emoji: '🚀',
        userId: 'me',
        user: { id: 'me', name: 'Me', avatarUrl: null },
      }),
    ];

    render(
      React.createElement(Reactions, {
        reactions,
        currentUserId: 'me',
        onToggle,
      }),
    );

    const pill = screen.getByLabelText('🚀 1개 리액션');
    // Self-reacted pills should have the primary styling class
    expect(pill.className).toContain('bg-primary/10');
  });

  it('non-self-reacted reaction uses muted background', () => {
    const reactions = [
      makeReaction({
        id: 'r1',
        emoji: '👍',
        userId: 'other',
        user: { id: 'other', name: 'Other', avatarUrl: null },
      }),
    ];

    render(
      React.createElement(Reactions, {
        reactions,
        currentUserId: 'me',
        onToggle,
      }),
    );

    const pill = screen.getByLabelText('👍 1개 리액션');
    expect(pill.className).toContain('bg-muted');
    expect(pill.className).not.toContain('bg-primary/10');
  });

  it('clicking a reaction pill calls onToggle with the emoji', () => {
    const reactions = [
      makeReaction({
        id: 'r1',
        emoji: '👍',
        userId: 'u1',
        user: { id: 'u1', name: 'Alice', avatarUrl: null },
      }),
    ];

    render(
      React.createElement(Reactions, {
        reactions,
        currentUserId: 'me',
        onToggle,
      }),
    );

    const pill = screen.getByLabelText('👍 1개 리액션');
    fireEvent.click(pill);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('👍');
  });

  it("add button is rendered with aria-label '리액션 추가'", () => {
    render(
      React.createElement(Reactions, {
        reactions: [],
        currentUserId: 'me',
        onToggle,
      }),
    );

    const addButton = screen.getByLabelText('리액션 추가');
    expect(addButton).toBeDefined();
  });

  it('emoji picker grid contains 20 emoji options', () => {
    // Render with existing reactions so the popover content is always rendered
    const reactions = [
      makeReaction({
        id: 'r1',
        emoji: '👍',
        userId: 'u1',
        user: { id: 'u1', name: 'Alice', avatarUrl: null },
      }),
    ];

    render(
      React.createElement(Reactions, {
        reactions,
        currentUserId: 'me',
        onToggle,
      }),
    );

    // The emoji picker is rendered inside the popover content
    const emojiGrid = screen.getByRole('grid', { name: '이모지 선택' });
    expect(emojiGrid).toBeDefined();

    // Each emoji is a button with aria-label = the emoji character
    const emojiButtons = emojiGrid.querySelectorAll('button');
    expect(emojiButtons.length).toBe(20);
  });
});
