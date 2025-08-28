import { useState } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  Calendar, Clock, CheckCircle, XCircle, Smartphone, Monitor, Tv2, 
  Filter, Search, Edit, AlertTriangle, Router, Wifi, Copy, 
  Activity, Shield, Cpu, CalendarPlus
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import type { Ponto } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

interface PontoComCliente extends Ponto {
  clienteNome?: string;
  clienteTelefone?: string;
}

export default function Apps() {
  const [filterType, setFilterType] = useState<'todos' | 'vencidos' | 'proximos'>('todos');
  const [filterApp, setFilterApp] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedMac, setCopiedMac] = useState<string | null>(null);
  const { toast } = useToast();
  const [diasFiltro, setDiasFiltro] = useState(7);

  const { data: pontos, isLoading } = useQuery({
    queryKey: ['/api/pontos'],
    queryFn: api.getAllPontos,
  });

  const updateExpirationMutation = useMutation({
    mutationFn: async (pontoId: number) => {
      const ponto = pontos?.find(p => p.id === pontoId);
      if (!ponto) throw new Error('Ponto não encontrado');
      
      const newExpiration = new Date();
      newExpiration.setFullYear(newExpiration.getFullYear() + 1);
      
      return apiRequest('PUT', `/api/pontos/${pontoId}`, {
        expiracao: newExpiration.toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pontos'] });
      toast({
        title: 'Sucesso!',
        description: 'Data de vencimento atualizada para 1 ano.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a data de vencimento.',
        variant: 'destructive',
      });
    },
  });

  const getDaysUntilExpiry = (expiracao: string) => {
    const expiryDate = new Date(expiracao);
    const nowSaoPaulo = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const today = new Date(nowSaoPaulo);
    
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMac(text);
      toast({
        title: 'Copiado!',
        description: 'MAC copiado para área de transferência.',
      });
      setTimeout(() => setCopiedMac(null), 2000);
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o MAC.',
        variant: 'destructive',
      });
    }
  };

  const getDeviceIcon = (dispositivo: string) => {
    const icons = {
      smart_tv: Tv2,
      tv_box: Cpu,
      celular: Smartphone,
      notebook: Monitor,
    };
    return icons[dispositivo as keyof typeof icons] || Monitor;
  };

  const getAppLabel = (app: string) => {
    const labels = {
      ibo_pro: 'IBO Pro',
      ibo_player: 'IBO Player',
      shamel: 'Shamel',
    };
    return labels[app as keyof typeof labels] || app;
  };

  const filteredPontos = pontos?.filter((ponto: PontoComCliente) => {
    if (filterType === 'vencidos') {
      const days = getDaysUntilExpiry(ponto.expiracao);
      if (days > 0) return false;
    } else if (filterType === 'proximos') {
      const days = getDaysUntilExpiry(ponto.expiracao);
      if (days <= 0 || days > diasFiltro) return false;
    }

    if (filterApp !== 'todos' && ponto.aplicativo !== filterApp) {
      return false;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        ponto.clienteNome?.toLowerCase().includes(search) ||
        ponto.clienteTelefone?.includes(search) ||
        ponto.macAddress?.toLowerCase().includes(search) ||
        ponto.usuario?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const totalAtivos = pontos?.filter(p => p.status === 'ativo').length || 0;
  const totalVencidos = pontos?.filter(p => getDaysUntilExpiry(p.expiracao) <= 0).length || 0;
  const totalProximos = pontos?.filter(p => {
    const days = getDaysUntilExpiry(p.expiracao);
    return days > 0 && days <= 7;
  }).length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8" />
      </div>
    );
  }

  const uniqueApps = [...new Set(pontos?.map(p => p.aplicativo) || [])];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6 backdrop-blur-sm border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Router className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Aplicativos
              </h1>
              <p className="text-slate-400 mt-1">Gerenciamento de aplicativos cadastrados</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{pontos?.length || 0}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{totalAtivos}</p>
              <p className="text-xs text-slate-400">Ativos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{totalVencidos}</p>
              <p className="text-xs text-slate-400">Vencidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por cliente, MAC, telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 focus:border-blue-500 text-white"
              />
            </div>
            
            <Select value={filterApp} onValueChange={setFilterApp}>
              <SelectTrigger className="w-[200px] bg-slate-700 border-slate-600">
                <SelectValue placeholder="Filtrar por app" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                <SelectItem value="todos">Todos os Apps</SelectItem>
                {uniqueApps.map(app => (
                  <SelectItem key={app} value={app}>
                    {getAppLabel(app)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <div className="flex gap-2">
              {['todos', 'proximos', 'vencidos'].map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type as any)}
                  className={cn(
                    filterType === type 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
                      : 'border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white'
                  )}
                >
                  {type === 'todos' && 'Todos'}
                  {type === 'proximos' && `Vencendo em ${diasFiltro} dias`}
                  {type === 'vencidos' && 'Vencidos'}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apps Grid */}
      <div className="grid gap-4">
        {filteredPontos?.map((ponto: PontoComCliente) => {
          const daysRemaining = getDaysUntilExpiry(ponto.expiracao);
          const DeviceIcon = getDeviceIcon(ponto.dispositivo);
          
          return (
            <Card 
              key={ponto.id} 
              className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-all"
            >
              <CardContent className="p-6">
                <div className="grid lg:grid-cols-12 gap-6 items-center">
                  {/* App Icon & Info */}
                  <div className="lg:col-span-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-700">
                      <DeviceIcon className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white">{ponto.clienteNome || 'Cliente'}</h3>
                        <Badge className={cn(
                          "text-xs",
                          ponto.status === 'ativo' 
                            ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        )}>
                          {ponto.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">{formatPhone(ponto.clienteTelefone || '')}</p>
                      <Badge className="mt-2 bg-slate-700 text-slate-300 border-slate-600">
                        {getAppLabel(ponto.aplicativo)}
                      </Badge>
                    </div>
                  </div>

                  {/* Device & MAC */}
                  <div className="lg:col-span-3">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-slate-400" />
                      <code className="text-sm bg-slate-700 px-2 py-1 rounded text-slate-300">
                        {ponto.macAddress || 'Sem MAC'}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(ponto.macAddress || '')}
                        disabled={!ponto.macAddress}
                        className="p-1 h-auto hover:bg-slate-700"
                      >
                        <Copy className={cn(
                          "w-3 h-3",
                          copiedMac === ponto.macAddress ? "text-green-400" : "text-slate-400"
                        )} />
                      </Button>
                    </div>
                  </div>

                  {/* Expiration */}
                  <div className="lg:col-span-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-slate-300">
                          {new Date(ponto.expiracao).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <Badge className={cn(
                        "flex items-center gap-1",
                        daysRemaining <= 0 
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : daysRemaining <= 3 
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 border-green-500/30'
                      )}>
                        <Clock className="w-3 h-3" />
                        {daysRemaining <= 0 
                          ? `Vencido há ${Math.abs(daysRemaining)} dias`
                          : `${daysRemaining} dias restantes`
                        }
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="lg:col-span-2 flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        toast({
                          title: 'Função em desenvolvimento',
                          description: 'A edição de aplicativos será implementada em breve.',
                        });
                      }}
                      className="hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateExpirationMutation.mutate(ponto.id)}
                      disabled={updateExpirationMutation.isPending}
                      className="hover:bg-green-500/20 hover:text-green-400 transition-colors"
                    >
                      <CalendarPlus className="w-4 h-4 mr-1" />
                      +1 Ano
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
          
      {!filteredPontos?.length && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-16">
            <div className="text-center">
              <Router className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">
                {filterType === 'proximos' && `Nenhum app vencendo nos próximos ${diasFiltro} dias`}
                {filterType === 'vencidos' && 'Nenhum app vencido encontrado'}
                {filterType === 'todos' && 'Nenhum aplicativo cadastrado'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}