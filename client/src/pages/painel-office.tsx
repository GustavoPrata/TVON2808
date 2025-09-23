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
import { Monitor, Settings, Plus, Pencil, Trash2, Shield, RefreshCw, GripVertical, Loader2, Sparkles, X, Chrome, Play, Pause, Clock, Users, Activity, Zap, History, CheckCircle, Wifi, WifiOff, Timer, TrendingUp, Calendar, AlertTriangle, CalendarClock, ToggleLeft, ToggleRight, AlertCircle, ArrowUpDown, Server, User, Key, CheckCircle2, XCircle, AlertTriangle as AlertIcon, FileText, Download, Filter, Search, Trash, Eye, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { format, parseISO, differenceInDays, differenceInHours, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
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
import { RenewalQueueSection } from '@/components/renewal-queue-logs';
import { ExtensionStatusIndicator } from '@/components/extension-status-indicator';

const systemSchema = z.object({
  username: z.string().min(1, 'Usuário obrigatório'),
  password: z.string().min(1, 'Senha obrigatória'),
  maxPontosAtivos: z.number().optional(),
  expiration: z.string().optional(),
  autoRenewalEnabled: z.boolean().optional(),
  renewalAdvanceTime: z.number().optional(),
});

type SystemForm = z.infer<typeof systemSchema>;

interface System {
  system_id: string;
  username: string;
  password: string;
  maxPontosAtivos?: number;
  pontosAtivos?: number;
  expiration?: string;
  expiracao?: string; // Campo vindo do banco local
  autoRenewalEnabled?: boolean;
  renewalAdvanceTime?: number;
  status?: string;
  lastRenewalAt?: string;
  renewalCount?: number;
  nota?: string; // Campo opcional para descrição
}

interface SortableRowProps {
  system: System;
  onEdit: (system: System) => void;
  onDelete: (system_id: string) => void;
  refetchSystems: () => void;
}

function SortableRow({ system, onEdit, onDelete, refetchSystems }: SortableRowProps) {
  const { toast } = useToast();
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

  // Formatar data de expiração usando timezone de Brasília
  const formatExpiration = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return null;
      // Converter UTC para timezone de Brasília e formatar
      return formatInTimeZone(date, 'America/Sao_Paulo', "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return null;
    }
  };

  // Calcular status da expiração
  const getExpirationStatus = (dateStr?: string) => {
    if (!dateStr) return 'unknown';
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return 'unknown';
      const diffHours = differenceInHours(date, new Date());
      
      if (diffHours < 0) return 'expired';
      if (diffHours <= 1) return 'warning';
      return 'ok';
    } catch {
      return 'unknown';
    }
  };

  const expirationDate = system.expiration || system.expiracao;
  const expirationStatus = getExpirationStatus(expirationDate);
  const formattedExpiration = formatExpiration(expirationDate);

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
      <TableCell className="text-slate-300 w-20 text-center">
        <Badge variant="outline" className="text-xs">{system.system_id}</Badge>
      </TableCell>
      <TableCell className="text-slate-300">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-slate-400" />
          <div>
            <div className="font-medium">
              {system.username || `Sistema ${system.system_id}`}
            </div>
            {system.nota && (
              <div className="text-xs text-slate-500">{system.nota}</div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-slate-300">
        <div className="flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-xs">{system.password}</span>
        </div>
      </TableCell>
      <TableCell className="text-slate-300">
        {formattedExpiration ? (
          <div className="flex items-center gap-2">
            {expirationStatus === 'expired' && (
              <>
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">{formattedExpiration}</span>
              </>
            )}
            {expirationStatus === 'warning' && (
              <>
                <AlertIcon className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm">{formattedExpiration}</span>
              </>
            )}
            {expirationStatus === 'ok' && (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm">{formattedExpiration}</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Sem data definida</span>
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="relative">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-slate-400" />
              <span 
                className={`font-medium ${
                  (system.pontosAtivos || 0) >= (system.maxPontosAtivos || 100) 
                    ? 'text-red-400' 
                    : (system.pontosAtivos || 0) >= ((system.maxPontosAtivos || 100) * 0.8)
                    ? 'text-yellow-400'
                    : 'text-green-400'
                }`}
              >
                {system.pontosAtivos || 0} / {system.maxPontosAtivos || 100}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1">
              <div 
                className={`h-1.5 rounded-full transition-all ${
                  (system.pontosAtivos || 0) >= (system.maxPontosAtivos || 100) 
                    ? 'bg-red-500' 
                    : (system.pontosAtivos || 0) >= ((system.maxPontosAtivos || 100) * 0.8)
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, ((system.pontosAtivos || 0) / (system.maxPontosAtivos || 100)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
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

// Funções auxiliares para formatar data/hora com timezone de Brasília
const formatDateTimeBrasil = (dateStr: string | Date) => {
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    if (!isValid(date)) return 'Data inválida';
    
    // Formatar com timezone de Brasília (DD/MM/YYYY HH:mm:ss)
    return formatInTimeZone(date, 'America/Sao_Paulo', "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
};

const formatDateTimeShortBrasil = (dateStr: string | Date) => {
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    if (!isValid(date)) return 'Data inválida';
    
    // Formatar com timezone de Brasília (DD/MM HH:mm)
    return formatInTimeZone(date, 'America/Sao_Paulo', "dd/MM HH:mm", { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
};

export default function PainelOffice() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSystem, setEditingSystem] = useState<System | null>(null);
  const [showSystemDialog, setShowSystemDialog] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState<string | null>(null);
  const [isGeneratingIPTV, setIsGeneratingIPTV] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Estado removido - usando automationConfig.isEnabled diretamente
  const [automationConfig, setAutomationConfig] = useState({
    isEnabled: false,
    singleGeneration: false,
    lastRunAt: null as Date | null,
    totalGenerated: 0,
    sessionGenerated: 0,
    renewalAdvanceTime: 60
  });
  const [isToggling, setIsToggling] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentCredentials, setRecentCredentials] = useState<Array<{
    id: number;
    username: string;
    password: string;
    generatedAt: string;
    source: string;
    sistemaId: number | null;
  }>>([]);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<{ id: number; username: string } | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch systems
  const { data: systemsRaw = [], isLoading: loadingSystems, refetch: refetchSystems } = useQuery<System[]>({
    queryKey: ['/api/external-api/systems'],
  });

  // Sort systems by system_id (numerical order)
  const systems = [...systemsRaw].sort((a, b) => {
    const idA = parseInt(a.system_id) || 0;
    const idB = parseInt(b.system_id) || 0;
    
    return sortOrder === 'asc' ? idA - idB : idB - idA;
  });

  // Fetch automation config from backend
  const { data: configData, refetch: refetchConfig } = useQuery<any>({
    queryKey: ['/api/office/automation/config'],
    refetchInterval: 5000, // Poll every 5 seconds
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
      sistemaId: number | null;
    }>;
  }>({
    queryKey: ['/api/office/automation/credentials'],
    refetchInterval: 10000, // Poll every 10 seconds
  });

  useEffect(() => {
    if (configData) {
      setAutomationConfig(prev => ({
        isEnabled: configData.isEnabled || false,
        singleGeneration: configData.singleGeneration || false,
        lastRunAt: configData.lastRunAt ? new Date(configData.lastRunAt) : null,
        totalGenerated: configData.totalGenerated || 0,
        sessionGenerated: configData.sessionGenerated || prev.sessionGenerated || 0,
        renewalAdvanceTime: configData.renewalAdvanceTime || 60
      }));
    }
  }, [configData]);

  useEffect(() => {
    if (credentialsData && credentialsData.credentials) {
      setRecentCredentials(credentialsData.credentials || []);
    }
  }, [credentialsData]);

  // Atualizar o timer a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  // Delete credential mutation
  const deleteCredentialMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/office/automation/credentials/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar credencial');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/office/automation/credentials'] });
      toast({
        title: "✅ Credencial Removida",
        description: "A credencial foi removida com sucesso",
        variant: "default",
      });
      setCredentialToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro ao deletar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete all credentials mutation
  const deleteAllCredentialsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/office/automation/credentials', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar todas as credenciais');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/office/automation/credentials'] });
      toast({
        title: "✅ Todas as Credenciais Removidas",
        description: "Todas as credenciais foram removidas com sucesso",
        variant: "default",
      });
      setShowDeleteAllDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro ao deletar",
        description: error.message,
        variant: "destructive",
      });
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

  const handleDeleteCredential = () => {
    if (credentialToDelete) {
      deleteCredentialMutation.mutate(credentialToDelete.id);
    }
  };

  const handleDeleteAllCredentials = () => {
    deleteAllCredentialsMutation.mutate();
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
            <ExtensionStatusIndicator />
            <Button
              variant={automationConfig.isEnabled ? "destructive" : "default"}
              size="sm"
              onClick={async () => {
                setIsToggling(true);
                try {
                  const res = await fetch('/api/office/automation/config', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      isEnabled: !automationConfig.isEnabled,
                      renewalAdvanceTime: automationConfig.renewalAdvanceTime
                    })
                  });
                  
                  if (res.ok) {
                    toast({
                      title: !automationConfig.isEnabled 
                        ? "🔄 Renovação automática ATIVADA" 
                        : "⏹️ Renovação automática DESATIVADA",
                      description: !automationConfig.isEnabled 
                        ? "O sistema renovará automaticamente os sistemas IPTV"
                        : "A renovação automática foi desabilitada",
                      variant: "default",
                    });
                    refetchConfig();
                  }
                } catch (error) {
                  toast({
                    title: "❌ Erro",
                    description: "Falha ao alterar status da renovação automática",
                    variant: "destructive",
                  });
                } finally {
                  setIsToggling(false);
                }
              }}
              disabled={isToggling}
              className={automationConfig.isEnabled ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              data-testid="button-global-renewal"
            >
              {isToggling ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Aguarde...</>
              ) : automationConfig.isEnabled ? (
                <><ToggleRight className="w-4 h-4 mr-1" /> Renovação Ativada</>
              ) : (
                <><ToggleLeft className="w-4 h-4 mr-1" /> Renovação Desativada</>
              )}
            </Button>
            
            {fullSystems > 0 && (
              <Badge className="bg-red-500/20 text-red-400">
                <Sparkles className="w-3 h-3 mr-1" />
                {fullSystems} cheios
              </Badge>
            )}
          </div>
        </div>
      </div>

      

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
        {/* Systems Management Table */}
        <Card className="bg-dark-card border-slate-700 flex flex-col">
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
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    refetchSystems();
                    toast({
                      title: "🔄 Atualizando Sistemas",
                      description: "Recarregando informações dos sistemas...",
                      duration: 2000,
                    });
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-blue-400 hover:text-blue-300"
                  title="Recarregar sistemas e atualizar vencimentos"
                  data-testid="button-refresh-systems"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => {
                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-slate-300"
                  title={`Ordenar por ID do sistema (${sortOrder === 'asc' ? 'crescente' : 'decrescente'})`}
                  data-testid="button-sort-expiration"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
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
                          <TableHead className="text-slate-400 w-20 text-center">ID</TableHead>
                          <TableHead className="text-slate-400">
                            <div className="flex items-center gap-2">
                              <Server className="w-4 h-4" />
                              Sistema
                            </div>
                          </TableHead>
                          <TableHead className="text-slate-400">
                            <div className="flex items-center gap-2">
                              <Key className="w-4 h-4" />
                              Senha
                            </div>
                          </TableHead>
                          <TableHead className="text-slate-400">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              Validade
                            </div>
                          </TableHead>
                          <TableHead className="text-slate-400 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Users className="w-4 h-4" />
                              Pontos Ativos
                            </div>
                          </TableHead>
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
                            refetchSystems={refetchSystems}
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

        {/* Extension Configuration */}
        <Card className="bg-dark-card border-slate-700">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Chrome className="w-5 h-5 text-green-400" />
                  Configuração da Extensão Chrome
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure a automação de geração de credenciais IPTV
                </CardDescription>
              </div>
              <a
                href="/chrome-extension.zip"
                download="chrome-extension.zip"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl text-sm"
              >
                <Chrome className="h-4 w-4" />
                Baixar Extensão Autônoma
              </a>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Automation Controls - Left Column */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configurações de Renovação Automática
                </h3>
                
                <div className="space-y-4">
                  
                  {/* Status de Renovação */}
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        {automationConfig.isEnabled ? (
                          <Wifi className="w-4 h-4 text-green-400" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-red-400" />
                        )}
                        Status da Renovação Automática
                      </Label>
                      <Badge className={automationConfig.isEnabled 
                        ? "bg-green-500/20 text-green-400 animate-pulse" 
                        : "bg-red-500/20 text-red-400"}>
                        {automationConfig.isEnabled ? "ATIVADA" : "DESATIVADA"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400">
                      {automationConfig.isEnabled 
                        ? "O sistema está verificando e renovando sistemas automaticamente"
                        : "A renovação automática está desabilitada"}
                    </p>
                  </div>
                  
                  {/* Configuration Fields */}
                  <div>
                    <Label className="text-sm flex items-center gap-1 mb-2">
                      <Timer className="w-4 h-4" />
                      Renovação Antes do Vencimento (minutos)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="10080"
                      value={automationConfig.renewalAdvanceTime || 60}
                      onChange={(e) => setAutomationConfig(prev => ({ ...prev, renewalAdvanceTime: parseInt(e.target.value) || 60 }))}
                      placeholder="Ex: 60 = 1 hora antes"
                      className="bg-slate-800 border-slate-700"
                      data-testid="input-renewal-time"
                    />
                    <p className="text-xs text-slate-500 mt-1">0 = Desabilitado | Digite o tempo em minutos</p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        const res = await fetch('/api/office/automation/config', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            renewalAdvanceTime: automationConfig.renewalAdvanceTime
                          })
                        });
                        
                        if (res.ok) {
                          toast({
                            title: "Configuração Salva",
                            description: "Parâmetros de automação atualizados com sucesso",
                            variant: "default",
                          });
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      size="sm"
                      data-testid="button-save-config"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Salvar Config
                    </Button>
                  </div>
                </div>
              </div>
            </div>
              
            {/* Recent Credentials - Right Column */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Credenciais Geradas
                    {recentCredentials.length > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-blue-500/20 text-blue-300">
                        {recentCredentials.length} total
                      </Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => refetchCredentials()}
                      className="text-blue-400 hover:text-blue-300"
                      data-testid="button-refresh-credentials"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                    {recentCredentials.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowDeleteAllDialog(true)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        data-testid="button-delete-all-credentials"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </h3>
                
                {recentCredentials.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Nenhuma credencial gerada ainda
                  </p>
                ) : (
                  <ScrollArea className="h-[400px] w-full rounded-md">
                    <div className="space-y-2 pr-4">
                      {recentCredentials.map((cred, index) => (
                        <div key={cred.id || index} className="p-2 bg-slate-900/50 rounded border border-slate-700/50 group hover:border-slate-600 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-400">
                              #{recentCredentials.length - index} • {formatDateTimeShortBrasil(cred.generatedAt)}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-500/20 text-green-400 text-xs">
                                {cred.source || 'extension'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCredentialToDelete({ id: cred.id, username: cred.username })}
                                className="p-0 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                data-testid={`button-delete-credential-${cred.id}`}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500">Usuário:</span>
                              <div className="flex items-center gap-1">
                                <p className="font-mono text-white">{cred.username}</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="p-0 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => {
                                    navigator.clipboard.writeText(cred.username);
                                    toast({
                                      title: "✅ Copiado!",
                                      description: `Usuário ${cred.username} copiado`,
                                      duration: 2000,
                                    });
                                  }}
                                  data-testid={`copy-username-${index}`}
                                >
                                  <Shield className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-500">Senha:</span>
                              <div className="flex items-center gap-1">
                                <p className="font-mono text-white">{cred.password}</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="p-0 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => {
                                    navigator.clipboard.writeText(cred.password);
                                    toast({
                                      title: "✅ Copiado!",
                                      description: `Senha copiada`,
                                      duration: 2000,
                                    });
                                  }}
                                  data-testid={`copy-password-${index}`}
                                >
                                  <Shield className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-500">Sistema:</span>
                              <div className="flex items-center gap-1">
                                <p className="font-mono text-white">{cred.sistemaId || 'N/A'}</p>
                                {cred.sistemaId && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="p-0 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      navigator.clipboard.writeText(String(cred.sistemaId));
                                      toast({
                                        title: "✅ Copiado!",
                                        description: `Sistema ID ${cred.sistemaId} copiado`,
                                        duration: 2000,
                                      });
                                    }}
                                    data-testid={`copy-system-${index}`}
                                  >
                                    <Shield className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Copy All Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full mt-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity h-6 bg-slate-800/50 hover:bg-slate-700/50"
                            onClick={() => {
                              const text = `Usuário: ${cred.username}\nSenha: ${cred.password}${cred.sistemaId ? `\nSistema: ${cred.sistemaId}` : ''}`;
                              navigator.clipboard.writeText(text);
                              toast({
                                title: "✅ Credencial Copiada!",
                                description: "Usuário e senha copiados",
                                duration: 2000,
                              });
                            }}
                            data-testid={`copy-all-${index}`}
                          >
                            Copiar Tudo
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </div>
          </CardContent>
        </Card>

        {/* Renewal Queue Section */}
        <RenewalQueueSection />
      </div>

      {/* Custom System Modal */}
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
            
            <div className="space-y-2">
              <Label htmlFor="expiration" className="text-sm">Validade</Label>
              <Input
                id="expiration"
                type="date"
                {...systemForm.register('expiration')}
                className="bg-slate-800 border-slate-700"
                data-testid="input-system-expiration"
                defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
              />
              <p className="text-xs text-slate-500">Data de validade do sistema (padrão: 30 dias)</p>
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

      {/* Delete Credential Confirmation Dialog */}
      <AlertDialog open={!!credentialToDelete} onOpenChange={() => setCredentialToDelete(null)}>
        <AlertDialogContent className="bg-dark-card border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Tem certeza que deseja remover a credencial de <span className="font-semibold">{credentialToDelete?.username}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-slate-700"
              data-testid="button-cancel-delete-credential"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCredential}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-credential"
            >
              Deletar Credencial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Credentials Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent className="bg-dark-card border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Deletar Todas as Credenciais</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              <span className="text-red-400 font-semibold">Atenção!</span> Esta ação irá remover permanentemente todas as {recentCredentials.length} credenciais armazenadas. Esta operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-slate-700"
              data-testid="button-cancel-delete-all"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllCredentials}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-all"
            >
              Deletar Todas as Credenciais
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}