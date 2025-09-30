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
  User
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
    category: "promocao"
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
    category: "renovacao"
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
    category: "aviso"
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
    category: "boas_vindas"
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
    category: "cobranca"
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
    category: "indicacao"
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Central de Promoções
          </h1>
          <p className="text-slate-600 mt-1">
            Envie mensagens promocionais em massa pelo WhatsApp
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-4 py-2">
            <Users className="w-4 h-4 mr-2" />
            {filteredClients.length} clientes filtrados
          </Badge>
          <Badge variant="outline" className="px-4 py-2 bg-purple-50 border-purple-300">
            <CheckCircle className="w-4 h-4 mr-2 text-purple-600" />
            {selectedClients.length} selecionados
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda - Editor de Mensagem */}
        <div className="lg:col-span-2 space-y-6">
          {/* Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Templates de Mensagem
              </CardTitle>
              <CardDescription>
                Escolha um template pronto ou crie sua própria mensagem
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(messageTemplates).map(([key, template]) => (
                  <Button
                    key={key}
                    variant={selectedTemplate === key ? "default" : "outline"}
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => applyTemplate(key)}
                  >
                    <div className="text-left">
                      <div className="font-medium text-sm">{template.title}</div>
                      <div className="text-xs text-slate-500 mt-1">{template.category}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Editor de Mensagem */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Mensagem
              </CardTitle>
              <CardDescription>
                Personalize sua mensagem com variáveis dinâmicas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Textarea
                  placeholder="Digite sua mensagem aqui..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs text-slate-500">Variáveis disponíveis:</span>
                  {['{{nome}}', '{{telefone}}', '{{dias_vencido}}', '{{data_vencimento}}', '{{codigo_indicacao}}'].map(variable => (
                    <Button
                      key={variable}
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs font-mono"
                      onClick={() => setMessage(prev => prev + ' ' + variable)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      {variable}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Variáveis Customizadas */}
              {(selectedTemplate === 'manutencao') && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-sm font-medium">Configurar Variáveis</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Data Manutenção</Label>
                      <Input
                        type="date"
                        value={messageVariables.data_manutencao}
                        onChange={(e) => setMessageVariables(prev => ({ ...prev, data_manutencao: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Horário Início</Label>
                      <Input
                        type="time"
                        value={messageVariables.horario_inicio}
                        onChange={(e) => setMessageVariables(prev => ({ ...prev, horario_inicio: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Horário Fim</Label>
                      <Input
                        type="time"
                        value={messageVariables.horario_fim}
                        onChange={(e) => setMessageVariables(prev => ({ ...prev, horario_fim: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Duração (horas)</Label>
                      <Input
                        type="number"
                        value={messageVariables.duracao}
                        onChange={(e) => setMessageVariables(prev => ({ ...prev, duracao: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Preview da Mensagem
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    {previewMode ? 'Modo Edição' : 'Ver Preview'}
                  </Button>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <pre className="whitespace-pre-wrap text-sm font-sans">
                    {processMessageVariables(message)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Pronto para enviar?</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {selectedClients.length > 0 
                      ? `${selectedClients.length} cliente(s) selecionado(s)` 
                      : `${filteredClients.length} cliente(s) no filtro atual`}
                  </p>
                </div>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  onClick={handleSendMessages}
                  disabled={sendMessagesMutation.isPending}
                >
                  <Send className="w-5 h-5 mr-2" />
                  {sendMessagesMutation.isPending ? 'Enviando...' : 'Enviar Mensagens'}
                </Button>
              </div>
              
              {sendingProgress.status === 'sending' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Enviando mensagens...</span>
                    <span>{sendingProgress.current}/{sendingProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(sendingProgress.current / sendingProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita - Seleção de Clientes */}
        <div className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-green-600" />
                Filtros de Público
              </CardTitle>
              <CardDescription>
                Selecione o público-alvo da campanha
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Filtro Principal</Label>
                <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Clientes</SelectItem>
                    <SelectItem value="ativos">Clientes Ativos</SelectItem>
                    <SelectItem value="vencidos">Clientes Vencidos</SelectItem>
                    <SelectItem value="vencidos_10_dias">Vencidos há mais de {customFilters.diasVencido} dias</SelectItem>
                    <SelectItem value="novos">Clientes Novos (7 dias)</SelectItem>
                    <SelectItem value="com_pontos">Clientes com Pontos</SelectItem>
                    <SelectItem value="sem_pontos">Clientes sem Pontos</SelectItem>
                    <SelectItem value="selecionados">Apenas Selecionados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedFilter === 'vencidos_10_dias' && (
                <div>
                  <Label className="text-xs">Dias de vencimento</Label>
                  <Input
                    type="number"
                    value={customFilters.diasVencido}
                    onChange={(e) => setCustomFilters(prev => ({ ...prev, diasVencido: parseInt(e.target.value) || 10 }))}
                    min="1"
                    className="h-9"
                  />
                </div>
              )}

              <div>
                <Label>Buscar Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Nome, telefone ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={selectAllFiltered}
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Selecionar Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={deselectAll}
                >
                  <UserMinus className="w-4 h-4 mr-1" />
                  Limpar Seleção
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Clientes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-600" />
                Clientes ({filteredClients.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                      <p className="text-sm text-slate-500 mt-2">Carregando clientes...</p>
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="text-center py-8">
                      <UserX className="w-12 h-12 text-slate-300 mx-auto" />
                      <p className="text-sm text-slate-500 mt-2">Nenhum cliente encontrado</p>
                    </div>
                  ) : (
                    filteredClients.map((cliente: Cliente) => (
                      <div
                        key={cliente.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                          selectedClients.includes(cliente.id)
                            ? "bg-purple-50 border-purple-300"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        )}
                        onClick={() => toggleClientSelection(cliente.id)}
                      >
                        <Checkbox
                          checked={selectedClients.includes(cliente.id)}
                          onCheckedChange={() => toggleClientSelection(cliente.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {cliente.nome || 'Sem nome'}
                            </span>
                            {cliente.status === 'ativo' ? (
                              <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
                                Vencido
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {cliente.telefone}
                            </span>
                            {cliente.vencimento && (
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(cliente.vencimento), 'dd/MM')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}