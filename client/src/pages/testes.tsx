import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, Plus, Clock, Copy, ExternalLink, Trash2, 
  Monitor, Smartphone, Tv, Laptop, RefreshCw, Filter, MessageCircle, ChevronDown 
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { CreateTestDialog } from '@/components/modals/create-test-dialog';
import { TestDetailsDialog } from '@/components/modals/test-details-dialog';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

interface Teste {
  id: number;
  telefone: string;
  aplicativo: string;
  dispositivo: string;
  usuario: string;
  senha: string;
  macAddress?: string;
  deviceKey?: string;
  duracaoHoras: number;
  criadoEm: string;
  expiraEm: string;
  status: string;
  apiUserId?: number;
  sistemaId?: number;
  apiUsername: string;
  apiPassword: string;
}

export default function Testes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ativo' | 'expirado' | 'deletado'>('ativo');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [selectedSistemaId, setSelectedSistemaId] = useState<number | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<Teste | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: testes, isLoading } = useQuery<Teste[]>({
    queryKey: ['/api/testes', filterStatus],
    queryFn: async () => {
      const response = await fetch(`/api/testes?status=${filterStatus}`);
      if (!response.ok) throw new Error('Failed to fetch tests');
      return response.json();
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: sistemas } = useQuery({
    queryKey: ['/api/sistemas'],
    queryFn: async () => {
      const response = await fetch('/api/sistemas');
      if (!response.ok) throw new Error('Failed to fetch sistemas');
      return response.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Set default sistema when sistemas are loaded and restore from localStorage
  useEffect(() => {
    if (sistemas && sistemas.length > 0) {
      const savedSistemaId = localStorage.getItem('selectedSistemaId');
      if (savedSistemaId && sistemas.find((s: any) => s.id === parseInt(savedSistemaId))) {
        setSelectedSistemaId(parseInt(savedSistemaId));
      } else if (!selectedSistemaId) {
        setSelectedSistemaId(sistemas[0].id);
      }
    }
  }, [sistemas]);

  // Save selected sistema to localStorage whenever it changes
  useEffect(() => {
    if (selectedSistemaId) {
      localStorage.setItem('selectedSistemaId', selectedSistemaId.toString());
    }
  }, [selectedSistemaId]);



  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/testes/cleanup', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to cleanup tests');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/testes'] });
      toast({
        title: 'Limpeza concluída',
        description: data.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (testeId: number) => {
      const response = await fetch(`/api/testes/${testeId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete test');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/testes'] });
      toast({
        title: 'Teste deletado',
        description: 'O teste foi movido para a categoria deletados.',
      });
    },
  });

  const getDeviceIcon = (dispositivo: string) => {
    switch (dispositivo) {
      case 'smart_tv':
      case 'tv_box':
        return <Tv className="w-4 h-4" />;
      case 'celular':
        return <Smartphone className="w-4 h-4" />;
      case 'notebook':
        return <Laptop className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${type} copiado`,
        description: `${type} foi copiado para a área de transferência`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o texto',
        variant: 'destructive',
      });
    }
  };

  const getM3ULink = async (id: number) => {
    try {
      const response = await fetch(`/api/testes/m3u/${id}`);
      if (!response.ok) throw new Error('Failed to get M3U link');
      const data = await response.json();
      return data.m3uLink;
    } catch (error) {
      toast({
        title: 'Erro ao gerar link',
        description: 'Não foi possível gerar o link M3U',
        variant: 'destructive',
      });
    }
  };

  const getStreamingUrl = (aplicativo: string) => {
    switch (aplicativo) {
      case 'ibo_pro':
        return 'https://iboproapp.com/manage-playlists/list/';
      case 'ibo_player':
        return 'https://iboplayer.com/dashboard';
      case 'shamel':
        return 'https://shamel.tv';
      default:
        return '#';
    }
  };

  const generateM3ULink = (usuario: string, senha: string) => {
    return `http://tvonbr.fun/get.php?username=${usuario}&password=${senha}&type=m3u_plus&output=hls`;
  };

  const getRemainingTime = (expiraEm: string) => {
    const expiryDate = new Date(expiraEm);
    const now = new Date();
    
    if (expiryDate < now) {
      return 'Expirado';
    }
    
    return formatDistanceToNow(expiryDate, { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return phone;
  };

  const openChat = (telefone: string) => {
    // Add country code if not present
    const phoneWithCountry = telefone.startsWith('55') ? telefone : `55${telefone}`;
    setLocation(`/chat?phone=${phoneWithCountry}`);
  };

  const openTestDetails = (test: Teste) => {
    setSelectedTest(test);
    setIsDetailsDialogOpen(true);
  };

  const filteredTestes = testes?.filter(teste => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      teste.telefone.includes(searchTerm) ||
      teste.aplicativo.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="loading-spinner w-12 h-12" />
          <p className="text-slate-400 font-medium">Carregando testes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Monitor className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Gerenciar Testes
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {filteredTestes?.length || 0} testes no sistema
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <Select
              value={selectedSistemaId?.toString()}
              onValueChange={(value) => setSelectedSistemaId(parseInt(value))}
            >
              <SelectTrigger className="w-[200px] bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="Selecionar Sistema" />
              </SelectTrigger>
              <SelectContent>
                {sistemas?.map((sistema: any) => (
                  <SelectItem key={sistema.id} value={sistema.id.toString()}>
                    Sistema {sistema.systemId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Expirados
            </Button>
            <Button 
              size="lg"
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-2" />
              Novo Teste
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por telefone, usuário ou aplicativo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-400"
          />
        </div>
        
        <div className="flex bg-dark-bg border border-slate-700 rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('ativo')}
            className={`
              transition-all duration-200 font-medium
              ${filterStatus === 'ativo' 
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                : 'text-slate-400'
              }
            `}
          >
            Ativos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('expirado')}
            className={`
              transition-all duration-200 font-medium
              ${filterStatus === 'expirado' 
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' 
                : 'text-slate-400'
              }
            `}
          >
            Expirados
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('deletado')}
            className={`
              transition-all duration-200 font-medium
              ${filterStatus === 'deletado' 
                ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white' 
                : 'text-slate-400'
              }
            `}
          >
            Deletados
          </Button>
        </div>
      </div>

      {/* Tests Grid */}
      {filteredTestes && filteredTestes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-slate-400 mb-4">
            <Monitor className="w-16 h-16" />
          </div>
          <h3 className="text-xl font-semibold text-slate-300 mb-2">
            Nenhum teste cadastrado
          </h3>
          <p className="text-slate-400 text-center mb-6">
            Clique no botão "Novo Teste" para criar um teste temporário
          </p>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
          >
            <Plus className="w-5 h-5 mr-2" />
            Criar Primeiro Teste
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTestes?.map((teste) => {
          const isExpired = new Date(teste.expiraEm) < new Date();
          
          return (
            <Card 
              key={teste.id} 
              className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 p-6 hover:shadow-lg hover:shadow-purple-500/10 transition-all"
            >
              <div className="space-y-4">
                {/* Basic Info - Always Visible */}
                <div className="space-y-3">
                  {/* Phone Number */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      className="p-0 h-auto font-semibold text-white hover:text-blue-400 transition-colors text-left text-lg"
                      onClick={() => openChat(teste.telefone)}
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      {formatPhoneDisplay(teste.telefone)}
                    </Button>
                    <Badge 
                      variant={isExpired ? 'destructive' : 'default'}
                      className={isExpired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}
                    >
                      {isExpired ? 'Expirado' : 'Ativo'}
                    </Badge>
                  </div>

                  {/* System */}
                  {teste.sistemaId && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Sistema:</span>
                      <span className="text-white">
                        {sistemas?.find((s: any) => s.id === teste.sistemaId)?.systemId ? 
                          `Sistema ${sistemas.find((s: any) => s.id === teste.sistemaId).systemId}` : 
                          '-'
                        }
                      </span>
                    </div>
                  )}

                  {/* Creation Time */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Criado em:</span>
                    <span className="text-white">
                      {format(new Date(teste.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  {/* Expiration Time */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Expira em:</span>
                    <span className={cn(
                      "font-medium",
                      isExpired ? "text-red-400" : "text-green-400"
                    )}>
                      {format(new Date(teste.expiraEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center items-center pt-3 border-t border-slate-700/50">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-white"
                    onClick={() => openTestDetails(teste)}
                  >
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        </div>
      )}

      <CreateTestDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultPhone={selectedPhone}
        sistemaId={selectedSistemaId}
      />

      <TestDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        teste={selectedTest}
        onTestDeleted={() => setIsDetailsDialogOpen(false)}
      />
    </div>
  );
}