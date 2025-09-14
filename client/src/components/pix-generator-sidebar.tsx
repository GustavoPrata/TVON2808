import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  DollarSign, Loader2, Copy, RefreshCw, QrCode,
  CheckCircle, Clock, XCircle, X, AlertCircle,
  Send, Timer, Trash2, CheckCircle2, AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [pixConfig, setPixConfig] = useState<{ expiresIn: number }>({ expiresIn: 86400 }); // 24h padrão
  const [existingPayments, setExistingPayments] = useState<any[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [quickValues] = useState([29.90, 19.90]);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [pixHistory, setPixHistory] = useState<any[]>(initialState?.pixHistory || []);
  
  // Função para buscar pagamentos existentes
  const fetchExistingPayments = useCallback(async () => {
    if (!telefone) return;
    
    setIsLoadingPayments(true);
    try {
      const response = await fetch(`/api/pix/conversa/${telefone}`);
      if (response.ok) {
        const payments = await response.json();
        setExistingPayments(payments);
        
        // Se houver pagamento pendente, selecionar automaticamente
        const pendingPayment = payments.find((p: any) => p.status === 'pendente');
        if (pendingPayment) {
          setSelectedPayment(pendingPayment);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error);
    } finally {
      setIsLoadingPayments(false);
    }
  }, [telefone]);
  
  // Função para verificar status do pagamento
  const checkPaymentStatus = useCallback(async (chargeId: string) => {
    if (!chargeId) return;
    
    setIsCheckingStatus(true);
    try {
      const response = await fetch(`/api/pix/status/${chargeId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Atualizar pagamento selecionado
        if (selectedPayment?.charge_id === chargeId) {
          setSelectedPayment((prev: any) => prev ? { ...prev, status: data.status } : null);
          
          // Atualizar lista de pagamentos existentes
          setExistingPayments(prev => prev.map(p => 
            p.charge_id === chargeId ? { ...p, status: data.status } : p
          ));
          
          // Se foi pago, mostrar mensagem de sucesso
          if (data.status === 'pago') {
            toast({
              title: "✅ Pagamento Confirmado!",
              description: "O pagamento foi processado com sucesso.",
            });
            
            // Limpar seleção após 3 segundos
            setTimeout(() => {
              setSelectedPayment(null);
              fetchExistingPayments();
            }, 3000);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [selectedPayment, toast, fetchExistingPayments]);
  
  // Buscar configuração PIX e pagamentos ao montar
  useEffect(() => {
    // Buscar configuração
    fetch('/api/pix/config')
      .then(res => res.json())
      .then(data => {
        if (data.expiresIn) {
          setPixConfig({ expiresIn: data.expiresIn });
        }
      })
      .catch(err => console.error('Erro ao buscar configuração PIX:', err));
    
    // Buscar pagamentos existentes
    fetchExistingPayments();
  }, [fetchExistingPayments]);
  
  // Polling para verificar status de pagamento pendente
  useEffect(() => {
    if (!selectedPayment || selectedPayment.status !== 'pendente') return;
    
    const interval = setInterval(() => {
      checkPaymentStatus(selectedPayment.charge_id);
    }, 5000); // Verificar a cada 5 segundos
    
    return () => clearInterval(interval);
  }, [selectedPayment, checkPaymentStatus]);
  
  // Salvar estado quando mudar (com debounce para evitar loops)
  useEffect(() => {
    if (!onStateChange) return;
    
    const timer = setTimeout(() => {
      onStateChange({
        selectedPayment,
        pixHistory,
        pixAmount,
        pixDescription
      });
    }, 300); // Debounce de 300ms
    
    return () => clearTimeout(timer);
  }, [selectedPayment, pixHistory, pixAmount, pixDescription, onStateChange]);

  // Countdown timer para PIX selecionado
  useEffect(() => {
    if (!selectedPayment || selectedPayment.status !== 'pendente') {
      setTimeRemaining('');
      return;
    }

    const interval = setInterval(() => {
      const vencimento = selectedPayment.data_vencimento ? 
        new Date(selectedPayment.data_vencimento).getTime() : 
        new Date(selectedPayment.created_at).getTime() + (pixConfig.expiresIn * 1000);
      
      const now = new Date().getTime();
      const remaining = vencimento - now;

      if (remaining <= 0) {
        setSelectedPayment((prev: any) => prev ? { ...prev, status: 'expirado' } : null);
        setTimeRemaining('Expirado');
        clearInterval(interval);
        fetchExistingPayments();
      } else {
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        if (hours > 0) {
          setTimeRemaining(`${hours}h:${minutes.toString().padStart(2, '0')}m:${seconds.toString().padStart(2, '0')}s`);
        } else {
          setTimeRemaining(`${minutes}m:${seconds.toString().padStart(2, '0')}s`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedPayment, pixConfig.expiresIn, fetchExistingPayments]);

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
    if (!selectedPayment?.charge_id) return;

    setIsCancelling(true);
    try {
      // Cancelar PIX na API
      await apiRequest('POST', `/api/pix/cancel/${selectedPayment.charge_id}`);
      
      // Atualizar estado
      setSelectedPayment((prev: any) => prev ? { ...prev, status: 'cancelado' } : null);
      
      // Adicionar ao histórico
      setPixHistory(prev => [...prev, { ...selectedPayment, status: 'cancelado', cancelledAt: new Date() }]);

      toast({
        title: "✅ PIX Cancelado",
        description: "A cobrança PIX foi cancelada com sucesso",
      });

      // Limpar e recarregar após 2 segundos
      setTimeout(() => {
        setSelectedPayment(null);
        setPixAmount('');
        setPixDescription('');
        fetchExistingPayments();
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
        clienteId: clienteId || null,
        telefone: telefone,
        valor: amount,
        descricao: pixDescription || `Pagamento - ${clienteNome}`
      });
      
      const response = await responseRaw.json();

      if (response.success && response.pixData) {
        const pixData = response.pixData;
        
        // Criar novo pagamento
        const newPayment = {
          id: Date.now(),
          status: 'pendente',
          valor: amount,
          descricao: pixDescription || `Pagamento - ${clienteNome}`,
          qr_code: pixData.qrCode,
          pix_copia_e_cola: pixData.pixCopiaCola,
          charge_id: pixData.chargeId,
          created_at: new Date(),
          data_vencimento: new Date(Date.now() + pixConfig.expiresIn * 1000),
          telefone: telefone
        };
        
        // Atualizar estado
        setSelectedPayment(newPayment);
        setExistingPayments(prev => [newPayment, ...prev]);

        if (onPixGenerated) {
          onPixGenerated(newPayment);
        }

        // Enviar para WhatsApp
        await sendPixToWhatsApp(newPayment);

        toast({
          title: "✅ PIX Gerado!",
          description: `Valor: R$ ${formatCurrency(pixAmount)}`,
        });
        
        // Limpar formulário
        setPixAmount('');
        setPixDescription('');

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

  const sendPixToWhatsApp = async (payment: any) => {
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
      if (payment.qr_code) {
        sendMessage('send_message', {
          telefone: telefone,
          tipo: 'image',
          conteudo: payment.qr_code,
          mediaUrl: payment.qr_code
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Segunda mensagem - Código PIX Copia e Cola
      if (payment.pix_copia_e_cola) {
        sendMessage('send_message', {
          telefone: telefone,
          tipo: 'text',
          conteudo: payment.pix_copia_e_cola
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Terceira mensagem - Instruções de pagamento
      const valorFormatado = typeof payment.valor === 'number' ? 
        payment.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
        payment.valor;
        
      sendMessage('send_message', {
        telefone: telefone,
        tipo: 'text',
        conteudo: `Valor: R$ ${valorFormatado}\n` +
                 `Validade: ${validadeText}\n\n` +
                 `Como pagar:\n` +
                 `1️⃣ Abra o app do seu banco\n` +
                 `2️⃣ Escaneie o QR Code ou use o código Copia e Cola`
      });

    } catch (error) {
      console.error('Erro ao enviar PIX:', error);
    }
  };

  const copyPixCode = () => {
    if (selectedPayment?.pix_copia_e_cola) {
      navigator.clipboard.writeText(selectedPayment.pix_copia_e_cola);
      toast({
        title: "Copiado!",
        description: "Código PIX na área de transferência",
      });
    }
  };

  const resetForm = () => {
    setSelectedPayment(null);
    setPixAmount('');
    setPixDescription('');
  };
  
  const resendPixToWhatsApp = async () => {
    if (!selectedPayment) return;
    
    try {
      await sendPixToWhatsApp(selectedPayment);
      toast({
        title: "✅ PIX Reenviado!",
        description: "Dados enviados para o WhatsApp",
      });
    } catch (error) {
      toast({
        title: "❌ Erro",
        description: "Não foi possível reenviar o PIX",
        variant: "destructive"
      });
    }
  };
  
  const formatPaymentValue = (valor: any): string => {
    if (typeof valor === 'number') {
      return valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    return valor?.toString() || '0,00';
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pendente': return <Clock className="w-3.5 h-3.5" />;
      case 'pago': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'cancelado': return <XCircle className="w-3.5 h-3.5" />;
      case 'expirado': return <Timer className="w-3.5 h-3.5" />;
      default: return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente': return 'bg-amber-500/20 text-amber-400 border-amber-600/40';
      case 'pago': return 'bg-green-500/20 text-green-400 border-green-600/40';
      case 'cancelado': return 'bg-red-500/20 text-red-400 border-red-600/40';
      case 'expirado': return 'bg-slate-500/20 text-slate-400 border-slate-600/40';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-600/40';
    }
  };
  
  const calculateTimeRemaining = (payment: any): string => {
    if (payment.status !== 'pendente' || !payment.data_vencimento) return '';
    
    const now = new Date();
    const expiry = new Date(payment.data_vencimento);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expirado';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}m` : ''}`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900/90 to-slate-800/90 rounded-lg border border-slate-700/50">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-slate-200">Cobrança PIX</span>
          </div>
          {selectedPayment && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="h-6 w-6 p-0 hover:bg-slate-700/50"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoadingPayments ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Pagamento Selecionado */}
            {selectedPayment ? (
              <div className="space-y-3">
                <div className={cn(
                  "p-3 rounded-lg border",
                  selectedPayment.status === 'pendente' 
                    ? "bg-amber-950/30 border-amber-600/40" 
                    : selectedPayment.status === 'pago'
                    ? "bg-green-950/30 border-green-600/40"
                    : selectedPayment.status === 'cancelado'
                    ? "bg-red-950/30 border-red-600/40"
                    : "bg-slate-800/30 border-slate-600/40"
                )}>
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5",
                      getStatusColor(selectedPayment.status)
                    )}>
                      {getStatusIcon(selectedPayment.status)}
                      {selectedPayment.status === 'pendente' && timeRemaining && (
                        <span className="font-mono">{timeRemaining}</span>
                      )}
                    </div>
                  </div>

                  {/* Valor */}
                  <div className="text-center py-2">
                    <div className="text-2xl font-black text-white">R$ {formatPaymentValue(selectedPayment.valor)}</div>
                    {selectedPayment.descricao && (
                      <div className="text-[11px] text-slate-400 mt-1">{selectedPayment.descricao}</div>
                    )}
                  </div>

                  {/* Ações */}
                  {selectedPayment.status === 'pendente' && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyPixCode}
                        className="h-8 border-slate-600 hover:bg-slate-700"
                        disabled={!selectedPayment.pix_copia_e_cola}
                        title="Copiar PIX"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resendPixToWhatsApp}
                        className="h-8 border-slate-600 hover:bg-slate-700"
                        title="Reenviar"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkPaymentStatus(selectedPayment.charge_id)}
                        disabled={isCheckingStatus}
                        className="h-8 border-blue-600/50 hover:bg-blue-950/30 text-blue-400"
                        title="Verificar"
                      >
                        {isCheckingStatus ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelCurrentPix}
                        disabled={isCancelling}
                        className="h-8 border-red-600/50 hover:bg-red-950/30 text-red-400"
                        title="Cancelar"
                      >
                        {isCancelling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {/* Botão para Novo PIX se pago ou cancelado */}
                  {(selectedPayment.status === 'pago' || selectedPayment.status === 'cancelado' || selectedPayment.status === 'expirado') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetForm}
                      className="w-full h-8 mt-3 text-[11px] font-bold border-slate-600 hover:bg-slate-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      NOVO PIX
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
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
                      Gerar PIX
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Pagamentos Recentes - Agora no final */}
            {existingPayments.length > 0 && !selectedPayment && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase">Pagamentos Recentes</h4>
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                  {existingPayments.map((payment: any, index: number) => {
                    const timeRemaining = calculateTimeRemaining(payment);
                    return (
                      <button
                        key={payment.id || payment.charge_id}
                        onClick={() => setSelectedPayment(payment)}
                        className={cn(
                          "w-full p-2 rounded-md border transition-all text-left",
                          "hover:bg-slate-800/50 hover:border-slate-600",
                          "border-slate-700 bg-slate-900/30",
                          index >= 2 && "opacity-75" // Slightly fade payments after the first 2
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-bold text-white">
                              R$ {formatPaymentValue(payment.valor)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-[10px] text-slate-500">
                              {format(new Date(payment.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                            <div className={cn(
                              "p-1 rounded flex items-center gap-1",
                              getStatusColor(payment.status)
                            )}>
                              {getStatusIcon(payment.status)}
                              {payment.status === 'pendente' && timeRemaining && (
                                <span className="text-[10px] font-mono">{timeRemaining}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
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