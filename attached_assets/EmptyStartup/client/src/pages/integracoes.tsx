import { useState, useEffect } from 'react';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Save, TestTube, CheckCircle, Key, Link, Server, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

const apiConfigSchema = z.object({
  baseUrl: z.string().url('URL base deve ser válida'),
  apiKey: z.string().min(1, 'Chave da API é obrigatória'),
});

type ApiConfigForm = z.infer<typeof apiConfigSchema>;

export default function Integracoes() {
  const [isTestingApi, setIsTestingApi] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integracoes } = useQuery({
    queryKey: ['/api/integracoes'],
    queryFn: api.getIntegracoes,
  });

  const apiConfig = integracoes?.find(i => i.tipo === 'api_externa');

  const apiForm = useForm<ApiConfigForm>({
    resolver: zodResolver(apiConfigSchema),
    defaultValues: {
      baseUrl: '',
      apiKey: '',
    },
  });

  // Update form when apiConfig changes
  useEffect(() => {
    if (apiConfig) {
      apiForm.reset({
        baseUrl: apiConfig.configuracoes?.baseUrl || '',
        apiKey: apiConfig.configuracoes?.apiKey || '',
      });
    }
  }, [apiConfig]);

  const configureApiMutation = useMutation({
    mutationFn: (data: ApiConfigForm) => api.configureExternalApi(data),
    onSuccess: () => {
      toast({ title: 'Configuração da API salva com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/integracoes'] });
    },
    onError: () => {
      toast({ title: 'Erro ao salvar configuração da API', variant: 'destructive' });
    },
  });

  const onSubmitApi = (data: ApiConfigForm) => {
    configureApiMutation.mutate(data);
  };

  const handleTestApi = async () => {
    setIsTestingApi(true);
    try {
      const result = await api.testExternalApi();
      if (result.connected) {
        toast({ title: 'Conexão com API estabelecida com sucesso!' });
      } else {
        toast({ title: 'Falha na conexão com a API', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro ao testar conexão', variant: 'destructive' });
    } finally {
      setIsTestingApi(false);
    }
  };



  return (
    <div className="space-y-6">
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Settings className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Integrações
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Configure a integração com API Externa
              </p>
            </div>
          </div>
        </div>
      </div>
      

          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-xl">
                <Server className="w-5 h-5 text-blue-400" />
                Configuração da API Externa
              </CardTitle>
              <CardDescription className="text-slate-400">
                Configure a conexão com a API externa do sistema de TV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={apiForm.handleSubmit(onSubmitApi)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="baseUrl" className="text-white font-medium flex items-center gap-2">
                    <Link className="w-4 h-4 text-blue-400" />
                    URL Base da API
                  </Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    {...apiForm.register('baseUrl')}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-400 focus:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.exemplo.com"
                  />
                  {apiForm.formState.errors.baseUrl && (
                    <p className="text-red-400 text-sm mt-1">
                      {apiForm.formState.errors.baseUrl.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-white font-medium flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-400" />
                    Chave da API
                  </Label>
                  <Input
                    id="apiKey"
                    type="text"
                    {...apiForm.register('apiKey')}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-400 focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="Sua chave de API"
                  />
                  {apiForm.formState.errors.apiKey && (
                    <p className="text-red-400 text-sm mt-1">
                      {apiForm.formState.errors.apiKey.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium">Status da API</span>
                  <Badge className={apiConfig?.ativo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                    {apiConfig?.ativo ? 'Configurado' : 'Não configurado'}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button 
                    type="button"
                    onClick={handleTestApi}
                    disabled={isTestingApi}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold shadow-lg shadow-yellow-500/30 transition-all hover:scale-105"
                  >
                    <TestTube className={`w-4 h-4 mr-2 ${isTestingApi ? 'animate-pulse' : ''}`} />
                    {isTestingApi ? 'Testando...' : 'Testar Conexão'}
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
                    disabled={configureApiMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configuração
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {apiConfig && apiConfig.ativo && (
            <Card className="bg-dark-card border-slate-600">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  API Configurada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">URL Base</p>
                    <p className="text-white font-mono text-sm">{apiConfig.configuracoes?.baseUrl}</p>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">API Key</p>
                    <p className="text-white font-mono text-sm">{'•'.repeat(apiConfig.configuracoes?.apiKey?.length || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-dark-card border-slate-600">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Server className="w-5 h-5 text-indigo-400" />
                </div>
                Endpoints Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      Usuários
                    </h4>
                    <ul className="text-slate-400 space-y-2 font-mono text-sm">
                      <li className="flex items-center gap-2">
                        <span className="text-green-400 text-xs">GET</span>
                        /users/get
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-blue-400 text-xs">POST</span>
                        /users/adicionar
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-yellow-400 text-xs">PUT</span>
                        /users/editar/{`{id}`}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-red-400 text-xs">DELETE</span>
                        /users/apagar/{`{id}`}
                      </li>
                    </ul>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-indigo-400" />
                      Configurações
                    </h4>
                    <ul className="text-slate-400 space-y-2 font-mono text-sm">
                      <li className="flex items-center gap-2">
                        <span className="text-green-400 text-xs">GET</span>
                        /settings/get
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-blue-400 text-xs">POST</span>
                        /settings/adicionar
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-yellow-400 text-xs">PUT</span>
                        /settings/editar/{`{key}`}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-red-400 text-xs">DELETE</span>
                        /settings/apagar/{`{key}`}
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-dark-surface rounded-lg">
                  <h4 className="font-medium text-slate-300 mb-2">Autenticação</h4>
                  <p className="text-slate-400 text-sm">
                    Todas as requisições devem incluir o header:
                  </p>
                  <code className="text-xs bg-dark-card p-2 rounded mt-1 block">
                    Authorization: Bearer {`{api_key}`}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
    </div>
  );
}
