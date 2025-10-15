import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, User, Wifi, MessageSquare, Image, Users, Wrench, QrCode, Upload, Camera } from 'lucide-react';
import QRCode from 'react-qr-code';

interface WhatsAppSettings {
  profileName: string;
  profileStatus: string;
  profilePicture: string | null;
  markOnlineOnConnect: boolean;

  generateHighQualityLinkPreview: boolean;
  markMessagesRead: boolean;
  sendReadReceipts: boolean;
  autoDownloadMedia: boolean;
  autoDownloadDocuments: boolean;
  saveChatHistory: boolean;
  fetchClientPhotos: boolean;
  cacheClientPhotos: boolean;
  showClientStatus: boolean;
  reconnectInterval: number;
  maxReconnectRetries: number;
  logLevel: string;
}

interface WhatsAppStatus {
  status: {
    connection: string;
  };
  qr: string | null;
}

export default function WhatsAppConfig() {
  const { toast } = useToast();
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  
  // Get WhatsApp status
  const { data: whatsappStatus } = useQuery({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: 2000,
  });
  
  // Get current settings
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['/api/whatsapp/settings'],
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const [formData, setFormData] = useState<WhatsAppSettings>({
    profileName: '',
    profileStatus: '',
    profilePicture: '',
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
    if (settings && !isLoading) {
      setFormData({
        profileName: settings.profileName || '',
        profileStatus: settings.profileStatus || '',
        profilePicture: settings.profilePicture || '',
        markOnlineOnConnect: settings.markOnlineOnConnect || false,

        markMessagesRead: settings.markMessagesRead || true,
        sendReadReceipts: settings.sendReadReceipts || true,
        autoDownloadMedia: settings.autoDownloadMedia || true,
        autoDownloadDocuments: settings.autoDownloadDocuments || true,
        saveChatHistory: settings.saveChatHistory || true,
        fetchClientPhotos: settings.fetchClientPhotos || false,
        cacheClientPhotos: settings.cacheClientPhotos || true,
        showClientStatus: settings.showClientStatus || true,
        reconnectInterval: settings.reconnectInterval || 5000,
        maxReconnectRetries: settings.maxReconnectRetries || 5,
        logLevel: settings.logLevel || 'info',
      });
    }
  }, [settings, isLoading]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<WhatsAppSettings>) => {
      const res = await apiRequest('PUT', '/api/whatsapp/settings', data);
      return res.json();
    },
    onSuccess: async (data, variables) => {
      setIsSaving(null);
      toast({
        title: 'Configurações atualizadas ✓',
        description: 'As configurações foram salvas com sucesso.',
      });
      await refetch();
    },
    onError: (error: any) => {
      setIsSaving(null);
      toast({
        title: 'Erro ao salvar',
        description: error?.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    },
  });

  // Update profile picture mutation
  const updateProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profilePicture', file);
      const res = await fetch('/api/whatsapp/profile-picture', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
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

  // Connect WhatsApp mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/whatsapp/connect');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Conectando WhatsApp',
        description: 'Iniciando conexão com WhatsApp...',
      });
    },
  });

  // Disconnect WhatsApp mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/whatsapp/disconnect');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'WhatsApp desconectado',
        description: 'Conexão encerrada com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
    },
  });

  const handleSaveSettings = async (field: keyof WhatsAppSettings) => {
    setIsSaving(field);
    // Send only the field being updated
    updateSettingsMutation.mutate({ [field]: formData[field] });
  };

  const handleProfilePictureUpload = () => {
    if (profilePictureFile) {
      updateProfilePictureMutation.mutate(profilePictureFile);
    }
  };

  const isConnected = whatsappStatus?.status?.connection === 'open';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-center mb-8 p-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl shadow-xl border border-slate-700">
        <div className="p-4 bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl shadow-lg mr-5">
          <Settings className="h-10 w-10 text-white animate-pulse" />
        </div>
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-white mb-2">
            Configurações do WhatsApp
          </h1>
          <p className="text-slate-300 text-lg">
            Personalize todas as opções do seu WhatsApp Business
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isConnected ? (
            <div className="flex items-center gap-3 bg-blue-500/20 px-4 py-2 rounded-lg border border-blue-500/30">
              <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-400 font-medium">Conectado</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-slate-500/20 px-4 py-2 rounded-lg border border-slate-500/30">
              <div className="h-3 w-3 bg-slate-500 rounded-full"></div>
              <span className="text-slate-400 font-medium">Desconectado</span>
            </div>
          )}
        </div>
      </div>

      {/* Connection Status & QR Code */}
      <Card className="mb-6 bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-blue-500' : 'bg-slate-500'}`} />
              <span className="text-sm">
                {isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
              </span>
            </div>
            {isConnected ? (
              <Button
                onClick={() => disconnectMutation.mutate()}
                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                size="sm"
              >
                Desconectar
              </Button>
            ) : (
              <Button
                onClick={() => connectMutation.mutate()}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                size="sm"
              >
                Conectar
              </Button>
            )}
          </div>
          
          {!isConnected && whatsappStatus?.qr && (
            <div className="flex justify-center p-8 bg-white rounded-lg">
              <QRCode value={whatsappStatus.qr} size={256} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Tabs */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-6">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-slate-800">
              <TabsTrigger value="profile" className="data-[state=active]:bg-slate-700">
                <User className="h-4 w-4 mr-2" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="connection" className="data-[state=active]:bg-slate-700">
                <Wifi className="h-4 w-4 mr-2" />
                Conexão
              </TabsTrigger>
              <TabsTrigger value="messages" className="data-[state=active]:bg-slate-700">
                <MessageSquare className="h-4 w-4 mr-2" />
                Mensagens
              </TabsTrigger>
              <TabsTrigger value="media" className="data-[state=active]:bg-slate-700">
                <Image className="h-4 w-4 mr-2" />
                Mídia
              </TabsTrigger>
              <TabsTrigger value="clients" className="data-[state=active]:bg-slate-700">
                <Users className="h-4 w-4 mr-2" />
                Clientes
              </TabsTrigger>
              <TabsTrigger value="advanced" className="data-[state=active]:bg-slate-700">
                <Wrench className="h-4 w-4 mr-2" />
                Avançado
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6 mt-6">
              <div className="grid gap-6">
                {/* Profile Name */}
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-all">
                  <div className="flex items-center mb-4">
                    <User className="h-5 w-5 text-blue-400 mr-3" />
                    <Label htmlFor="profileName" className="text-lg font-semibold text-white">
                      Nome do Perfil
                    </Label>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      id="profileName"
                      value={formData.profileName || ''}
                      onChange={(e) => setFormData({ ...formData, profileName: e.target.value })}
                      placeholder="Ex: TV ON Suporte"
                      className="flex-1 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 transition-all"
                    />
                    <Button 
                      onClick={() => handleSaveSettings('profileName')}
                      disabled={isSaving === 'profileName'}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium px-6"
                    >
                      {isSaving === 'profileName' ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Salvando...
                        </>
                      ) : (
                        'Salvar'
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    Este nome será exibido para seus clientes no WhatsApp
                  </p>
                </div>

                {/* Profile Status */}
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-all">
                  <div className="flex items-center mb-4">
                    <MessageSquare className="h-5 w-5 text-blue-400 mr-3" />
                    <Label htmlFor="profileStatus" className="text-lg font-semibold text-white">
                      Status do Perfil
                    </Label>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      id="profileStatus"
                      value={formData.profileStatus || ''}
                      onChange={(e) => setFormData({ ...formData, profileStatus: e.target.value })}
                      placeholder="Ex: Atendimento 24/7 📺"
                      className="flex-1 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 transition-all"
                    />
                    <Button 
                      onClick={() => handleSaveSettings('profileStatus')}
                      disabled={isSaving === 'profileStatus'}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium px-6"
                    >
                      {isSaving === 'profileStatus' ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Salvando...
                        </>
                      ) : (
                        'Salvar'
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    Seu status aparece no perfil do WhatsApp
                  </p>
                </div>

                {/* Profile Picture */}
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-all">
                  <div className="flex items-center mb-4">
                    <Image className="h-5 w-5 text-blue-400 mr-3" />
                    <Label htmlFor="profilePicture" className="text-lg font-semibold text-white">
                      Foto do Perfil
                    </Label>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        id="profilePicture"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setProfilePictureFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <label
                        htmlFor="profilePicture"
                        className="flex items-center gap-3 px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 transition-all"
                      >
                        <Camera className="h-5 w-5 text-slate-400" />
                        <span className="text-slate-300">
                          {profilePictureFile ? profilePictureFile.name : 'Escolher imagem'}
                        </span>
                      </label>
                    </div>
                    <Button 
                      onClick={handleProfilePictureUpload}
                      disabled={!profilePictureFile || updateProfilePictureMutation.isPending}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium px-6 disabled:opacity-50"
                    >
                      {updateProfilePictureMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Enviar Foto
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    Recomendado: imagem quadrada, mínimo 500x500 pixels
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Connection Tab */}
            <TabsContent value="connection" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="markOnlineOnConnect">Marcar como online ao conectar</Label>
                  <p className="text-sm text-slate-400">Aparecer online automaticamente ao conectar</p>
                </div>
                <Switch
                  id="markOnlineOnConnect"
                  checked={formData.markOnlineOnConnect}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, markOnlineOnConnect: checked });
                    handleSaveSettings('markOnlineOnConnect');
                  }}
                />
              </div>

              <Separator className="bg-slate-700" />


            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="markMessagesRead">Marcar mensagens como lidas</Label>
                  <p className="text-sm text-slate-400">Marcar automaticamente mensagens recebidas como lidas</p>
                </div>
                <Switch
                  id="markMessagesRead"
                  checked={formData.markMessagesRead}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, markMessagesRead: checked });
                    handleSaveSettings('markMessagesRead');
                  }}
                />
              </div>

              <Separator className="bg-slate-700" />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sendReadReceipts">Enviar confirmação de leitura</Label>
                  <p className="text-sm text-slate-400">Enviar ticks azuis quando ler mensagens</p>
                </div>
                <Switch
                  id="sendReadReceipts"
                  checked={formData.sendReadReceipts}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, sendReadReceipts: checked });
                    handleSaveSettings('sendReadReceipts');
                  }}
                />
              </div>


            </TabsContent>

            {/* Media Tab */}
            <TabsContent value="media" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoDownloadMedia">Download automático de mídia</Label>
                  <p className="text-sm text-slate-400">Baixar automaticamente imagens, vídeos e áudios</p>
                </div>
                <Switch
                  id="autoDownloadMedia"
                  checked={formData.autoDownloadMedia}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, autoDownloadMedia: checked });
                    handleSaveSettings('autoDownloadMedia');
                  }}
                />
              </div>

              <Separator className="bg-slate-700" />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoDownloadDocuments">Download automático de documentos</Label>
                  <p className="text-sm text-slate-400">Baixar automaticamente PDFs e outros documentos</p>
                </div>
                <Switch
                  id="autoDownloadDocuments"
                  checked={formData.autoDownloadDocuments}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, autoDownloadDocuments: checked });
                    handleSaveSettings('autoDownloadDocuments');
                  }}
                />
              </div>

              <Separator className="bg-slate-700" />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="saveChatHistory">Salvar histórico de conversas</Label>
                  <p className="text-sm text-slate-400">Manter histórico de todas as conversas no banco de dados</p>
                </div>
                <Switch
                  id="saveChatHistory"
                  checked={formData.saveChatHistory}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, saveChatHistory: checked });
                    handleSaveSettings('saveChatHistory');
                  }}
                />
              </div>
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="fetchClientPhotos">Mostrar fotos dos contatos</Label>
                  <p className="text-sm text-slate-400">Exibir fotos de perfil no chat, lista de conversas e página de clientes</p>
                </div>
                <Switch
                  id="fetchClientPhotos"
                  checked={formData.fetchClientPhotos}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, fetchClientPhotos: checked });
                    handleSaveSettings('fetchClientPhotos');
                  }}
                />
              </div>

              <Separator className="bg-slate-700" />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="cacheClientPhotos">Armazenar fotos em cache</Label>
                  <p className="text-sm text-slate-400">Manter fotos dos clientes em cache local</p>
                </div>
                <Switch
                  id="cacheClientPhotos"
                  checked={formData.cacheClientPhotos}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, cacheClientPhotos: checked });
                    handleSaveSettings('cacheClientPhotos');
                  }}
                />
              </div>

              <Separator className="bg-slate-700" />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showClientStatus">Mostrar status dos clientes</Label>
                  <p className="text-sm text-slate-400">Exibir status online/offline dos contatos</p>
                </div>
                <Switch
                  id="showClientStatus"
                  checked={formData.showClientStatus}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, showClientStatus: checked });
                    handleSaveSettings('showClientStatus');
                  }}
                />
              </div>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-4 mt-6">
              <div>
                <Label htmlFor="reconnectInterval">Intervalo de reconexão (ms)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="reconnectInterval"
                    type="number"
                    value={formData.reconnectInterval}
                    onChange={(e) => setFormData({ ...formData, reconnectInterval: parseInt(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                  <Button onClick={() => handleSaveSettings('reconnectInterval')}>
                    Salvar
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="maxReconnectRetries">Tentativas máximas de reconexão</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="maxReconnectRetries"
                    type="number"
                    value={formData.maxReconnectRetries}
                    onChange={(e) => setFormData({ ...formData, maxReconnectRetries: parseInt(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                  <Button onClick={() => handleSaveSettings('maxReconnectRetries')}>
                    Salvar
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="logLevel">Nível de log</Label>
                <div className="flex gap-2 mt-2">
                  <Select
                    value={formData.logLevel}
                    onValueChange={(value) => {
                      setFormData({ ...formData, logLevel: value });
                      handleSaveSettings('logLevel');
                    }}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}