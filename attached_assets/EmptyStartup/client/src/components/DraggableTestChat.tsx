import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, X, RotateCcw, Minus, Bot, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

interface DraggableTestChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DraggableTestChat({ isOpen, onClose }: DraggableTestChatProps) {
  // Fixed test number as requested - with country code for proper matching
  const FIXED_PHONE = '5514999887766';
  const DISPLAY_PHONE = '14999887766'; // For display without country code
  
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const chatRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Initialize position
  useEffect(() => {
    setPosition({ 
      x: Math.min(window.innerWidth - 380, window.innerWidth - 400),
      y: 100 
    });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof Element && e.target.closest('.chat-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      animationRef.current = requestAnimationFrame(() => {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        // Keep within screen bounds
        const maxX = window.innerWidth - 380;
        const maxY = window.innerHeight - 150;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const resetBot = async () => {
    try {
      setIsLoading(true);
      
      // Reset bot state using the correct endpoint
      const response = await fetch('/api/whatsapp/reset-bot-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: FIXED_PHONE })
      });

      if (!response.ok) {
        throw new Error('Erro ao resetar bot');
      }
      
      setMessage('');
      
      toast({
        title: "Bot resetado",
        description: "Conversa do bot foi reiniciada",
      });
    } catch (error) {
      console.error('Erro ao resetar:', error);
      toast({
        title: "Erro",
        description: "Falha ao resetar o bot",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const currentMessage = message;
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/whatsapp/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: FIXED_PHONE,
          mensagem: currentMessage
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar mensagem');
      }

      await response.json();
      
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: "Falha ao processar mensagem",
        variant: "destructive"
      });
      setMessage(currentMessage); // Restore message on error
    } finally {
      setIsLoading(false);
    }
  };

  const openConversation = () => {
    // Navigate to chat page with the test phone number
    // The chat page will handle finding or creating the conversation
    setLocation(`/chat?phone=${FIXED_PHONE}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={chatRef}
      className={cn(
        "fixed z-50 shadow-2xl",
        isDragging && "cursor-move select-none"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '360px',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s'
      }}
      onMouseDown={handleMouseDown}
    >
      <Card className="bg-dark-surface border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="chat-header bg-gradient-to-r from-blue-500 to-blue-600 p-3 cursor-move">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#000000]" />
              <div>
                <h3 className="font-semibold text-sm text-[#000000]">Teste do Bot</h3>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:bg-white/20 text-[#000000]"
                onClick={(e) => {
                  e.stopPropagation();
                  openConversation();
                }}
                title="Abrir conversa"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:bg-white/20 text-[#000000]"
                onClick={(e) => {
                  e.stopPropagation();
                  resetBot();
                }}
                disabled={isLoading}
                title="Resetar bot"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:bg-white/20 text-[#000000]"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                title="Minimizar"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:bg-white/20 text-[#000000]"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Body - Quick buttons and input for testing */}
        {!isMinimized && (
          <div className="p-3 bg-[#000000]">
            {/* Quick number buttons */}
            <div className="grid grid-cols-5 gap-1 mb-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((num) => (
                <Button
                  key={num}
                  onClick={async () => {
                    if (isLoading) return;
                    setIsLoading(true);
                    try {
                      const response = await fetch('/api/whatsapp/simulate-message', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          telefone: FIXED_PHONE,
                          mensagem: num,
                        }),
                      });

                      if (!response.ok) {
                        const error = await response.json();
                        console.error('Erro ao enviar:', error);
                      }
                    } catch (error) {
                      console.error('Erro ao simular mensagem:', error);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm h-8 px-0"
                  variant="outline"
                >
                  {num}
                </Button>
              ))}
            </div>
            
            {/* Text input for custom messages */}
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ou digite uma mensagem..."
                className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 text-sm"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !message.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}