import { useState } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, CheckCircle, XCircle, Users, Smartphone, Monitor, Tv2, Filter, Search, Edit, Trash2, AlertTriangle, Router } from 'lucide-react';
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

  const getStatusBadge = (status: string) => {
    const variants = {
      ativo: 'bg-green-500/20 text-green-400',
      inativo: 'bg-red-500/20 text-red-400',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-500/20 text-gray-400';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      ativo: CheckCircle,
      inativo: XCircle,
    };
    return icons[status as keyof typeof icons] || XCircle;
  };

  const getDaysRemainingBadge = (days: number) => {
    if (days <= 0) return 'bg-red-500/20 text-red-400';
    if (days <= 3) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-green-500/20 text-green-400';
  };

  const getDeviceIcon = (dispositivo: string) => {
    const icons = {
      smart_tv: Tv2,
      tv_box: Router,
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
    // Filtro por status de vencimento
    if (filterType === 'vencidos') {
      const days = getDaysUntilExpiry(ponto.expiracao);
      if (days > 0) return false;
    } else if (filterType === 'proximos') {
      const days = getDaysUntilExpiry(ponto.expiracao);
      if (days <= 0 || days > diasFiltro) return false;
    }

    // Filtro por aplicativo
    if (filterApp !== 'todos' && ponto.aplicativo !== filterApp) {
      return false;
    }

    // Filtro por busca
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
      {/* Beautiful Header */}
      <div className="mb-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/30">
              <Router className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Aplicativos
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Gerenciamento de aplicativos cadastrados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-0">
              {filteredPontos?.length || 0} apps
            </Badge>
            <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-0">
              {filteredPontos?.filter(p => p.status === 'ativo').length || 0} ativos
            </Badge>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex bg-dark-surface border border-slate-600 rounded-lg">
          <Button
            variant={filterType === 'todos' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterType('todos')}
            className="rounded-r-none"
          >
            Todos
          </Button>
          <Button
            variant={filterType === 'proximos' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterType('proximos')}
            className="rounded-none"
          >
            Vencendo em {diasFiltro} dias
          </Button>
          <Button
            variant={filterType === 'vencidos' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterType('vencidos')}
            className="rounded-l-none"
          >
            Vencidos
          </Button>
        </div>

        <Select value={filterApp} onValueChange={setFilterApp}>
          <SelectTrigger className="w-[180px] bg-dark-surface border-slate-600">
            <SelectValue placeholder="Filtrar por app" />
          </SelectTrigger>
          <SelectContent className="bg-dark-surface border-slate-600">
            <SelectItem value="todos">Todos os Apps</SelectItem>
            {uniqueApps.map(app => (
              <SelectItem key={app} value={app}>
                {getAppLabel(app)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por cliente, telefone, MAC ou usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-dark-surface border-slate-600"
          />
        </div>
      </div>

      {/* Apps Table */}
      <Card className="bg-dark-card border-slate-600">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-tv-border">
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Cliente
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Router className="w-4 h-4" />
                      Aplicativo
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Dispositivo
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    MAC Address
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    Usuário
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Vencimento
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Dias Restantes
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPontos?.map((ponto: PontoComCliente) => {
                  const daysRemaining = getDaysUntilExpiry(ponto.expiracao);
                  const DeviceIcon = getDeviceIcon(ponto.dispositivo);
                  
                  return (
                    <tr key={ponto.id} className="table-row hover-card">
                      <td className="table-cell">
                        <div className="flex flex-col">
                          <span className="font-medium">{ponto.clienteNome || 'Cliente não encontrado'}</span>
                          <span className="text-xs text-slate-400">{ponto.clienteTelefone || ''}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border-0">
                          {getAppLabel(ponto.aplicativo)}
                        </Badge>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <DeviceIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-sm">{ponto.dispositivo.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <code className="text-xs bg-slate-800 px-2 py-1 rounded">
                          {ponto.macAddress || 'N/A'}
                        </code>
                      </td>
                      <td className="table-cell">
                        <span className="text-sm">{ponto.usuario}</span>
                      </td>
                      <td className="table-cell">
                        {new Date(ponto.expiracao).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="table-cell">
                        <Badge className={getDaysRemainingBadge(daysRemaining)}>
                          {daysRemaining <= 0 ? (
                            <>
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {Math.abs(daysRemaining)} dias atrás
                            </>
                          ) : (
                            `${daysRemaining} dias`
                          )}
                        </Badge>
                      </td>
                      <td className="table-cell">
                        <Badge className={`${getStatusBadge(ponto.status)} flex items-center gap-1 w-fit`}>
                          {React.createElement(getStatusIcon(ponto.status), { size: 12 })}
                          {ponto.status}
                        </Badge>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Editar aplicativo"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Excluir aplicativo"
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
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
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">
                {filterType === 'proximos' && `Nenhum aplicativo vencendo nos próximos ${diasFiltro} dias`}
                {filterType === 'vencidos' && 'Nenhum aplicativo vencido'}
                {filterType === 'todos' && 'Nenhum aplicativo encontrado'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}