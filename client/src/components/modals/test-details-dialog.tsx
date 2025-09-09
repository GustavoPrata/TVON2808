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
  Activity
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

  const test = currentTest || testData || teste;

  // Early return if dialog should not be shown
  if (!open || (!teste && !phoneNumber)) {
    return null;
  }

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
      const response = await fetch(`/api/testes/${test.id}`, {
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
        return 'https://iboproapp.com';
      case 'ibo_player':
        return 'https://iboplayer.com';
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
        return <Smartphone className="w-4 h-4 text-purple-400" />;
      case 'smart_tv':
      case 'tv_box':
        return <Tv className="w-4 h-4 text-purple-400" />;
      case 'notebook':
        return <Laptop className="w-4 h-4 text-purple-400" />;
      default:
        return <Monitor className="w-4 h-4 text-purple-400" />;
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
        <DialogContent className="max-w-md bg-slate-900 border border-slate-700 text-white">
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
        <DialogContent className="max-w-md bg-slate-900 border border-slate-700 text-white">
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
      <DialogContent className="max-w-6xl max-h-[95vh] bg-slate-900 border border-slate-700 text-white overflow-y-auto shadow-2xl">
        {/* Header moderno */}
        <DialogHeader className="border-b border-slate-700/50 pb-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border border-purple-500/30">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Detalhes do Teste
                </DialogTitle>
                <p className="text-slate-400 text-sm mt-1">
                  Gerenciar configurações e credenciais
                </p>
              </div>
            </div>
            
            {/* Status Badge */}
            <Badge 
              variant={isExpired ? "destructive" : "default"}
              className={cn(
                "px-3 py-1 text-sm font-medium",
                isExpired 
                  ? "bg-red-500/20 text-red-400 border-red-500/30" 
                  : "bg-green-500/20 text-green-400 border-green-500/30"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full mr-2",
                isExpired ? "bg-red-400" : "bg-green-400"
              )} />
              {isExpired ? 'Expirado' : 'Ativo'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1 - Informações Básicas */}
          <div className="lg:col-span-1 space-y-4">
            {/* Card de Informações de Tempo */}
            <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-purple-400">
                  <Clock className="w-5 h-5" />
                  Cronologia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">Criado</span>
                  </div>
                  <span className="text-xs font-mono text-white">
                    {format(new Date(test.criadoEm), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                
                <div className="p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className={cn("w-4 h-4", isExpired ? "text-red-400" : "text-orange-400")} />
                      <span className="text-sm text-slate-300">Expira</span>
                    </div>
                    {isEditing && (
                      <span className="text-xs text-slate-500">Editar data e hora</span>
                    )}
                  </div>
                  {isEditing ? (
                    <Input
                      type="datetime-local"
                      value={editData.expiraEm}
                      onChange={(e) => setEditData(prev => ({ ...prev, expiraEm: e.target.value }))}
                      className="bg-slate-700/50 border-slate-600 text-white h-10 w-full"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  ) : (
                    <span className={cn(
                      "text-xs font-mono font-medium",
                      isExpired ? "text-red-400" : "text-orange-400"
                    )}>
                      {format(new Date(test.expiraEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300">Duração</span>
                  </div>
                  <span className="text-sm font-medium text-white">{test.duracaoHoras}h</span>
                </div>
              </CardContent>
            </Card>

            {/* Card de Contato */}
            <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-green-400">
                  <User className="w-5 h-5" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-sm text-slate-300">Telefone</span>
                  <span className="font-mono text-white">{formatPhoneNumber(test.telefone)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna 2 - Configurações do Dispositivo */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-purple-400">
                  <Settings className="w-5 h-5" />
                  Dispositivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Aplicativo */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 font-medium">Aplicativo</label>
                  {isEditing ? (
                    <Select
                      value={editData.aplicativo}
                      onValueChange={(value) => setEditData(prev => ({ ...prev, aplicativo: value }))}
                    >
                      <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="ibo_pro" className="text-white hover:bg-slate-700">IBO Pro</SelectItem>
                        <SelectItem value="ibo_player" className="text-white hover:bg-slate-700">IBO Player</SelectItem>
                        <SelectItem value="shamel" className="text-white hover:bg-slate-700">Shamel</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-purple-400" />
                        <span className="text-white font-medium">{getAppLabel(test.aplicativo)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dispositivo */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 font-medium">Tipo</label>
                  {isEditing ? (
                    <Select
                      value={editData.dispositivo}
                      onValueChange={(value) => setEditData(prev => ({ ...prev, dispositivo: value }))}
                    >
                      <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="celular" className="text-white hover:bg-slate-700">Celular</SelectItem>
                        <SelectItem value="smart_tv" className="text-white hover:bg-slate-700">Smart TV</SelectItem>
                        <SelectItem value="tv_box" className="text-white hover:bg-slate-700">TV Box</SelectItem>
                        <SelectItem value="notebook" className="text-white hover:bg-slate-700">Notebook</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(test.dispositivo)}
                        <span className="text-white font-medium">{getDeviceLabel(test.dispositivo)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sistema (somente leitura) */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 font-medium">Sistema</label>
                  <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-600/30">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-blue-400" />
                      <span className="text-white font-medium">
                        {sistemas && Array.isArray(sistemas) && sistemas.find((s: any) => s.id === test.sistemaId)?.systemId ? 
                          `Sistema ${sistemas.find((s: any) => s.id === test.sistemaId).systemId}` : 
                          `Sistema ${test.sistemaId || 'N/A'}`
                        }
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                      Somente leitura
                    </Badge>
                  </div>
                </div>

                {/* MAC Address */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 font-medium">MAC Address</label>
                  {isEditing ? (
                    <Input
                      value={editData.mac}
                      onChange={(e) => handleMacChange(e.target.value)}
                      placeholder="00:00:00:00:00:00"
                      className="bg-slate-700/50 border-slate-600 text-white font-mono h-10"
                      maxLength={17}
                      autoComplete="off"
                    />
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-cyan-400" />
                        <span className="font-mono text-white text-sm">{test.mac || 'N/A'}</span>
                      </div>
                      {test.mac && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-slate-700"
                          onClick={() => copyToClipboard(test.mac, 'MAC')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Device Key */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 font-medium">Device Key</label>
                  {isEditing ? (
                    <Input
                      value={editData.deviceKey}
                      onChange={(e) => setEditData(prev => ({ ...prev, deviceKey: e.target.value }))}
                      placeholder="Device Key"
                      className="bg-slate-700/50 border-slate-600 text-white font-mono h-10"
                    />
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-yellow-400" />
                        <span className="font-mono text-white text-sm">{test.deviceKey || 'N/A'}</span>
                      </div>
                      {test.deviceKey && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-slate-700"
                          onClick={() => copyToClipboard(test.deviceKey, 'Device Key')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Coluna 3 - Credenciais e Ações */}
          <div className="lg:col-span-1 space-y-4">
            {/* Card de Credenciais */}
            <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-cyan-400">
                  <Key className="w-5 h-5" />
                  Credenciais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Usuário */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 font-medium">Usuário</label>
                  <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                    <span className="font-mono text-white text-sm">{test.apiUsername}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-slate-700"
                      onClick={() => copyToClipboard(test.apiUsername, 'Usuário')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                {/* Senha */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-400 font-medium">Senha</label>
                  <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                    <span className="font-mono text-white text-sm">{test.apiPassword}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-slate-700"
                      onClick={() => copyToClipboard(test.apiPassword, 'Senha')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card de Ações */}
            <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-emerald-400">
                  <Settings className="w-5 h-5" />
                  Ações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Botões de Edição */}
                {test?.status === 'deletado' ? (
                  <div className="flex items-center justify-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="text-center">
                      <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                      <p className="text-red-400 font-medium">Teste Deletado</p>
                      <p className="text-sm text-red-300/70">Este teste não pode ser editado</p>
                    </div>
                  </div>
                ) : isEditing ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white h-10"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
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
                      className="border-slate-600 text-slate-300 hover:bg-slate-700 h-10"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white h-10"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Teste
                  </Button>
                )}

                {/* Ações de Streaming */}
                {!isEditing && test?.status !== 'deletado' && (
                  <>
                    <Separator className="bg-slate-700/50" />
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white h-9"
                        onClick={() => window.open(getStreamingUrl(test.aplicativo), '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Painel
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700 h-9"
                        onClick={() => {
                          const m3uLink = generateM3ULink(test.apiUsername, test.apiPassword);
                          copyToClipboard(m3uLink, 'Link M3U');
                        }}
                      >
                        <Link className="w-3 h-3 mr-1" />
                        M3U
                      </Button>
                    </div>

                    <Separator className="bg-slate-700/50" />

                    {/* Botão Delete */}
                    <Button
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      variant="destructive"
                      className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white h-10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deleteMutation.isPending ? 'Deletando...' : 'Deletar Teste'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}