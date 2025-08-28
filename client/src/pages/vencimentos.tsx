import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Bell, BellOff, Send, Search, Filter, AlertTriangle, CheckCircle, Users, Phone, Settings, RefreshCw } from 'lucide-react';
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

export default function Vencimentos() {
  const [location, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDays, setFilterDays] = useState('todos');
  const [configOpen, setConfigOpen] = useState(false);
  const [horaAviso, setHoraAviso] = useState('09:00');
  const [avisoAtivo, setAvisoAtivo] = useState(true);
  const [mensagemPadrao, setMensagemPadrao] = useState('');
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
  });

  // Fetch avisos sent today
  const { data: avisos, refetch: refetchAvisos } = useQuery({
    queryKey: ['/api/avisos/hoje'],
    queryFn: async () => {
      const response = await fetch('/api/avisos/hoje');
      if (!response.ok) throw new Error('Failed to fetch avisos');
      return response.json();
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

  const checkIfNotified = (clienteId: number) => {
    return avisos?.some((aviso: any) => aviso.clienteId === clienteId);
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Vencimentos
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Controle de vencimentos e avisos automáticos
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => setConfigOpen(!configOpen)}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar Avisos
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Vencendo hoje</span>
              <Calendar className="w-4 h-4 text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-orange-400 mt-1">{vencendoHoje}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Notificados hoje</span>
              <Bell className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-400 mt-1">{totalNotificadosHoje}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Horário de aviso</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-400 mt-1">{horaAviso}</p>
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
            <div className="grid grid-cols-2 gap-4">
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
            
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem Padrão</Label>
              <Textarea
                id="mensagem"
                value={mensagemPadrao}
                onChange={(e) => setMensagemPadrao(e.target.value)}
                className="bg-slate-800 border-slate-700 h-32"
                placeholder="Digite a mensagem que será enviada aos clientes..."
              />
              <p className="text-xs text-slate-400">
                Use {'{nome}'} para incluir o nome do cliente na mensagem
              </p>
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

      {/* Filters and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-dark-surface border-slate-600"
            />
          </div>
          
          <Select value={filterDays} onValueChange={setFilterDays}>
            <SelectTrigger className="w-[180px] bg-dark-surface border-slate-600">
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
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Verificar e Avisar Todos
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-dark-card border-slate-600">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Cliente</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Telefone</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Vencimento</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Status</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-semibold">Notificado</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes?.map((cliente) => {
                  const days = cliente.vencimento ? getDaysUntilExpiry(cliente.vencimento) : null;
                  const notified = checkIfNotified(cliente.id);
                  
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
                      <td className="py-3 px-4 text-center">
                        {notified ? (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-green-400">Sim</span>
                          </div>
                        ) : days === 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                            <span className="text-xs text-yellow-400">Não</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => sendAvisoMutation.mutate(cliente)}
                          disabled={notified || !cliente.vencimento}
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