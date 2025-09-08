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
  AlertCircle, Timer, BellRing
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

export default function Vencimentos() {
  const [location, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDays, setFilterDays] = useState('todos');
  const [configOpen, setConfigOpen] = useState(false);
  const [horaAviso, setHoraAviso] = useState('09:00');
  const [avisoAtivo, setAvisoAtivo] = useState(true);
  const [mensagemPadrao, setMensagemPadrao] = useState('');
  const [showHistorico, setShowHistorico] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);
  const { toast } = useToast();
  
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

  // Fetch all avisos (histórico)
  const { data: todosAvisos } = useQuery({
    queryKey: ['/api/avisos'],
    queryFn: async () => {
      const response = await fetch('/api/avisos');
      if (!response.ok) throw new Error('Failed to fetch all avisos');
      return response.json() as Promise<AvisoVencimento[]>;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 0,
  });

  // Fetch config avisos
  const { data: config } = useQuery({
    queryKey: ['/api/avisos/config'],
    queryFn: async () => {
      const response = await fetch('/api/avisos/config');
      if (!response.ok) throw new Error('Failed to fetch config');
      return response.json();
    },
    refetchInterval: 15000, // Auto-refresh every 15 seconds
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (config) {
      setHoraAviso(config.horaAviso || '09:00');
      setAvisoAtivo(config.ativo ?? true);
      setMensagemPadrao(config.mensagemPadrao || '');
    }
  }, [config]);

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/avisos/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horaAviso,
          ativo: avisoAtivo,
          mensagemPadrao,
          diasAntecedencia: 0
        }),
      });
      if (!response.ok) throw new Error('Failed to update config');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Configuração salva',
        description: 'Configurações de avisos atualizadas com sucesso.',
      });
      setConfigOpen(false);
      // Invalidate and refetch config to ensure UI is updated
      queryClient.invalidateQueries({ queryKey: ['/api/avisos/config'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configurações.',
        variant: 'destructive',
      });
    },
  });

  // Send aviso mutation
  const sendAvisoMutation = useMutation({
    mutationFn: async (cliente: Cliente) => {
      const response = await fetch('/api/avisos/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: cliente.id,
          telefone: cliente.telefone,
        }),
      });
      if (!response.ok) throw new Error('Failed to send aviso');
      return response.json();
    },
    onSuccess: (_, cliente) => {
      toast({
        title: 'Aviso enviado',
        description: `Aviso de vencimento enviado para ${cliente.nome}.`,
      });
      refetchAvisos();
      queryClient.invalidateQueries({ queryKey: ['/api/avisos'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao enviar aviso.',
        variant: 'destructive',
      });
    },
  });

  // Check all expired today mutation
  const checkExpiredMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/avisos/verificar-vencimentos', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to check expired');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Verificação concluída',
        description: `${data.avisosEnviados || 0} avisos enviados para clientes vencendo hoje.`,
      });
      refetchAvisos();
      refetchClientes();
      queryClient.invalidateQueries({ queryKey: ['/api/avisos'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao verificar vencimentos.',
        variant: 'destructive',
      });
    },
  });

  const getDaysUntilExpiry = (vencimento: string) => {
    const expiryDate = new Date(vencimento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysRemainingBadge = (days: number) => {
    if (days <= 0) return 'bg-red-500/20 text-red-400 border-red-500/50';
    if (days <= 3) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    if (days <= 7) return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
    return 'bg-green-500/20 text-green-400 border-green-500/50';
  };

  const getDaysText = (days: number) => {
    if (days === 0) return 'Vence hoje';
    if (days === 1) return '1 dia';
    if (days === -1) return 'Venceu ontem';
    if (days < 0) return `Vencido há ${Math.abs(days)} dias`;
    return `${days} dias`;
  };

  const getTipoAvisoInfo = (tipo: string) => {
    switch (tipo) {
      case 'vence_hoje':
        return {
          label: 'Vence Hoje',
          color: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
          icon: <AlertCircle className="w-3 h-3" />
        };
      case 'venceu_ontem':
        return {
          label: 'Venceu Ontem',
          color: 'bg-red-500/20 text-red-400 border-red-500/50',
          icon: <AlertTriangle className="w-3 h-3" />
        };
      case 'vencido_recorrente':
        return {
          label: 'Lembrete (3 dias)',
          color: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
          icon: <Timer className="w-3 h-3" />
        };
      case 'manual':
        return {
          label: 'Manual',
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
          icon: <Send className="w-3 h-3" />
        };
      default:
        return {
          label: 'Automático',
          color: 'bg-green-500/20 text-green-400 border-green-500/50',
          icon: <Bell className="w-3 h-3" />
        };
    }
  };

  const checkIfNotified = (clienteId: number) => {
    return avisos?.some((aviso: AvisoVencimento) => aviso.clienteId === clienteId);
  };

  const getClienteAvisos = (clienteId: number) => {
    return todosAvisos?.filter((aviso: AvisoVencimento) => aviso.clienteId === clienteId) || [];
  };

  const getAvisosStats = () => {
    if (!avisos) return { hoje: 0, ontem: 0, recorrente: 0, manual: 0 };
    
    return {
      hoje: avisos.filter(a => a.tipoAviso === 'vence_hoje').length,
      ontem: avisos.filter(a => a.tipoAviso === 'venceu_ontem').length,
      recorrente: avisos.filter(a => a.tipoAviso === 'vencido_recorrente').length,
      manual: avisos.filter(a => a.tipoAviso === 'manual').length,
    };
  };

  const stats = getAvisosStats();

  const filteredClientes = clientes?.filter(cliente => {
    // Search filter
    const matchesSearch = !searchTerm || 
      cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.telefone.includes(searchTerm);
    
    // Days filter
    let matchesDays = true;
    if (filterDays !== 'todos' && cliente.vencimento) {
      const days = getDaysUntilExpiry(cliente.vencimento);
      if (filterDays === 'hoje') matchesDays = days === 0;
      else if (filterDays === '3dias') matchesDays = days >= 0 && days <= 3;
      else if (filterDays === '7dias') matchesDays = days >= 0 && days <= 7;
      else if (filterDays === 'vencidos') matchesDays = days < 0;
    }

    return matchesSearch && matchesDays;
  }).sort((a, b) => {
    // Sort by days remaining (ascending - expiring first)
    if (!a.vencimento && !b.vencimento) return 0;
    if (!a.vencimento) return 1;
    if (!b.vencimento) return -1;
    
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
          
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              onClick={() => setShowHistorico(!showHistorico)}
              variant="outline"
              className="border-slate-600 hover:bg-slate-800 flex-1 md:flex-none text-xs md:text-sm"
            >
              <History className="w-4 h-4 mr-1 md:mr-2" />
              Histórico
            </Button>
            <Button
              onClick={() => setConfigOpen(!configOpen)}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 flex-1 md:flex-none text-xs md:text-sm"
            >
              <Settings className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Configurar</span> Avisos
            </Button>
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

      {/* Config Panel */}
      {configOpen && (
        <Card className="bg-dark-card border-slate-600">
          <CardHeader>
            <CardTitle className="text-white">Configuração de Avisos Automáticos</CardTitle>
            <CardDescription className="text-slate-400">
              Configure o horário e mensagem dos avisos automáticos de vencimento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hora">Horário de Envio</Label>
                <Input
                  id="hora"
                  type="time"
                  value={horaAviso}
                  onChange={(e) => setHoraAviso(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-400">
                  Horário que os avisos serão enviados diariamente
                </p>
              </div>
              
              <div className="space-y-2 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ativo">Avisos Automáticos</Label>
                  <Switch
                    id="ativo"
                    checked={avisoAtivo}
                    onCheckedChange={setAvisoAtivo}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {avisoAtivo ? 'Avisos serão enviados automaticamente' : 'Avisos automáticos desativados'}
                </p>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-semibold text-white mb-2">Regras de Avisos Automáticos</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <AlertCircle className="w-3 h-3 text-orange-400" />
                  <span><strong className="text-orange-400">No dia do vencimento:</strong> Aviso de que o plano vence hoje</span>
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span><strong className="text-red-400">1 dia após vencimento:</strong> Aviso com opção de desbloqueio de confiança</span>
                </li>
                <li className="flex items-center gap-2">
                  <Timer className="w-3 h-3 text-purple-400" />
                  <span><strong className="text-purple-400">A cada 3 dias após:</strong> Lembretes recorrentes para renovação</span>
                </li>
              </ul>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => updateConfigMutation.mutate()}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                Salvar Configurações
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfigOpen(false)}
                className="border-slate-600 hover:bg-slate-800"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Avisos */}
      {showHistorico && todosAvisos && (
        <Card className="bg-dark-card border-slate-600">
          <CardHeader>
            <CardTitle className="text-white">Histórico de Avisos</CardTitle>
            <CardDescription className="text-slate-400">
              Últimos avisos enviados para todos os clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {todosAvisos.slice(0, 50).map((aviso) => {
                const tipoInfo = getTipoAvisoInfo(aviso.tipoAviso);
                const cliente = clientes?.find(c => c.id === aviso.clienteId);
                
                return (
                  <div key={aviso.id} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-xs">
                            {cliente?.nome?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-white">{cliente?.nome || 'Cliente Desconhecido'}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(aviso.dataAviso).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <Badge className={`flex items-center gap-1 ${tipoInfo.color}`}>
                        {tipoInfo.icon}
                        {tipoInfo.label}
                      </Badge>
                    </div>
                    {aviso.mensagemEnviada && (
                      <div className="mt-2 p-2 bg-slate-900/50 rounded text-xs text-slate-300 font-mono">
                        {aviso.mensagemEnviada.substring(0, 100)}...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-dark-surface border-slate-600 text-sm md:text-base"
            />
          </div>
          
          <Select value={filterDays} onValueChange={setFilterDays}>
            <SelectTrigger className="w-full sm:w-[180px] bg-dark-surface border-slate-600 text-sm md:text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-dark-surface border-slate-600">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="hoje">Vence hoje</SelectItem>
              <SelectItem value="3dias">Próximos 3 dias</SelectItem>
              <SelectItem value="7dias">Próximos 7 dias</SelectItem>
              <SelectItem value="vencidos">Vencidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button
          onClick={() => checkExpiredMutation.mutate()}
          disabled={checkExpiredMutation.isPending}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 w-full md:w-auto text-sm md:text-base"
        >
          <RefreshCw className={`w-4 h-4 mr-1 md:mr-2 ${checkExpiredMutation.isPending ? 'animate-spin' : ''}`} />
          <span className="sm:hidden">Avisar</span>
          <span className="hidden sm:inline">Verificar e Avisar Todos</span>
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-dark-card border-slate-600">
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Cliente</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Telefone</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Vencimento</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Status</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-semibold">Avisos</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes?.map((cliente) => {
                  const days = cliente.vencimento ? getDaysUntilExpiry(cliente.vencimento) : null;
                  const notified = checkIfNotified(cliente.id);
                  const clienteAvisos = getClienteAvisos(cliente.id);
                  const avisosHoje = clienteAvisos.filter(a => {
                    const avisoDate = new Date(a.dataAviso);
                    const today = new Date();
                    return avisoDate.toDateString() === today.toDateString();
                  });
                  
                  return (
                    <tr key={cliente.id} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar 
                            className="w-12 h-12 shadow-md cursor-pointer"
                            onClick={() => navigate(`/clientes/${cliente.id}`)}
                          >
                            <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                              <span className="text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-lg font-bold">
                                {cliente.nome && cliente.nome.length > 0 ? cliente.nome.charAt(0).toUpperCase() : '?'}
                              </span>
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p 
                              className="font-semibold text-white text-lg cursor-pointer hover:text-blue-400 transition-colors"
                              onClick={() => navigate(`/clientes/${cliente.id}`)}
                            >
                              {cliente.nome}
                            </p>
                            {cliente.observacoes && (
                              <p className="text-xs text-slate-400 mt-0.5">{cliente.observacoes}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-300">
                          {formatPhoneNumber(cliente.telefone)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {cliente.vencimento ? (
                          <div>
                            <p className="text-white">
                              {new Date(cliente.vencimento).toLocaleDateString('pt-BR')}
                            </p>
                            <Badge className={`${getDaysRemainingBadge(days!)} mt-1`}>
                              {getDaysText(days!)}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-slate-500">Não definido</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          className={`
                            ${cliente.status === 'ativo' ? 'bg-green-500/20 text-green-400 border-green-500/50' : ''}
                            ${cliente.status === 'inativo' ? 'bg-red-500/20 text-red-400 border-red-500/50' : ''}
                            ${cliente.status === 'suspenso' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : ''}
                          `}
                        >
                          {cliente.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-center gap-1">
                          {avisosHoje.length > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <span className="text-xs text-green-400">{avisosHoje.length} hoje</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-800 border-slate-700">
                                  <div className="space-y-1">
                                    {avisosHoje.map((aviso, idx) => {
                                      const tipoInfo = getTipoAvisoInfo(aviso.tipoAviso);
                                      return (
                                        <div key={idx} className="flex items-center gap-2">
                                          {tipoInfo.icon}
                                          <span className="text-xs">{tipoInfo.label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : days === 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              <span className="text-xs text-yellow-400">Pendente</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                          {clienteAvisos.length > 0 && (
                            <span className="text-xs text-slate-400">
                              Total: {clienteAvisos.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => sendAvisoMutation.mutate(cliente)}
                          disabled={notified || !cliente.vencimento || sendAvisoMutation.isPending}
                          className={
                            notified 
                              ? "bg-slate-700 text-slate-400 cursor-not-allowed" 
                              : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                          }
                        >
                          {notified ? (
                            <>
                              <BellOff className="w-3 h-3 mr-1" />
                              Avisado
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3 mr-1" />
                              Avisar
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Cards View */}
          <div className="block md:hidden p-4 space-y-4">
            {filteredClientes?.map((cliente) => {
              const days = cliente.vencimento ? getDaysUntilExpiry(cliente.vencimento) : null;
              const notified = checkIfNotified(cliente.id);
              const clienteAvisos = getClienteAvisos(cliente.id);
              const avisosHoje = clienteAvisos.filter(a => {
                const avisoDate = new Date(a.dataAviso);
                const today = new Date();
                return avisoDate.toDateString() === today.toDateString();
              });
              
              return (
                <div
                  key={cliente.id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3"
                >
                  {/* Header with Name and Status */}
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex items-center gap-3 flex-1"
                      onClick={() => navigate(`/clientes/${cliente.id}`)}
                    >
                      <Avatar className="w-10 h-10 shadow-md">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                          <span className="text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text font-bold">
                            {cliente.nome?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{cliente.nome}</p>
                        <p className="text-xs text-slate-400">{formatPhoneNumber(cliente.telefone)}</p>
                      </div>
                    </div>
                    <Badge 
                      className={`
                        text-xs px-2 py-1
                        ${cliente.status === 'ativo' ? 'bg-green-500/20 text-green-400 border-green-500/50' : ''}
                        ${cliente.status === 'inativo' ? 'bg-red-500/20 text-red-400 border-red-500/50' : ''}
                        ${cliente.status === 'suspenso' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : ''}
                      `}
                    >
                      {cliente.status}
                    </Badge>
                  </div>
                  
                  {/* Vencimento Info */}
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">Vencimento</span>
                      {days !== null && (
                        <Badge className={`${getDaysRemainingBadge(days)} text-xs`}>
                          {getDaysText(days)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-white font-medium">
                      {cliente.vencimento 
                        ? new Date(cliente.vencimento).toLocaleDateString('pt-BR')
                        : 'Não definido'
                      }
                    </p>
                  </div>
                  
                  {/* Avisos e Ações */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                    <div className="flex items-center gap-2">
                      {avisosHoje.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Bell className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-green-400">{avisosHoje.length} aviso(s) hoje</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Sem avisos hoje</span>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => sendManualNotificationMutation.mutate(cliente.id)}
                      disabled={sendManualNotificationMutation.isPending || notified}
                      size="sm"
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      {notified ? 'Enviado' : 'Avisar'}
                    </Button>
                  </div>
                  
                  {cliente.observacoes && (
                    <div className="pt-2 border-t border-slate-700/50">
                      <p className="text-xs text-slate-400">{cliente.observacoes}</p>
                    </div>
                  )}
                </div>
              );
            })}
            
            {(!filteredClientes || filteredClientes.length === 0) && (
              <div className="py-8">
                <div className="flex flex-col items-center justify-center">
                  <Calendar className="w-12 h-12 text-slate-500 mb-3" />
                  <p className="text-slate-400 text-base font-medium text-center">
                    Nenhum vencimento encontrado
                  </p>
                  <p className="text-slate-500 text-sm mt-2 text-center">
                    {searchTerm ? 'Tente ajustar os filtros' : 'Todos os clientes estão em dia'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {!filteredClientes?.length && (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">Nenhum cliente encontrado com os filtros aplicados</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}