import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Loader2, RefreshCw, Trash2, Search, 
  FileText, Layers, Terminal, Filter, AlertCircle, Pause, Play,
  ChevronLeft, ChevronRight, AlertTriangle
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
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(100);
  const [viewMode, setViewMode] = useState<'scroll' | 'paginated'>('scroll');
  const lastFetchTime = useRef<Date | null>(null);
  const isInitialLoad = useRef(true);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;
  const retryDelay = 2000;
  
  // Função para fazer merge inteligente dos logs
  const mergeLogs = useCallback((newLogs: UnifiedLog[], existingLogs: UnifiedLog[]) => {
    // Usar um Map para rastrear todos os logs únicos
    const allLogs = new Map<string, UnifiedLog>();
    let duplicateCount = 0;
    let uniqueCounter = 0;
    
    // Debug: Ver exemplo de logs que estão chegando
    if (newLogs.length > 0) {
      console.log('[UnifiedLogs] Exemplo de novo log:', {
        timestamp: newLogs[0].timestamp,
        source: newLogs[0].source,
        level: newLogs[0].level,
        message: newLogs[0].message.substring(0, 100),
        sourceLabel: newLogs[0].sourceLabel
      });
    }
    
    // Adicionar todos os logs existentes primeiro
    existingLogs.forEach((log, index) => {
      // Criar chave única baseada em todos os campos relevantes
      // Adicionar um contador único se necessário para garantir que não perdemos logs
      const baseKey = `${log.timestamp}|${log.source}|${log.level}|${log.message}`;
      let key = baseKey;
      
      // Se a chave já existe, adicionar um contador para torná-la única
      while (allLogs.has(key)) {
        uniqueCounter++;
        key = `${baseKey}|${uniqueCounter}`;
      }
      
      allLogs.set(key, log);
    });
    
    // Adicionar novos logs, preservando todos eles
    newLogs.forEach((log, index) => {
      // Criar chave base
      const baseKey = `${log.timestamp}|${log.source}|${log.level}|${log.message}`;
      
      // Verificar se é uma duplicata real (exatamente o mesmo log)
      if (allLogs.has(baseKey)) {
        // É uma duplicata, atualizar com a versão mais recente
        allLogs.set(baseKey, log);
        duplicateCount++;
      } else {
        // Não é duplicata, adicionar como novo log
        let key = baseKey;
        
        // Se por algum motivo a chave já existe (não deveria), torná-la única
        while (allLogs.has(key)) {
          uniqueCounter++;
          key = `${baseKey}|${uniqueCounter}`;
        }
        
        allLogs.set(key, log);
      }
    });
    
    // Converter de volta para array e ordenar por timestamp
    const mergedLogs = Array.from(allLogs.values())
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        
        // Mais recente primeiro
        if (timeB !== timeA) {
          return timeB - timeA;
        }
        
        // Se timestamps iguais, aplicação antes de extensão
        if (a.source !== b.source) {
          return a.source === 'application' ? -1 : 1;
        }
        
        // Se ainda iguais, ordenar por nível
        const levelOrder: Record<string, number> = { 'ERROR': 4, 'WARN': 3, 'INFO': 2, 'DEBUG': 1 };
        return (levelOrder[b.level] || 0) - (levelOrder[a.level] || 0);
      })
      .slice(0, 1000); // Limitar a 1000 logs
    
    // Log detalhado para debug
    console.log('[UnifiedLogs] Merge detalhado:', {
      existingCount: existingLogs.length,
      newCount: newLogs.length,
      duplicatesReplacedCount: duplicateCount,
      totalUniqueKeys: allLogs.size,
      finalCount: mergedLogs.length,
      droppedDueToLimit: Math.max(0, allLogs.size - 1000)
    });
    
    // Se estamos perdendo muitos logs, avisar
    if (allLogs.size > 10 && mergedLogs.length < allLogs.size / 2) {
      console.warn('[UnifiedLogs] AVISO: Muitos logs sendo perdidos!', {
        esperado: allLogs.size,
        obtido: mergedLogs.length
      });
    }
    
    return mergedLogs;
  }, []);

  // Função para limpar timeout de retry
  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  // Função para buscar todos os logs com retry automático
  const fetchAllLogs = async (isRetry = false) => {
    try {
      if (isInitialLoad.current || isRetry) {
        setIsLoadingLogs(true);
      }
      
      // Clear error on successful attempt start
      if (isRetry) {
        setError(null);
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
        console.log('[UnifiedLogs] Dados recebidos:', {
          success: data.success,
          logsCount: (data.logs || []).length,
          isInitialLoad: isInitialLoad.current
        });
        
        if (data.success) {
          const newLogs = data.logs || [];
          
          setLogs(prev => {
            // Se é a primeira vez carregando ou logs foram limpos
            if (isInitialLoad.current || prev.length === 0) {
              console.log('[UnifiedLogs] Primeira carga ou logs limpos, substituindo todos os logs');
              isInitialLoad.current = false;
              return newLogs;
            }
            
            // Se não há novos logs, manter os existentes
            if (newLogs.length === 0) {
              console.log('[UnifiedLogs] Sem novos logs, mantendo existentes');
              return prev;
            }
            
            // Fazer merge inteligente
            console.log('[UnifiedLogs] Fazendo merge inteligente de logs');
            const mergedLogs = mergeLogs(newLogs, prev);
            console.log('[UnifiedLogs] Resultado do merge:', {
              previousCount: prev.length,
              newCount: newLogs.length,
              mergedCount: mergedLogs.length
            });
            return mergedLogs;
          });
          
          lastFetchTime.current = new Date();
          setRetryCount(0); // Reset retry count on success
          setError(null);
          clearRetryTimeout();
        } else {
          console.log('[UnifiedLogs] Resposta sem sucesso:', data);
        }
      } else {
        const errorMsg = response.status === 500 ? 'Erro no servidor' : 
                         response.status === 404 ? 'Endpoint não encontrado' :
                         `Erro HTTP ${response.status}`;
        throw new Error(`${errorMsg}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar logs';
      setError(errorMessage);
      
      // Implement retry logic with exponential backoff
      if (retryCount < maxRetries) {
        const nextRetryCount = retryCount + 1;
        setRetryCount(nextRetryCount);
        const nextRetryIn = retryDelay * Math.pow(2, retryCount); // Exponential backoff
        
        if (!isRetry) {
          toast({
            title: '⚠️ Erro ao buscar logs',
            description: `Tentando novamente em ${nextRetryIn / 1000}s... (Tentativa ${nextRetryCount}/${maxRetries})`,
            variant: 'default'
          });
        }
        
        clearRetryTimeout();
        retryTimeoutRef.current = setTimeout(() => {
          fetchAllLogs(true);
        }, nextRetryIn);
      } else if (retryCount >= maxRetries && !isRetry) {
        toast({
          title: '❌ Erro persistente',
          description: 'Não foi possível buscar os logs após múltiplas tentativas. Clique em "Tentar Novamente" para reiniciar.',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoadingLogs(false);
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
    }
  };

  // Função manual de retry
  const handleManualRetry = () => {
    setRetryCount(0);
    setError(null);
    clearRetryTimeout();
    fetchAllLogs();
  };

  // Função para filtrar logs
  const filterLogs = (logsToFilter: UnifiedLog[], level: string, source: string, search: string) => {
    let filtered = [...logsToFilter];
    
    // Filtrar logs vazios ou sem conteúdo relevante no frontend também
    filtered = filtered.filter(log => {
      // Remove logs sem mensagem ou com mensagem vazia
      if (!log.message || log.message.trim() === '') {
        return false;
      }
      
      // Remove logs genéricos sem informação útil
      const genericMessages = ['aplicação', 'application', 'log', 'info', 'debug', 'trace'];
      const lowerMessage = log.message.toLowerCase().trim();
      
      // Se a mensagem é apenas uma palavra genérica, remove
      if (genericMessages.includes(lowerMessage)) {
        return false;
      }
      
      // Se é DEBUG, só incluir se explicitamente selecionado
      if (log.level === 'DEBUG' && level !== 'DEBUG') {
        return false;
      }
      
      return true;
    });
    
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


  // Auto-refresh
  useEffect(() => {
    console.log('[UnifiedLogs] Iniciando busca de logs, filtros:', {
      levelFilter,
      sourceFilter,
      autoRefresh
    });
    fetchAllLogs(); // Busca inicial
    
    let interval: NodeJS.Timeout | undefined;
    if (autoRefresh) {
      interval = setInterval(() => {
        // Only fetch if not in error state or if retry count is reset
        if (!error || retryCount === 0) {
          fetchAllLogs();
        }
      }, 3000); // A cada 3 segundos
    }
    
    return () => {
      if (interval) clearInterval(interval);
      clearRetryTimeout();
    };
  }, [autoRefresh, levelFilter, sourceFilter]);

  // Filtrar logs quando mudar o filtro ou busca
  useEffect(() => {
    console.log('[UnifiedLogs] Aplicando filtros:', {
      totalLogs: logs.length,
      levelFilter,
      sourceFilter,
      searchText
    });
    filterLogs(logs, levelFilter, sourceFilter, searchText);
    setCurrentPage(1); // Reset to first page when filters change
  }, [logs, levelFilter, sourceFilter, searchText]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => clearRetryTimeout();
  }, []);
  
  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = viewMode === 'paginated' 
    ? filteredLogs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage)
    : filteredLogs;
    
  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-2">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-2">
          <Skeleton className="w-16 h-4" />
          <Skeleton className="w-12 h-4" />
          <Skeleton className="w-20 h-4" />
          <Skeleton className="flex-1 h-4" />
        </div>
      ))}
    </div>
  );

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
              onClick={() => fetchAllLogs()}
              variant="outline"
              size="sm"
              className="border-slate-700"
              disabled={isLoadingLogs}
              data-testid="button-refresh-unified"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
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

          {/* View mode toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Modo de visualização:</span>
              <Button
                size="sm"
                variant={viewMode === 'scroll' ? 'default' : 'outline'}
                onClick={() => setViewMode('scroll')}
                className="h-7 text-xs"
                data-testid="button-view-scroll"
              >
                Rolagem
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'paginated' ? 'default' : 'outline'}
                onClick={() => setViewMode('paginated')}
                className="h-7 text-xs"
                data-testid="button-view-paginated"
              >
                Paginado
              </Button>
            </div>
            {viewMode === 'paginated' && filteredLogs.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-7 w-7 p-0"
                  data-testid="button-page-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-400">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 p-0"
                  data-testid="button-page-next"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="bg-red-950/20 border-red-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro ao carregar logs</AlertTitle>
              <AlertDescription className="mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{error}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleManualRetry}
                    className="ml-4"
                    data-testid="button-retry-manual"
                  >
                    Tentar Novamente
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Área de logs */}
          <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700">
            {isLoadingLogs ? (
              <div className="h-[400px]">
                <LoadingSkeleton />
              </div>
            ) : error && logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
                <p className="text-sm text-slate-400 mb-1">Erro ao carregar logs</p>
                <p className="text-xs text-slate-500 mb-3">{error}</p>
                <Button
                  size="sm"
                  onClick={handleManualRetry}
                  className="mt-2"
                  data-testid="button-retry-error"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Tentar Novamente
                </Button>
              </div>
            ) : paginatedLogs.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-1 font-mono text-xs">
                  {paginatedLogs.map((log, index) => {
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
                <Terminal className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-sm text-slate-400 mb-1">Nenhum log disponível</p>
                <p className="text-xs text-slate-500 mb-3">
                  {searchText ? 'Tente ajustar os filtros de busca' : 
                   levelFilter !== 'all' || sourceFilter !== 'all' ? 'Tente remover alguns filtros' :
                   'Os logs aparecerão aqui quando houver atividade'}
                </p>
                {(searchText || levelFilter !== 'all' || sourceFilter !== 'all') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchText('');
                      setLevelFilter('all');
                      setSourceFilter('all');
                    }}
                    className="text-xs"
                    data-testid="button-clear-filters"
                  >
                    Limpar Filtros
                  </Button>
                )}
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
            <div className="flex items-center gap-2">
              {lastFetchTime.current && (
                <span className="text-xs text-slate-400">
                  Últ. atualização: {format(lastFetchTime.current, 'HH:mm:ss')}
                </span>
              )}
              {isLoadingLogs && (
                <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
              )}
              {retryCount > 0 && (
                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                  Reconectando... {retryCount}/{maxRetries}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}