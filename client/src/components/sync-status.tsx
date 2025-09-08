import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, Database, Cloud, CheckCircle2, XCircle, AlertTriangle, Users, Shield, ArrowRight, AlertCircle, Server } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Sistema {
  id?: number;
  systemId: string;
  username: string;
  password: string;
  pontosAtivos?: number;
  maxPontosAtivos?: number;
  source: 'local' | 'api' | 'both';
  status?: 'ok' | 'divergent' | 'missing';
}

interface Ponto {
  id?: number;
  apiUserId?: number;
  usuario: string;
  cliente: string;
  sistemaId?: number;
  vencimento?: string;
  status: string;
  source: 'local' | 'api' | 'both';
  syncStatus?: 'ok' | 'divergent' | 'missing';
}

export function SyncStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncingType, setSyncingType] = useState<'systems' | 'config' | 'users' | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Get sync status and detailed comparison data
  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['/api/sync/status'],
    queryFn: api.getSyncStatus,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Get detailed sync comparison
  const { data: syncDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['/api/sync/details'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/sync/details');
        if (!response.ok) throw new Error('Failed to fetch sync details');
        return response.json();
      } catch (error) {
        console.error('Error fetching sync details:', error);
        return null;
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Sync systems mutation
  const syncSystemsMutation = useMutation({
    mutationFn: api.syncSystems,
    onMutate: () => setSyncingType('systems'),
    onSuccess: (data) => {
      toast({
        title: 'Sistemas sincronizados',
        description: `${data.synced} sistemas sincronizados com sucesso`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/external-api/systems'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao sincronizar sistemas',
        variant: 'destructive',
      });
    },
    onSettled: () => setSyncingType(null),
  });

  // Sync users/pontos mutation
  const syncUsersMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sync/users', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to sync users');
      return response.json();
    },
    onMutate: () => setSyncingType('users'),
    onSuccess: (data) => {
      toast({
        title: 'Usuários sincronizados',
        description: `${data.synced || 0} usuários sincronizados com sucesso`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/details'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao sincronizar usuários',
        variant: 'destructive',
      });
    },
    onSettled: () => setSyncingType(null),
  });

  // Sync config mutation
  const syncConfigMutation = useMutation({
    mutationFn: api.syncApiConfig,
    onMutate: () => setSyncingType('config'),
    onSuccess: () => {
      toast({
        title: 'Configuração sincronizada',
        description: 'Configuração da API sincronizada com sucesso',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/status'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao sincronizar configuração',
        variant: 'destructive',
      });
    },
    onSettled: () => setSyncingType(null),
  });

  const isAnySyncing = syncingType !== null;

  if (isLoading || isLoadingDetails) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!syncStatus) {
    return (
      <div className="text-center py-8 text-slate-400">
        Erro ao carregar status de sincronização
      </div>
    );
  }

  const getSyncStatusBadge = () => {
    if (!syncStatus.apiConnected) {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
          <XCircle className="w-3 h-3 mr-1" />
          API Desconectada
        </Badge>
      );
    }

    if (syncStatus.inSync) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Sincronizado
        </Badge>
      );
    }

    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Desatualizado
      </Badge>
    );
  };

  const getSystemStatus = (system: Sistema) => {
    if (system.status === 'ok') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">OK</Badge>;
    }
    if (system.status === 'divergent') {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Divergente</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Faltando</Badge>;
  };

  const getUserStatus = (user: Ponto) => {
    if (user.syncStatus === 'ok') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Sincronizado</Badge>;
    }
    if (user.syncStatus === 'divergent') {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Divergente</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Não Sincronizado</Badge>;
  };

  return (
    <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="bg-slate-800 border-slate-700">
        <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
          Visão Geral
        </TabsTrigger>
        <TabsTrigger value="systems" className="data-[state=active]:bg-slate-700">
          Sistemas
        </TabsTrigger>
        <TabsTrigger value="users" className="data-[state=active]:bg-slate-700">
          Usuários
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {/* URLs Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">URL Principal (Banco)</span>
            </div>
            <code className="text-xs bg-slate-900 px-2 py-1 rounded text-blue-300 block truncate">
              {syncStatus.localUrl || 'Nenhuma URL configurada'}
            </code>
          </div>
          
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">URL Redirect (API Externa)</span>
            </div>
            <code className="text-xs bg-slate-900 px-2 py-1 rounded text-purple-300 block truncate">
              {syncStatus.apiRedirectUrl || 'Nenhuma URL configurada na API'}
            </code>
            {syncStatus.localUrl && syncStatus.apiRedirectUrl && syncStatus.localUrl !== syncStatus.apiRedirectUrl && (
              <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                URLs diferentes
              </div>
            )}
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-slate-400">Banco Local</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Usuários:</span>
                <span className="text-lg font-bold text-white">{syncStatus.localUsersCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Sistemas:</span>
                <span className="text-lg font-bold text-white">{syncStatus.localSystemsCount || 0}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Cloud className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-slate-400">API Externa</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Usuários:</span>
                <span className="text-lg font-bold text-white">
                  {syncStatus.apiConnected ? (syncStatus.apiUsersCount || 0) : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Sistemas:</span>
                <span className="text-lg font-bold text-white">
                  {syncStatus.apiConnected ? (syncStatus.apiSystemsCount || 0) : '-'}
                </span>
              </div>
            </div>
            {!syncStatus.apiConnected && (
              <p className="text-xs text-red-400 mt-2">Desconectado</p>
            )}
          </div>
        </div>

        {/* Sync Status Badge */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-400">Status de Sincronização</span>
              <p className="text-xs text-slate-500 mt-1">
                {syncStatus.lastSync 
                  ? `Última sync: ${format(new Date(syncStatus.lastSync), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
                  : 'Nunca sincronizado'
                }
              </p>
            </div>
            {getSyncStatusBadge()}
          </div>
        </div>

        {/* Sync Actions */}
        <div className="flex flex-col gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h3 className="text-sm font-medium text-white mb-2">Ações de Sincronização</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Button
                onClick={() => syncSystemsMutation.mutate()}
                disabled={!syncStatus.apiConnected || isAnySyncing}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              >
                {syncingType === 'systems' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Sincronizar Sistemas
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-400">
                Sincroniza sistemas entre banco local e API
              </p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => syncUsersMutation.mutate()}
                disabled={!syncStatus.apiConnected || isAnySyncing}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                {syncingType === 'users' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Sincronizar Usuários
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-400">
                Sincroniza usuários (pontos) entre banco e API
              </p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => syncConfigMutation.mutate()}
                disabled={!syncStatus.apiConnected || isAnySyncing}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                {syncingType === 'config' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sincronizar Configurações
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-400">
                Sincroniza configurações gerais da API
              </p>
            </div>
          </div>
        </div>

        {/* Sync Details */}
        {!syncStatus.apiConnected && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400">
                API externa não está conectada. Configure a API na aba Integrações para habilitar a sincronização.
              </p>
            </div>
          </div>
        )}

        {syncStatus.apiConnected && !syncStatus.inSync && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <p className="text-yellow-400">
                Os dados locais estão desatualizados. Execute a sincronização para atualizar.
              </p>
            </div>
          </div>
        )}

        {syncStatus.apiConnected && syncStatus.inSync && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <p className="text-green-400">
                Todos os dados estão sincronizados entre o banco local e a API externa.
              </p>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="systems" className="space-y-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Comparação de Sistemas</CardTitle>
            <CardDescription className="text-slate-400">
              Visualize sistemas no banco local e na API externa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {syncDetails?.systems && syncDetails.systems.hasDivergence && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <p className="text-yellow-400 text-sm">
                    Existem divergências entre o banco local e a API
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => syncSystemsMutation.mutate()}
                  disabled={isAnySyncing}
                  className="bg-yellow-500 hover:bg-yellow-600"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar Agora
                </Button>
              </div>
            )}
            
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-white">Sistema ID</TableHead>
                  <TableHead className="text-white">Usuário</TableHead>
                  <TableHead className="text-white">Origem</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                  <TableHead className="text-white text-center">Pontos Ativos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncDetails?.systems?.items?.map((system: Sistema, index: number) => (
                  <TableRow key={system.systemId + index} className="border-slate-700">
                    <TableCell className="text-slate-300">{system.systemId}</TableCell>
                    <TableCell className="text-slate-300">{system.username}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {system.source === 'local' && (
                          <>
                            <Database className="w-4 h-4 text-blue-400" />
                            <span className="text-blue-400 text-sm">Local</span>
                          </>
                        )}
                        {system.source === 'api' && (
                          <>
                            <Cloud className="w-4 h-4 text-purple-400" />
                            <span className="text-purple-400 text-sm">API</span>
                          </>
                        )}
                        {system.source === 'both' && (
                          <>
                            <Database className="w-4 h-4 text-green-400" />
                            <ArrowRight className="w-3 h-3 text-green-400" />
                            <Cloud className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 text-sm">Ambos</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getSystemStatus(system)}</TableCell>
                    <TableCell className="text-center text-slate-300">
                      {system.pontosAtivos !== undefined ? `${system.pontosAtivos}/${system.maxPontosAtivos || 100}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="users" className="space-y-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Comparação de Usuários</CardTitle>
            <CardDescription className="text-slate-400">
              Visualize pontos/usuários no banco local e na API externa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {syncDetails?.users && syncDetails.users.hasDivergence && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <p className="text-yellow-400 text-sm">
                    Existem divergências entre usuários locais e da API
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => syncUsersMutation.mutate()}
                  disabled={isAnySyncing}
                  className="bg-yellow-500 hover:bg-yellow-600"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar Agora
                </Button>
              </div>
            )}
            
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-white">Usuário</TableHead>
                  <TableHead className="text-white">Cliente</TableHead>
                  <TableHead className="text-white">Vencimento</TableHead>
                  <TableHead className="text-white">Origem</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncDetails?.users?.items?.map((user: Ponto, index: number) => (
                  <TableRow key={user.usuario + index} className="border-slate-700">
                    <TableCell className="text-slate-300">{user.usuario}</TableCell>
                    <TableCell className="text-slate-300">{user.cliente}</TableCell>
                    <TableCell className="text-slate-300">
                      {user.vencimento ? format(new Date(user.vencimento), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.source === 'local' && (
                          <>
                            <Database className="w-4 h-4 text-blue-400" />
                            <span className="text-blue-400 text-sm">Local</span>
                          </>
                        )}
                        {user.source === 'api' && (
                          <>
                            <Cloud className="w-4 h-4 text-purple-400" />
                            <span className="text-purple-400 text-sm">API</span>
                          </>
                        )}
                        {user.source === 'both' && (
                          <>
                            <Database className="w-4 h-4 text-green-400" />
                            <ArrowRight className="w-3 h-3 text-green-400" />
                            <Cloud className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 text-sm">Ambos</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getUserStatus(user)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}