import { useEffect, useRef } from 'react';
import { offMessage, onMessage } from '../lib/websocket';

/**
 * Listen for a specific WebSocket event type.
 * Uses useRef for handler to avoid re-registering on every render.
 */
export function useWebSocketEvent(type: string, handler: (data: unknown) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stableHandler = (data: unknown) => {
      handlerRef.current(data);
    };

    onMessage(type, stableHandler);
    return () => offMessage(type, stableHandler);
  }, [type]);
}
