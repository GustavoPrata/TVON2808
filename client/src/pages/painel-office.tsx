import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Settings, Plus, Pencil, Trash2, Shield, RefreshCw, GripVertical, Loader2, Sparkles, X, Download, Chrome, Play, Pause, Clock, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
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
import { ScrollArea } from '@/components/ui/scroll-area';

const systemSchema = z.object({
  username: z.string().min(1, 'Usuário obrigatório'),
  password: z.string().min(1, 'Senha obrigatória'),
  maxPontosAtivos: z.number().optional(),
});

type SystemForm = z.infer<typeof systemSchema>;

interface System {
  system_id: string;
  username: string;
  password: string;
  maxPontosAtivos?: number;
  pontosAtivos?: number;
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
          data-testid={`drag-system-${system.system_id}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </TableCell>
      <TableCell className="text-slate-300 font-mono">{system.system_id}</TableCell>
      <TableCell className="text-slate-300">{system.username}</TableCell>
      <TableCell className="text-slate-300 font-mono">{system.password}</TableCell>
      <TableCell className="text-slate-300 text-center">
        <span className={(system.pontosAtivos || 0) >= (system.maxPontosAtivos || 100) ? 'text-red-400' : 'text-green-400'}>
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
            data-testid={`edit-system-${system.system_id}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(system.system_id)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
            data-testid={`delete-system-${system.system_id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function PainelOffice() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSystem, setEditingSystem] = useState<System | null>(null);
  const [showSystemDialog, setShowSystemDialog] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [isGeneratingIPTV, setIsGeneratingIPTV] = useState(false);
  const [extensionConfig, setExtensionConfig] = useState({
    automationEnabled: false,
    quantityToGenerate: 10,
    intervalValue: 30,
    intervalUnit: 'minutes' as 'minutes' | 'hours'
  });
  const [recentCredentials, setRecentCredentials] = useState<Array<{
    id: number;
    username: string;
    password: string;
    generatedAt: string;
    source: string;
  }>>([]);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch systems
  const { data: systems = [], isLoading: loadingSystems, refetch: refetchSystems } = useQuery<System[]>({
    queryKey: ['/api/external-api/systems'],
  });

  // Fetch extension config
  const { data: configData } = useQuery<{ config: typeof extensionConfig }>({
    queryKey: ['/api/office/extension-config'],
  });

  // Fetch recent credentials
  const { data: credentialsData, refetch: refetchCredentials } = useQuery<{
    success: boolean;
    credentials: Array<{
      id: number;
      username: string;
      password: string;
      generatedAt: string;
      source: string;
    }>;
  }>({
    queryKey: ['/api/office/credentials-history'],
  });

  useEffect(() => {
    if (configData && configData.config) {
      setExtensionConfig(configData.config);
    }
  }, [configData]);

  useEffect(() => {
    if (credentialsData && credentialsData.credentials) {
      setRecentCredentials(credentialsData.credentials.slice(0, 5));
    }
  }, [credentialsData]);

  const systemForm = useForm<SystemForm>({
    resolver: zodResolver(systemSchema),
    defaultValues: {
      username: '',
      password: '',
      maxPontosAtivos: 100,
    },
  });

  // Create/Update system mutation
  const saveSystemMutation = useMutation({
    mutationFn: async (data: SystemForm & { system_id?: string }) => {
      const endpoint = data.system_id 
        ? `/api/external-api/systems/${data.system_id}`
        : '/api/external-api/systems';
      
      const method = data.system_id ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          maxPontosAtivos: data.maxPontosAtivos || 100,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar sistema');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: editingSystem ? "Sistema Atualizado" : "Sistema Criado",
        description: editingSystem 
          ? "O sistema foi atualizado com sucesso"
          : "O novo sistema foi criado com sucesso",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/external-api/systems'] });
      setShowSystemDialog(false);
      setEditingSystem(null);
      systemForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar sistema",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete system mutation
  const deleteSystemMutation = useMutation({
    mutationFn: async (system_id: string) => {
      const response = await fetch(`/api/external-api/systems/${system_id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar sistema');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sistema Removido",
        description: "O sistema foi removido com sucesso",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/external-api/systems'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover sistema",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reorder systems mutation
  const reorderSystemsMutation = useMutation({
    mutationFn: async (systemIds: string[]) => {
      const response = await fetch('/api/external-api/systems/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systems: systemIds }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao reordenar sistemas');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ordem Atualizada",
        description: "A ordem dos sistemas foi atualizada",
        variant: "default",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao reordenar",
        description: "Não foi possível atualizar a ordem dos sistemas",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/external-api/systems'] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = systems.findIndex((s: System) => s.system_id === active.id);
      const newIndex = systems.findIndex((s: System) => s.system_id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(systems, oldIndex, newIndex);
        queryClient.setQueryData<System[]>(['/api/external-api/systems'], newOrder);
        reorderSystemsMutation.mutate(newOrder.map((s: System) => s.system_id));
      }
    }
  };

  const openSystemDialog = (system?: System) => {
    if (system) {
      setEditingSystem(system);
      systemForm.reset({
        username: system.username,
        password: system.password,
        maxPontosAtivos: system.maxPontosAtivos || 100,
      });
    } else {
      setEditingSystem(null);
      systemForm.reset({
        username: '',
        password: '',
        maxPontosAtivos: 100,
      });
    }
    setShowSystemDialog(true);
  };

  // Intelligent paste handler for system dialog
  useEffect(() => {
    if (!showSystemDialog) return;

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const pastedText = e.clipboardData?.getData('text') || '';
      
      // Smart regex patterns to detect username and password in various formats
      // Supports variations like: USUÁRIO:, USUARIO:, USER:, USERNAME:, etc.
      // Now also captures values that may come in next line
      const userRegex = /(?:usu[aá]ri?o?|user(?:name)?|login)\s*[:=]?\s*([0-9A-Za-z]+)/i;
      const passRegex = /(?:senha|password|pass|pwd)\s*[:=]?\s*([0-9A-Za-z]+)/i;
      
      // Alternative pattern: if no labels, try to detect two values separated by space/newline
      const simplePattern = /^[\s]*([^\s]+)[\s]+([^\s]+)[\s]*$/;
      
      let username = '';
      let password = '';
      
      // Try to extract with labels first
      const userMatch = pastedText.match(userRegex);
      const passMatch = pastedText.match(passRegex);
      
      if (userMatch && passMatch) {
        username = userMatch[1].trim();
        password = passMatch[1].trim();
      } else {
        // Try simple pattern (two values)
        const simpleMatch = pastedText.match(simplePattern);
        if (simpleMatch) {
          username = simpleMatch[1];
          password = simpleMatch[2];
        } else {
          // If nothing matches, just paste into the focused field
          const activeElement = document.activeElement as HTMLInputElement;
          if (activeElement && activeElement.tagName === 'INPUT') {
            activeElement.value = pastedText.trim();
            return;
          }
        }
      }
      
      // If we extracted values, populate the form
      if (username || password) {
        if (username) {
          systemForm.setValue('username', username);
        }
        if (password) {
          systemForm.setValue('password', password);
        }
        
        // Show success toast
        toast({
          title: "Dados Detectados!",
          description: `Usuário: ${username || 'não detectado'} | Senha: ${password || 'não detectada'}`,
          variant: "default",
        });
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [showSystemDialog, systemForm, toast]);

  const handleSystemSubmit = (data: SystemForm) => {
    saveSystemMutation.mutate({
      ...data,
      system_id: editingSystem?.system_id,
    });
  };

  const confirmDeleteSystem = (system_id: string) => {
    setSystemToDelete(system_id);
  };

  const handleDeleteSystem = () => {
    if (systemToDelete) {
      deleteSystemMutation.mutate(systemToDelete);
      setSystemToDelete(null);
    }
  };

  const refreshIframe = () => {
    setIframeKey(prev => prev + 1);
    toast({
      title: "Recarregado",
      description: "O iframe foi recarregado",
      variant: "default",
    });
  };

  const downloadExtension = async () => {
    try {
      const response = await fetch('/api/office/download-extension');
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'onlineoffice-chrome-extension.tar.gz';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Download Iniciado",
          description: "A extensão Chrome está sendo baixada. Extraia o arquivo e siga as instruções de instalação.",
          variant: "default",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Erro no Download",
          description: error.message || "Não foi possível baixar a extensão",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro no Download",
        description: "Erro ao tentar baixar a extensão",
        variant: "destructive",
      });
    }
  };

  const totalSystems = systems.length;
  const activeSystems = systems.filter((s: System) => (s.pontosAtivos || 0) > 0).length;
  const fullSystems = systems.filter((s: System) => (s.pontosAtivos || 0) >= (s.maxPontosAtivos || 100)).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl p-4 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg shadow-purple-500/30">
              <Monitor className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Painel Office - IPTV
              </h1>
              <p className="text-xs text-slate-400">
                Gerenciamento de sistemas IPTV com interface visual
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-400">
              <Settings className="w-3 h-3 mr-1" />
              {totalSystems} sistemas
            </Badge>
            <Badge className="bg-green-500/20 text-green-400">
              <Shield className="w-3 h-3 mr-1" />
              {activeSystems} ativos
            </Badge>
            {fullSystems > 0 && (
              <Badge className="bg-red-500/20 text-red-400">
                <Sparkles className="w-3 h-3 mr-1" />
                {fullSystems} cheios
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
        {/* Top Section - Systems and OnlineOffice */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Side - Systems Management */}
          <Card className="bg-dark-card border-slate-700 flex flex-col" style={{ height: '500px' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" />
                  Sistemas IPTV
                </CardTitle>
                <CardDescription className="text-xs">
                  Gerencie os sistemas para criação de pontos
                </CardDescription>
              </div>
              <Button
                onClick={() => openSystemDialog()}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                size="sm"
                data-testid="button-add-system"
              >
                <Plus className="w-4 h-4 mr-1" />
                Novo Sistema
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 min-h-0">
            {loadingSystems ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : systems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Settings className="w-16 h-16 text-slate-600 mb-4" />
                <p className="text-slate-400 mb-2">Nenhum sistema cadastrado</p>
                <p className="text-xs text-slate-500 mb-4">Adicione um sistema para começar</p>
                <Button
                  onClick={() => openSystemDialog()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  size="sm"
                  data-testid="button-add-first-system"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar Primeiro Sistema
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={systems.map((s: System) => s.system_id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-transparent">
                          <TableHead className="text-slate-400 w-10"></TableHead>
                          <TableHead className="text-slate-400">ID</TableHead>
                          <TableHead className="text-slate-400">Usuário</TableHead>
                          <TableHead className="text-slate-400">Senha</TableHead>
                          <TableHead className="text-slate-400 text-center">Pontos</TableHead>
                          <TableHead className="text-slate-400 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systems.map((system: System) => (
                          <SortableRow
                            key={system.system_id}
                            system={system}
                            onEdit={openSystemDialog}
                            onDelete={confirmDeleteSystem}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </SortableContext>
                </DndContext>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

          {/* Right Side - OnlineOffice Iframe */}
          <Card className="bg-dark-card border-slate-700 flex flex-col" style={{ height: '500px' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-blue-400" />
                  OnlineOffice.zip
                </CardTitle>
                <CardDescription className="text-xs">
                  Interface visual para gerenciamento IPTV
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={downloadExtension}
                  variant="ghost"
                  size="sm"
                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                  data-testid="button-download-extension"
                  title="Baixar extensão Chrome"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  onClick={refreshIframe}
                  variant="ghost"
                  size="sm"
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                  data-testid="button-refresh-iframe"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
            <div className="h-full bg-black rounded-b-lg">
              <iframe
                key={iframeKey}
                src="https://onlineoffice.zip/#/dashboard"
                className="w-full h-full border-0 rounded-b-lg"
                title="OnlineOffice IPTV"
                data-testid="iframe-onlineoffice"
                id="office-iframe"
                onLoad={() => {
                  console.log('Iframe loaded - OnlineOffice Dashboard');
                }}
              />
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Bottom Section - Extension Configuration */}
        <Card className="bg-dark-card border-slate-700">
          <CardHeader className="pb-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Chrome className="w-5 h-5 text-green-400" />
                Configuração da Extensão Chrome
              </CardTitle>
              <CardDescription className="text-xs">
                Configure a automação de geração de credenciais IPTV
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Automation Controls - Left Column */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configuração da Automação
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Status da Automação</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={extensionConfig.automationEnabled ? "destructive" : "default"}
                        onClick={async () => {
                          const newEnabled = !extensionConfig.automationEnabled;
                          const newConfig = { ...extensionConfig, automationEnabled: newEnabled };
                          setExtensionConfig(newConfig);
                          
                          await fetch('/api/office/extension-config', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newConfig)
                          });
                          
                          toast({
                            title: newEnabled ? "Automação Ativada" : "Automação Desativada",
                            description: newEnabled 
                              ? `Gerando ${newConfig.quantityToGenerate} credenciais a cada ${newConfig.intervalValue} ${newConfig.intervalUnit}`
                              : "A geração automática foi parada",
                            variant: "default",
                          });
                        }}
                        className={extensionConfig.automationEnabled 
                          ? "bg-red-600 hover:bg-red-700" 
                          : "bg-green-600 hover:bg-green-700"}
                        data-testid="button-toggle-automation"
                      >
                        {extensionConfig.automationEnabled ? (
                          <><Pause className="w-4 h-4 mr-1" /> Parar</>
                        ) : (
                          <><Play className="w-4 h-4 mr-1" /> Iniciar</>
                        )}
                      </Button>
                      <Badge className={extensionConfig.automationEnabled 
                        ? "bg-green-500/20 text-green-400" 
                        : "bg-slate-500/20 text-slate-400"}>
                        {extensionConfig.automationEnabled ? "ON" : "OFF"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm flex items-center gap-1 mb-2">
                      <Users className="w-4 h-4" />
                      Quantidade por Lote
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={extensionConfig.quantityToGenerate}
                      onChange={(e) => setExtensionConfig({
                        ...extensionConfig,
                        quantityToGenerate: parseInt(e.target.value) || 10
                      })}
                      className="bg-slate-800 border-slate-700"
                      data-testid="input-quantity"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm flex items-center gap-1 mb-2">
                      <Clock className="w-4 h-4" />
                      Intervalo de Geração
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="60"
                        value={extensionConfig.intervalValue}
                        onChange={(e) => setExtensionConfig({
                          ...extensionConfig,
                          intervalValue: parseInt(e.target.value) || 30
                        })}
                        className="bg-slate-800 border-slate-700 flex-1"
                        data-testid="input-interval-value"
                      />
                      <select
                        value={extensionConfig.intervalUnit}
                        onChange={(e) => setExtensionConfig({
                          ...extensionConfig,
                          intervalUnit: e.target.value as 'minutes' | 'hours'
                        })}
                        className="bg-slate-800 border-slate-700 rounded px-3 text-sm"
                        data-testid="select-interval-unit"
                      >
                        <option value="minutes">Minutos</option>
                        <option value="hours">Horas</option>
                      </select>
                    </div>
                  </div>
                  
                  <Button
                    onClick={async () => {
                      await fetch('/api/office/extension-config', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(extensionConfig)
                      });
                      
                      toast({
                        title: "Configuração Salva",
                        description: "As configurações da extensão foram atualizadas",
                        variant: "default",
                      });
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    size="sm"
                    data-testid="button-save-config"
                  >
                    Salvar Configuração
                  </Button>
                </div>
              </div>
            </div>
              
            {/* Recent Credentials - Right Column */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Últimas Credenciais Geradas
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => refetchCredentials()}
                    className="text-blue-400 hover:text-blue-300"
                    data-testid="button-refresh-credentials"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </h3>
                
                {recentCredentials.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Nenhuma credencial gerada ainda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentCredentials.map((cred, index) => (
                      <div key={cred.id || index} className="p-2 bg-slate-900/50 rounded border border-slate-700/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-400">
                            {new Date(cred.generatedAt).toLocaleString('pt-BR')}
                          </span>
                          <Badge className="bg-green-500/20 text-green-400 text-xs">
                            {cred.source || 'extension'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500">Usuário:</span>
                            <p className="font-mono text-white">{cred.username}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Senha:</span>
                            <p className="font-mono text-white">{cred.password}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom System Modal - No overlay, allows interaction with iframe */}
      {showSystemDialog && (
        <div 
          className="fixed rounded-xl shadow-2xl p-6 max-w-md bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600/50"
          style={{
            left: '25%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 999,
            minWidth: '400px',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setShowSystemDialog(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 hover:bg-slate-700 p-1 transition-all"
          >
            <X className="h-4 w-4 text-slate-300" />
          </button>
          
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">
              {editingSystem ? '✏️ Editar Sistema' : '➕ Novo Sistema'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {editingSystem 
                ? `Editando sistema ID: ${editingSystem.system_id}`
                : 'Adicione um novo sistema IPTV'}
            </p>
          </div>
          
          <form onSubmit={systemForm.handleSubmit(handleSystemSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm">Usuário</Label>
              <Input
                id="username"
                {...systemForm.register('username')}
                placeholder="Digite o usuário do sistema"
                className="bg-slate-800 border-slate-700"
                data-testid="input-system-username"
              />
              {systemForm.formState.errors.username && (
                <p className="text-xs text-red-400">{systemForm.formState.errors.username.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">Senha</Label>
              <Input
                id="password"
                {...systemForm.register('password')}
                placeholder="Digite a senha do sistema"
                className="bg-slate-800 border-slate-700"
                data-testid="input-system-password"
              />
              {systemForm.formState.errors.password && (
                <p className="text-xs text-red-400">{systemForm.formState.errors.password.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxPontosAtivos" className="text-sm">Máximo de Pontos Ativos</Label>
              <Input
                id="maxPontosAtivos"
                type="number"
                {...systemForm.register('maxPontosAtivos', { valueAsNumber: true })}
                placeholder="100"
                className="bg-slate-800 border-slate-700"
                data-testid="input-system-max-pontos"
              />
              <p className="text-xs text-slate-500">Limite máximo de pontos que este sistema pode ter ativos</p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSystemDialog(false)}
                className="border-slate-700"
                data-testid="button-cancel-system"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saveSystemMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                data-testid="button-save-system"
              >
                {saveSystemMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    {editingSystem ? 'Salvar Alterações' : 'Criar Sistema'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!systemToDelete} onOpenChange={() => setSystemToDelete(null)}>
        <AlertDialogContent className="bg-dark-card border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Tem certeza que deseja remover este sistema? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-slate-700"
              data-testid="button-cancel-delete"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSystem}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              Remover Sistema
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}