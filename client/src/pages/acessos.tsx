import { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useLocation } from 'wouter';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Clock, 
  Monitor, 
  Smartphone, 
  Tv2, 
  Laptop,
  CheckCircle,
  Globe,
  Cpu,
  Users,
  ArrowUpDown,
  RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow, isAfter, isBefore, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Ponto {
  id: number;
  clienteId: number;
  aplicativo: string;
  dispositivo: string;
  usuario: string;
  senha: string;
  valor: string;
  expiracao: string;
  ultimoAcesso: string | null;
  macAddress: string | null;
  deviceKey: string | null;
  descricao: string | null;
  status: string;
  apiUserId: number | null;
  sistemaId: number | null;
  cliente?: {
    id: number;
    nome: string;
    telefone: string;
    vencimento: string;
    status: string;
  };
  sistema?: {
    id: number;
    systemId: string;
    username: string;
    maxPontosAtivos: number;
    pontosAtivos: number;
  };
}

export default function Acessos() {
  const [, setLocation] = useLocation();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch pontos data
  const { data: pontos = [], isLoading: isLoadingPontos } = useQuery<Ponto[]>({
    queryKey: ['/api/pontos'],
  });

  // Fetch clients data
  const { data: clientes = [] } = useQuery<any[]>({
    queryKey: ['/api/clientes'],
  });

  // Fetch systems data
  const { data: sistemas = [] } = useQuery<any[]>({
    queryKey: ['/api/sistemas'],
  });

  // Calculate simplified metrics
  const metrics = {
    totalPontos: pontos.length,
    pontosOnlineAgora: pontos.filter(p => {
      if (!p.ultimoAcesso) return false;
      const accessDate = new Date(p.ultimoAcesso);
      const tenMinutesAgo = new Date();
      tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
      return isAfter(accessDate, tenMinutesAgo);
    }).length,
    acessosHoje: pontos.filter(p => {
      if (!p.ultimoAcesso) return false;
      const accessDate = new Date(p.ultimoAcesso);
      const today = new Date();
      return (
        accessDate.getDate() === today.getDate() &&
        accessDate.getMonth() === today.getMonth() &&
        accessDate.getFullYear() === today.getFullYear()
      );
    }).length
  };

  // Enrich pontos with client and system data
  const enrichedPontos = pontos.map(ponto => ({
    ...ponto,
    cliente: clientes.find((c: any) => c.id === ponto.clienteId),
    sistema: sistemas.find((s: any) => s.id === ponto.sistemaId)
  }));

  // Sort pontos by access time based on sortOrder
  const sortedPontos = [...enrichedPontos].sort((a, b) => {
    if (!a.ultimoAcesso && !b.ultimoAcesso) return 0;
    if (!a.ultimoAcesso) return 1;
    if (!b.ultimoAcesso) return -1;
    
    const timeA = new Date(a.ultimoAcesso).getTime();
    const timeB = new Date(b.ultimoAcesso).getTime();
    
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });


  const getAppIcon = (aplicativo: string) => {
    switch (aplicativo) {
      case 'ibo_pro':
        return <Tv2 className="w-4 h-4" />;
      case 'ibo_player':
        return <Monitor className="w-4 h-4" />;
      case 'shamel':
        return <Globe className="w-4 h-4" />;
      default:
        return <Cpu className="w-4 h-4" />;
    }
  };

  const getDeviceIcon = (dispositivo: string) => {
    switch (dispositivo) {
      case 'smart_tv':
        return <Tv2 className="w-4 h-4" />;
      case 'tv_box':
        return <Monitor className="w-4 h-4" />;
      case 'celular':
        return <Smartphone className="w-4 h-4" />;
      case 'notebook':
        return <Laptop className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const getStatusColor = (ponto: Ponto) => {
    const now = new Date();
    const expiration = new Date(ponto.expiracao);
    const daysUntilExpiration = differenceInDays(expiration, now);

    if (ponto.status === 'inativo') {
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
    if (isBefore(expiration, now)) {
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
    if (daysUntilExpiration <= 7) {
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  };

  const getAccessStatus = (ultimoAcesso: string | null) => {
    if (!ultimoAcesso) {
      return { text: 'Nunca acessado', color: 'text-gray-400' };
    }

    // Converter UTC para horário de Brasília (UTC-3)
    const now = new Date();
    const lastAccessUTC = new Date(ultimoAcesso);
    
    // Subtrair 3 horas para converter de UTC para Brasília
    const lastAccess = new Date(lastAccessUTC.getTime() - (3 * 60 * 60 * 1000));
    const nowBrasil = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    
    const minutesDiff = (now.getTime() - lastAccessUTC.getTime()) / (1000 * 60);

    if (minutesDiff <= 10) {
      return { text: 'Online agora', color: 'text-green-400' };
    }
    
    const hoursDiff = minutesDiff / 60;
    const daysDiff = hoursDiff / 24;
    
    // Se foi hoje (comparar no horário de Brasília)
    if (nowBrasil.toDateString() === lastAccess.toDateString()) {
      return { text: `Hoje às ${format(lastAccess, 'HH:mm', { locale: ptBR })}`, color: 'text-blue-400' };
    }
    
    // Se foi ontem
    const yesterday = new Date(nowBrasil);
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === lastAccess.toDateString()) {
      return { text: `Ontem às ${format(lastAccess, 'HH:mm', { locale: ptBR })}`, color: 'text-yellow-400' };
    }
    
    // Se foi nos últimos 7 dias
    if (daysDiff < 7) {
      return { text: format(lastAccess, "EEEE 'às' HH:mm", { locale: ptBR }), color: 'text-yellow-400' };
    }
    
    // Mais de 7 dias
    return { text: format(lastAccess, "dd/MM 'às' HH:mm", { locale: ptBR }), color: 'text-gray-400' };
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Activity className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Central de Acessos
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Monitoramento de pontos de acesso em tempo real
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {sortOrder === 'desc' ? 'Mais recente primeiro' : 'Mais antigo primeiro'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Online Agora</span>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-400 mt-1">{metrics.pontosOnlineAgora}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Online Hoje</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-400 mt-1">{metrics.acessosHoje}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Total de Pontos</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-300 mt-1">{metrics.totalPontos}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoadingPontos ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : sortedPontos.length === 0 ? (
        <Card className="bg-dark-card border-slate-600">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-lg text-slate-400">Nenhum ponto de acesso encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-dark-card border-slate-600">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="text-left p-3 font-medium text-slate-300">Status</th>
                      <th className="text-left p-3 font-medium text-slate-300">Cliente/Usuário</th>
                      <th className="text-left p-3 font-medium text-slate-300">Aplicativo</th>
                      <th className="text-left p-3 font-medium text-slate-300">Dispositivo</th>
                      <th className="text-left p-3 font-medium text-slate-300">Sistema</th>
                      <th className="text-left p-3 font-medium text-slate-300">Último Acesso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPontos.map((ponto) => {
                      const accessStatus = getAccessStatus(ponto.ultimoAcesso);

                      return (
                        <tr 
                          key={ponto.id} 
                          className="border-b border-slate-700 hover:bg-slate-800/30 transition-colors"
                          data-testid={`row-access-${ponto.id}`}
                        >
                          {/* Status Column */}
                          <td className="p-3">
                            <Badge className={cn("text-xs", getStatusColor(ponto))}>
                              {ponto.status === 'ativo' && !isBefore(new Date(ponto.expiracao), new Date()) ? 'Ativo' :
                               ponto.status === 'inativo' ? 'Inativo' : 'Expirado'}
                            </Badge>
                          </td>
                          
                          {/* Cliente/Usuário Column */}
                          <td className="p-3">
                            <div>
                              <div 
                                className="font-medium text-white hover:text-blue-400 cursor-pointer transition-colors"
                                onClick={() => ponto.clienteId && setLocation(`/clientes/${ponto.clienteId}`)}
                              >
                                {ponto.cliente?.nome || 'Cliente não identificado'}
                              </div>
                              <div className="text-sm text-slate-400">
                                {ponto.usuario}
                              </div>
                            </div>
                          </td>

                          {/* Aplicativo Column */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {getAppIcon(ponto.aplicativo)}
                              <span className="text-sm text-slate-300">
                                {ponto.aplicativo === 'ibo_pro' ? 'IBO Pro' :
                                 ponto.aplicativo === 'ibo_player' ? 'IBO Player' : 'Shamel'}
                              </span>
                            </div>
                          </td>
                          
                          {/* Dispositivo Column */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(ponto.dispositivo)}
                              <span className="text-sm text-slate-300">
                                {ponto.dispositivo.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            </div>
                          </td>

                          {/* Sistema Column */}
                          <td className="p-3">
                            {ponto.sistema ? (
                              <span className="text-sm text-slate-300">
                                {ponto.sistema.systemId}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">-</span>
                            )}
                          </td>
                          
                          {/* Último Acesso Column */}
                          <td className="p-3">
                            <span className={cn("text-sm", accessStatus.color)}>
                              {accessStatus.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
        </Card>
      )}
    </div>
  );
}