import { useState } from 'react';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Users, 
  MessageCircle, 
  Clock,
  ChevronRight,
  ChevronLeft,
  Gift,
  Tv,
  DollarSign,
  HelpCircle,
  Shield,
  CreditCard,
  Smartphone,
  Monitor,
  Laptop,
  Headphones,
  Bot,
  UserCheck,
  XCircle,
  Zap,
  AlertTriangle,
  Calendar,
  Home,
  Sparkles,
  Star,
  CheckCircle2,
  Info,
  Wifi,
  Package,
  Copy,
  QrCode,
  Timer,
  Key,
  FileText
} from 'lucide-react';

interface ChatMessage {
  type: 'user' | 'bot';
  text: string;
  time: string;
  hasQrCode?: boolean;
  hasPixCode?: boolean;
  pixValue?: string;
}

export default function BotMenu() {
  const [selectedFlow, setSelectedFlow] = useState<string>('novos');
  const [expandedMenu, setExpandedMenu] = useState<string>('main');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['main']);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { type: 'user', text: 'Oi', time: '09:30' },
    { type: 'bot', text: 'Bom dia/tarde/noite, bem-vindo(a) à *TvON*!', time: '09:30' }
  ]);

  // Função para adicionar mensagem ao chat
  const addChatMessage = (type: 'user' | 'bot', text: string, extras?: Partial<ChatMessage>) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setChatMessages(prev => [...prev, { type, text, time, ...extras }]);
  };

  // Função para executar ações
  const executeAction = (actionType: string, context?: any) => {
    const actionMessages: Record<string, () => void> = {
      humano: () => {
        addChatMessage('bot', '👤 Transferindo para um atendente humano...');
        setTimeout(() => {
          addChatMessage('bot', 'Um atendente entrará em contato em breve. Por favor, aguarde.');
        }, 1000);
      },
      criar_teste: () => {
        const user = `teste_${Math.random().toString(36).substring(7)}`;
        const pass = Math.floor(1000 + Math.random() * 9000);
        const expiry = new Date(Date.now() + 24*60*60*1000);
        
        addChatMessage('bot', '✅ Teste criado com sucesso!');
        setTimeout(() => {
          addChatMessage('bot', `📱 *DADOS DE ACESSO*\n\n👤 Usuário: ${user}\n🔑 Senha: ${pass}\n⏰ Válido até: ${expiry.toLocaleString('pt-BR')}\n\n📲 Link para baixar o app:\nhttps://tv-on.site/download`);
        }, 500);
      },
      gerar_pagamento: () => {
        const valor = context || 'R$ 29,90';
        addChatMessage('bot', `💳 Gerando PIX para pagamento de ${valor}...`);
        setTimeout(() => {
          addChatMessage('bot', `✅ *PIX GERADO COM SUCESSO*\n\nValor: ${valor}\nVencimento: 30 minutos`, {
            hasQrCode: true,
            hasPixCode: true,
            pixValue: valor
          });
        }, 1000);
      },
      validar_codigo: () => {
        addChatMessage('user', '55149998888');
        setTimeout(() => {
          addChatMessage('bot', '🔍 Validando código de indicação...');
          setTimeout(() => {
            addChatMessage('bot', '✅ Código válido! Você ganhou 10% de desconto e seu amigo receberá créditos quando você assinar.');
          }, 1500);
        }, 500);
      },
      validar_codigo_teste: () => {
        addChatMessage('user', '55149997777');
        setTimeout(() => {
          addChatMessage('bot', '🔍 Verificando código...');
          setTimeout(() => {
            addChatMessage('bot', '✅ Código aceito! Desconto aplicado.');
          }, 1000);
        }, 500);
      },
      ativar_trust: () => {
        addChatMessage('bot', '🔓 Ativando desbloqueio de confiança...');
        setTimeout(() => {
          addChatMessage('bot', '✅ *DESBLOQUEIO ATIVADO!*\n\nSeu acesso foi liberado por 24 horas.\n\n⚠️ Lembre-se: Esta é uma liberação única. Aproveite para regularizar seu pagamento.');
        }, 1000);
      },
      resolvido: () => {
        addChatMessage('bot', '✅ Que bom que conseguimos resolver!\n\nSe precisar de mais alguma coisa, é só chamar. 😊');
        setTimeout(() => {
          addChatMessage('bot', '🤖 Atendimento finalizado. Voltando ao modo automático.');
        }, 1000);
      },
      aguardar_nome: () => {
        addChatMessage('user', 'João da Silva Santos');
        setTimeout(() => {
          addChatMessage('bot', 'Prazer, João! 😊\n\nAgora preciso do seu CPF para continuar o cadastro:');
        }, 500);
      }
    };

    const action = actionMessages[actionType];
    if (action) {
      action();
    } else {
      addChatMessage('bot', `✅ Ação "${actionType}" executada.`);
    }
  };

  // Função para navegar para um submenu
  const navigateToSubmenu = (submenuKey: string) => {
    setNavigationHistory([...navigationHistory, submenuKey]);
    setExpandedMenu(submenuKey);
    
    // Adiciona mensagem do usuário selecionando a opção
    const currentFlow = botFlows[selectedFlow as keyof typeof botFlows];
    const submenu = (currentFlow.submenus as any)[submenuKey];
    if (submenu) {
      setTimeout(() => {
        addChatMessage('bot', submenu.message);
      }, 500);
    }
  };

  // Função para voltar ao menu anterior
  const navigateBack = () => {
    if (navigationHistory.length > 1) {
      const newHistory = [...navigationHistory];
      newHistory.pop();
      setNavigationHistory(newHistory);
      setExpandedMenu(newHistory[newHistory.length - 1]);
    } else {
      setExpandedMenu('main');
    }
  };

  // Função para voltar ao menu principal
  const navigateToMain = () => {
    setNavigationHistory(['main']);
    setExpandedMenu('main');
    
    // Adiciona mensagem voltando ao menu
    addChatMessage('user', '0');
    setTimeout(() => {
      const currentFlow = botFlows[selectedFlow as keyof typeof botFlows];
      addChatMessage('bot', currentFlow.mainMenu.greeting);
    }, 500);
  };

  // Estrutura completa dos menus do bot
  const botFlows = {
    novos: {
      title: 'Novo',
      icon: <UserPlus className="w-5 h-5" />,
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
          title: 'Escolha do Dispositivo para Teste',
          icon: <Monitor />,
          message: 'Legal! 😄 Vamos ativar seu teste gratuito por 24h.\n\nOnde você vai assistir?',
          options: [
            { id: '1', icon: <Smartphone />, text: 'Celular', next: 'teste_celular_tipo' },
            { id: '2', icon: <Package />, text: 'TV Box (caixinha)', action: 'criar_teste' },
            { id: '3', icon: <Tv />, text: 'Smart TV', next: 'teste_smarttv_marca' },
            { id: '4', icon: <Laptop />, text: 'Notebook ou Computador', action: 'criar_teste' },
            { id: '5', icon: <Monitor />, text: 'Outros', action: 'criar_teste' }
          ]
        },
        teste_celular_tipo: {
          title: 'Tipo de Celular',
          icon: <Smartphone />,
          message: '📱 Qual o tipo do celular?',
          options: [
            { id: '1', text: 'Android', action: 'criar_teste' },
            { id: '2', text: 'iPhone', action: 'criar_teste' }
          ]
        },
        teste_smarttv_marca: {
          title: 'Marca da Smart TV',
          icon: <Tv />,
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
          title: 'Código de Indicação',
          icon: <Star />,
          message: 'Show! 🎉 Agora me diz, você tem um código de indicação?',
          options: [
            { id: '1', text: 'Sim, tenho código', next: 'aguardando_codigo' },
            { id: '2', text: 'Não tenho', next: 'assinar_dispositivo' }
          ]
        },
        aguardando_codigo: {
          title: 'Digite o Código',
          icon: <Star />,
          message: 'Perfeito! Por favor, digite o código de indicação:',
          action: 'validar_codigo'
        },
        assinar_dispositivo: {
          title: 'Escolha do Dispositivo',
          icon: <Monitor />,
          message: 'Legal! 😄 Onde você vai assistir?',
          options: [
            { id: '1', icon: <Smartphone />, text: 'Celular', next: 'celular_tipo_assinar' },
            { id: '2', icon: <Package />, text: 'TV Box (caixinha)', next: 'cadastro_nome' },
            { id: '3', icon: <Tv />, text: 'Smart TV', next: 'smart_tv_marca_assinar' },
            { id: '4', icon: <Laptop />, text: 'Notebook ou Computador', next: 'cadastro_nome' },
            { id: '5', icon: <Monitor />, text: 'Outros', next: 'cadastro_nome' }
          ]
        },
        celular_tipo_assinar: {
          title: 'Tipo de Celular',
          icon: <Smartphone />,
          message: '📱 Qual o tipo do celular?',
          options: [
            { id: '1', text: 'Android', next: 'cadastro_nome' },
            { id: '2', text: 'iPhone', next: 'cadastro_nome' }
          ]
        },
        smart_tv_marca_assinar: {
          title: 'Marca da Smart TV',
          icon: <Tv />,
          message: '📺 Qual a marca da Smart TV?',
          options: [
            { id: '1', text: 'Samsung', next: 'cadastro_nome' },
            { id: '2', text: 'LG', next: 'cadastro_nome' },
            { id: '3', text: 'Philips', next: 'cadastro_nome' },
            { id: '4', text: 'AOC', next: 'cadastro_nome' },
            { id: '5', text: 'TCL', next: 'cadastro_nome' },
            { id: '6', text: 'Outras', next: 'cadastro_nome' }
          ]
        },
        cadastro_nome: {
          title: 'Cadastro - Nome',
          icon: <UserCheck />,
          message: 'Ótimo! Agora vou fazer seu cadastro.\n\nQual é o seu nome completo?',
          action: 'aguardar_nome'
        },
        info_conteudo: {
          title: 'Conteúdo Disponível',
          icon: <Tv />,
          message: '📺 A TvON te dá acesso a:\n\n• Todos os canais ao vivo (Globo, SBT, Record, SporTV, Premiere, Discovery, Cartoon, etc)\n• Todos os filmes e séries das principais plataformas: Netflix, Prime Video, Disney+, Paramount+, HBO Max e outras\n• Programação infantil, esportiva, documentários, realities, filmes em lançamento e muito mais\n• Qualidade até 4K, sem travar\n• Suporte 24 horas!',
          options: [
            { id: '1', text: 'Assinar agora', submenu: 'assinar_codigo' },
            { id: '2', text: 'Testar grátis por 24h', submenu: 'teste_dispositivo' }
          ]
        },
        info_valores: {
          title: 'Valores dos Planos',
          icon: <DollarSign />,
          message: '💰 Planos TvON:\n\n• 🔹 Mensal: R$ 29,90\n• 🔹 Trimestral: R$ 79,90 (10% OFF)\n• 🔹 Semestral: R$ 139,90 (20% OFF)\n• 🔹 Anual: R$ 249,90 (30% OFF)\n\n• ✅ Pode cancelar quando quiser\n• ✅ Sem taxas extras\n• ✅ Reembolso proporcional',
          options: [
            { id: '1', text: 'Assinar agora', submenu: 'assinar_codigo' },
            { id: '2', text: 'Testar grátis por 24h', submenu: 'teste_dispositivo' }
          ]
        },
        info_dispositivos: {
          title: 'Dispositivos Compatíveis',
          icon: <Wifi />,
          message: 'Você pode usar a TvON em praticamente qualquer dispositivo com internet:\n\n• 📱 Celulares Android e iPhone\n• 📺 Todas as Smart TVs\n• 🖥️ TV Box\n• 💻 Notebooks e PCs\n• 📦 Outros aparelhos conectados',
          options: [
            { id: '1', text: 'Assinar agora', submenu: 'assinar_codigo' },
            { id: '2', text: 'Testar grátis por 24h', submenu: 'teste_dispositivo' }
          ]
        },
        info_detalhes: {
          title: 'Sobre a TvON',
          icon: <Info />,
          message: 'A *TvON* é uma central de conteúdo que reúne:\n\n• ✅ Canais ao vivo de todas as categorias\n• ✅ Filmes e séries completas\n• ✅ Qualidade até 4K\n• ✅ Suporte técnico 24h\n• ✅ Sem fidelidade\n• ✅ Acesso multiplataforma',
          options: [
            { id: '1', text: 'Assinar agora', submenu: 'assinar_codigo' },
            { id: '2', text: 'Testar grátis por 24h', submenu: 'teste_dispositivo' }
          ]
        }
      }
    },
    clientes: {
      title: 'Cliente Ativo',
      icon: <Users className="w-5 h-5" />,
      color: 'from-green-500 to-emerald-500',
      badge: 'bg-green-500/20 text-green-400',
      mainMenu: {
        greeting: 'Bom dia/tarde/noite! *{{nome}}!*\n\nVencimento: {{vencimento}}\nValor: {{valorTotal}}',
        options: [
          { id: '1', icon: <Calendar />, text: 'Ver vencimento', submenu: 'vencimento_info' },
          { id: '2', icon: <CreditCard />, text: 'Renovar plano', submenu: 'renovar_periodo' },
          { id: '3', icon: <Package />, text: 'Ver pontos', submenu: 'pontos_menu' },
          { id: '4', icon: <Gift />, text: 'Ganhar um mês grátis', submenu: 'indicar_amigo' },
          { id: '5', icon: <Shield />, text: 'Suporte técnico', submenu: 'suporte_tecnico' },
          { id: '6', icon: <Headphones />, text: 'Falar com atendente', action: 'humano' }
        ]
      },
      submenus: {
        vencimento_info: {
          title: 'Informações do Plano',
          icon: <Calendar />,
          message: '*INFORMAÇÕES DO SEU PLANO*\n\nVencimento: {{vencimento}}\nDias restantes: {{diasRestantes}}\nValor: R$ {{valor}}\nTotal de pontos: {{pontos}}',
          options: [
            { id: '1', text: 'Renovar plano', submenu: 'renovar_periodo' }
          ]
        },
        renovar_periodo: {
          title: 'Renovação de Plano',
          icon: <CreditCard />,
          message: '*RENOVAR PLANO*\n\nSeu plano atual:\n• Valor: R$ {{valorMensal}}\n• Pontos: {{pontos}}\n• Vencimento: {{vencimento}}\n\nEscolha o período:',
          options: [
            { id: '1', text: '1 mês - R$ {{mensal}}', action: 'gerar_pagamento', context: 'R$ 29,90' },
            { id: '2', text: '3 meses - R$ {{trimestral}} (-10%)', action: 'gerar_pagamento', context: 'R$ 79,90' },
            { id: '3', text: '6 meses - R$ {{semestral}} (-20%)', action: 'gerar_pagamento', context: 'R$ 139,90' },
            { id: '4', text: '1 ano - R$ {{anual}} (-30%)', action: 'gerar_pagamento', context: 'R$ 249,90' }
          ]
        },
        pontos_menu: {
          title: 'Gerenciar Pontos',
          icon: <Package />,
          message: '*GERENCIAR PONTOS*\n\nPontos ativos: {{pontosAtivos}}\nValor total: R$ {{valorTotal}}\n\nLista de pontos:\n{{listaPontos}}',
          options: [
            { id: '1', text: 'Adicionar ponto', submenu: 'ponto_dispositivo' },
            { id: '2', text: 'Remover ponto', action: 'humano' }
          ]
        },
        ponto_dispositivo: {
          title: 'Adicionar Ponto',
          icon: <Package />,
          message: 'Legal! 😄 Vamos adicionar um novo ponto.\n\nOnde você vai assistir?',
          options: [
            { id: '1', icon: <Smartphone />, text: 'Celular', next: 'ponto_celular_tipo' },
            { id: '2', icon: <Package />, text: 'TV Box', action: 'humano' },
            { id: '3', icon: <Tv />, text: 'Smart TV', next: 'ponto_smarttv_marca' },
            { id: '4', icon: <Laptop />, text: 'Notebook ou Computador', action: 'humano' },
            { id: '5', icon: <Monitor />, text: 'Outros', action: 'humano' }
          ]
        },
        ponto_celular_tipo: {
          title: 'Tipo de Celular - Ponto',
          icon: <Smartphone />,
          message: '📱 Qual o tipo do celular?',
          options: [
            { id: '1', text: 'Android', action: 'humano' },
            { id: '2', text: 'iPhone', action: 'humano' }
          ]
        },
        ponto_smarttv_marca: {
          title: 'Marca da Smart TV - Ponto',
          icon: <Tv />,
          message: '📺 Qual a marca da Smart TV?',
          options: [
            { id: '1', text: 'Samsung', action: 'humano' },
            { id: '2', text: 'LG', action: 'humano' },
            { id: '3', text: 'Outras marcas', action: 'humano' }
          ]
        },
        suporte_tecnico: {
          title: 'Suporte Técnico',
          icon: <Shield />,
          message: '*SUPORTE TÉCNICO*\n\nEscolha o problema que está enfrentando:',
          options: [
            { id: '1', text: 'App travando ou lento', submenu: 'suporte_app' },
            { id: '2', text: 'Fora do ar', submenu: 'suporte_foradoar' },
            { id: '3', text: 'Outros problemas', action: 'humano' }
          ]
        },
        suporte_app: {
          title: 'App Travando',
          icon: <Shield />,
          message: 'Vamos resolver! Por favor, siga estes passos:\n\n1️⃣ Feche o app completamente\n2️⃣ Limpe o cache do aplicativo\n3️⃣ Reinicie o dispositivo\n4️⃣ Abra o app novamente\n\nFuncionou?',
          options: [
            { id: '1', text: 'Resolvido! ✅', action: 'resolvido' },
            { id: '2', text: 'Não resolveu', action: 'humano' }
          ]
        },
        suporte_foradoar: {
          title: 'Serviço Fora do Ar',
          icon: <Shield />,
          message: '🔴 Verificando o status do serviço...\n\n✅ Serviços operando normalmente!\n\nPor favor, tente:\n1️⃣ Verificar sua conexão com a internet\n2️⃣ Reiniciar o roteador\n3️⃣ Aguardar 2 minutos e tentar novamente',
          options: [
            { id: '1', text: 'Funcionou!', action: 'resolvido' },
            { id: '2', text: 'Ainda com problema', action: 'humano' }
          ]
        },
        indicar_amigo: {
          title: 'Indique e Ganhe',
          icon: <Gift />,
          message: '*INDIQUE E GANHE!* 🎁\n\nSeu código de indicação é: *{{telefone}}*\n\nQuando 3 amigos assinarem com seu código, você ganha 1 mês grátis!\n\nAmigos indicados: {{indicados}}/3\n\n📲 Compartilhe seu código!',
          options: []
        }
      }
    },
    vencidos: {
      title: 'Vencido',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'from-red-500 to-orange-500',
      badge: 'bg-red-500/20 text-red-400',
      mainMenu: {
        greeting: '⚠️ *PLANO VENCIDO*\n\nBom dia/tarde/noite, *{{nome}}!*\n\nSeu plano venceu há {{diasVencido}} dias.\nVencimento: {{vencimento}}',
        options: [
          { id: '1', icon: <Shield />, text: 'Desbloqueio de confiança', submenu: 'desbloqueio_confianca' },
          { id: '2', icon: <CreditCard />, text: 'Pagar plano', submenu: 'renovar_vencido' },
          { id: '3', icon: <Headphones />, text: 'Falar com atendente', action: 'humano' }
        ]
      },
      submenus: {
        desbloqueio_confianca: {
          title: 'Desbloqueio de Confiança',
          icon: <Shield />,
          message: '*DESBLOQUEIO DE CONFIANÇA* 🔓\n\nPor ser um cliente especial, vamos liberar seu acesso por *24 horas* para você poder fazer o pagamento.\n\n⚠️ *Atenção:* Esta é uma liberação única por confiança.\n\nDeseja ativar?',
          options: [
            { id: '1', text: 'Ativar desbloqueio', action: 'ativar_trust' },
            { id: '2', text: 'Pagar agora', submenu: 'renovar_vencido' }
          ]
        },
        renovar_vencido: {
          title: 'Renovar Plano Vencido',
          icon: <CreditCard />,
          message: '*RENOVAR PLANO*\n\n⚠️ Seu plano está vencido há {{diasVencido}} dias\n\nEscolha o período para renovação:',
          options: [
            { id: '1', text: '1 mês - R$ {{mensal}}', action: 'gerar_pagamento', context: 'R$ 29,90' },
            { id: '2', text: '3 meses - R$ {{trimestral}} (-10%)', action: 'gerar_pagamento', context: 'R$ 79,90' },
            { id: '3', text: '6 meses - R$ {{semestral}} (-20%)', action: 'gerar_pagamento', context: 'R$ 139,90' },
            { id: '4', text: '1 ano - R$ {{anual}} (-30%)', action: 'gerar_pagamento', context: 'R$ 249,90' }
          ]
        }
      }
    },
    testes: {
      title: 'Teste Ativo',
      icon: <Clock className="w-5 h-5" />,
      color: 'from-purple-500 to-pink-500',
      badge: 'bg-purple-500/20 text-purple-400',
      mainMenu: {
        greeting: '🟢 *TESTE ATIVO*\n\nOlá, bom dia/tarde/noite!\n⏱️ Tempo restante: {{tempoRestante}}',
        options: [
          { id: '1', icon: <Zap />, text: 'Ativar plano agora', submenu: 'teste_assinar' },
          { id: '2', icon: <Headphones />, text: 'Falar com atendente', action: 'humano' }
        ]
      },
      submenus: {
        teste_assinar: {
          title: 'Ativar Plano',
          icon: <Zap />,
          message: 'Show! 🎉 Vamos ativar seu plano completo!\n\nVocê tem um código de indicação?',
          options: [
            { id: '1', text: 'Sim, tenho código', next: 'teste_codigo' },
            { id: '2', text: 'Não tenho', next: 'teste_plano' }
          ]
        },
        teste_codigo: {
          title: 'Código de Indicação',
          icon: <Star />,
          message: 'Digite o código de indicação:',
          action: 'validar_codigo_teste'
        },
        teste_plano: {
          title: 'Escolher Plano',
          icon: <CreditCard />,
          message: 'Escolha seu plano:\n\n• Mensal: R$ 29,90\n• Trimestral: R$ 79,90 (-10%)\n• Semestral: R$ 139,90 (-20%)\n• Anual: R$ 249,90 (-30%)',
          options: [
            { id: '1', text: 'Mensal - R$ 29,90', action: 'gerar_pagamento', context: 'R$ 29,90' },
            { id: '2', text: 'Trimestral - R$ 79,90', action: 'gerar_pagamento', context: 'R$ 79,90' },
            { id: '3', text: 'Semestral - R$ 139,90', action: 'gerar_pagamento', context: 'R$ 139,90' },
            { id: '4', text: 'Anual - R$ 249,90', action: 'gerar_pagamento', context: 'R$ 249,90' }
          ]
        }
      }
    },
    testesExpirados: {
      title: 'Expirado',
      icon: <XCircle className="w-5 h-5" />,
      color: 'from-gray-500 to-gray-600',
      badge: 'bg-gray-500/20 text-gray-400',
      mainMenu: {
        greeting: '🔴 *Teste Expirado*\n\nSeu teste gratuito expirou.\n\nGostaria de ativar o plano completo?',
        options: [
          { id: '1', icon: <Zap />, text: 'Ativar plano agora', submenu: 'expirado_assinar' },
          { id: '2', icon: <Headphones />, text: 'Falar com atendente', action: 'humano' }
        ]
      },
      submenus: {
        expirado_assinar: {
          title: 'Ativar Plano Após Teste',
          icon: <Zap />,
          message: 'Que bom que gostou! 🎉\n\nEscolha seu plano:',
          options: [
            { id: '1', text: 'Mensal - R$ 29,90', action: 'gerar_pagamento', context: 'R$ 29,90' },
            { id: '2', text: 'Trimestral - R$ 79,90 (-10%)', action: 'gerar_pagamento', context: 'R$ 79,90' },
            { id: '3', text: 'Semestral - R$ 139,90 (-20%)', action: 'gerar_pagamento', context: 'R$ 139,90' },
            { id: '4', text: 'Anual - R$ 249,90 (-30%)', action: 'gerar_pagamento', context: 'R$ 249,90' }
          ]
        }
      }
    }
  };

  const currentFlow = botFlows[selectedFlow as keyof typeof botFlows];

  const renderOption = (option: any) => {
    const getActionBadge = (action?: string, submenu?: string, next?: string) => {
      if (action === 'humano') return <Badge className="bg-yellow-500/20 text-yellow-400 ml-2">Atendente</Badge>;
      if (action === 'criar_teste') return <Badge className="bg-green-500/20 text-green-400 ml-2">Criar teste</Badge>;
      if (action === 'gerar_pagamento') return <Badge className="bg-blue-500/20 text-blue-400 ml-2">PIX</Badge>;
      if (action === 'validar_codigo') return <Badge className="bg-purple-500/20 text-purple-400 ml-2">Validar</Badge>;
      if (action === 'ativar_trust') return <Badge className="bg-orange-500/20 text-orange-400 ml-2">Trust</Badge>;
      if (action === 'resolvido') return <Badge className="bg-green-500/20 text-green-400 ml-2">Finalizar</Badge>;
      if (action === 'aguardar_nome') return <Badge className="bg-cyan-500/20 text-cyan-400 ml-2">Aguardar</Badge>;
      if (action === 'validar_codigo_teste') return <Badge className="bg-purple-500/20 text-purple-400 ml-2">Validar</Badge>;
      if (submenu || next) return <ChevronRight className="w-4 h-4 text-slate-400 ml-2" />;
      return null;
    };

    const handleClick = () => {
      // Adiciona mensagem do usuário selecionando
      addChatMessage('user', option.id);
      
      setTimeout(() => {
        if (option.submenu) {
          navigateToSubmenu(option.submenu);
        } else if (option.next) {
          navigateToSubmenu(option.next);
        } else if (option.action) {
          executeAction(option.action, option.context);
        }
      }, 300);
    };

    return (
      <div 
        key={option.id}
        className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-all transform hover:scale-[1.02] cursor-pointer group"
        onClick={handleClick}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            {option.id}
          </div>
          {option.icon && <div className="text-slate-400 group-hover:text-slate-200 transition-colors">{option.icon}</div>}
          <span className="text-white group-hover:text-blue-300 transition-colors">{option.text}</span>
        </div>
        {getActionBadge(option.action, option.submenu, option.next)}
      </div>
    );
  };

  const renderSubmenu = (submenuKey: string) => {
    const submenu = (currentFlow.submenus as any)[submenuKey];
    if (!submenu) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {submenu.icon && <div className="text-blue-400">{submenu.icon}</div>}
            <h4 className="text-lg font-semibold text-white">{submenu.title}</h4>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={navigateBack}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <Button
              onClick={navigateToMain}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <Home className="w-4 h-4 mr-1" />
              Menu Principal
            </Button>
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
          <div className="flex items-start gap-3 mb-4">
            <Bot className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
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
            <div 
              className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg cursor-pointer hover:bg-blue-500/20 transition-colors"
              onClick={() => executeAction(submenu.action)}
            >
              <Badge className="bg-blue-500/20 text-blue-400">
                <Sparkles className="w-3 h-3 mr-1" />
                Aguardando resposta do usuário... (Clique para simular)
              </Badge>
            </div>
          )}
        </div>
        
        {/* Breadcrumb de navegação */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Caminho:</span>
          <span className="text-slate-400">Menu Principal</span>
          {navigationHistory.slice(1).map((item, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-400">{(currentFlow.submenus as any)[item]?.title || item}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Menu do Bot WhatsApp</h1>
        <p className="text-slate-400">Navegue interativamente por todos os fluxos e menus do bot de atendimento</p>
      </div>

      {/* Flow Selector com estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Object.entries(botFlows).map(([key, flow]) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all transform hover:scale-105 ${
              selectedFlow === key 
                ? 'ring-2 ring-white shadow-xl' 
                : 'hover:shadow-lg'
            } bg-gradient-to-br ${flow.color} border-0`}
            onClick={() => {
              setSelectedFlow(key);
              setNavigationHistory(['main']);
              setExpandedMenu('main');
              setChatMessages([
                { type: 'user', text: 'Oi', time: '09:30' },
                { type: 'bot', text: flow.mainMenu.greeting, time: '09:30' }
              ]);
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                  {flow.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{flow.title}</h3>
                </div>
              </div>
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
              Clique nas opções para navegar e ver as ações no chat
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
              Chat interativo com as ações do bot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="bg-gradient-to-b from-green-900/20 to-green-800/10 rounded-lg p-4">
                <div className="space-y-4">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] ${
                        msg.type === 'user' 
                          ? 'bg-green-600 text-white rounded-2xl rounded-tr-sm' 
                          : 'bg-slate-700 text-white rounded-2xl rounded-tl-sm'
                      } p-3 shadow-lg`}>
                        <p className="text-sm whitespace-pre-line">{msg.text}</p>
                        
                        {/* PIX QR Code e Copia Cola */}
                        {msg.hasQrCode && (
                          <div className="mt-3 space-y-3">
                            <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                              <QrCode className="w-32 h-32 text-black" />
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-slate-800 rounded">
                              <Copy className="w-4 h-4 text-slate-400" />
                              <input 
                                type="text" 
                                value="00020126580014BR.GOV.BCB.PIX..." 
                                readOnly 
                                className="flex-1 bg-transparent text-xs text-slate-300 outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Timer className="w-3 h-3" />
                              <span>Válido por 30 minutos</span>
                            </div>
                          </div>
                        )}
                        
                        <span className={`text-xs opacity-70 flex items-center ${msg.type === 'user' ? 'justify-end' : ''} gap-1 mt-1`}>
                          {msg.time}
                          {msg.type === 'user' && <CheckCircle2 className="w-3 h-3" />}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Commands Info */}
      <Card className="bg-dark-card border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">⚡ Comandos Especiais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30">
              <Badge className="bg-blue-500/20 text-blue-400 mb-2">0</Badge>
              <h4 className="font-semibold text-white mb-1">Voltar ao Menu</h4>
              <p className="text-sm text-slate-400">Digite 0 para voltar ao menu principal</p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/30">
              <Badge className="bg-purple-500/20 text-purple-400 mb-2">reset</Badge>
              <h4 className="font-semibold text-white mb-1">Resetar Bot</h4>
              <p className="text-sm text-slate-400">Digite "reset" para reiniciar a conversa</p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/30">
              <Badge className="bg-green-500/20 text-green-400 mb-2">Auto</Badge>
              <h4 className="font-semibold text-white mb-1">Detecção Inteligente</h4>
              <p className="text-sm text-slate-400">O bot detecta automaticamente o tipo de usuário</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variables Info */}
      <Card className="bg-dark-card border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">🔧 Variáveis Dinâmicas</CardTitle>
          <CardDescription className="text-slate-400">
            Substituídas automaticamente nas mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { var: '{{nome}}', desc: 'Nome do cliente' },
              { var: '{{vencimento}}', desc: 'Data de vencimento' },
              { var: '{{valorTotal}}', desc: 'Valor do plano' },
              { var: '{{telefone}}', desc: 'Telefone do cliente' },
              { var: '{{diasRestantes}}', desc: 'Dias até vencer' },
              { var: '{{pontosAtivos}}', desc: 'Quantidade de pontos' },
              { var: '{{tempoRestante}}', desc: 'Tempo restante do teste' },
              { var: '{{indicados}}', desc: 'Amigos indicados' },
              { var: '{{diasVencido}}', desc: 'Dias de atraso' },
              { var: '{{valorMensal}}', desc: 'Valor mensal base' },
              { var: '{{listaPontos}}', desc: 'Lista dos pontos' },
              { var: '{{pontos}}', desc: 'Total de pontos' }
            ].map(item => (
              <div key={item.var} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <code className="text-sm text-blue-400">{item.var}</code>
                <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}