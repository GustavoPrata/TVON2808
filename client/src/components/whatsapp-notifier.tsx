import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Bell } from 'lucide-react';

export function WhatsAppNotifier() {
  const { onMessage, offMessage } = useWebSocket();
  const { toast } = useToast();
  const [location] = useLocation();

  useEffect(() => {
    // Handle new WhatsApp messages globally
    const handleNewMessage = (messageData: any) => {
      // Only show notification if not on chat page
      if (location !== '/chat' && messageData.remetente === 'cliente') {
        const truncatedMessage = messageData.conteudo?.length > 100 
          ? messageData.conteudo.substring(0, 100) + '...'
          : messageData.conteudo || 'Nova mensagem';

        toast({
          title: "📱 Nova mensagem WhatsApp",
          description: truncatedMessage,
          action: (
            <button
              onClick={() => window.location.href = '/chat'}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 rounded-md text-sm"
            >
              Ver Chat
            </button>
          ),
          duration: 5000,
        });

        // Play notification sound if available
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}
      }
    };

    // Handle WhatsApp connection status changes
    const handleConnectionUpdate = (data: any) => {
      if (!data.connected && location !== '/chat') {
        toast({
          title: "⚠️ WhatsApp Desconectado",
          description: "A conexão com o WhatsApp foi perdida",
          variant: "destructive",
        });
      }
    };

    // Handle new conversations created
    const handleConversationCreated = (data: any) => {
      if (location !== '/chat') {
        toast({
          title: "💬 Nova conversa",
          description: `Nova conversa iniciada com ${data.nome || 'cliente'}`,
          action: (
            <button
              onClick={() => window.location.href = '/chat'}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 rounded-md text-sm"
            >
              Abrir Chat
            </button>
          ),
        });
      }
    };

    // Register handlers
    onMessage('whatsapp_message', handleNewMessage);
    onMessage('disconnected', handleConnectionUpdate);
    onMessage('conversation_created', handleConversationCreated);

    // Cleanup
    return () => {
      offMessage('whatsapp_message');
      offMessage('disconnected');
      offMessage('conversation_created');
    };
  }, [location, onMessage, offMessage, toast]);

  // Don't render anything visible - this is just for notifications
  return null;
}