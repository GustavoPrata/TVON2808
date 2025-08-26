import { useState, useEffect } from 'react';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Plus, 
  Trash2, 
  Save,
  Copy,
  Eye,
  Settings,
  MessageSquare,
  Zap,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  UserPlus,
  FlaskConical,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  RefreshCw,
  FileText,
  Variable,
  Sparkles,
  Lightbulb
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { BotConfig, BotOption } from '@/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';

// Componente para item do menu sortable
function SortableMenuItem({ 
  option, 
  onUpdate, 
  onDelete 
}: { 
  option: BotOption & { id: string };
  onUpdate: (option: BotOption & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 bg-slate-800/50 rounded-lg border ${isDragging ? 'border-blue-500' : 'border-slate-700'} space-y-3`}
    >
      <div className="flex items-start gap-3">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-move text-slate-500 hover:text-slate-300"
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path fill="currentColor" d="M7 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM17 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM17 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM17 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
          </svg>
        </div>
        
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <Label className="text-xs text-slate-400">Número</Label>
              <Input
                value={option.numero}
                onChange={(e) => onUpdate({ ...option, numero: e.target.value })}
                className="mt-1 bg-slate-900/50 border-slate-600"
                placeholder="1"
              />
            </div>
            <div className="col-span-3">
              <Label className="text-xs text-slate-400">Texto do Menu</Label>
              <Input
                value={option.texto}
                onChange={(e) => onUpdate({ ...option, texto: e.target.value })}
                className="mt-1 bg-slate-900/50 border-slate-600"
                placeholder="Ex: Ver planos disponíveis"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-400">Descrição (opcional)</Label>
            <Input
              value={option.descricao || ''}
              onChange={(e) => onUpdate({ ...option, descricao: e.target.value })}
              className="mt-1 bg-slate-900/50 border-slate-600"
              placeholder="Ex: Conheça nossos planos e promoções"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Ação</Label>
              <Select value={option.acao} onValueChange={(value) => onUpdate({ ...option, acao: value })}>
                <SelectTrigger className="mt-1 bg-slate-900/50 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="responder">Responder com Mensagem</SelectItem>
                  <SelectItem value="criar_pix">Criar Cobrança PIX</SelectItem>
                  <SelectItem value="mostrar_vencimento">Mostrar Vencimento</SelectItem>
                  <SelectItem value="criar_ticket">Criar Ticket Suporte</SelectItem>
                  <SelectItem value="transferir_humano">Transferir para Humano</SelectItem>
                  <SelectItem value="mostrar_planos">Mostrar Planos</SelectItem>
                  <SelectItem value="criar_teste">Criar Teste Grátis</SelectItem>
                  <SelectItem value="mostrar_status_teste">Status do Teste</SelectItem>
                  <SelectItem value="enviar_tutorial">Enviar Tutorial</SelectItem>
                  <SelectItem value="submenu">Abrir Submenu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-slate-400">Palavras-chave (separe por vírgula)</Label>
              <Input
                value={option.keywords || ''}
                onChange={(e) => onUpdate({ ...option, keywords: e.target.value })}
                className="mt-1 bg-slate-900/50 border-slate-600"
                placeholder="planos, valores, preços"
              />
            </div>
          </div>

          {option.acao === 'responder' && (
            <div>
              <Label className="text-xs text-slate-400">Resposta</Label>
              <Textarea
                value={option.resposta || ''}
                onChange={(e) => onUpdate({ ...option, resposta: e.target.value })}
                className="mt-1 bg-slate-900/50 border-slate-600 min-h-[100px]"
                placeholder="Digite a mensagem de resposta..."
              />
            </div>
          )}

          {option.acao === 'submenu' && (
            <div>
              <Label className="text-xs text-slate-400">ID do Submenu</Label>
              <Input
                value={option.submenuId || ''}
                onChange={(e) => onUpdate({ ...option, submenuId: e.target.value })}
                className="mt-1 bg-slate-900/50 border-slate-600"
                placeholder="submenu_planos"
              />
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(option.id)}
          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Templates predefinidos
const templates = {
  novos: {
    mensagemBoasVindas: `🎉 *Seja bem-vindo(a) à {{empresa}}!*

{{saudacao}}! Eu sou o assistente virtual e estou aqui para ajudar você.

Como posso ajudar você hoje? Digite o número da opção desejada:`,
    opcoes: [
      {
        id: '1',
        numero: '1',
        texto: '💰 Ver Planos e Preços',
        descricao: 'Conheça nossos planos',
        acao: 'mostrar_planos',
        keywords: 'planos, preços, valores, quanto custa'
      },
      {
        id: '2',
        numero: '2',
        texto: '🎮 Teste Grátis',
        descricao: 'Experimente sem compromisso',
        acao: 'criar_teste',
        keywords: 'teste, grátis, experimentar, testar'
      },
      {
        id: '3',
        numero: '3',
        texto: '💬 Falar com Vendedor',
        descricao: 'Atendimento personalizado',
        acao: 'transferir_humano',
        keywords: 'vendedor, atendente, humano, falar'
      },
      {
        id: '4',
        numero: '4',
        texto: '❓ Suporte Técnico',
        descricao: 'Tire suas dúvidas',
        acao: 'criar_ticket',
        keywords: 'suporte, ajuda, problema, dúvida'
      }
    ]
  },
  clientes: {
    mensagemBoasVindas: `👋 *Olá, {{nome}}!*

{{saudacao}}! Bem-vindo(a) de volta.

📊 *Seu Status:*
• Plano: {{plano}}
• Vencimento: {{vencimento}}
• Status: {{status}}

Como posso ajudar você hoje?`,
    opcoes: [
      {
        id: '1',
        numero: '1',
        texto: '📅 Ver Vencimento',
        descricao: 'Data e status do pagamento',
        acao: 'mostrar_vencimento',
        keywords: 'vencimento, data, quando vence'
      },
      {
        id: '2',
        numero: '2',
        texto: '💳 Segunda Via / Pagar',
        descricao: 'Gerar PIX para pagamento',
        acao: 'criar_pix',
        keywords: 'pagar, pix, boleto, segunda via'
      },
      {
        id: '3',
        numero: '3',
        texto: '🔄 Renovar/Mudar Plano',
        descricao: 'Opções de renovação',
        acao: 'mostrar_planos',
        keywords: 'renovar, mudar plano, upgrade'
      },
      {
        id: '4',
        numero: '4',
        texto: '🔧 Suporte Técnico',
        descricao: 'Problemas técnicos',
        acao: 'criar_ticket',
        keywords: 'suporte, problema, não funciona'
      },
      {
        id: '5',
        numero: '5',
        texto: '👤 Falar com Atendente',
        descricao: 'Atendimento humano',
        acao: 'transferir_humano',
        keywords: 'atendente, humano, falar'
      }
    ]
  },
  testes: {
    mensagemBoasVindas: `🎮 *Olá, {{nome}}!*

Você está usando nosso *TESTE GRÁTIS*!

⏰ *Status do Teste:*
• Expira em: {{teste_expiracao}}
• Dispositivo: {{teste_dispositivo}}
• App: {{teste_aplicativo}}

O que você precisa?`,
    opcoes: [
      {
        id: '1',
        numero: '1',
        texto: '📊 Status do Teste',
        descricao: 'Ver tempo restante',
        acao: 'mostrar_status_teste',
        keywords: 'status, tempo, quanto tempo'
      },
      {
        id: '2',
        numero: '2',
        texto: '📱 Como Configurar',
        descricao: 'Tutorial de instalação',
        acao: 'enviar_tutorial',
        keywords: 'configurar, instalar, tutorial'
      },
      {
        id: '3',
        numero: '3',
        texto: '⏰ Solicitar Mais Tempo',
        descricao: 'Estender teste',
        acao: 'criar_ticket',
        keywords: 'mais tempo, estender, prolongar'
      },
      {
        id: '4',
        numero: '4',
        texto: '✅ Virar Cliente',
        descricao: 'Assinar um plano',
        acao: 'mostrar_planos',
        keywords: 'assinar, virar cliente, contratar'
      },
      {
        id: '5',
        numero: '5',
        texto: '❓ Suporte',
        descricao: 'Ajuda com o teste',
        acao: 'criar_ticket',
        keywords: 'suporte, ajuda, problema'
      }
    ]
  }
};

export default function BotConfigNew() {
  const [activeTab, setActiveTab] = useState('geral');
  const [selectedBotType, setSelectedBotType] = useState('novos');
  const [editingConfig, setEditingConfig] = useState<any>({
    novos: {
      ativo: false,
      mensagemBoasVindas: '',
      opcoes: [],
      ...templates.novos
    },
    clientes: {
      ativo: false,
      mensagemBoasVindas: '',
      opcoes: [],
      ...templates.clientes
    },
    testes: {
      ativo: false,
      mensagemBoasVindas: '',
      opcoes: [],
      ...templates.testes
    }
  });

  const [eventMessages, setEventMessages] = useState({
    aoIniciarConversa: 'Olá! Aguarde um momento enquanto verifico seus dados...',
    aoCriarPix: '💰 *PIX Gerado com Sucesso!*\n\nValor: R$ {{valor}}\nVencimento: {{vencimento}}\n\n📱 *PIX Copia e Cola:*\n{{pix_codigo}}\n\n🔗 *Link de Pagamento:*\n{{link_pagamento}}\n\n✅ Após o pagamento, seu acesso será liberado automaticamente!',
    aoConfirmarPagamento: '✅ *Pagamento Confirmado!*\n\nObrigado pelo pagamento de R$ {{valor}}!\n\nSeu acesso foi renovado com sucesso.\nNovo vencimento: {{novo_vencimento}}\n\nAproveite! 🎉',
    aoPagamentoExpirar: '⚠️ *Aviso de Pagamento Expirado*\n\nO PIX de R$ {{valor}} expirou.\n\nSe ainda deseja fazer o pagamento, digite *2* para gerar um novo código.',
    aoTransferirHumano: '👤 *Transferindo para Atendimento Humano*\n\nVocê será atendido por um de nossos colaboradores em breve.\n\n⏰ Tempo médio de espera: 5 minutos\n\nObrigado pela paciência!',
    aoErroGeral: '❌ *Ops! Algo deu errado*\n\nOcorreu um erro ao processar sua solicitação.\n\nPor favor, tente novamente ou digite *0* para voltar ao menu principal.',
    aoTimeout: '⏰ *Tempo Esgotado*\n\nVocê demorou muito para responder.\n\nDigite qualquer coisa para continuar ou *0* para ver o menu novamente.'
  });

  const [configuracoes, setConfiguracoes] = useState({
    tempoResposta: 30,
    detectarNovosClientes: true,
    permitirTextoLivre: false,
    redirecionarHumano: true,
    mostrarNumeracao: true,
    permitirVoltar: true,
    maxBotoesMenu: 5,
    rodape: 'TV ON Sistema - Atendimento 24/7',
    empresa: 'TV ON',
    usarBotoes: false // WhatsApp descontinuou botões
  });

  const [variaveis] = useState([
    { nome: '{{nome}}', descricao: 'Nome do cliente' },
    { nome: '{{telefone}}', descricao: 'Telefone do cliente' },
    { nome: '{{empresa}}', descricao: 'Nome da empresa' },
    { nome: '{{saudacao}}', descricao: 'Bom dia/tarde/noite' },
    { nome: '{{vencimento}}', descricao: 'Data de vencimento' },
    { nome: '{{status}}', descricao: 'Status do cliente' },
    { nome: '{{plano}}', descricao: 'Plano do cliente' },
    { nome: '{{valor}}', descricao: 'Valor do pagamento' },
    { nome: '{{pix_codigo}}', descricao: 'Código PIX copia e cola' },
    { nome: '{{link_pagamento}}', descricao: 'Link de pagamento' },
    { nome: '{{teste_expiracao}}', descricao: 'Data de expiração do teste' },
    { nome: '{{teste_dispositivo}}', descricao: 'Dispositivo do teste' },
    { nome: '{{teste_aplicativo}}', descricao: 'Aplicativo do teste' }
  ]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const config = editingConfig[selectedBotType];
      const oldIndex = config.opcoes.findIndex((item: any) => item.id === active.id);
      const newIndex = config.opcoes.findIndex((item: any) => item.id === over?.id);
      
      const newOpcoes = arrayMove(config.opcoes, oldIndex, newIndex);
      
      // Atualizar números
      newOpcoes.forEach((opcao: any, index: number) => {
        opcao.numero = String(index + 1);
      });
      
      setEditingConfig({
        ...editingConfig,
        [selectedBotType]: {
          ...config,
          opcoes: newOpcoes
        }
      });
    }
  };

  const addOption = () => {
    const config = editingConfig[selectedBotType];
    const newOption = {
      id: Date.now().toString(),
      numero: String(config.opcoes.length + 1),
      texto: '',
      descricao: '',
      acao: 'responder',
      resposta: '',
      keywords: ''
    };
    
    setEditingConfig({
      ...editingConfig,
      [selectedBotType]: {
        ...config,
        opcoes: [...config.opcoes, newOption]
      }
    });
  };

  const updateOption = (updatedOption: any) => {
    const config = editingConfig[selectedBotType];
    setEditingConfig({
      ...editingConfig,
      [selectedBotType]: {
        ...config,
        opcoes: config.opcoes.map((opt: any) => 
          opt.id === updatedOption.id ? updatedOption : opt
        )
      }
    });
  };

  const deleteOption = (id: string) => {
    const config = editingConfig[selectedBotType];
    const newOpcoes = config.opcoes.filter((opt: any) => opt.id !== id);
    
    // Reordenar números
    newOpcoes.forEach((opcao: any, index: number) => {
      opcao.numero = String(index + 1);
    });
    
    setEditingConfig({
      ...editingConfig,
      [selectedBotType]: {
        ...config,
        opcoes: newOpcoes
      }
    });
  };

  const loadTemplate = (type: string) => {
    if (templates[type as keyof typeof templates]) {
      setEditingConfig({
        ...editingConfig,
        [type]: {
          ...editingConfig[type],
          ...templates[type as keyof typeof templates]
        }
      });
      toast({
        title: "Template Carregado",
        description: "O template foi aplicado com sucesso!",
      });
    }
  };

  const saveConfiguration = () => {
    // Aqui você salvaria a configuração
    toast({
      title: "Configuração Salva",
      description: "As configurações do bot foram salvas com sucesso!",
    });
  };

  const renderPreview = () => {
    const config = editingConfig[selectedBotType];
    const preview = config.mensagemBoasVindas
      .replace('{{saudacao}}', 'Boa tarde')
      .replace('{{nome}}', 'João')
      .replace('{{empresa}}', configuracoes.empresa)
      .replace('{{vencimento}}', '15/02/2025')
      .replace('{{status}}', 'Ativo')
      .replace('{{plano}}', 'Premium')
      .replace('{{teste_expiracao}}', '2 horas')
      .replace('{{teste_dispositivo}}', 'Smart TV')
      .replace('{{teste_aplicativo}}', 'IBO Player');

    return (
      <div className="bg-slate-900 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MessageSquare className="w-3 h-3" />
          <span>Pré-visualização da Conversa</span>
        </div>
        
        <div className="bg-green-900/20 rounded-lg p-3 max-w-[80%]">
          <pre className="whitespace-pre-wrap text-sm text-white font-mono">
            {preview}
          </pre>
        </div>
        
        {config.opcoes.length > 0 && (
          <div className="bg-green-900/20 rounded-lg p-3 max-w-[80%]">
            <div className="space-y-1 text-sm text-white">
              {config.opcoes.map((opcao: any) => (
                <div key={opcao.id}>
                  <span className="font-bold">{opcao.numero}</span> - {opcao.texto}
                  {opcao.descricao && (
                    <span className="text-slate-400 text-xs block ml-4">{opcao.descricao}</span>
                  )}
                </div>
              ))}
              {configuracoes.permitirVoltar && (
                <div>
                  <span className="font-bold">0</span> - Voltar ao menu principal
                </div>
              )}
            </div>
            {configuracoes.rodape && (
              <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-400">
                {configuracoes.rodape}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Configuração Completa do Bot
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Configure todos os aspectos do seu bot de atendimento
              </p>
            </div>
          </div>
          <Button
            onClick={saveConfiguration}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Configurações
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full bg-slate-900/50">
          <TabsTrigger value="geral" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20">
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="menus" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20">
            <MessageSquare className="w-4 h-4 mr-2" />
            Menus
          </TabsTrigger>
          <TabsTrigger value="eventos" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20">
            <Zap className="w-4 h-4 mr-2" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20">
            <Eye className="w-4 h-4 mr-2" />
            Visualizar
          </TabsTrigger>
        </TabsList>

        {/* Aba de Configurações Gerais */}
        <TabsContent value="geral" className="space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>Configure o comportamento geral do bot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Nome da Empresa</Label>
                    <Input
                      value={configuracoes.empresa}
                      onChange={(e) => setConfiguracoes({ ...configuracoes, empresa: e.target.value })}
                      className="mt-1 bg-slate-800/50 border-slate-600"
                    />
                  </div>
                  
                  <div>
                    <Label>Rodapé das Mensagens</Label>
                    <Input
                      value={configuracoes.rodape}
                      onChange={(e) => setConfiguracoes({ ...configuracoes, rodape: e.target.value })}
                      className="mt-1 bg-slate-800/50 border-slate-600"
                    />
                  </div>
                  
                  <div>
                    <Label>Tempo de Resposta (segundos)</Label>
                    <Input
                      type="number"
                      value={configuracoes.tempoResposta}
                      onChange={(e) => setConfiguracoes({ ...configuracoes, tempoResposta: parseInt(e.target.value) })}
                      className="mt-1 bg-slate-800/50 border-slate-600"
                      min="10"
                      max="300"
                    />
                  </div>
                  
                  <div>
                    <Label>Máximo de Opções no Menu</Label>
                    <Input
                      type="number"
                      value={configuracoes.maxBotoesMenu}
                      onChange={(e) => setConfiguracoes({ ...configuracoes, maxBotoesMenu: parseInt(e.target.value) })}
                      className="mt-1 bg-slate-800/50 border-slate-600"
                      min="3"
                      max="10"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Detectar Novos Clientes</Label>
                    <Switch
                      checked={configuracoes.detectarNovosClientes}
                      onCheckedChange={(checked) => setConfiguracoes({ ...configuracoes, detectarNovosClientes: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Permitir Texto Livre</Label>
                    <Switch
                      checked={configuracoes.permitirTextoLivre}
                      onCheckedChange={(checked) => setConfiguracoes({ ...configuracoes, permitirTextoLivre: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Redirecionar para Humano</Label>
                    <Switch
                      checked={configuracoes.redirecionarHumano}
                      onCheckedChange={(checked) => setConfiguracoes({ ...configuracoes, redirecionarHumano: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Mostrar Numeração</Label>
                    <Switch
                      checked={configuracoes.mostrarNumeracao}
                      onCheckedChange={(checked) => setConfiguracoes({ ...configuracoes, mostrarNumeracao: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Permitir Voltar (Opção 0)</Label>
                    <Switch
                      checked={configuracoes.permitirVoltar}
                      onCheckedChange={(checked) => setConfiguracoes({ ...configuracoes, permitirVoltar: checked })}
                    />
                  </div>
                </div>
              </div>
              
              {/* Variáveis Disponíveis */}
              <Separator />
              
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Variable className="w-5 h-5 text-cyan-400" />
                  Variáveis Disponíveis
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {variaveis.map((variavel) => (
                    <div key={variavel.nome} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <code className="text-cyan-400 text-sm">{variavel.nome}</code>
                      <p className="text-xs text-slate-400 mt-1">{variavel.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Menus */}
        <TabsContent value="menus" className="space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configuração de Menus</CardTitle>
                  <CardDescription>Configure os menus para cada tipo de usuário</CardDescription>
                </div>
                <Select value={selectedBotType} onValueChange={setSelectedBotType}>
                  <SelectTrigger className="w-[200px] bg-slate-800/50 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novos">
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Novos Clientes
                      </div>
                    </SelectItem>
                    <SelectItem value="clientes">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Clientes
                      </div>
                    </SelectItem>
                    <SelectItem value="testes">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4" />
                        Testes
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status e Template */}
              <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={editingConfig[selectedBotType].ativo}
                    onCheckedChange={(checked) => setEditingConfig({
                      ...editingConfig,
                      [selectedBotType]: {
                        ...editingConfig[selectedBotType],
                        ativo: checked
                      }
                    })}
                  />
                  <span className="font-medium">Bot {editingConfig[selectedBotType].ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => loadTemplate(selectedBotType)}
                  className="border-blue-500/50 hover:bg-blue-500/10"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Carregar Template
                </Button>
              </div>

              {/* Mensagem de Boas-vindas */}
              <div>
                <Label>Mensagem de Boas-vindas</Label>
                <Textarea
                  value={editingConfig[selectedBotType].mensagemBoasVindas}
                  onChange={(e) => setEditingConfig({
                    ...editingConfig,
                    [selectedBotType]: {
                      ...editingConfig[selectedBotType],
                      mensagemBoasVindas: e.target.value
                    }
                  })}
                  className="mt-1 bg-slate-800/50 border-slate-600 min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Use as variáveis como {'{{nome}}'}, {'{{saudacao}}'}, etc.
                </p>
              </div>

              {/* Opções do Menu */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Opções do Menu</h3>
                  <Button
                    onClick={addOption}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Opção
                  </Button>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={editingConfig[selectedBotType].opcoes.map((opt: any) => opt.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {editingConfig[selectedBotType].opcoes.map((option: any) => (
                        <SortableMenuItem
                          key={option.id}
                          option={option}
                          onUpdate={updateOption}
                          onDelete={deleteOption}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {editingConfig[selectedBotType].opcoes.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma opção adicionada ainda</p>
                    <p className="text-sm">Clique em "Adicionar Opção" para começar</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Eventos */}
        <TabsContent value="eventos" className="space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle>Mensagens de Eventos</CardTitle>
              <CardDescription>Configure as mensagens para cada evento do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    Ao Iniciar Conversa
                  </Label>
                  <Textarea
                    value={eventMessages.aoIniciarConversa}
                    onChange={(e) => setEventMessages({ ...eventMessages, aoIniciarConversa: e.target.value })}
                    className="mt-1 bg-slate-800/50 border-slate-600 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    Ao Criar PIX
                  </Label>
                  <Textarea
                    value={eventMessages.aoCriarPix}
                    onChange={(e) => setEventMessages({ ...eventMessages, aoCriarPix: e.target.value })}
                    className="mt-1 bg-slate-800/50 border-slate-600 min-h-[120px]"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Ao Confirmar Pagamento
                  </Label>
                  <Textarea
                    value={eventMessages.aoConfirmarPagamento}
                    onChange={(e) => setEventMessages({ ...eventMessages, aoConfirmarPagamento: e.target.value })}
                    className="mt-1 bg-slate-800/50 border-slate-600 min-h-[100px]"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    Ao Pagamento Expirar
                  </Label>
                  <Textarea
                    value={eventMessages.aoPagamentoExpirar}
                    onChange={(e) => setEventMessages({ ...eventMessages, aoPagamentoExpirar: e.target.value })}
                    className="mt-1 bg-slate-800/50 border-slate-600 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    Ao Transferir para Humano
                  </Label>
                  <Textarea
                    value={eventMessages.aoTransferirHumano}
                    onChange={(e) => setEventMessages({ ...eventMessages, aoTransferirHumano: e.target.value })}
                    className="mt-1 bg-slate-800/50 border-slate-600 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    Ao Ocorrer Erro
                  </Label>
                  <Textarea
                    value={eventMessages.aoErroGeral}
                    onChange={(e) => setEventMessages({ ...eventMessages, aoErroGeral: e.target.value })}
                    className="mt-1 bg-slate-800/50 border-slate-600 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-400" />
                    Ao Expirar Tempo
                  </Label>
                  <Textarea
                    value={eventMessages.aoTimeout}
                    onChange={(e) => setEventMessages({ ...eventMessages, aoTimeout: e.target.value })}
                    className="mt-1 bg-slate-800/50 border-slate-600 min-h-[80px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Preview */}
        <TabsContent value="preview" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle>Pré-visualização</CardTitle>
                <CardDescription>Veja como o bot aparecerá no WhatsApp</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedBotType} onValueChange={setSelectedBotType}>
                  <SelectTrigger className="mb-4 bg-slate-800/50 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novos">Novos Clientes</SelectItem>
                    <SelectItem value="clientes">Clientes</SelectItem>
                    <SelectItem value="testes">Testes</SelectItem>
                  </SelectContent>
                </Select>
                
                {renderPreview()}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle>Testar Bot</CardTitle>
                <CardDescription>Envie mensagens de teste</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Número para Teste</Label>
                  <Input
                    value="14991949280"
                    readOnly
                    className="mt-1 bg-slate-800/50 border-slate-600"
                  />
                </div>
                
                <div className="space-y-2">
                  <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                    <Play className="w-4 h-4 mr-2" />
                    Enviar Menu de Teste
                  </Button>
                  
                  <Button variant="outline" className="w-full border-slate-600">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Resetar Conversa de Teste
                  </Button>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Testar Eventos</h4>
                  <Button variant="outline" size="sm" className="w-full border-slate-600">
                    Simular Criação de PIX
                  </Button>
                  <Button variant="outline" size="sm" className="w-full border-slate-600">
                    Simular Confirmação de Pagamento
                  </Button>
                  <Button variant="outline" size="sm" className="w-full border-slate-600">
                    Simular Timeout
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}