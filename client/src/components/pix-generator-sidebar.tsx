import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  DollarSign, Loader2, Copy, RefreshCw, Plus, 
  CheckCircle, Clock, XCircle, X, AlertCircle,
  CreditCard, Calendar, Hash
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PixGeneratorSidebarProps {
  clienteId: number;
  clienteNome: string;
  telefone: string;
  sendMessage: (event: string, data: any) => void;
  onPixGenerated?: (pixData: any) => void;
}

export function PixGeneratorSidebar({ 
  clienteId, 
  clienteNome, 
  telefone, 
  sendMessage,
  onPixGenerated 
}: PixGeneratorSidebarProps) {
  const { toast } = useToast();
  const [pixAmount, setPixAmount] = useState('');
  const [pixDescription, setPixDescription] = useState('');
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [lastPixPayment, setLastPixPayment] = useState<{
    status: string;
    valor: string;
    qrCode?: string;
    pixCopiaCola?: string;
    chargeId?: string;
    expiresIn?: string;
    timestamp?: Date;
    descricao?: string;
  } | null>(null);

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = Number(numbers) / 100;
    return amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 6) { // Max 9999.99
      setPixAmount(value);
    }
  };

  const handleGeneratePix = async () => {
    if (!pixAmount) {
      toast({
        title: "⚠️ Campo Obrigatório",
        description: "Por favor, insira o valor do PIX",
        variant: "destructive"
      });
      return;
    }

    const amount = Number(pixAmount) / 100;
    if (amount < 1) {
      toast({
        title: "⚠️ Valor Mínimo",
        description: "O valor mínimo para PIX é R$ 1,00",
        variant: "destructive"
      });
      return;
    }

    if (amount > 9999.99) {
      toast({
        title: "⚠️ Valor Máximo",
        description: "O valor máximo para PIX é R$ 9.999,99",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingPix(true);

    try {
      // Log para debug
      console.log('[PIX] Iniciando geração:', {
        clienteId,
        telefone,
        valor: amount,
        descricao: pixDescription || `Pagamento TV ON - ${clienteNome}`
      });

      // Chamar API para gerar PIX
      const responseRaw = await apiRequest('POST', '/api/pix/generate', {
        clienteId,
        valor: amount,
        descricao: pixDescription || `Pagamento TV ON - ${clienteNome}`
      });
      
      // Converter resposta para JSON
      const response = await responseRaw.json();
      console.log('[PIX] Resposta da API:', response);

      if (response.success && response.pixData) {
        const pixData = response.pixData;
        
        // Armazenar dados do PIX
        const pixInfo = {
          status: 'pendente',
          valor: formatCurrency(pixAmount),
          qrCode: pixData.qrCode,
          pixCopiaCola: pixData.pixCopiaCola,
          chargeId: pixData.chargeId,
          expiresIn: pixData.expiresIn || '24 horas',
          timestamp: new Date(),
          descricao: pixDescription || 'Pagamento TV ON'
        };
        
        setLastPixPayment(pixInfo);

        // Callback opcional
        if (onPixGenerated) {
          onPixGenerated(pixInfo);
        }

        // Enviar mensagens para WhatsApp com delay adequado
        const sendMessagesToWhatsApp = async () => {
          try {
            // 1. Mensagem informativa
            console.log('[PIX] Enviando mensagem informativa');
            sendMessage('send_message', {
              telefone: telefone,
              tipo: 'text',
              conteudo: `💳 *PIX GERADO COM SUCESSO*\n\n` +
                       `💰 *Valor:* R$ ${formatCurrency(pixAmount)}\n` +
                       `📝 *Descrição:* ${pixDescription || 'Pagamento TV ON'}\n` +
                       `⏰ *Validade:* ${pixData.expiresIn || '24 horas'}\n` +
                       `📊 *Status:* ⏳ Aguardando pagamento\n\n` +
                       `📱 *Como pagar:*\n` +
                       `1️⃣ Abra o app do seu banco\n` +
                       `2️⃣ Escolha a opção PIX\n` +
                       `3️⃣ Escaneie o QR Code abaixo ou\n` +
                       `4️⃣ Use o código Copia e Cola\n\n` +
                       `_Você receberá uma confirmação automática após o pagamento_`
            });

            // Aguardar 1 segundo
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 2. QR Code
            if (pixData.qrCode) {
              console.log('[PIX] Enviando QR Code:', pixData.qrCode);
              sendMessage('send_message', {
                telefone: telefone,
                tipo: 'image',
                conteudo: pixData.qrCode,
                caption: '📱 *QR Code PIX* - Escaneie com a câmera do seu banco'
              });
            }

            // Aguardar 1.5 segundos
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 3. Código PIX Copia e Cola
            if (pixData.pixCopiaCola) {
              console.log('[PIX] Enviando código PIX');
              sendMessage('send_message', {
                telefone: telefone,
                tipo: 'text',
                conteudo: `📋 *Código PIX Copia e Cola:*\n\n\`${pixData.pixCopiaCola}\`\n\n_Clique no código acima para copiar e cole no app do seu banco_`
              });
            }

            // Limpar campos após sucesso
            setPixAmount('');
            setPixDescription('');

            // Notificação de sucesso
            toast({
              title: "✅ PIX Enviado com Sucesso!",
              description: `PIX de R$ ${formatCurrency(pixAmount)} foi enviado para ${clienteNome}`,
            });

          } catch (error) {
            console.error('[PIX] Erro ao enviar mensagens:', error);
            toast({
              title: "⚠️ PIX Gerado",
              description: "PIX foi gerado mas houve erro ao enviar para WhatsApp",
              variant: "destructive"
            });
          }
        };

        // Executar envio de mensagens
        await sendMessagesToWhatsApp();

      } else {
        throw new Error(response.error || 'Erro ao gerar PIX');
      }
    } catch (error: any) {
      console.error('[PIX] Erro completo:', error);
      
      // Tentar extrair mensagem de erro do servidor
      let errorMessage = "Verifique a configuração do sistema";
      
      if (error instanceof Response) {
        try {
          const errorData = await error.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = error.statusText || errorMessage;
        }
      } else if (error.message) {
        // Extrair mensagem do erro se estiver no formato "400: {error: 'mensagem'}"
        try {
          const match = error.message.match(/\d+:\s*({.*})/);
          if (match) {
            const errorData = JSON.parse(match[1]);
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage = error.message;
          }
        } catch {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "❌ Erro ao Gerar PIX",
        description: errorMessage,
        variant: "destructive"
      });
      setLastPixPayment(null);
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const copyPixCode = () => {
    if (lastPixPayment?.pixCopiaCola) {
      navigator.clipboard.writeText(lastPixPayment.pixCopiaCola);
      toast({
        title: "📋 Copiado!",
        description: "Código PIX copiado para área de transferência",
      });
    }
  };

  const resetPix = () => {
    setLastPixPayment(null);
    setPixAmount('');
    setPixDescription('');
  };

  return (
    <div className="space-y-2 bg-gradient-to-br from-slate-900/95 to-slate-800/95 p-3 rounded-lg border border-slate-700 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-green-400 uppercase tracking-wide flex items-center">
          <CreditCard className="w-3.5 h-3.5 mr-1.5" />
          Gerador PIX Profissional
        </h4>
        {lastPixPayment && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetPix}
            className="h-5 w-5 p-0 hover:bg-slate-700/50 rounded-full"
          >
            <X className="w-3 h-3 text-slate-400" />
          </Button>
        )}
      </div>

      {!lastPixPayment ? (
        <div className="space-y-3">
          {/* Campo de Valor */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide">
              Valor do Pagamento *
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-green-400">
                R$
              </span>
              <Input
                type="text"
                placeholder="0,00"
                value={pixAmount ? formatCurrency(pixAmount) : ''}
                onChange={handleAmountChange}
                className="h-9 pl-9 pr-3 text-sm font-bold bg-slate-950/60 border-slate-600 
                         focus:border-green-500 focus:ring-1 focus:ring-green-500/30 
                         placeholder:text-slate-600"
                disabled={isGeneratingPix}
              />
              <DollarSign className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            </div>
            <p className="text-[9px] text-slate-500">Mínimo R$ 1,00 - Máximo R$ 9.999,99</p>
          </div>

          {/* Campo de Descrição */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide">
              Descrição (Opcional)
            </Label>
            <Input
              type="text"
              placeholder="Ex: Renovação mensal TV ON"
              value={pixDescription}
              onChange={(e) => setPixDescription(e.target.value)}
              maxLength={50}
              className="h-9 text-sm bg-slate-950/60 border-slate-600 
                       focus:border-green-500 focus:ring-1 focus:ring-green-500/30
                       placeholder:text-slate-600"
              disabled={isGeneratingPix}
            />
            <p className="text-[9px] text-slate-500">
              {pixDescription.length}/50 caracteres
            </p>
          </div>

          {/* Botão Gerar PIX */}
          <Button
            onClick={handleGeneratePix}
            disabled={!pixAmount || isGeneratingPix}
            className="w-full h-10 bg-gradient-to-r from-green-600 to-green-700 
                     hover:from-green-500 hover:to-green-600 text-white font-bold 
                     text-xs uppercase tracking-wide transition-all duration-300 
                     disabled:opacity-50 disabled:cursor-not-allowed 
                     shadow-lg shadow-green-900/30 hover:shadow-green-900/50"
          >
            {isGeneratingPix ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando PIX...
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4 mr-2" />
                Gerar Cobrança PIX
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Card de Status do PIX */}
          <div className={cn(
            "p-3 rounded-lg border-2 space-y-3 transition-all duration-300",
            lastPixPayment.status === 'pago'
              ? "bg-green-950/40 border-green-600/60"
              : lastPixPayment.status === 'pendente'
              ? "bg-amber-950/30 border-amber-600/50"
              : "bg-red-950/40 border-red-600/60"
          )}>
            {/* Badge de Status */}
            <div className="flex items-center justify-between">
              <div className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center",
                lastPixPayment.status === 'pago'
                  ? "bg-green-500/25 text-green-400"
                  : lastPixPayment.status === 'pendente'
                  ? "bg-amber-500/25 text-amber-400 animate-pulse"
                  : "bg-red-500/25 text-red-400"
              )}>
                {lastPixPayment.status === 'pago' && <CheckCircle className="w-3 h-3 mr-1.5" />}
                {lastPixPayment.status === 'pendente' && <Clock className="w-3 h-3 mr-1.5" />}
                {lastPixPayment.status === 'cancelado' && <XCircle className="w-3 h-3 mr-1.5" />}
                {lastPixPayment.status === 'pago' ? 'PAGO' :
                 lastPixPayment.status === 'pendente' ? 'AGUARDANDO' :
                 'CANCELADO'}
              </div>
              <span className="text-sm font-black text-white">
                R$ {lastPixPayment.valor}
              </span>
            </div>

            {/* Informações do PIX */}
            <div className="space-y-2 pt-2 border-t border-slate-700/50">
              {lastPixPayment.descricao && (
                <div className="flex items-start gap-2 text-[10px]">
                  <AlertCircle className="w-3 h-3 text-slate-500 mt-0.5" />
                  <div>
                    <span className="text-slate-500">Descrição:</span>
                    <p className="text-slate-300 font-medium">{lastPixPayment.descricao}</p>
                  </div>
                </div>
              )}
              
              {lastPixPayment.chargeId && (
                <div className="flex items-center gap-2 text-[10px]">
                  <Hash className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-500">ID:</span>
                  <span className="text-slate-300 font-mono">
                    {lastPixPayment.chargeId.substring(0, 16)}...
                  </span>
                </div>
              )}

              {lastPixPayment.expiresIn && lastPixPayment.status === 'pendente' && (
                <div className="flex items-center gap-2 text-[10px]">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-500">Validade:</span>
                  <span className="text-slate-300 font-medium">{lastPixPayment.expiresIn}</span>
                </div>
              )}

              {lastPixPayment.timestamp && (
                <div className="flex items-center gap-2 text-[10px]">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-500">Gerado às:</span>
                  <span className="text-slate-300 font-medium">
                    {new Date(lastPixPayment.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Botões de Ação */}
            {lastPixPayment.status === 'pendente' && (
              <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                {lastPixPayment.pixCopiaCola && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyPixCode}
                    className="flex-1 h-8 text-[10px] font-bold border-slate-600 
                             hover:bg-slate-800/50 hover:border-green-500 
                             transition-all duration-200"
                  >
                    <Copy className="w-3 h-3 mr-1.5" />
                    COPIAR CÓDIGO PIX
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetPix}
                  className="h-8 px-3 text-[10px] border-slate-600 
                           hover:bg-slate-800/50 hover:border-red-500
                           transition-all duration-200"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Botão Gerar Novo */}
          {lastPixPayment.status !== 'pendente' && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetPix}
              className="w-full h-9 text-xs font-bold border-slate-600 
                       hover:bg-slate-800/50 hover:border-green-500
                       transition-all duration-200"
            >
              <Plus className="w-3.5 h-3.5 mr-2" />
              GERAR NOVO PIX
            </Button>
          )}
        </div>
      )}
    </div>
  );
}