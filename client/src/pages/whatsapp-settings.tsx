import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, User, Wifi, MessageSquare, Users, 
  CheckCircle, Loader2, WifiOff, Smartphone, 
  Download, Save, Eye, EyeOff, Bell, RefreshCw,
  RotateCw, Camera, Upload, Info, Phone, QrCode, X
} from 'lucide-react';
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
  showProfilePhotosChat: boolean;
  showProfilePhotosClientes: boolean;
  reconnectInterval: number;
  maxReconnectRetries: number;
  logLevel: string;
}

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'qr' | 'phone'>('qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get WhatsApp status
  const { data: whatsappStatus } = useQuery({
    queryKey: ['/api/whatsapp/status'],
    staleTime: 0,
    refetchInterval: 2000, // Atualiza mais rapidamente para capturar QR code
  });
  
  // Get current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/whatsapp/settings'],
    staleTime: 0,
  });

  const [formData, setFormData] = useState<WhatsAppSettings>({
    profileName: settings?.profileName || '',
    profileStatus: settings?.profileStatus || '',
    profilePicture: settings?.profilePicture || null,
    markOnlineOnConnect: settings?.markOnlineOnConnect ?? false,

    generateHighQualityLinkPreview: settings?.generateHighQualityLinkPreview ?? true,
    markMessagesRead: settings?.markMessagesRead ?? true,
    sendReadReceipts: settings?.sendReadReceipts ?? true,
    autoDownloadMedia: settings?.autoDownloadMedia ?? true,
    autoDownloadDocuments: settings?.autoDownloadDocuments ?? true,
    saveChatHistory: settings?.saveChatHistory ?? true,
    fetchClientPhotos: settings?.fetchClientPhotos ?? false,
    cacheClientPhotos: settings?.cacheClientPhotos ?? true,
    showClientStatus: settings?.showClientStatus ?? true,
    showProfilePhotosChat: settings?.showProfilePhotosChat ?? true,
    showProfilePhotosClientes: settings?.showProfilePhotosClientes ?? true,
    reconnectInterval: settings?.reconnectInterval ?? 5000,
    maxReconnectRetries: settings?.maxReconnectRetries ?? 5,
    logLevel: settings?.logLevel ?? 'info',
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setHasLoadedSettings(true);
    }
  }, [settings]);

  // Debounced values for text inputs
  const debouncedName = useDebounce(formData.profileName, 1500);
  const debouncedStatus = useDebounce(formData.profileStatus, 1500);

  // Save changes when debounced values change (only if not typing and settings have been loaded)
  useEffect(() => {
    if (!isLoading && hasLoadedSettings && settings && !isTyping && 
        (debouncedName !== settings.profileName || debouncedStatus !== settings.profileStatus)) {
      updateSettingsMutation.mutate({
        profileName: debouncedName,
        profileStatus: debouncedStatus,
      });
    }
  }, [debouncedName, debouncedStatus, settings, isLoading, isTyping, hasLoadedSettings]);

  const connectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/connect'),
    onSuccess: () => {
      toast({
        title: 'Conectando WhatsApp',
        description: 'Aguarde enquanto geramos o QR Code...',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
    },
    onError: () => {
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível conectar ao WhatsApp.',
        variant: 'destructive',
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<WhatsAppSettings>) => 
      apiRequest('PATCH', '/api/whatsapp/settings', data),
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

  const updateProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      
      return apiRequest('POST', '/api/whatsapp/profile-picture', { image: base64 });
    },
    onSuccess: () => {
      toast({
        title: 'Foto atualizada',
        description: 'A foto do perfil foi atualizada com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/settings'] });
    },
    onError: () => {
      toast({
        title: 'Erro ao atualizar foto',
        description: 'Não foi possível atualizar a foto do perfil.',
        variant: 'destructive',
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/disconnect'),
    onSuccess: () => {
      toast({
        title: 'WhatsApp desconectado',
        description: 'WhatsApp foi desconectado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
      setShowDisconnectDialog(false);
    },
    onError: () => {
      toast({
        title: 'Erro ao desconectar',
        description: 'Não foi possível desconectar o WhatsApp.',
        variant: 'destructive',
      });
    },
  });
  
  const clearSessionMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/clear-session'),
    onSuccess: () => {
      toast({
        title: 'Sessão limpa',
        description: 'Sessão do WhatsApp foi limpa com sucesso. Conectando novamente...',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
      // Try to connect automatically after clearing
      setTimeout(() => {
        connectMutation.mutate();
      }, 1000);
    },
    onError: () => {
      toast({
        title: 'Erro ao limpar sessão',
        description: 'Não foi possível limpar a sessão do WhatsApp.',
        variant: 'destructive',
      });
    },
  });

  const handleUpdateSettings = (key: keyof WhatsAppSettings, value: any) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    
    // For text inputs, just update state, debounce will handle saving
    if (key === 'profileName' || key === 'profileStatus') {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 1500);
    } else {
      // For other settings, save immediately
      updateSettingsMutation.mutate({ [key]: value });
    }
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePictureFile(file);
      updateProfilePictureMutation.mutate(file);
    }
  };

  const renderQRCode = () => {
    if (!whatsappStatus?.qr) {
      console.log('QR code não disponível:', whatsappStatus);
      return null;
    }
    
    console.log('Renderizando QR code:', whatsappStatus.qr);
    
    return (
      <div 
        className="bg-white p-4 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 hover:shadow-xl"
        onClick={() => setShowQrModal(true)}
        title="Clique para ampliar"
      >
        <div className="text-center">
          <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(whatsappStatus.qr)}`} 
              alt="QR Code WhatsApp" 
              className="w-full h-full object-contain"
              style={{ pointerEvents: 'none' }}
            />
          </div>
          <p className="text-gray-600 text-sm">
            Escaneie o QR Code com seu WhatsApp
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Clique para ampliar
          </p>
        </div>
      </div>
    );
  };

  const isConnected = whatsappStatus?.status?.connection === 'open';
  const isConnecting = whatsappStatus?.status?.connection === 'connecting';
  
  console.log('WhatsApp status:', {
    status: whatsappStatus,
    isConnected,
    isConnecting,
    hasQR: !!whatsappStatus?.qr
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 md:p-6 backdrop-blur-sm border-b border-slate-700/50">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Settings className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Configurações do WhatsApp
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1">Personalize seu WhatsApp Business</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
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
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => clearSessionMutation.mutate()}
                  disabled={clearSessionMutation.isPending}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                  title="Limpar sessão e reconectar"
                >
                  {clearSessionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCw className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending || isConnecting}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
                >
                  {connectMutation.isPending || isConnecting ? (
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
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Connection Card */}
        {!isConnected && (
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center text-white">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mr-3">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                Conectar WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* Connection Mode Toggle */}
              <div className="flex items-center justify-center gap-2 p-1 bg-slate-700 rounded-lg">
                <Button
                  size="sm"
                  variant={connectionMode === 'qr' ? 'default' : 'ghost'}
                  onClick={() => setConnectionMode('qr')}
                  className={`flex-1 md:flex-initial ${connectionMode === 'qr' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'text-slate-400 hover:text-white'}`}
                >
                  <QrCode className="w-4 h-4 mr-1 md:mr-2" />
                  <span className="text-xs md:text-sm">QR Code</span>
                </Button>
                <Button
                  size="sm"
                  variant={connectionMode === 'phone' ? 'default' : 'ghost'}
                  onClick={() => setConnectionMode('phone')}
                  className={`flex-1 md:flex-initial ${connectionMode === 'phone' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'text-slate-400 hover:text-white'}`}
                >
                  <Phone className="w-4 h-4 mr-1 md:mr-2" />
                  <span className="text-xs md:text-sm">Número</span>
                </Button>
              </div>

              {/* QR Code Mode */}
              {connectionMode === 'qr' && whatsappStatus?.qr && renderQRCode()}
              
              {/* Phone Number Mode */}
              {connectionMode === 'phone' && (
                <div className="space-y-4">
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <h4 className="text-white font-medium mb-3">Conectar por Número</h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="phoneNumber" className="text-slate-300">
                          Número de Telefone
                        </Label>
                        <Input
                          id="phoneNumber"
                          type="tel"
                          placeholder="+55 11 99999-9999"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="bg-slate-600 border-slate-500 text-white placeholder:text-slate-400"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          Digite seu número completo com código do país
                        </p>
                      </div>
                      
                      <Button
                        onClick={() => {
                          // Request pairing code
                          apiRequest('POST', '/api/whatsapp/request-pairing-code', { phoneNumber })
                            .then((response: any) => {
                              if (response.data === 'USE_QR_CODE') {
                                toast({
                                  title: 'Use o QR Code',
                                  description: 'O pareamento por número ainda não está disponível. Por favor, use o QR code.',
                                  variant: 'default',
                                });
                                setConnectionMode('qr');
                              } else {
                                toast({
                                  title: 'Código Solicitado',
                                  description: 'Verifique seu WhatsApp para obter o código de pareamento.',
                                });
                              }
                            })
                            .catch(() => {
                              toast({
                                title: 'Erro',
                                description: 'Não foi possível solicitar o código.',
                                variant: 'destructive',
                              });
                            });
                        }}
                        disabled={!phoneNumber || phoneNumber.length < 10}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                      >
                        Solicitar Código
                      </Button>
                    </div>
                  </div>

                  {/* Pairing Code Input */}
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <Label htmlFor="pairingCode" className="text-slate-300">
                      Código de Pareamento
                    </Label>
                    <Input
                      id="pairingCode"
                      type="text"
                      placeholder="1234-5678"
                      value={pairingCode}
                      onChange={(e) => setPairingCode(e.target.value)}
                      className="bg-slate-600 border-slate-500 text-white placeholder:text-slate-400"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Digite o código de 8 dígitos que aparece no seu WhatsApp
                    </p>
                    
                    <Button
                      onClick={() => {
                        // Connect with pairing code
                        apiRequest('POST', '/api/whatsapp/connect-pairing', { 
                          phoneNumber, 
                          pairingCode: pairingCode.replace('-', '') 
                        })
                          .then(() => {
                            toast({
                              title: 'Conectando',
                              description: 'Estabelecendo conexão com WhatsApp...',
                            });
                            queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
                          })
                          .catch(() => {
                            toast({
                              title: 'Erro',
                              description: 'Código inválido ou expirado.',
                              variant: 'destructive',
                            });
                          });
                      }}
                      disabled={!pairingCode || pairingCode.length < 4}
                      className="w-full mt-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                    >
                      Conectar
                    </Button>
                  </div>

                  <div className="bg-blue-950/50 border border-blue-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2 text-sm">
                        <p className="text-blue-300 font-medium">Como conectar pelo número:</p>
                        <ol className="space-y-1 text-slate-400 list-decimal list-inside">
                          <li>Digite seu número de telefone completo</li>
                          <li>Clique em "Solicitar Código"</li>
                          <li>No WhatsApp, vá em Configurações → Aparelhos conectados</li>
                          <li>Toque em "Conectar aparelho" → "Conectar com número"</li>
                          <li>Digite o código de 8 dígitos que aparecerá</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current WhatsApp Account Info */}
        {isConnected && whatsappStatus?.userProfile && (
          <Card className="bg-gradient-to-br from-green-900/20 to-slate-800 border-green-700/50 shadow-xl">
            <CardHeader className="border-b border-green-700/30">
              <CardTitle className="flex items-center text-white">
                <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg mr-3">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                Conta WhatsApp Conectada
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-700 border-2 border-green-600 shadow-lg">
                  {whatsappStatus.userProfile.profilePicture ? (
                    <img 
                      src={whatsappStatus.userProfile.profilePicture} 
                      alt="WhatsApp Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">
                    {whatsappStatus.userProfile.name || 'Sem nome'}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {whatsappStatus.userProfile.jid}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings Tabs */}
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
                  <div className="space-y-1">
                    <Input
                      id="profileName"
                      value={formData.profileName}
                      onChange={(e) => handleUpdateSettings('profileName', e.target.value)}
                      placeholder={whatsappStatus?.userProfile?.name || "Nome exibido no WhatsApp"}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    {whatsappStatus?.userProfile?.name && !formData.profileName && (
                      <p className="text-xs text-slate-400">
                        Nome atual do WhatsApp: <span className="font-medium text-slate-300">{whatsappStatus.userProfile.name}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileStatus">Status</Label>
                  <div className="space-y-1">
                    <Input
                      id="profileStatus"
                      value={formData.profileStatus}
                      onChange={(e) => handleUpdateSettings('profileStatus', e.target.value)}
                      placeholder="Hey there! I am using WhatsApp"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <p className="text-xs text-slate-500">
                      Digite um status personalizado ou deixe vazio para usar o padrão
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Foto do Perfil</Label>
                  <div className="flex items-start gap-6">
                    {/* Profile Picture Display */}
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-700 border-2 border-slate-600 shadow-xl">
                        {formData.profilePicture || whatsappStatus?.userProfile?.profilePicture ? (
                          <img 
                            src={formData.profilePicture || whatsappStatus?.userProfile?.profilePicture} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-16 h-16 text-slate-500" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 w-32 h-32 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      >
                        <Camera className="w-8 h-8 text-white" />
                      </button>
                    </div>
                    
                    {/* Upload Section */}
                    <div className="flex-1 space-y-3">
                      <div className="space-y-2">
                        <p className="text-sm text-slate-400">
                          {whatsappStatus?.userProfile?.profilePicture 
                            ? 'Usando foto atual do WhatsApp' 
                            : 'Adicione uma foto de perfil'}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Escolher Foto
                          </Button>
                          {formData.profilePicture && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                handleUpdateSettings('profilePicture', null);
                                updateSettingsMutation.mutate({ profilePicture: null });
                              }}
                              className="border-red-600 text-red-400 hover:bg-red-950"
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        Formatos aceitos: JPG, PNG. Tamanho máximo: 5MB
                      </p>
                    </div>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="hidden"
                  />
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
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg mr-3">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  Download de Mídia
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
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg mr-3">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  Configurações de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Buscar Fotos dos Clientes</Label>
                    <p className="text-sm text-slate-400">
                      Busca automaticamente as fotos de perfil dos contatos
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
                      Armazena as fotos de perfil para acesso mais rápido
                    </p>
                  </div>
                  <Switch
                    checked={formData.cacheClientPhotos}
                    onCheckedChange={(checked) => handleUpdateSettings('cacheClientPhotos', checked)}
                  />
                </div>

                <Separator className="bg-slate-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mostrar Status dos Clientes</Label>
                    <p className="text-sm text-slate-400">
                      Exibe o status online/offline dos contatos
                    </p>
                  </div>
                  <Switch
                    checked={formData.showClientStatus}
                    onCheckedChange={(checked) => handleUpdateSettings('showClientStatus', checked)}
                  />
                </div>

                <Separator className="bg-slate-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mostrar Fotos no Chat</Label>
                    <p className="text-sm text-slate-400">
                      Exibe fotos de perfil nas conversas do chat
                    </p>
                  </div>
                  <Switch
                    checked={formData.showProfilePhotosChat}
                    onCheckedChange={(checked) => handleUpdateSettings('showProfilePhotosChat', checked)}
                  />
                </div>

                <Separator className="bg-slate-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mostrar Fotos em Clientes</Label>
                    <p className="text-sm text-slate-400">
                      Exibe fotos de perfil na página de clientes
                    </p>
                  </div>
                  <Switch
                    checked={formData.showProfilePhotosClientes}
                    onCheckedChange={(checked) => handleUpdateSettings('showProfilePhotosClientes', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700 shadow-xl">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="flex items-center text-white">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg mr-3">
                    <RefreshCw className="w-5 h-5 text-white" />
                  </div>
                  Configurações de Reconexão
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
                    Tempo entre tentativas de reconexão
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxReconnectRetries">Máximo de Tentativas</Label>
                  <Input
                    id="maxReconnectRetries"
                    type="number"
                    value={formData.maxReconnectRetries}
                    onChange={(e) => handleUpdateSettings('maxReconnectRetries', parseInt(e.target.value))}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-sm text-slate-400">
                    Número máximo de tentativas de reconexão
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* QR Code Modal Expandido */}
      {showQrModal && whatsappStatus?.qr && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]"
          onClick={() => setShowQrModal(false)}
        >
          <div 
            className="bg-white p-8 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQrModal(false)}
                className="hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(whatsappStatus.qr)}`}
              alt="QR Code Ampliado"
              className="w-96 h-96"
            />
            <p className="text-center text-gray-600 mt-4">
              Escaneie com o WhatsApp para conectar
            </p>
          </div>
        </div>
      )}

      {/* Disconnect Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Desconectar WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Tem certeza que deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente para reconectar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectMutation.mutate()}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0"
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}