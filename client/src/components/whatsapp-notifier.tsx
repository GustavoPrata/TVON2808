import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useSettings } from '@/contexts/settings-context';
import { useLocation } from 'wouter';
import { createPortal } from 'react-dom';
import { NotificationToast } from './notification-toast';
import { useQuery } from '@tanstack/react-query';

interface ActiveNotification {
  id: string;
  name: string;
  phone: string;
  message: string;
  profilePicture?: string | null;
  conversationId?: number;
}

export function WhatsAppNotifier() {
  const { onMessage, offMessage } = useWebSocket();
  const { notificationsSilenced } = useSettings();
  const [location] = useLocation();
  const [activeNotifications, setActiveNotifications] = useState<ActiveNotification[]>([]);
  
  // Fetch conversations to get contact info
  const { data: conversations } = useQuery({
    queryKey: ['/api/conversas'],
    refetchInterval: 5000,
  });

  useEffect(() => {
    // Handle new WhatsApp messages globally
    const handleNewMessage = (messageData: any) => {
      // Only show notification if not on chat page, not silenced, and from client
      if (location !== '/chat' && !notificationsSilenced && messageData.remetente === 'cliente') {
        // Find conversation info
        const conversation = conversations?.find((c: any) => c.id === messageData.conversaId);
        
        const notification: ActiveNotification = {
          id: `notification-${Date.now()}-${messageData.conversaId}`,
          name: conversation?.nome || 'Cliente',
          phone: conversation?.telefone || '',
          message: messageData.conteudo || '',
          profilePicture: conversation?.profilePicture,
          conversationId: messageData.conversaId,
        };

        // Remove any existing notification from the same conversation before adding new one
        setActiveNotifications(prev => {
          const filtered = prev.filter(n => n.conversationId !== messageData.conversaId);
          return [...filtered, notification];
        });

        // Play notification sound if available
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch {}
      }
    };

    // Handle new conversations created
    const handleConversationCreated = (data: any) => {
      if (location !== '/chat' && !notificationsSilenced) {
        const notification: ActiveNotification = {
          id: `notification-${Date.now()}-${data.id}`,
          name: data.nome || 'Novo Cliente',
          phone: data.telefone || '',
          message: 'Nova conversa iniciada',
          profilePicture: data.profilePicture,
          conversationId: data.id,
        };

        // Remove any existing notification from the same conversation before adding new one
        setActiveNotifications(prev => {
          const filtered = prev.filter(n => n.conversationId !== data.id);
          return [...filtered, notification];
        });
      }
    };

    // Register handlers
    onMessage('whatsapp_message', handleNewMessage);
    onMessage('conversation_created', handleConversationCreated);

    // Cleanup
    return () => {
      offMessage('whatsapp_message');
      offMessage('conversation_created');
    };
  }, [location, onMessage, offMessage, notificationsSilenced, conversations]);

  const removeNotification = (id: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Render notifications using portal
  return (
    <>
      {activeNotifications.map(notification => 
        createPortal(
          <NotificationToast
            key={notification.id}
            name={notification.name}
            phone={notification.phone}
            message={notification.message}
            profilePicture={notification.profilePicture}
            conversationId={notification.conversationId}
            onClose={() => removeNotification(notification.id)}
          />,
          document.body
        )
      )}
    </>
  );
}