import React, { useState, useEffect } from 'react';
import { Settings, Smartphone, User, Image, Shield, Bell, CheckCircle, Eye, Wifi, Info, Camera, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest, api } from '@/lib/queryClient';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WhatsAppSettings {
  // Profile settings
  profileName: string;
  profileStatus: string;
  profilePicture: string | null;
  
  // Connection settings
  markOnlineOnConnect: boolean;

  generateHighQualityLinkPreview: boolean;
  
  // Message settings
  markMessagesRead: boolean;
  sendReadReceipts: boolean;
  
  // Media settings
  autoDownloadMedia: boolean;
  autoDownloadDocuments: boolean;
  saveChatHistory: boolean;
  
  // Client settings
  fetchClientPhotos: boolean;
  cacheClientPhotos: boolean;
  showClientStatus: boolean;
  
  // Advanced settings
  reconnectInterval: number;
  maxReconnectRetries: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

interface WhatsAppConfigProps {
  isConnected: boolean;
  qrCode: string | null;
}

export function WhatsAppConfig({ isConnected, qrCode }: WhatsAppConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  
  // Get current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/whatsapp/settings'],
    staleTime: 0,
  });

  const [formData, setFormData] = useState<WhatsAppSettings>({
    profileName: '',
    profileStatus: '',
    profilePicture: null,
    markOnlineOnConnect: false,

    generateHighQualityLinkPreview: true,
    markMessagesRead: true,
    sendReadReceipts: true,
    autoDownloadMedia: true,
    autoDownloadDocuments: true,
    saveChatHistory: true,
    fetchClientPhotos: false,
    cacheClientPhotos: true,
    showClientStatus: true,
    reconnectInterval: 5000,
    maxReconnectRetries: 5,
    logLevel: 'info',
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<WhatsAppSettings>) => {
      return apiRequest('/api/whatsapp/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Configurações atualizadas',
        description: 'As configurações foram salvas com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/settings'] });
    },
    onError: () => {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    },
  });

  // Update profile picture mutation
  const updateProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profilePicture', file);
      return apiRequest('/api/whatsapp/profile-picture', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Foto atualizada',
        description: 'A foto do perfil foi atualizada com sucesso.',
      });
      setProfilePictureFile(null);
    },
    onError: () => {
      toast({
        title: 'Erro ao atualizar foto',
        description: 'Não foi possível atualizar a foto do perfil.',
        variant: 'destructive',
      });
    },
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: () => apiRequest('/api/whatsapp/connect', {
      method: 'POST',
    }),
    onSuccess: () => {
      toast({
        title: 'Conectando WhatsApp',
        description: 'Um QR Code será gerado em breve.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
    },
    onError: () => {
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível conectar o WhatsApp.',
        variant: 'destructive',
      });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest('/api/whatsapp/disconnect', {
      method: 'POST',
    }),
    onSuccess: () => {
      toast({
        title: 'WhatsApp desconectado',
        description: 'WhatsApp foi desconectado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
      setShowDisconnectDialog(false);
      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: 'Erro ao desconectar',
        description: 'Não foi possível desconectar o WhatsApp.',
        variant: 'destructive',
      });
    },
  });

  const handleUpdateSettings = (key: keyof WhatsAppSettings, value: any) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    updateSettingsMutation.mutate({ [key]: value });
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePictureFile(file);
      updateProfilePictureMutation.mutate(file);
    }
  };

  const renderQRCode = () => {
    if (!qrCode) return null;
    
    return (
      <div className="bg-white p-4 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`} 
              alt="QR Code WhatsApp" 
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-gray-600 text-sm">
            Escaneie o QR Code com seu WhatsApp
          </p>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <Settings className="w-4 h-4 mr-2" />
          Configurações
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-4xl overflow-y-auto bg-dark-surface text-white">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div>
                <SheetTitle className="text-2xl font-bold text-white">Configurações do WhatsApp</SheetTitle>
                <SheetDescription className="text-slate-400">Personalize seu WhatsApp Business</SheetDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Conectado
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDisconnectDialog(true)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <WifiOff className="w-4 h-4 mr-2" />
                    Desconectar
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
                >
                  {connectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4 mr-2" />
                      Conectar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {!isConnected && (
          <div className="mb-6">
            <Card className="bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center text-white">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mr-3">
                    <Smartphone className="w-5 h-5 text-white" />
                  </div>
                  Conectar WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {qrCode ? (
                  renderQRCode()
                ) : (
                  <div className="text-center space-y-4">
                    <p className="text-slate-400">
                      Clique no botão abaixo para gerar o QR Code e conectar seu WhatsApp
                    </p>
                    <Button
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-0 text-white shadow-lg"
                    >
                      {connectMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4 mr-2" />
                          Conectar WhatsApp
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid grid-cols-4 bg-slate-800 border border-slate-700 rounded-xl p-1">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="messages">Mensagens</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="advanced">Avançado</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center text-white">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mr-3">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  Informações do Perfil
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="profileName">Nome do Perfil</Label>
                  <Input
                    id="profileName"
                    value={formData.profileName}
                    onChange={(e) => handleUpdateSettings('profileName', e.target.value)}
                    placeholder="Nome exibido no WhatsApp"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileStatus">Status</Label>
                  <Input
                    id="profileStatus"
                    value={formData.profileStatus}
                    onChange={(e) => handleUpdateSettings('profileStatus', e.target.value)}
                    placeholder="Hey there! I am using WhatsApp"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profilePicture">Foto do Perfil</Label>
                  <div className="flex items-center space-x-4">
                    {formData.profilePicture && (
                      <img 
                        src={formData.profilePicture} 
                        alt="Profile" 
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    <Input
                      id="profilePicture"
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center text-white">
                  <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg mr-3">
                    <Wifi className="w-5 h-5 text-white" />
                  </div>
                  Conexão
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Aparecer Online ao Conectar</Label>
                    <p className="text-sm text-slate-400">
                      Define se você aparece online quando conecta
                    </p>
                  </div>
                  <Switch
                    checked={formData.markOnlineOnConnect}
                    onCheckedChange={(checked) => handleUpdateSettings('markOnlineOnConnect', checked)}
                  />
                </div>

                <Separator className="bg-slate-700" />




              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center text-white">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mr-3">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  Confirmações de Leitura
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Marcar Mensagens como Lidas</Label>
                    <p className="text-sm text-slate-400">
                      Marca automaticamente as mensagens como lidas
                    </p>
                  </div>
                  <Switch
                    checked={formData.markMessagesRead}
                    onCheckedChange={(checked) => handleUpdateSettings('markMessagesRead', checked)}
                  />
                </div>

                <Separator className="bg-slate-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enviar Confirmações de Leitura</Label>
                    <p className="text-sm text-slate-400">
                      Envia os ticks azuis quando lê mensagens
                    </p>
                  </div>
                  <Switch
                    checked={formData.sendReadReceipts}
                    onCheckedChange={(checked) => handleUpdateSettings('sendReadReceipts', checked)}
                  />
                </div>


              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center text-white">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg mr-3">
                    <Image className="w-5 h-5 text-white" />
                  </div>
                  Mídia
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Download Automático de Mídia</Label>
                    <p className="text-sm text-slate-400">
                      Baixa automaticamente imagens, vídeos e áudios
                    </p>
                  </div>
                  <Switch
                    checked={formData.autoDownloadMedia}
                    onCheckedChange={(checked) => handleUpdateSettings('autoDownloadMedia', checked)}
                  />
                </div>

                <Separator className="bg-slate-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Download Automático de Documentos</Label>
                    <p className="text-sm text-slate-400">
                      Baixa automaticamente PDFs e outros documentos
                    </p>
                  </div>
                  <Switch
                    checked={formData.autoDownloadDocuments}
                    onCheckedChange={(checked) => handleUpdateSettings('autoDownloadDocuments', checked)}
                  />
                </div>

                <Separator className="bg-slate-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Salvar Histórico de Chat</Label>
                    <p className="text-sm text-slate-400">
                      Mantém o histórico de conversas no banco de dados
                    </p>
                  </div>
                  <Switch
                    checked={formData.saveChatHistory}
                    onCheckedChange={(checked) => handleUpdateSettings('saveChatHistory', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center text-white">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg mr-3">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  Fotos dos Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mostrar Fotos dos Clientes</Label>
                    <p className="text-sm text-slate-400">
                      Quando desativado, mostra apenas as iniciais em todos os lugares
                    </p>
                  </div>
                  <Switch
                    checked={formData.fetchClientPhotos}
                    onCheckedChange={(checked) => handleUpdateSettings('fetchClientPhotos', checked)}
                  />
                </div>

                <Separator className="bg-slate-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Cachear Fotos dos Clientes</Label>
                    <p className="text-sm text-slate-400">
                      Salva as fotos localmente para carregamento rápido
                    </p>
                  </div>
                  <Switch
                    checked={formData.cacheClientPhotos}
                    onCheckedChange={(checked) => handleUpdateSettings('cacheClientPhotos', checked)}
                    disabled={!formData.fetchClientPhotos}
                  />
                </div>

                <Separator className="bg-slate-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mostrar Status dos Clientes</Label>
                    <p className="text-sm text-slate-400">
                      Exibe o status/recado dos clientes nas conversas
                    </p>
                  </div>
                  <Switch
                    checked={formData.showClientStatus}
                    onCheckedChange={(checked) => handleUpdateSettings('showClientStatus', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center text-white">
                  <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg mr-3">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  Configurações Avançadas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="reconnectInterval">Intervalo de Reconexão (ms)</Label>
                  <Input
                    id="reconnectInterval"
                    type="number"
                    value={formData.reconnectInterval}
                    onChange={(e) => handleUpdateSettings('reconnectInterval', parseInt(e.target.value))}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-sm text-slate-400">
                    Tempo de espera antes de tentar reconectar
                  </p>
                </div>

                <Separator className="bg-slate-700" />

                <div className="space-y-2">
                  <Label htmlFor="maxReconnectRetries">Máximo de Tentativas de Reconexão</Label>
                  <Input
                    id="maxReconnectRetries"
                    type="number"
                    value={formData.maxReconnectRetries}
                    onChange={(e) => handleUpdateSettings('maxReconnectRetries', parseInt(e.target.value))}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-sm text-slate-400">
                    Número máximo de tentativas antes de desistir
                  </p>
                </div>

                <Separator className="bg-slate-700" />

                <div className="space-y-2">
                  <Label htmlFor="logLevel">Nível de Log</Label>
                  <Select
                    value={formData.logLevel}
                    onValueChange={(value) => handleUpdateSettings('logLevel', value as WhatsAppSettings['logLevel'])}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Aviso</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-slate-400">
                    Define o nível de detalhes nos logs do sistema
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center text-white">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg mr-3">
                    <Info className="w-5 h-5 text-white" />
                  </div>
                  Informações do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-2 text-sm text-slate-400">
                <p>Biblioteca: @whiskeysockets/baileys</p>
                <p>Versão: Última estável</p>
                <p>Multi-dispositivo: Habilitado</p>
                <p>WebSocket: Ativo</p>
              </CardContent>
            </Card>
            
            {/* Disconnect Button */}
            {isConnected && (
              <Card className="bg-slate-800 border-slate-700 shadow-xl">
                <CardHeader className="border-b border-slate-700">
                  <CardTitle className="flex items-center text-white">
                    <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-lg mr-3">
                      <WifiOff className="w-5 h-5 text-white" />
                    </div>
                    Desconectar WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <p className="text-sm text-slate-400">
                    Desconectar o WhatsApp removerá o dispositivo vinculado. Você precisará escanear o QR Code novamente para reconectar.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDisconnectDialog(true)}
                    disabled={disconnectMutation.isPending}
                    className="w-full"
                  >
                    {disconnectMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Desconectando...
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 mr-2" />
                        Desconectar
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Disconnect Confirmation Dialog */}
        <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <AlertDialogContent className="bg-dark-card text-white border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Desconexão</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Tem certeza que deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente para reconectar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-700 border-slate-600 hover:bg-slate-600 text-white">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => disconnectMutation.mutate()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Desconectar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}