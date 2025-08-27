// This hook is now a wrapper around the WebSocketContext
// to maintain backward compatibility
import { useWebSocketContext } from '@/contexts/websocket-context';

export function useWebSocket() {
  // Simply delegate to the context
  return useWebSocketContext();
}