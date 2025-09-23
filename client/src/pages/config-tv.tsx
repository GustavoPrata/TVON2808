import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tv, Settings, Server, Save, Plus, Pencil, Trash2, Link, Shield, CheckCircle, AlertCircle, GripVertical, Wifi, X, Key, TestTube, Users, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { SyncStatus } from '@/components/sync-status';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const redirectUrlSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  url: z.string().url({ message: 'URL inválida' }),
});

const systemSchema = z.object({
  username: z.string().min(1, 'Usuário obrigatório'),
  password: z.string().min(1, 'Senha obrigatória'),
  maxPontosAtivos: z.number().optional(),
});

const apiConfigSchema = z.object({
  baseUrl: z.string().url('URL base deve ser válida'),
  apiKey: z.string().min(1, 'Chave da API é obrigatória'),
});

type RedirectUrlForm = z.infer<typeof redirectUrlSchema>;
type SystemForm = z.infer<typeof systemSchema>;
type ApiConfigForm = z.infer<typeof apiConfigSchema>;

interface System {
  system_id: string;
  username: string;
  password: string;
  maxPontosAtivos?: number;
  pontosAtivos?: number;
}

interface RedirectUrl {
  id: number;
  nome: string;
  url: string;
  isPrincipal: boolean;
  ativo: boolean;
  criadoEm: string;
}

interface SortableRowProps {
  system: System;
  onEdit: (system: System) => void;
  onDelete: (system_id: string) => void;
}

