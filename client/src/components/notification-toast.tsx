import { useState, useEffect } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { useLocation } from 'wouter';

interface NotificationToastProps {
  name: string;
  phone: string;
  message: string;
  profilePicture?: string | null;
  conversationId?: number;
  onClose: () => void;
}

export function NotificationToast({
  name,
  phone,
  message,
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

  // Format message - truncate if too long
  const formattedMessage = message.length > 100 
    ? message.substring(0, 100) + '...'
    : message;

  return (
    <div className={`fixed top-20 right-4 z-[9999] animate-in slide-in-from-right-5 ${isLeaving ? 'animate-out slide-out-to-right-5' : ''}`}>
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg shadow-2xl overflow-hidden max-w-sm">
        {/* Header */}
        <div className="bg-black/20 px-4 py-2 flex items-center justify-between">
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
              <div className="text-sm text-white/90 break-words">
                {formattedMessage}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleViewChat}
            className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Ver Conversa</span>
          </button>
        </div>
      </div>
    </div>
  );
}