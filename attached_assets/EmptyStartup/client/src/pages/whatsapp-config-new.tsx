import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Settings, 
  User, 
  Wifi, 
  MessageSquare, 
  Image, 
  Users, 
  Wrench, 
  QrCode, 
  Upload, 
  Camera,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  Save,
  WifiOff,
  Bell,
  Download,
  History,
  Shield,
  Zap,
  RefreshCw
} from 'lucide-react';
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

export default function WhatsAppConfigNew() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
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

        generateHighQualityLinkPreview: settings.generateHighQualityLinkPreview === undefined ? true : settings.generateHighQualityLinkPreview,
        markMessagesRead: settings.markMessagesRead === undefined ? true : settings.markMessagesRead,
        sendReadReceipts: settings.sendReadReceipts === undefined ? true : settings.sendReadReceipts,
        autoDownloadMedia: settings.autoDownloadMedia === undefined ? true : settings.autoDownloadMedia,
        autoDownloadDocuments: settings.autoDownloadDocuments === undefined ? true : settings.autoDownloadDocuments,
        saveChatHistory: settings.saveChatHistory === undefined ? true : settings.saveChatHistory,
        fetchClientPhotos: settings.fetchClientPhotos || false,
        cacheClientPhotos: settings.cacheClientPhotos === undefined ? true : settings.cacheClientPhotos,
        showClientStatus: settings.showClientStatus === undefined ? true : settings.showClientStatus,
        reconnectInterval: settings.reconnectInterval || 5000,
        maxReconnectRetries: settings.maxReconnectRetries || 5,
        logLevel: settings.logLevel || 'info',
      });
      setHasChanges(false);
    }
  }, [settings, isLoading]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<WhatsAppSettings>) => {
      const res = await apiRequest('PUT', '/api/whatsapp/settings', data);
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: 'Configurações salvas!',
        description: 'Todas as alterações foram aplicadas com sucesso.',
      });
      await refetch();
      setHasChanges(false);
    },
    onError: (error: any) => {
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
      });
      
      if (!res.ok) throw new Error('Failed to upload profile picture');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Foto atualizada!',
        description: 'A foto do perfil foi atualizada com sucesso.',
      });
      setProfilePictureFile(null);
      setProfilePicturePreview(null);
      // Update form data with new profile picture URL
      if (data.url) {
        setFormData(prev => ({ ...prev, profilePicture: data.url }));
      }
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/settings'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao enviar foto',
        description: error?.message || 'Não foi possível atualizar a foto do perfil.',
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
        description: 'Escaneie o QR Code para conectar.',
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
        description: 'A conexão foi encerrada com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
    },
  });

  const handleFormChange = (field: keyof WhatsAppSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    updateSettingsMutation.mutate(formData);
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePictureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const isConnected = whatsappStatus?.status?.connection === 'open';
  const showQRCode = !isConnected && whatsappStatus?.qr;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header Card */}
      <Card className="mb-6 bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/20">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Settings className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Configurações do WhatsApp</h1>
                <p className="text-slate-400 mt-1">Personalize seu WhatsApp Business</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isConnected ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
              }`}>
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-400" />
                    <span className="text-green-400 font-medium">Conectado</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-400" />
                    <span className="text-red-400 font-medium">Desconectado</span>
                  </>
                )}
              </div>
              
              {/* Connect/Disconnect Button */}
              {isConnected ? (
                <Button
                  variant="destructive"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <WifiOff className="h-4 w-4 mr-2" />
                  )}
                  Desconectar
                </Button>
              ) : (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-2" />
                  )}
                  Conectar
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* QR Code Card */}
      {showQRCode && (
        <Card className="mb-6 border-yellow-500/20 bg-yellow-900/10">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <QrCode className="h-6 w-6 text-yellow-400" />
              <h3 className="text-lg font-semibold text-yellow-400">Escaneie o QR Code</h3>
            </div>
            <div className="flex justify-center p-6 bg-white rounded-lg">
              <QRCode value={whatsappStatus.qr} size={256} />
            </div>
            <p className="text-center text-slate-400 mt-4">
              Abra o WhatsApp no seu celular e escaneie o código para conectar
            </p>
          </div>
        </Card>
      )}

      {/* Settings Tabs */}
      <Card className="bg-slate-900/50 border-slate-700">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-slate-700">
            <TabsList className="grid w-full grid-cols-6 bg-transparent h-auto p-0">
              <TabsTrigger 
                value="profile" 
                className="data-[state=active]:bg-slate-800 rounded-none border-b-2 data-[state=active]:border-green-500 border-transparent"
              >
                <User className="h-4 w-4 mr-2" />
                Perfil
              </TabsTrigger>
              <TabsTrigger 
                value="connection"
                className="data-[state=active]:bg-slate-800 rounded-none border-b-2 data-[state=active]:border-green-500 border-transparent"
              >
                <Wifi className="h-4 w-4 mr-2" />
                Conexão
              </TabsTrigger>
              <TabsTrigger 
                value="messages"
                className="data-[state=active]:bg-slate-800 rounded-none border-b-2 data-[state=active]:border-green-500 border-transparent"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Mensagens
              </TabsTrigger>
              <TabsTrigger 
                value="media"
                className="data-[state=active]:bg-slate-800 rounded-none border-b-2 data-[state=active]:border-green-500 border-transparent"
              >
                <Image className="h-4 w-4 mr-2" />
                Mídia
              </TabsTrigger>
              <TabsTrigger 
                value="clients"
                className="data-[state=active]:bg-slate-800 rounded-none border-b-2 data-[state=active]:border-green-500 border-transparent"
              >
                <Users className="h-4 w-4 mr-2" />
                Clientes
              </TabsTrigger>
              <TabsTrigger 
                value="advanced"
                className="data-[state=active]:bg-slate-800 rounded-none border-b-2 data-[state=active]:border-green-500 border-transparent"
              >
                <Wrench className="h-4 w-4 mr-2" />
                Avançado
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6 mt-0">
              <div className="grid gap-6">
                {/* Profile Picture */}
                <div>
                  <Label className="text-base font-semibold mb-4 flex items-center gap-2">
                    <Camera className="h-5 w-5 text-green-400" />
                    Foto do Perfil
                  </Label>
                  <div className="flex items-start gap-6 mt-4">
                    <div className="relative">
                      <div className="h-32 w-32 rounded-full bg-slate-800 overflow-hidden border-4 border-slate-700">
                        {(profilePicturePreview || formData.profilePicture) ? (
                          <img 
                            src={profilePicturePreview || formData.profilePicture || ''} 
                            alt="Profile" 
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        {!(profilePicturePreview || formData.profilePicture) && (
                          <div className="h-full w-full flex items-center justify-center">
                            <User className="h-16 w-16 text-slate-600" />
                          </div>
                        )}
                      </div>
                      <input
                        id="profilePicture"
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureChange}
                        className="hidden"
                      />
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById('profilePicture')?.click()}
                          className="border-slate-600"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Escolher Foto
                        </Button>
                        {profilePictureFile && (
                          <Button
                            onClick={() => updateProfilePictureMutation.mutate(profilePictureFile)}
                            disabled={updateProfilePictureMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {updateProfilePictureMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Enviar Foto
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">
                        Recomendado: Imagem quadrada de pelo menos 500x500 pixels
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profile Name */}
                <div>
                  <Label htmlFor="profileName" className="text-base font-semibold mb-2 block">
                    Nome do Perfil
                  </Label>
                  <Input
                    id="profileName"
                    value={formData.profileName}
                    onChange={(e) => handleFormChange('profileName', e.target.value)}
                    placeholder="Ex: TV ON Suporte"
                    className="bg-slate-800 border-slate-600"
                  />
                  <p className="text-sm text-slate-400 mt-2">
                    Este nome aparecerá para seus clientes no WhatsApp
                  </p>
                </div>

                {/* Profile Status */}
                <div>
                  <Label htmlFor="profileStatus" className="text-base font-semibold mb-2 block">
                    Status do Perfil
                  </Label>
                  <Input
                    id="profileStatus"
                    value={formData.profileStatus}
                    onChange={(e) => handleFormChange('profileStatus', e.target.value)}
                    placeholder="Ex: Atendimento 24/7 📺"
                    className="bg-slate-800 border-slate-600"
                  />
                  <p className="text-sm text-slate-400 mt-2">
                    Mensagem de status que aparece no seu perfil
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Connection Tab */}
            <TabsContent value="connection" className="space-y-6 mt-0">
              <div className="space-y-4">
                <SettingItem
                  icon={Eye}
                  title="Marcar como Online ao Conectar"
                  description="Mostra que você está online assim que conectar"
                  checked={formData.markOnlineOnConnect}
                  onCheckedChange={(checked) => handleFormChange('markOnlineOnConnect', checked)}
                />
                


              </div>
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="space-y-6 mt-0">
              <div className="space-y-4">
                <SettingItem
                  icon={CheckCircle}
                  title="Marcar Mensagens como Lidas"
                  description="Marca automaticamente as mensagens como lidas"
                  checked={formData.markMessagesRead}
                  onCheckedChange={(checked) => handleFormChange('markMessagesRead', checked)}
                />
                
                <SettingItem
                  icon={CheckCircle}
                  title="Enviar Confirmação de Leitura"
                  description="Envia o visto azul quando ler mensagens"
                  checked={formData.sendReadReceipts}
                  onCheckedChange={(checked) => handleFormChange('sendReadReceipts', checked)}
                />
                

              </div>
            </TabsContent>

            {/* Media Tab */}
            <TabsContent value="media" className="space-y-6 mt-0">
              <div className="space-y-4">
                <SettingItem
                  icon={Download}
                  title="Download Automático de Mídia"
                  description="Baixa automaticamente fotos, vídeos e áudios"
                  checked={formData.autoDownloadMedia}
                  onCheckedChange={(checked) => handleFormChange('autoDownloadMedia', checked)}
                />
                
                <SettingItem
                  icon={Download}
                  title="Download Automático de Documentos"
                  description="Baixa automaticamente PDFs e outros documentos"
                  checked={formData.autoDownloadDocuments}
                  onCheckedChange={(checked) => handleFormChange('autoDownloadDocuments', checked)}
                />
                
                <SettingItem
                  icon={History}
                  title="Salvar Histórico de Chat"
                  description="Mantém um backup local de todas as conversas"
                  checked={formData.saveChatHistory}
                  onCheckedChange={(checked) => handleFormChange('saveChatHistory', checked)}
                />
              </div>
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients" className="space-y-6 mt-0">
              <div className="space-y-4">
                <SettingItem
                  icon={Camera}
                  title="Buscar Fotos dos Clientes"
                  description="Baixa automaticamente as fotos de perfil dos contatos"
                  checked={formData.fetchClientPhotos}
                  onCheckedChange={(checked) => handleFormChange('fetchClientPhotos', checked)}
                />
                
                <SettingItem
                  icon={Shield}
                  title="Fazer Cache de Fotos"
                  description="Armazena as fotos dos clientes localmente"
                  checked={formData.cacheClientPhotos}
                  onCheckedChange={(checked) => handleFormChange('cacheClientPhotos', checked)}
                />
                
                <SettingItem
                  icon={Eye}
                  title="Mostrar Status dos Clientes"
                  description="Exibe o status (recado) dos contatos"
                  checked={formData.showClientStatus}
                  onCheckedChange={(checked) => handleFormChange('showClientStatus', checked)}
                />
              </div>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-6 mt-0">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="reconnectInterval" className="text-base font-semibold mb-2 block">
                    Intervalo de Reconexão (ms)
                  </Label>
                  <Input
                    id="reconnectInterval"
                    type="number"
                    value={formData.reconnectInterval}
                    onChange={(e) => handleFormChange('reconnectInterval', parseInt(e.target.value))}
                    className="bg-slate-800 border-slate-600"
                  />
                  <p className="text-sm text-slate-400 mt-2">
                    Tempo entre tentativas de reconexão (padrão: 5000ms)
                  </p>
                </div>

                <div>
                  <Label htmlFor="maxReconnectRetries" className="text-base font-semibold mb-2 block">
                    Tentativas Máximas de Reconexão
                  </Label>
                  <Input
                    id="maxReconnectRetries"
                    type="number"
                    value={formData.maxReconnectRetries}
                    onChange={(e) => handleFormChange('maxReconnectRetries', parseInt(e.target.value))}
                    className="bg-slate-800 border-slate-600"
                  />
                  <p className="text-sm text-slate-400 mt-2">
                    Número máximo de tentativas antes de desistir (padrão: 5)
                  </p>
                </div>

                <div>
                  <Label htmlFor="logLevel" className="text-base font-semibold mb-2 block">
                    Nível de Log
                  </Label>
                  <Select 
                    value={formData.logLevel} 
                    onValueChange={(value) => handleFormChange('logLevel', value)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="error">Erro</SelectItem>
                      <SelectItem value="warn">Aviso</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-slate-400 mt-2">
                    Define o nível de detalhamento dos logs do sistema
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className="border-t border-slate-700 p-4 bg-slate-800/50">
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveAll}
                  disabled={updateSettingsMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Tabs>
      </Card>
    </div>
  );
}

// Setting Item Component
interface SettingItemProps {
  icon: React.ElementType;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SettingItem({ icon: Icon, title, description, checked, onCheckedChange }: SettingItemProps) {
  return (
    <div className="flex items-start justify-between p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 transition-colors">
      <div className="flex gap-3">
        <Icon className="h-5 w-5 text-green-400 mt-0.5" />
        <div className="space-y-1">
          <Label className="text-base font-medium cursor-pointer">{title}</Label>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-green-600"
      />
    </div>
  );
}