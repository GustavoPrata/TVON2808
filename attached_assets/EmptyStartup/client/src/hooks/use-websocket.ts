import { useEffect, useRef, useState } from 'react';
import type { WSMessage } from '@/types';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        console.log('WebSocket message received:', message);
        console.log('Message type:', message.type);
        console.log('Registered handlers:', Array.from(messageHandlers.current.keys()));
        setMessages(prev => [...prev, message]);
        
        // Call registered handler if exists
        const handler = messageHandlers.current.get(message.type);
        if (handler) {
          console.log('Calling handler for type:', message.type);
          handler(message.data);
        } else {
          console.log('No handler found for type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendMessage = (type: string, data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, ...data }));
    }
  };

  const onMessage = (type: string, handler: (data: any) => void) => {
    messageHandlers.current.set(type, handler);
  };

  const offMessage = (type: string) => {
    messageHandlers.current.delete(type);
  };

  return {
    isConnected,
    messages,
    sendMessage,
    onMessage,
    offMessage,
  };
}
