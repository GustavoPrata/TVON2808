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
  AlertCircle, Timer, BellRing, Eye
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
  const [horaAviso, setHoraAviso] = useState('09:00');
  const [avisoAtivo, setAvisoAtivo] = useState(true);
  const [mensagemPadrao, setMensagemPadrao] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Estados para notificações recorrentes
  const [recorrenteAtivo, setRecorrenteAtivo] = useState(false);
  const [recorrenteIntervalo, setRecorrenteIntervalo] = useState('3');
  const [recorrenteLimite, setRecorrenteLimite] = useState('10');
  const [recorrenteMensagem, setRecorrenteMensagem] = useState('');
  
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

  // Fetch avisos history
  const { data: historico, refetch: refetchHistorico } = useQuery({
    queryKey: ['/api/avisos/historico', selectedCliente],
    queryFn: async () => {
      const url = selectedCliente 
        ? `/api/avisos/historico?clienteId=${selectedCliente}`
        : '/api/avisos/historico';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json() as Promise<AvisoVencimento[]>;
    },
    enabled: false, // Only fetch when needed
  });

  // Fetch configuration
  const { data: config, refetch: refetchConfig } = useQuery({
    queryKey: ['/api/avisos/config'],
    queryFn: async () => {
      const response = await fetch('/api/avisos/config');
      if (!response.ok) throw new Error('Failed to fetch config');
      return response.json();
    },
  });

  // Fetch recurrent config
  const { data: configRecorrente, refetch: refetchConfigRecorrente } = useQuery({
    queryKey: ['/api/avisos/config-recorrente'],
    queryFn: async () => {
      const response = await fetch('/api/avisos/config-recorrente');
      if (!response.ok) throw new Error('Failed to fetch recurrent config');
      return response.json();
    },
  });

  // Update states when config is loaded
  useEffect(() => {
    if (config) {
      setHoraAviso(config.horaAviso || '09:00');
      setAvisoAtivo(config.ativo ?? true);
      setMensagemPadrao(config.mensagemPadrao || '');
    }
  }, [config]);

  // Update states when recurrent config is loaded
  useEffect(() => {
    if (configRecorrente) {
      setRecorrenteAtivo(configRecorrente.notificacoesRecorrentes ?? false);
      setRecorrenteIntervalo(String(configRecorrente.intervaloRecorrente || 3));
      setRecorrenteLimite(String(configRecorrente.limiteNotificacoes || 10));
    }
  }, [configRecorrente]);

  // Fetch notificações recorrentes ativas
  const { data: notificacoesRecorrentes } = useQuery({
    queryKey: ['/api/avisos/recorrentes-ativas'],
    queryFn: async () => {
      const response = await fetch('/api/avisos/recorrentes-ativas');
      if (!response.ok) throw new Error('Failed to fetch recurrent notifications');
      return response.json() as Promise<NotificacaoRecorrente[]>;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/avisos/config', {
        horaAviso,
        ativo: avisoAtivo,
        mensagemPadrao
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "As configurações de avisos foram atualizadas com sucesso.",
      });
      refetchConfig();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.response?.data?.error || "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive",
      });
    },
  });

  // Update recurrent configuration mutation
  const updateConfigRecorrenteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/avisos/config-recorrente', {
        notificacoesRecorrentes: recorrenteAtivo,
        intervaloRecorrente: parseInt(recorrenteIntervalo),
        limiteNotificacoes: parseInt(recorrenteLimite),
        mensagemRecorrente: recorrenteMensagem || undefined
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "As configurações de notificações recorrentes foram atualizadas.",
      });
      refetchConfigRecorrente();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.response?.data?.error || "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive",
      });
    },
  });

  // Send warning mutation
  const sendWarningMutation = useMutation({
    mutationFn: async (clienteId: number) => {
      const response = await api.post(`/api/avisos/enviar/${clienteId}`);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Aviso enviado",
        description: "O aviso de vencimento foi enviado com sucesso.",
      });
      refetchAvisos();
      refetchClientes();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.response?.data?.error || "Ocorreu um erro ao enviar o aviso.",
        variant: "destructive",
      });
    },
  });

  // Manually trigger warnings
  const triggerWarningsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/avisos/trigger');
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Avisos enviados",
        description: `${data.enviados} avisos foram enviados com sucesso.`,
      });
      refetchAvisos();
      refetchClientes();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar avisos",
        description: error.response?.data?.error || "Ocorreu um erro ao enviar os avisos.",
        variant: "destructive",
      });
    },
  });

  // Reset notificação recorrente mutation
  const resetNotificacaoMutation = useMutation({
    mutationFn: async (clienteId: number) => {
      const response = await api.post(`/api/avisos/reset-recorrente/${clienteId}`);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Contagem resetada",
        description: "A contagem de notificações foi reiniciada.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/avisos/recorrentes-ativas'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao resetar",
        description: error.response?.data?.error || "Ocorreu um erro ao resetar a contagem.",
        variant: "destructive",
      });
    },
  });

  const getDaysUntilExpiry = (vencimento: string | null | undefined) => {
    if (!vencimento) return 999;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiryDate = new Date(vencimento);
    expiryDate.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const getStatusBadge = (days: number, avisoEnviado: boolean) => {
    if (avisoEnviado) {
      return <Badge className="bg-green-500/20 text-green-400 text-xs">Notificado</Badge>;
    }
    
    if (days < 0) {
      return <Badge className="bg-red-500/20 text-red-400 text-xs">Vencido há {Math.abs(days)} dias</Badge>;
    } else if (days === 0) {
      return <Badge className="bg-orange-500/20 text-orange-400 text-xs">Vence hoje</Badge>;
    } else if (days <= 3) {
      return <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Vence em {days} dias</Badge>;
    }
    return null;
  };

  // Filter clients
  let filteredClients = clientes || [];
  
  if (searchTerm) {
    filteredClients = filteredClients.filter(cliente =>
      cliente.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.telefone?.includes(searchTerm)
    );
  }

  if (filterDays !== 'todos') {
    const days = parseInt(filterDays);
    if (days === -1) {
      // Show only expired
      filteredClients = filteredClients.filter(c => {
        const d = getDaysUntilExpiry(c.vencimento);
        return d < 0;
      });
    } else {
      filteredClients = filteredClients.filter(c => {
        const d = getDaysUntilExpiry(c.vencimento);
        return d <= days && d >= 0;
      });
    }
  }

  // Sort by days until expiry
  filteredClients = filteredClients.sort((a, b) => {
    const daysA = getDaysUntilExpiry(a.vencimento);
    const daysB = getDaysUntilExpiry(b.vencimento);
    return daysA - daysB;
  });

  const vencendoHoje = clientes?.filter(c => 
    c.vencimento && getDaysUntilExpiry(c.vencimento) === 0
  ).length || 0;

  const totalNotificadosHoje = avisos?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl md:rounded-2xl p-4 md:p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Calendar className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Vencimentos
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                Controle de vencimentos e avisos automáticos
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4 md:mt-6">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-slate-400">Vencendo hoje</span>
              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-orange-400" />
            </div>
            <p className="text-xl md:text-2xl font-bold text-orange-400 mt-1">{vencendoHoje}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-slate-400">Avisos hoje</span>
              <Bell className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
            </div>
            <p className="text-xl md:text-2xl font-bold text-green-400 mt-1">{totalNotificadosHoje}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-slate-400">Horário</span>
              <Clock className="w-3 h-3 md:w-4 md:h-4 text-blue-400" />
            </div>
            <p className="text-xl md:text-2xl font-bold text-blue-400 mt-1">{horaAviso}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-slate-400">Status</span>
              <BellRing className={`w-3 h-3 md:w-4 md:h-4 ${avisoAtivo ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <p className={`text-xl md:text-2xl font-bold mt-1 ${avisoAtivo ? 'text-green-400' : 'text-red-400'}`}>
              {avisoAtivo ? 'Ativo' : 'Inativo'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="visualizar" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-slate-800/50 to-slate-900/50 p-1 rounded-lg">
          <TabsTrigger 
            value="configuracoes" 
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Configurações</span>
          </TabsTrigger>
          <TabsTrigger 
            value="recorrentes" 
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-600 data-[state=active]:text-white"
          >
            <Timer className="w-4 h-4" />
            <span className="hidden sm:inline">Recorrentes</span>
          </TabsTrigger>
          <TabsTrigger 
            value="historico" 
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-600 data-[state=active]:text-white"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
          <TabsTrigger 
            value="visualizar" 
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Visualizar</span>
          </TabsTrigger>
        </TabsList>

        {/* Configurações Tab */}
        <TabsContent value="configuracoes" className="mt-6">
          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuração de Avisos
              </CardTitle>
              <CardDescription className="text-slate-400">
                Configure o horário e a mensagem padrão dos avisos de vencimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hora-aviso">Horário de envio</Label>
                  <Input
                    id="hora-aviso"
                    type="time"
                    value={horaAviso}
                    onChange={(e) => setHoraAviso(e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                  <p className="text-xs text-slate-400">
                    Horário diário para verificar e enviar avisos
                  </p>
                </div>
                
                <div className="space-y-2 flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="aviso-ativo">Avisos automáticos ativos</Label>
                    <Switch
                      id="aviso-ativo"
                      checked={avisoAtivo}
                      onCheckedChange={setAvisoAtivo}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {avisoAtivo ? 'Avisos serão enviados automaticamente' : 'Avisos automáticos desativados'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem padrão</Label>
                <Textarea
                  id="mensagem"
                  placeholder="Digite a mensagem padrão para os avisos..."
                  value={mensagemPadrao}
                  onChange={(e) => setMensagemPadrao(e.target.value)}
                  className="bg-slate-800 border-slate-700 min-h-[120px]"
                />
                <p className="text-xs text-slate-400">
                  Use {'{nome}'} para o nome do cliente e {'{dias}'} para os dias até o vencimento
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => updateConfigMutation.mutate()}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  disabled={updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
                <Button
                  onClick={() => triggerWarningsMutation.mutate()}
                  variant="outline"
                  className="border-slate-600 hover:bg-slate-800"
                  disabled={triggerWarningsMutation.isPending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {triggerWarningsMutation.isPending ? 'Enviando...' : 'Enviar Avisos Agora'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações Recorrentes Tab */}
        <TabsContent value="recorrentes" className="mt-6">
          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Timer className="w-5 h-5" />
                Notificações Recorrentes
              </CardTitle>
              <CardDescription className="text-slate-400">
                Configure avisos recorrentes para clientes que continuam vencidos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-400">Como funcionam as notificações</p>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>• <strong>Dia do vencimento:</strong> Sempre envia aviso automaticamente</li>
                      <li>• <strong>1 dia após vencimento:</strong> Sempre envia com opção de desbloqueio</li>
                      <li>• <strong>Notificações recorrentes:</strong> Configuração abaixo define o que acontece após os 2 primeiros dias</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="recorrente-ativo">Ativar Notificações Recorrentes</Label>
                    <Switch
                      id="recorrente-ativo"
                      checked={recorrenteAtivo}
                      onCheckedChange={setRecorrenteAtivo}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {recorrenteAtivo ? 'Continuará enviando avisos após 2 dias de vencimento' : 'Não enviará mais avisos após 2 dias'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="intervalo">Intervalo entre notificações</Label>
                  <Select value={recorrenteIntervalo} onValueChange={setRecorrenteIntervalo}>
                    <SelectTrigger id="intervalo" className="bg-slate-800 border-slate-700">
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
                  <p className="text-xs text-slate-400">
                    Frequência dos avisos após o 2º dia
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limite">Limite de notificações</Label>
                <Input
                  id="limite"
                  type="number"
                  min="1"
                  max="30"
                  value={recorrenteLimite}
                  onChange={(e) => setRecorrenteLimite(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                  disabled={!recorrenteAtivo}
                />
                <p className="text-xs text-slate-400">
                  Número máximo de notificações recorrentes (após isso, para de avisar)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem-recorrente">Mensagem personalizada (opcional)</Label>
                <Textarea
                  id="mensagem-recorrente"
                  placeholder="Digite uma mensagem adicional para as notificações recorrentes..."
                  value={recorrenteMensagem}
                  onChange={(e) => setRecorrenteMensagem(e.target.value)}
                  className="bg-slate-800 border-slate-700 min-h-[100px]"
                  disabled={!recorrenteAtivo}
                />
                <p className="text-xs text-slate-400">
                  Mensagem adicional que será incluída nas notificações recorrentes
                </p>
              </div>

              {/* Status de Notificações Recorrentes Ativas */}
              {notificacoesRecorrentes && notificacoesRecorrentes.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-sm font-semibold text-white mb-3">Notificações Recorrentes Ativas</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {notificacoesRecorrentes.map((notif) => (
                      <div key={notif.id} className="flex items-center justify-between bg-slate-900/50 rounded p-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                              {notif.cliente?.nome?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-medium text-white">{notif.cliente?.nome || 'Cliente'}</p>
                            <p className="text-xs text-slate-400">
                              {notif.contagemNotificacoes} notificações enviadas
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resetNotificacaoMutation.mutate(notif.clienteId)}
                          className="text-xs hover:bg-slate-800"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Resetar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => updateConfigRecorrenteMutation.mutate()}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                  disabled={updateConfigRecorrenteMutation.isPending}
                >
                  {updateConfigRecorrenteMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Histórico Tab */}
        <TabsContent value="historico" className="mt-6">
          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Avisos
              </CardTitle>
              <CardDescription className="text-slate-400">
                Visualize todos os avisos enviados recentemente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {historico && historico.length > 0 ? (
                  historico.map((aviso) => (
                    <div key={aviso.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                            {aviso.cliente?.nome?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-white">{aviso.cliente?.nome || 'Cliente'}</p>
                          <p className="text-xs text-slate-400">
                            {formatPhoneNumber(aviso.telefone)} • {new Date(aviso.dataAviso).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <Badge className={aviso.statusEnvio === 'enviado' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {aviso.statusEnvio === 'enviado' ? 'Enviado' : 'Erro'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum aviso foi enviado recentemente</p>
                  </div>
                )}
              </div>
              <Button
                onClick={() => refetchHistorico()}
                variant="outline"
                className="mt-4 border-slate-600 hover:bg-slate-800"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar Histórico
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visualizar Tab */}
        <TabsContent value="visualizar" className="mt-6">
          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Clientes e Vencimentos
              </CardTitle>
              <CardDescription className="text-slate-400">
                Visualize e gerencie os vencimentos dos clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700"
                  />
                </div>
                
                <Select value={filterDays} onValueChange={setFilterDays}>
                  <SelectTrigger className="w-full md:w-[180px] bg-slate-800 border-slate-700">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="0">Vence hoje</SelectItem>
                    <SelectItem value="3">Próximos 3 dias</SelectItem>
                    <SelectItem value="7">Próximos 7 dias</SelectItem>
                    <SelectItem value="-1">Vencidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clients List */}
              <div className="space-y-2">
                {filteredClients.length > 0 ? (
                  filteredClients.map((cliente) => {
                    const days = getDaysUntilExpiry(cliente.vencimento);
                    const avisoEnviado = avisos?.some(a => a.clienteId === cliente.id) || false;
                    
                    return (
                      <div key={cliente.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 md:p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800/70 transition-colors">
                        <div className="flex items-center gap-3 mb-2 md:mb-0">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                              {cliente.nome?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-white">{cliente.nome}</p>
                            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {formatPhoneNumber(cliente.telefone || '')}
                              </span>
                              {cliente.vencimento && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(cliente.vencimento).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          {getStatusBadge(days, avisoEnviado)}
                          {!avisoEnviado && days <= 7 && days >= -30 && (
                            <Button
                              size="sm"
                              onClick={() => sendWarningMutation.mutate(cliente.id)}
                              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-xs"
                              disabled={sendWarningMutation.isPending}
                            >
                              <Bell className="w-3 h-3 mr-1" />
                              Enviar Aviso
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/chat?telefone=${cliente.telefone}`)}
                            className="text-xs hover:bg-slate-700"
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Chat
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum cliente encontrado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}