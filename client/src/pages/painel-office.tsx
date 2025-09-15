import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Play, Copy, CheckCircle, AlertCircle, Monitor, User, Lock, Clock, Wifi, Globe, RefreshCw, ExternalLink, Link2, Trash2, Edit3, UserPlus, Code, Zap, BookmarkPlus, Chrome, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import OnlineOfficeAutomation from '@/utils/onlineoffice-automation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface IPTVUser {
  id: string;
  usuario: string;
  senha: string;
  vencimento?: string;
  createdAt: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function PainelOffice() {
  const [users, setUsers] = useState<IPTVUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [iframeUrl, setIframeUrl] = useState('https://onlineoffice.zip/');
  const [customUrl, setCustomUrl] = useState('https://onlineoffice.zip/');
  const [showIframe, setShowIframe] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [manualInput, setManualInput] = useState({ usuario: '', senha: '', vencimento: '' });
  const [automationMethod, setAutomationMethod] = useState<'iframe' | 'client' | 'manual'>('client');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const officeWindowRef = useRef<Window | null>(null);
  const { toast } = useToast();

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      message,
      type
    };
    setLogs(prev => [...prev, newLog]);
  };

  // Setup message listener for credentials from client-side automation
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validação de segurança: verificar origem e tipo de mensagem
      const allowedOrigins = [
        'https://onlineoffice.zip',
        window.location.origin
      ];
      
      // Verificar se a origem é permitida
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('⚠️ Mensagem ignorada de origem não confiável:', event.origin);
        return;
      }
      
      // Verificar se é uma mensagem de credenciais válida
      if (event.data && 
          event.data.type === 'ONLINEOFFICE_CREDENTIALS' && 
          event.data.source === 'onlineoffice-automation' &&
          event.data.usuario && 
          event.data.senha) {
        
        addLog('📥 Credenciais recebidas do navegador!', 'success');
        
        const newUser: IPTVUser = {
          id: Date.now().toString(),
          usuario: event.data.usuario,
          senha: event.data.senha,
          vencimento: event.data.vencimento || new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('pt-BR'),
          createdAt: new Date().toISOString()
        };

        setUsers(prev => [...prev, newUser]);
        
        toast({
          title: "✅ Credenciais Capturadas!",
          description: `Usuário: ${newUser.usuario} | Senha: ${newUser.senha}`,
          variant: "default"
        });

        // Save to backend
        saveCredentialsToBackend(newUser);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Cleanup automation on unmount
  useEffect(() => {
    return () => {
      OnlineOfficeAutomation.cleanup();
      if (officeWindowRef.current && !officeWindowRef.current.closed) {
        officeWindowRef.current.close();
      }
    };
  }, []);

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
      
      addLog('💾 Credenciais salvas no banco de dados', 'success');
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      addLog(`❌ Erro ao salvar credenciais: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
      
      toast({
        title: "⚠️ Aviso",
        description: "As credenciais foram capturadas mas houve erro ao salvar no banco de dados.",
        variant: "destructive"
      });
    }
  };

  const handleClientSideAutomation = () => {
    addLog('🚀 Iniciando automação client-side...', 'info');
    
    // Open OnlineOffice and setup listener
    const newWindow = OnlineOfficeAutomation.openAndAutomate((credentials) => {
      // Validação adicional das credenciais recebidas
      if (!credentials.usuario || !credentials.senha) {
        addLog('⚠️ Credenciais incompletas recebidas', 'warning');
        toast({
          title: "⚠️ Credenciais Incompletas",
          description: "As credenciais recebidas estão incompletas. Tente novamente.",
          variant: "destructive"
        });
        return;
      }
      
      addLog('✅ Credenciais capturadas com sucesso!', 'success');
      
      const newUser: IPTVUser = {
        id: Date.now().toString(),
        usuario: credentials.usuario,
        senha: credentials.senha,
        vencimento: credentials.vencimento || new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('pt-BR'),
        createdAt: new Date().toISOString()
      };

      setUsers(prev => [...prev, newUser]);
      saveCredentialsToBackend(newUser);
      
      toast({
        title: "✅ Automação Concluída!",
        description: `Usuário: ${newUser.usuario} | Senha: ${newUser.senha}`,
        variant: "default"
      });
    });

    if (newWindow) {
      officeWindowRef.current = newWindow;
      setShowScriptDialog(true);
      addLog('📋 Nova aba aberta. Siga as instruções no popup.', 'info');
    } else {
      addLog('❌ Não foi possível abrir a nova aba. Verifique os pop-ups.', 'error');
    }
  };

  const copyScriptToClipboard = () => {
    const script = OnlineOfficeAutomation.getInjectionScript();
    navigator.clipboard.writeText(script).then(() => {
      setScriptCopied(true);
      toast({
        title: "📋 Script Copiado!",
        description: "Cole no console do navegador (F12)",
        variant: "default"
      });
      setTimeout(() => setScriptCopied(false), 3000);
    });
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
      createdAt: new Date().toISOString()
    };

    setUsers(prev => [...prev, newUser]);
    saveCredentialsToBackend(newUser);
    setManualInput({ usuario: '', senha: '', vencimento: '' });
    
    toast({
      title: "✅ Credenciais Adicionadas!",
      description: `Usuário: ${newUser.usuario} | Senha: ${newUser.senha}`,
      variant: "default"
    });
    
    addLog('✅ Credenciais adicionadas manualmente', 'success');
  };

  const generateIPTVTest = async () => {
    setIsGenerating(true);
    addLog('Iniciando geração de teste IPTV...', 'info');

    try {
      addLog('Acessando sistema OnlineOffice...', 'info');
      addLog('Aguardando página carregar...', 'info');
      
      // Chama a nova API com Puppeteer
      const response = await fetch('/api/office/generate-iptv-auto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao gerar teste IPTV');
      }

      addLog('Clicando no botão Gerar IPTV...', 'info');
      addLog('Confirmando primeiro modal...', 'info');
      addLog('Confirmando segundo modal...', 'info');
      addLog('Capturando credenciais geradas...', 'info');

      // Adiciona o usuário retornado pela API
      const newUser: IPTVUser = {
        id: Date.now().toString(),
        usuario: data.usuario,
        senha: data.senha,
        vencimento: data.vencimento || new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('pt-BR'),
        createdAt: new Date().toISOString()
      };

      setUsers(prev => [...prev, newUser]);
      addLog(`Teste gerado com sucesso! Usuário: ${newUser.usuario}`, 'success');
      
      toast({
        title: "✅ Teste IPTV Gerado!",
        description: `Usuário: ${newUser.usuario} | Senha: ${newUser.senha}`,
        variant: "default"
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      addLog(errorMessage, 'error');
      toast({
        title: "❌ Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
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
      title: "Usuário removido",
      description: "O usuário foi removido da lista",
      variant: "default"
    });
    addLog(`Usuário removido: ${userId}`, 'info');
  };

  const loadIframe = () => {
    if (!customUrl) {
      toast({
        title: "URL necessária",
        description: "Por favor, insira a URL do OnlineOffice",
        variant: "destructive"
      });
      return;
    }
    
    let urlToLoad = customUrl;
    if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
      urlToLoad = 'https://' + customUrl;
    }
    
    setIframeUrl(urlToLoad);
    setShowIframe(true);
    addLog(`Carregando página: ${urlToLoad}`, 'info');
  };

  const refreshIframe = () => {
    if (iframeRef.current && iframeUrl) {
      iframeRef.current.src = iframeUrl;
      addLog('Página recarregada', 'info');
    }
  };

  const openInNewTab = () => {
    if (iframeUrl) {
      window.open(iframeUrl, '_blank');
      addLog('Abrindo em nova aba...', 'info');
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
                Painel Office
              </h1>
              <p className="text-xs text-slate-400">
                Automação IPTV com interface interativa
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-500/20 text-green-400">
              <Wifi className="w-3 h-3 mr-1" />
              OnlineOffice.zip
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={refreshIframe}
              className="h-8 w-8 p-0"
              title="Recarregar página"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={openInNewTab}
              className="h-8 w-8 p-0"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Left Side - Controls and Users List */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Control Panel */}
          <Card className="bg-dark-card border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Controles de Automação</CardTitle>
              <CardDescription className="text-xs">
                Gere testes IPTV automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tabs defaultValue="client" className="w-full" onValueChange={(v) => setAutomationMethod(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="client" className="text-xs">
                    <Chrome className="w-3 h-3 mr-1" />
                    Client-Side
                  </TabsTrigger>
                  <TabsTrigger value="iframe" className="text-xs">
                    <Monitor className="w-3 h-3 mr-1" />
                    iFrame
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="text-xs">
                    <Edit3 className="w-3 h-3 mr-1" />
                    Manual
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="client" className="space-y-3">
                  <Alert className="border-green-500/20 bg-green-500/10">
                    <Zap className="h-4 w-4 text-green-400" />
                    <AlertDescription className="text-green-400/80 text-xs">
                      Método mais confiável! Abre o site em nova aba e você executa um script.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={handleClientSideAutomation}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                    size="lg"
                  >
                    <Chrome className="mr-2 h-5 w-5" />
                    Abrir OnlineOffice e Automatizar
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        const bookmarklet = OnlineOfficeAutomation.generateBookmarklet();
                        navigator.clipboard.writeText(bookmarklet);
                        toast({
                          title: "📋 Bookmarklet Copiado!",
                          description: "Adicione aos favoritos do navegador",
                          variant: "default"
                        });
                      }}
                    >
                      <BookmarkPlus className="mr-1 h-3 w-3" />
                      Copiar Bookmarklet
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="iframe" className="space-y-3">
                  <Alert className="border-blue-500/20 bg-blue-500/10">
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-blue-400/80 text-xs">
                      Método antigo usando Puppeteer. Pode não funcionar devido a bloqueios.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={generateIPTVTest}
                    disabled={isGenerating}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Gerando teste...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-5 w-5" />
                        Gerar Teste IPTV (Servidor)
                      </>
                    )}
                  </Button>
                </TabsContent>

                <TabsContent value="manual" className="space-y-3">
                  <Alert className="border-yellow-500/20 bg-yellow-500/10">
                    <Edit3 className="h-4 w-4 text-yellow-400" />
                    <AlertDescription className="text-yellow-400/80 text-xs">
                      Adicione credenciais manualmente após gerar no site.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Input
                      placeholder="Usuário"
                      value={manualInput.usuario}
                      onChange={(e) => setManualInput({...manualInput, usuario: e.target.value})}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Senha"
                      value={manualInput.senha}
                      onChange={(e) => setManualInput({...manualInput, senha: e.target.value})}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Vencimento (opcional)"
                      value={manualInput.vencimento}
                      onChange={(e) => setManualInput({...manualInput, vencimento: e.target.value})}
                      className="h-8 text-xs"
                    />
                    <Button
                      onClick={handleManualSubmit}
                      className="w-full"
                      size="sm"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Adicionar Credenciais
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card className="bg-dark-card border-slate-600 flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Usuários Gerados</CardTitle>
                  <CardDescription className="text-xs">
                    Lista de testes IPTV criados
                  </CardDescription>
                </div>
                <Badge className="bg-purple-500/20 text-purple-400">
                  <UserPlus className="w-3 h-3 mr-1" />
                  {users.length} usuários
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
                                onClick={() => copyToClipboard(user.usuario, `Usuário ${user.usuario}`)}
                                className="h-5 w-5 p-0"
                              >
                                {copiedField === `Usuário ${user.usuario}` ? (
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
                                onClick={() => copyToClipboard(user.senha, `Senha ${user.senha}`)}
                                className="h-5 w-5 p-0"
                              >
                                {copiedField === `Senha ${user.senha}` ? (
                                  <CheckCircle className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{user.vencimento}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteUser(user.id)}
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Nenhum usuário gerado ainda</p>
                    <p className="text-xs mt-1">Clique no botão acima para gerar</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Logs Panel */}
          <Card className="bg-dark-card border-slate-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Logs do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32">
                {logs.length > 0 ? (
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`text-xs font-mono p-1 rounded ${
                          log.type === 'error'
                            ? 'bg-red-500/10 text-red-400'
                            : log.type === 'success'
                            ? 'bg-green-500/10 text-green-400'
                            : log.type === 'warning'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500">
                    <p className="text-xs">Nenhuma atividade</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - OnlineOffice Website */}
        <Card className="bg-dark-card border-slate-600 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">OnlineOffice Web</CardTitle>
                <CardDescription className="text-xs">
                  Interface web completa - Faça login para gerar testes
                </CardDescription>
              </div>
              {showIframe && (
                <Badge className="bg-blue-500/20 text-blue-400">
                  <Globe className="w-3 h-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-4 flex flex-col gap-4">
            {/* URL Input Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="Digite a URL do OnlineOffice"
                    className="bg-slate-800 border-slate-700"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadIframe();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={loadIframe}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Carregar
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                URL padrão configurada: https://onlineoffice.zip/
              </p>
            </div>

            {/* Iframe */}
            <div className="flex-1 min-h-0">
              {showIframe && (
                <div className="relative h-full min-h-[500px] bg-slate-900 rounded-lg overflow-hidden">
                  <iframe
                    ref={iframeRef}
                    src={iframeUrl}
                    className="w-full h-full"
                    title="OnlineOffice"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
                    allow="clipboard-read; clipboard-write"
                  />
                  <div className="absolute bottom-2 right-2 bg-slate-800/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-slate-400">
                    {iframeUrl}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Script Dialog */}
      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Instruções de Automação
            </DialogTitle>
            <DialogDescription>
              Siga os passos abaixo para capturar as credenciais automaticamente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-green-500/20 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertTitle className="text-green-400">Nova aba aberta!</AlertTitle>
              <AlertDescription className="text-green-400/80">
                O OnlineOffice foi aberto em uma nova aba. Siga os passos abaixo.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="p-3 bg-slate-800 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">📋 Passo a Passo:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                  <li>Na nova aba, faça login no OnlineOffice se necessário</li>
                  <li>Abra o Console do navegador (pressione F12 e clique em "Console")</li>
                  <li>Copie o script abaixo clicando no botão "Copiar Script"</li>
                  <li>Cole o script no console e pressione Enter</li>
                  <li>O script irá automaticamente:
                    <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                      <li>Clicar no botão "Gerar IPTV"</li>
                      <li>Capturar as credenciais quando aparecerem</li>
                      <li>Enviar de volta para este sistema</li>
                    </ul>
                  </li>
                  <li>As credenciais aparecerão automaticamente na lista abaixo</li>
                </ol>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Script de Automação:</label>
                  <Button
                    size="sm"
                    variant={scriptCopied ? "default" : "outline"}
                    onClick={copyScriptToClipboard}
                  >
                    {scriptCopied ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar Script
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={OnlineOfficeAutomation.getInjectionScript()}
                  className="font-mono text-xs h-32 bg-slate-900"
                />
              </div>

              <Alert className="border-yellow-500/20 bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <AlertDescription className="text-yellow-400/80 text-xs">
                  <strong>Dica:</strong> Se o script não funcionar automaticamente, você pode clicar manualmente no botão "Gerar IPTV" e depois executar o script para capturar as credenciais.
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const bookmarklet = OnlineOfficeAutomation.generateBookmarklet();
                  const link = document.createElement('a');
                  link.href = bookmarklet;
                  link.textContent = '🔧 IPTV Capture';
                  link.onclick = () => {
                    toast({
                      title: "ℹ️ Como usar o Bookmarklet",
                      description: "Arraste este link para sua barra de favoritos",
                      variant: "default"
                    });
                    return false;
                  };
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <BookmarkPlus className="mr-2 h-4 w-4" />
                Criar Bookmarklet
              </Button>
              <Button onClick={() => setShowScriptDialog(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}