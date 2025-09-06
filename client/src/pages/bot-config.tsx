import { useState } from 'react';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  UserPlus, 
  Users, 
  MessageCircle, 
  Clock,
  AlertCircle,
  ChevronRight,
  Phone,
  Gift,
  Tv,
  DollarSign,
  HelpCircle,
  User,
  Shield,
  CreditCard,
  Timer,
  Smartphone,
  Monitor,
  Laptop,
  Settings,
  Headphones,
  Bot,
  UserCheck,
  XCircle,
  CheckCircle,
  Zap,
  ArrowRight,
  AlertTriangle,
  Calendar
} from 'lucide-react';

export default function BotConfig() {
  const [selectedFlow, setSelectedFlow] = useState<string>('novos');
  const [expandedMenu, setExpandedMenu] = useState<string>('main');

  // Estrutura completa dos menus do bot
  const botFlows = {
    novos: {
      title: 'Novos Clientes',
      icon: <UserPlus className="w-5 h-5" />,
      description: 'Usuários que ainda não são clientes',
      color: 'from-blue-500 to-cyan-500',
      badge: 'bg-blue-500/20 text-blue-400',
      mainMenu: {
        greeting: 'Bom dia/tarde/noite, bem-vindo(a) à *TvON*!',
        options: [
          { id: '1', icon: <Gift />, text: 'Teste grátis por 24h', submenu: 'teste_dispositivo' },
          { id: '2', icon: <Zap />, text: 'Quero assinar agora', submenu: 'assinar_codigo' },
          { id: '3', icon: <Tv />, text: 'Qual o conteúdo?', submenu: 'info_conteudo' },
          { id: '4', icon: <DollarSign />, text: 'Qual o valor?', submenu: 'info_valores' },
          { id: '5', icon: <Monitor />, text: 'Por onde consigo assistir?', submenu: 'info_dispositivos' },
          { id: '6', icon: <HelpCircle />, text: 'Saber mais', submenu: 'info_detalhes' },
          { id: '7', icon: <Headphones />, text: 'Falar com atendente', action: 'humano' },
          { id: '8', icon: <UserCheck />, text: 'Já sou cliente', action: 'humano' }
        ]
      },
      submenus: {
        teste_dispositivo: {
          title: 'Escolha onde vai assistir',
          message: 'Legal! 😄 Vamos ativar seu teste gratuito por 24h.\n\nOnde você vai assistir?',
          options: [
            { id: '1', text: 'Celular', next: 'teste_celular_tipo' },
            { id: '2', text: 'TV Box (caixinha)', action: 'criar_teste' },
            { id: '3', text: 'Smart TV', next: 'teste_smarttv_marca' },
            { id: '4', text: 'Notebook ou Computador', action: 'criar_teste' },
            { id: '5', text: 'Outros', action: 'criar_teste' }
          ]
        },
        teste_celular_tipo: {
          title: 'Tipo de celular',
          message: '📱 Qual o tipo do celular?',
          options: [
            { id: '1', text: 'Android', action: 'criar_teste' },
            { id: '2', text: 'iPhone', action: 'criar_teste' }
          ]
        },
        teste_smarttv_marca: {
          title: 'Marca da Smart TV',
          message: '📺 Qual a marca da Smart TV?',
          options: [
            { id: '1', text: 'Samsung', action: 'criar_teste' },
            { id: '2', text: 'LG', action: 'criar_teste' },
            { id: '3', text: 'Philips', action: 'criar_teste' },
            { id: '4', text: 'AOC', action: 'criar_teste' },
            { id: '5', text: 'TCL', action: 'criar_teste' },
            { id: '6', text: 'Panasonic', action: 'criar_teste' },
            { id: '7', text: 'Toshiba', action: 'criar_teste' },
            { id: '8', text: 'Multilaser', action: 'criar_teste' },
            { id: '9', text: 'BGH', action: 'criar_teste' },
            { id: '10', text: 'Outras', action: 'criar_teste' }
          ]
        },
        assinar_codigo: {
          title: 'Código de indicação',
          message: 'Show! 🎉 Agora me diz, você tem um código de indicação?',
          options: [
            { id: '1', text: 'Sim, tenho código', next: 'aguardando_codigo' },
            { id: '2', text: 'Não tenho', next: 'assinar_dispositivo' }
          ]
        },
        aguardando_codigo: {
          title: 'Digite o código',
          message: 'Perfeito! Por favor, digite o código de indicação:',
          action: 'validar_codigo'
        },
        assinar_dispositivo: {
          title: 'Escolha o dispositivo',
          message: 'Legal! 😄 Onde você vai assistir?',
          options: [
            { id: '1', text: 'Celular', next: 'celular_tipo_assinar' },
            { id: '2', text: 'TV Box (caixinha)', next: 'cadastro_nome' },
            { id: '3', text: 'Smart TV', next: 'smart_tv_marca_assinar' },
            { id: '4', text: 'Notebook ou Computador', next: 'cadastro_nome' },
            { id: '5', text: 'Outros', next: 'cadastro_nome' }
          ]
        },
        info_conteudo: {
          title: 'Conteúdo disponível',
          message: '📺 A TvON te dá acesso a:\n\n• Todos os canais ao vivo (Globo, SBT, Record, SporTV, Premiere, Discovery, Cartoon, etc)\n• Todos os filmes e séries das principais plataformas: Netflix, Prime Video, Disney+, Paramount+, HBO Max e outras\n• Programação infantil, esportiva, documentários, realities, filmes em lançamento e muito mais\n• Qualidade até 4K, sem travar\n• Suporte 24 horas!',
          options: [
            { id: '1', text: 'Assinar agora', submenu: 'assinar_codigo' },
            { id: '2', text: 'Testar grátis por 24h', submenu: 'teste_dispositivo' }
          ]
        },
        info_valores: {
          title: 'Valores dos planos',
          message: '💰 Planos TvON:\n\n• 🔹 Mensal: R$ 29,90\n• 🔹 Trimestral: R$ 79,90 (10% OFF)\n• 🔹 Semestral: R$ 139,90 (20% OFF)\n• 🔹 Anual: R$ 249,90 (30% OFF)\n\n• ✅ Pode cancelar quando quiser\n• ✅ Sem taxas extras\n• ✅ Reembolso proporcional em caso de cancelamento',
          options: [
            { id: '1', text: 'Assinar agora', submenu: 'assinar_codigo' },
            { id: '2', text: 'Testar grátis por 24h', submenu: 'teste_dispositivo' }
          ]
        }
      }
    },
    clientes: {
      title: 'Clientes Ativos',
      icon: <Users className="w-5 h-5" />,
      description: 'Clientes com plano ativo',
      color: 'from-green-500 to-emerald-500',
      badge: 'bg-green-500/20 text-green-400',
      mainMenu: {
        greeting: 'Bom dia/tarde/noite! *{{nome}}!*\n\nVencimento: {{vencimento}}\nValor: {{valorTotal}}',
        options: [
          { id: '1', icon: <Calendar />, text: 'Ver vencimento', submenu: 'vencimento_info' },
          { id: '2', icon: <CreditCard />, text: 'Renovar plano', submenu: 'renovar_periodo' },
          { id: '3', icon: <Settings />, text: 'Ver pontos', submenu: 'pontos_menu' },
          { id: '4', icon: <Gift />, text: 'Ganhar um mês grátis', submenu: 'indicar_amigo' },
          { id: '5', icon: <Shield />, text: 'Suporte técnico', submenu: 'suporte_tecnico' },
          { id: '6', icon: <Headphones />, text: 'Falar com atendente', action: 'humano' }
        ]
      },
      submenus: {
        vencimento_info: {
          title: 'Informações do plano',
          message: '*INFORMAÇÕES DO SEU PLANO*\n\nVencimento: {{vencimento}}\nDias restantes: {{diasRestantes}}\nValor: R$ {{valor}}\nTotal de pontos: {{pontos}}',
          options: [
            { id: '1', text: 'Renovar plano', submenu: 'renovar_periodo' }
          ]
        },
        renovar_periodo: {
          title: 'Renovação de plano',
          message: '*RENOVAR PLANO*\n\nEscolha o período:',
          options: [
            { id: '1', text: '1 mês - R$ {{mensal}}', action: 'gerar_pagamento' },
            { id: '2', text: '3 meses - R$ {{trimestral}} (-10%)', action: 'gerar_pagamento' },
            { id: '3', text: '6 meses - R$ {{semestral}} (-20%)', action: 'gerar_pagamento' },
            { id: '4', text: '1 ano - R$ {{anual}} (-30%)', action: 'gerar_pagamento' }
          ]
        },
        pontos_menu: {
          title: 'Gerenciar pontos',
          message: '*GERENCIAR PONTOS*\n\nPontos ativos: {{pontosAtivos}}\nValor total: R$ {{valorTotal}}',
          options: [
            { id: '1', text: 'Adicionar ponto', submenu: 'ponto_dispositivo' },
            { id: '2', text: 'Remover ponto', action: 'humano' }
          ]
        },
        ponto_dispositivo: {
          title: 'Adicionar ponto',
          message: 'Legal! 😄 Vamos adicionar um novo ponto.\n\nOnde você vai assistir?',
          options: [
            { id: '1', text: 'Celular', next: 'ponto_celular_tipo' },
            { id: '2', text: 'TV Box', action: 'humano' },
            { id: '3', text: 'Smart TV', next: 'ponto_smarttv_marca' },
            { id: '4', text: 'Notebook ou Computador', action: 'humano' },
            { id: '5', text: 'Outros', action: 'humano' }
          ]
        },
        suporte_tecnico: {
          title: 'Suporte técnico',
          message: '*SUPORTE TÉCNICO*\n\nEscolha o problema que está enfrentando:',
          options: [
            { id: '1', text: 'App travando ou lento', submenu: 'suporte_app' },
            { id: '2', text: 'Fora do ar', submenu: 'suporte_foradoar' },
            { id: '3', text: 'Outros problemas', action: 'humano' }
          ]
        },
        suporte_app: {
          title: 'App travando',
          message: 'Vamos resolver! Por favor, siga estes passos:\n\n1️⃣ Feche o app completamente\n2️⃣ Limpe o cache do aplicativo\n3️⃣ Reinicie o dispositivo\n4️⃣ Abra o app novamente',
          options: [
            { id: '1', text: 'Resolvido! ✅', action: 'resolvido' },
            { id: '2', text: 'Não resolveu', action: 'humano' }
          ]
        },
        indicar_amigo: {
          title: 'Indique e Ganhe',
          message: '*INDIQUE E GANHE!* 🎁\n\nSeu código de indicação é: *{{telefone}}*\n\nQuando 3 amigos assinarem com seu código, você ganha 1 mês grátis!\n\nAmigos indicados: {{indicados}}/3',
          options: []
        }
      }
    },
    vencidos: {
      title: 'Clientes Vencidos',
      icon: <AlertTriangle className="w-5 h-5" />,
      description: 'Clientes com plano expirado',
      color: 'from-red-500 to-orange-500',
      badge: 'bg-red-500/20 text-red-400',
      mainMenu: {
        greeting: '⚠️ *PLANO VENCIDO*\n\nBom dia/tarde/noite, *{{nome}}!*\n\nSeu plano venceu há {{diasVencido}} dias.\nVencimento: {{vencimento}}',
        options: [
          { id: '1', icon: <Shield />, text: 'Desbloqueio de confiança', submenu: 'desbloqueio_confianca' },
          { id: '2', icon: <CreditCard />, text: 'Pagar plano', submenu: 'renovar_periodo' },
          { id: '3', icon: <Headphones />, text: 'Falar com atendente', action: 'humano' }
        ]
      },
      submenus: {
        desbloqueio_confianca: {
          title: 'Desbloqueio de confiança',
          message: '*DESBLOQUEIO DE CONFIANÇA* 🔓\n\nPor ser um cliente especial, vamos liberar seu acesso por *24 horas* para você poder fazer o pagamento.\n\n⚠️ *Atenção:* Esta é uma liberação única por confiança. Use este tempo para regularizar seu pagamento.',
          options: [
            { id: '1', text: 'Ativar desbloqueio', action: 'ativar_trust' },
            { id: '2', text: 'Pagar agora', submenu: 'renovar_periodo' }
          ]
        },
        renovar_periodo: {
          title: 'Renovação de plano',
          message: '*RENOVAR PLANO*\n\nEscolha o período:',
          options: [
            { id: '1', text: '1 mês - R$ {{mensal}}', action: 'gerar_pagamento' },
            { id: '2', text: '3 meses - R$ {{trimestral}} (-10%)', action: 'gerar_pagamento' },
            { id: '3', text: '6 meses - R$ {{semestral}} (-20%)', action: 'gerar_pagamento' },
            { id: '4', text: '1 ano - R$ {{anual}} (-30%)', action: 'gerar_pagamento' }
          ]
        }
      }
    },
    testes: {
      title: 'Testes',
      icon: <Clock className="w-5 h-5" />,
      description: 'Clientes em período de teste',
      color: 'from-purple-500 to-pink-500',
      badge: 'bg-purple-500/20 text-purple-400',
      mainMenu: {
        greeting: '🟢 *TESTE ATIVO*\n\nOlá, bom dia/tarde/noite!\n⏱️ Tempo restante: {{tempoRestante}}',
        options: [
          { id: '1', icon: <Zap />, text: 'Ativar plano agora', submenu: 'assinar_codigo' },
          { id: '2', icon: <Headphones />, text: 'Falar com atendente', action: 'humano' }
        ]
      },
      submenus: {
        assinar_codigo: {
          title: 'Código de indicação',
          message: 'Show! 🎉 Agora me diz, você tem um código de indicação?',
          options: [
            { id: '1', text: 'Sim, tenho código', next: 'aguardando_codigo' },
            { id: '2', text: 'Não tenho', next: 'assinar_dispositivo' }
          ]
        }
      }
    },
    testesExpirados: {
      title: 'Testes Expirados',
      icon: <XCircle className="w-5 h-5" />,
      description: 'Testes que já expiraram',
      color: 'from-gray-500 to-gray-600',
      badge: 'bg-gray-500/20 text-gray-400',
      mainMenu: {
        greeting: '🔴 *Teste Expirado*\n\nSeu teste expirou.',
        options: [
          { id: '1', icon: <Zap />, text: 'Ativar plano agora', submenu: 'assinar_codigo' },
          { id: '2', icon: <Headphones />, text: 'Falar com atendente', action: 'humano' }
        ]
      },
      submenus: {}
    }
  };

  const currentFlow = botFlows[selectedFlow as keyof typeof botFlows];

  const renderOption = (option: any) => {
    const getActionBadge = (action?: string, submenu?: string) => {
      if (action === 'humano') return <Badge className="bg-yellow-500/20 text-yellow-400 ml-2">Atendente</Badge>;
      if (action === 'criar_teste') return <Badge className="bg-green-500/20 text-green-400 ml-2">Criar teste</Badge>;
      if (action === 'gerar_pagamento') return <Badge className="bg-blue-500/20 text-blue-400 ml-2">PIX</Badge>;
      if (action === 'validar_codigo') return <Badge className="bg-purple-500/20 text-purple-400 ml-2">Validar</Badge>;
      if (action === 'ativar_trust') return <Badge className="bg-orange-500/20 text-orange-400 ml-2">Trust</Badge>;
      if (action === 'resolvido') return <Badge className="bg-green-500/20 text-green-400 ml-2">Finalizar</Badge>;
      if (submenu || option.next) return <ChevronRight className="w-4 h-4 text-slate-400 ml-2" />;
      return null;
    };

    return (
      <div 
        key={option.id}
        className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors cursor-pointer"
        onClick={() => option.submenu && setExpandedMenu(option.submenu)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            {option.id}
          </div>
          {option.icon && <div className="text-slate-400">{option.icon}</div>}
          <span className="text-white">{option.text}</span>
        </div>
        {getActionBadge(option.action, option.submenu)}
      </div>
    );
  };

  const renderSubmenu = (submenuKey: string) => {
    const submenu = currentFlow.submenus[submenuKey];
    if (!submenu) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-white">{submenu.title}</h4>
          <button
            onClick={() => setExpandedMenu('main')}
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Voltar ao menu principal
          </button>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
          <div className="flex items-start gap-3 mb-4">
            <Bot className="w-5 h-5 text-green-400 mt-1" />
            <div className="flex-1">
              <p className="text-sm text-slate-300 whitespace-pre-line">{submenu.message}</p>
            </div>
          </div>
          {submenu.options && submenu.options.length > 0 && (
            <div className="space-y-2 mt-4">
              {submenu.options.map(renderOption)}
            </div>
          )}
          {submenu.action && (
            <Badge className="mt-4 bg-blue-500/20 text-blue-400">
              Aguardando resposta do usuário...
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Configuração do Bot WhatsApp</h1>
        <p className="text-slate-400">Visualize todos os fluxos e menus do bot de atendimento</p>
      </div>

      {/* Flow Selector */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Object.entries(botFlows).map(([key, flow]) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all ${
              selectedFlow === key 
                ? 'ring-2 ring-white shadow-lg' 
                : 'hover:shadow-md'
            } bg-gradient-to-br ${flow.color} border-0`}
            onClick={() => {
              setSelectedFlow(key);
              setExpandedMenu('main');
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  {flow.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{flow.title}</h3>
                </div>
              </div>
              <p className="text-xs text-white/80">{flow.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flow Structure */}
        <Card className="bg-dark-card border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Estrutura do Bot - {currentFlow.title}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Navegue pelos menus e submenus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              {expandedMenu === 'main' ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-400 mb-2">Mensagem de boas-vindas</h4>
                    <p className="text-white whitespace-pre-line">{currentFlow.mainMenu.greeting}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-400 mb-2">Opções do menu principal</h4>
                    {currentFlow.mainMenu.options.map(renderOption)}
                  </div>
                </div>
              ) : (
                renderSubmenu(expandedMenu)
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Preview */}
        <Card className="bg-dark-card border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Visualização do Chat
            </CardTitle>
            <CardDescription className="text-slate-400">
              Como o bot responde no WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="max-w-[70%] bg-green-600 text-white rounded-lg p-3">
                    <p className="text-sm">Oi</p>
                    <span className="text-xs opacity-70">09:30</span>
                  </div>
                </div>

                {/* Bot Response */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] bg-slate-700 text-white rounded-lg p-3">
                    <p className="text-sm whitespace-pre-line font-medium mb-2">
                      {currentFlow.mainMenu.greeting}
                    </p>
                    <p className="text-sm mb-2">Escolha uma opção:</p>
                    {currentFlow.mainMenu.options.map((option) => (
                      <p key={option.id} className="text-sm py-1">
                        {option.id}️⃣ {option.text}
                      </p>
                    ))}
                    <span className="text-xs opacity-70">09:30</span>
                  </div>
                </div>

                {expandedMenu !== 'main' && currentFlow.submenus[expandedMenu] && (
                  <>
                    {/* User Selection */}
                    <div className="flex justify-end">
                      <div className="max-w-[70%] bg-green-600 text-white rounded-lg p-3">
                        <p className="text-sm">
                          {currentFlow.mainMenu.options.find(o => o.submenu === expandedMenu)?.id || '1'}
                        </p>
                        <span className="text-xs opacity-70">09:31</span>
                      </div>
                    </div>

                    {/* Bot Submenu Response */}
                    <div className="flex justify-start">
                      <div className="max-w-[85%] bg-slate-700 text-white rounded-lg p-3">
                        <p className="text-sm whitespace-pre-line">
                          {currentFlow.submenus[expandedMenu].message}
                        </p>
                        {currentFlow.submenus[expandedMenu].options && currentFlow.submenus[expandedMenu].options.map((option: any) => (
                          <p key={option.id} className="text-sm py-1">
                            {option.id}️⃣ {option.text}
                          </p>
                        ))}
                        <span className="text-xs opacity-70">09:31</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Commands Info */}
      <Card className="bg-dark-card border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">Comandos Especiais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <Badge className="bg-blue-500/20 text-blue-400 mb-2">0</Badge>
              <h4 className="font-semibold text-white mb-1">Voltar ao Menu</h4>
              <p className="text-sm text-slate-400">Digite 0 para voltar ao menu principal</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <Badge className="bg-purple-500/20 text-purple-400 mb-2">reset</Badge>
              <h4 className="font-semibold text-white mb-1">Resetar Bot</h4>
              <p className="text-sm text-slate-400">Digite "reset" para reiniciar a conversa</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <Badge className="bg-green-500/20 text-green-400 mb-2">Automático</Badge>
              <h4 className="font-semibold text-white mb-1">Detecção de Tipo</h4>
              <p className="text-sm text-slate-400">O bot detecta automaticamente o tipo de usuário</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variables Info */}
      <Card className="bg-dark-card border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">Variáveis Dinâmicas</CardTitle>
          <CardDescription className="text-slate-400">
            Variáveis que são substituídas automaticamente nas mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <code className="text-sm text-blue-400">{'{{nome}}'}</code>
              <p className="text-xs text-slate-400 mt-1">Nome do cliente</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <code className="text-sm text-blue-400">{'{{vencimento}}'}</code>
              <p className="text-xs text-slate-400 mt-1">Data de vencimento</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <code className="text-sm text-blue-400">{'{{valorTotal}}'}</code>
              <p className="text-xs text-slate-400 mt-1">Valor do plano</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <code className="text-sm text-blue-400">{'{{telefone}}'}</code>
              <p className="text-xs text-slate-400 mt-1">Telefone do cliente</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <code className="text-sm text-blue-400">{'{{diasRestantes}}'}</code>
              <p className="text-xs text-slate-400 mt-1">Dias até vencer</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <code className="text-sm text-blue-400">{'{{pontosAtivos}}'}</code>
              <p className="text-xs text-slate-400 mt-1">Quantidade de pontos</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <code className="text-sm text-blue-400">{'{{tempoRestante}}'}</code>
              <p className="text-xs text-slate-400 mt-1">Tempo restante do teste</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <code className="text-sm text-blue-400">{'{{indicados}}'}</code>
              <p className="text-xs text-slate-400 mt-1">Amigos indicados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}