function SortableRow({ system, onEdit, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: system.system_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className="hover:bg-slate-800/50">
      <TableCell className="text-slate-300 w-10">
        <button
          className="cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </TableCell>
      <TableCell className="text-slate-300 font-mono">{system.system_id}</TableCell>
      <TableCell className="text-slate-300">{system.username}</TableCell>
      <TableCell className="text-slate-300 font-mono">{system.password}</TableCell>
      <TableCell className="text-slate-300 text-center">
        <span className={system.pontosAtivos >= (system.maxPontosAtivos || 100) ? 'text-red-400' : 'text-green-400'}>
          {system.pontosAtivos || 0} / {system.maxPontosAtivos || 100}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(system)}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(system.system_id)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ConfigTV() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSystem, setEditingSystem] = useState<System | null>(null);
  const [showSystemDialog, setShowSystemDialog] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState<RedirectUrl | null>(null);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlToDelete, setUrlToDelete] = useState<number | null>(null);
  const [urlTestStatus, setUrlTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [isTestingApi, setIsTestingApi] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch redirect URLs
  const { data: redirectUrls = [], isLoading: loadingUrls } = useQuery({
    queryKey: ['/api/redirect-urls'],
  });

  // Fetch systems
  const { data: systems = [], isLoading: loadingSystems, refetch: refetchSystems } = useQuery({
    queryKey: ['/api/external-api/systems'],
  });

  // Fetch integrations for API config
  const { data: integracoes } = useQuery({
    queryKey: ['/api/integracoes'],
    queryFn: api.getIntegracoes,
  });
  
  const apiConfig = integracoes?.find(i => i.tipo === 'api_externa');

  const urlForm = useForm<RedirectUrlForm>({
    resolver: zodResolver(redirectUrlSchema),
    defaultValues: {
      nome: '',
      url: '',
    },
  });

  const systemForm = useForm<SystemForm>({
    resolver: zodResolver(systemSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const apiForm = useForm<ApiConfigForm>({
    resolver: zodResolver(apiConfigSchema),
    defaultValues: {
      baseUrl: '',
      apiKey: '',
    },
  });

  // Update form when apiConfig changes
  useEffect(() => {
    if (apiConfig) {
      apiForm.reset({
        baseUrl: apiConfig.configuracoes?.baseUrl || '',
        apiKey: apiConfig.configuracoes?.apiKey || '',
      });
    }
  }, [apiConfig]);

  // Create/Update URL mutation
  const saveUrlMutation = useMutation({
    mutationFn: async (data: RedirectUrlForm & { id?: number }) => {
      if (data.id) {
        return api.put(`/api/redirect-urls/${data.id}`, data);
      } else {
        return api.post('/api/redirect-urls', data);
      }
    },
    onSuccess: () => {
      toast({
        title: 'URL salva',
        description: editingUrl ? 'URL atualizada com sucesso' : 'URL criada com sucesso',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/redirect-urls'] });
      setShowUrlDialog(false);
      setEditingUrl(null);
      urlForm.reset();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar URL',
        variant: 'destructive',
      });
    },
  });

  // Delete URL mutation
  const deleteUrlMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/api/redirect-urls/${id}`);
    },
    onSuccess: () => {
      toast({
        title: 'URL removida',
        description: 'URL removida com sucesso',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/redirect-urls'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao remover URL',
        variant: 'destructive',
      });
    },
  });

  // Set principal URL mutation
  const setPrincipalMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.post(`/api/redirect-urls/${id}/set-principal`);
    },
    onSuccess: () => {
      toast({
        title: 'URL principal definida',
        description: 'URL definida como principal e sincronizada com a API',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/redirect-urls'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao definir URL principal',
        variant: 'destructive',
      });
    },
  });

  // Test URL mutation
  const testUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      setUrlTestStatus('testing');
      return api.post('/api/external-api/settings/test-url', { url });
    },
    onSuccess: (data) => {
      if (data.success) {
        setUrlTestStatus('success');
        toast({
          title: 'Host Acessível',
          description: data.message,
        });
      } else {
        setUrlTestStatus('error');
        toast({
          title: 'Host Inacessível',
          description: data.message,
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      setUrlTestStatus('error');
      toast({
        title: 'Erro',
        description: 'Erro ao testar URL',
        variant: 'destructive',
      });
    },
  });

  // Create/Update system mutation
  const saveSystemMutation = useMutation({
    mutationFn: async (data: SystemForm & { system_id?: string }) => {
      if (data.system_id) {
        return api.put(`/api/external-api/systems/${data.system_id}`, data);
      } else {
        return api.post('/api/external-api/systems', data);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Sistema salvo',
        description: editingSystem ? 'Sistema atualizado com sucesso' : 'Sistema criado com sucesso',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/external-api/systems'] });
      setShowSystemDialog(false);
      setEditingSystem(null);
      systemForm.reset();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar sistema',
        variant: 'destructive',
      });
    },
  });

  // Delete system mutation
  const deleteSystemMutation = useMutation({
    mutationFn: async (system_id: string) => {
      return api.delete(`/api/external-api/systems/${system_id}`);
    },
    onSuccess: () => {
      toast({
        title: 'Sistema removido',
        description: 'Sistema removido com sucesso',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/external-api/systems'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao remover sistema',
        variant: 'destructive',
      });
    },
  });

  // Configure API mutation
  const configureApiMutation = useMutation({
    mutationFn: (data: ApiConfigForm) => api.configureExternalApi(data),
    onSuccess: () => {
      toast({ title: 'Configuração da API salva com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/integracoes'] });
    },
    onError: () => {
      toast({ title: 'Erro ao salvar configuração da API', variant: 'destructive' });
    },
  });

  const handleTestApi = async () => {
    setIsTestingApi(true);
    try {
      const result = await api.testExternalApi();
      if (result.connected) {
        toast({ title: 'Conexão com API estabelecida com sucesso!' });
      } else {
        toast({ title: 'Falha na conexão com a API', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro ao testar conexão', variant: 'destructive' });
    } finally {
      setIsTestingApi(false);
    }
  };

  const onSubmitApi = (data: ApiConfigForm) => {
    configureApiMutation.mutate(data);
  };

  // Reorder systems mutation
  const reorderSystemsMutation = useMutation({
    mutationFn: async (newOrder: System[]) => {
      const response = await api.post('/api/external-api/systems/reorder', { systems: newOrder });
      return response;
    },
    onSuccess: (data) => {
      if (data.systems) {
        queryClient.setQueryData(['/api/external-api/systems'], data.systems);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/external-api/systems'] });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao reordenar sistemas',
        variant: 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/external-api/systems'] });
    },
  });

  const handleEditUrl = (url: RedirectUrl) => {
    setEditingUrl(url);
    urlForm.reset({
      nome: url.nome,
      url: url.url,
    });
    setShowUrlDialog(true);
  };

  const handleNewUrl = () => {
    setEditingUrl(null);
    urlForm.reset({
      nome: '',
      url: '',
    });
    setShowUrlDialog(true);
  };

  const handleSaveUrl = (data: RedirectUrlForm) => {
    saveUrlMutation.mutate({
      ...data,
      id: editingUrl?.id,
    });
  };

  const handleEditSystem = (system: System) => {
    setEditingSystem(system);
    systemForm.reset({
      username: system.username,
      password: system.password,
      maxPontosAtivos: system.maxPontosAtivos || 100,
    });
    setShowSystemDialog(true);
  };

  const handleNewSystem = () => {
    setEditingSystem(null);
    systemForm.reset({
      username: '',
      password: '',
      maxPontosAtivos: 100,
    });
    setShowSystemDialog(true);
  };

  const handleSaveSystem = (data: SystemForm) => {
    saveSystemMutation.mutate({
      ...data,
      system_id: editingSystem?.system_id,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id && systems) {
      const oldIndex = systems.findIndex((s) => s.system_id === active.id);
      const newIndex = systems.findIndex((s) => s.system_id === over?.id);

      const newOrder = arrayMove(systems, oldIndex, newIndex);
      // Renumber systems starting from 1
      const renumberedSystems = newOrder.map((system, index) => ({
        ...system,
        system_id: (index + 1).toString()
      }));
      
      reorderSystemsMutation.mutate(renumberedSystems);
    }
  };

  if (loadingUrls || loadingSystems) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="mb-4 md:mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl md:rounded-2xl p-4 md:p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Tv className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Config. TV
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                Configure as URLs e sistemas da sua TV
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-slate-900 border border-slate-700">
          <TabsTrigger value="settings" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white text-xs md:text-sm">
            <Settings className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Configurações</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
          <TabsTrigger value="systems" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-xs md:text-sm">
            <Server className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            Sistemas
          </TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white text-xs md:text-sm">
            <Key className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            Api
          </TabsTrigger>
          <TabsTrigger value="sync" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white text-xs md:text-sm">
            <CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Sincronização</span>
            <span className="sm:hidden">Sync</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-white text-lg md:text-xl flex items-center gap-2">
                    <Link className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                    URLs de Redirecionamento
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm text-slate-400">
                    Gerencie múltiplas URLs e defina qual será a principal
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleNewUrl}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-xs md:text-sm"
                >
                  <Plus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Nova URL
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {redirectUrls.length === 0 ? (
                <div className="text-center py-12">
                  <Link className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Nenhuma URL cadastrada</p>
                  <p className="text-slate-500 text-sm mt-2">Clique em "Nova URL" para adicionar sua primeira URL</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-700">
                      <TableHead className="text-slate-400">Nome</TableHead>
                      <TableHead className="text-slate-400">URL</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redirectUrls.map((url: RedirectUrl) => (
                      <TableRow key={url.id} className="hover:bg-slate-800/50 border-slate-700">
                        <TableCell className="text-slate-300">{url.nome}</TableCell>
                        <TableCell className="text-slate-300 font-mono text-sm">{url.url}</TableCell>
                        <TableCell>
                          {url.isPrincipal ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              Principal
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-600 text-slate-400">
                              Secundária
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {!url.isPrincipal && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPrincipalMutation.mutate(url.id)}
                                disabled={setPrincipalMutation.isPending}
                                className="text-green-400 hover:text-green-300 hover:bg-green-500/20"
                                title="Definir como principal"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const testUrl = url.url;
                                setUrlTestStatus('testing');
                                testUrlMutation.mutate(testUrl);
                              }}
                              disabled={testUrlMutation.isPending}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                              title="Testar conexão"
                            >
                              <Wifi className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditUrl(url)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setUrlToDelete(url.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {/* URL Test Status */}
              {urlTestStatus !== 'idle' && (
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                  urlTestStatus === 'testing' ? 'bg-blue-500/10 border border-blue-500/30' :
                  urlTestStatus === 'success' ? 'bg-green-500/10 border border-green-500/30' :
                  'bg-red-500/10 border border-red-500/30'
                }`}>
                  {urlTestStatus === 'testing' && (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      <span className="text-blue-400 text-sm">Testando conexão...</span>
                    </>
                  )}
                  {urlTestStatus === 'success' && (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 text-sm">Host acessível</span>
                    </>
                  )}
                  {urlTestStatus === 'error' && (
                    <>
                      <X className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 text-sm">Host inacessível</span>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="systems">
          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-white text-lg md:text-xl flex items-center gap-2">
                    <Shield className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                    Sistemas Cadastrados
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm text-slate-400">
                    Gerencie os sistemas de acesso
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => refetchSystems()}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-xs md:text-sm"
                    disabled={loadingSystems}
                    title="Atualizar lista de sistemas"
                    data-testid="button-refresh-systems"
                  >
                    <RefreshCw className={`w-3 h-3 md:w-4 md:h-4 ${loadingSystems ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    onClick={handleNewSystem}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-xs md:text-sm"
                  >
                    <Plus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                    Novo Sistema
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border border-slate-700">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-800/50 hover:bg-slate-800/50">
                        <TableHead className="text-white font-semibold w-10"></TableHead>
                        <TableHead className="text-white font-semibold">ID</TableHead>
                        <TableHead className="text-white font-semibold">Usuário</TableHead>
                        <TableHead className="text-white font-semibold">Senha</TableHead>
                        <TableHead className="text-white font-semibold text-center">Pontos</TableHead>
                        <TableHead className="text-white font-semibold text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {systems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                            Nenhum sistema cadastrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        <SortableContext
                          items={systems.map(s => s.system_id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {systems.map((system: System) => (
                            <SortableRow
                              key={system.system_id}
                              system={system}
                              onEdit={handleEditSystem}
                              onDelete={(id) => setSystemToDelete(id)}
                            />
                          ))}
                        </SortableContext>
                      )}
                    </TableBody>
                  </Table>
                </DndContext>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Status de Sincronização
              </CardTitle>
              <CardDescription className="text-slate-400">
                Verifique e sincronize dados entre o banco local e a API externa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SyncStatus />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-xl">
                <Server className="w-5 h-5 text-blue-400" />
                Configuração da API Externa
              </CardTitle>
              <CardDescription className="text-slate-400">
                Configure a conexão com a API externa do sistema de TV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={apiForm.handleSubmit(onSubmitApi)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="baseUrl" className="text-white font-medium flex items-center gap-2">
                    <Link className="w-4 h-4 text-blue-400" />
                    URL Base da API
                  </Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    {...apiForm.register('baseUrl')}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-400 focus:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.exemplo.com"
                  />
                  {apiForm.formState.errors.baseUrl && (
                    <p className="text-red-400 text-sm mt-1">
                      {apiForm.formState.errors.baseUrl.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-white font-medium flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-400" />
                    Chave da API
                  </Label>
                  <Input
                    id="apiKey"
                    type="text"
                    {...apiForm.register('apiKey')}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-400 focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="Sua chave de API"
                  />
                  {apiForm.formState.errors.apiKey && (
                    <p className="text-red-400 text-sm mt-1">
                      {apiForm.formState.errors.apiKey.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium">Status da API</span>
                  <Badge className={apiConfig?.ativo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                    {apiConfig?.ativo ? 'Configurado' : 'Não configurado'}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button 
                    type="button"
                    onClick={handleTestApi}
                    disabled={isTestingApi}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold shadow-lg shadow-yellow-500/30 transition-all hover:scale-105"
                  >
                    <TestTube className={`w-4 h-4 mr-2 ${isTestingApi ? 'animate-pulse' : ''}`} />
                    {isTestingApi ? 'Testando...' : 'Testar Conexão'}
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
                    disabled={configureApiMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configuração
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {apiConfig && apiConfig.ativo && (
            <Card className="bg-dark-card border-slate-600">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  API Configurada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">URL Base</p>
                    <p className="text-white font-mono text-sm">{apiConfig.configuracoes?.baseUrl}</p>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">API Key</p>
                    <p className="text-white font-mono text-sm">{'•'.repeat(apiConfig.configuracoes?.apiKey?.length || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Server className="w-5 h-5 text-indigo-400" />
                </div>
                Endpoints Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      Usuários
                    </h4>
                    <ul className="text-slate-400 space-y-2 font-mono text-sm">
                      <li className="flex items-center gap-2">
                        <span className="text-green-400 text-xs">GET</span>
                        /users/get
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-blue-400 text-xs">POST</span>
                        /users/adicionar
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-yellow-400 text-xs">PUT</span>
                        /users/editar/{`{id}`}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-red-400 text-xs">DELETE</span>
                        /users/apagar/{`{id}`}
                      </li>
                    </ul>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-indigo-400" />
                      Configurações
                    </h4>
                    <ul className="text-slate-400 space-y-2 font-mono text-sm">
                      <li className="flex items-center gap-2">
                        <span className="text-green-400 text-xs">GET</span>
                        /settings/get
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-blue-400 text-xs">POST</span>
                        /settings/adicionar
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-yellow-400 text-xs">PUT</span>
                        /settings/editar/{`{key}`}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-red-400 text-xs">DELETE</span>
                        /settings/apagar/{`{key}`}
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-dark-surface rounded-lg">
                  <h4 className="font-medium text-slate-300 mb-2">Autenticação</h4>
                  <p className="text-slate-400 text-sm">
                    Todas as requisições devem incluir o header:
                  </p>
                  <code className="text-xs bg-dark-card p-2 rounded mt-1 block">
                    Authorization: Bearer {`{api_key}`}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showSystemDialog} onOpenChange={setShowSystemDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingSystem ? 'Editar Sistema' : 'Novo Sistema'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingSystem ? 'Edite as informações do sistema' : 'Adicione um novo sistema de acesso'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={systemForm.handleSubmit(handleSaveSystem)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white">Usuário</Label>
              <Input
                id="username"
                placeholder="Digite o usuário"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                {...systemForm.register('username')}
              />
              {systemForm.formState.errors.username && (
                <p className="text-red-400 text-sm">{systemForm.formState.errors.username.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Senha</Label>
              <Input
                id="password"
                type="text"
                placeholder="Digite a senha"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                {...systemForm.register('password')}
              />
              {systemForm.formState.errors.password && (
                <p className="text-red-400 text-sm">{systemForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPontosAtivos" className="text-white">Limite de Pontos</Label>
              <Input
                id="maxPontosAtivos"
                type="number"
                placeholder="Digite o limite de pontos (padrão: 100)"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                {...systemForm.register('maxPontosAtivos', { valueAsNumber: true })}
              />
              {systemForm.formState.errors.maxPontosAtivos && (
                <p className="text-red-400 text-sm">{systemForm.formState.errors.maxPontosAtivos.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSystemDialog(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saveSystemMutation.isPending}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                {saveSystemMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!systemToDelete} onOpenChange={(open) => !open && setSystemToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Tem certeza que deseja remover este sistema? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => setSystemToDelete(null)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (systemToDelete) {
                  deleteSystemMutation.mutate(systemToDelete);
                  setSystemToDelete(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* URL Dialog */}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingUrl ? 'Editar URL' : 'Nova URL'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingUrl ? 'Edite as informações da URL' : 'Adicione uma nova URL de redirecionamento'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={urlForm.handleSubmit(handleSaveUrl)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-white">Nome</Label>
              <Input
                id="nome"
                placeholder="Ex: Servidor Principal"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                {...urlForm.register('nome')}
              />
              {urlForm.formState.errors.nome && (
                <p className="text-red-400 text-sm">{urlForm.formState.errors.nome.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="url" className="text-white">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="http://exemplo.com:80"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                {...urlForm.register('url')}
              />
              {urlForm.formState.errors.url && (
                <p className="text-red-400 text-sm">{urlForm.formState.errors.url.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUrlDialog(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saveUrlMutation.isPending}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                {saveUrlMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* URL Delete Alert */}
      <AlertDialog open={!!urlToDelete} onOpenChange={(open) => !open && setUrlToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Tem certeza que deseja remover esta URL? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => setUrlToDelete(null)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (urlToDelete) {
                  deleteUrlMutation.mutate(urlToDelete);
                  setUrlToDelete(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}