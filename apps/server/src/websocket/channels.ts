import type { WebSocket } from '@fastify/websocket';

// ── Channel Types ──────────────────────────────────────────────────────

/**
 * Channel naming convention:
 *   workspace:{id}  — workspace-wide events
 *   project:{id}    — project issue changes
 *   issue:{id}      — single issue detail changes
 *   user:{id}       — personal notifications
 *   page:{id}       — wiki page real-time updates
 */
export type ChannelType = 'workspace' | 'project' | 'issue' | 'user' | 'page';

/**
 * Parse a channel string into its type and id.
 * Returns null if the format is invalid.
 */
export function parseChannel(channel: string): { type: ChannelType; id: string } | null {
  const [type, id] = channel.split(':');
  if (!type || !id) return null;

  const validTypes: ChannelType[] = ['workspace', 'project', 'issue', 'user', 'page'];
  if (!validTypes.includes(type as ChannelType)) return null;

  return { type: type as ChannelType, id };
}

// ── Channel Registry ───────────────────────────────────────────────────

/**
 * Maps channel names to the set of WebSocket connections subscribed to them.
 */
const channelSubscribers = new Map<string, Set<WebSocket>>();

/**
 * Maps WebSocket connections to the set of channels they've subscribed to
 * (for efficient cleanup on disconnect).
 */
const connectionChannels = new Map<WebSocket, Set<string>>();

/**
 * Subscribe a WebSocket connection to a channel.
 */
export function subscribe(ws: WebSocket, channel: string): void {
  // Validate channel format
  if (!parseChannel(channel)) return;

  // Add ws to channel's subscriber set
  let subscribers = channelSubscribers.get(channel);
  if (!subscribers) {
    subscribers = new Set();
    channelSubscribers.set(channel, subscribers);
  }
  subscribers.add(ws);

  // Track which channels this connection is subscribed to
  let channels = connectionChannels.get(ws);
  if (!channels) {
    channels = new Set();
    connectionChannels.set(ws, channels);
  }
  channels.add(channel);
}

/**
 * Unsubscribe a WebSocket connection from a channel.
 */
export function unsubscribe(ws: WebSocket, channel: string): void {
  const subscribers = channelSubscribers.get(channel);
  if (subscribers) {
    subscribers.delete(ws);
    if (subscribers.size === 0) {
      channelSubscribers.delete(channel);
    }
  }

  const channels = connectionChannels.get(ws);
  if (channels) {
    channels.delete(channel);
    if (channels.size === 0) {
      connectionChannels.delete(ws);
    }
  }
}

/**
 * Remove a WebSocket connection from all channels (on disconnect).
 */
export function unsubscribeAll(ws: WebSocket): void {
  const channels = connectionChannels.get(ws);
  if (!channels) return;

  for (const channel of channels) {
    const subscribers = channelSubscribers.get(channel);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        channelSubscribers.delete(channel);
      }
    }
  }

  connectionChannels.delete(ws);
}

/**
 * Get all WebSocket connections subscribed to a channel.
 */
export function getSubscribers(channel: string): Set<WebSocket> {
  return channelSubscribers.get(channel) ?? new Set();
}
