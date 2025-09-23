import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, RefreshCw, Loader2, AlertCircle, CheckCircle2, 
  AlertTriangle, Play, Pause, FileText, Download, Trash2,
  Search, Filter, Eye, Timer, TrendingUp, XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RenewalQueueItem {
  sistemaId: number;
  sistemaName: string;
  status: 'waiting' | 'processing' | 'completed' | 'error';
  estimatedTime?: Date;
  error?: string;
  completedAt?: Date;
  startedAt?: Date;
}

interface ExtensionLog {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  context?: any;
}

export function RenewalQueueSection() {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Atualizar tempo a cada segundo para mostrar contagem precisa
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Query para buscar fila de renovação
  const { data: queueData, isLoading, refetch } = useQuery({
    queryKey: ['/api/sistemas/renewal-queue'],
    refetchInterval: 5000, // Auto-atualizar a cada 5 segundos
  });

  // Mutation para forçar renovação
  const forceRenewalMutation = useMutation({
    mutationFn: async (sistemaId: number) => {
      const response = await fetch(`/api/sistemas/renewal-queue/force/${sistemaId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erro ao forçar renovação');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Renovação iniciada',
        description: 'A renovação foi adicionada à fila',
      });
      refetch();
    },
    onError: () => {
      toast({
        title: '❌ Erro',
        description: 'Não foi possível iniciar a renovação',
        variant: 'destructive',
      });
    },
  });

  // Mutation para limpar fila
  const clearQueueMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sistemas/renewal-queue/clear', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erro ao limpar fila');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: '🗑️ Fila limpa',
        description: data.message || 'Todos os itens foram removidos da fila',
      });
      refetch();
    },
    onError: () => {
      toast({
        title: '❌ Erro',
        description: 'Não foi possível limpar a fila',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400">
            <Clock className="w-3 h-3 mr-1" />
            Aguardando
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 animate-pulse">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/20 text-green-400">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Concluído
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-500/20 text-red-400">
            <XCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="bg-dark-card border-slate-700">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Fila de Renovação
            </CardTitle>
            <CardDescription className="text-xs">
              Sistemas aguardando ou em processo de renovação automática
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="border-slate-700"
              disabled={isLoading}
              data-testid="button-refresh-queue"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={() => {
                if (confirm('Tem certeza que deseja limpar toda a fila? Isso irá remover todos os itens pendentes.')) {
                  clearQueueMutation.mutate();
                }
              }}
              variant="outline"
              size="sm"
              className="border-slate-700 text-red-400 hover:text-red-300"
              disabled={clearQueueMutation.isPending || !queueData?.queue?.length}
              data-testid="button-clear-queue"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Status da fila */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400">Próxima verificação</span>
              </div>
              <p className="text-sm font-medium text-white">
                {queueData?.nextCheckTime 
                  ? (() => {
                      const next = new Date(queueData.nextCheckTime);
                      const diffInSeconds = Math.floor((next.getTime() - currentTime.getTime()) / 1000);
                      
                      if (diffInSeconds <= 0) {
                        return 'Verificando agora...';
                      } else if (diffInSeconds < 60) {
                        return `em ${diffInSeconds} segundo${diffInSeconds !== 1 ? 's' : ''}`;
                      } else if (diffInSeconds < 3600) {
                        const minutes = Math.floor(diffInSeconds / 60);
                        const seconds = diffInSeconds % 60;
                        return seconds > 0 
                          ? `em ${minutes}min ${seconds}s`
                          : `em ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
                      } else {
                        const hours = Math.floor(diffInSeconds / 3600);
                        const minutes = Math.floor((diffInSeconds % 3600) / 60);
                        return minutes > 0
                          ? `em ${hours}h ${minutes}min`
                          : `em ${hours} hora${hours !== 1 ? 's' : ''}`;
                      }
                    })()
                  : 'N/A'}
              </p>
            </div>
            
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-slate-400">Aguardando</span>
              </div>
              <p className="text-sm font-medium text-white">
                {queueData?.stats?.waiting || 0}
              </p>
            </div>
            
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-400">Processando</span>
              </div>
              <p className="text-sm font-medium text-white">
                {queueData?.stats?.processing || 0}
              </p>
            </div>
            
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-xs text-slate-400">Concluídos</span>
              </div>
              <p className="text-sm font-medium text-white">
                {queueData?.stats?.completed || 0}
              </p>
            </div>
          </div>

          {/* Lista de sistemas na fila */}
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Sistemas na Fila</h4>
            {queueData?.queue && queueData.queue.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {queueData.queue.map((item: RenewalQueueItem) => (
                    <div 
                      key={item.sistemaId}
                      className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(item.status)}
                          <div>
                            <p className="text-sm font-medium text-white">
                              {item.sistemaName}
                            </p>
                            <p className="text-xs text-slate-400">
                              Sistema ID: {item.sistemaId}
                            </p>
                          </div>
                        </div>
                        
                        {item.status === 'waiting' && (
                          <Button
                            onClick={() => forceRenewalMutation.mutate(item.sistemaId)}
                            size="sm"
                            variant="ghost"
                            className="text-blue-400 hover:text-blue-300"
                            disabled={forceRenewalMutation.isPending}
                            data-testid={`button-force-renewal-${item.sistemaId}`}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {item.estimatedTime && (
                          <span className="text-xs text-slate-400">
                            {formatDistanceToNow(new Date(item.estimatedTime), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        )}
                      </div>
                      
                      {item.error && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-400">
                          {item.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-center">
                <Timer className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-sm text-slate-400">Nenhum sistema na fila</p>
                <p className="text-xs text-slate-500 mt-1">
                  Os sistemas serão adicionados automaticamente quando próximo do vencimento
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExtensionLogsSection() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ExtensionLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ExtensionLog[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Função para buscar logs da extensão do backend
  const fetchLogs = async () => {
    try {
      setIsLoadingLogs(true);
      
      // Busca logs do backend
      const params = new URLSearchParams();
      if (levelFilter !== 'all') {
        params.append('level', levelFilter);
      }
      params.append('limit', '500'); // Busca até 500 logs
      
      const response = await fetch(`/api/extension/logs?${params}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLogs(data.logs || []);
          filterLogs(data.logs || [], levelFilter, searchText);
        }
      } else {
        console.error('Erro ao buscar logs:', response.statusText);
      }
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      toast({
        title: '❌ Erro',
        description: 'Não foi possível buscar os logs',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Função para filtrar logs
  const filterLogs = (logsToFilter: ExtensionLog[], level: string, search: string) => {
    let filtered = [...logsToFilter];
    
    if (level !== 'all') {
      filtered = filtered.filter(log => log.level === level);
    }
    
    if (search) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(log.context).toLowerCase().includes(search.toLowerCase())
      );
    }
    
    setFilteredLogs(filtered);
  };

  // Função para limpar logs
  const clearLogs = async () => {
    try {
      const response = await fetch('/api/extension/logs', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLogs([]);
          setFilteredLogs([]);
          toast({
            title: '✅ Logs limpos',
            description: `${data.count || 0} logs foram removidos`,
          });
        }
      } else {
        throw new Error('Erro ao limpar logs');
      }
    } catch (error) {
      console.error('Erro ao limpar logs:', error);
      toast({
        title: '❌ Erro',
        description: 'Não foi possível limpar os logs',
        variant: 'destructive',
      });
    }
  };

  // Função para baixar logs
  const downloadLogs = async () => {
    try {
      // Cria o conteúdo do arquivo
      const content = filteredLogs.map(log => {
        const time = format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss');
        const context = log.context ? JSON.stringify(log.context) : '';
        return `[${time}] [${log.level}] ${log.message} ${context}`;
      }).join('\n');
      
      // Cria e baixa o arquivo
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extension-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: '✅ Logs baixados',
        description: `Arquivo com ${filteredLogs.length} logs foi baixado`,
      });
    } catch (error) {
      console.error('Erro ao baixar logs:', error);
      toast({
        title: '❌ Erro',
        description: 'Não foi possível baixar os logs',
        variant: 'destructive',
      });
    }
  };

  // Auto-refresh
  useEffect(() => {
    fetchLogs(); // Busca inicial
    
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000); // A cada 5 segundos
      return () => clearInterval(interval);
    }
  }, [autoRefresh, levelFilter]);

  // Filtrar logs quando mudar o filtro ou busca
  useEffect(() => {
    filterLogs(logs, levelFilter, searchText);
  }, [logs, levelFilter, searchText]);

  const getLogColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-400';
      case 'WARN': return 'text-yellow-400';
      case 'INFO': return 'text-blue-400';
      case 'DEBUG': return 'text-slate-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <Card className="bg-dark-card border-slate-700">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Logs da Extensão Chrome
            </CardTitle>
            <CardDescription className="text-xs">
              Histórico detalhado de operações da extensão de automação
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant="outline"
              size="sm"
              className={`border-slate-700 ${autoRefresh ? 'text-green-400' : ''}`}
              data-testid="button-auto-refresh-logs"
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={downloadLogs}
              variant="outline"
              size="sm"
              className="border-slate-700"
              data-testid="button-download-logs"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              onClick={clearLogs}
              variant="outline"
              size="sm"
              className="border-slate-700 text-red-400"
              data-testid="button-clear-logs"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Filtrar por nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                <SelectItem value="DEBUG">DEBUG</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARN">WARN</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar nos logs..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700"
                data-testid="input-search-logs"
              />
            </div>
          </div>

          {/* Área de logs */}
          <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700">
            {isLoadingLogs ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : filteredLogs.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <div className="space-y-1 font-mono text-xs">
                  {filteredLogs.map((log, index) => (
                    <div 
                      key={index}
                      className="p-2 hover:bg-slate-800/30 rounded transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <Badge className={`text-[10px] ${
                          log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                          log.level === 'WARN' ? 'bg-yellow-500/20 text-yellow-400' :
                          log.level === 'INFO' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-600/20 text-slate-400'
                        }`}>
                          {log.level}
                        </Badge>
                        <span className="text-slate-500">
                          {format(new Date(log.timestamp), 'HH:mm:ss')}
                        </span>
                        <span className={`flex-1 ${getLogColor(log.level)}`}>
                          {log.message}
                        </span>
                      </div>
                      {log.context && Object.keys(log.context).length > 0 && (
                        <div className="ml-20 mt-1 text-slate-500 text-[10px]">
                          {JSON.stringify(log.context, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center">
                <FileText className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-sm text-slate-400">Nenhum log disponível</p>
                <p className="text-xs text-slate-500 mt-1">
                  {searchText ? 'Tente ajustar os filtros de busca' : 'Os logs aparecerão aqui quando a extensão estiver ativa'}
                </p>
              </div>
            )}
          </div>

          {/* Estatísticas dos logs */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500">Total</p>
              <p className="font-medium text-white">{logs.length}</p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500">Erros</p>
              <p className="font-medium text-red-400">
                {logs.filter(l => l.level === 'ERROR').length}
              </p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500">Avisos</p>
              <p className="font-medium text-yellow-400">
                {logs.filter(l => l.level === 'WARN').length}
              </p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500">Filtrados</p>
              <p className="font-medium text-white">{filteredLogs.length}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}