import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Calendar, Clock, Bell, BellOff, Send, Search, Filter, AlertTriangle, 
  CheckCircle, Users, Phone, Settings, RefreshCw, MessageSquare, History,
  AlertCircle, Timer, BellRing, Settings2, List, Eye
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Cliente } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useLocation } from 'wouter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AvisoVencimento {
  id: number;
  clienteId: number;
  cliente?: Cliente;
  telefone: string;
  dataVencimento: string;
  dataAviso: string;
  tipoAviso: string;
  statusEnvio: string;
  mensagemEnviada: string;
}

interface NotificacaoRecorrente {
  id: number;
  clienteId: number;
  cliente?: Cliente;
  contagemNotificacoes: number;
  ultimaNotificacao: string | null;
  proximaNotificacao: string | null;
  ativo: boolean;
}

export default function Vencimentos() {
  const [location, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDays, setFilterDays] = useState('todos');
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Estados para configuração básica
  const [horaAviso, setHoraAviso] = useState('09:00');
  const [avisoAtivo, setAvisoAtivo] = useState(true);
  const [mensagemPadrao, setMensagemPadrao] = useState('');
  
  // Estados para notificações recorrentes
  const [recorrenteAtivo, setRecorrenteAtivo] = useState(false);
  const [recorrenteIntervalo, setRecorrenteIntervalo] = useState('3');
  const [recorrenteLimite, setRecorrenteLimite] = useState('10');
  
  // Format phone number to Brazilian format
  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    
    // Remove country code if present
    const phoneWithoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
    
    if (phoneWithoutCountry.length === 11) {
      // Mobile: (11) 91234-5678
      return `(${phoneWithoutCountry.slice(0, 2)}) ${phoneWithoutCountry.slice(2, 7)}-${phoneWithoutCountry.slice(7)}`;
    } else if (phoneWithoutCountry.length === 10) {
      // Landline: (11) 1234-5678
      return `(${phoneWithoutCountry.slice(0, 2)}) ${phoneWithoutCountry.slice(2, 6)}-${phoneWithoutCountry.slice(6)}`;
    }
    
    return phone;
  };

  // Fetch clients with expiry dates
  const { data: clientes, isLoading, refetch: refetchClientes } = useQuery({
    queryKey: ['/api/clientes-vencimentos'],
    queryFn: async () => {
      const response = await fetch('/api/clientes-vencimentos');
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json() as Promise<Cliente[]>;
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch avisos sent today
  const { data: avisos, refetch: refetchAvisos } = useQuery({
    queryKey: ['/api/avisos/hoje'],
    queryFn: async () => {
      const response = await fetch('/api/avisos/hoje');
      if (!response.ok) throw new Error('Failed to fetch avisos');
      return response.json() as Promise<AvisoVencimento[]>;
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch all avisos for history
  const { data: historico } = useQuery({
    queryKey: ['/api/avisos'],
    queryFn: async () => {
      const response = await fetch('/api/avisos');
      if (!response.ok) throw new Error('Failed to fetch avisos');
      return response.json() as Promise<AvisoVencimento[]>;
    },
  });

  // Fetch config avisos
  const { data: config } = useQuery({
    queryKey: ['/api/avisos/config'],
    queryFn: async () => {
      const response = await fetch('/api/avisos/config');
      if (!response.ok) throw new Error('Failed to fetch config');
      return response.json();
    },
  });

  // Fetch recurring config
  const { data: configRecorrente } = useQuery({
    queryKey: ['/api/avisos/config-recorrente'],
    queryFn: async () => {
      const response = await fetch('/api/avisos/config-recorrente');
      if (!response.ok) throw new Error('Failed to fetch config');
      return response.json();
    },
  });

  // Fetch recurring notifications
  const { data: notificacoesRecorrentes } = useQuery({
    queryKey: ['/api/notificacoes-recorrentes'],
    queryFn: async () => {
      const response = await fetch('/api/notificacoes-recorrentes');
      if (!response.ok) return [];
      return response.json() as Promise<NotificacaoRecorrente[]>;
    },
  });

  // Update config values when fetched
  useEffect(() => {
    if (config) {
      setHoraAviso(config.horaAviso || '09:00');
      setAvisoAtivo(config.ativo ?? true);
      setMensagemPadrao(config.mensagemPadrao || '');
    }
  }, [config]);

  // Update recurring config values when fetched
  useEffect(() => {
    if (configRecorrente) {
      setRecorrenteAtivo(configRecorrente.notificacoesRecorrentes ?? false);
      setRecorrenteIntervalo(String(configRecorrente.intervaloRecorrente || 3));
      setRecorrenteLimite(String(configRecorrente.limiteNotificacoes || 10));
    }
  }, [configRecorrente]);

  // Update config mutation
  const updateConfig = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put('/api/avisos/config', data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "As configurações de avisos foram atualizadas.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/avisos/config'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações.",
        variant: "destructive",
      });
    },
  });

  // Update recurring config mutation
  const updateConfigRecorrente = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put('/api/avisos/config-recorrente', data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "As configurações de notificações recorrentes foram atualizadas.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/avisos/config-recorrente'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notificacoes-recorrentes'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações recorrentes.",
        variant: "destructive",
      });
    },
  });

  // Send manual notification mutation
  const sendManualNotification = useMutation({
    mutationFn: async (clienteId: number) => {
      const response = await api.post('/api/avisos/enviar-manual', { clienteId });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Aviso enviado",
        description: "Notificação de vencimento enviada com sucesso!",
      });
      refetchAvisos();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao enviar notificação.",
        variant: "destructive",
      });
    },
  });

  // Reset recurring notification mutation
  const resetNotificacao = useMutation({
    mutationFn: async (clienteId: number) => {
      const response = await api.post(`/api/notificacoes-recorrentes/reset/${clienteId}`);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Contador resetado",
        description: "O contador de notificações foi resetado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notificacoes-recorrentes'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao resetar contador.",
        variant: "destructive",
      });
    },
  });

  // Handle save config
  const handleSaveConfig = () => {
    updateConfig.mutate({
      horaAviso,
      ativo: avisoAtivo,
      mensagemPadrao,
    });
  };

  // Handle save recurring config
  const handleSaveConfigRecorrente = () => {
    updateConfigRecorrente.mutate({
      notificacoesRecorrentes: recorrenteAtivo,
      intervaloRecorrente: parseInt(recorrenteIntervalo),
      limiteNotificacoes: parseInt(recorrenteLimite),
    });
  };

  const getClientName = (cliente?: Cliente | null) => {
    if (!cliente) return 'Cliente';
    return cliente.nome || cliente.nomeCompleto || 'Cliente';
  };

  const getDaysUntilExpiry = (dataExpiracao: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(dataExpiracao);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isExpiredOrExpiringSoon = (dataExpiracao: string) => {
    const days = getDaysUntilExpiry(dataExpiracao);
    return days <= 3;
  };

  const wasSentToday = (phone: string) => {
    if (!avisos) return false;
    return avisos.some(aviso => aviso.telefone === phone);
  };

  // Filter clients based on search and filter
  const filteredClientes = clientes?.filter(cliente => {
    const matchesSearch = !searchTerm || 
      getClientName(cliente).toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatPhoneNumber(cliente.telefone).includes(searchTerm);
    
    let matchesFilter = true;
    if (filterDays !== 'todos') {
      const days = getDaysUntilExpiry(cliente.dataExpiracao);
      if (filterDays === 'vencidos') {
        matchesFilter = days < 0;
      } else if (filterDays === 'hoje') {
        matchesFilter = days === 0;
      } else if (filterDays === '3dias') {
        matchesFilter = days >= 0 && days <= 3;
      } else if (filterDays === '7dias') {
        matchesFilter = days >= 0 && days <= 7;
      }
    }
    
    return matchesSearch && matchesFilter;
  });

  // Stats calculations
  const totalVencimentos = clientes?.length || 0;
  const vencidosHoje = clientes?.filter(c => getDaysUntilExpiry(c.dataExpiracao) === 0).length || 0;
  const vencidosProximos3Dias = clientes?.filter(c => {
    const days = getDaysUntilExpiry(c.dataExpiracao);
    return days >= 0 && days <= 3;
  }).length || 0;
  const avisosEnviadosHoje = avisos?.length || 0;

  return (
    <div className="flex h-screen flex-col">
      {/* Header with Title */}
      <div className="border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold">Gestão de Vencimentos</h1>
          <p className="text-purple-100 mt-1">Controle de avisos e notificações de vencimento</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Clientes</p>
                <p className="text-2xl font-bold">{totalVencimentos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Vencem Hoje</p>
                <p className="text-2xl font-bold">{vencidosHoje}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Próximos 3 Dias</p>
                <p className="text-2xl font-bold">{vencidosProximos3Dias}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Send className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avisos Hoje</p>
                <p className="text-2xl font-bold">{avisosEnviadosHoje}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Tabs */}
      <div className="flex-1 px-6 pb-6">
        <Tabs defaultValue="visualizar" className="h-full">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-t-lg p-1">
            <TabsList className="w-full justify-start bg-transparent h-14">
              <TabsTrigger value="configuracoes" className="flex items-center gap-2 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-sm">
                <Settings2 className="h-4 w-4" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="recorrentes" className="flex items-center gap-2 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-sm">
                <BellRing className="h-4 w-4" />
                Notif. Recorrentes
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center gap-2 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-sm">
                <History className="h-4 w-4" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="visualizar" className="flex items-center gap-2 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-sm">
                <Eye className="h-4 w-4" />
                Visualizar
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Configurações Tab */}
          <TabsContent value="configuracoes" className="h-full mt-0">
            <Card className="h-full rounded-t-none">
              <CardHeader>
                <CardTitle>Configurações de Avisos</CardTitle>
                <CardDescription>Configure como e quando os avisos de vencimento são enviados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Avisos Automáticos</Label>
                    <p className="text-sm text-muted-foreground">Enviar avisos automaticamente no horário configurado</p>
                  </div>
                  <Switch
                    checked={avisoAtivo}
                    onCheckedChange={setAvisoAtivo}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hora">Horário de Envio</Label>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="hora"
                      type="time"
                      value={horaAviso}
                      onChange={(e) => setHoraAviso(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Horário em que os avisos serão enviados diariamente
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mensagem">Mensagem Padrão</Label>
                  <Textarea
                    id="mensagem"
                    value={mensagemPadrao}
                    onChange={(e) => setMensagemPadrao(e.target.value)}
                    placeholder="Digite a mensagem padrão para avisos de vencimento..."
                    className="min-h-[150px]"
                  />
                  <p className="text-sm text-muted-foreground">
                    Variáveis disponíveis: {'{nome}'}, {'{vencimento}'}, {'{plano}'}
                  </p>
                </div>

                <Button onClick={handleSaveConfig} className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notificações Recorrentes Tab */}
          <TabsContent value="recorrentes" className="h-full mt-0">
            <Card className="h-full rounded-t-none">
              <CardHeader>
                <CardTitle>Notificações Recorrentes</CardTitle>
                <CardDescription>Configure avisos repetidos para clientes vencidos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Ativar Notificações Recorrentes</Label>
                    <p className="text-sm text-muted-foreground">Continuar enviando avisos após o vencimento</p>
                  </div>
                  <Switch
                    checked={recorrenteAtivo}
                    onCheckedChange={setRecorrenteAtivo}
                  />
                </div>

                {recorrenteAtivo && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="intervalo">Intervalo entre Avisos</Label>
                      <Select value={recorrenteIntervalo} onValueChange={setRecorrenteIntervalo}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Diariamente</SelectItem>
                          <SelectItem value="2">A cada 2 dias</SelectItem>
                          <SelectItem value="3">A cada 3 dias</SelectItem>
                          <SelectItem value="4">A cada 4 dias</SelectItem>
                          <SelectItem value="5">A cada 5 dias</SelectItem>
                          <SelectItem value="6">A cada 6 dias</SelectItem>
                          <SelectItem value="7">Semanalmente</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Frequência de envio após o vencimento
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="limite">Limite de Notificações</Label>
                      <Input
                        id="limite"
                        type="number"
                        min="1"
                        max="30"
                        value={recorrenteLimite}
                        onChange={(e) => setRecorrenteLimite(e.target.value)}
                        className="w-32"
                      />
                      <p className="text-sm text-muted-foreground">
                        Máximo de avisos recorrentes por cliente
                      </p>
                    </div>

                    {/* Lista de clientes com notificações ativas */}
                    {notificacoesRecorrentes && notificacoesRecorrentes.length > 0 && (
                      <div className="space-y-2">
                        <Label>Clientes com Notificações Ativas</Label>
                        <ScrollArea className="h-[200px] border rounded-lg p-4">
                          {notificacoesRecorrentes.map((notif) => (
                            <div key={notif.id} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div>
                                <p className="font-medium">{getClientName(notif.cliente)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {notif.contagemNotificacoes} avisos enviados
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resetNotificacao.mutate(notif.clienteId)}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                  </>
                )}

                <Button onClick={handleSaveConfigRecorrente} className="w-full">
                  <BellRing className="h-4 w-4 mr-2" />
                  Salvar Configurações Recorrentes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Histórico Tab */}
          <TabsContent value="historico" className="h-full mt-0">
            <Card className="h-full rounded-t-none">
              <CardHeader>
                <CardTitle>Histórico de Avisos</CardTitle>
                <CardDescription>Todos os avisos enviados</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {historico && historico.length > 0 ? (
                    <div className="space-y-2">
                      {historico.map((aviso) => (
                        <div key={aviso.id} className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{getClientName(aviso.cliente)}</p>
                                {aviso.statusEnvio === 'enviado' ? (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Enviado
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Erro
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatPhoneNumber(aviso.telefone)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(aviso.dataAviso).toLocaleString('pt-BR')}
                              </p>
                              {aviso.mensagemEnviada && (
                                <p className="text-sm mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                  {aviso.mensagemEnviada.substring(0, 100)}...
                                </p>
                              )}
                            </div>
                            <Badge variant={aviso.tipoAviso === 'automatico' ? 'default' : 'secondary'}>
                              {aviso.tipoAviso}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum aviso enviado ainda</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visualizar Tab */}
          <TabsContent value="visualizar" className="h-full mt-0">
            <Card className="h-full rounded-t-none">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Clientes e Vencimentos</CardTitle>
                    <CardDescription>Visualize e gerencie avisos de vencimento</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={filterDays} onValueChange={setFilterDays}>
                      <SelectTrigger className="w-40">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="vencidos">Vencidos</SelectItem>
                        <SelectItem value="hoje">Vencem Hoje</SelectItem>
                        <SelectItem value="3dias">Próximos 3 dias</SelectItem>
                        <SelectItem value="7dias">Próximos 7 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[450px]">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p>Carregando clientes...</p>
                    </div>
                  ) : filteredClientes && filteredClientes.length > 0 ? (
                    <div className="space-y-2">
                      {filteredClientes.map((cliente) => {
                        const days = getDaysUntilExpiry(cliente.dataExpiracao);
                        const isExpired = days < 0;
                        const isToday = days === 0;
                        const isNear = days > 0 && days <= 3;
                        const sentToday = wasSentToday(cliente.telefone);
                        
                        return (
                          <div
                            key={cliente.id}
                            className={`p-4 border rounded-lg transition-all hover:shadow-md ${
                              isExpired ? 'border-red-300 bg-red-50 dark:bg-red-950/20' :
                              isToday ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/20' :
                              isNear ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20' :
                              'hover:bg-gray-50 dark:hover:bg-gray-900'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar>
                                  <AvatarFallback>
                                    {getClientName(cliente).substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{getClientName(cliente)}</p>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {formatPhoneNumber(cliente.telefone)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(cliente.dataExpiracao).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {isExpired ? (
                                  <Badge variant="destructive">
                                    Vencido há {Math.abs(days)} dias
                                  </Badge>
                                ) : isToday ? (
                                  <Badge variant="default" className="bg-orange-500">
                                    Vence hoje
                                  </Badge>
                                ) : isNear ? (
                                  <Badge variant="default" className="bg-yellow-500">
                                    Vence em {days} dias
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    {days} dias restantes
                                  </Badge>
                                )}
                                
                                {sentToday ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" disabled>
                                          <CheckCircle className="h-4 w-4 text-green-500" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Aviso já enviado hoje</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => sendManualNotification.mutate(cliente.id)}
                                          disabled={sendManualNotification.isPending}
                                        >
                                          <Send className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Enviar aviso manual</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/chat?phone=${cliente.telefone}`)}
                                      >
                                        <MessageSquare className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Abrir chat</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum cliente encontrado</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}