import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Edit2, Save, X, Plus, Trash2, Calendar, Phone, CreditCard, User, Users, Monitor, Smartphone, Tv, CheckCircle, XCircle, AlertTriangle, DollarSign, Clock, Shield, Eye, EyeOff, Wifi, Key, CalendarDays, Copy, ExternalLink, Link as LinkIcon, FileText, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addMonths, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Cliente, Ponto } from '@/types';

interface EditingField {
  field: keyof Cliente;
  value: string;
}

interface FloatingImage {
  url: string;
  scale: number;
  position: { x: number; y: number };
}

export default function ClienteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [showCredentials, setShowCredentials] = useState<Record<number, boolean>>({});
  const [showAddPontoDialog, setShowAddPontoDialog] = useState(false);
  const [editingPonto, setEditingPonto] = useState<number | null>(null);
  const [editedPonto, setEditedPonto] = useState<any>({});
  const [floatingImage, setFloatingImage] = useState<FloatingImage | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const floatingRef = useRef<HTMLDivElement>(null);
  const [newPonto, setNewPonto] = useState({
    aplicativo: 'ibo_pro',
    dispositivo: 'smart_tv',
    usuario: '',
    senha: 'tvon1@',
    valor: '0',
    macAddress: '',
    deviceKey: '',
    descricao: '',
    expiracao: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    sistemaId: null as number | null
  });

  const { data: cliente, isLoading: isLoadingCliente } = useQuery({
    queryKey: ['/api/clientes', id],
    queryFn: () => api.getCliente(parseInt(id!)),
  });

  const { data: pontos = [], isLoading: isLoadingPontos } = useQuery({
    queryKey: ['/api/clientes', id, 'pontos'],
    queryFn: () => api.getPontos(parseInt(id!)),
  });

  const { data: sistemas = [] } = useQuery<any[]>({
    queryKey: ['/api/sistemas/disponiveis'],
  });

  const updateClienteMutation = useMutation({
    mutationFn: (data: Partial<Cliente>) => api.updateCliente(parseInt(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      toast({
        title: "Sucesso",
        description: "Informações atualizadas com sucesso!",
      });
      setEditingField(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar informações",
        variant: "destructive",
      });
    },
  });

  const createPontoMutation = useMutation({
    mutationFn: async (pontoData: any) => {
      const requestData = {
        ...pontoData,
        clienteId: parseInt(id!),
        expiracao: pontoData.expiracao ? new Date(pontoData.expiracao).toISOString() : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      console.log('=== CRIANDO PONTO ===');
      console.log('Dados enviados:', requestData);
      
      const response = await fetch('/api/pontos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      const responseText = await response.text();
      console.log('Status da resposta:', response.status);
      console.log('Resposta completa:', responseText);
      
      if (!response.ok) {
        let errorDetails;
        try {
          errorDetails = JSON.parse(responseText);
          console.error('Erro detalhado:', errorDetails);
        } catch {
          console.error('Erro (texto):', responseText);
        }
        throw new Error(errorDetails?.error || 'Erro ao criar ponto');
      }
      
      return JSON.parse(responseText);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes', id, 'pontos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes', id] });
      toast({
        title: "Sucesso",
        description: "Ponto criado com sucesso!",
      });
      setShowAddPontoDialog(false);
      setNewPonto({
        aplicativo: 'ibo_pro',
        dispositivo: 'smart_tv',
        usuario: '',
        senha: 'tvon1@',
        valor: '0',
        macAddress: '',
        deviceKey: '',
        descricao: '',
        expiracao: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
        sistemaId: null
      });
    },
    onError: (error: any) => {
      console.error('=== ERRO NA MUTAÇÃO ===', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao criar ponto",
        variant: "destructive",
      });
    },
  });

  const updatePontoMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return api.updatePonto(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes', id, 'pontos'] });
      toast({
        title: "Sucesso",
        description: "Ponto atualizado com sucesso!",
      });
      setEditingPonto(null);
      setEditedPonto({});
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar ponto",
        variant: "destructive",
      });
    },
  });

  const updatePonto = (data: any) => {
    const { id, ...updateData } = data;
    
    // Formata os dados mantendo apenas o que foi modificado
    const formattedData: any = {};
    
    if (updateData.usuario !== undefined) formattedData.usuario = updateData.usuario;
    if (updateData.senha !== undefined) formattedData.senha = updateData.senha;
    if (updateData.valor !== undefined) formattedData.valor = updateData.valor || '0';
    if (updateData.macAddress !== undefined) formattedData.macAddress = updateData.macAddress;
    if (updateData.deviceKey !== undefined) formattedData.deviceKey = updateData.deviceKey;
    if (updateData.expiracao !== undefined) {
      formattedData.expiracao = updateData.expiracao ? new Date(updateData.expiracao).toISOString() : null;
    }
    if (updateData.sistemaId !== undefined) formattedData.sistemaId = updateData.sistemaId;
    if (updateData.descricao !== undefined) formattedData.descricao = updateData.descricao;
    if (updateData.dispositivo !== undefined) formattedData.dispositivo = updateData.dispositivo;
    if (updateData.status !== undefined) formattedData.status = updateData.status;
    if (updateData.aplicativo !== undefined) formattedData.aplicativo = updateData.aplicativo;
    
    updatePontoMutation.mutate({ id, ...formattedData });
  };

  const deletePontoMutation = useMutation({
    mutationFn: async (pontoId: number) => {
      return api.deletePonto(pontoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes', id, 'pontos'] });
      toast({
        title: "Sucesso",
        description: "Ponto deletado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao deletar ponto",
        variant: "destructive",
      });
    },
  });

  const deleteClienteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/clientes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete cliente');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente deletado",
        description: "Cliente foi removido permanentemente do sistema.",
      });
      setLocation('/clientes');
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao deletar cliente",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (field: keyof Cliente, value: string) => {
    // Se estiver editando telefone, formata o valor inicial
    if (field === 'telefone') {
      setEditingField({ field, value: formatPhoneForEdit(value) });
    } else {
      setEditingField({ field, value });
    }
  };

  const handleSave = () => {
    if (editingField) {
      // Se estiver salvando telefone, remove a formatação e adiciona o código do país
      let valueToSave = editingField.value;
      if (editingField.field === 'telefone') {
        // Remove todos os caracteres não numéricos
        valueToSave = editingField.value.replace(/\D/g, '');
        // Adiciona o código do país "55" se ainda não tiver
        if (!valueToSave.startsWith('55')) {
          valueToSave = '55' + valueToSave;
        }
      }
      updateClienteMutation.mutate({ [editingField.field]: valueToSave });
    }
  };

  const handleCancel = () => {
    setEditingField(null);
  };

  const handleQuickDate = (days?: number, months?: number, years?: number) => {
    // Se não há data de vencimento, usa a data atual
    const baseDate = cliente?.vencimento ? new Date(cliente.vencimento) : new Date();
    let newDate = baseDate;
    
    if (days) newDate = addDays(newDate, days);
    if (months) newDate = addMonths(newDate, months);
    if (years) newDate = addYears(newDate, years);
    
    // Ajustar para 23:59:59 do dia
    newDate.setHours(23, 59, 59, 999);
    
    updateClienteMutation.mutate({ 
      vencimento: newDate.toISOString()
    });
  };

  const toggleCredentials = (pontoId: number) => {
    setShowCredentials(prev => ({ ...prev, [pontoId]: !prev[pontoId] }));
  };

  const formatMacAddress = (value: string) => {
    // Remove tudo que não for dígito ou letra hexadecimal
    const cleanValue = value.replace(/[^0-9a-fA-F]/g, '');
    
    // Adiciona os dois pontos a cada 2 caracteres
    let formatted = '';
    for (let i = 0; i < cleanValue.length && i < 12; i++) {
      if (i > 0 && i % 2 === 0) {
        formatted += ':';
      }
      formatted += cleanValue[i];
    }
    
    return formatted.toLowerCase();
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: `${label} copiado para a área de transferência`,
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao copiar para a área de transferência",
        variant: "destructive",
      });
    }
  };

  const getStreamingUrl = (aplicativo: string) => {
    switch (aplicativo) {
      case 'ibo_pro':
        return 'https://iboproapp.com/manage-playlists/list/';
      case 'ibo_player':
        return 'https://iboplayer.com/dashboard';
      case 'shamel':
        return 'https://shamel.tv';
      default:
        return '#';
    }
  };

  const generateM3ULink = (usuario: string, senha: string) => {
    return `http://tvonbr.fun/get.php?username=${usuario}&password=${senha}&type=m3u_plus&output=hls`;
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    
    // Remove country code if present
    let number = cleaned;
    if (cleaned.startsWith('55') && cleaned.length > 11) {
      number = cleaned.substring(2);
    }
    
    // Format as (xx) xxxxx-xxxx for 11 digits
    if (number.length === 11) {
      return `(${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
    }
    
    // Format as (xx) xxxx-xxxx for 10 digits
    if (number.length === 10) {
      return `(${number.slice(0, 2)}) ${number.slice(2, 6)}-${number.slice(6)}`;
    }
    
    return phone;
  };

  // Função para formatar telefone na edição (sem o +55)
  const formatPhoneForEdit = (value: string) => {
    // Remove tudo que não é número
    let phone = value.replace(/\D/g, '');
    
    // Remove o código do país (55) se existir
    if (phone.startsWith('55') && phone.length > 11) {
      phone = phone.substring(2);
    }
    
    // Limita a 11 dígitos
    if (phone.length > 11) {
      phone = phone.slice(0, 11);
    }
    
    // Aplica a formatação
    if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (phone.length === 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (phone.length > 6) {
      return phone.replace(/(\d{2})(\d{4,5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    } else if (phone.length > 2) {
      return phone.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    } else if (phone.length > 0) {
      return phone.replace(/(\d{0,2})/, '($1');
    }
    
    return phone;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      ativo: 'bg-green-500/20 text-green-400 border-green-500/50',
      inativo: 'bg-red-500/20 text-red-400 border-red-500/50',
      suspenso: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      cancelado: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-500/20 text-gray-400';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      ativo: CheckCircle,
      inativo: XCircle,
      suspenso: AlertTriangle,
      cancelado: XCircle,
    };
    return icons[status as keyof typeof icons] || XCircle;
  };

  const getDaysUntilExpiry = (vencimento: string) => {
    // Criar data de vencimento no timezone de São Paulo
    const expiryDate = new Date(vencimento);
    
    // Obter a data atual em São Paulo
    const nowSaoPaulo = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const today = new Date(nowSaoPaulo);
    
    // Zerar as horas para comparar apenas as datas
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryColor = (days: number) => {
    if (days <= 0) return 'text-red-400';
    if (days <= 5) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getDeviceIcon = (dispositivo: string) => {
    switch (dispositivo) {
      case 'smart_tv':
        return <Tv className="w-4 h-4" />;
      case 'tv_box':
        return <Monitor className="w-4 h-4" />;
      case 'celular':
        return <Smartphone className="w-4 h-4" />;
      case 'notebook':
        return <Monitor className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const getAppName = (aplicativo: string) => {
    switch (aplicativo) {
      case 'ibo_pro':
        return 'IBO Pro';
      case 'ibo_player':
        return 'IBO Player';
      case 'shamel':
        return 'Shamel';
      default:
        return aplicativo;
    }
  };

  // useEffect DEVE vir ANTES de qualquer return condicional para evitar erro de hooks
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && floatingImage) {
        setFloatingImage((prev) => prev ? {
          ...prev,
          position: {
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
          }
        } : null);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset.x, dragOffset.y]);

  if (isLoadingCliente || isLoadingPontos) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-slate-400">Carregando informações...</p>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <p className="text-xl text-slate-400">Cliente não encontrado</p>
        <Button
          onClick={() => setLocation('/clientes')}
          className="bg-primary hover:bg-primary/80"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para lista
        </Button>
      </div>
    );
  }

  const daysUntilExpiry = cliente.vencimento ? getDaysUntilExpiry(cliente.vencimento) : null;

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFloatingImage({
          url: event.target?.result as string,
          scale: 1,
          position: { x: 100, y: 100 }
        });
      };
      reader.readAsDataURL(imageFile);
    }
  };



  const handleMouseDown = (e: React.MouseEvent) => {
    if (floatingRef.current) {
      const rect = floatingRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const adjustScale = (delta: number) => {
    if (floatingImage) {
      const newScale = Math.max(0.1, Math.min(3, floatingImage.scale + delta));
      setFloatingImage({
        ...floatingImage,
        scale: newScale
      });
    }
  };

  return (
    <div className="space-y-6" onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Header Beautiful */}
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setLocation('/clientes')}
              className="bg-white/5 backdrop-blur-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Detalhes do Cliente
                </h1>
                <p className="text-sm text-slate-400 mt-1">Gerenciar informações e pontos de acesso</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cliente.status !== 'cancelado' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm('Tem certeza que deseja cancelar este cliente? Esta ação pode ser revertida alterando o status posteriormente.')) {
                    updateClienteMutation.mutate({ status: 'cancelado' });
                  }
                }}
                className="border-red-500/50 text-red-400 hover:bg-red-500/20"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar Cliente
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (confirm('⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nTem certeza que deseja DELETAR PERMANENTEMENTE este cliente?\n\nTodos os dados, pontos e histórico serão removidos do banco de dados.')) {
                  deleteClienteMutation.mutate();
                }
              }}
              className="border-red-600 text-red-500 hover:bg-red-600/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Deletar Cliente
            </Button>
          </div>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informações Principais */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700/50 pb-6">
            <CardTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
                <User className="w-7 h-7 text-white" />
              </div>
              Informações do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nome e Telefone */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Informações Principais</label>
              <div className="flex items-center gap-2">
                {editingField?.field === 'nome' || editingField?.field === 'telefone' ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={editingField.field === 'nome' ? editingField.value : cliente.nome}
                      onChange={(e) => editingField.field === 'nome' && setEditingField({ ...editingField, value: e.target.value })}
                      className="flex-1 bg-dark-bg border-slate-700"
                      placeholder="Nome"
                      autoFocus={editingField.field === 'nome'}
                    />
                    <Input
                      value={editingField.field === 'telefone' ? editingField.value : cliente.telefone}
                      onChange={(e) => {
                        if (editingField.field === 'telefone') {
                          const formatted = formatPhoneForEdit(e.target.value);
                          setEditingField({ ...editingField, value: formatted });
                        }
                      }}
                      className="w-48 bg-dark-bg border-slate-700"
                      placeholder="(00) 00000-0000"
                      autoFocus={editingField.field === 'telefone'}
                    />
                    <Button size="sm" onClick={handleSave} className="bg-green-500 hover:bg-green-600">
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancel}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="flex-1 p-3 rounded-lg bg-dark-bg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-lg">{cliente.nome}</span>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-4 h-4" />
                        <span className="font-medium">{formatPhoneNumber(cliente.telefone)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit('nome', cliente.nome)}
                        className="p-1 hover:bg-slate-700 rounded"
                      >
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleEdit('telefone', cliente.telefone)}
                        className="p-1 hover:bg-slate-700 rounded"
                      >
                        <Phone className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tipo e Status */}
            <div className="grid grid-cols-2 gap-4">
              {/* Tipo */}
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Tipo</label>
                <div className="flex items-center gap-2">
                  {editingField?.field === 'tipo' ? (
                    <>
                      <Select
                        value={editingField.value}
                        onValueChange={(value) => setEditingField({ ...editingField, value })}
                      >
                        <SelectTrigger className="flex-1 bg-dark-bg border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="familia">Família</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleSave} className="bg-green-500 hover:bg-green-600">
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancel}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <div 
                      onClick={() => handleEdit('tipo', cliente.tipo)}
                      className="flex-1 p-3 rounded-lg bg-dark-bg cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-slate-500" />
                        <span className="font-medium capitalize">{cliente.tipo}</span>
                      </div>
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Status</label>
                <div className="flex items-center gap-2">
                  {editingField?.field === 'status' ? (
                    <>
                      <Select
                        value={editingField.value}
                        onValueChange={(value) => setEditingField({ ...editingField, value })}
                      >
                        <SelectTrigger className="flex-1 bg-dark-bg border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                          <SelectItem value="suspenso">Suspenso</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleSave} className="bg-green-500 hover:bg-green-600">
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancel}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <div 
                      onClick={() => handleEdit('status', cliente.status)}
                      className="flex-1 p-3 rounded-lg bg-dark-bg cursor-pointer flex items-center justify-between"
                    >
                      <Badge className={cn("border", getStatusBadge(cliente.status))}>
                        {React.createElement(getStatusIcon(cliente.status), { className: "w-3 h-3 mr-1" })}
                        {cliente.status}
                      </Badge>
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Valor Total */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Valor Total Mensal</label>
              <div className="p-3 rounded-lg bg-dark-bg border border-slate-700">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span className="text-xl font-bold text-green-400">
                    R$ {pontos.reduce((total, ponto) => total + parseFloat((ponto as any).valor || '0'), 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Soma dos valores de todos os pontos
                </p>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Observações</label>
              <div className="flex items-start gap-2">
                {editingField?.field === 'observacoes' ? (
                  <>
                    <Textarea
                      value={editingField.value}
                      onChange={(e) => setEditingField({ ...editingField, value: e.target.value })}
                      className="flex-1 bg-dark-bg border-slate-700 min-h-[100px]"
                      autoFocus
                    />
                    <div className="flex flex-col gap-1">
                      <Button size="sm" onClick={handleSave} className="bg-green-500 hover:bg-green-600">
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancel}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div 
                    onClick={() => handleEdit('observacoes', cliente.observacoes || '')}
                    className="flex-1 p-3 rounded-lg bg-dark-bg hover:bg-slate-800 cursor-pointer transition-colors min-h-[80px] group"
                  >
                    <p className="text-slate-300">
                      {cliente.observacoes || 'Clique para adicionar observações...'}
                    </p>
                    <Edit2 className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 mt-2" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Vencimento */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b border-slate-700/50 pb-6">
            <CardTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg shadow-orange-500/30">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status do Vencimento */}
            {daysUntilExpiry !== null && (
              <div className={`p-4 rounded-lg border ${
                daysUntilExpiry <= 0 ? 'bg-red-500/10 border-red-500/50' : 
                daysUntilExpiry <= 5 ? 'bg-yellow-500/10 border-yellow-500/50' : 
                'bg-green-500/10 border-green-500/50'
              }`}>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${getExpiryColor(daysUntilExpiry)}`}>
                    {daysUntilExpiry <= 0 ? 'VENCIDO' : `${daysUntilExpiry} dias`}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {daysUntilExpiry <= 0 ? 'Pagamento pendente' : 'até o vencimento'}
                  </p>
                </div>
              </div>
            )}

            {/* Data de Vencimento */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Data de Vencimento</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-dark-bg border-slate-700",
                      !cliente.vencimento && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {cliente.vencimento ? (
                      format(new Date(cliente.vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-dark-surface border-slate-700" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={cliente.vencimento ? new Date(cliente.vencimento) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        // Ajustar para 23:59:59 do dia
                        date.setHours(23, 59, 59, 999);
                        updateClienteMutation.mutate({ 
                          vencimento: date.toISOString()
                        });
                      }
                    }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Botões Rápidos */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Ações Rápidas</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickDate(30)}
                  className="bg-dark-bg border-slate-700"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  30 dias
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickDate(0, 3)}
                  className="bg-dark-bg border-slate-700"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  3 meses
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickDate(0, 6)}
                  className="bg-dark-bg border-slate-700"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  6 meses
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickDate(0, 0, 1)}
                  className="bg-dark-bg border-slate-700"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  1 ano
                </Button>
              </div>
            </div>

            {/* Data de Cadastro */}
            <div className="pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400">Cadastrado em</p>
              <p className="font-medium">
                {format(new Date(cliente.dataCadastro), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pontos de Acesso */}
      <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700/50 pb-8">
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
                  <Wifi className="w-7 h-7 text-white" />
                </div>
                Pontos de Acesso
              </CardTitle>
              <p className="text-sm text-slate-300 ml-14">
                {pontos.length} {pontos.length === 1 ? 'dispositivo conectado' : 'dispositivos conectados'}
              </p>
            </div>
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-6 shadow-lg shadow-blue-500/30 transition-all hover:shadow-blue-500/50 hover:scale-105"
              onClick={() => {
                // Gera o nome de usuário baseado no primeiro nome + número do ponto
                const firstName = cliente?.nome.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') || 'usuario';
                const pontoNumber = pontos.length + 1;
                // Generate random 5-digit ID
                const randomId = Math.floor(10000 + Math.random() * 90000);
                const username = `${randomId}${firstName}${pontoNumber}`;
                
                // Find first available system
                const availableSystem = sistemas.find((s: any) => !s.pontosAtivos || s.pontosAtivos < (s.maxPontosAtivos || 100));
                
                setNewPonto({
                  aplicativo: 'ibo_pro',
                  dispositivo: 'smart_tv',
                  usuario: username,
                  senha: 'tvon1@',
                  valor: '0',
                  macAddress: '',
                  deviceKey: '',
                  descricao: '',
                  expiracao: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
                  sistemaId: availableSystem?.id || null
                });
                setShowAddPontoDialog(true);
              }}
            >
              <Plus className="w-5 h-5 mr-2" />
              Novo Ponto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {pontos.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
              {pontos.map((ponto) => (
                <div 
                  key={ponto.id} 
                  className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl relative"
                >

                  
                  {/* Gradient Header */}
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 border-b border-slate-700/50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg shadow-blue-500/30">
                          {React.cloneElement(getDeviceIcon(ponto.dispositivo), { className: "w-5 h-5 text-white" })}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-lg capitalize text-white">
                              {ponto.dispositivo.replace('_', ' ')}
                            </h4>
                            <Badge 
                              className={`text-xs px-3 py-1 border-0 font-medium ${
                                ponto.status === 'ativo' 
                                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white' 
                                  : 'bg-gradient-to-r from-red-600 to-red-700 text-white'
                              }`}
                            >
                              {ponto.status === 'ativo' ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  ATIVO
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 mr-1" />
                                  INATIVO
                                </>
                              )}
                            </Badge>
                          </div>
                          
                          {/* Último Acesso */}
                          {ponto.ultimoAcesso && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>Último acesso: {format(new Date(ponto.ultimoAcesso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Botões de Ação */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(getStreamingUrl(ponto.aplicativo), '_blank')}
                          className="h-8 w-8 bg-white/10 hover:bg-white/20 transition-all"
                          title="Acessar painel"
                        >
                          <ExternalLink className="w-4 h-4 text-white" />
                        </Button>
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyToClipboard(generateM3ULink(ponto.usuario, ponto.senha), 'Link M3U')}
                          className="h-8 w-8 bg-white/10 hover:bg-white/20 transition-all"
                          title="Copiar link M3U"
                        >
                          <LinkIcon className="w-4 h-4 text-white" />
                        </Button>
                        
                        {editingPonto === ponto.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              // Cancel editing
                              setEditingPonto(null);
                              setEditedPonto({});
                            }}
                            className="h-8 w-8 bg-red-500/20 hover:bg-red-500/30 transition-all"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </Button>
                        )}
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (editingPonto === ponto.id) {
                              // Save changes
                              updatePonto({ id: ponto.id, ...editedPonto });
                              setEditingPonto(null);
                              setEditedPonto({});
                            } else {
                              // Start editing
                              setEditingPonto(ponto.id);
                              setEditedPonto({
                                usuario: ponto.usuario,
                                senha: ponto.senha,
                                valor: ponto.valor || '',
                                macAddress: ponto.macAddress || '',
                                deviceKey: ponto.deviceKey || '',
                                expiracao: ponto.expiracao ? format(new Date(ponto.expiracao), 'yyyy-MM-dd') : '',
                                dispositivo: ponto.dispositivo,
                                status: ponto.status,
                                aplicativo: ponto.aplicativo,
                                descricao: ponto.descricao || '',
                                sistemaId: ponto.sistemaId
                              });
                            }
                          }}
                          className={`h-8 w-8 transition-all ${
                            editingPonto === ponto.id 
                              ? 'bg-green-500/20 hover:bg-green-500/30' 
                              : 'bg-white/10 hover:bg-white/20'
                          }`}
                          title={editingPonto === ponto.id ? "Salvar" : "Editar"}
                        >
                          {editingPonto === ponto.id ? (
                            <Save className="w-4 h-4 text-green-400" />
                          ) : (
                            <Edit2 className="w-4 h-4 text-white" />
                          )}
                        </Button>
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja deletar este ponto?')) {
                              deletePontoMutation.mutate(ponto.id);
                            }
                          }}
                          className="h-8 w-8 bg-red-500/10 hover:bg-red-500/20 transition-all"
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Content Section */}
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Credenciais */}
                      <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-lg p-3 backdrop-blur-sm border border-slate-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <User className="w-3 h-3 text-blue-400" />
                            </div>
                            <p className="text-xs font-semibold text-slate-200">Usuário</p>
                          </div>
                        </div>
                        {editingPonto === ponto.id ? (
                          <Input
                            value={editedPonto.usuario}
                            onChange={(e) => setEditedPonto({ ...editedPonto, usuario: e.target.value })}
                            className="h-8 bg-slate-700/50 border-slate-600 font-mono text-white text-sm"
                          />
                        ) : (
                          <p className="font-mono text-sm text-white font-medium">{ponto.usuario}</p>
                        )}
                      </div>
                      
                      <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-lg p-3 backdrop-blur-sm border border-slate-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                              <Key className="w-3 h-3 text-purple-400" />
                            </div>
                            <p className="text-xs font-semibold text-slate-200">Senha</p>
                          </div>
                        </div>
                        {editingPonto === ponto.id ? (
                          <Input
                            value={editedPonto.senha}
                            onChange={(e) => setEditedPonto({ ...editedPonto, senha: e.target.value })}
                            className="h-8 bg-slate-700/50 border-slate-600 font-mono text-white text-sm"
                          />
                        ) : (
                          <p className="font-mono text-sm text-white font-medium">{ponto.senha}</p>
                        )}
                      </div>
                      

                      
                      {/* MAC Address */}
                      {(ponto.macAddress || editingPonto === ponto.id) && (
                        <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-lg p-3 backdrop-blur-sm border border-slate-700/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                <Smartphone className="w-3 h-3 text-cyan-400" />
                              </div>
                              <p className="text-xs font-semibold text-slate-200">MAC Address</p>
                            </div>
                            {ponto.macAddress && (
                              <button
                                onClick={() => copyToClipboard(ponto.macAddress!, 'MAC address')}
                                className="p-1 rounded-lg"
                                title="Copiar MAC"
                              >
                                <Copy className="w-3 h-3 text-slate-300" />
                              </button>
                            )}
                          </div>
                          {editingPonto === ponto.id ? (
                            <Input
                              value={editedPonto.macAddress}
                              onChange={(e) => setEditedPonto({ ...editedPonto, macAddress: formatMacAddress(e.target.value) })}
                              className="h-8 bg-slate-700/50 border-slate-600 font-mono text-white text-sm"
                              placeholder="00:00:00:00:00:00"
                            />
                          ) : (
                            <p className="font-mono text-sm text-white">{ponto.macAddress}</p>
                          )}
                        </div>
                      )}
                      
                      {/* Device Key */}
                      {(ponto.deviceKey || editingPonto === ponto.id) && (
                        <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-lg p-3 backdrop-blur-sm border border-slate-700/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-pink-500/20 rounded-lg flex items-center justify-center">
                                <Shield className="w-3 h-3 text-pink-400" />
                              </div>
                              <p className="text-xs font-semibold text-slate-200">Device Key</p>
                            </div>
                            {ponto.deviceKey && (
                              <button
                                onClick={() => copyToClipboard(ponto.deviceKey!, 'Device key')}
                                className="p-1 rounded-lg"
                                title="Copiar Device Key"
                              >
                                <Copy className="w-3 h-3 text-slate-300" />
                              </button>
                            )}
                          </div>
                          {editingPonto === ponto.id ? (
                            <Input
                              value={editedPonto.deviceKey}
                              onChange={(e) => setEditedPonto({ ...editedPonto, deviceKey: e.target.value })}
                              className="h-8 bg-slate-700/50 border-slate-600 font-mono text-white text-sm"
                            />
                          ) : (
                            <p className="font-mono text-sm text-white truncate" title={ponto.deviceKey}>
                              {ponto.deviceKey}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Sistema */}
                      {(ponto.sistemaId || editingPonto === ponto.id) && (
                        <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-lg p-3 backdrop-blur-sm border border-slate-700/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                <Shield className="w-3 h-3 text-purple-400" />
                              </div>
                              <p className="text-xs font-semibold text-slate-200">Sistema</p>
                            </div>
                          </div>
                          {editingPonto === ponto.id ? (
                            <Select
                              value={editedPonto.sistemaId?.toString() || ''}
                              onValueChange={(value) => setEditedPonto({ ...editedPonto, sistemaId: parseInt(value) })}
                            >
                              <SelectTrigger className="h-8 bg-slate-700/50 border-slate-600 text-white text-sm">
                                <SelectValue placeholder="Selecione um sistema" />
                              </SelectTrigger>
                              <SelectContent>
                                {sistemas.map((sistema: any) => (
                                  <SelectItem 
                                    key={sistema.id} 
                                    value={sistema.id.toString()}
                                    disabled={sistema.pontosAtivos >= sistema.maxPontosAtivos && sistema.id !== ponto.sistemaId}
                                  >
                                    {sistema.systemId} ({sistema.pontosAtivos}/{sistema.maxPontosAtivos})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="font-mono text-sm text-white">
                              Sistema {sistemas.find((s: any) => s.id === ponto.sistemaId)?.systemId || ponto.sistemaId}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Aplicativo */}
                      <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-lg p-3 backdrop-blur-sm border border-slate-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <Monitor className="w-3 h-3 text-blue-400" />
                            </div>
                            <p className="text-xs font-semibold text-slate-200">Aplicativo</p>
                          </div>
                        </div>
                        {editingPonto === ponto.id ? (
                          <Select
                            value={editedPonto.aplicativo}
                            onValueChange={(value) => setEditedPonto({ ...editedPonto, aplicativo: value })}
                          >
                            <SelectTrigger className="h-8 bg-slate-700/50 border-slate-600 text-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ibo_pro">IBO Pro</SelectItem>
                              <SelectItem value="ibo_player">IBO Player</SelectItem>
                              <SelectItem value="shamel">Shamel</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-mono text-sm text-white">{getAppName(ponto.aplicativo)}</p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-lg p-3 backdrop-blur-sm border border-slate-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 ${ponto.status === 'ativo' ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-lg flex items-center justify-center`}>
                              {ponto.status === 'ativo' ? (
                                <CheckCircle className="w-3 h-3 text-green-400" />
                              ) : (
                                <XCircle className="w-3 h-3 text-red-400" />
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-200">Status</p>
                          </div>
                        </div>
                        {editingPonto === ponto.id ? (
                          <Select
                            value={editedPonto.status}
                            onValueChange={(value) => setEditedPonto({ ...editedPonto, status: value })}
                          >
                            <SelectTrigger className="h-8 bg-slate-700/50 border-slate-600 text-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ativo">Ativo</SelectItem>
                              <SelectItem value="inativo">Inativo</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className={`font-mono text-sm font-medium ${ponto.status === 'ativo' ? 'text-green-400' : 'text-red-400'}`}>
                            {ponto.status.toUpperCase()}
                          </p>
                        )}
                      </div>

                      {/* Dispositivo */}
                      <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-lg p-3 backdrop-blur-sm border border-slate-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                              {React.cloneElement(getDeviceIcon(ponto.dispositivo), { className: "w-3 h-3 text-indigo-400" })}
                            </div>
                            <p className="text-xs font-semibold text-slate-200">Dispositivo</p>
                          </div>
                        </div>
                        {editingPonto === ponto.id ? (
                          <Select
                            value={editedPonto.dispositivo}
                            onValueChange={(value) => setEditedPonto({ ...editedPonto, dispositivo: value })}
                          >
                            <SelectTrigger className="h-8 bg-slate-700/50 border-slate-600 text-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="smart_tv">Smart TV</SelectItem>
                              <SelectItem value="tv_box">TV Box</SelectItem>
                              <SelectItem value="celular">Celular</SelectItem>
                              <SelectItem value="notebook">Notebook</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="font-mono text-sm text-white capitalize">{ponto.dispositivo.replace('_', ' ')}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Descrição/Observação - Full Width */}
                    <div className="mt-3">
                      <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-lg p-3 backdrop-blur-sm border border-slate-700/30">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-amber-500/20 rounded-lg flex items-center justify-center">
                            <FileText className="w-3 h-3 text-amber-400" />
                          </div>
                          <p className="text-xs font-semibold text-slate-200">Observação</p>
                        </div>
                        {editingPonto === ponto.id ? (
                          <Input
                            value={editedPonto.descricao}
                            onChange={(e) => setEditedPonto({ ...editedPonto, descricao: e.target.value })}
                            className="w-full h-8 bg-slate-700/50 border-slate-600 text-white text-sm"
                            placeholder="Ex: Ponto da sala, Ponto do quarto..."
                          />
                        ) : (
                          <p className="text-sm text-white">{ponto.descricao || 'Sem observações'}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Valor e Expiração - Bottom Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-700/50">
                      {/* Valor */}
                      <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 rounded-lg p-3 backdrop-blur-sm border border-green-600/30">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-green-500/30 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-3 h-3 text-green-400" />
                          </div>
                          <p className="text-xs font-semibold text-green-300">Valor Mensal</p>
                        </div>
                        {editingPonto === ponto.id ? (
                          <Input
                            value={editedPonto.valor}
                            onChange={(e) => setEditedPonto({ ...editedPonto, valor: e.target.value })}
                            className="h-8 bg-slate-700/50 border-green-600/50 text-white text-sm font-bold"
                            placeholder="0.00"
                            type="number"
                            step="0.01"
                          />
                        ) : (
                          <p className="text-lg text-green-400 font-bold">
                            R$ {ponto.valor ? parseFloat(ponto.valor).toFixed(2) : '0.00'}
                          </p>
                        )}
                      </div>
                      
                      {/* Data de Expiração */}
                      <div className="bg-gradient-to-br from-orange-600/20 to-orange-700/20 rounded-lg p-3 backdrop-blur-sm border border-orange-600/30">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-orange-500/30 rounded-lg flex items-center justify-center">
                            <CalendarDays className="w-3 h-3 text-orange-400" />
                          </div>
                          <p className="text-xs font-semibold text-orange-300">Data de Expiração</p>
                        </div>
                        {editingPonto === ponto.id ? (
                          <Input
                            value={editedPonto.expiracao}
                            onChange={(e) => setEditedPonto({ ...editedPonto, expiracao: e.target.value })}
                            className="h-8 bg-slate-700/50 border-orange-600/50 text-white text-sm"
                            type="date"
                          />
                        ) : (
                          <p className="text-base text-orange-400 font-medium">
                            {ponto.expiracao ? format(new Date(ponto.expiracao), "dd/MM/yyyy", { locale: ptBR }) : 'Sem data'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="p-6 bg-gradient-to-br from-slate-700/20 to-slate-800/20 rounded-full w-fit mx-auto mb-6">
                <Wifi className="w-16 h-16 text-slate-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">Nenhum ponto de acesso</h3>
              <p className="text-slate-400 mb-6">Clique no botão acima para adicionar um novo ponto</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Image Overlay */}
      {floatingImage && (
        <div
          ref={floatingRef}
          className="fixed z-[9999] bg-slate-900/95 border-2 border-slate-600 rounded-lg shadow-2xl backdrop-blur-sm"
          style={{
            left: `${floatingImage.position.x}px`,
            top: `${floatingImage.position.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          {/* Header with controls */}
          <div 
            className="bg-slate-800 px-4 py-2 flex items-center justify-between gap-2 border-b border-slate-700"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <Move className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-medium">Arraste para mover</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => adjustScale(-0.2)}
                className="h-7 w-7 p-0 hover:bg-slate-700"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-400 min-w-[50px] text-center">
                {Math.round(floatingImage.scale * 100)}%
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => adjustScale(0.2)}
                className="h-7 w-7 p-0 hover:bg-slate-700"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <div className="w-px h-5 bg-slate-700 mx-1" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFloatingImage(null)}
                className="h-7 w-7 p-0 hover:bg-red-500/20 hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Image */}
          <div className="p-2">
            <img
              src={floatingImage.url}
              alt="Configuração do cliente"
              style={{
                width: `${400 * floatingImage.scale}px`,
                height: 'auto',
                maxWidth: '90vw',
                maxHeight: '70vh',
                objectFit: 'contain',
              }}
              className="rounded"
              draggable={false}
            />
          </div>
          
          {/* Instructions */}
          <div className="bg-slate-800/50 px-4 py-2 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center">
              Arraste uma nova imagem para substituir
            </p>
          </div>
        </div>
      )}



      {/* Dialog para adicionar ponto */}
      <Dialog open={showAddPontoDialog} onOpenChange={setShowAddPontoDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/50 max-w-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Adicionar Novo Ponto</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">


            <div>
              <Label htmlFor="aplicativo" className="text-slate-400">Aplicativo *</Label>
              <Select
                value={newPonto.aplicativo}
                onValueChange={(value) => setNewPonto({ ...newPonto, aplicativo: value })}
              >
                <SelectTrigger id="aplicativo" className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ibo_pro">IBO Pro</SelectItem>
                  <SelectItem value="ibo_player">IBO Player</SelectItem>
                  <SelectItem value="shamel">Shamel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dispositivo" className="text-slate-400">Dispositivo *</Label>
              <Select
                value={newPonto.dispositivo}
                onValueChange={(value) => setNewPonto({ ...newPonto, dispositivo: value })}
              >
                <SelectTrigger id="dispositivo" className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart_tv">Smart TV</SelectItem>
                  <SelectItem value="tv_box">TV Box</SelectItem>
                  <SelectItem value="celular">Celular</SelectItem>
                  <SelectItem value="notebook">Notebook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sistema" className="text-slate-400">Sistema *</Label>
              <Select
                value={newPonto.sistemaId?.toString() || ''}
                onValueChange={(value) => setNewPonto({ ...newPonto, sistemaId: parseInt(value) })}
              >
                <SelectTrigger id="sistema" className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors">
                  <SelectValue placeholder="Selecione um sistema" />
                </SelectTrigger>
                <SelectContent>
                  {sistemas.map((sistema: any) => (
                    <SelectItem 
                      key={sistema.id} 
                      value={sistema.id.toString()}
                      disabled={sistema.pontosAtivos >= sistema.maxPontosAtivos}
                    >
                      {sistema.systemId} ({sistema.pontosAtivos || 0}/{sistema.maxPontosAtivos || 100})
                      {sistema.pontosAtivos >= sistema.maxPontosAtivos && ' - Limite atingido'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="usuario" className="text-slate-400">Usuário *</Label>
              <Input
                id="usuario"
                value={newPonto.usuario}
                onChange={(e) => setNewPonto({ ...newPonto, usuario: e.target.value })}
                className="bg-dark-bg border-slate-700"
                placeholder={cliente?.telefone || "Nome de usuário"}
              />
            </div>

            <div>
              <Label htmlFor="senha" className="text-slate-400">Senha *</Label>
              <Input
                id="senha"
                type="text"
                value={newPonto.senha}
                onChange={(e) => setNewPonto({ ...newPonto, senha: e.target.value })}
                className="bg-dark-bg border-slate-700"
                placeholder="tvon1@"
              />
            </div>

            <div>
              <Label htmlFor="macAddress" className="text-slate-400">MAC Address *</Label>
              <div className="relative">
                <Input
                  id="macAddress"
                  value={newPonto.macAddress}
                  onChange={(e) => {
                    const formatted = formatMacAddress(e.target.value);
                    setNewPonto({ ...newPonto, macAddress: formatted });
                  }}
                  className="bg-dark-bg border-slate-700 pr-10"
                  placeholder="05:d0:ad:c4:51:c9"
                  maxLength={17}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(newPonto.macAddress, 'MAC address')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded"
                  title="Copiar MAC"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Formato: 05:d0:ad:c4:51:c9</p>
            </div>

            <div>
              <Label htmlFor="deviceKey" className="text-slate-400">Device Key *</Label>
              <div className="relative">
                <Input
                  id="deviceKey"
                  value={newPonto.deviceKey}
                  onChange={(e) => setNewPonto({ ...newPonto, deviceKey: e.target.value })}
                  className="bg-dark-bg border-slate-700 pr-10"
                  placeholder="Chave do dispositivo"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(newPonto.deviceKey, 'Device key')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded"
                  title="Copiar Device Key"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="valor" className="text-slate-400">Valor Mensal * (R$)</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                value={newPonto.valor}
                onChange={(e) => setNewPonto({ ...newPonto, valor: e.target.value })}
                className="bg-dark-bg border-slate-700"
                placeholder="24.90"
              />
            </div>

            <div>
              <Label htmlFor="expiracao" className="text-slate-400">Data de Expiração *</Label>
              <Input
                id="expiracao"
                type="date"
                value={newPonto.expiracao}
                onChange={(e) => setNewPonto({ ...newPonto, expiracao: e.target.value })}
                className="bg-dark-bg border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">Padrão: 12 meses a partir de hoje</p>
            </div>

            <div className="col-span-2">
              <Label htmlFor="descricao" className="text-slate-400">Observação</Label>
              <Textarea
                id="descricao"
                value={newPonto.descricao}
                onChange={(e) => setNewPonto({ ...newPonto, descricao: e.target.value })}
                className="bg-dark-bg border-slate-700"
                placeholder="Ex: Ponto da sala, Ponto do quarto..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddPontoDialog(false)}
              className="bg-dark-bg border-slate-700 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createPontoMutation.mutate(newPonto)}
              disabled={!newPonto.usuario || !newPonto.senha || !newPonto.valor || !newPonto.macAddress || !newPonto.deviceKey || !newPonto.sistemaId || createPontoMutation.isPending}
              className="bg-primary hover:bg-primary/80"
            >
              {createPontoMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Ponto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}