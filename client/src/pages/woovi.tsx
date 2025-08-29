import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  CreditCard, 
  Settings, 
  TestTube, 
  FileText, 
  Copy, 
  Check,
  AlertCircle,
  Calendar,
  User,
  Hash,
  DollarSign,
  Loader2,
  RefreshCw,
  QrCode,
  Activity,
  Shield,
  ExternalLink,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PixPayment {
  id: number;
  clienteId: number;
  pixId: string;
  chargeId?: string;
  valor: number;
  status: string;
  dataCriacao: Date;
  dataPagamento?: Date | null;
  dataVencimento?: Date | null;
  qrCode?: string;
  pixCopiaECola?: string;
  paymentLinkUrl?: string;
  expiresIn?: number;
  cliente?: {
    id: number;
    nome: string;
    telefone: string;
  };
}

interface PixLog {
  id: number;
  tipo: string;
  acao: string;
  detalhes: string;
  timestamp: Date;
}

export default function Woovi() {
  const { toast } = useToast();
  const [appId, setAppId] = useState('');
  const [correlationId, setCorrelationId] = useState('');
  const [expiresIn, setExpiresIn] = useState('86400'); // 24 horas padrão
  const [testValor, setTestValor] = useState('10.00');
  const [testDescricao, setTestDescricao] = useState('Teste de PIX - TV ON Sistema');
  const [copiedPix, setCopiedPix] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Buscar configuração existente
  const { data: integracoes, isLoading: loadingConfig } = useQuery({
    queryKey: ['/api/integracoes'],
    queryFn: api.getIntegracoes
  });

  // Carregar configuração quando dados estiverem disponíveis
  useEffect(() => {
    if (integracoes) {
      const pixConfig = integracoes.find((i: any) => i.tipo === 'pix' && i.ativo);
      if (pixConfig && pixConfig.configuracoes) {
        setAppId(pixConfig.configuracoes.appId || '');
        setCorrelationId(pixConfig.configuracoes.correlationID || '');
        setExpiresIn(String(pixConfig.configuracoes.expiresIn || 86400));
        if (pixConfig.configuracoes.appId) {
          setShowConfig(true);
        }
      }
    }
  }, [integracoes]);

  // Buscar pagamentos
  const { data: pagamentos, isLoading: loadingPagamentos, refetch: refetchPagamentos } = useQuery({
    queryKey: ['/api/pix/pagamentos'],
    queryFn: async () => {
      const response = await fetch('/api/pix/pagamentos');
      if (!response.ok) throw new Error('Erro ao buscar pagamentos');
      return response.json();
    }
  });

  // Buscar logs
  const { data: logs, isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['/api/pix/logs'],
    queryFn: async () => {
      const response = await fetch('/api/pix/logs');
      if (!response.ok) throw new Error('Erro ao buscar logs');
      return response.json();
    }
  });

  // Salvar configuração
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pix/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          correlationID: correlationId || `TVON_PIX_${Date.now()}`,
          expiresIn: parseInt(expiresIn) || 86400
        })
      });
      if (!response.ok) throw new Error('Erro ao salvar configuração');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integracoes'] });
      toast({
        title: 'Configuração salva',
        description: 'As configurações do Woovi foram salvas com sucesso.'
      });
      setShowConfig(true);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive'
      });
    }
  });

  // Gerar PIX de teste
  const generateTestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pix/gerar-teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: parseFloat(testValor),
          descricao: testDescricao
        })
      });
      if (!response.ok) throw new Error('Erro ao gerar PIX de teste');
      return response.json();
    },
    onSuccess: (data) => {
      refetchPagamentos();
      toast({
        title: 'PIX gerado',
        description: 'O código PIX de teste foi gerado com sucesso.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao gerar PIX',
        description: 'Não foi possível gerar o PIX de teste.',
        variant: 'destructive'
      });
    }
  });

  const copyToClipboard = async (text: string, pixId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPix(pixId);
      setTimeout(() => setCopiedPix(null), 2000);
      toast({
        title: 'Copiado!',
        description: 'Código PIX copiado para a área de transferência.'
      });
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o código.',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pendente: { label: 'Pendente', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      pago: { label: 'Pago', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      expirado: { label: 'Expirado', className: 'bg-red-500/10 text-red-500 border-red-500/20' }
    };
    
    const config = statusConfig[status] || statusConfig.pendente;
    
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getLogTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'info':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <CreditCard className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Woovi
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Configure o processamento de pagamentos PIX
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-900 border border-slate-700">
          <TabsTrigger value="config" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white">
            <Settings className="w-4 h-4 mr-2" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white">
            <TestTube className="w-4 h-4 mr-2" />
            Testar
          </TabsTrigger>
          <TabsTrigger value="records" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Registros
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white">
            <Activity className="w-4 h-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <Card className="bg-slate-900 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white text-xl">Configuração do Woovi</CardTitle>
              <CardDescription className="text-slate-400">
                Configure suas credenciais do Woovi para processar pagamentos PIX
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="appId" className="text-slate-200">API Key</Label>
                  <Input
                    id="appId"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="Sua chave de API do Woovi"
                    className="bg-slate-700/50 border-slate-600 text-slate-100 placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="correlationId" className="text-slate-200">Correlation ID (Opcional)</Label>
                  <Input
                    id="correlationId"
                    value={correlationId}
                    onChange={(e) => setCorrelationId(e.target.value)}
                    placeholder="Ex: TVON_PIX_2025"
                    className="bg-slate-700/50 border-slate-600 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-sm text-slate-500">
                    Se não informado, será gerado automaticamente
                  </p>
                </div>

                <div className="space-y-4">
                  <Label className="text-slate-200">Tempo de Expiração do PIX</Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiresHours" className="text-sm text-slate-400">Horas</Label>
                      <select
                        id="expiresHours"
                        value={Math.floor(parseInt(expiresIn) / 3600)}
                        onChange={(e) => {
                          const hours = parseInt(e.target.value) || 0;
                          const currentMinutes = Math.floor((parseInt(expiresIn) % 3600) / 60);
                          const totalSeconds = (hours * 3600) + (currentMinutes * 60);
                          // Garantir mínimo de 5 minutos (300 segundos)
                          if (totalSeconds >= 300 && totalSeconds <= 86400) {
                            setExpiresIn(totalSeconds.toString());
                          } else if (totalSeconds < 300) {
                            setExpiresIn('300');
                          }
                        }}
                        className="w-full h-10 px-3 rounded-md bg-slate-700/50 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        {Array.from({ length: 25 }, (_, i) => (
                          <option key={i} value={i}>
                            {i} {i === 1 ? 'hora' : 'horas'}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="expiresMinutes" className="text-sm text-slate-400">Minutos</Label>
                      <select
                        id="expiresMinutes"
                        value={Math.floor((parseInt(expiresIn) % 3600) / 60)}
                        onChange={(e) => {
                          const minutes = parseInt(e.target.value) || 0;
                          const currentHours = Math.floor(parseInt(expiresIn) / 3600);
                          const totalSeconds = (currentHours * 3600) + (minutes * 60);
                          // Garantir mínimo de 5 minutos (300 segundos)
                          if (totalSeconds >= 300 && totalSeconds <= 86400) {
                            setExpiresIn(totalSeconds.toString());
                          } else if (totalSeconds < 300 && currentHours === 0) {
                            setExpiresIn('300');
                          }
                        }}
                        className="w-full h-10 px-3 rounded-md bg-slate-700/50 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        {Array.from({ length: 60 }, (_, i) => {
                          // Se não tem horas selecionadas, começar em 5 minutos (mínimo)
                          const currentHours = Math.floor(parseInt(expiresIn) / 3600);
                          const isDisabled = currentHours === 0 && i < 5;
                          return (
                            <option key={i} value={i} disabled={isDisabled}>
                              {i} {i === 1 ? 'minuto' : 'minutos'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-sm">
                    <div className="flex items-center space-x-2 text-slate-400">
                      <Clock className="h-4 w-4" />
                      <span>Total: </span>
                    </div>
                    <span className="font-medium text-slate-200">
                      {Math.floor(parseInt(expiresIn) / 3600) > 0 && `${Math.floor(parseInt(expiresIn) / 3600)}h `}
                      {Math.floor((parseInt(expiresIn) % 3600) / 60) > 0 && `${Math.floor((parseInt(expiresIn) % 3600) / 60)}min`}
                      {parseInt(expiresIn) < 60 && `${parseInt(expiresIn)} segundos`}
                    </span>
                    <span className="text-slate-500">({parseInt(expiresIn)} segundos)</span>
                  </div>

                  <Alert className="bg-blue-500/10 border-blue-500/30">
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-slate-300 text-sm">
                      Mínimo: 5 minutos • Máximo: 24 horas
                    </AlertDescription>
                  </Alert>
                </div>

                <Button
                  onClick={() => saveConfigMutation.mutate()}
                  disabled={saveConfigMutation.isPending || !appId}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {saveConfigMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Configuração'
                  )}
                </Button>

                {showConfig && (
                  <Alert className="mt-4 bg-green-500/10 border-green-500/30">
                    <Check className="h-4 w-4 text-green-400" />
                    <AlertDescription className="text-slate-300">
                      <strong>Webhook URL para configurar no Woovi:</strong>
                      <div className="mt-2 p-2 bg-slate-700/50 rounded font-mono text-sm break-all text-slate-100">
                        {window.location.origin}/api/pix/webhook
                      </div>
                      <p className="mt-2 text-sm">
                        Configure os eventos: <strong className="text-green-400">OPENPIX:CHARGE_COMPLETED</strong> e <strong className="text-green-400">OPENPIX:CHARGE_EXPIRED</strong>
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        A autenticação do webhook é feita automaticamente através da sua API Key
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          <Card className="bg-slate-900 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white text-xl">Gerar PIX de Teste</CardTitle>
              <CardDescription className="text-slate-400">
                Crie um PIX de teste para verificar se a integração está funcionando
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showConfig ? (
                <Alert className="bg-yellow-500/10 border-yellow-500/30">
                  <AlertCircle className="h-4 w-4 text-yellow-400" />
                  <AlertDescription className="text-slate-300">
                    Configure suas credenciais do Woovi primeiro antes de gerar um PIX de teste.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="testValor" className="text-slate-200">Valor (R$)</Label>
                    <Input
                      id="testValor"
                      type="number"
                      step="0.01"
                      value={testValor}
                      onChange={(e) => setTestValor(e.target.value)}
                      placeholder="10.00"
                      className="bg-slate-700/50 border-slate-600 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="testDescricao" className="text-slate-200">Descrição</Label>
                    <Input
                      id="testDescricao"
                      value={testDescricao}
                      onChange={(e) => setTestDescricao(e.target.value)}
                      placeholder="Descrição do pagamento"
                      className="bg-slate-700/50 border-slate-600 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>

                  <Alert className="bg-blue-500/10 border-blue-500/30">
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-slate-300">
                      O teste será criado para o número <strong>14991949280</strong> (número de teste)
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={() => generateTestMutation.mutate()}
                    disabled={generateTestMutation.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {generateTestMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando PIX...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Gerar PIX de Teste
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-6">
          <Card className="bg-slate-900 border-slate-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-xl">Registros de Pagamentos</CardTitle>
                  <CardDescription className="text-slate-400">
                    Histórico de todos os pagamentos PIX processados
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetchPagamentos()}
                  disabled={loadingPagamentos}
                  className="border-slate-600 hover:bg-slate-700"
                >
                  <RefreshCw className={cn("h-4 w-4 text-slate-300", loadingPagamentos && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingPagamentos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                </div>
              ) : pagamentos && pagamentos.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">Cliente</TableHead>
                        <TableHead className="text-slate-300">Valor</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300">Expiração</TableHead>
                        <TableHead className="text-slate-300">QR Code</TableHead>
                        <TableHead className="text-slate-300">Criado em</TableHead>
                        <TableHead className="text-slate-300">Pago em</TableHead>
                        <TableHead className="text-slate-300 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagamentos.map((pagamento: PixPayment) => {
                        const isExpired = pagamento.dataVencimento && new Date(pagamento.dataVencimento) < new Date();
                        const status = isExpired && pagamento.status === 'pendente' ? 'expirado' : pagamento.status;
                        
                        return (
                          <TableRow key={pagamento.id} className="border-slate-700 hover:bg-slate-800/50">
                            <TableCell className="text-slate-100">
                              <div>
                                <div className="font-medium">{pagamento.cliente?.nome || 'Cliente não identificado'}</div>
                                <div className="text-xs text-slate-400">{pagamento.cliente?.telefone || '-'}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-100 font-medium">
                              R$ {(typeof pagamento.valor === 'string' ? parseFloat(pagamento.valor) : pagamento.valor).toFixed(2).replace('.', ',')}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(status)}
                            </TableCell>
                            <TableCell className="text-slate-100">
                              {pagamento.dataVencimento ? (
                                <div>
                                  <div className="text-sm">{format(new Date(pagamento.dataVencimento), "dd/MM/yyyy", { locale: ptBR })}</div>
                                  <div className="text-xs text-slate-400">{format(new Date(pagamento.dataVencimento), "HH:mm", { locale: ptBR })}</div>
                                  {pagamento.expiresIn && (
                                    <div className="text-xs text-slate-500 mt-1">
                                      {Math.floor(pagamento.expiresIn / 3600)}h de validade
                                    </div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {pagamento.qrCode && pagamento.status === 'pendente' && !isExpired ? (
                                <div className="flex items-center gap-2">
                                  <img 
                                    src={pagamento.qrCode} 
                                    alt="QR Code"
                                    className="w-12 h-12 cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(pagamento.qrCode, '_blank')}
                                  />
                                  {pagamento.chargeId && (
                                    <div className="text-xs text-slate-500">
                                      <div>ID: {pagamento.chargeId}</div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-100">
                              <div className="text-sm">{format(new Date(pagamento.dataCriacao), "dd/MM/yyyy", { locale: ptBR })}</div>
                              <div className="text-xs text-slate-400">{format(new Date(pagamento.dataCriacao), "HH:mm", { locale: ptBR })}</div>
                            </TableCell>
                            <TableCell className="text-slate-100">
                              {pagamento.dataPagamento ? (
                                <div>
                                  <div className="text-sm">{format(new Date(pagamento.dataPagamento), "dd/MM/yyyy", { locale: ptBR })}</div>
                                  <div className="text-xs text-slate-400">{format(new Date(pagamento.dataPagamento), "HH:mm", { locale: ptBR })}</div>
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {pagamento.paymentLinkUrl && pagamento.status === 'pendente' && !isExpired && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(pagamento.paymentLinkUrl, '_blank')}
                                    className="border-slate-600 hover:bg-slate-700"
                                    title="Abrir link de pagamento"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                )}
                                {pagamento.pixCopiaECola && pagamento.status === 'pendente' && !isExpired && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(pagamento.pixCopiaECola!, pagamento.pixId)}
                                    className="border-slate-600 hover:bg-slate-700"
                                    title="Copiar código PIX"
                                  >
                                    {copiedPix === pagamento.pixId ? (
                                      <Check className="h-4 w-4 text-green-400" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Nenhum pagamento encontrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card className="bg-slate-900 border-slate-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-xl">Logs do Sistema</CardTitle>
                  <CardDescription className="text-slate-400">
                    Atividades relacionadas ao PIX e webhooks
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetchLogs()}
                  disabled={loadingLogs}
                  className="border-slate-600 hover:bg-slate-700"
                >
                  <RefreshCw className={cn("h-4 w-4 text-slate-300", loadingLogs && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                </div>
              ) : logs && logs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300 w-12">Tipo</TableHead>
                      <TableHead className="text-slate-300">Ação</TableHead>
                      <TableHead className="text-slate-300">Detalhes</TableHead>
                      <TableHead className="text-slate-300">Data/Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: PixLog) => (
                      <TableRow key={log.id} className="border-slate-700 hover:bg-slate-800/50">
                        <TableCell>
                          {getLogTypeIcon(log.tipo)}
                        </TableCell>
                        <TableCell className="text-slate-100 font-medium">
                          {log.acao}
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm max-w-md">
                          <div className="truncate" title={typeof log.detalhes === 'string' ? log.detalhes : JSON.stringify(log.detalhes)}>
                            {log.detalhes ? (typeof log.detalhes === 'string' ? log.detalhes : JSON.stringify(log.detalhes)) : '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-100">
                          {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Nenhum log encontrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}