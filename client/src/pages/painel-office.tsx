import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Play, Copy, CheckCircle, AlertCircle, Monitor, User, Lock, Clock, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface IPTVResult {
  usuario: string;
  senha: string;
  vencimento?: string;
  m3u8?: string;
}

export default function PainelOffice() {
  const [result, setResult] = useState<IPTVResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

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
          vencimento: data.vencimento,
          m3u8: data.m3u8
        });
        setError(null);
        toast({
          title: "✅ Teste gerado com sucesso!",
          description: "As credenciais foram geradas automaticamente.",
          variant: "default"
        });
      } else {
        setError(data.error || "Erro ao gerar teste");
        setResult(null);
      }
    },
    onError: (err: Error) => {
      const errorMessage = err.message || "Erro desconhecido ao gerar teste";
      setError(errorMessage);
      setResult(null);
      toast({
        title: "❌ Erro ao gerar teste",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg shadow-purple-500/30">
              <Monitor className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Painel Office
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Integração via API para geração de testes IPTV
              </p>
            </div>
          </div>
          <Badge className="bg-green-500/20 text-green-400">
            <Wifi className="w-3 h-3 mr-1" />
            OnlineOffice.zip
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Action Card */}
        <Card className="bg-dark-card border-slate-600">
          <CardHeader>
            <CardTitle>Gerar Teste IPTV</CardTitle>
            <CardDescription>
              Clique no botão abaixo para gerar automaticamente um teste de 6 horas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                Este processo via API irá:
              </p>
              <ul className="text-sm text-slate-400 space-y-1 ml-4">
                <li>• Fazer login na API OnlineOffice</li>
                <li>• Gerar um teste IPTV de 6 horas</li>
                <li>• Retornar as credenciais geradas</li>
                <li>• Fornecer URL M3U8 para streaming</li>
                <li>• Processo rápido e confiável</li>
              </ul>
            </div>

            <Button
              onClick={() => generateTestMutation.mutate()}
              disabled={generateTestMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
              size="lg"
            >
              {generateTestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Gerando teste via API...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Gerar Teste IPTV
                </>
              )}
            </Button>

            {generateTestMutation.isPending && (
              <Alert className="border-yellow-500/20 bg-yellow-500/10">
                <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                <AlertTitle className="text-yellow-400">Processando...</AlertTitle>
                <AlertDescription className="text-yellow-400/80">
                  Conectando à API e gerando teste IPTV...
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Result Card */}
        <Card className="bg-dark-card border-slate-600">
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>
              {result ? "Credenciais geradas com sucesso" : "As credenciais aparecerão aqui"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="border-red-500/20 bg-red-500/10 mb-4">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertTitle className="text-red-400">Erro</AlertTitle>
                <AlertDescription className="text-red-400/80">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-4">
                <Alert className="border-green-500/20 bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <AlertTitle className="text-green-400">Sucesso!</AlertTitle>
                  <AlertDescription className="text-green-400/80">
                    Teste IPTV gerado com sucesso. Use as credenciais abaixo.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {/* Usuário */}
                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-400">Usuário:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{result.usuario}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(result.usuario, 'Usuário')}
                        className="h-7 w-7 p-0"
                      >
                        {copiedField === 'Usuário' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Senha */}
                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-400">Senha:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{result.senha}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(result.senha, 'Senha')}
                        className="h-7 w-7 p-0"
                      >
                        {copiedField === 'Senha' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Vencimento */}
                  {result.vencimento && (
                    <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-400">Vencimento:</span>
                      </div>
                      <span className="font-mono text-sm">{result.vencimento}</span>
                    </div>
                  )}

                  {/* M3U8 URL */}
                  {result.m3u8 && (
                    <div className="p-3 bg-slate-800 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-400">URL M3U8:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs break-all">{result.m3u8}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.m3u8!, 'M3U8')}
                          className="h-7 w-7 p-0 flex-shrink-0"
                        >
                          {copiedField === 'M3U8' ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-500">
                    Estas credenciais são válidas por 6 horas a partir da geração.
                    Use-as para testar o serviço IPTV.
                  </p>
                </div>
              </div>
            )}

            {!result && !error && (
              <div className="text-center py-8 text-slate-500">
                <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhum teste gerado ainda</p>
                <p className="text-xs mt-1">Clique no botão para iniciar a automação</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Information Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-dark-card border-slate-600">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Duração</p>
                <p className="text-lg font-semibold">6 Horas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-slate-600">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Wifi className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Tipo</p>
                <p className="text-lg font-semibold">IPTV Teste</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-slate-600">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Monitor className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Sistema</p>
                <p className="text-lg font-semibold">OnlineOffice</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}