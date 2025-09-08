import { useState } from 'react';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Eye, Check, Clock, AlertCircle, Ticket as TicketIcon, User, Calendar, 
  MessageSquare, CheckCircle, XCircle, Plus, Search, Filter, ChevronRight,
  TrendingUp, TrendingDown, BarChart3, Briefcase, AlertTriangle, Sparkles,
  PhoneCall, Mail, Hash, Clock3, Star, Archive, Trash2, ChevronUp, ChevronDown,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { Ticket, Cliente } from '@/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Tickets() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'aberto' | 'em_atendimento' | 'fechado'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [newTicket, setNewTicket] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media' as 'baixa' | 'media' | 'alta',
    clienteId: null as number | null,
    telefone: ''
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Format phone number by removing country code and applying mask
  const formatPhoneNumber = (phone: string) => {
    // Remove country code 55 if present
    let cleaned = phone.replace(/^55/, '');
    
    // Remove any non-digit characters
    cleaned = cleaned.replace(/\D/g, '');
    
    // Apply formatting based on length
    if (cleaned.length === 11) {
      // Mobile: (14) 99988-7766
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      // Landline: (14) 3333-4444
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    
    // Return original if doesn't match expected format
    return cleaned;
  };

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['/api/tickets'],
    queryFn: api.getTickets,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const updateTicketMutation = useMutation({
    mutationFn: (params: { id: number; status: string }) => 
      api.updateTicket(params.id, { status: params.status }),
    onSuccess: () => {
      toast({ title: 'Ticket atualizado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar ticket', variant: 'destructive' });
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: (ticketData: typeof newTicket) => 
      api.createTicket(ticketData),
    onSuccess: () => {
      toast({ title: 'Ticket criado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      setShowNewTicketDialog(false);
      // Reset form
      setNewTicket({
        titulo: '',
        descricao: '',
        prioridade: 'media',
        clienteId: null,
        telefone: ''
      });
    },
    onError: () => {
      toast({ title: 'Erro ao criar ticket', variant: 'destructive' });
    },
  });

  // Get clients for ticket creation
  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  // Filter tickets based on status and search term
  const filteredTickets = tickets?.filter(ticket => {
    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    const matchesSearch = searchTerm === '' || 
      ticket.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.telefone.includes(searchTerm) ||
      ticket.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate statistics
  const stats = {
    total: tickets?.length || 0,
    abertos: tickets?.filter(t => t.status === 'aberto').length || 0,
    emAtendimento: tickets?.filter(t => t.status === 'em_atendimento').length || 0,
    fechados: tickets?.filter(t => t.status === 'fechado').length || 0,
    altaPrioridade: tickets?.filter(t => t.prioridade === 'alta').length || 0,
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      aberto: {
        badge: 'bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/30',
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Aberto',
        color: 'from-red-500 to-orange-500'
      },
      em_atendimento: {
        badge: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border border-yellow-500/30',
        icon: <Clock className="w-4 h-4" />,
        label: 'Em Atendimento',
        color: 'from-yellow-500 to-amber-500'
      },
      fechado: {
        badge: 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30',
        icon: <CheckCircle className="w-4 h-4" />,
        label: 'Fechado',
        color: 'from-green-500 to-emerald-500'
      },
    };
    return configs[status as keyof typeof configs] || configs.aberto;
  };

  const getPriorityConfig = (prioridade: string) => {
    const configs = {
      baixa: {
        badge: 'bg-gradient-to-r from-blue-500/20 to-sky-500/20 text-blue-400 border border-blue-500/30',
        icon: <ChevronDown className="w-4 h-4" />,
        label: 'Baixa',
        color: 'from-blue-500 to-sky-500'
      },
      media: {
        badge: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border border-yellow-500/30',
        icon: <ChevronRight className="w-4 h-4" />,
        label: 'Média',
        color: 'from-yellow-500 to-amber-500'
      },
      alta: {
        badge: 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-400 border border-red-500/30',
        icon: <ChevronUp className="w-4 h-4" />,
        label: 'Alta',
        color: 'from-red-500 to-pink-500'
      },
    };
    return configs[prioridade as keyof typeof configs] || configs.media;
  };

  const handleStatusChange = (ticketId: number, newStatus: string) => {
    updateTicketMutation.mutate({ id: ticketId, status: newStatus });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d atrás`;
    if (diffHours > 0) return `${diffHours}h atrás`;
    if (diffMins > 0) return `${diffMins}m atrás`;
    return 'Agora';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Professional Header with Stats */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl md:rounded-2xl p-4 md:p-8 border border-slate-700/50 shadow-2xl"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 md:mb-8 gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 blur-xl opacity-50"></div>
              <div className="relative p-3 md:p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl md:rounded-2xl shadow-2xl">
                <TicketIcon className="w-8 h-8 md:w-12 md:h-12 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2">
                Central de Tickets
              </h1>
              <p className="text-slate-400 text-sm md:text-lg">
                Gerencie solicitações e suporte aos clientes
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setShowNewTicketDialog(true)}
            className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            <span className="text-sm md:text-base">Novo Ticket</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-slate-700"
          >
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
              <span className="text-xs text-slate-400">Total</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-400 mt-1">tickets criados</p>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-slate-700"
          >
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
              <span className="text-xs text-slate-400">Abertos</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-red-400">{stats.abertos}</p>
            <p className="text-xs text-slate-400 mt-1">aguardando</p>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-slate-700"
          >
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
              <span className="text-xs text-slate-400">Atendimento</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-yellow-400">{stats.emAtendimento}</p>
            <p className="text-xs text-slate-400 mt-1">em progresso</p>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-slate-700"
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
              <span className="text-xs text-slate-400">Fechados</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-green-400">{stats.fechados}</p>
            <p className="text-xs text-slate-400 mt-1">resolvidos</p>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-slate-700 col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
              <span className="text-xs text-slate-400">Prioridade Alta</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-orange-400">{stats.altaPrioridade}</p>
            <p className="text-xs text-slate-400 mt-1">urgentes</p>
          </motion.div>
        </div>
      </motion.div>
      
      {/* Filters and Search */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
          <Input
            placeholder="Buscar tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 md:pl-10 bg-slate-800/50 border-slate-700 focus:border-blue-500 transition-colors text-sm md:text-base"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['all', 'aberto', 'em_atendimento', 'fechado'] as const).map((status) => {
            const isActive = filterStatus === status;
            const config = status === 'all' ? null : getStatusConfig(status);
            
            return (
              <motion.button
                key={status}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                    : "bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700"
                )}
              >
                <div className="flex items-center gap-2">
                  {status === 'all' ? (
                    <>
                      <Briefcase className="w-4 h-4" />
                      <span>Todos</span>
                      <span className="text-xs">({stats.total})</span>
                    </>
                  ) : (
                    <>
                      {config?.icon}
                      <span>{config?.label}</span>
                      <span className="text-xs">
                        ({status === 'aberto' ? stats.abertos : 
                          status === 'em_atendimento' ? stats.emAtendimento : 
                          stats.fechados})
                      </span>
                    </>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Tickets List */}
      <AnimatePresence mode="popLayout">
        {isLoading ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center h-64"
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-slate-400">Carregando tickets...</p>
            </div>
          </motion.div>
        ) : filteredTickets?.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="bg-slate-800/30 rounded-full p-6 mb-4">
              <TicketIcon className="w-12 h-12 text-slate-600" />
            </div>
            <p className="text-xl text-slate-400 mb-2">Nenhum ticket encontrado</p>
            <p className="text-sm text-slate-500">
              {searchTerm ? 'Tente ajustar sua busca' : 'Crie um novo ticket para começar'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredTickets?.map((ticket, index) => {
              const statusConfig = getStatusConfig(ticket.status);
              const priorityConfig = getPriorityConfig(ticket.prioridade);
              
              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                  className="group"
                >
                  <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all duration-300 overflow-hidden">
                    <div className={cn(
                      "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                      statusConfig.color
                    )} />
                    
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left Section */}
                        <div className="flex items-start gap-4 flex-1">
                          <div className="relative">
                            <div className={cn(
                              "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold shadow-lg",
                              statusConfig.color
                            )}>
                              {ticket.telefone.slice(-2)}
                            </div>
                            <div className={cn(
                              "absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center"
                            )}>
                              {priorityConfig.icon}
                            </div>
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                                  {ticket.titulo}
                                  <span className="text-xs font-mono text-slate-500">#{ticket.id}</span>
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                  <div className="flex items-center gap-1">
                                    <PhoneCall className="w-4 h-4" />
                                    <span>{formatPhoneNumber(ticket.telefone)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock3 className="w-4 h-4" />
                                    <span>{getTimeAgo(ticket.dataCriacao)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{formatDate(ticket.dataCriacao)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <p className="text-slate-300 line-clamp-2 mb-3">
                              {ticket.descricao}
                            </p>
                            
                            <div className="flex items-center gap-2">
                              <Badge className={cn("flex items-center gap-1", statusConfig.badge)}>
                                {statusConfig.icon}
                                {statusConfig.label}
                              </Badge>
                              <Badge className={cn("flex items-center gap-1", priorityConfig.badge)}>
                                {priorityConfig.icon}
                                Prioridade {priorityConfig.label}
                              </Badge>
                              {ticket.clienteNome && (
                                <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {ticket.clienteNome}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Right Section - Actions */}
                        <div className="flex items-center gap-2">
                          <Select
                            value={ticket.status}
                            onValueChange={(value) => handleStatusChange(ticket.id, value)}
                          >
                            <SelectTrigger className="w-40 bg-slate-900/50 border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aberto">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4 text-red-400" />
                                  Aberto
                                </div>
                              </SelectItem>
                              <SelectItem value="em_atendimento">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-yellow-400" />
                                  Em Atendimento
                                </div>
                              </SelectItem>
                              <SelectItem value="fechado">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                  Fechado
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              // Navigate to chat page with the conversation from this ticket
                              setLocation(`/chat?conversaId=${ticket.conversaId}`);
                            }}
                            className="hover:bg-slate-700"
                            title="Ver conversa"
                          >
                            <MessageSquare className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* New Ticket Dialog */}
      <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
        <DialogContent className="bg-slate-900 border border-slate-700 max-w-lg text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Criar Novo Ticket</DialogTitle>
            <DialogDescription className="text-slate-400">
              Preencha as informações do ticket de suporte
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="titulo" className="text-white">Título</Label>
              <Input
                id="titulo"
                placeholder="Descreva brevemente o problema"
                value={newTicket.titulo}
                onChange={(e) => setNewTicket({ ...newTicket, titulo: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="telefone" className="text-white">Telefone</Label>
              <Input
                id="telefone"
                placeholder="(14) 99988-7766"
                value={newTicket.telefone}
                onChange={(e) => setNewTicket({ ...newTicket, telefone: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="descricao" className="text-white">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o problema em detalhes"
                value={newTicket.descricao}
                onChange={(e) => setNewTicket({ ...newTicket, descricao: e.target.value })}
                className="bg-slate-800 border-slate-700 min-h-[100px] text-white placeholder:text-slate-400"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="prioridade" className="text-white">Prioridade</Label>
              <Select
                value={newTicket.prioridade}
                onValueChange={(value: 'baixa' | 'media' | 'alta') => 
                  setNewTicket({ ...newTicket, prioridade: value })
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="w-4 h-4 text-blue-400" />
                      Baixa
                    </div>
                  </SelectItem>
                  <SelectItem value="media">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-yellow-400" />
                      Média
                    </div>
                  </SelectItem>
                  <SelectItem value="alta">
                    <div className="flex items-center gap-2">
                      <ChevronUp className="w-4 h-4 text-red-400" />
                      Alta
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {clientes && clientes.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="cliente" className="text-white">Cliente (Opcional)</Label>
                <Select
                  value={newTicket.clienteId?.toString() || ''}
                  onValueChange={(value) => 
                    setNewTicket({ ...newTicket, clienteId: value ? parseInt(value) : null })
                  }
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">
                      <div className="flex items-center gap-2">
                        Nenhum cliente
                      </div>
                    </SelectItem>
                    {clientes.map((cliente: any) => (
                      <SelectItem key={cliente.id} value={cliente.id.toString()}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {cliente.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNewTicketDialog(false)}
              className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!newTicket.titulo || !newTicket.telefone || !newTicket.descricao) {
                  toast({ 
                    title: 'Preencha todos os campos obrigatórios', 
                    variant: 'destructive' 
                  });
                  return;
                }
                createTicketMutation.mutate(newTicket);
              }}
              disabled={createTicketMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              {createTicketMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Ticket'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Details Dialog */}
      <Dialog open={showTicketDetails} onOpenChange={setShowTicketDetails}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Ticket #{selectedTicket?.id}</DialogTitle>
          </DialogHeader>
          {/* Add ticket details here */}
        </DialogContent>
      </Dialog>
    </div>
  );
}
