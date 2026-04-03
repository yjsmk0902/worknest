// WebSocket connection manager (singleton)

type ConnectionState = 'connecting' | 'connected' | 'disconnected';
type MessageHandler = (data: unknown) => void;

interface ServerEvent {
  type: string;
  payload: unknown;
  actor?: { id: string; name: string };
  timestamp: string;
}

interface QueuedMessage {
  type: string;
  channel: string;
}

let ws: WebSocket | null = null;
let state: ConnectionState = 'disconnected';
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const MAX_RECONNECT_DELAY = 30_000;
const HEARTBEAT_INTERVAL = 30_000;

// Subscribed channels for re-subscribing on reconnect
const subscribedChannels = new Set<string>();

// Message queue for when disconnected
const messageQueue: QueuedMessage[] = [];

// Event handlers registry
const handlers = new Map<string, Set<MessageHandler>>();

// State change listeners
const stateListeners = new Set<(state: ConnectionState) => void>();

function setConnectionState(next: ConnectionState): void {
  state = next;
  for (const listener of stateListeners) {
    listener(next);
  }
}

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/v1/ws`;
}

function getReconnectDelay(): number {
  const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY);
  return delay;
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;

  const delay = getReconnectDelay();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempt++;
    connect();
  }, delay);
}

function flushQueue(): void {
  while (messageQueue.length > 0) {
    const msg = messageQueue.shift();
    if (msg && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

function sendOrQueue(msg: QueuedMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    messageQueue.push(msg);
  }
}

function handleMessage(event: MessageEvent): void {
  let data: ServerEvent;
  try {
    data = JSON.parse(event.data as string) as ServerEvent;
  } catch {
    return;
  }

  // Ignore internal protocol messages
  if (data.type === 'subscribed' || data.type === 'unsubscribed' || data.type === 'pong') {
    return;
  }

  const typeHandlers = handlers.get(data.type);
  if (typeHandlers) {
    for (const handler of typeHandlers) {
      try {
        handler(data.payload);
      } catch {
        // Prevent handler errors from crashing the connection
      }
    }
  }
}

/**
 * Establish WebSocket connection to /api/v1/ws.
 */
export function connect(): void {
  // Don't connect if already connected or connecting
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  setConnectionState('connecting');

  ws = new WebSocket(getWsUrl());

  ws.addEventListener('open', () => {
    setConnectionState('connected');
    reconnectAttempt = 0;
    startHeartbeat();

    // Re-subscribe to all channels
    for (const channel of subscribedChannels) {
      ws?.send(JSON.stringify({ type: 'subscribe', channel }));
    }

    // Send queued messages
    flushQueue();
  });

  ws.addEventListener('message', handleMessage);

  ws.addEventListener('close', () => {
    setConnectionState('disconnected');
    stopHeartbeat();
    ws = null;
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    // The close event will fire after error, which handles reconnection
    ws?.close();
  });
}

/**
 * Close WebSocket connection.
 */
export function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopHeartbeat();
  reconnectAttempt = 0;
  subscribedChannels.clear();
  messageQueue.length = 0;

  if (ws) {
    ws.close();
    ws = null;
  }
  setConnectionState('disconnected');
}

/**
 * Subscribe to a WebSocket channel.
 */
export function subscribe(channel: string): void {
  subscribedChannels.add(channel);
  sendOrQueue({ type: 'subscribe', channel });
}

/**
 * Unsubscribe from a WebSocket channel.
 */
export function unsubscribe(channel: string): void {
  subscribedChannels.delete(channel);
  sendOrQueue({ type: 'unsubscribe', channel });
}

/**
 * Register a handler for a specific event type.
 */
export function onMessage(type: string, handler: MessageHandler): void {
  let typeHandlers = handlers.get(type);
  if (!typeHandlers) {
    typeHandlers = new Set();
    handlers.set(type, typeHandlers);
  }
  typeHandlers.add(handler);
}

/**
 * Unregister a handler for a specific event type.
 */
export function offMessage(type: string, handler: MessageHandler): void {
  const typeHandlers = handlers.get(type);
  if (typeHandlers) {
    typeHandlers.delete(handler);
    if (typeHandlers.size === 0) {
      handlers.delete(type);
    }
  }
}

/**
 * Get the current connection state.
 */
export function getConnectionState(): ConnectionState {
  return state;
}

/**
 * Listen for connection state changes.
 * Returns an unsubscribe function.
 */
export function onStateChange(listener: (state: ConnectionState) => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}
