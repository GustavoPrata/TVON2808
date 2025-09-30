import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Send,
  Users,
  UserX,
  MessageSquare,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Megaphone,
  Gift,
  Settings,
  Eye,
  UserPlus,
  UserMinus,
  Target,
  Sparkles,
  Zap,
  Info,
  Copy,
  Edit,
  Trash,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Plus,
  Mail,
  Phone,
  User,
  Star,
  Rocket,
  Heart
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Cliente {
  id: number;
  telefone: string;
  nome: string | null;
  cpf_cnpj: string | null;
  status: string;
  vencimento: Date | string | null;
  ultimo_teste_gratis: Date | string | null;
  created_at: Date | string;
  notas?: string | null;
  pontos?: any[];
}

// Templates predefinidos de mensagens
const messageTemplates = {
  promocao_geral: {
    title: "🎉 Promoção Especial",
    template: `🎉 *PROMOÇÃO ESPECIAL TV ON!* 🎉

Olá, {{nome}}! Temos uma oferta imperdível para você!

🔥 *APENAS HOJE:*
✅ Plano Mensal: de R$ 35,00 por *R$ 29,90*
✅ Plano Trimestral: de R$ 90,00 por *R$ 79,90*
✅ Plano Semestral: de R$ 160,00 por *R$ 139,90*

📺 Mais de 100.000 conteúdos
🎬 Filmes e Séries atualizados
⚽ Todos os jogos ao vivo
🎮 Canais infantis

*Aproveite! Oferta por tempo limitado!*

Digite *1* para contratar agora!`,
    category: "promocao",
    icon: Gift
  },
  clientes_vencidos: {
    title: "🔄 Renovação com Desconto",
    template: `Olá {{nome}}! 👋

Notamos que sua assinatura TV ON está vencida há {{dias_vencido}} dias.

🎁 *OFERTA ESPECIAL DE RETORNO:*
Renove agora e ganhe *20% de desconto* no primeiro mês!

✨ Benefícios:
• Acesso imediato após pagamento
• Suporte 24/7
• Sem taxa de reativação

*Não perca seus programas favoritos!*

Digite *1* para renovar com desconto!`,
    category: "renovacao",
    icon: RefreshCw
  },
  manutencao: {
    title: "🔧 Manutenção Programada",
    template: `⚠️ *AVISO DE MANUTENÇÃO* ⚠️

Prezado cliente {{nome}},

Informamos que realizaremos uma manutenção em nossos servidores:

📅 Data: {{data_manutencao}}
🕐 Horário: {{horario_inicio}} às {{horario_fim}}
⏱️ Duração estimada: {{duracao}} horas

Durante este período, o serviço poderá apresentar instabilidades.

Agradecemos a compreensão! 🙏

*TV ON - Sempre melhorando para você*`,
    category: "aviso",
    icon: AlertTriangle
  },
  boas_vindas: {
    title: "👋 Boas-vindas",
    template: `Olá {{nome}}! 🎉

*Seja muito bem-vindo(a) à TV ON!*

Sua conta foi ativada com sucesso! ✅

📱 *Como acessar:*
1. Baixe o app {{aplicativo}}
2. Use suas credenciais enviadas
3. Aproveite todo o conteúdo!

💡 *Dicas:*
• Configure seus favoritos
• Explore nossas categorias
• Ative as notificações

Qualquer dúvida, estamos aqui!

*Bom entretenimento!* 🍿📺`,
    category: "boas_vindas",
    icon: Heart
  },
  cobranca_amigavel: {
    title: "💳 Lembrete de Pagamento",
    template: `Olá {{nome}}! 😊

Este é um lembrete amigável:

Sua assinatura TV ON vence em {{dias_para_vencer}} dias ({{data_vencimento}}).

💳 *Formas de pagamento:*
• PIX (pagamento instantâneo)
• Cartão de crédito
• Boleto bancário

*Evite interrupções no seu serviço!*

Digite *1* para gerar seu pagamento
Digite *2* para falar com atendente`,
    category: "cobranca",
    icon: TrendingUp
  },
  indique_ganhe: {
    title: "🎁 Indique e Ganhe",
    template: `🎁 *PROGRAMA INDIQUE E GANHE!* 🎁

Olá {{nome}}!

Que tal ganhar 1 MÊS GRÁTIS? 🎉

É simples:
1️⃣ Indique um amigo
2️⃣ Ele assina qualquer plano
3️⃣ Vocês DOIS ganham 30 dias grátis!

📱 *Seu código de indicação:* {{codigo_indicacao}}

*Sem limite de indicações!*
Quanto mais amigos, mais meses grátis! 

Compartilhe agora! 📲`,
    category: "indicacao",
    icon: Zap
  }
};

