import { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useLocation } from 'wouter';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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

    const now = new Date();
    const lastAccess = new Date(ultimoAcesso);
    const minutesDiff = (now.getTime() - lastAccess.getTime()) / (1000 * 60);

    if (minutesDiff <= 10) {
      return { text: 'Online agora', color: 'text-green-400' };
    }
    
    const hoursDiff = minutesDiff / 60;
    if (hoursDiff < 24) {
      return { text: 'Hoje', color: 'text-blue-400' };
    }
    if (hoursDiff < 168) {
      return { text: formatDistanceToNow(lastAccess, { addSuffix: true, locale: ptBR }), color: 'text-yellow-400' };
    }
    return { text: formatDistanceToNow(lastAccess, { addSuffix: true, locale: ptBR }), color: 'text-gray-400' };
  };


  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="bg-dark-gradient border-b border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Central de Acessos</h1>
          
          {/* Sort Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="border-slate-600 hover:bg-slate-800"
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {sortOrder === 'desc' ? 'Mais recente primeiro' : 'Mais antigo primeiro'}
          </Button>
        </div>
        
        {/* Simple Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-400 font-medium">Online Agora</p>
                  <p className="text-2xl font-bold text-white">{metrics.pontosOnlineAgora}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-400 font-medium">Online Hoje</p>
                  <p className="text-2xl font-bold text-white">{metrics.acessosHoje}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/10 border-slate-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Total de Pontos</p>
                  <p className="text-2xl font-bold text-white">{metrics.totalPontos}</p>
                </div>
                <Users className="w-8 h-8 text-slate-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {isLoadingPontos ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : sortedPontos.length === 0 ? (
            <Card className="bg-dark-card border-slate-700">
              <CardContent className="p-12 text-center">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-lg text-slate-400">Nenhum ponto de acesso encontrado</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-dark-card border-slate-700">
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
      </ScrollArea>
    </div>
  );
}