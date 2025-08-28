import { useState } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  Calendar, Clock, CheckCircle, XCircle, Users, Smartphone, Monitor, Tv2, 
  Filter, Search, Edit, Trash2, AlertTriangle, Router, Wifi, HardDrive, 
  Activity, TrendingUp, Shield, Zap, Globe, Server, Cpu, Settings
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Ponto } from '@/types';
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
  const [diasFiltro, setDiasFiltro] = useState(7);

  const { data: pontos, isLoading } = useQuery({
    queryKey: ['/api/pontos'],
    queryFn: api.getAllPontos,
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

  const getAppGradient = (app: string) => {
    const gradients = {
      ibo_pro: 'from-blue-500 to-cyan-600',
      ibo_player: 'from-purple-500 to-pink-600',
      shamel: 'from-orange-500 to-red-600',
    };
    return gradients[app as keyof typeof gradients] || 'from-gray-500 to-gray-600';
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
      {/* Animated Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-600/20 p-[2px]">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite]"></div>
        <div className="relative rounded-3xl bg-slate-900/95 backdrop-blur p-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                <div className="relative p-5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-2xl">
                  <Router className="w-14 h-14 text-white drop-shadow-lg" />
                </div>
              </div>
              <div>
                <h1 className="text-5xl font-black text-white mb-2">
                  Central de <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">APPs</span>
                </h1>
                <p className="text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-400 animate-pulse" />
                  Sistema de gerenciamento de aplicativos
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/30 hover:border-blue-500/50 transition-all hover:scale-105">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Shield className="w-8 h-8 text-blue-400" />
                    <span className="text-3xl font-bold text-white">{pontos?.length || 0}</span>
                  </div>
                  <p className="text-xs text-blue-300">Total Apps</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-500/30 hover:border-green-500/50 transition-all hover:scale-105">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Activity className="w-8 h-8 text-green-400" />
                    <span className="text-3xl font-bold text-white">{totalAtivos}</span>
                  </div>
                  <p className="text-xs text-green-300">Ativos</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-red-500/10 to-orange-600/10 border-red-500/30 hover:border-red-500/50 transition-all hover:scale-105">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                    <span className="text-3xl font-bold text-white">{totalVencidos}</span>
                  </div>
                  <p className="text-xs text-red-300">Vencidos</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-950 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-slate-300">Filtro Rápido</span>
            </div>
            <div className="space-y-2">
              {['todos', 'proximos', 'vencidos'].map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterType(type as any)}
                  className={cn(
                    "w-full justify-start",
                    filterType === type 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' 
                      : 'hover:bg-slate-800'
                  )}
                >
                  {type === 'todos' && 'Todos os Apps'}
                  {type === 'proximos' && `Vencendo (${diasFiltro} dias)`}
                  {type === 'vencidos' && 'Apps Vencidos'}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 bg-gradient-to-br from-slate-900 to-slate-950 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <Input
                  type="text"
                  placeholder="Buscar por cliente, MAC, telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-700 focus:border-purple-500 transition-colors"
                />
              </div>
              
              <Select value={filterApp} onValueChange={setFilterApp}>
                <SelectTrigger className="w-[200px] bg-slate-800/50 border-slate-700">
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
          </CardContent>
        </Card>
      </div>

      {/* Apps Grid */}
      <div className="grid gap-4">
        {filteredPontos?.map((ponto: PontoComCliente) => {
          const daysRemaining = getDaysUntilExpiry(ponto.expiracao);
          const DeviceIcon = getDeviceIcon(ponto.dispositivo);
          
          return (
            <Card 
              key={ponto.id} 
              className={cn(
                "bg-gradient-to-br from-slate-900/95 to-slate-950/95 border-slate-700/50",
                "hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10",
                "group"
              )}
            >
              <CardContent className="p-6">
                <div className="grid lg:grid-cols-12 gap-6 items-center">
                  {/* App Icon & Info */}
                  <div className="lg:col-span-4 flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl bg-gradient-to-br shadow-lg",
                      getAppGradient(ponto.aplicativo)
                    )}>
                      <DeviceIcon className="w-8 h-8 text-white" />
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
                      <p className="text-sm text-slate-400">{ponto.clienteTelefone}</p>
                      <Badge className={cn(
                        "mt-2 bg-gradient-to-r text-white border-0",
                        getAppGradient(ponto.aplicativo)
                      )}>
                        {getAppLabel(ponto.aplicativo)}
                      </Badge>
                    </div>
                  </div>

                  {/* Device & MAC */}
                  <div className="lg:col-span-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-purple-400" />
                        <code className="text-xs bg-slate-800/50 px-2 py-1 rounded text-purple-300">
                          {ponto.macAddress || 'Sem MAC'}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">{ponto.usuario}</span>
                      </div>
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
                      className="hover:bg-purple-500/20 hover:text-purple-400 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
          
      {!filteredPontos?.length && (
        <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-700/50">
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

      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}