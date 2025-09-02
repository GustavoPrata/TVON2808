import { useState, useEffect } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ClientModal } from '@/components/modals/client-modal';
import { Plus, Search, Eye, Filter, Users, Phone, DollarSign, Calendar, CheckCircle, XCircle, AlertTriangle, Activity, Monitor } from 'lucide-react';
import { api } from '@/lib/api';
import type { Cliente } from '@/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useSettings } from '@/contexts/settings-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function Clientes() {
  const [, setLocation] = useLocation();
  const { showPhotosClientes } = useSettings();
  
  // Initialize from localStorage or defaults
  const [searchTerm, setSearchTerm] = useState(() => 
    localStorage.getItem('clientes-search') || ''
  );
  const [viewMode, setViewMode] = useState<'clientes' | 'pontos'>(() => 
    (localStorage.getItem('view-mode') as 'clientes' | 'pontos') || 'clientes'
  );
  const [clienteType, setClienteType] = useState<'regular' | 'familia'>(() => 
    (localStorage.getItem('clientes-type') as 'regular' | 'familia') || 'regular'
  );
  const [showCanceled, setShowCanceled] = useState(() => 
    localStorage.getItem('clientes-show-canceled') === 'true'
  );
  
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem('clientes-search', searchTerm);
  }, [searchTerm]);
  
  useEffect(() => {
    localStorage.setItem('clientes-type', clienteType);
  }, [clienteType]);
  
  useEffect(() => {
    localStorage.setItem('clientes-show-canceled', String(showCanceled));
  }, [showCanceled]);
  
  useEffect(() => {
    localStorage.setItem('view-mode', viewMode);
  }, [viewMode]);

  // Fetch all clients without search filter
  const { data: allClientes, isLoading, refetch } = useQuery({
    queryKey: ['/api/clientes', { tipo: clienteType }],
    queryFn: () => api.getClientes({
      tipo: clienteType
    }),
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 0,
    refetchOnWindowFocus: true, // Refetch on window focus for fresh data
    enabled: viewMode === 'clientes', // Only fetch when in clients mode
  });

  // Fetch pontos data when in pontos mode
  const { data: pontos, isLoading: isLoadingPontos } = useQuery({
    queryKey: ['/api/pontos'],
    staleTime: 5000,
    refetchOnWindowFocus: true,
    enabled: viewMode === 'pontos', // Only fetch when in pontos mode
  });

  // Fetch conversations to get profile pictures
  const { data: conversas, isLoading: isLoadingConversas } = useQuery({
    queryKey: ['/api/conversas'],
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });



  // Create a map of phone numbers to profile pictures from conversations
  const phoneToProfilePicture = React.useMemo(() => {
    const map = new Map<string, string>();
    if (conversas) {
      conversas.forEach((conversa: any) => {
        if (conversa.profilePicture) {
          // Salvar com e sem o código 55 para garantir compatibilidade
          map.set(conversa.telefone, conversa.profilePicture);
          
          // Se tem 55, salvar também sem
          if (conversa.telefone.startsWith('55')) {
            const semCodigo = conversa.telefone.substring(2);
            map.set(semCodigo, conversa.profilePicture);
          }
          // Se não tem 55, salvar também com
          else if (!conversa.telefone.startsWith('55')) {
            const comCodigo = '55' + conversa.telefone;
            map.set(comCodigo, conversa.profilePicture);
          }
        }
      });
    }
    return map;
  }, [conversas]);

  // Filter clients locally based on search term
  const clientes = allClientes?.filter(cliente => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      cliente.nome.toLowerCase().includes(searchLower) ||
      cliente.telefone.includes(searchTerm)
    );
  });
  
  // Filter pontos locally based on search term
  const filteredPontos = pontos?.filter((ponto: any) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      ponto.usuario?.toLowerCase().includes(searchLower) ||
      ponto.aplicativo?.toLowerCase().includes(searchLower) ||
      ponto.dispositivo?.toLowerCase().includes(searchLower) ||
      ponto.cliente?.nome?.toLowerCase().includes(searchLower)
    );
  });

  const handleOpenModal = (cliente?: Cliente) => {
    setSelectedCliente(cliente || null);
    setIsCreating(!cliente);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCliente(null);
    setIsCreating(false);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      ativo: 'bg-green-500/20 text-green-400',
      inativo: 'bg-red-500/20 text-red-400',
      suspenso: 'bg-yellow-500/20 text-yellow-400',
      cancelado: 'bg-gray-500/20 text-gray-400',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-500/20 text-gray-400';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      ativo: CheckCircle,
      inativo: XCircle,
      suspenso: AlertTriangle,
      cancelado: XCircle,
    };
    return icons[status as keyof typeof icons] || XCircle;
  };

  const getDaysUntilExpiry = (vencimento: string) => {
    // Criar data de vencimento no timezone de São Paulo
    const expiryDate = new Date(vencimento);
    
    // Obter a data atual em São Paulo
    const nowSaoPaulo = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const today = new Date(nowSaoPaulo);
    
    // Zerar as horas para comparar apenas as datas
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryColor = (days: number) => {
    if (days <= 0) return 'text-red-400';
    if (days <= 5) return 'text-yellow-400';
    return 'text-green-400';
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    
    // Remove country code if present
    let number = cleaned;
    if (cleaned.startsWith('55') && cleaned.length > 11) {
      number = cleaned.substring(2);
    }
    
    // Format as (xx) xxxxx-xxxx for 11 digits
    if (number.length === 11) {
      return `(${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
    }
    
    // Format as (xx) xxxx-xxxx for 10 digits
    if (number.length === 10) {
      return `(${number.slice(0, 2)}) ${number.slice(2, 6)}-${number.slice(6)}`;
    }
    
    return phone;
  };

  const handleViewClient = (clienteId: number) => {
    setLocation(`/clientes/${clienteId}`);
  };
  
  const handleEditPonto = (pontoId: number) => {
    // Implement ponto edit modal here
    console.log('Edit ponto:', pontoId);
  };

  if ((viewMode === 'clientes' && isLoading) || (viewMode === 'pontos' && isLoadingPontos)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="loading-spinner w-12 h-12" />
          <p className="text-slate-400 font-medium">
            Carregando {viewMode === 'clientes' ? 'clientes' : 'pontos'}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Users className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {viewMode === 'clientes' ? 'Gerenciar Clientes' : 'Gerenciar Pontos'}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {viewMode === 'clientes' 
                  ? (showCanceled 
                    ? `${clientes?.filter(c => c.status === 'cancelado').length || 0} clientes cancelados`
                    : `${clientes?.filter(c => c.status !== 'cancelado').length || 0} clientes ativos no sistema`)
                  : `${filteredPontos?.length || 0} pontos de acesso no sistema`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2 border border-slate-700">
              <Label 
                htmlFor="view-mode-switch" 
                className={`text-sm font-medium transition-colors ${
                  viewMode === 'clientes' ? 'text-blue-400' : 'text-slate-400'
                }`}
              >
                <Users className="w-4 h-4 inline-block mr-1" />
                Clientes
              </Label>
              <Switch
                id="view-mode-switch"
                checked={viewMode === 'pontos'}
                onCheckedChange={(checked) => setViewMode(checked ? 'pontos' : 'clientes')}
                className="data-[state=checked]:bg-purple-500"
              />
              <Label 
                htmlFor="view-mode-switch" 
                className={`text-sm font-medium transition-colors ${
                  viewMode === 'pontos' ? 'text-purple-400' : 'text-slate-400'
                }`}
              >
                <Activity className="w-4 h-4 inline-block mr-1" />
                Pontos
              </Label>
            </div>
            {viewMode === 'clientes' && (
              <Button 
                size="lg"
                onClick={() => handleOpenModal()}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-6 shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
              >
                <Plus className="w-5 h-5 mr-2" />
                Novo Cliente
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              placeholder={viewMode === 'clientes' ? "Buscar por nome ou telefone..." : "Buscar usuário, app ou dispositivo..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80 bg-slate-900 border-slate-700 text-white placeholder:text-slate-400 focus:bg-slate-800 focus:text-white focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
          
          {viewMode === 'clientes' && (
            <>
              <div className="flex bg-dark-bg border border-slate-700 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClienteType('regular')}
                  className={`
                    transition-all duration-200 font-medium rounded-l-md rounded-r-none
                    ${clienteType === 'regular' 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                      : 'text-slate-400'
                    }
                  `}
                >
                  Regulares
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClienteType('familia')}
                  className={`
                    transition-all duration-200 font-medium rounded-r-md rounded-l-none
                    ${clienteType === 'familia' 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                      : 'text-slate-400'
                    }
                  `}
                >
                  Família
                </Button>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCanceled(!showCanceled)}
                className={`
                  transition-all duration-200 font-medium border-slate-700
                  ${showCanceled 
                    ? 'bg-gray-500/20 text-gray-400 border-gray-600' 
                    : 'text-slate-400 hover:text-white'
                  }
                `}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {showCanceled ? 'Mostrando Cancelados' : 'Ver Cancelados'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Conditional Table Rendering */}
      {viewMode === 'clientes' ? (
        /* Clients Table */
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-500/20 rounded">
                        <Users className="w-4 h-4 text-blue-400" />
                      </div>
                      Nome
                    </div>
                  </th>
                  <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-green-500/20 rounded">
                        <Phone className="w-4 h-4 text-green-400" />
                      </div>
                      Contato
                    </div>
                  </th>
                  <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-yellow-500/20 rounded">
                        <DollarSign className="w-4 h-4 text-yellow-400" />
                      </div>
                      Valor Total
                    </div>
                  </th>
                  <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-orange-500/20 rounded">
                        <Calendar className="w-4 h-4 text-orange-400" />
                      </div>
                      Vencimento
                    </div>
                  </th>
                  <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-500/20 rounded">
                        <CheckCircle className="w-4 h-4 text-purple-400" />
                      </div>
                      Status
                    </div>
                  </th>
                  <th className="text-right py-4 px-6 text-slate-300 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes?.filter(cliente => {
                  const matchesSearch = cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                       cliente.telefone.includes(searchTerm);
                  const matchesStatus = showCanceled ? cliente.status === 'cancelado' : cliente.status !== 'cancelado';
                  return matchesSearch && matchesStatus;
                }).map((cliente) => {
                  const daysUntilExpiry = cliente.vencimento ? getDaysUntilExpiry(cliente.vencimento) : null;
                  
                  return (
                    <tr
                      key={cliente.id}
                      className="border-b border-slate-700/30 transition-colors"
                    >
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-3">
                          <Avatar 
                            className="w-12 h-12 shadow-md"
                            key={`${cliente.id}-${phoneToProfilePicture.get(cliente.telefone) || 'no-pic'}`}
                          >
                            {showPhotosClientes && phoneToProfilePicture.get(cliente.telefone) ? (
                              <AvatarImage 
                                src={phoneToProfilePicture.get(cliente.telefone)} 
                                alt={cliente.nome}
                                className="object-cover"
                                onError={(e) => {
                                  // Remove src to trigger fallback
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                              <span className="text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-lg font-bold">
                                {cliente.nome && cliente.nome.length > 0 ? cliente.nome.charAt(0).toUpperCase() : '?'}
                              </span>
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-semibold text-white text-lg">{cliente.nome}</span>
                            <p className="text-sm text-slate-400 capitalize">{cliente.tipo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-green-400" />
                          <span className="font-medium text-slate-300">
                            {formatPhoneNumber(cliente.telefone)}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className="font-bold text-lg text-transparent bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text">
                          R$ {cliente.valorTotal}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        {cliente.vencimento ? (
                          <div className="space-y-1">
                            <span className={`font-medium ${getExpiryColor(daysUntilExpiry || 0)}`}>
                              {new Date(cliente.vencimento).toLocaleDateString('pt-BR')}
                            </span>
                            {daysUntilExpiry !== null && (
                              <p className={`text-xs font-semibold ${daysUntilExpiry <= 0 ? 'text-red-400' : daysUntilExpiry <= 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                {daysUntilExpiry <= 0 ? '⚠️ Vencido' : `${daysUntilExpiry} dias restantes`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">Não definido</span>
                        )}
                      </td>
                      <td className="py-5 px-6">
                        <Badge className={`${getStatusBadge(cliente.status)} flex items-center gap-1 w-fit px-3 py-1 font-semibold border-0`}>
                          {React.createElement(getStatusIcon(cliente.status), { size: 16 })}
                          {cliente.status}
                        </Badge>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <Button
                          onClick={() => handleViewClient(cliente.id)}
                          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/30"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {!clientes?.length && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl mb-4">
                <Users className="w-12 h-12 text-slate-500" />
              </div>
              <p className="text-slate-400 text-lg font-medium">Nenhum cliente encontrado</p>
              <p className="text-slate-500 text-sm mt-2">Clique no botão "Novo Cliente" para adicionar o primeiro cliente</p>
            </div>
          )}
          </CardContent>
        </Card>
      ) : (
        /* Pontos Table */
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-500/20 rounded">
                          <Users className="w-4 h-4 text-purple-400" />
                        </div>
                        Cliente
                      </div>
                    </th>
                    <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/20 rounded">
                          <Activity className="w-4 h-4 text-blue-400" />
                        </div>
                        Usuário
                      </div>
                    </th>
                    <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-500/20 rounded">
                          <Monitor className="w-4 h-4 text-green-400" />
                        </div>
                        Aplicativo
                      </div>
                    </th>
                    <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-yellow-500/20 rounded">
                          <Monitor className="w-4 h-4 text-yellow-400" />
                        </div>
                        Dispositivo
                      </div>
                    </th>
                    <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-500/20 rounded">
                          <Calendar className="w-4 h-4 text-orange-400" />
                        </div>
                        Expiração
                      </div>
                    </th>
                    <th className="text-left py-4 px-6 text-slate-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-500/20 rounded">
                          <CheckCircle className="w-4 h-4 text-purple-400" />
                        </div>
                        Status
                      </div>
                    </th>
                    <th className="text-right py-4 px-6 text-slate-300 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPontos?.map((ponto: any) => {
                    const cliente = allClientes?.find(c => c.id === ponto.clienteId);
                    const daysUntilExpiry = ponto.expiracao ? getDaysUntilExpiry(ponto.expiracao) : null;
                    
                    return (
                      <tr
                        key={ponto.id}
                        className="border-b border-slate-700/30 transition-colors hover:bg-slate-800/20"
                      >
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-3">
                            <div>
                              <span className="font-semibold text-white">
                                {cliente?.nome || 'Sem Cliente'}
                              </span>
                              {cliente?.telefone && (
                                <p className="text-sm text-slate-400">
                                  {formatPhoneNumber(cliente.telefone)}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <span className="font-medium text-blue-400">
                            {ponto.usuario}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <span className="font-medium text-slate-300">
                            {ponto.aplicativo}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <span className="font-medium text-slate-300">
                            {ponto.dispositivo}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          {ponto.expiracao ? (
                            <div className="space-y-1">
                              <span className={`font-medium ${getExpiryColor(daysUntilExpiry || 0)}`}>
                                {new Date(ponto.expiracao).toLocaleDateString('pt-BR')}
                              </span>
                              {daysUntilExpiry !== null && (
                                <p className={`text-xs font-semibold ${daysUntilExpiry <= 0 ? 'text-red-400' : daysUntilExpiry <= 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                  {daysUntilExpiry <= 0 ? '⚠️ Vencido' : `${daysUntilExpiry} dias restantes`}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">Não definido</span>
                          )}
                        </td>
                        <td className="py-5 px-6">
                          <Badge className={`${getStatusBadge(ponto.status)} flex items-center gap-1 w-fit px-3 py-1 font-semibold border-0`}>
                            {React.createElement(getStatusIcon(ponto.status), { size: 16 })}
                            {ponto.status}
                          </Badge>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPonto(ponto.id)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {!filteredPontos?.length && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl mb-4">
                  <Activity className="w-12 h-12 text-slate-500" />
                </div>
                <p className="text-slate-400 text-lg font-medium">Nenhum ponto encontrado</p>
                <p className="text-slate-500 text-sm mt-2">Os pontos de acesso aparecerão aqui</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Client Modal */}
      <ClientModal
        cliente={selectedCliente}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
