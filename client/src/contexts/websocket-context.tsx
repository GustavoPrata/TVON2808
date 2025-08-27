import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

interface WSMessage {
  type: string;
  data?: any;
}

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (type: string, data: any) => void;
  onMessage: (type: string, handler: (data: any) => void) => void;
  offMessage: (type: string) => void;
  messages: WSMessage[];
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  // Function to connect WebSocket
  const connectWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Connecting WebSocket globally...');
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected globally');
      
      // Clear any reconnection timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        console.log('Global WebSocket message received:', message);
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

        // Notifications are handled by WhatsAppNotifier component
        // No need to show toast here as it would duplicate notifications
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected - attempting reconnection...');
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(() => {
        console.log('Reconnecting WebSocket...');
        connectWebSocket();
      }, 3000);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  useEffect(() => {
    // Connect on mount
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendMessage = (type: string, data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, ...data }));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  };

  const onMessage = (type: string, handler: (data: any) => void) => {
    messageHandlers.current.set(type, handler);
  };

  const offMessage = (type: string) => {
    messageHandlers.current.delete(type);
  };

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      messages,
      sendMessage,
      onMessage,
      offMessage,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}