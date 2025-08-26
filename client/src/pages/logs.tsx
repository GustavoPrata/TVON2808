import { useState } from 'react';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { FileText, Trash2, Eye, AlertCircle, Info, AlertTriangle, Search, Filter, Clock, Activity, Database, Layers, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { Log } from '@/types';

export default function Logs() {
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [logLimit, setLogLimit] = useState(100);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['/api/logs', logLimit],
    queryFn: () => api.getLogs(logLimit),
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  const clearLogsMutation = useMutation({
    mutationFn: api.clearLogs,
    onSuccess: () => {
      toast({ title: 'Logs limpos com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
    },
    onError: () => {
      toast({ title: 'Erro ao limpar logs', variant: 'destructive' });
    },
  });

  const filteredLogs = logs?.filter(log => {
    const matchesLevel = filterLevel === 'all' || log.nivel === filterLevel;
    const matchesSearch = !searchTerm || 
      log.mensagem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.origem.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const getLevelBadge = (nivel: string) => {
    const variants = {
      info: 'bg-blue-500/20 text-blue-400',
      warn: 'bg-yellow-500/20 text-yellow-400',
      error: 'bg-red-500/20 text-red-400',
    };
    return variants[nivel as keyof typeof variants] || 'bg-gray-500/20 text-gray-400';
  };

  const getLevelIcon = (nivel: string) => {
    switch (nivel) {
      case 'info': return <Info className="w-4 h-4" />;
      case 'warn': return <AlertTriangle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR'),
      full: date.toLocaleString('pt-BR'),
    };
  };

  const handleClearLogs = () => {
    if (window.confirm('Tem certeza que deseja limpar todos os logs? Esta ação não pode ser desfeita.')) {
      clearLogsMutation.mutate();
    }
  };

  const getOrigemBadge = (origem: string) => {
    const colors = {
      'WhatsApp': 'bg-green-500/20 text-green-400',
      'PIX': 'bg-blue-500/20 text-blue-400',
      'API Externa': 'bg-purple-500/20 text-purple-400',
      'Notifications': 'bg-yellow-500/20 text-yellow-400',
      'Database': 'bg-orange-500/20 text-orange-400',
      'WhatsApp Bot': 'bg-cyan-500/20 text-cyan-400',
    };
    return colors[origem as keyof typeof colors] || 'bg-gray-500/20 text-gray-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Logs do Sistema
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Acompanhe as atividades do sistema
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64 bg-dark-surface border-slate-600"
            />
          </div>
          
          <div className="flex bg-dark-surface border border-slate-600 rounded-lg">
            <Button
              variant={filterLevel === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterLevel('all')}
              className="rounded-r-none"
            >
              <Filter className="w-4 h-4 mr-2" />
              Todos
            </Button>
            <Button
              variant={filterLevel === 'info' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterLevel('info')}
              className="rounded-none"
            >
              <Info className="w-4 h-4 mr-2" />
              Info
            </Button>
            <Button
              variant={filterLevel === 'warn' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterLevel('warn')}
              className="rounded-none"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Aviso
            </Button>
            <Button
              variant={filterLevel === 'error' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterLevel('error')}
              className="rounded-l-none"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Erro
            </Button>
          </div>

          <Select value={logLimit.toString()} onValueChange={(value) => setLogLimit(Number(value))}>
            <SelectTrigger className="w-32 bg-dark-surface border-slate-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 logs</SelectItem>
              <SelectItem value="100">100 logs</SelectItem>
              <SelectItem value="200">200 logs</SelectItem>
              <SelectItem value="500">500 logs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <FileText className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleClearLogs}
            disabled={clearLogsMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpar Logs
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <Card className="bg-dark-card border-slate-600">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-tv-border">
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Timestamp
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Nível
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Origem
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Mensagem
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs?.map((log) => {
                  const timestamp = formatTimestamp(log.timestamp);
                  
                  return (
                    <tr key={log.id} className="table-row hover-card">
                      <td className="table-cell">
                        <div className="font-mono text-sm">
                          <div className="text-slate-300">{timestamp.date}</div>
                          <div className="text-slate-400 text-xs">{timestamp.time}</div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <Badge className={getLevelBadge(log.nivel)}>
                          {getLevelIcon(log.nivel)}
                          <span className="ml-1 uppercase">{log.nivel}</span>
                        </Badge>
                      </td>
                      <td className="table-cell">
                        <Badge className={getOrigemBadge(log.origem)}>
                          {log.origem}
                        </Badge>
                      </td>
                      <td className="table-cell">
                        <div className="max-w-md">
                          <p className="text-sm text-slate-300 line-clamp-2">
                            {log.mensagem}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl bg-dark-card border-slate-600">
                            <DialogHeader>
                              <DialogTitle className="text-white flex items-center gap-2">
                                {getLevelIcon(log.nivel)}
                                Detalhes do Log
                              </DialogTitle>
                              <DialogDescription className="text-slate-400">
                                {timestamp.full}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-sm font-medium text-slate-300">Nível</Label>
                                  <Badge className={getLevelBadge(log.nivel)}>
                                    {getLevelIcon(log.nivel)}
                                    <span className="ml-1 uppercase">{log.nivel}</span>
                                  </Badge>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-slate-300">Origem</Label>
                                  <Badge className={getOrigemBadge(log.origem)}>
                                    {log.origem}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div>
                                <Label className="text-sm font-medium text-slate-300">Mensagem</Label>
                                <div className="mt-2 p-3 bg-dark-surface rounded-lg">
                                  <p className="text-sm text-slate-200">{log.mensagem}</p>
                                </div>
                              </div>
                              
                              {log.detalhes && (
                                <div>
                                  <Label className="text-sm font-medium text-slate-300">Detalhes</Label>
                                  <ScrollArea className="mt-2 h-40">
                                    <pre className="text-xs bg-dark-surface p-3 rounded-lg text-slate-300 overflow-x-auto">
                                      {typeof log.detalhes === 'string' 
                                        ? log.detalhes 
                                        : JSON.stringify(log.detalhes, null, 2)
                                      }
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {!filteredLogs?.length && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">
                  {searchTerm || filterLevel !== 'all' 
                    ? 'Nenhum log encontrado com os filtros aplicados' 
                    : 'Nenhum log encontrado'
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-dark-card border-slate-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total de Logs</p>
                <p className="text-2xl font-bold text-white">{filteredLogs?.length || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-slate-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Informações</p>
                <p className="text-2xl font-bold text-blue-400">
                  {filteredLogs?.filter(log => log.nivel === 'info').length || 0}
                </p>
              </div>
              <Info className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-slate-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Avisos</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {filteredLogs?.filter(log => log.nivel === 'warn').length || 0}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-slate-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Erros</p>
                <p className="text-2xl font-bold text-red-400">
                  {filteredLogs?.filter(log => log.nivel === 'error').length || 0}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
