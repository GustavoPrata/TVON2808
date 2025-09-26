import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, AlertCircle, Database, Cloud, Link2, Users, Box } from "lucide-react";

export default function TestApiSync() {
  const [testResults, setTestResults] = useState<any>(null);
  const [distributionResults, setDistributionResults] = useState<any>(null);
  const { toast } = useToast();

  // Mutation para testar a configuração da API
  const testApiMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/sistemas/test-api-sync`, { method: "GET" });
      return response;
    },
    onSuccess: (data) => {
      setTestResults(data.resultado);
      toast({
        title: "Teste concluído",
        description: "Verificação da API externa finalizada",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao testar API",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Mutation para testar a distribuição
  const distributeMutation = useMutation({
    mutationFn: async (mode: string) => {
      const payload: any = { mode };
      if (mode === "fixed-points") {
        payload.pointsPerSystem = 2;
        payload.fixedSystemIds = ["1001", "1002"]; // IDs dos sistemas fixos de teste
      }
      
      const response = await apiRequest(`/api/sistemas/distribute`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response;
    },
    onSuccess: (data) => {
      setDistributionResults(data);
      toast({
        title: "Distribuição concluída",
        description: data.message || "Pontos distribuídos com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na distribuição",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const StatusIcon = ({ status }: { status: boolean }) => {
    return status ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Teste de Sincronização com API Externa</h1>
        <p className="text-muted-foreground mt-2">
          Verifique a configuração e teste a sincronização de pontos com a API externa
        </p>
      </div>

      {/* Botões de Teste */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Button
          onClick={() => testApiMutation.mutate()}
          disabled={testApiMutation.isPending}
          className="w-full"
          data-testid="button-test-api"
        >
          <Database className="mr-2 h-4 w-4" />
          {testApiMutation.isPending ? "Testando..." : "Testar Configuração da API"}
        </Button>

        <Button
          onClick={() => distributeMutation.mutate("one-per-point")}
          disabled={distributeMutation.isPending}
          variant="secondary"
          className="w-full"
          data-testid="button-distribute-one-per-point"
        >
          <Link2 className="mr-2 h-4 w-4" />
          {distributeMutation.isPending ? "Distribuindo..." : "Distribuir 1:1"}
        </Button>

        <Button
          onClick={() => distributeMutation.mutate("fixed-points")}
          disabled={distributeMutation.isPending}
          variant="secondary"
          className="w-full"
          data-testid="button-distribute-fixed-points"
        >
          <Box className="mr-2 h-4 w-4" />
          {distributeMutation.isPending ? "Distribuindo..." : "Distribuir Pontos Fixos"}
        </Button>
      </div>

      {/* Resultados do Teste de Configuração */}
      {testResults && (
        <div className="space-y-4">
          {/* Configuração da API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Configuração da API Externa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>API Ativa:</span>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={testResults.configuracao.apiAtiva} />
                    <Badge variant={testResults.configuracao.apiAtiva ? "default" : "destructive"}>
                      {testResults.configuracao.apiAtiva ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Base URL:</span>
                  <span className="font-mono text-sm" data-testid="text-base-url">
                    {testResults.configuracao.baseUrl}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>API Key:</span>
                  <span className="font-mono text-sm" data-testid="text-api-key">
                    {testResults.configuracao.apiKey}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Credencial key170604:</span>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={testResults.configuracao.key170604Encontrada} />
                    <Badge variant={testResults.configuracao.key170604Encontrada ? "success" : "destructive"}>
                      {testResults.configuracao.key170604Encontrada ? "Encontrada" : "Não Encontrada"}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Teste de Conexão:</span>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={testResults.conexao.testeConexao} />
                    {testResults.conexao.erro && (
                      <span className="text-sm text-red-500">{testResults.conexao.erro}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados da API */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários na API Externa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <Badge>{testResults.usuarios.total}</Badge>
                  </div>
                  {testResults.usuarios.amostra.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-2">Amostra:</p>
                      <div className="space-y-1">
                        {testResults.usuarios.amostra.map((user: any) => (
                          <div key={user.id} className="text-xs font-mono bg-muted p-2 rounded">
                            ID: {user.id} | User: {user.username} | System: {user.system || "N/A"}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Box className="h-5 w-5" />
                  Sistemas na API Externa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <Badge>{testResults.sistemas.total}</Badge>
                  </div>
                  {testResults.sistemas.amostra.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-2">Amostra:</p>
                      <div className="space-y-1">
                        {testResults.sistemas.amostra.map((system: any, idx: number) => (
                          <div key={idx} className="text-xs font-mono bg-muted p-2 rounded">
                            ID: {system.system_id} | User: {system.username}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pontos Locais */}
          <Card>
            <CardHeader>
              <CardTitle>Pontos Locais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{testResults.pontosLocais.total}</div>
                  <div className="text-sm text-muted-foreground">Total de Pontos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {testResults.pontosLocais.comApiUserId}
                  </div>
                  <div className="text-sm text-muted-foreground">Com API User ID</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {testResults.pontosLocais.semApiUserId}
                  </div>
                  <div className="text-sm text-muted-foreground">Sem API User ID</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resultados da Distribuição */}
      {distributionResults && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Resultado da Distribuição</CardTitle>
            <CardDescription>
              Modo: {distributionResults.modo === "one-per-point" ? "1:1" : "Pontos Fixos"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className={distributionResults.sucesso ? "border-green-500" : "border-red-500"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{distributionResults.message}</AlertTitle>
              {distributionResults.resumo && (
                <AlertDescription className="mt-2">
                  <div className="space-y-1">
                    <div>Total de Pontos: {distributionResults.resumo.totalPontos}</div>
                    <div>Total de Sistemas: {distributionResults.resumo.totalSistemas}</div>
                    <div>Pontos Atualizados: {distributionResults.pontosAtualizados}</div>
                    <div>Sistemas Criados: {distributionResults.sistemasCriados}</div>
                    <div>
                      API Externa: {distributionResults.resumo.apiExternaHabilitada ? "Habilitada" : "Desabilitada"}
                    </div>
                    {distributionResults.resumo.apiSincronizada && (
                      <div className="text-green-600 font-semibold">✅ Sincronizado com API</div>
                    )}
                  </div>
                </AlertDescription>
              )}
            </Alert>

            {/* Detalhes da Distribuição */}
            {distributionResults.detalhes && distributionResults.detalhes.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Detalhes:</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {distributionResults.detalhes.slice(0, 10).map((detalhe: any, idx: number) => (
                    <div key={idx} className="text-xs bg-muted p-2 rounded">
                      {detalhe.tipo}: {detalhe.descricao || JSON.stringify(detalhe)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}