import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Loader2, Play, Copy, CheckCircle, AlertCircle, Monitor, User, Lock, Clock, Wifi, Globe, RefreshCw, ExternalLink, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface IPTVResult {
  usuario: string;
  senha: string;
  vencimento?: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function PainelOffice() {
  const [result, setResult] = useState<IPTVResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [iframeUrl, setIframeUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [showIframe, setShowIframe] = useState(false);
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

  const generateTestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/office/generate-iptv-test');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setResult({
          usuario: data.usuario,
          senha: data.senha,
          vencimento: data.vencimento
        });
        setError(null);
        addLog('Teste IPTV gerado com sucesso!', 'success');
        addLog(`Usuário: ${data.usuario}`, 'info');
        addLog(`Senha: ${data.senha}`, 'info');
        toast({
          title: "✅ Teste gerado com sucesso!",
          description: "As credenciais foram geradas automaticamente.",
          variant: "default"
        });
      } else {
        const errorMsg = data.error || "Erro ao gerar teste";
        setError(errorMsg);
        setResult(null);
        addLog(errorMsg, 'error');
      }
    },
    onError: (err: Error) => {
      const errorMessage = err.message || "Erro desconhecido ao gerar teste";
      setError(errorMessage);
      setResult(null);
      addLog(errorMessage, 'error');
      toast({
        title: "❌ Erro ao gerar teste",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const handleGenerateTest = () => {
    setLogs([]);
    addLog('Iniciando automação...', 'info');
    addLog('Acessando sistema OnlineOffice...', 'info');
    addLog('Fazendo login...', 'info');
    addLog('Navegando para página de geração...', 'info');
    addLog('Preenchendo formulário...', 'info');
    addLog('Selecionando duração de 6 horas...', 'info');
    generateTestMutation.mutate();
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

  const loadIframe = () => {
    if (!customUrl) {
      toast({
        title: "URL necessária",
        description: "Por favor, insira a URL do OnlineOffice",
        variant: "destructive"
      });
      return;
    }
    
    // Adiciona https:// se não tiver protocolo
    let urlToLoad = customUrl;
    if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
      urlToLoad = 'https://' + customUrl;
    }
    
    setIframeUrl(urlToLoad);
    setShowIframe(true);
    addLog(`Carregando página: ${urlToLoad}`, 'info');
    toast({
      title: "Carregando página",
      description: "A página do OnlineOffice está sendo carregada...",
      variant: "default"
    });
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
        {/* Left Side - Controls and Logs */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Control Panel */}
          <Card className="bg-dark-card border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Controles de Automação</CardTitle>
              <CardDescription className="text-xs">
                Gere testes IPTV automaticamente ou use a interface ao lado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleGenerateTest}
                disabled={generateTestMutation.isPending}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
                size="lg"
              >
                {generateTestMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Gerando teste...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Gerar Teste IPTV (6 horas)
                  </>
                )}
              </Button>

              {result && (
                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <Alert className="border-green-500/20 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <AlertTitle className="text-green-400">Sucesso!</AlertTitle>
                  </Alert>

                  <div className="space-y-2">
                    {/* Usuário */}
                    <div className="flex items-center justify-between p-2 bg-slate-800 rounded">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">Usuário:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{result.usuario}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.usuario, 'Usuário')}
                          className="h-6 w-6 p-0"
                        >
                          {copiedField === 'Usuário' ? (
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Senha */}
                    <div className="flex items-center justify-between p-2 bg-slate-800 rounded">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">Senha:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{result.senha}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.senha, 'Senha')}
                          className="h-6 w-6 p-0"
                        >
                          {copiedField === 'Senha' ? (
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Vencimento */}
                    {result.vencimento && (
                      <div className="flex items-center justify-between p-2 bg-slate-800 rounded">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-400">Vencimento:</span>
                        </div>
                        <span className="font-mono text-xs">{result.vencimento}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <Alert className="border-red-500/20 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400/80 text-xs">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Logs Panel */}
          <Card className="bg-dark-card border-slate-600 flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Logs do Sistema</CardTitle>
              <CardDescription className="text-xs">
                Acompanhe o que o sistema está fazendo
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ScrollArea className="h-full max-h-[400px] pr-4">
                {logs.length > 0 ? (
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`text-xs font-mono p-2 rounded ${
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
                  <div className="text-center py-8 text-slate-500">
                    <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Nenhuma atividade ainda</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="bg-dark-card border-slate-600">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-xs text-slate-400">Duração</p>
                    <p className="text-sm font-semibold">6 Horas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-dark-card border-slate-600">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-green-400" />
                  <div>
                    <p className="text-xs text-slate-400">Tipo</p>
                    <p className="text-sm font-semibold">IPTV</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-dark-card border-slate-600">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-xs text-slate-400">Sistema</p>
                    <p className="text-sm font-semibold">Office</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Side - OnlineOffice Website */}
        <Card className="bg-dark-card border-slate-600 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">OnlineOffice Web</CardTitle>
                <CardDescription className="text-xs">
                  Interface web completa - Configure a URL e faça login
                </CardDescription>
              </div>
              {showIframe && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-400">
                    <Globe className="w-3 h-3 mr-1" />
                    Conectado
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
                    placeholder="Digite a URL do OnlineOffice (ex: onlineoffice.zip)"
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
                Exemplos de URLs possíveis: onlineoffice.zip, ww3.onlineoffice.zip, onlineoffice.com
              </p>
            </div>

            {/* Iframe or Instructions */}
            <div className="flex-1 min-h-0">
              {showIframe ? (
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
              ) : (
                <div className="h-full flex items-center justify-center bg-slate-900/50 rounded-lg border-2 border-dashed border-slate-700">
                  <div className="text-center p-8">
                    <Globe className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                    <h3 className="text-lg font-semibold mb-2">Configure a URL do OnlineOffice</h3>
                    <p className="text-sm text-slate-400 mb-4">
                      Digite a URL correta do OnlineOffice no campo acima e clique em "Carregar"
                    </p>
                    <Alert className="border-yellow-500/20 bg-yellow-500/10 text-left">
                      <AlertCircle className="h-4 w-4 text-yellow-400" />
                      <AlertTitle className="text-yellow-400">Importante</AlertTitle>
                      <AlertDescription className="text-yellow-400/80 text-xs">
                        Certifique-se de usar a URL correta do OnlineOffice. Se você não tem certeza,
                        tente diferentes variações ou consulte a documentação do sistema.
                      </AlertDescription>
                    </Alert>
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