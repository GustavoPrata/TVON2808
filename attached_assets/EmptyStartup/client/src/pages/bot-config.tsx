import { useState } from 'react';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  UserPlus, 
  Users, 
  MessageCircle, 
  Bot, 
  Power, 
  CheckCircle, 
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Variable,
  AlertCircle,
  MessageSquare,
  Settings,
  Calendar,
  Hash,
  RotateCcw,
  FileText,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { BotConfig } from '@/types';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function BotConfig() {
  const [activeTab, setActiveTab] = useState('novos');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'novos-menu': true,
    'clientes-menu': true,
    'testes-menu': true,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: botConfigs, isLoading: loadingBotConfigs } = useQuery({
    queryKey: ['/api/bot-config'],
    queryFn: api.getBotConfig,
  });

  const novosConfig = botConfigs?.find(config => config.tipo === 'novos');
  const clientesConfig = botConfigs?.find(config => config.tipo === 'clientes');
  const testesConfig = botConfigs?.find(config => config.tipo === 'testes');

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const updateBotStatusMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) => 
      api.updateBotConfig(id, { ativo }),
    onSuccess: () => {
      toast({ title: 'Status do bot atualizado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/bot-config'] });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar status do bot', variant: 'destructive' });
    },
  });

  const handleToggleBot = (config: BotConfig) => {
    updateBotStatusMutation.mutate({ 
      id: config.id, 
      ativo: !config.ativo 
    });
  };

  const renderBotMenu = (config: BotConfig | undefined, tipo: string) => {
    if (!config) {
      return (
        <div className="text-center py-8 text-slate-400">
          <p>Configuração não encontrada</p>
        </div>
      );
    }

    // Extract additional fields that might be in config but not typed
    const configData = config as any;

    return (
      <div className="space-y-6">
        {/* Status do Bot */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-800/50 to-slate-700/30 rounded-lg border border-slate-600">
          <div className="flex items-center gap-3">
            <Power className={`w-5 h-5 ${config.ativo ? 'text-green-400' : 'text-red-400'}`} />
            <span className="font-medium text-white">Status do Bot:</span>
            <Badge variant={config.ativo ? 'default' : 'secondary'} className={config.ativo ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>
              {config.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <Switch
            checked={config.ativo}
            onCheckedChange={() => handleToggleBot(config)}
            disabled={updateBotStatusMutation.isPending}
          />
        </div>

        {/* Detecção Inteligente de Palavras-Chave */}
        <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Detecção Inteligente de Palavras-Chave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300 mb-3">
              O bot detecta automaticamente palavras-chave nas mensagens:
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {tipo === 'novos' && (
                <>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">planos, preços, valores</span> → Mostra planos
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">teste, grátis, experimentar</span> → Oferece teste
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">suporte, ajuda, problema</span> → Abre suporte
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">vendedor, orçamento</span> → Conecta vendedor
                  </div>
                </>
              )}
              {tipo === 'clientes' && (
                <>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">vencimento, data, quando</span> → Mostra vencimento
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">pagar, pix, boleto</span> → Gera segunda via
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">renovar, upgrade, plano</span> → Opções de renovação
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">suporte, problema, ajuda</span> → Abre suporte
                  </div>
                </>
              )}
              {tipo === 'testes' && (
                <>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">status, tempo, expira</span> → Status do teste
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">configurar, instalar, app</span> → Tutorial
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">mais tempo, estender</span> → Solicita extensão
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
                    <span className="text-purple-400">virar cliente, assinar</span> → Converter teste
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mensagem de Boas Vindas */}
        <Collapsible open={expandedSections[`${tipo}-welcome`]} onOpenChange={() => toggleSection(`${tipo}-welcome`)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium text-slate-300">Mensagem de Boas-vindas</h3>
            </div>
            {expandedSections[`${tipo}-welcome`] ? 
              <ChevronDown className="w-4 h-4 text-slate-400" /> : 
              <ChevronRight className="w-4 h-4 text-slate-400" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
              <pre className="whitespace-pre-wrap text-sm text-slate-400 font-mono">
                {config.mensagemBoasVindas}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Menu Principal */}
        <Collapsible open={expandedSections[`${tipo}-menu`]} onOpenChange={() => toggleSection(`${tipo}-menu`)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-medium text-slate-300">Opções do Menu Principal</h3>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{config.opcoes.length} opções</Badge>
            </div>
            {expandedSections[`${tipo}-menu`] ? 
              <ChevronDown className="w-4 h-4 text-slate-400" /> : 
              <ChevronRight className="w-4 h-4 text-slate-400" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {config.opcoes.map((opcao, index) => (
              <div key={index} className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full font-semibold text-sm shadow-lg">
                    {opcao.numero}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-white text-base">{opcao.texto}</p>
                    {opcao.descricao && (
                      <p className="text-sm text-slate-400 mt-1">{opcao.descricao}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-slate-500">Ação:</span>
                      <Badge variant="outline" className="text-cyan-400 border-cyan-400/30">{opcao.acao}</Badge>
                      {opcao.resposta && (
                        <span className="text-slate-500">• Resposta personalizada configurada</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="p-4 bg-slate-800/20 rounded-lg border border-slate-700/50 mt-3">
              <p className="text-xs text-slate-400">
                💡 <strong>Dica:</strong> Opção "0" sempre volta ao menu principal
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Configurações Básicas */}
        <Collapsible open={expandedSections[`${tipo}-basic`]} onOpenChange={() => toggleSection(`${tipo}-basic`)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-medium text-slate-300">Configurações Básicas</h3>
            </div>
            {expandedSections[`${tipo}-basic`] ? 
              <ChevronDown className="w-4 h-4 text-slate-400" /> : 
              <ChevronRight className="w-4 h-4 text-slate-400" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <p className="text-slate-500">Tempo de Resposta:</p>
                </div>
                <p className="font-medium text-slate-200">{config.tempoResposta || 30} segundos</p>
              </div>
              <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3 h-3 text-green-400" />
                  <p className="text-slate-500">Detectar Novos:</p>
                </div>
                <p className="font-medium text-slate-200">{config.detectarNovosClientes ? 'Habilitado' : 'Desabilitado'}</p>
              </div>
              {config.rodape && (
                <div className="col-span-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3 h-3 text-purple-400" />
                    <p className="text-slate-500">Rodapé das Mensagens:</p>
                  </div>
                  <p className="font-medium text-slate-200">{config.rodape}</p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Configurações Avançadas */}
        <Collapsible open={expandedSections[`${tipo}-advanced`]} onOpenChange={() => toggleSection(`${tipo}-advanced`)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-medium text-slate-300">Configurações Avançadas</h3>
            </div>
            {expandedSections[`${tipo}-advanced`] ? 
              <ChevronDown className="w-4 h-4 text-slate-400" /> : 
              <ChevronRight className="w-4 h-4 text-slate-400" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="space-y-3">
              {/* Mensagens Customizadas */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Mensagens Customizadas</h4>
                <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                    <p className="text-xs text-slate-500">Mensagem de Erro:</p>
                  </div>
                  <p className="text-sm text-slate-300">{configData.mensagemErro || 'Desculpe, não entendi sua solicitação.'}</p>
                </div>
                <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-3 h-3 text-yellow-400" />
                    <p className="text-xs text-slate-500">Mensagem de Timeout:</p>
                  </div>
                  <p className="text-sm text-slate-300">{configData.mensagemTimeout || 'Tempo esgotado! Digite qualquer coisa para continuar.'}</p>
                </div>
              </div>

              {/* Comportamentos */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Comportamentos</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-800/30 rounded border border-slate-700 flex items-center justify-between">
                    <span className="text-slate-400">Permitir Texto Livre:</span>
                    <Badge variant={configData.permitirTextoLivre ? 'default' : 'secondary'} className="text-xs">
                      {configData.permitirTextoLivre ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div className="p-2 bg-slate-800/30 rounded border border-slate-700 flex items-center justify-between">
                    <span className="text-slate-400">Redirecionar Humano:</span>
                    <Badge variant={configData.redirecionarHumano !== false ? 'default' : 'secondary'} className="text-xs">
                      {configData.redirecionarHumano !== false ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div className="p-2 bg-slate-800/30 rounded border border-slate-700 flex items-center justify-between">
                    <span className="text-slate-400">Opção Atendente:</span>
                    <Badge variant={configData.opcaoAtendimentoHumano !== false ? 'default' : 'secondary'} className="text-xs">
                      {configData.opcaoAtendimentoHumano !== false ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div className="p-2 bg-slate-800/30 rounded border border-slate-700 flex items-center justify-between">
                    <span className="text-slate-400">Permitir Voltar:</span>
                    <Badge variant={configData.permitirVoltar !== false ? 'default' : 'secondary'} className="text-xs">
                      {configData.permitirVoltar !== false ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Configurações de Menu */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Configurações de Menu</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-800/30 rounded border border-slate-700">
                    <div className="flex items-center gap-1 mb-1">
                      <Hash className="w-3 h-3 text-blue-400" />
                      <span className="text-xs text-slate-500">Máx. Botões:</span>
                    </div>
                    <span className="text-sm text-slate-200">{configData.maxBotoesMenu || 3}</span>
                  </div>
                  <div className="p-2 bg-slate-800/30 rounded border border-slate-700">
                    <div className="flex items-center gap-1 mb-1">
                      <Hash className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-slate-500">Mostrar Números:</span>
                    </div>
                    <span className="text-sm text-slate-200">{configData.mostrarNumeracao !== false ? 'Sim' : 'Não'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Variáveis Disponíveis */}
        <Collapsible open={expandedSections[`${tipo}-variables`]} onOpenChange={() => toggleSection(`${tipo}-variables`)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center gap-2">
              <Variable className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-medium text-slate-300">Variáveis Dinâmicas Disponíveis</h3>
            </div>
            {expandedSections[`${tipo}-variables`] ? 
              <ChevronDown className="w-4 h-4 text-slate-400" /> : 
              <ChevronRight className="w-4 h-4 text-slate-400" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-3">
                Essas variáveis são substituídas automaticamente nas mensagens:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {configData.variaveisDisponiveis && Array.isArray(configData.variaveisDisponiveis) && 
                  configData.variaveisDisponiveis.map((variavel: string, index: number) => (
                    <div key={index} className="p-2 bg-slate-900/50 rounded border border-slate-600">
                      <code className="text-xs text-cyan-400">{variavel}</code>
                    </div>
                  ))
                }
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Timestamps */}
        {(configData.criadoEm || configData.atualizadoEm) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-700/50">
            <div className="flex items-center gap-4">
              {configData.criadoEm && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Criado: {new Date(configData.criadoEm).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              {configData.atualizadoEm && (
                <div className="flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />
                  <span>Atualizado: {new Date(configData.atualizadoEm).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loadingBotConfigs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Configuração do Bot
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Sistema completo de bot inteligente com detecção de palavras-chave e menus interativos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Section */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-400 mb-1">Bot para Novos</p>
                <p className="text-2xl font-bold text-white">{novosConfig?.ativo ? 'Ativo' : 'Inativo'}</p>
              </div>
              <UserPlus className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-400 mb-1">Bot para Clientes</p>
                <p className="text-2xl font-bold text-white">{clientesConfig?.ativo ? 'Ativo' : 'Inativo'}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-400 mb-1">Bot para Testes</p>
                <p className="text-2xl font-bold text-white">{testesConfig?.ativo ? 'Ativo' : 'Inativo'}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-purple-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How It Works Section */}
      <Card className="mb-6 bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            Como o Bot Funciona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300">1. Detecção Automática</h4>
              <p className="text-xs text-slate-400">
                O bot identifica automaticamente se a pessoa é um novo cliente, cliente existente ou está em teste.
              </p>
              
              <h4 className="text-sm font-medium text-slate-300">2. Saudação Personalizada</h4>
              <p className="text-xs text-slate-400">
                Envia saudação baseada no horário (Bom dia/tarde/noite) com menu específico para cada tipo.
              </p>
              
              <h4 className="text-sm font-medium text-slate-300">3. Palavras-Chave Inteligentes</h4>
              <p className="text-xs text-slate-400">
                Detecta palavras como "planos", "pagar", "suporte" e direciona automaticamente.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300">4. Respostas Dinâmicas</h4>
              <p className="text-xs text-slate-400">
                Usa variáveis como {'{{nome}}'}, {'{{vencimento}}'} para personalizar mensagens.
              </p>
              
              <h4 className="text-sm font-medium text-slate-300">5. Integração PIX</h4>
              <p className="text-xs text-slate-400">
                Gera automaticamente códigos PIX reais para pagamentos quando solicitado.
              </p>
              
              <h4 className="text-sm font-medium text-slate-300">6. Atendimento Humano</h4>
              <p className="text-xs text-slate-400">
                Transfere para atendente quando necessário, criando tickets automaticamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="novos">
            <UserPlus className="w-4 h-4 mr-2" />
            Novos
          </TabsTrigger>
          <TabsTrigger value="clientes">
            <Users className="w-4 h-4 mr-2" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="testes">
            <MessageCircle className="w-4 h-4 mr-2" />
            Testes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="novos" className="space-y-6">
          <Card className="bg-slate-900 border-slate-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" />
                    Bot para Novos Clientes
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Menu automatizado para pessoas que ainda não são clientes
                  </CardDescription>
                </div>
                {novosConfig && (
                  <div className="flex items-center gap-2">
                    {novosConfig.ativo ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {renderBotMenu(novosConfig, 'novos')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-6">
          <Card className="bg-slate-900 border-slate-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Bot para Clientes
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Menu automatizado para clientes existentes
                  </CardDescription>
                </div>
                {clientesConfig && (
                  <div className="flex items-center gap-2">
                    {clientesConfig.ativo ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {renderBotMenu(clientesConfig, 'clientes')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testes" className="space-y-6">
          <Card className="bg-slate-900 border-slate-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-primary" />
                    Bot para Testes
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Menu automatizado para usuários em período de teste
                  </CardDescription>
                </div>
                {testesConfig && (
                  <div className="flex items-center gap-2">
                    {testesConfig.ativo ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {renderBotMenu(testesConfig, 'testes')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}