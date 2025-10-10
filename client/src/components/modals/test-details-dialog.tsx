import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Clock,
  User,
  Monitor,
  Smartphone,
  Tv,
  Laptop,
  Key,
  Wifi,
  Hash,
  Copy,
  ExternalLink,
  Edit,
  Save,
  X,
  Trash2,
  Plus,
  CheckCircle,
  AlertCircle,
  Settings,
  Link,
  Activity,
  Timer,
  Phone,
  Cpu,
  Shield,
  Zap
} from 'lucide-react';

interface TestDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teste?: any;
  phoneNumber?: string;
  onTestDeleted?: () => void;
}

export function TestDetailsDialog({ 
  open, 
  onOpenChange, 
  teste, 
  phoneNumber,
  onTestDeleted 
}: TestDetailsDialogProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [currentTest, setCurrentTest] = useState<any>(null); // Local state for current test data
  const [editData, setEditData] = useState({
    mac: '',
    deviceKey: '',
    aplicativo: '',
    dispositivo: '',
    expiraEm: ''
  });

  // Fetch sistemas
  const { data: sistemas } = useQuery({
    queryKey: ['/api/sistemas'],
    enabled: open,
  });

  // Fetch test by phone number if phoneNumber is provided and teste is not
  const { data: testData, isLoading, refetch } = useQuery({
    queryKey: ['/api/testes/by-phone', phoneNumber],
    queryFn: async () => {
      if (!phoneNumber) return null;
      
      const res = await fetch(`/api/testes/by-phone/${phoneNumber}`);
      if (!res.ok) throw new Error('Teste não encontrado');
      return res.json();
    },
    enabled: open && !teste && !!phoneNumber,
    staleTime: 0, // Always refetch when needed
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/testes/${test.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar teste');
      }
      return response.json();
    },
    onSuccess: (updatedTest) => {
      // Update local state immediately
      setCurrentTest(updatedTest);
      
      // Update edit data with new values
      setEditData({
        mac: updatedTest.mac || '',
        deviceKey: updatedTest.deviceKey || '',
        aplicativo: updatedTest.aplicativo || '',
        dispositivo: updatedTest.dispositivo || '',
        expiraEm: updatedTest.expiraEm ? new Date(updatedTest.expiraEm).toISOString().slice(0, 16) : ''
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/testes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
      
      // If we have phoneNumber, also invalidate the specific query
      if (phoneNumber) {
        queryClient.invalidateQueries({ queryKey: ['/api/testes/by-phone', phoneNumber] });
      }
      
      toast({
        title: 'Teste atualizado',
        description: 'As alterações foram salvas com sucesso',
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar teste',
        description: error.message || 'Ocorreu um erro ao atualizar o teste',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const testId = currentTest?.id || testData?.id || teste?.id;
      if (!testId) throw new Error('ID do teste não encontrado');
      
      const response = await fetch(`/api/testes/${testId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao deletar teste');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/testes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
      toast({
        title: 'Teste deletado',
        description: 'O teste foi removido com sucesso',
      });
      onTestDeleted?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao deletar teste',
        description: error.message || 'Ocorreu um erro ao deletar o teste',
        variant: 'destructive',
      });
    },
  });

  // Initialize current test and edit data when test changes
  useEffect(() => {
    const sourceTest = testData || teste;
    if (sourceTest) {
      setCurrentTest(sourceTest);
      setEditData({
        mac: sourceTest.mac || '',
        deviceKey: sourceTest.deviceKey || '',
        aplicativo: sourceTest.aplicativo || '',
        dispositivo: sourceTest.dispositivo || '',
        expiraEm: sourceTest.expiraEm ? new Date(sourceTest.expiraEm).toISOString().slice(0, 16) : ''
      });
    }
  }, [testData, teste]);

  // Early return if dialog should not be shown
  if (!open || (!teste && !phoneNumber)) {
    return null;
  }

  const test = currentTest || testData || teste;

  const formatPhoneNumber = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
      const number = cleanPhone.slice(2);
      return `(${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
    }
    return phone;
  };

  const formatMacAddress = (mac: string) => {
    // Remove all non-hex characters except colons
    const cleanMac = mac.replace(/[^a-fA-F0-9:]/g, '');
    
    // Remove existing colons to reformat
    const noColons = cleanMac.replace(/:/g, '');
    
    // Limit to 12 characters and convert to uppercase
    const limitedMac = noColons.slice(0, 12).toUpperCase();
    
    // Add colons every 2 characters
    const formatted = limitedMac.match(/.{1,2}/g)?.join(':') || limitedMac;
    
    return formatted;
  };

  const handleMacChange = (value: string) => {
    const formatted = formatMacAddress(value);
    setEditData(prev => ({ ...prev, mac: formatted }));
  };

  const handleSave = () => {
    const updateData: any = {};
    
    // Compare with proper null/undefined checks
    if (editData.mac !== (test.mac || '')) updateData.macAddress = editData.mac;
    if (editData.deviceKey !== (test.deviceKey || '')) updateData.deviceKey = editData.deviceKey;
    if (editData.aplicativo !== (test.aplicativo || '')) updateData.aplicativo = editData.aplicativo;
    if (editData.dispositivo !== (test.dispositivo || '')) updateData.dispositivo = editData.dispositivo;
    if (editData.expiraEm && editData.expiraEm !== new Date(test.expiraEm).toISOString().slice(0, 16)) {
      updateData.expiraEm = new Date(editData.expiraEm).toISOString();
    }
    
    // Debug logging
    console.log('Save comparison:', {
      mac: { edit: editData.mac, current: test.mac },
      deviceKey: { edit: editData.deviceKey, current: test.deviceKey },
      aplicativo: { edit: editData.aplicativo, current: test.aplicativo },
      dispositivo: { edit: editData.dispositivo, current: test.dispositivo },
      updateData
    });
    
    if (Object.keys(updateData).length === 0) {
      toast({
        title: 'Nenhuma alteração',
        description: 'Não há alterações para salvar.',
      });
      return;
    }

    updateMutation.mutate(updateData);
  };

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja deletar este teste? Esta ação não pode ser desfeita.')) {
      deleteMutation.mutate();
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copiado!`,
      description: 'Copiado para área de transferência',
    });
  };

  const getStreamingUrl = (app: string) => {
    switch (app) {
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

  const generateM3ULink = (username: string, password: string) => {
    return `http://tvonbr.fun/get.php?username=${username}&password=${password}&type=m3u_plus&output=hls`;
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'celular':
        return <Smartphone className="w-5 h-5" />;
      case 'smart_tv':
      case 'tv_box':
        return <Tv className="w-5 h-5" />;
      case 'notebook':
        return <Laptop className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  const getDeviceLabel = (device: string) => {
    switch (device) {
      case 'celular':
        return 'Celular';
      case 'smart_tv':
        return 'Smart TV';
      case 'tv_box':
        return 'TV Box';
      case 'notebook':
        return 'Notebook';
      default:
        return device;
    }
  };

  const getAppLabel = (app: string) => {
    switch (app) {
      case 'ibo_pro':
        return 'IBO Pro';
      case 'ibo_player':
        return 'IBO Player';
      case 'shamel':
        return 'Shamel';
      default:
        return app;
    }
  };

  if (!test && isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 border border-purple-500/20 text-white">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              <p className="text-slate-400">Carregando detalhes...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!test) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 border border-purple-500/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-center text-red-400 flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Teste não encontrado
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-slate-400 py-4">Não foi possível encontrar os detalhes do teste.</p>
        </DialogContent>
      </Dialog>
    );
  }

  const isExpired = new Date(test.expiraEm) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 border border-purple-500/20 text-white overflow-y-auto shadow-2xl">
        {/* Header Elegante */}
        <DialogHeader className="border-b border-purple-500/20 pb-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-600 blur-xl opacity-50"></div>
                <div className="relative p-3 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl shadow-lg">
                  <Zap className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">
                  Detalhes do Teste
                </DialogTitle>
                <p className="text-purple-300 text-sm mt-1">
                  Gerenciar configurações e informações
                </p>
              </div>
            </div>
            
            {/* Status Badge Melhorado */}
            <div className="flex items-center gap-3">
              <Badge 
                className={cn(
                  "px-4 py-2 text-sm font-semibold shadow-lg",
                  isExpired 
                    ? "bg-gradient-to-r from-red-600 to-red-700 text-white border-0" 
                    : "bg-gradient-to-r from-green-600 to-green-700 text-white border-0"
                )}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full mr-2 animate-pulse",
                  isExpired ? "bg-white" : "bg-white"
                )} />
                {isExpired ? 'Expirado' : 'Ativo'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Informações Temporais e Contato */}
          <div className="space-y-6">
            {/* Card de Cronologia */}
            <Card className="bg-white/5 border-purple-500/20 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Clock className="w-5 h-5 text-purple-400" />
                  Informações Temporais
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-medium text-slate-300">Criado em</span>
                  </div>
                  <span className="text-sm font-mono text-white bg-black/30 px-3 py-1 rounded-lg">
                    {format(new Date(test.criadoEm), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                
                <div className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <Clock className={cn("w-5 h-5", isExpired ? "text-red-400" : "text-orange-400")} />
                      <span className="text-sm font-medium text-slate-300">Expira em</span>
                    </div>
                  </div>
                  {isEditing ? (
                    <Input
                      type="datetime-local"
                      value={editData.expiraEm}
                      onChange={(e) => setEditData(prev => ({ ...prev, expiraEm: e.target.value }))}
                      className="bg-black/30 border-purple-500/30 text-white h-11 w-full rounded-lg"
                    />
                  ) : (
                    <span className={cn(
                      "text-sm font-semibold bg-black/30 px-3 py-2 rounded-lg block text-center",
                      isExpired ? "text-red-400" : "text-orange-400"
                    )}>
                      {format(new Date(test.expiraEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <Timer className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-medium text-slate-300">Duração Total</span>
                  </div>
                  <span className="text-lg font-bold text-white bg-gradient-to-r from-blue-600/30 to-purple-600/30 px-4 py-1 rounded-lg">
                    {test.duracaoHoras}h
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card de Contato */}
            <Card className="bg-white/5 border-purple-500/20 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-600/20 to-blue-600/20 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Phone className="w-5 h-5 text-green-400" />
                  Informações de Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-medium text-slate-300">Telefone</span>
                  </div>
                  <span className="font-mono text-white bg-black/30 px-3 py-1 rounded-lg">
                    {formatPhoneNumber(test.telefone)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita - Configurações do Dispositivo */}
          <div className="space-y-6">
            <Card className="bg-white/5 border-purple-500/20 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Cpu className="w-5 h-5 text-blue-400" />
                  Configuração do Dispositivo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Aplicativo */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Aplicativo</label>
                  {isEditing ? (
                    <Select
                      value={editData.aplicativo}
                      onValueChange={(value) => setEditData(prev => ({ ...prev, aplicativo: value }))}
                    >
                      <SelectTrigger className="bg-black/30 border-purple-500/30 text-white h-11 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-purple-500/30">
                        <SelectItem value="ibo_pro" className="text-white hover:bg-purple-600/30">IBO Pro</SelectItem>
                        <SelectItem value="ibo_player" className="text-white hover:bg-purple-600/30">IBO Player</SelectItem>
                        <SelectItem value="shamel" className="text-white hover:bg-purple-600/30">Shamel</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg">
                      <Shield className="w-5 h-5 text-purple-400" />
                      <span className="text-white font-semibold">{getAppLabel(test.aplicativo)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto hover:bg-purple-600/30 border-purple-500/30"
                        onClick={() => window.open(getStreamingUrl(test.aplicativo), '_blank')}
                        title="Acessar site"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Tipo de Dispositivo */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Tipo de Dispositivo</label>
                  {isEditing ? (
                    <Select
                      value={editData.dispositivo}
                      onValueChange={(value) => setEditData(prev => ({ ...prev, dispositivo: value }))}
                    >
                      <SelectTrigger className="bg-black/30 border-purple-500/30 text-white h-11 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-purple-500/30">
                        <SelectItem value="celular" className="text-white hover:bg-purple-600/30">Celular</SelectItem>
                        <SelectItem value="smart_tv" className="text-white hover:bg-purple-600/30">Smart TV</SelectItem>
                        <SelectItem value="tv_box" className="text-white hover:bg-purple-600/30">TV Box</SelectItem>
                        <SelectItem value="notebook" className="text-white hover:bg-purple-600/30">Notebook</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg">
                      {getDeviceIcon(test.dispositivo)}
                      <span className="text-white font-semibold">{getDeviceLabel(test.dispositivo)}</span>
                    </div>
                  )}
                </div>

                {/* MAC Address */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider">MAC Address</label>
                  {isEditing ? (
                    <Input
                      value={editData.mac}
                      onChange={(e) => handleMacChange(e.target.value)}
                      placeholder="00:00:00:00:00:00"
                      className="bg-black/30 border-purple-500/30 text-white font-mono h-11 rounded-lg"
                      maxLength={17}
                      autoComplete="off"
                    />
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Wifi className="w-5 h-5 text-cyan-400" />
                        <span className="font-mono text-white">{test.mac || 'Não configurado'}</span>
                      </div>
                      {test.mac && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-purple-600/30"
                          onClick={() => copyToClipboard(test.mac, 'MAC')}
                        >
                          <Copy className="w-4 h-4 text-purple-400" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Device Key */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Device Key</label>
                  {isEditing ? (
                    <Input
                      value={editData.deviceKey}
                      onChange={(e) => setEditData(prev => ({ ...prev, deviceKey: e.target.value }))}
                      placeholder="000000"
                      className="bg-black/30 border-purple-500/30 text-white font-mono h-11 rounded-lg"
                      maxLength={6}
                      autoComplete="off"
                    />
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Key className="w-5 h-5 text-yellow-400" />
                        <span className="font-mono text-white">{test.deviceKey || 'Não configurado'}</span>
                      </div>
                      {test.deviceKey && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-purple-600/30"
                          onClick={() => copyToClipboard(test.deviceKey, 'Device Key')}
                        >
                          <Copy className="w-4 h-4 text-purple-400" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Ações - Design Melhorado */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-purple-500/20">
          <div className="flex gap-3">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 shadow-lg"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar Teste
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 shadow-lg"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </Button>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData({
                      mac: test.mac || '',
                      deviceKey: test.deviceKey || '',
                      aplicativo: test.aplicativo || '',
                      dispositivo: test.dispositivo || '',
                      expiraEm: test.expiraEm ? new Date(test.expiraEm).toISOString().slice(0, 16) : ''
                    });
                  }}
                  variant="outline"
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-600/20"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </>
            )}
          </div>

          <Button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            variant="destructive"
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Deletar Teste
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}