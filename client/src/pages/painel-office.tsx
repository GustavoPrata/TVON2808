import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Copy, CheckCircle, Trash2, Monitor, UserPlus, Globe, RefreshCw, 
  Sparkles, Loader2, Download, Chrome, Wifi, WifiOff, Clock, 
  CheckCircle2, Info, Zap, ArrowRight, Shield, Rocket
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';

interface IPTVUser {
  id: string;
  usuario: string;
  senha: string;
  vencimento?: string;
  createdAt: string;
  source?: 'manual' | 'auto' | 'extension';
}

export default function PainelOffice() {
  const [users, setUsers] = useState<IPTVUser[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState({ usuario: '', senha: '', vencimento: '' });
  const [iframeKey, setIframeKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [lastExtensionSync, setLastExtensionSync] = useState<Date | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [activeTab, setActiveTab] = useState('manual');
  const { toast } = useToast();
  const ws = useWebSocket();

  // Check for extension messages via WebSocket
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'extension_connected') {
          setExtensionConnected(true);
          setLastExtensionSync(new Date());
          toast({
            title: "🔌 Extensão Conectada!",
            description: "A extensão Chrome está pronta para uso",
            variant: "default",
          });
        }
        
        if (data.type === 'extension_credentials') {
          const newUser: IPTVUser = {
            id: Date.now().toString(),
            usuario: data.usuario,
            senha: data.senha,
            vencimento: data.vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
            createdAt: new Date().toISOString(),
            source: 'extension'
          };
          
          setUsers(prev => [...prev, newUser]);
          setLastExtensionSync(new Date());
          setTodayCount(prev => prev + 1);
          
          toast({
            title: "🎉 Credenciais da Extensão!",
            description: `Usuário: ${data.usuario} | Senha: ${data.senha}`,
            variant: "default",
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, toast]);

  // Count today's credentials
  useEffect(() => {
    const today = new Date().toDateString();
    const todayCredentials = users.filter(user => {
      const userDate = new Date(user.createdAt).toDateString();
      return userDate === today;
    });
    setTodayCount(todayCredentials.length);
  }, [users]);

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/office/generate-human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        const newUser: IPTVUser = {
          id: Date.now().toString(),
          usuario: data.usuario,
          senha: data.senha,
          vencimento: data.vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
          createdAt: new Date().toISOString(),
          source: 'auto'
        };
        
        setUsers(prev => [...prev, newUser]);
        
        // Also save to backend
        await saveCredentialsToBackend(newUser);
        
        toast({
          title: "🎉 Gerado com Sucesso!",
          description: `Usuário: ${data.usuario} | Senha: ${data.senha}`,
          variant: "default",
        });
      } else {
        const error = await response.json();
        toast({
          title: "❌ Erro ao Gerar",
          description: error.error || 'Não foi possível gerar as credenciais automaticamente',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao gerar credenciais:', error);
      toast({
        title: "❌ Erro de Conexão",
        description: "Não foi possível conectar ao servidor. Verifique se o serviço está rodando.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveCredentialsToBackend = async (user: IPTVUser) => {
    try {
      const response = await fetch('/api/office/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      toast({
        title: "✅ Salvo!",
        description: "Credenciais salvas no banco de dados",
        variant: "default"
      });
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      toast({
        title: "⚠️ Aviso",
        description: "As credenciais foram adicionadas mas houve erro ao salvar no banco de dados.",
        variant: "destructive"
      });
    }
  };

  const handleManualSubmit = () => {
    if (!manualInput.usuario || !manualInput.senha) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Por favor, preencha usuário e senha",
        variant: "destructive"
      });
      return;
    }

    const newUser: IPTVUser = {
      id: Date.now().toString(),
      usuario: manualInput.usuario,
      senha: manualInput.senha,
      vencimento: manualInput.vencimento || new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('pt-BR'),
      createdAt: new Date().toISOString(),
      source: 'manual'
    };

    setUsers(prev => [...prev, newUser]);
    saveCredentialsToBackend(newUser);
    setManualInput({ usuario: '', senha: '', vencimento: '' });
    
    toast({
      title: "✅ Credenciais Adicionadas!",
      description: `Usuário: ${newUser.usuario} | Senha: ${newUser.senha}`,
      variant: "default"
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
        a.download = 'onlineoffice-chrome-extension.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "📦 Download Iniciado!",
          description: "A extensão está sendo baixada",
          variant: "default"
        });
      } else {
        throw new Error('Failed to download extension');
      }
    } catch (error) {
      console.error('Erro ao baixar extensão:', error);
      toast({
        title: "❌ Erro no Download",
        description: "Não foi possível baixar a extensão",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      toast({
        title: "Copiado!",
        description: `${field} copiado para a área de transferência`,
        variant: "default"
      });
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const deleteUser = (userId: string) => {
    setUsers(prev => prev.filter(user => user.id !== userId));
    toast({
      title: "Removido",
      description: "Credenciais removidas da lista",
      variant: "default"
    });
  };

  const refreshIframe = () => {
    setIframeKey(prev => prev + 1);
    toast({
      title: "Recarregado",
      description: "O iframe foi recarregado",
      variant: "default"
    });
  };

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'extension':
        return <Badge className="bg-green-500/20 text-green-400 text-xs"><Chrome className="w-3 h-3 mr-1" />Extensão</Badge>;
      case 'auto':
        return <Badge className="bg-purple-500/20 text-purple-400 text-xs"><Sparkles className="w-3 h-3 mr-1" />Auto</Badge>;
      default:
        return <Badge className="bg-blue-500/20 text-blue-400 text-xs"><UserPlus className="w-3 h-3 mr-1" />Manual</Badge>;
    }
  };

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
                Gerador de credenciais IPTV com automação avançada
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${extensionConnected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {extensionConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
              {extensionConnected ? 'Extensão Conectada' : 'Extensão Offline'}
            </Badge>
            <Badge className="bg-blue-500/20 text-blue-400">
              <Clock className="w-3 h-3 mr-1" />
              {todayCount} hoje
            </Badge>
            <Badge className="bg-green-500/20 text-green-400">
              <Globe className="w-3 h-3 mr-1" />
              OnlineOffice.zip
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Left Side - Controls and Users List */}
        <div className="flex flex-col gap-4 min-h-0">
          
          {/* Tabs for different methods */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800">
              <TabsTrigger value="manual" className="data-[state=active]:bg-purple-600">
                <UserPlus className="w-4 h-4 mr-2" />
                Método Manual
              </TabsTrigger>
              <TabsTrigger value="extension" className="data-[state=active]:bg-green-600">
                <Chrome className="w-4 h-4 mr-2" />
                Método Extensão
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="manual" className="space-y-4">
              {/* Automation Card - Primary Option */}
              <Card className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/50 shadow-lg shadow-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Geração Automática Humanizada
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-300">
                    Gera credenciais automaticamente com nomes e sobrenomes realistas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleAutoGenerate}
                    disabled={isGenerating}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    size="lg"
                    data-testid="button-auto-generate"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Gerando Credenciais...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Gerar Automaticamente
                      </>
                    )}
                  </Button>
                  {isGenerating && (
                    <p className="text-xs text-center mt-3 text-purple-300 animate-pulse">
                      Criando credenciais humanizadas... Aguarde!
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Manual Input Card */}
              <Card className="bg-dark-card border-slate-600">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Adicionar Manualmente
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ou adicione credenciais manualmente caso já tenha gerado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="usuario" className="text-xs">Usuário</Label>
                    <Input
                      id="usuario"
                      placeholder="Digite o usuário gerado"
                      value={manualInput.usuario}
                      onChange={(e) => setManualInput({...manualInput, usuario: e.target.value})}
                      className="h-9"
                      data-testid="input-usuario"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="senha" className="text-xs">Senha</Label>
                    <Input
                      id="senha"
                      placeholder="Digite a senha gerada"
                      value={manualInput.senha}
                      onChange={(e) => setManualInput({...manualInput, senha: e.target.value})}
                      className="h-9"
                      data-testid="input-senha"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="vencimento" className="text-xs">Vencimento (opcional)</Label>
                    <Input
                      id="vencimento"
                      placeholder="Ex: 20/01/2025"
                      value={manualInput.vencimento}
                      onChange={(e) => setManualInput({...manualInput, vencimento: e.target.value})}
                      className="h-9"
                      data-testid="input-vencimento"
                    />
                  </div>
                  
                  <Button
                    onClick={handleManualSubmit}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
                    data-testid="button-add-credentials"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Adicionar Credenciais
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="extension" className="space-y-4">
              {/* Extension Hero Card */}
              <Card className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-500/50 shadow-lg shadow-green-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-green-400" />
                    Método Automatizado com Extensão Chrome
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-300">
                    Captura credenciais automaticamente do site OnlineOffice
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {extensionConnected ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                          <span className="text-sm text-green-400">Extensão conectada e pronta</span>
                        </>
                      ) : (
                        <>
                          <Info className="w-5 h-5 text-yellow-400" />
                          <span className="text-sm text-yellow-400">Extensão não detectada</span>
                        </>
                      )}
                    </div>
                    {lastExtensionSync && (
                      <span className="text-xs text-slate-400">
                        Última sync: {lastExtensionSync.toLocaleTimeString('pt-BR')}
                      </span>
                    )}
                  </div>
                  
                  <Button
                    onClick={downloadExtension}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
                    size="lg"
                    data-testid="button-download-extension"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Baixar Extensão Chrome
                  </Button>
                </CardContent>
              </Card>

              {/* Installation Instructions */}
              <Card className="bg-dark-card border-slate-600">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-400" />
                    Como Instalar e Usar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-400">1</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Baixe a extensão</p>
                        <p className="text-xs text-slate-400">Clique no botão acima para baixar o arquivo .zip</p>
                      </div>
                    </div>
                    
                    <Separator className="bg-slate-700" />
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-400">2</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Extraia o arquivo</p>
                        <p className="text-xs text-slate-400">Descompacte o .zip em uma pasta local</p>
                      </div>
                    </div>
                    
                    <Separator className="bg-slate-700" />
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-400">3</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Abra o Chrome</p>
                        <p className="text-xs text-slate-400">Acesse chrome://extensions/ e ative o "Modo desenvolvedor"</p>
                      </div>
                    </div>
                    
                    <Separator className="bg-slate-700" />
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-400">4</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Carregue a extensão</p>
                        <p className="text-xs text-slate-400">Clique em "Carregar sem compactação" e selecione a pasta</p>
                      </div>
                    </div>
                    
                    <Separator className="bg-slate-700" />
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-400">Pronto!</p>
                        <p className="text-xs text-slate-400">Acesse OnlineOffice.zip e a extensão capturará automaticamente</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Extension Features */}
              <Alert className="border-green-500/50 bg-green-500/10">
                <Zap className="h-4 w-4 text-green-400" />
                <AlertTitle className="text-green-400">Vantagens da Extensão</AlertTitle>
                <AlertDescription className="text-xs text-slate-300 space-y-1 mt-2">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3" />
                    <span>Captura automática de credenciais geradas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3" />
                    <span>Sincronização em tempo real com o painel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3" />
                    <span>Evita erros de digitação manual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3" />
                    <span>Monitoramento automático opcional</span>
                  </div>
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          {/* Users List - Shared between tabs */}
          <Card className="bg-dark-card border-slate-600 flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Credenciais Salvas</CardTitle>
                  <CardDescription className="text-xs">
                    Lista de credenciais IPTV geradas
                  </CardDescription>
                </div>
                <Badge className="bg-purple-500/20 text-purple-400">
                  {users.length} {users.length === 1 ? 'credencial' : 'credenciais'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ScrollArea className="h-full max-h-[400px]">
                {users.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Usuário</TableHead>
                        <TableHead className="text-xs">Senha</TableHead>
                        <TableHead className="text-xs">Vencimento</TableHead>
                        <TableHead className="text-xs">Origem</TableHead>
                        <TableHead className="text-xs text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-1">
                              {user.usuario}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(user.usuario, `Usuário-${user.id}`)}
                                className="h-5 w-5 p-0"
                                data-testid={`button-copy-user-${user.id}`}
                              >
                                {copiedField === `Usuário-${user.id}` ? (
                                  <CheckCircle className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-1">
                              {user.senha}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(user.senha, `Senha-${user.id}`)}
                                className="h-5 w-5 p-0"
                                data-testid={`button-copy-pass-${user.id}`}
                              >
                                {copiedField === `Senha-${user.id}` ? (
                                  <CheckCircle className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{user.vencimento}</TableCell>
                          <TableCell>{getSourceBadge(user.source)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteUser(user.id)}
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                              data-testid={`button-delete-${user.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma credencial salva</p>
                    <p className="text-xs mt-1">
                      Use os métodos acima para gerar credenciais
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - OnlineOffice iFrame */}
        <Card className="bg-dark-card border-slate-600 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">OnlineOffice</CardTitle>
                <CardDescription className="text-xs">
                  Faça login e gere as credenciais IPTV
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {extensionConnected && (
                  <Badge className="bg-green-500/20 text-green-400">
                    <Shield className="w-3 h-3 mr-1" />
                    Monitorado
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={refreshIframe}
                  className="h-8 w-8 p-0"
                  title="Recarregar iframe"
                  data-testid="button-refresh-iframe"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-2">
            <div className="h-full min-h-[600px] bg-slate-900 rounded-lg overflow-hidden">
              <iframe
                key={iframeKey}
                src="https://onlineoffice.zip/"
                className="w-full h-full"
                title="OnlineOffice IPTV"
                allow="clipboard-read; clipboard-write"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}