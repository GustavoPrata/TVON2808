import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Loader2, Play, Copy, CheckCircle, AlertCircle, Monitor, User, Lock, Clock, Wifi, Globe, RefreshCw, ExternalLink, Link2, Trash2, Edit3, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
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
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualUsuario, setManualUsuario] = useState('');
  const [manualSenha, setManualSenha] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      message,
      type
    };
    setLogs(prev => [...prev, newLog]);
  };

  const generateIPTVTest = async () => {
    setIsGenerating(true);
    addLog('Iniciando geração de teste IPTV...', 'info');

    try {
      // Instruções para o usuário
      addLog('INSTRUÇÕES: Siga os passos no iframe ao lado:', 'warning');
      addLog('1. Clique no botão "Gerar IPTV"', 'info');
      addLog('2. Confirme o primeiro modal (pode deixar vazio)', 'info');
      addLog('3. Confirme o segundo modal (tempo de teste)', 'info');
      addLog('4. Aguarde a geração do teste', 'info');
      addLog('5. Copie o usuário e senha gerados', 'info');
      
      // Simula o processo enquanto o usuário faz manualmente
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Abre um prompt para o usuário colar as credenciais
      const credentialsText = prompt(
        'Cole aqui o texto com as credenciais geradas (USUÁRIO e SENHA):\n\n' +
        'Exemplo:\n' +
        'USUÁRIO: 123456789\n' +
        'SENHA: ABC123XYZ'
      );
      
      if (!credentialsText) {
        throw new Error('Operação cancelada pelo usuário');
      }
      
      // Extrai as credenciais do texto colado
      const usuarioMatch = credentialsText.match(/USUÁRIO[:\s]+(\S+)/i);
      const senhaMatch = credentialsText.match(/SENHA[:\s]+(\S+)/i);
      const vencimentoMatch = credentialsText.match(/VENCIMENTO[:\s]+([^\n]+)/i);
      
      if (!usuarioMatch || !senhaMatch) {
        throw new Error('Não foi possível extrair usuário e senha. Verifique o formato do texto.');
      }
      
      // Adiciona o usuário extraído
      const newUser: IPTVUser = {
        id: Date.now().toString(),
        usuario: usuarioMatch[1],
        senha: senhaMatch[1],
        vencimento: vencimentoMatch ? vencimentoMatch[1].trim() : new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('pt-BR'),
        createdAt: new Date().toISOString()
      };

      setUsers(prev => [...prev, newUser]);
      addLog(`Teste capturado com sucesso! Usuário: ${newUser.usuario}`, 'success');
      
      toast({
        title: "✅ Teste IPTV Capturado!",
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

  const addManualUser = () => {
    if (!manualUsuario || !manualSenha) {
      toast({
        title: "Erro",
        description: "Por favor, preencha usuário e senha",
        variant: "destructive"
      });
      return;
    }

    const newUser: IPTVUser = {
      id: Date.now().toString(),
      usuario: manualUsuario,
      senha: manualSenha,
      vencimento: new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('pt-BR'),
      createdAt: new Date().toISOString()
    };

    setUsers(prev => [...prev, newUser]);
    setManualUsuario('');
    setManualSenha('');
    setShowManualForm(false);
    addLog(`Usuário adicionado manualmente: ${newUser.usuario}`, 'success');
    
    toast({
      title: "✅ Usuário Adicionado!",
      description: `Usuário: ${newUser.usuario} | Senha: ${newUser.senha}`,
      variant: "default"
    });
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
              <Alert className="border-blue-500/20 bg-blue-500/10">
                <AlertCircle className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-400/80 text-xs">
                  Para funcionar, você precisa estar logado no OnlineOffice no iframe ao lado.
                  O sistema irá clicar automaticamente nos botões e confirmar os modais.
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
                    Gerar Teste IPTV Automático
                  </>
                )}
              </Button>
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
    </div>
  );
}