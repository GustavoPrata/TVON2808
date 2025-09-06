import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { format, addYears } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ClientModal } from '@/components/modals/client-modal';
import { Plus, Search, Eye, Filter, Users, Phone, DollarSign, Calendar, CheckCircle, XCircle, AlertTriangle, Activity, Monitor, KeyRound, Wifi, Lock, Settings, Package, FileText, Edit, Copy, Save, X, Shuffle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Cliente } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useSettings } from '@/contexts/settings-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function Clientes() {
  const [, setLocation] = useLocation();
  const { showPhotosClientes } = useSettings();
  const { toast } = useToast();
  
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
  const [pontosType, setPontosType] = useState<'regular' | 'familia'>(() => 
    (localStorage.getItem('pontos-type') as 'regular' | 'familia') || 'regular'
  );
  const [showCanceled, setShowCanceled] = useState(() => 
    localStorage.getItem('clientes-show-canceled') === 'true'
  );
  const [selectedSistema, setSelectedSistema] = useState<string>(() => 
    localStorage.getItem('pontos-sistema-filter') || 'all'
  );
  const [selectedApp, setSelectedApp] = useState<string>(() => 
    localStorage.getItem('pontos-app-filter') || 'all'
  );
  
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // States for inline editing
  const [editingPonto, setEditingPonto] = useState<number | null>(null);
  const [editedPonto, setEditedPonto] = useState<any>({});
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionProgress, setDistributionProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);
  
  // State for distribution modal
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [distributionData, setDistributionData] = useState<{ [key: number]: string }>({});
  const [distributionMode, setDistributionMode] = useState<'individual' | 'all' | 'equal'>('individual');
  const [selectedDistributionSistema, setSelectedDistributionSistema] = useState<string>('');
  
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
  
  useEffect(() => {
    localStorage.setItem('pontos-sistema-filter', selectedSistema);
  }, [selectedSistema]);
  
  useEffect(() => {
    localStorage.setItem('pontos-app-filter', selectedApp);
  }, [selectedApp]);

  // Fetch all clients without search filter - needed for both modes
  const { data: allClientes, isLoading, refetch } = useQuery({
    queryKey: ['/api/clientes', { tipo: clienteType }],
    queryFn: () => api.getClientes({
      tipo: clienteType
    }),
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 0,
    refetchOnWindowFocus: true, // Refetch on window focus for fresh data
    // Always fetch clients - needed for pontos view too
  });

  // Fetch pontos data when in pontos mode
  const { data: pontos, isLoading: isLoadingPontos } = useQuery<any[]>({
    queryKey: ['/api/pontos'],
    staleTime: 5000,
    refetchOnWindowFocus: true,
    enabled: viewMode === 'pontos', // Only fetch when in pontos mode
  });

  // Fetch sistemas data - needed for pontos filters and distribution
  const { data: sistemasData } = useQuery<any[]>({
    queryKey: ['/api/external-api/systems'],
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
  
  // Transform sistemas data to the format we need
  // Get local sistemas from the database to get the correct id mapping
  const { data: localSistemas = [] } = useQuery<any[]>({
    queryKey: ['/api/sistemas'],
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
  
  const sistemas = localSistemas || [];

  // Fetch conversations to get profile pictures
  const { data: conversas, isLoading: isLoadingConversas } = useQuery<any[]>({
    queryKey: ['/api/conversas'],
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  // Update ponto mutation for inline editing
  const updatePontoMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...updateData } = data;
      return apiRequest('PUT', `/api/pontos/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pontos'] });
      toast({
        title: 'Sucesso',
        description: 'Ponto atualizado com sucesso!',
      });
      setEditingPonto(null);
      setEditedPonto({});
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar ponto',
        variant: 'destructive',
      });
    },
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

  // Create a map of sistema IDs to systemIds
  const sistemasMap = useMemo(() => {
    const map = new Map();
    sistemas?.forEach((sistema: any) => {
      map.set(sistema.id, sistema.systemId);
    });
    return map;
  }, [sistemas]);

  // Filter clients locally based on search term and sort alphabetically
  const clientes = allClientes?.filter(cliente => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      cliente.nome.toLowerCase().includes(searchLower) ||
      cliente.telefone.includes(searchTerm)
    );
  })?.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  
  // Filter pontos locally based on search term and filters, then sort alphabetically by client name
  const filteredPontos = pontos?.filter((ponto: any) => {
    // Get cliente from backend or find by ID
    const cliente = ponto.cliente || allClientes?.find((c: any) => c.id === ponto.clienteId);
    
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      ponto.usuario?.toLowerCase().includes(searchLower) ||
      ponto.aplicativo?.toLowerCase().includes(searchLower) ||
      ponto.dispositivo?.toLowerCase().includes(searchLower) ||
      cliente?.nome?.toLowerCase().includes(searchLower)
    );
    
    // Sistema filter - compare internal IDs directly
    const matchesSistema = selectedSistema === 'all' || String(ponto.sistemaId) === selectedSistema;
    
    // App filter
    const matchesApp = selectedApp === 'all' || 
      (selectedApp === 'ibopro' && (ponto.aplicativo?.toLowerCase() === 'ibopro' || ponto.aplicativo?.toLowerCase() === 'ibo_pro')) ||
      (selectedApp === 'iboplayer' && (ponto.aplicativo?.toLowerCase() === 'iboplayer' || ponto.aplicativo?.toLowerCase() === 'ibo_player')) ||
      (selectedApp === 'shamel' && ponto.aplicativo?.toLowerCase() === 'shamel');
    
    // Client type filter - only apply if cliente exists
    const matchesType = !cliente ? true : cliente.tipo === pontosType;
    
    return matchesSearch && matchesSistema && matchesApp && matchesType;
  })?.sort((a: any, b: any) => {
    const clienteA = a.cliente || allClientes?.find((c: any) => c.id === a.clienteId);
    const clienteB = b.cliente || allClientes?.find((c: any) => c.id === b.clienteId);
    const nomeA = clienteA?.nome || '';
    const nomeB = clienteB?.nome || '';
    return nomeA.localeCompare(nomeB, 'pt-BR');
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
          
          {viewMode === 'pontos' && (
            <>
              <div className="flex bg-dark-bg border border-slate-700 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPontosType('regular');
                    localStorage.setItem('pontos-type', 'regular');
                  }}
                  className={`
                    transition-all duration-200 font-medium rounded-l-md rounded-r-none
                    ${pontosType === 'regular' 
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
                  onClick={() => {
                    setPontosType('familia');
                    localStorage.setItem('pontos-type', 'familia');
                  }}
                  className={`
                    transition-all duration-200 font-medium rounded-r-md rounded-l-none
                    ${pontosType === 'familia' 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                      : 'text-slate-400'
                    }
                  `}
                >
                  Família
                </Button>
              </div>
              
              <Select
                value={selectedSistema}
                onValueChange={setSelectedSistema}
              >
                <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Sistema" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all" className="text-white hover:bg-slate-800">
                    Todos os Sistemas ({pontos?.length || 0} pontos)
                  </SelectItem>
                  {sistemas.map((sistema: any) => {
                    const pontosInSistema = pontos?.filter((p: any) => p.sistemaId === sistema.id).length || 0;
                    return (
                      <SelectItem 
                        key={sistema.id} 
                        value={String(sistema.id)}
                        className="text-white hover:bg-slate-800"
                      >
                        Sistema {sistema.systemId} ({pontosInSistema} pontos)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              <Select
                value={selectedApp}
                onValueChange={setSelectedApp}
              >
                <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Aplicativo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all" className="text-white hover:bg-slate-800">
                    Todos os Apps
                  </SelectItem>
                  <SelectItem value="ibopro" className="text-white hover:bg-slate-800">
                    Ibo Pro
                  </SelectItem>
                  <SelectItem value="iboplayer" className="text-white hover:bg-slate-800">
                    Ibo Player
                  </SelectItem>
                  <SelectItem value="shamel" className="text-white hover:bg-slate-800">
                    Shamel
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                onClick={() => {
                  // Initialize distribution data with current sistema assignments
                  const initialData: { [key: number]: string } = {};
                  // Use ALL pontos, not filtered ones
                  pontos?.forEach((ponto: any) => {
                    initialData[ponto.id] = String(ponto.sistemaId || '13');
                  });
                  setDistributionData(initialData);
                  // Set the first system as default for "all" mode
                  if (sistemas && sistemas.length > 0) {
                    setSelectedDistributionSistema(String(sistemas[0].id));
                  }
                  setIsDistributionModalOpen(true);
                }}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold px-4 shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Distribuir
              </Button>
            </>
          )}
          
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
                            className="w-12 h-12 shadow-md cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                            key={`${cliente.id}-${phoneToProfilePicture.get(cliente.telefone) || 'no-pic'}`}
                            onClick={() => handleViewClient(cliente.id)}
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
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-semibold">
                              {cliente.nome.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div 
                            className="cursor-pointer hover:text-blue-400 transition-colors"
                            onClick={() => handleViewClient(cliente.id)}
                          >
                            <p className="font-medium text-white text-base">{cliente.nome}</p>
                            {cliente.email && (
                              <p className="text-xs text-slate-400">{cliente.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <p className="font-medium text-slate-300">{formatPhoneNumber(cliente.telefone)}</p>
                      </td>
                      <td className="py-5 px-6">
                        <p className="font-bold text-green-400 text-lg">
                          R$ {typeof cliente.valorTotal === 'number' 
                            ? cliente.valorTotal.toFixed(2) 
                            : parseFloat(cliente.valorTotal || '0').toFixed(2)}
                        </p>
                        {clienteType === 'familia' && cliente.pontosAtivos && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {cliente.pontosAtivos} {cliente.pontosAtivos === 1 ? 'ponto' : 'pontos'}
                          </p>
                        )}
                      </td>
                      <td className="py-5 px-6">
                        <div>
                          <p className="font-medium text-slate-300">
                            {cliente.vencimento 
                              ? new Date(cliente.vencimento).toLocaleDateString('pt-BR')
                              : '-'
                            }
                          </p>
                          {daysUntilExpiry !== null && (
                            <p className={`text-xs font-medium mt-0.5 ${getExpiryColor(daysUntilExpiry)}`}>
                              {daysUntilExpiry === 0 
                                ? 'Vence hoje' 
                                : daysUntilExpiry < 0
                                  ? `Vencido há ${Math.abs(daysUntilExpiry)} dias`
                                  : `Faltam ${daysUntilExpiry} dias`
                              }
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <Badge className={`${getStatusBadge(cliente.status)} flex items-center gap-1 w-fit px-3 py-1 font-semibold border-0`}>
                          {React.createElement(getStatusIcon(cliente.status), { size: 16 })}
                          {cliente.status}
                        </Badge>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex justify-end">
                          <Button
                            size="icon"
                            onClick={() => handleViewClient(cliente.id)}
                            className="h-8 w-8 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/30"
                            data-testid={`button-view-cliente-${cliente.id}`}
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
            {(!clientes || clientes.filter(cliente => {
              const matchesSearch = cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                   cliente.telefone.includes(searchTerm);
              const matchesStatus = showCanceled ? cliente.status === 'cancelado' : cliente.status !== 'cancelado';
              return matchesSearch && matchesStatus;
            }).length === 0) && (
              <div className="py-16 px-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl mb-4">
                    <Users className="w-12 h-12 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-lg font-medium">
                    {searchTerm 
                      ? 'Nenhum cliente encontrado com esses critérios' 
                      : 'Nenhum cliente cadastrado ainda'
                    }
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    {searchTerm 
                      ? 'Tente ajustar os filtros de busca' 
                      : 'Clique no botão acima para adicionar o primeiro cliente'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
          </CardContent>
        </Card>
      ) : (
        /* Pontos Table */
        <div className="grid gap-6">
          {filteredPontos?.map((ponto: any) => {
            const cliente = ponto.cliente || allClientes?.find((c: any) => c.id === ponto.clienteId);
            
            return (
              <Card key={ponto.id} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
                          {React.createElement(Monitor, { size: 32, className: 'text-white' })}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{cliente?.nome || ponto.usuario || 'Ponto sem cliente'}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">ID do Ponto: #{ponto.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${cliente?.tipo === 'familia' 
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30'} 
                          flex items-center gap-1 w-fit px-3 py-1 font-semibold border`}>
                          {cliente?.tipo === 'familia' ? 'Família' : 'Regular'}
                        </Badge>
                        <Badge className={`${getStatusBadge(ponto.status)} flex items-center gap-1 w-fit px-3 py-1 font-semibold border-0`}>
                          {React.createElement(getStatusIcon(ponto.status), { size: 16 })}
                          {ponto.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Último acesso</p>
                        <p className="text-sm text-slate-400 font-medium">
                          {ponto.ultimoAcesso ? new Date(ponto.ultimoAcesso).toLocaleString('pt-BR') : 'Sem acesso'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setLocation(`/clientes/${ponto.clienteId}`)}
                          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/30"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {editingPonto === ponto.id && (
                          <Button
                            onClick={() => {
                              setEditingPonto(null);
                              setEditedPonto({});
                            }}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 rounded-lg font-medium"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            if (editingPonto === ponto.id) {
                              // Save changes (ensure valor is sent as string)
                              updatePontoMutation.mutate({ 
                                id: ponto.id, 
                                ...editedPonto,
                                valor: String(editedPonto.valor || '0')
                              });
                            } else {
                              // Start editing
                              setEditingPonto(ponto.id);
                              setEditedPonto({
                                usuario: ponto.usuario,
                                senha: ponto.senha || 'tvon1@',
                                valor: ponto.valor || '0.00',
                                macAddress: ponto.macAddress || '',
                                deviceKey: ponto.deviceKey || '',
                                expiracao: ponto.expiracao ? format(new Date(ponto.expiracao), 'yyyy-MM-dd') : '',
                                dispositivo: ponto.dispositivo,
                                status: ponto.status,
                                aplicativo: ponto.aplicativo,
                                observacoes: ponto.observacoes || '',
                                sistemaId: ponto.sistemaId
                              });
                            }
                          }}
                          className={`px-3 py-2 rounded-lg font-medium ${
                            editingPonto === ponto.id 
                              ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400' 
                              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                          }`}
                        >
                          {editingPonto === ponto.id ? (
                            <Save className="w-4 h-4" />
                          ) : (
                            <Edit className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs text-slate-400">Usuário</span>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Input
                          value={editedPonto.usuario}
                          onChange={(e) => setEditedPonto({ ...editedPonto, usuario: e.target.value })}
                          className="h-7 bg-slate-700/50 border-slate-600 font-mono text-white text-sm"
                        />
                      ) : (
                        <p className="font-semibold text-sm text-white truncate">{ponto.usuario}</p>
                      )}
                    </div>

                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs text-slate-400">Senha</span>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Input
                          value={editedPonto.senha}
                          onChange={(e) => setEditedPonto({ ...editedPonto, senha: e.target.value })}
                          className="h-7 bg-slate-700/50 border-slate-600 font-mono text-white text-sm"
                        />
                      ) : (
                        <p className="font-semibold text-sm text-white truncate">{ponto.senha || 'tvon1@'}</p>
                      )}
                    </div>

                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Settings className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs text-slate-400">Sistema</span>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Select
                          value={editedPonto.sistemaId?.toString() || ''}
                          onValueChange={(value) => setEditedPonto({ ...editedPonto, sistemaId: parseInt(value) })}
                        >
                          <SelectTrigger className="h-7 bg-slate-700/50 border-slate-600 text-white text-sm">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {sistemas.map((sistema: any) => (
                              <SelectItem 
                                key={sistema.id} 
                                value={sistema.id.toString()}
                              >
                                Sistema {sistema.systemId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-semibold text-sm text-white truncate">
                          {ponto.sistemaId && sistemasMap.get(ponto.sistemaId) ? 
                           `Sistema ${sistemasMap.get(ponto.sistemaId)}` : 
                           'Sem Sistema'}
                        </p>
                      )}
                    </div>

                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Package className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs text-slate-400">Aplicativo</span>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Select
                          value={editedPonto.aplicativo}
                          onValueChange={(value) => setEditedPonto({ ...editedPonto, aplicativo: value })}
                        >
                          <SelectTrigger className="h-7 bg-slate-700/50 border-slate-600 text-white text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ibo_pro">IBO Pro</SelectItem>
                            <SelectItem value="ibo_player">IBO Player</SelectItem>
                            <SelectItem value="shamel">Shamel</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-semibold text-sm text-white truncate">
                          {ponto.aplicativo?.toLowerCase() === 'ibo_player' || ponto.aplicativo?.toLowerCase() === 'iboplayer' ? 'Ibo Player' : 
                           ponto.aplicativo?.toLowerCase() === 'ibo_pro' || ponto.aplicativo?.toLowerCase() === 'ibopro' ? 'Ibo Pro' : 
                           ponto.aplicativo?.toLowerCase() === 'shamel' ? 'Shamel' : 
                           ponto.aplicativo?.toLowerCase() === 'smartone' || ponto.aplicativo?.toLowerCase() === 'smart_one' ? 'Smart One' : 
                           ponto.aplicativo}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-xs text-slate-400">MAC Address</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(ponto.macAddress || 'fb:5a:b2:fc:d4:84')}
                          className="ml-auto p-0 h-4 w-4"
                        >
                          <Copy className="w-2.5 h-2.5 text-slate-400" />
                        </Button>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Input
                          value={editedPonto.macAddress}
                          onChange={(e) => setEditedPonto({ ...editedPonto, macAddress: e.target.value })}
                          className="h-7 bg-slate-700/50 border-slate-600 font-mono text-white text-xs"
                          placeholder="00:00:00:00:00:00"
                        />
                      ) : (
                        <p className="font-mono text-xs text-white truncate">{ponto.macAddress || 'fb:5a:b2:fc:d4:84'}</p>
                      )}
                    </div>

                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Lock className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs text-slate-400">Device Key</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(ponto.deviceKey || '760469')}
                          className="ml-auto p-0 h-4 w-4"
                        >
                          <Copy className="w-2.5 h-2.5 text-slate-400" />
                        </Button>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Input
                          value={editedPonto.deviceKey}
                          onChange={(e) => setEditedPonto({ ...editedPonto, deviceKey: e.target.value })}
                          className="h-7 bg-slate-700/50 border-slate-600 font-mono text-white text-xs"
                        />
                      ) : (
                        <p className="font-mono text-xs text-white truncate">{ponto.deviceKey || '760469'}</p>
                      )}
                    </div>

                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-xs text-slate-400">Expira em</span>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Input
                          type="date"
                          value={editedPonto.expiracao}
                          onChange={(e) => setEditedPonto({ ...editedPonto, expiracao: e.target.value })}
                          className="h-7 bg-slate-700/50 border-slate-600 text-white text-xs"
                        />
                      ) : (
                        <p className="font-semibold text-sm text-white truncate">
                          {ponto.expiracao ? new Date(ponto.expiracao).toLocaleDateString('pt-BR') : 'Não definido'}
                        </p>
                      )}
                    </div>

                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs text-slate-400">Dispositivo</span>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Select
                          value={editedPonto.dispositivo}
                          onValueChange={(value) => setEditedPonto({ ...editedPonto, dispositivo: value })}
                        >
                          <SelectTrigger className="h-7 bg-slate-700/50 border-slate-600 text-white text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="smart_tv">Smart TV</SelectItem>
                            <SelectItem value="tv_box">TV Box</SelectItem>
                            <SelectItem value="celular">Celular</SelectItem>
                            <SelectItem value="notebook">Notebook</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-semibold text-sm text-white capitalize">
                          {ponto.dispositivo?.replace('_', ' ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Additional fields row */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <DollarSign className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs text-slate-400">Valor</span>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editedPonto.valor}
                          onChange={(e) => setEditedPonto({ ...editedPonto, valor: e.target.value })}
                          className="h-7 bg-slate-700/50 border-slate-600 text-green-400 text-sm font-semibold"
                        />
                      ) : (
                        <p className="font-semibold text-sm text-green-400 truncate">
                          R$ {parseFloat(ponto.valor || '0').toFixed(2)}
                        </p>
                      )}
                    </div>

                    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        {ponto.status === 'ativo' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className="text-xs text-slate-400">Status</span>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Select
                          value={editedPonto.status}
                          onValueChange={(value) => setEditedPonto({ ...editedPonto, status: value })}
                        >
                          <SelectTrigger className="h-7 bg-slate-700/50 border-slate-600 text-white text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className={`font-semibold text-sm ${ponto.status === 'ativo' ? 'text-green-400' : 'text-red-400'}`}>
                          {ponto.status.toUpperCase()}
                        </p>
                      )}
                    </div>
                  </div>

                  {(ponto.observacoes || editingPonto === ponto.id) && (
                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-slate-400">Observação</span>
                      </div>
                      {editingPonto === ponto.id ? (
                        <Textarea
                          value={editedPonto.observacoes}
                          onChange={(e) => setEditedPonto({ ...editedPonto, observacoes: e.target.value })}
                          className="bg-slate-700/50 border-slate-600 text-white text-sm min-h-[60px]"
                          placeholder="Adicionar observação..."
                        />
                      ) : (
                        <p className="text-sm text-white">{ponto.observacoes}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          
          {!filteredPontos?.length && (
            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm">
              <CardContent className="p-16">
                <div className="flex flex-col items-center justify-center">
                  <div className="p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl mb-4">
                    <Activity className="w-12 h-12 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-lg font-medium">Nenhum ponto encontrado</p>
                  <p className="text-slate-500 text-sm mt-2">Os pontos de acesso aparecerão aqui</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Client Modal */}
      <ClientModal
        cliente={selectedCliente || undefined}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      {/* Distribution Modal */}
      <Dialog open={isDistributionModalOpen} onOpenChange={setIsDistributionModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-950 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Distribuir Pontos entre Sistemas
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure como deseja distribuir os pontos entre os sistemas disponíveis
            </DialogDescription>
          </DialogHeader>

          {/* Distribution Progress Overlay */}
          {isDistributing && distributionProgress && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <div className="bg-slate-900 border border-purple-500/50 rounded-xl p-8 shadow-2xl max-w-md w-full mx-4">
                <div className="flex flex-col items-center space-y-6">
                  {/* Animated Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                    <Loader2 className="w-16 h-16 text-purple-500 animate-spin relative z-10" />
                  </div>
                  
                  {/* Progress Text */}
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-white">
                      {distributionProgress.message}
                    </h3>
                    <p className="text-sm text-slate-400">
                      Processando {distributionProgress.current} de {distributionProgress.total} pontos
                    </p>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${(distributionProgress.current / distributionProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                  
                  <p className="text-xs text-slate-500 animate-pulse">
                    Por favor, aguarde. Não feche esta janela.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6 py-4">
            {/* Distribution Mode Selection */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-slate-300">Modo de Distribuição</Label>
              <RadioGroup
                value={distributionMode}
                onValueChange={(value) => setDistributionMode(value as 'individual' | 'all' | 'equal')}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-purple-500 transition-colors">
                  <RadioGroupItem value="individual" id="individual" className="text-purple-500" />
                  <Label htmlFor="individual" className="cursor-pointer flex-1">
                    <div className="font-medium text-white">Individual</div>
                    <div className="text-xs text-slate-400">Configure cada ponto manualmente</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-purple-500 transition-colors">
                  <RadioGroupItem value="all" id="all" className="text-purple-500" />
                  <Label htmlFor="all" className="cursor-pointer flex-1">
                    <div className="font-medium text-white">Todos para Um Sistema</div>
                    <div className="text-xs text-slate-400">Mover todos os pontos para um único sistema</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-purple-500 transition-colors">
                  <RadioGroupItem value="equal" id="equal" className="text-purple-500" />
                  <Label htmlFor="equal" className="cursor-pointer flex-1">
                    <div className="font-medium text-white">Distribuição Igual</div>
                    <div className="text-xs text-slate-400">Dividir igualmente entre todos os sistemas</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* System Selection for 'all' mode */}
            {distributionMode === 'all' && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-300">Selecione o Sistema de Destino</Label>
                <Select
                  value={selectedDistributionSistema}
                  onValueChange={setSelectedDistributionSistema}
                >
                  <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Escolha um sistema" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {sistemas.map((sistema: any) => (
                      <SelectItem 
                        key={sistema.id} 
                        value={String(sistema.id)}
                        className="text-white hover:bg-slate-800"
                      >
                        Sistema {sistema.systemId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Points List with Individual System Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold text-slate-300">Todos os Pontos</Label>
                <span className="text-xs text-slate-400">
                  {pontos?.length || 0} pontos no total
                </span>
              </div>
              
              <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                {pontos?.sort((a: any, b: any) => {
                  const clienteA = a.cliente || allClientes?.find((c: any) => c.id === a.clienteId);
                  const clienteB = b.cliente || allClientes?.find((c: any) => c.id === b.clienteId);
                  const nomeA = clienteA?.nome || '';
                  const nomeB = clienteB?.nome || '';
                  return nomeA.localeCompare(nomeB, 'pt-BR');
                })?.map((ponto: any) => {
                  const cliente = ponto.cliente || allClientes?.find((c: any) => c.id === ponto.clienteId);
                  const sistemaAtual = sistemas?.find((s: any) => s.id === ponto.sistemaId);
                  return (
                    <div 
                      key={ponto.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                          <Monitor className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white truncate">
                            {cliente?.nome || 'Sem cliente'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {ponto.usuario} • {ponto.aplicativo}
                          </p>
                          <p className="text-xs text-green-400 font-medium">
                            Sistema Atual: {sistemaAtual?.systemId || 'Sem sistema'}
                          </p>
                        </div>
                      </div>
                      
                      {distributionMode === 'individual' && (
                        <Select
                          value={distributionData[ponto.id] || ponto.sistemaId || '1'}
                          onValueChange={(value) => {
                            setDistributionData({
                              ...distributionData,
                              [ponto.id]: value
                            });
                          }}
                          disabled={distributionMode !== 'individual'}
                        >
                          <SelectTrigger className="w-32 bg-slate-700 border-slate-600 text-white text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {sistemas.map((sistema: any) => (
                              <SelectItem 
                                key={sistema.id} 
                                value={String(sistema.id)}
                                className="text-white hover:bg-slate-800 text-sm"
                              >
                                Sistema {sistema.systemId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {distributionMode === 'all' && (
                        <div className="px-3 py-1.5 bg-purple-500/20 rounded-lg">
                          <span className="text-xs font-medium text-purple-400">
                            → Sistema {sistemas?.find((s: any) => String(s.id) === selectedDistributionSistema)?.systemId || 'Nenhum'}
                          </span>
                        </div>
                      )}
                      
                      {distributionMode === 'equal' && (
                        <div className="px-3 py-1.5 bg-blue-500/20 rounded-lg">
                          <span className="text-xs font-medium text-blue-400">
                            Auto
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            {distributionMode === 'equal' && sistemas.length > 0 && (
              <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-white">Resumo da Distribuição</span>
                </div>
                <p className="text-xs text-slate-400">
                  {pontos?.length || 0} pontos serão distribuídos igualmente entre {sistemas.length} sistemas.
                  Cada sistema receberá aproximadamente {Math.ceil((pontos?.length || 0) / sistemas.length)} pontos.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDistributionModalOpen(false)}
              className="border-slate-700 text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                // Prepare the updates based on distribution mode
                let updates: { id: number; sistemaId: number }[] = [];
                
                if (distributionMode === 'individual') {
                  // Use the manual selections
                  updates = Object.entries(distributionData).map(([id, sistemaId]) => ({
                    id: parseInt(id),
                    sistemaId: parseInt(sistemaId)
                  }));
                } else if (distributionMode === 'all') {
                  // Move all to selected system
                  // Validate that a system is selected
                  if (!selectedDistributionSistema || selectedDistributionSistema === '') {
                    toast({
                      title: "Erro",
                      description: "Por favor, selecione um sistema de destino.",
                      variant: "destructive",
                    });
                    return;
                  }
                  updates = pontos?.map((ponto: any) => ({
                    id: ponto.id,
                    sistemaId: parseInt(selectedDistributionSistema)
                  })) || [];
                } else if (distributionMode === 'equal') {
                  // Distribute equally
                  const sistemaIds = sistemas.map((s: any) => s.id);
                  updates = pontos?.map((ponto: any, index: number) => ({
                    id: ponto.id,
                    sistemaId: sistemaIds[index % sistemaIds.length]
                  })) || [];
                }
                
                // Start distribution process
                setIsDistributing(true);
                setDistributionProgress({
                  current: 0,
                  total: updates.length,
                  message: 'Iniciando distribuição...'
                });
                
                // Send updates to backend with timeout
                try {
                  // Update progress before sending
                  setDistributionProgress({
                    current: Math.floor(updates.length * 0.3),
                    total: updates.length,
                    message: 'Enviando para servidor...'
                  });
                  
                  // Create a promise that rejects after timeout
                  const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('A operação está demorando mais que o esperado')), 30000); // 30 seconds timeout
                  });
                  
                  // Race between the API call and timeout
                  const response = await Promise.race([
                    apiRequest('PUT', '/api/pontos/bulk-update', { updates }),
                    timeoutPromise
                  ]);
                  
                  // Update progress after server response
                  setDistributionProgress({
                    current: updates.length,
                    total: updates.length,
                    message: 'Atualizando interface...'
                  });
                  
                  // Wait a bit before refreshing
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Invalidate queries to refresh data
                  await queryClient.invalidateQueries({ queryKey: ['/api/pontos'] });
                  await queryClient.invalidateQueries({ queryKey: ['/api/sistemas'] });
                  
                  // Success notification
                  const successCount = (response as any)?.updated || updates.length;
                  const errorCount = (response as any)?.errors || 0;
                  
                  if (errorCount > 0) {
                    toast({
                      title: "⚠️ Distribuição Parcial",
                      description: `${successCount} pontos atualizados. ${errorCount} pontos com erro.`,
                      className: "bg-yellow-900/90 border-yellow-600 text-white",
                    });
                  } else {
                    toast({
                      title: "✅ Distribuição Concluída!",
                      description: `${successCount} pontos foram distribuídos com sucesso.`,
                      className: "bg-green-900/90 border-green-600 text-white",
                    });
                  }
                  
                  // Always close modal and reset states
                  setTimeout(() => {
                    setIsDistributing(false);
                    setDistributionProgress(null);
                    setIsDistributionModalOpen(false);
                    setDistributionData({});
                    setSelectedDistributionSistema('');
                  }, 500);
                  
                } catch (error: any) {
                  console.error('Distribution error:', error);
                  
                  // Always reset states on error
                  setIsDistributing(false);
                  setDistributionProgress(null);
                  setIsDistributionModalOpen(false);
                  
                  const isTimeout = error.message?.includes('demorando');
                  
                  if (isTimeout) {
                    toast({
                      title: "⏱️ Tempo Esgotado",
                      description: "A distribuição está demorando muito. Verifique os pontos e tente novamente se necessário.",
                      className: "bg-orange-900/90 border-orange-600 text-white",
                    });
                    // Still refresh the data as some points might have been updated
                    queryClient.invalidateQueries({ queryKey: ['/api/pontos'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/sistemas'] });
                  } else {
                    toast({
                      title: "❌ Erro na Distribuição",
                      description: error.response?.data?.error || error.message || "Não foi possível atualizar os pontos.",
                      variant: "destructive",
                    });
                  }
                  
                  // Reset distribution data
                  setDistributionData({});
                  setSelectedDistributionSistema('');
                }
              }}
              disabled={isDistributing}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDistributing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Distribuindo...
                </>
              ) : (
                <>
                  <Shuffle className="w-4 h-4 mr-2" />
                  Aplicar Distribuição
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}