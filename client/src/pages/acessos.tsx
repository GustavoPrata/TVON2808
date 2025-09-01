import { useState, useEffect } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Activity, 
  Clock, 
  Search, 
  Filter, 
  Monitor, 
  Smartphone, 
  Tv2, 
  Laptop,
  User,
  Shield,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Network,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Globe,
  Server,
  Cpu
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

interface AccessMetrics {
  totalPontos: number;
  pontosAtivos: number;
  pontosInativos: number;
  pontosExpirados: number;
  acessosHoje: number;
  acessos7Dias: number;
  acessos30Dias: number;
  dispositivosMaisUsados: { dispositivo: string; count: number }[];
  aplicativosMaisUsados: { aplicativo: string; count: number }[];
  sistemasMaisUsados: { sistema: string; count: number }[];
}

export default function Acessos() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApp, setSelectedApp] = useState<string>("todos");
  const [selectedDevice, setSelectedDevice] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [selectedSystem, setSelectedSystem] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<"recent" | "client" | "expiration">("recent");
  const [showPasswords, setShowPasswords] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

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

  // Calculate metrics
  const metrics: AccessMetrics = {
    totalPontos: pontos.length,
    pontosAtivos: pontos.filter(p => p.status === 'ativo').length,
    pontosInativos: pontos.filter(p => p.status === 'inativo').length,
    pontosExpirados: pontos.filter(p => isBefore(new Date(p.expiracao), new Date())).length,
    acessosHoje: pontos.filter(p => {
      if (!p.ultimoAcesso) return false;
      const today = new Date();
      const accessDate = new Date(p.ultimoAcesso);
      return accessDate.toDateString() === today.toDateString();
    }).length,
    acessos7Dias: pontos.filter(p => {
      if (!p.ultimoAcesso) return false;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return isAfter(new Date(p.ultimoAcesso), sevenDaysAgo);
    }).length,
    acessos30Dias: pontos.filter(p => {
      if (!p.ultimoAcesso) return false;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return isAfter(new Date(p.ultimoAcesso), thirtyDaysAgo);
    }).length,
    dispositivosMaisUsados: Object.entries(
      pontos.reduce((acc: any, p) => {
        acc[p.dispositivo] = (acc[p.dispositivo] || 0) + 1;
        return acc;
      }, {})
    ).map(([dispositivo, count]) => ({ dispositivo, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    aplicativosMaisUsados: Object.entries(
      pontos.reduce((acc: any, p) => {
        acc[p.aplicativo] = (acc[p.aplicativo] || 0) + 1;
        return acc;
      }, {})
    ).map(([aplicativo, count]) => ({ aplicativo, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    sistemasMaisUsados: Object.entries(
      pontos.reduce((acc: any, p) => {
        if (p.sistemaId) {
          const sistema = sistemas.find((s: any) => s.id === p.sistemaId);
          if (sistema) {
            acc[sistema.systemId] = (acc[sistema.systemId] || 0) + 1;
          }
        }
        return acc;
      }, {})
    ).map(([sistema, count]) => ({ sistema, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };

  // Enrich pontos with client and system data
  const enrichedPontos = pontos.map(ponto => ({
    ...ponto,
    cliente: clientes.find((c: any) => c.id === ponto.clienteId),
    sistema: sistemas.find((s: any) => s.id === ponto.sistemaId)
  }));

  // Filter pontos
  const filteredPontos = enrichedPontos.filter(ponto => {
    const matchesSearch = searchTerm === "" || 
      ponto.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ponto.cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ponto.macAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ponto.deviceKey?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesApp = selectedApp === "todos" || ponto.aplicativo === selectedApp;
    const matchesDevice = selectedDevice === "todos" || ponto.dispositivo === selectedDevice;
    const matchesStatus = selectedStatus === "todos" || 
      (selectedStatus === "ativo" && ponto.status === "ativo") ||
      (selectedStatus === "inativo" && ponto.status === "inativo") ||
      (selectedStatus === "expirado" && isBefore(new Date(ponto.expiracao), new Date()));
    
    const matchesSystem = selectedSystem === "todos" || 
      (ponto.sistema?.systemId === selectedSystem);

    return matchesSearch && matchesApp && matchesDevice && matchesStatus && matchesSystem;
  });

  // Sort pontos
  const sortedPontos = [...filteredPontos].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        if (!a.ultimoAcesso && !b.ultimoAcesso) return 0;
        if (!a.ultimoAcesso) return 1;
        if (!b.ultimoAcesso) return -1;
        return new Date(b.ultimoAcesso).getTime() - new Date(a.ultimoAcesso).getTime();
      case "client":
        return (a.cliente?.nome || "").localeCompare(b.cliente?.nome || "");
      case "expiration":
        return new Date(a.expiracao).getTime() - new Date(b.expiracao).getTime();
      default:
        return 0;
    }
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copiado!`,
      description: "Conteúdo copiado para a área de transferência",
    });
  };

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
    const hoursDiff = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 1) {
      return { text: 'Online agora', color: 'text-green-400' };
    }
    if (hoursDiff < 24) {
      return { text: 'Hoje', color: 'text-blue-400' };
    }
    if (hoursDiff < 168) {
      return { text: formatDistanceToNow(lastAccess, { addSuffix: true, locale: ptBR }), color: 'text-yellow-400' };
    }
    return { text: formatDistanceToNow(lastAccess, { addSuffix: true, locale: ptBR }), color: 'text-gray-400' };
  };

  const refreshAccessMutation = useMutation({
    mutationFn: async (pontoId: number) => {
      // Simulate access refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pontos'] });
      toast({
        title: "Acesso atualizado",
        description: "As informações de acesso foram atualizadas com sucesso",
      });
    }
  });

  return (
    <div className="h-screen flex flex-col bg-dark-gradient">
      {/* Header */}
      <div className="bg-dark-surface border-b border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Central de Acessos
              </h1>
              <p className="text-sm text-slate-400 mt-1">Monitoramento completo de todos os pontos de acesso</p>
            </div>
          </div>
          <Button
            onClick={() => setShowPasswords(!showPasswords)}
            variant="outline"
            className="border-slate-600"
          >
            {showPasswords ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showPasswords ? 'Ocultar' : 'Mostrar'} Senhas
          </Button>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-400 font-medium">Total Pontos</p>
                  <p className="text-2xl font-bold text-white">{metrics.totalPontos}</p>
                </div>
                <Network className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-400 font-medium">Ativos</p>
                  <p className="text-2xl font-bold text-white">{metrics.pontosAtivos}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-400 font-medium">Acessos Hoje</p>
                  <p className="text-2xl font-bold text-white">{metrics.acessosHoje}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-amber-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-400 font-medium">7 Dias</p>
                  <p className="text-2xl font-bold text-white">{metrics.acessos7Dias}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-cyan-400 font-medium">30 Dias</p>
                  <p className="text-2xl font-bold text-white">{metrics.acessos30Dias}</p>
                </div>
                <Calendar className="w-8 h-8 text-cyan-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-400 font-medium">Expirados</p>
                  <p className="text-2xl font-bold text-white">{metrics.pontosExpirados}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-500/10 to-gray-600/10 border-gray-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Inativos</p>
                  <p className="text-2xl font-bold text-white">{metrics.pontosInativos}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-gray-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, usuário, MAC ou Device Key..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-dark-card border-slate-600"
                data-testid="input-access-search"
              />
            </div>
          </div>

          <Select value={selectedApp} onValueChange={setSelectedApp}>
            <SelectTrigger className="w-[180px] bg-dark-card border-slate-600" data-testid="select-app-filter">
              <SelectValue placeholder="Aplicativo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Apps</SelectItem>
              <SelectItem value="ibo_pro">IBO Pro</SelectItem>
              <SelectItem value="ibo_player">IBO Player</SelectItem>
              <SelectItem value="shamel">Shamel</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
            <SelectTrigger className="w-[180px] bg-dark-card border-slate-600" data-testid="select-device-filter">
              <SelectValue placeholder="Dispositivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Dispositivos</SelectItem>
              <SelectItem value="smart_tv">Smart TV</SelectItem>
              <SelectItem value="tv_box">TV Box</SelectItem>
              <SelectItem value="celular">Celular</SelectItem>
              <SelectItem value="notebook">Notebook</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[180px] bg-dark-card border-slate-600" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
              <SelectItem value="expirado">Expirados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedSystem} onValueChange={setSelectedSystem}>
            <SelectTrigger className="w-[180px] bg-dark-card border-slate-600" data-testid="select-system-filter">
              <SelectValue placeholder="Sistema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Sistemas</SelectItem>
              {sistemas.map((sistema: any) => (
                <SelectItem key={sistema.id} value={sistema.systemId}>
                  Sistema {sistema.systemId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[180px] bg-dark-card border-slate-600" data-testid="select-sort">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Acesso mais recente</SelectItem>
              <SelectItem value="client">Nome do cliente</SelectItem>
              <SelectItem value="expiration">Data de expiração</SelectItem>
            </SelectContent>
          </Select>
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
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-lg text-slate-400">Nenhum ponto de acesso encontrado</p>
                <p className="text-sm text-slate-500 mt-2">Ajuste os filtros ou adicione novos pontos</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedPontos.map((ponto) => {
                const accessStatus = getAccessStatus(ponto.ultimoAcesso);
                const isExpanded = expandedCard === ponto.id;

                return (
                  <Card 
                    key={ponto.id} 
                    className={cn(
                      "bg-dark-card border-slate-700 hover:border-slate-600 transition-all cursor-pointer",
                      isExpanded && "lg:col-span-2 xl:col-span-2"
                    )}
                    onClick={() => setExpandedCard(isExpanded ? null : ponto.id)}
                    data-testid={`card-access-${ponto.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            getStatusColor(ponto)
                          )}>
                            {getAppIcon(ponto.aplicativo)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">
                              {ponto.cliente?.nome || 'Cliente não identificado'}
                            </h3>
                            <p className="text-sm text-slate-400">
                              {ponto.cliente?.telefone || 'Sem telefone'}
                            </p>
                          </div>
                        </div>
                        <Badge className={cn("text-xs", getStatusColor(ponto))}>
                          {ponto.status === 'ativo' && !isBefore(new Date(ponto.expiracao), new Date()) ? 'Ativo' :
                           ponto.status === 'inativo' ? 'Inativo' : 'Expirado'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Access Info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-400">Último acesso:</span>
                        </div>
                        <span className={cn("text-sm font-medium", accessStatus.color)}>
                          {accessStatus.text}
                        </span>
                      </div>

                      {/* App and Device */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(ponto.dispositivo)}
                          <span className="text-sm text-slate-400">
                            {ponto.dispositivo.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        <span className="text-sm text-slate-300">
                          {ponto.aplicativo === 'ibo_pro' ? 'IBO Pro' :
                           ponto.aplicativo === 'ibo_player' ? 'IBO Player' : 'Shamel'}
                        </span>
                      </div>

                      {/* System */}
                      {ponto.sistema && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-400">Sistema:</span>
                          </div>
                          <span className="text-sm text-slate-300">
                            {ponto.sistema.systemId} ({ponto.sistema.pontosAtivos}/{ponto.sistema.maxPontosAtivos})
                          </span>
                        </div>
                      )}

                      {/* Credentials */}
                      <Separator className="bg-slate-700" />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Usuário:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-slate-300">{ponto.usuario}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(ponto.usuario, 'Usuário');
                              }}
                              data-testid={`button-copy-user-${ponto.id}`}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Senha:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-slate-300">
                              {showPasswords ? ponto.senha : '••••••••'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(ponto.senha, 'Senha');
                              }}
                              data-testid={`button-copy-password-${ponto.id}`}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <>
                          <Separator className="bg-slate-700" />
                          
                          {/* MAC Address */}
                          {ponto.macAddress && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">MAC Address:</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-slate-300">{ponto.macAddress}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(ponto.macAddress!, 'MAC Address');
                                  }}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Device Key */}
                          {ponto.deviceKey && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">Device Key:</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-slate-300 truncate max-w-[200px]">
                                  {ponto.deviceKey}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(ponto.deviceKey!, 'Device Key');
                                  }}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Expiration */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">Expira em:</span>
                            <span className={cn(
                              "text-sm font-medium",
                              differenceInDays(new Date(ponto.expiracao), new Date()) <= 7 
                                ? "text-amber-400" 
                                : "text-slate-300"
                            )}>
                              {format(new Date(ponto.expiracao), "dd/MM/yyyy")}
                              {' '}({differenceInDays(new Date(ponto.expiracao), new Date())} dias)
                            </span>
                          </div>

                          {/* Value */}
                          {ponto.valor && parseFloat(ponto.valor) > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-400">Valor:</span>
                              <span className="text-sm font-medium text-green-400">
                                R$ {parseFloat(ponto.valor).toFixed(2)}
                              </span>
                            </div>
                          )}

                          {/* Description */}
                          {ponto.descricao && (
                            <div className="pt-2">
                              <p className="text-sm text-slate-400">Descrição:</p>
                              <p className="text-sm text-slate-300 mt-1">{ponto.descricao}</p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-slate-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                refreshAccessMutation.mutate(ponto.id);
                              }}
                              disabled={refreshAccessMutation.isPending}
                              data-testid={`button-refresh-${ponto.id}`}
                            >
                              <RefreshCw className={cn(
                                "w-3 h-3 mr-1",
                                refreshAccessMutation.isPending && "animate-spin"
                              )} />
                              Atualizar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-slate-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/clientes/${ponto.clienteId}`;
                              }}
                              data-testid={`button-view-client-${ponto.id}`}
                            >
                              <User className="w-3 h-3 mr-1" />
                              Ver Cliente
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Top Usage Statistics */}
          {sortedPontos.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Most Used Devices */}
              <Card className="bg-dark-card border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg">Dispositivos Mais Usados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.dispositivosMaisUsados.map((item, index) => (
                      <div key={item.dispositivo} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">{index + 1}.</span>
                          {getDeviceIcon(item.dispositivo)}
                          <span className="text-sm text-slate-300">
                            {item.dispositivo.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-400">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Most Used Apps */}
              <Card className="bg-dark-card border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg">Aplicativos Mais Usados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.aplicativosMaisUsados.map((item, index) => (
                      <div key={item.aplicativo} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">{index + 1}.</span>
                          {getAppIcon(item.aplicativo)}
                          <span className="text-sm text-slate-300">
                            {item.aplicativo === 'ibo_pro' ? 'IBO Pro' :
                             item.aplicativo === 'ibo_player' ? 'IBO Player' : 'Shamel'}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-400">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Most Used Systems */}
              <Card className="bg-dark-card border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg">Sistemas Mais Usados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.sistemasMaisUsados.length > 0 ? (
                      metrics.sistemasMaisUsados.map((item, index) => (
                        <div key={item.sistema} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">{index + 1}.</span>
                            <Server className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-300">Sistema {item.sistema}</span>
                          </div>
                          <span className="text-sm font-medium text-slate-400">{item.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 text-center">Nenhum sistema em uso</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}