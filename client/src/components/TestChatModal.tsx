import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Send, Phone, User, Bot, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface Message {
  id: number;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface TestChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TestChatModal({ isOpen, onClose }: TestChatModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('5514999887766');
  const [clientName, setClientName] = useState('João Teste');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const resetBotState = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/whatsapp/reset-bot-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: phoneNumber })
      });

      if (!response.ok) throw new Error('Erro ao resetar estado');
      
      setMessages([]);
      toast({
        title: "Estado resetado",
        description: "Conversa limpa e bot reiniciado",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao resetar estado do bot",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createTestClient = async () => {
    try {
      setIsLoading(true);
      
      // Primeiro, cria o cliente teste
      const clientResponse = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: clientName,
          telefone: phoneNumber.replace(/\D/g, ''),
          email: `${phoneNumber}@teste.com`,
          cpf: '00000000000',
          plano: 'premium',
          valor: 49.90,
          vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'ativo',
          observacoes: 'Cliente de teste para bot'
        })
      });

      if (!clientResponse.ok) {
        const error = await clientResponse.json();
        throw new Error(error.message || 'Erro ao criar cliente');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      
      toast({
        title: "Cliente criado",
        description: `${clientName} agora é um cliente ativo`,
      });

      // Reseta o estado do bot para começar limpo
      await resetBotState();
      
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar cliente teste",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now(),
      content: message,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/whatsapp/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: phoneNumber,
          mensagem: userMessage.content
        })
      });

      if (!response.ok) throw new Error('Erro ao enviar mensagem');

      const data = await response.json();
      
      // Aguarda um pouco para dar tempo do bot processar
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Busca a resposta do bot
      const messagesResponse = await fetch(`/api/mensagens/conversa/teste/${phoneNumber}`);
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const lastBotMessage = messagesData
          .filter((m: any) => m.remetente === 'sistema')
          .pop();
        
        if (lastBotMessage) {
          const botMessage: Message = {
            id: Date.now() + 1,
            content: lastBotMessage.conteudo,
            sender: 'bot',
            timestamp: new Date(lastBotMessage.timestamp)
          };
          setMessages(prev => [...prev, botMessage]);
        }
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-green-600 to-green-700 text-white">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            Teste do Bot - Simulador de Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* Configuração do teste */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Número do Teste
              </label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="5514999887766"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome do Cliente
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="João Teste"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <Button
              onClick={createTestClient}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Criar Cliente Teste
            </Button>
            <Button
              onClick={resetBotState}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Resetar Conversa
            </Button>
          </div>

          {/* Área de chat */}
          <Card className="flex-1 bg-gray-50 dark:bg-gray-900">
            <ScrollArea 
              ref={scrollRef}
              className="h-[350px] p-4"
            >
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Envie uma mensagem para iniciar o teste</p>
                    <p className="text-xs mt-2">Dica: Digite "oi" para começar</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.sender === 'user'
                            ? 'bg-green-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        <div className={`text-xs mt-1 ${
                          msg.sender === 'user' ? 'text-green-100' : 'text-gray-500'
                        }`}>
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Input de mensagem */}
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !message.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}