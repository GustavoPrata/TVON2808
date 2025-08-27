import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  DollarSign, Loader2, Copy, RefreshCw, QrCode,
  CheckCircle, Clock, XCircle, X, AlertCircle,
  Send, Timer, Trash2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PixGeneratorSidebarProps {
  clienteId?: number;  // Opcional - para suportar conversas sem cliente
  clienteNome: string;
  telefone: string;
  sendMessage: (event: string, data: any) => void;
  onPixGenerated?: (pixData: any) => void;
  initialState?: any;  // Estado inicial do PIX para esta conversa
  onStateChange?: (state: any) => void;  // Callback para salvar o estado
}

export function PixGeneratorSidebar({ 
  clienteId, 
  clienteNome, 
  telefone, 
  sendMessage,
  onPixGenerated,
  initialState,
  onStateChange 
}: PixGeneratorSidebarProps) {
  const { toast } = useToast();
  const [pixAmount, setPixAmount] = useState(initialState?.pixAmount || '');
  const [pixDescription, setPixDescription] = useState(initialState?.pixDescription || '');
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [pixConfig, setPixConfig] = useState<{ expiresIn: number }>({ expiresIn: 86400 }); // 24h padrão
  const [activePixData, setActivePixData] = useState<{
    status: string;
    valor: string;
    qrCode?: string;
    pixCopiaCola?: string;
    chargeId?: string;
    expiresIn?: string;
    timestamp?: Date;
    descricao?: string;
  } | null>(initialState?.activePixData || null);
  const [quickValues] = useState([29.90, 19.90]);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [pixHistory, setPixHistory] = useState<any[]>(initialState?.pixHistory || []);
  
  // Use initialState directly in useState to avoid extra renders
  // Component is already recreated when conversation changes due to key prop
  
  // Buscar configuração PIX ao montar
  useEffect(() => {
    fetch('/api/pix/config')
      .then(res => res.json())
      .then(data => {
        if (data.expiresIn) {
          setPixConfig({ expiresIn: data.expiresIn });
        }
      })
      .catch(err => console.error('Erro ao buscar configuração PIX:', err));
  }, []);
  
  // Salvar estado quando mudar (com debounce para evitar loops)
  useEffect(() => {
    if (!onStateChange) return;
    
    const timer = setTimeout(() => {
      onStateChange({
        activePixData,
        pixHistory,
        pixAmount,
        pixDescription
      });
    }, 300); // Debounce de 300ms
    
    return () => clearTimeout(timer);
  }, [activePixData, pixHistory, pixAmount, pixDescription, onStateChange]);

  // Countdown timer para PIX ativo
  useEffect(() => {
    if (!activePixData || activePixData.status !== 'pendente') {
      setTimeRemaining('');
      return;
    }

    const interval = setInterval(() => {
      if (activePixData.timestamp) {
        const created = new Date(activePixData.timestamp).getTime();
        const now = new Date().getTime();
        const elapsed = now - created;
        const maxTime = pixConfig.expiresIn * 1000; // converter segundos para milissegundos
        const remaining = maxTime - elapsed;

        if (remaining <= 0) {
          setActivePixData(prev => prev ? { ...prev, status: 'expirado' } : null);
          setTimeRemaining('Expirado');
          clearInterval(interval);
        } else {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activePixData, pixConfig.expiresIn]);

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

  const setQuickValue = (value: number) => {
    const cents = Math.round(value * 100);
    setPixAmount(cents.toString());
  };

  const cancelCurrentPix = async () => {
    if (!activePixData?.chargeId) return;

    setIsCancelling(true);
    try {
      // Aqui você pode adicionar uma chamada para cancelar o PIX na API
      // await apiRequest('POST', `/api/pix/cancel/${activePixData.chargeId}`);
      
      setActivePixData(prev => prev ? { ...prev, status: 'cancelado' } : null);
      
      // Adicionar ao histórico
      if (activePixData) {
        setPixHistory(prev => [...prev, { ...activePixData, status: 'cancelado', cancelledAt: new Date() }]);
      }

      toast({
        title: "✅ PIX Cancelado",
        description: "A cobrança PIX foi cancelada com sucesso",
      });

      // Limpar após 2 segundos
      setTimeout(() => {
        setActivePixData(null);
        setPixAmount('');
        setPixDescription('');
      }, 2000);

    } catch (error) {
      toast({
        title: "❌ Erro ao Cancelar",
        description: "Não foi possível cancelar o PIX",
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleGeneratePix = async () => {
    if (!pixAmount) {
      toast({
        title: "Campo Obrigatório",
        description: "Insira o valor do PIX",
        variant: "destructive"
      });
      return;
    }

    const amount = Number(pixAmount) / 100;
    if (amount < 1) {
      toast({
        title: "Valor Inválido",
        description: "Valor mínimo: R$ 1,00",
        variant: "destructive"
      });
      return;
    }

    if (amount > 9999.99) {
      toast({
        title: "Valor Inválido", 
        description: "Valor máximo: R$ 9.999,99",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingPix(true);

    try {
      const responseRaw = await apiRequest('POST', '/api/pix/generate', {
        clienteId: clienteId || null,  // Pode ser null para conversas sem cliente
        telefone: telefone,  // Usar telefone como identificador adicional
        valor: amount,
        descricao: pixDescription || `Pagamento - ${clienteNome}`
      });
      
      const response = await responseRaw.json();

      if (response.success && response.pixData) {
        const pixData = response.pixData;
        
        const pixInfo = {
          status: 'pendente',
          valor: formatCurrency(pixAmount),
          qrCode: pixData.qrCode,
          pixCopiaCola: pixData.pixCopiaCola,
          chargeId: pixData.chargeId,
          expiresIn: '30 minutos',
          timestamp: new Date(),
          descricao: pixDescription || `Pagamento - ${clienteNome}`
        };
        
        setActivePixData(pixInfo);

        if (onPixGenerated) {
          onPixGenerated(pixInfo);
        }

        // Enviar para WhatsApp
        await sendPixToWhatsApp(pixInfo);

        toast({
          title: "✅ PIX Gerado!",
          description: `Valor: R$ ${formatCurrency(pixAmount)}`,
        });

      } else {
        throw new Error(response.error || 'Erro ao gerar PIX');
      }
    } catch (error: any) {
      let errorMessage = "Verifique a configuração";
      
      if (error.message) {
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
        title: "❌ Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const sendPixToWhatsApp = async (pixInfo: any) => {
    try {
      // Formatar tempo de validade
      const hours = Math.floor(pixConfig.expiresIn / 3600);
      const minutes = Math.floor((pixConfig.expiresIn % 3600) / 60);
      let validadeText = '';
      if (hours > 0) {
        validadeText += `${hours}h`;
        if (minutes > 0) validadeText += ` ${minutes}min`;
      } else {
        validadeText = `${minutes} minutos`;
      }
      
      // Primeira mensagem - QR Code (somente a imagem, sem caption)
      if (pixInfo.qrCode) {
        sendMessage('send_message', {
          telefone: telefone,
          tipo: 'image',
          conteudo: pixInfo.qrCode,
          mediaUrl: pixInfo.qrCode
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Segunda mensagem - Código PIX Copia e Cola
      if (pixInfo.pixCopiaCola) {
        sendMessage('send_message', {
          telefone: telefone,
          tipo: 'text',
          conteudo: pixInfo.pixCopiaCola
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Terceira mensagem - Instruções de pagamento
      sendMessage('send_message', {
        telefone: telefone,
        tipo: 'text',
        conteudo: `Valor: R$ ${pixInfo.valor}\n` +
                 `Validade: ${validadeText}\n\n` +
                 `Como pagar:\n` +
                 `1️⃣ Abra o app do seu banco\n` +
                 `2️⃣ Escaneie o QR Code ou use o código Copia e Cola`
      });

      // Limpar formulário
      setPixAmount('');
      setPixDescription('');

    } catch (error) {
      console.error('Erro ao enviar PIX:', error);
    }
  };

  const copyPixCode = () => {
    if (activePixData?.pixCopiaCola) {
      navigator.clipboard.writeText(activePixData.pixCopiaCola);
      toast({
        title: "Copiado!",
        description: "Código PIX na área de transferência",
      });
    }
  };

  const resetForm = () => {
    setActivePixData(null);
    setPixAmount('');
    setPixDescription('');
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900/90 to-slate-800/90 rounded-lg border border-slate-700/50">
      {/* Header Compacto */}
      <div className="px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-slate-200">Cobrança PIX</span>
          </div>
          {activePixData && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="h-6 w-6 p-0 hover:bg-slate-700/50"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!activePixData ? (
          <>
            {/* Valores Rápidos */}
            <div className="grid grid-cols-2 gap-2">
              {quickValues.map(value => (
                <Button
                  key={value}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickValue(value)}
                  className="h-8 text-xs font-bold border-slate-600 hover:bg-green-600/20 hover:border-green-500"
                >
                  R$ {value.toFixed(2).replace('.', ',')}
                </Button>
              ))}
            </div>

            {/* Campo Valor */}
            <div>
              <Label className="text-[10px] text-slate-400 uppercase">Valor</Label>
              <div className="relative mt-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-green-400">R$</span>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={pixAmount ? formatCurrency(pixAmount) : ''}
                  onChange={handleAmountChange}
                  className="h-8 pl-8 text-sm font-bold bg-slate-950/50 border-slate-600 focus:border-green-500"
                  disabled={isGeneratingPix}
                />
              </div>
            </div>

            {/* Campo Descrição */}
            <div>
              <Label className="text-[10px] text-slate-400 uppercase">Descrição</Label>
              <Input
                type="text"
                placeholder="Pagamento mensal"
                value={pixDescription}
                onChange={(e) => setPixDescription(e.target.value.slice(0, 40))}
                className="h-8 mt-1 text-xs bg-slate-950/50 border-slate-600 focus:border-green-500"
                disabled={isGeneratingPix}
              />
            </div>

            {/* Botão Gerar */}
            <Button
              onClick={handleGeneratePix}
              disabled={!pixAmount || isGeneratingPix}
              className="w-full h-9 bg-green-600 hover:bg-green-500 text-white font-bold text-xs"
            >
              {isGeneratingPix ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Gerar
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            {/* Status Card */}
            <div className={cn(
              "p-2.5 rounded-lg border",
              activePixData.status === 'pendente' 
                ? "bg-amber-950/30 border-amber-600/40" 
                : activePixData.status === 'pago'
                ? "bg-green-950/30 border-green-600/40"
                : activePixData.status === 'cancelado'
                ? "bg-red-950/30 border-red-600/40"
                : "bg-slate-800/30 border-slate-600/40"
            )}>
              {/* Status Badge */}
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1",
                  activePixData.status === 'pendente' && "bg-amber-500/20 text-amber-400",
                  activePixData.status === 'pago' && "bg-green-500/20 text-green-400",
                  activePixData.status === 'cancelado' && "bg-red-500/20 text-red-400",
                  activePixData.status === 'expirado' && "bg-slate-500/20 text-slate-400"
                )}>
                  {activePixData.status === 'pendente' && <Clock className="w-3 h-3" />}
                  {activePixData.status === 'pago' && <CheckCircle className="w-3 h-3" />}
                  {activePixData.status === 'cancelado' && <XCircle className="w-3 h-3" />}
                  {activePixData.status === 'expirado' && <Timer className="w-3 h-3" />}
                  {activePixData.status.toUpperCase()}
                </div>
                {timeRemaining && activePixData.status === 'pendente' && (
                  <span className="text-[10px] font-mono text-amber-400">
                    {timeRemaining}
                  </span>
                )}
              </div>

              {/* Valor */}
              <div className="text-center py-1">
                <div className="text-xl font-black text-white">R$ {activePixData.valor}</div>
                <div className="text-[10px] text-slate-400">{activePixData.descricao}</div>
              </div>

              {/* Ações */}
              {activePixData.status === 'pendente' && (
                <div className="flex gap-1.5 mt-2">
                  {activePixData.pixCopiaCola && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyPixCode}
                      className="flex-1 h-7 border-slate-600 hover:bg-slate-700 hover:border-slate-500"
                      title="Copiar código PIX"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelCurrentPix}
                    disabled={isCancelling}
                    className="h-7 w-7 p-0 border-red-600/50 hover:bg-red-950/30 text-red-400"
                    title="Cancelar PIX"
                  >
                    {isCancelling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Novo PIX */}
            {activePixData.status !== 'pendente' && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="w-full h-8 text-[10px] font-bold border-slate-600 hover:bg-slate-700"
              >
                <RefreshCw className="w-3 h-3 mr-1.5" />
                NOVO PIX
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 border-t border-slate-700/50">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-500">Cliente: {clienteNome}</span>
          <span className="text-[9px] text-slate-500">Tel: {telefone.slice(-9)}</span>
        </div>
      </div>
    </div>
  );
}