export default function Promocoes() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('todos');
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [customFilters, setCustomFilters] = useState({
    diasVencido: 10,
    status: 'all',
    hasPhone: true,
    hasPontos: 'all'
  });
  const [messageVariables, setMessageVariables] = useState<Record<string, string>>({
    data_manutencao: format(new Date(), 'dd/MM/yyyy'),
    horario_inicio: '02:00',
    horario_fim: '06:00',
    duracao: '4'
  });
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0, status: 'idle' });

  // Buscar clientes
  const { data: clientesData, isLoading } = useQuery({
    queryKey: ['/api/clientes'],
    queryFn: async () => {
      const response = await fetch('/api/clientes');
      if (!response.ok) throw new Error('Erro ao buscar clientes');
      return response.json();
    }
  });

  // Filtrar clientes baseado nas configurações
  const getFilteredClients = () => {
    if (!clientesData) return [];
    
    let filtered = [...clientesData];
    
    // Filtro principal
    switch (selectedFilter) {
      case 'ativos':
        filtered = filtered.filter((c: Cliente) => c.status === 'ativo');
        break;
      case 'vencidos':
        filtered = filtered.filter((c: Cliente) => {
          if (!c.vencimento) return false;
          const vencimento = new Date(c.vencimento);
          const hoje = new Date();
          return vencimento < hoje;
        });
        break;
      case 'vencidos_10_dias':
        filtered = filtered.filter((c: Cliente) => {
          if (!c.vencimento) return false;
          const vencimento = new Date(c.vencimento);
          const hoje = new Date();
          const diasVencido = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
          return diasVencido > customFilters.diasVencido;
        });
        break;
      case 'novos':
        filtered = filtered.filter((c: Cliente) => {
          const criacao = new Date(c.created_at);
          const hoje = new Date();
          const dias = Math.floor((hoje.getTime() - criacao.getTime()) / (1000 * 60 * 60 * 24));
          return dias <= 7;
        });
        break;
      case 'com_pontos':
        filtered = filtered.filter((c: Cliente) => c.pontos && c.pontos.length > 0);
        break;
      case 'sem_pontos':
        filtered = filtered.filter((c: Cliente) => !c.pontos || c.pontos.length === 0);
        break;
      case 'selecionados':
        filtered = filtered.filter((c: Cliente) => selectedClients.includes(c.id));
        break;
    }
    
    // Busca por termo
    if (searchTerm) {
      filtered = filtered.filter((c: Cliente) => {
        const termo = searchTerm.toLowerCase();
        return (
          c.telefone.toLowerCase().includes(termo) ||
          (c.nome && c.nome.toLowerCase().includes(termo)) ||
          (c.cpf_cnpj && c.cpf_cnpj.includes(termo))
        );
      });
    }
    
    return filtered;
  };

  const filteredClients = getFilteredClients();

  // Mutation para enviar mensagens
  const sendMessagesMutation = useMutation({
    mutationFn: async (data: { clients: number[], message: string, delay?: number }) => {
      const response = await fetch('/api/promocoes/enviar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar mensagens');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mensagens enviadas!",
        description: `${sendingProgress.total} mensagens foram enviadas com sucesso.`,
      });
      setSendingProgress({ current: 0, total: 0, status: 'idle' });
      setSelectedClients([]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mensagens",
        description: error.message || "Ocorreu um erro ao enviar as mensagens",
        variant: "destructive"
      });
      setSendingProgress({ current: 0, total: 0, status: 'idle' });
    }
  });

  // Função para processar variáveis na mensagem
  const processMessageVariables = (template: string, client?: Cliente) => {
    let processed = template;
    
    // Variáveis do cliente
    if (client) {
      processed = processed.replace(/{{nome}}/g, client.nome || 'Cliente');
      processed = processed.replace(/{{telefone}}/g, client.telefone);
      
      if (client.vencimento) {
        const vencimento = new Date(client.vencimento);
        const hoje = new Date();
        const diasVencido = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
        const diasParaVencer = Math.floor((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        processed = processed.replace(/{{dias_vencido}}/g, diasVencido.toString());
        processed = processed.replace(/{{dias_para_vencer}}/g, diasParaVencer.toString());
        processed = processed.replace(/{{data_vencimento}}/g, format(vencimento, 'dd/MM/yyyy'));
      }
    } else {
      // Valores padrão para preview
      processed = processed.replace(/{{nome}}/g, '[Nome do Cliente]');
      processed = processed.replace(/{{telefone}}/g, '[Telefone]');
      processed = processed.replace(/{{dias_vencido}}/g, '[X]');
      processed = processed.replace(/{{dias_para_vencer}}/g, '[X]');
      processed = processed.replace(/{{data_vencimento}}/g, '[Data]');
    }
    
    // Variáveis customizadas
    Object.entries(messageVariables).forEach(([key, value]) => {
      processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    // Outras variáveis fixas
    processed = processed.replace(/{{aplicativo}}/g, 'IBO Pro');
    processed = processed.replace(/{{codigo_indicacao}}/g, client?.telefone?.slice(-4) || 'XXXX');
    
    return processed;
  };

  // Função para aplicar template
  const applyTemplate = (templateKey: string) => {
    const template = messageTemplates[templateKey as keyof typeof messageTemplates];
    if (template) {
      setMessage(template.template);
      setSelectedTemplate(templateKey);
      
      // Auto-selecionar filtro baseado no template
      if (templateKey === 'clientes_vencidos') {
        setSelectedFilter('vencidos_10_dias');
      } else if (templateKey === 'boas_vindas') {
        setSelectedFilter('novos');
      }
    }
  };

  // Função para enviar mensagens
  const handleSendMessages = () => {
    const clientsToSend = selectedClients.length > 0 ? selectedClients : filteredClients.map(c => c.id);
    
    if (clientsToSend.length === 0) {
      toast({
        title: "Nenhum cliente selecionado",
        description: "Selecione pelo menos um cliente para enviar a mensagem",
        variant: "destructive"
      });
      return;
    }
    
    if (!message.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Digite uma mensagem para enviar",
        variant: "destructive"
      });
      return;
    }
    
    // Confirmação
    if (!confirm(`Tem certeza que deseja enviar esta mensagem para ${clientsToSend.length} cliente(s)?`)) {
      return;
    }
    
    setSendingProgress({ current: 0, total: clientsToSend.length, status: 'sending' });
    sendMessagesMutation.mutate({
      clients: clientsToSend,
      message: message,
      delay: 2000 // 2 segundos entre cada mensagem para evitar spam
    });
  };

  // Toggle seleção de cliente
  const toggleClientSelection = (clientId: number) => {
    setSelectedClients(prev => {
      if (prev.includes(clientId)) {
        return prev.filter(id => id !== clientId);
      } else {
        return [...prev, clientId];
      }
    });
  };

  // Selecionar todos os clientes filtrados
  const selectAllFiltered = () => {
    const allIds = filteredClients.map(c => c.id);
    setSelectedClients(prev => {
      const newSelection = [...prev];
      allIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      return newSelection;
    });
  };

  // Desselecionar todos
  const deselectAll = () => {
    setSelectedClients([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 rounded-2xl p-8 shadow-2xl">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Megaphone className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-4xl font-bold text-white">
                    Central de Promoções
                  </h1>
                </div>
                <p className="text-white/90 text-lg mt-2">
                  Envie mensagens promocionais em massa via WhatsApp com personalização inteligente
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/30">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold text-2xl">{filteredClients.length}</span>
                    <span className="text-white/80">clientes</span>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-300" />
                    <span className="text-white font-semibold text-2xl">{selectedClients.length}</span>
                    <span className="text-white/80">selecionados</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda - Editor de Mensagem */}
          <div className="lg:col-span-2 space-y-6">
            {/* Templates */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Templates de Campanhas
                    </h2>
                    <p className="text-white/70 text-sm mt-1">
                      Escolha um template pronto ou crie sua própria mensagem
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(messageTemplates).map(([key, template]) => {
                    const Icon = template.icon;
                    const isSelected = selectedTemplate === key;
                    
                    return (
                      <button
                        key={key}
                        onClick={() => applyTemplate(key)}
                        className={cn(
                          "relative group overflow-hidden rounded-xl p-4 transition-all duration-300",
                          isSelected
                            ? "bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg scale-[1.02]"
                            : "bg-white/10 hover:bg-white/20 border border-white/20 hover:border-purple-400"
                        )}
                      >
                        <div className="relative z-10">
                          <Icon className={cn(
                            "w-8 h-8 mb-2",
                            isSelected ? "text-white" : "text-purple-400"
                          )} />
                          <div className="text-left">
                            <div className={cn(
                              "font-semibold text-sm",
                              isSelected ? "text-white" : "text-white/90"
                            )}>
                              {template.title}
                            </div>
                            <div className={cn(
                              "text-xs mt-1 capitalize",
                              isSelected ? "text-white/80" : "text-white/60"
                            )}>
                              {template.category.replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Editor de Mensagem */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                    <Edit className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Composição da Mensagem
                    </h2>
                    <p className="text-white/70 text-sm mt-1">
                      Personalize com variáveis dinâmicas para cada cliente
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <Textarea
                    placeholder="Digite sua mensagem personalizada aqui..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[280px] bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 font-mono text-sm"
                  />
                  <div className="mt-4 p-4 bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-xl border border-purple-500/20">
                    <p className="text-xs font-semibold text-purple-300 mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      VARIÁVEIS DINÂMICAS
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['{{nome}}', '{{telefone}}', '{{dias_vencido}}', '{{data_vencimento}}', '{{codigo_indicacao}}'].map(variable => (
                        <button
                          key={variable}
                          onClick={() => setMessage(prev => prev + ' ' + variable)}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-400/30 rounded-lg transition-all group"
                        >
                          <span className="text-xs font-mono text-purple-300 group-hover:text-purple-200">
                            {variable}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Variáveis Customizadas */}
                {(selectedTemplate === 'manutencao') && (
                  <div className="p-4 bg-gradient-to-r from-orange-600/10 to-yellow-600/10 rounded-xl border border-orange-500/20">
                    <h4 className="text-sm font-semibold text-orange-300 mb-4">CONFIGURAR VARIÁVEIS</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-orange-200">Data Manutenção</Label>
                        <Input
                          type="date"
                          value={messageVariables.data_manutencao}
                          onChange={(e) => setMessageVariables(prev => ({ ...prev, data_manutencao: e.target.value }))}
                          className="h-9 bg-white/10 border-white/20 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-200">Horário Início</Label>
                        <Input
                          type="time"
                          value={messageVariables.horario_inicio}
                          onChange={(e) => setMessageVariables(prev => ({ ...prev, horario_inicio: e.target.value }))}
                          className="h-9 bg-white/10 border-white/20 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-200">Horário Fim</Label>
                        <Input
                          type="time"
                          value={messageVariables.horario_fim}
                          onChange={(e) => setMessageVariables(prev => ({ ...prev, horario_fim: e.target.value }))}
                          className="h-9 bg-white/10 border-white/20 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-orange-200">Duração (horas)</Label>
                        <Input
                          type="number"
                          value={messageVariables.duracao}
                          onChange={(e) => setMessageVariables(prev => ({ ...prev, duracao: e.target.value }))}
                          className="h-9 bg-white/10 border-white/20 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview */}
                <div className="mt-6 p-4 bg-gradient-to-r from-green-600/10 to-emerald-600/10 rounded-xl border border-green-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      PREVIEW DA MENSAGEM
                    </h4>
                  </div>
                  <div className="bg-black/30 backdrop-blur-sm p-4 rounded-lg border border-green-500/20">
                    <pre className="whitespace-pre-wrap text-sm font-sans text-green-100">
                      {processMessageVariables(message)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-90" />
              <div className="absolute -top-5 -right-5 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-5 -left-5 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xl text-white flex items-center gap-2">
                      <Rocket className="w-6 h-6" />
                      Pronto para Disparar?
                    </h3>
                    <p className="text-white/90 mt-2">
                      {selectedClients.length > 0 
                        ? `🎯 ${selectedClients.length} cliente(s) selecionado(s)` 
                        : `📊 ${filteredClients.length} cliente(s) no filtro atual`}
                    </p>
                  </div>
                  <button
                    onClick={handleSendMessages}
                    disabled={sendMessagesMutation.isPending}
                    className="group relative px-8 py-4 bg-white/20 backdrop-blur-sm rounded-xl font-bold text-white border border-white/30 hover:bg-white/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    <span className="flex items-center gap-3">
                      <Send className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                      {sendMessagesMutation.isPending ? 'Enviando...' : 'Enviar Mensagens'}
                    </span>
                  </button>
                </div>
                
                {sendingProgress.status === 'sending' && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm mb-2 text-white">
                      <span className="font-semibold">Progresso do Envio</span>
                      <span className="font-bold">{sendingProgress.current}/{sendingProgress.total}</span>
                    </div>
                    <div className="w-full bg-white/20 backdrop-blur-sm rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-lg"
                        style={{ width: `${(sendingProgress.current / sendingProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Direita - Seleção de Clientes */}
          <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Seleção de Público
                  </h2>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'todos', label: 'Todos', icon: Users, color: 'from-blue-500 to-cyan-500' },
                    { value: 'ativos', label: 'Ativos', icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
                    { value: 'vencidos', label: 'Vencidos', icon: Clock, color: 'from-red-500 to-orange-500' },
                    { value: 'vencidos_10_dias', label: 'Vencidos +10d', icon: AlertTriangle, color: 'from-yellow-500 to-orange-500' },
                    { value: 'novos', label: 'Novos', icon: UserPlus, color: 'from-purple-500 to-pink-500' },
                    { value: 'com_pontos', label: 'Com Pontos', icon: Zap, color: 'from-cyan-500 to-blue-500' },
                  ].map(filter => {
                    const Icon = filter.icon;
                    const isSelected = selectedFilter === filter.value;
                    return (
                      <button
                        key={filter.value}
                        onClick={() => setSelectedFilter(filter.value)}
                        className={cn(
                          "relative group overflow-hidden rounded-xl p-4 transition-all duration-300",
                          isSelected
                            ? `bg-gradient-to-br ${filter.color} shadow-lg scale-[1.02]`
                            : "bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30"
                        )}
                      >
                        <Icon className={cn(
                          "w-6 h-6 mb-2",
                          isSelected ? "text-white" : "text-white/70"
                        )} />
                        <p className={cn(
                          "text-sm font-semibold",
                          isSelected ? "text-white" : "text-white/80"
                        )}>
                          {filter.label}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
                    <Input
                      placeholder="Buscar por nome, telefone ou CPF..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-green-400 focus:ring-green-400/20"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={selectAllFiltered}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-400/30 rounded-lg transition-all group"
                  >
                    <span className="flex items-center justify-center gap-2 text-sm font-semibold text-green-300 group-hover:text-green-200">
                      <UserPlus className="w-4 h-4" />
                      Selecionar Todos
                    </span>
                  </button>
                  <button
                    onClick={deselectAll}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500/30 hover:to-orange-500/30 border border-red-400/30 rounded-lg transition-all group"
                  >
                    <span className="flex items-center justify-center gap-2 text-sm font-semibold text-red-300 group-hover:text-red-200">
                      <UserMinus className="w-4 h-4" />
                      Limpar Seleção
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Clientes */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white">
                      Clientes ({filteredClients.length})
                    </h2>
                  </div>
                </div>
              </div>
              <ScrollArea className="h-[450px]">
                <div className="p-4 space-y-2">
                  {isLoading ? (
                    <div className="text-center py-12">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-purple-400" />
                      <p className="text-white/60">Carregando clientes...</p>
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="text-center py-12">
                      <UserX className="w-16 h-16 text-white/20 mx-auto mb-3" />
                      <p className="text-white/60">Nenhum cliente encontrado</p>
                      <p className="text-white/40 text-sm mt-1">Ajuste os filtros para ver mais resultados</p>
                    </div>
                  ) : (
                    filteredClients.map((cliente: Cliente) => {
                      const isSelected = selectedClients.includes(cliente.id);
                      const isExpired = cliente.vencimento && new Date(cliente.vencimento) < new Date();
                      
                      return (
                        <div
                          key={cliente.id}
                          onClick={() => toggleClientSelection(cliente.id)}
                          className={cn(
                            "relative p-4 rounded-xl cursor-pointer transition-all duration-200 border",
                            isSelected
                              ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-400/50 shadow-md"
                              : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "mt-0.5 w-5 h-5 rounded border-2 transition-all flex items-center justify-center",
                              isSelected
                                ? "bg-gradient-to-r from-purple-500 to-pink-500 border-transparent"
                                : "border-white/30 hover:border-white/50"
                            )}>
                              {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-white">
                                  {cliente.nome || 'Cliente'}
                                </span>
                                {cliente.status === 'ativo' && !isExpired && (
                                  <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs font-semibold rounded-full border border-green-400/30">
                                    ATIVO
                                  </span>
                                )}
                                {isExpired && (
                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs font-semibold rounded-full border border-red-400/30">
                                    VENCIDO
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-white/60 text-sm">
                                  <Phone className="w-3.5 h-3.5" />
                                  <span>{cliente.telefone}</span>
                                </div>
                                {cliente.vencimento && (
                                  <div className="flex items-center gap-2 text-white/60 text-sm">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>
                                      {format(new Date(cliente.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}