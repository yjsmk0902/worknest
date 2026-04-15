/**
 * WebSocket connection manager tests.
 *
 * Tests the singleton WebSocket connection lifecycle:
 * - connect/disconnect
 * - subscribe/unsubscribe channels
 * - onMessage/offMessage handlers
 * - Auto-reconnect on close
 * - Message queue when disconnected
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── WebSocket Mock ───────────────────────────────────────────────────

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;

  private eventListeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    // Store the latest instance for test access
    MockWebSocket.lastInstance = this;
    MockWebSocket.instances.push(this);
  }

  addEventListener(event: string, handler: (event: unknown) => void) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event: string, handler: (event: unknown) => void) {
    const listeners = this.eventListeners[event];
    if (listeners) {
      this.eventListeners[event] = listeners.filter((h) => h !== handler);
    }
  }

  send = vi.fn();

  close() {
    this.readyState = MockWebSocket.CLOSED;
    // Note: in real browsers, the close event fires asynchronously.
    // We do NOT auto-trigger it here to avoid confusing synchronous
    // re-entrant calls inside disconnect(). Use simulateClose() in
    // tests when you need the close event.
  }

  // Test helpers
  triggerEvent(event: string, data: unknown) {
    const listeners = this.eventListeners[event] ?? [];
    for (const listener of listeners) {
      listener(data);
    }
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.triggerEvent('open', {});
  }

  simulateMessage(data: unknown) {
    this.triggerEvent('message', { data: JSON.stringify(data) });
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.triggerEvent('close', {});
  }

  simulateError() {
    this.triggerEvent('error', {});
  }

  // Static tracking
  static lastInstance: MockWebSocket | null = null;
  static instances: MockWebSocket[] = [];

  static reset() {
    MockWebSocket.lastInstance = null;
    MockWebSocket.instances = [];
  }
}

// Assign static constants for WebSocket protocol compatibility
Object.defineProperty(MockWebSocket, 'CONNECTING', { value: 0, writable: false });
Object.defineProperty(MockWebSocket, 'OPEN', { value: 1, writable: false });
Object.defineProperty(MockWebSocket, 'CLOSING', { value: 2, writable: false });
Object.defineProperty(MockWebSocket, 'CLOSED', { value: 3, writable: false });

// ── Test setup ───────────────────────────────────────────────────────

// We need to dynamically import the websocket module so it picks up
// the mock. We also reset the module between tests.
let wsModule: typeof import('../../src/lib/websocket');

beforeEach(async () => {
  vi.useFakeTimers();
  MockWebSocket.reset();

  // Install WebSocket mock globally
  (globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocket;

  // Set window.location for URL construction
  Object.defineProperty(window, 'location', {
    value: {
      protocol: 'http:',
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
    writable: true,
    configurable: true,
  });

  // Reset the module to get a fresh singleton state
  vi.resetModules();
  wsModule = await import('../../src/lib/websocket');
});

afterEach(() => {
  // Clean up any open connections
  try {
    wsModule.disconnect();
  } catch {
    // Module may not be loaded
  }
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('WebSocket manager', () => {
  describe('connect', () => {
    it('creates a WebSocket connection with correct URL', () => {
      wsModule.connect();

      expect(MockWebSocket.lastInstance).not.toBeNull();
      expect(MockWebSocket.lastInstance?.url).toBe('ws://localhost:3000/api/v1/ws');
    });

    it("sets connection state to 'connecting' then 'connected'", () => {
      const states: string[] = [];
      wsModule.onStateChange((s) => states.push(s));

      wsModule.connect();
      expect(wsModule.getConnectionState()).toBe('connecting');

      MockWebSocket.lastInstance?.simulateOpen();
      expect(wsModule.getConnectionState()).toBe('connected');

      expect(states).toContain('connecting');
      expect(states).toContain('connected');
    });

    it('does not create duplicate connections', () => {
      wsModule.connect();
      const firstInstance = MockWebSocket.lastInstance;

      // Simulate the connection is OPEN
      firstInstance?.simulateOpen();

      // Try connecting again
      wsModule.connect();

      // Should still be the same instance
      expect(MockWebSocket.instances.length).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('closes the WebSocket connection', () => {
      wsModule.connect();
      const instance = MockWebSocket.lastInstance!;
      instance.simulateOpen();

      wsModule.disconnect();

      expect(wsModule.getConnectionState()).toBe('disconnected');
    });

    it('clears subscribed channels', () => {
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      wsModule.subscribe('project:proj-1');
      wsModule.disconnect();

      // After disconnect and reconnect, should not re-subscribe
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      // The send calls should not include the old subscription
      const sendCalls = MockWebSocket.lastInstance?.send.mock.calls;
      const subscribeMessages = sendCalls.filter((call: unknown[]) => {
        const parsed = JSON.parse(call[0] as string);
        return parsed.type === 'subscribe' && parsed.channel === 'project:proj-1';
      });
      expect(subscribeMessages.length).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('sends subscribe message when connected', () => {
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      wsModule.subscribe('project:proj-1');

      expect(MockWebSocket.lastInstance?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', channel: 'project:proj-1' }),
      );
    });

    it('re-subscribes to channels after reconnect', () => {
      wsModule.connect();
      const firstInstance = MockWebSocket.lastInstance!;
      firstInstance.simulateOpen();

      wsModule.subscribe('project:proj-1');
      wsModule.subscribe('issue:issue-1');

      // Reset send mock to track re-subscribe calls
      firstInstance.send.mockClear();

      // Simulate disconnect and reconnect
      firstInstance.simulateClose();

      vi.advanceTimersByTime(1000); // first reconnect delay

      const secondInstance = MockWebSocket.lastInstance!;
      secondInstance.simulateOpen();

      // Should have re-subscribed to both channels
      const sendCalls = secondInstance.send.mock.calls.map((call: unknown[]) =>
        JSON.parse(call[0] as string),
      );

      expect(sendCalls).toContainEqual({ type: 'subscribe', channel: 'project:proj-1' });
      expect(sendCalls).toContainEqual({ type: 'subscribe', channel: 'issue:issue-1' });
    });
  });

  describe('unsubscribe', () => {
    it('sends unsubscribe message when connected', () => {
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      wsModule.subscribe('project:proj-1');
      MockWebSocket.lastInstance?.send.mockClear();

      wsModule.unsubscribe('project:proj-1');

      expect(MockWebSocket.lastInstance?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'unsubscribe', channel: 'project:proj-1' }),
      );
    });
  });

  describe('onMessage / offMessage', () => {
    it('registers a handler and invokes it on matching message type', () => {
      const handler = vi.fn();
      wsModule.onMessage('issue:created', handler);

      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      MockWebSocket.lastInstance?.simulateMessage({
        type: 'issue:created',
        payload: { id: 'issue-1', title: 'New' },
        timestamp: '2025-01-01T00:00:00Z',
      });

      expect(handler).toHaveBeenCalledWith({ id: 'issue-1', title: 'New' });
    });

    it('does not invoke handler for non-matching message type', () => {
      const handler = vi.fn();
      wsModule.onMessage('issue:created', handler);

      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      MockWebSocket.lastInstance?.simulateMessage({
        type: 'issue:updated',
        payload: { id: 'issue-1' },
        timestamp: '2025-01-01T00:00:00Z',
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('removes handler with offMessage', () => {
      const handler = vi.fn();
      wsModule.onMessage('issue:created', handler);

      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      // First message should trigger handler
      MockWebSocket.lastInstance?.simulateMessage({
        type: 'issue:created',
        payload: { id: '1' },
        timestamp: '2025-01-01T00:00:00Z',
      });
      expect(handler).toHaveBeenCalledTimes(1);

      // Remove handler
      wsModule.offMessage('issue:created', handler);

      // Second message should NOT trigger handler
      MockWebSocket.lastInstance?.simulateMessage({
        type: 'issue:created',
        payload: { id: '2' },
        timestamp: '2025-01-01T00:00:00Z',
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('ignores internal protocol messages (subscribed, unsubscribed, pong)', () => {
      const handler = vi.fn();
      wsModule.onMessage('subscribed', handler);

      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      MockWebSocket.lastInstance?.simulateMessage({
        type: 'subscribed',
        payload: null,
        timestamp: '2025-01-01T00:00:00Z',
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple handlers for the same message type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      wsModule.onMessage('issue:updated', handler1);
      wsModule.onMessage('issue:updated', handler2);

      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      MockWebSocket.lastInstance?.simulateMessage({
        type: 'issue:updated',
        payload: { id: 'issue-1' },
        timestamp: '2025-01-01T00:00:00Z',
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('auto-reconnect', () => {
    it('schedules reconnect on close', () => {
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();
      MockWebSocket.lastInstance?.simulateClose();

      expect(wsModule.getConnectionState()).toBe('disconnected');

      // Advance timer to trigger reconnect (first attempt: 1000ms)
      vi.advanceTimersByTime(1000);

      // A new WebSocket should have been created
      expect(MockWebSocket.instances.length).toBe(2);
    });

    it('uses exponential backoff for reconnect delays', () => {
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      // First close -> reconnect after 1s (2^0 * 1000)
      MockWebSocket.lastInstance?.simulateClose();
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances.length).toBe(2);

      // Second close -> reconnect after 2s (2^1 * 1000)
      MockWebSocket.lastInstance?.simulateClose();
      vi.advanceTimersByTime(1999);
      expect(MockWebSocket.instances.length).toBe(2); // Not yet
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(3);
    });

    it('resets reconnect attempt counter on successful connection', () => {
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      // Force a few reconnects
      MockWebSocket.lastInstance?.simulateClose();
      vi.advanceTimersByTime(1000);
      MockWebSocket.lastInstance?.simulateClose();
      vi.advanceTimersByTime(2000);

      // Now connect successfully
      MockWebSocket.lastInstance?.simulateOpen();

      // Next close should use first-attempt delay (1s), not 4s
      MockWebSocket.lastInstance?.simulateClose();
      const countBefore = MockWebSocket.instances.length;
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances.length).toBe(countBefore + 1);
    });

    it('does not reconnect after explicit disconnect', () => {
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      wsModule.disconnect();

      // Advance timers well past any reconnect delay
      vi.advanceTimersByTime(60_000);

      // Only the initial instance plus the one from disconnect's close
      // No new reconnection attempts
      const _connectingInstances = MockWebSocket.instances.filter(
        (inst) => inst !== MockWebSocket.instances[0],
      );
      // disconnect calls ws.close() which triggers close event,
      // but the timer should have been cleared
      expect(wsModule.getConnectionState()).toBe('disconnected');
    });
  });

  describe('message queue', () => {
    it('queues subscribe messages when disconnected', () => {
      // Don't connect — subscribe while disconnected
      wsModule.subscribe('project:proj-1');

      // Now connect
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      // The queued subscribe AND the re-subscribe from subscribedChannels
      // should both have been sent
      const sendCalls = MockWebSocket.lastInstance?.send.mock.calls.map((call: unknown[]) =>
        JSON.parse(call[0] as string),
      );

      const subscribeMessages = sendCalls.filter(
        (msg: Record<string, unknown>) =>
          msg.type === 'subscribe' && msg.channel === 'project:proj-1',
      );

      // At least one subscribe message should have been sent
      expect(subscribeMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('flushes queued messages on reconnect', () => {
      wsModule.connect();
      MockWebSocket.lastInstance?.simulateOpen();

      // Disconnect
      MockWebSocket.lastInstance?.simulateClose();

      // Subscribe while disconnected — queued
      wsModule.subscribe('project:proj-2');

      // Reconnect
      vi.advanceTimersByTime(1000);
      MockWebSocket.lastInstance?.simulateOpen();

      const sendCalls = MockWebSocket.lastInstance?.send.mock.calls.map((call: unknown[]) =>
        JSON.parse(call[0] as string),
      );

      const proj2Subs = sendCalls.filter(
        (msg: Record<string, unknown>) =>
          msg.type === 'subscribe' && msg.channel === 'project:proj-2',
      );

      expect(proj2Subs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('state change listeners', () => {
    it('onStateChange returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = wsModule.onStateChange(listener);

      wsModule.connect();
      expect(listener).toHaveBeenCalledWith('connecting');

      unsub();
      listener.mockClear();

      MockWebSocket.lastInstance?.simulateOpen();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
