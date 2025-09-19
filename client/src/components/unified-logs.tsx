import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, RefreshCw, Download, Trash2, Search, 
  FileText, Layers, Terminal, Filter, AlertCircle, Pause, Play
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

interface UnifiedLog {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  context?: any;
  traceId?: string | null;
  source: 'chrome-extension' | 'application';
  sourceLabel: string;
}

export function UnifiedLogsSection() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<UnifiedLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<UnifiedLog[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const lastFetchTime = useRef<Date | null>(null);
  const isInitialLoad = useRef(true);
  
  // Função para fazer merge inteligente dos logs
  const mergeLogs = useCallback((newLogs: UnifiedLog[], existingLogs: UnifiedLog[]) => {
    const logMap = new Map<string, UnifiedLog>();
    
    // Adicionar logs existentes ao Map
    existingLogs.forEach(log => {
      const key = `${log.timestamp}_${log.source}_${log.level}_${log.message}`;
      logMap.set(key, log);
    });
    
    // Adicionar ou atualizar com novos logs
    newLogs.forEach(log => {
      const key = `${log.timestamp}_${log.source}_${log.level}_${log.message}`;
      logMap.set(key, log);
    });
    
    // Converter de volta para array e ordenar por timestamp
    return Array.from(logMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 1000); // Limitar a 1000 logs
  }, []);

  // Função para buscar todos os logs
  const fetchAllLogs = async () => {
    try {
      if (isInitialLoad.current) {
        setIsLoadingLogs(true);
      }
      
      // Busca todos os logs do backend
      const params = new URLSearchParams();
      if (levelFilter !== 'all') {
        params.append('level', levelFilter);
      }
      if (sourceFilter !== 'all') {
        params.append('source', sourceFilter);
      }
      params.append('limit', '1000'); // Busca até 1000 logs
      
      const response = await fetch(`/api/all-logs?${params}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLogs(prev => {
            // Se é a primeira vez ou se os logs foram limpos
            if (isInitialLoad.current || prev.length === 0 || (data.logs || []).length === 0) {
              isInitialLoad.current = false;
              return data.logs || [];
            }
            // Fazer merge inteligente
            return mergeLogs(data.logs || [], prev);
          });
          lastFetchTime.current = new Date();
        }
      } else {
        console.error('Erro ao buscar logs:', response.statusText);
      }
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      if (isInitialLoad.current) {
        toast({
          title: '❌ Erro',
          description: 'Não foi possível buscar os logs',
          variant: 'destructive'
        });
      }
    } finally {
      if (isInitialLoad.current) {
        setIsLoadingLogs(false);
        isInitialLoad.current = false;
      }
    }
  };

  // Função para filtrar logs
  const filterLogs = (logsToFilter: UnifiedLog[], level: string, source: string, search: string) => {
    let filtered = [...logsToFilter];
    
    if (level !== 'all') {
      filtered = filtered.filter(log => log.level === level);
    }
    
    if (source !== 'all') {
      filtered = filtered.filter(log => {
        if (source === 'chrome-extension') {
          return log.source === 'chrome-extension';
        } else if (source === 'application') {
          return log.source === 'application';
        }
        return true;
      });
    }
    
    if (search) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(log.context).toLowerCase().includes(search.toLowerCase()) ||
        (log.traceId && log.traceId.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    setFilteredLogs(filtered);
  };

  // Função para limpar todos os logs  
  const clearAllLogs = async () => {
    try {
      // Limpa logs da extensão
      await fetch('/api/extension/logs', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      // Por enquanto só limpa logs da extensão
      // TODO: Adicionar limpeza de logs da aplicação
      
      setLogs([]);
      setFilteredLogs([]);
      isInitialLoad.current = true;
      toast({
        title: '✅ Logs limpos',
        description: 'Os logs foram removidos',
      });
    } catch (error) {
      console.error('Erro ao limpar logs:', error);
      toast({
        title: '❌ Erro',
        description: 'Não foi possível limpar os logs',
        variant: 'destructive',
      });
    }
  };
  
  // Função para gerar key estável para cada log
  const getLogKey = (log: UnifiedLog, index: number) => {
    return `${log.timestamp}_${log.source}_${log.level}_${index}`;
  };
  
  // Função para formatar timestamp para horário brasileiro
  const formatTimestamp = (timestamp: string) => {
    try {
      if (!timestamp || isNaN(new Date(timestamp).getTime())) {
        return 'N/A';
      }
      // Converter para horário de Brasília (UTC-3)
      const date = toZonedTime(new Date(timestamp), 'America/Sao_Paulo');
      return format(date, 'HH:mm:ss.SSS', { locale: ptBR });
    } catch (e) {
      return 'N/A';
    }
  };

  // Função para baixar logs
  const downloadLogs = async () => {
    try {
      // Cria o conteúdo do arquivo com separação por fonte
      const content = filteredLogs.map(log => {
        const time = format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss');
        const context = log.context ? JSON.stringify(log.context) : '';
        const traceId = log.traceId ? ` [Trace: ${log.traceId}]` : '';
        return `[${time}] ${log.sourceLabel} [${log.level}] ${log.message}${traceId} ${context}`;
      }).join('\n');
      
      // Cria e baixa o arquivo
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
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
    fetchAllLogs(); // Busca inicial
    
    if (autoRefresh) {
      const interval = setInterval(fetchAllLogs, 3000); // A cada 3 segundos
      return () => clearInterval(interval);
    }
  }, [autoRefresh, levelFilter, sourceFilter]);

  // Filtrar logs quando mudar o filtro ou busca
  useEffect(() => {
    filterLogs(logs, levelFilter, sourceFilter, searchText);
  }, [logs, levelFilter, sourceFilter, searchText]);
  
  // Atualizar filterLogs para usar logs atualizado
  useEffect(() => {
    filterLogs(logs, levelFilter, sourceFilter, searchText);
  }, []);

  const getLogColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-400';
      case 'WARN': return 'text-yellow-400';
      case 'INFO': return 'text-blue-400';
      case 'DEBUG': return 'text-slate-400';
      default: return 'text-slate-300';
    }
  };

  const getSourceBadge = (source: string, sourceLabel: string) => {
    if (source === 'chrome-extension') {
      return (
        <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">
          {sourceLabel}
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-green-500/20 text-green-400 text-[10px]">
          {sourceLabel}
        </Badge>
      );
    }
  };

  return (
    <Card className="bg-dark-card border-slate-700">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Central de Logs Unificados
            </CardTitle>
            <CardDescription className="text-xs">
              Visualização completa de todos os logs da aplicação e extensão Chrome em tempo real
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant="outline"
              size="sm"
              className={`border-slate-700 ${autoRefresh ? 'text-green-400' : 'text-slate-400'}`}
              data-testid="button-auto-refresh-unified"
              title={autoRefresh ? 'Pausar atualização automática' : 'Ativar atualização automática'}
            >
              {autoRefresh ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={fetchAllLogs}
              variant="outline"
              size="sm"
              className="border-slate-700"
              disabled={isLoadingLogs}
              data-testid="button-refresh-unified"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={downloadLogs}
              variant="outline"
              size="sm"
              className="border-slate-700"
              data-testid="button-download-unified"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              onClick={clearAllLogs}
              variant="outline"
              size="sm"
              className="border-slate-700 text-red-400"
              data-testid="button-clear-unified"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Filtrar por fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🌐 Todas as Fontes</SelectItem>
                <SelectItem value="chrome-extension">🔧 Apenas Extensão</SelectItem>
                <SelectItem value="application">🚀 Apenas Aplicação</SelectItem>
              </SelectContent>
            </Select>
            
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
                data-testid="input-search-unified"
              />
            </div>
          </div>

          {/* Estatísticas rápidas */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500 text-xs">Total</p>
              <p className="font-medium text-white">{logs.length}</p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500 text-xs">Filtrados</p>
              <p className="font-medium text-white">{filteredLogs.length}</p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500 text-xs">Extensão</p>
              <p className="font-medium text-purple-400">
                {logs.filter(l => l.source === 'chrome-extension').length}
              </p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500 text-xs">Aplicação</p>
              <p className="font-medium text-green-400">
                {logs.filter(l => l.source === 'application').length}
              </p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500 text-xs">Erros</p>
              <p className="font-medium text-red-400">
                {logs.filter(l => l.level === 'ERROR').length}
              </p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded text-center">
              <p className="text-slate-500 text-xs">Avisos</p>
              <p className="font-medium text-yellow-400">
                {logs.filter(l => l.level === 'WARN').length}
              </p>
            </div>
          </div>

          {/* Área de logs */}
          <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700">
            {isLoadingLogs ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              </div>
            ) : filteredLogs.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-1 font-mono text-xs">
                  {filteredLogs.map((log, index) => {
                    const logKey = getLogKey(log, index);
                    return (
                      <div 
                        key={logKey}
                        className="p-2 hover:bg-slate-800/30 rounded transition-colors border-b border-slate-800/30"
                      >
                      <div className="flex items-start gap-2">
                        {getSourceBadge(log.source, log.sourceLabel)}
                        <Badge className={`text-[10px] ${
                          log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                          log.level === 'WARN' ? 'bg-yellow-500/20 text-yellow-400' :
                          log.level === 'INFO' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-600/20 text-slate-400'
                        }`}>
                          {log.level}
                        </Badge>
                        <span className="text-slate-500 text-[10px]" title="Horário de Brasília">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span className={`flex-1 ${getLogColor(log.level)}`}>
                          {log.message}
                        </span>
                      </div>
                      {log.traceId && (
                        <div className="ml-4 mt-1 text-[10px] text-slate-600">
                          Trace ID: {log.traceId}
                        </div>
                      )}
                      {log.context && Object.keys(log.context).length > 0 && (
                        <div className="ml-4 mt-1 text-slate-500 text-[10px] bg-slate-800/20 p-1 rounded">
                          <pre>{JSON.stringify(log.context, null, 2)}</pre>
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <Terminal className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-sm text-slate-400">Nenhum log disponível</p>
                <p className="text-xs text-slate-500 mt-1">
                  {searchText ? 'Tente ajustar os filtros de busca' : 'Os logs aparecerão aqui quando houver atividade'}
                </p>
              </div>
            )}
          </div>

          {/* Legenda */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500/20 rounded"></div>
                <span>Logs da Extensão Chrome</span>
              </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500/20 rounded"></div>
              <span>Logs da Aplicação</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500/20 rounded"></div>
              <span>Erros</span>
            </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500/20 rounded"></div>
                <span>Avisos</span>
              </div>
            </div>
            {lastFetchTime.current && (
              <span className="text-xs text-slate-400">
                Últ. atualização: {format(lastFetchTime.current, 'HH:mm:ss')}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}