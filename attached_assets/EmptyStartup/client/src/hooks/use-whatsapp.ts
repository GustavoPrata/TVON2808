import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from './use-websocket';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';

export function useWhatsApp() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('close');
  const { onMessage, offMessage } = useWebSocket();

  const { data: whatsappStatus, refetch } = useQuery({
    queryKey: ['/api/whatsapp/status'],
    queryFn: api.getWhatsAppStatus,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (whatsappStatus) {
      setConnectionStatus(whatsappStatus.status.connection);
      setQrCode(whatsappStatus.qr || null);
    }
  }, [whatsappStatus]);

  useEffect(() => {
    // Listen for WebSocket events
    onMessage('whatsapp_qr', (data) => {
      setQrCode(data.qr);
    });

    onMessage('whatsapp_message', (data) => {
      // Handle incoming WhatsApp messages
      console.log('WhatsApp message received:', data);
    });

    return () => {
      offMessage('whatsapp_qr');
      offMessage('whatsapp_message');
    };
  }, [onMessage, offMessage]);

  const disconnect = async () => {
    try {
      await api.disconnectWhatsApp();
      setConnectionStatus('close');
      setQrCode(null);
      refetch();
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
    }
  };

  const reconnect = () => {
    refetch();
  };

  return {
    qrCode,
    connectionStatus,
    isConnected: connectionStatus === 'open',
    isConnecting: connectionStatus === 'connecting',
    disconnect,
    reconnect,
  };
}
