import { useState, useEffect } from 'react';
import { X, MessageCircle, Image, Mic, Video, FileText, File } from 'lucide-react';
import { useLocation } from 'wouter';

interface NotificationToastProps {
  name: string;
  phone: string;
  message: string;
  messageType?: string;
  profilePicture?: string | null;
  conversationId?: number;
  onClose: () => void;
}

export function NotificationToast({
  name,
  phone,
  message,
  messageType = 'text',
  profilePicture,
  conversationId,
  onClose
}: NotificationToastProps) {
  const [, setLocation] = useLocation();
  const [isLeaving, setIsLeaving] = useState(false);

  // Auto close after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  const handleViewChat = () => {
    if (conversationId) {
      setLocation(`/chat?conversaId=${conversationId}`);
    } else {
      setLocation('/chat');
    }
    handleClose();
  };

  // Format message based on type
  const getMessageContent = () => {
    switch (messageType) {
      case 'image':
        return '📷 Foto';
      case 'video':
        return '🎥 Vídeo';
      case 'audio':
        return '🎵 Áudio';
      case 'ptt':
        return '🎤 Mensagem de voz';
      case 'document':
        return '📎 Documento';
      case 'sticker':
        return '✨ Figurinha';
      default:
        return message.length > 100 ? message.substring(0, 100) + '...' : message;
    }
  };

  const getMessageIcon = () => {
    switch (messageType) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'audio':
      case 'ptt':
        return <Mic className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'sticker':
        return <File className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className={`fixed top-20 right-4 z-[9999] animate-in slide-in-from-right-5 ${isLeaving ? 'animate-out slide-out-to-right-5' : ''}`}>
      <div className="bg-gradient-to-br from-green-700 to-green-800 text-white rounded-lg shadow-2xl overflow-hidden max-w-sm border border-green-600/30">
        {/* Header */}
        <div className="bg-black/30 px-4 py-2 flex items-center justify-between border-b border-green-600/20">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Nova mensagem WhatsApp</span>
          </div>
          <button
            onClick={handleClose}
            className="hover:bg-white/20 rounded p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex gap-3">
            {/* Profile Picture */}
            <div className="flex-shrink-0">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <span className="text-lg font-semibold">
                    {name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* Message Info */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white">
                {name || 'Desconhecido'}
              </div>
              <div className="text-xs text-white/80 mb-1">
                {phone}
              </div>
              <div className="text-sm text-white/90 break-words flex items-center gap-1">
                {getMessageIcon()}
                <span>{getMessageContent()}</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleViewChat}
            className="mt-3 w-full bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 font-medium shadow-lg"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Ver Conversa</span>
          </button>
        </div>
      </div>
    </div>
  );
}