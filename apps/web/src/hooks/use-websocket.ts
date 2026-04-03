import { useEffect, useSyncExternalStore } from 'react';
import {
  subscribe,
  unsubscribe,
  getConnectionState,
  onStateChange,
} from '../lib/websocket';

/**
 * Subscribe to WebSocket channels on mount and unsubscribe on unmount.
 * Returns the current connection state.
 */
export function useWebSocket(channels: string[]): { isConnected: boolean } {
  // Serialize channels to detect changes without causing reference issues
  const channelsKey = channels.join(',');

  useEffect(() => {
    const current = channelsKey.split(',').filter(Boolean);

    for (const channel of current) {
      subscribe(channel);
    }

    return () => {
      for (const channel of current) {
        unsubscribe(channel);
      }
    };
  }, [channelsKey]);

  const state = useSyncExternalStore(
    onStateChange,
    getConnectionState,
    // Server snapshot (SSR)
    () => 'disconnected' as const,
  );

  return { isConnected: state === 'connected' };
}
