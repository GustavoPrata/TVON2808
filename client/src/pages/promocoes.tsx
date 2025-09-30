import { useState, useEffect, useRef } from 'react';
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
import * as Icons from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'wouter';
import { type CampaignTemplate } from '@shared/schema';

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
  tipoPromocao?: 'cliente' | 'cliente_teste';
  teste?: {
    id: number;
    telefone: string;
    aplicativo: string;
    criadoEm: Date | string;
    expiraEm: Date | string;
    status: string;
  } | null;
}

// Helper to render icon component
const IconComponent = ({ name, className }: { name: string; className?: string }) => {
  const Icon = Icons[name as keyof typeof Icons];
  if (!Icon) return <Icons.MessageSquare className={className} />;
  return <Icon className={className} />;
};

// Função para formatar número de telefone
const formatPhoneNumber = (phone: string) => {
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Remove o código do país 55 se existir
  const withoutCountry = cleaned.startsWith('55') && cleaned.length > 11 
    ? cleaned.substring(2) 
    : cleaned;
  
  // Formata o número
  if (withoutCountry.length === 11) {
    // Celular: (11) 91234-5678
    return `(${withoutCountry.substring(0, 2)}) ${withoutCountry.substring(2, 7)}-${withoutCountry.substring(7)}`;
  } else if (withoutCountry.length === 10) {
    // Fixo: (11) 1234-5678
    return `(${withoutCountry.substring(0, 2)}) ${withoutCountry.substring(2, 6)}-${withoutCountry.substring(6)}`;
  }
  
  // Retorna o número original se não conseguir formatar
  return phone;
};

export default function Promocoes() {
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const clientRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
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
    queryKey: ['/api/promocoes/clientes'],
    queryFn: async () => {
      const response = await fetch('/api/promocoes/clientes');
      if (!response.ok) throw new Error('Erro ao buscar clientes');
      return response.json();
    }
  });

  // Buscar templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<CampaignTemplate[]>({
    queryKey: ['/api/campaign-templates'],
  });

  // Primeiro aplica os filtros para obter a lista base
  const getFilteredByStatus = () => {
    if (!clientesData) return [];
    
    let filtered = [...clientesData];
    
    // Aplica apenas o filtro de status/categoria
    switch (selectedFilter) {
      case 'ativos':
        filtered = filtered.filter((c: Cliente) => {
          // Ativo significa status ativo E não vencido
          if (c.status !== 'ativo') return false;
          if (!c.vencimento) return true; // Se não tem vencimento, considera ativo
          const vencimento = new Date(c.vencimento);
          const hoje = new Date();
          return vencimento >= hoje; // Ativo se ainda não venceu
        });
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
      case 'testes':
        // Filtrar clientes que são marcados como 'cliente_teste'
        filtered = filtered.filter((c: Cliente) => c.tipoPromocao === 'cliente_teste');
        break;
      case 'sem_pontos':
        filtered = filtered.filter((c: Cliente) => !c.pontos || c.pontos.length === 0);
        break;
      case 'selecionados':
        filtered = filtered.filter((c: Cliente) => selectedClients.includes(c.id));
        break;
    }
    
    return filtered;
  };

  // Retorna todos os clientes filtrados (sem aplicar busca)
  const getFilteredClients = () => {
    return getFilteredByStatus();
  };

  // Verifica se um cliente corresponde ao termo de busca
  const clientMatchesSearch = (cliente: Cliente) => {
    if (!searchTerm) return false;
    
    const termo = searchTerm.toLowerCase();
    return (
      cliente.telefone.toLowerCase().includes(termo) ||
      (cliente.nome && cliente.nome.toLowerCase().includes(termo)) ||
      (cliente.cpf_cnpj && cliente.cpf_cnpj.toLowerCase().includes(termo))
    );
  };

  const filteredClients = getFilteredClients();

  // Scroll automático para o primeiro resultado encontrado
  useEffect(() => {
    if (searchTerm && filteredClients.length > 0) {
      // Encontra o primeiro cliente que corresponde à busca
      const firstMatch = filteredClients.find(c => clientMatchesSearch(c));
      
      if (firstMatch && clientRefs.current[firstMatch.id]) {
        // Faz scroll suave até o elemento
        clientRefs.current[firstMatch.id]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [searchTerm]);

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

  // Função para formatar texto com estilos do WhatsApp
  const formatWhatsAppText = (text: string) => {
    if (!text) return <span>Digite sua mensagem...</span>;
    
    // Divide o texto em linhas para processar cada uma
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      // Array para armazenar os elementos formatados
      const parts: React.ReactNode[] = [];
      let currentIndex = 0;
      
      // Regex para encontrar formatações do WhatsApp (negrito, itálico, tachado, mono)
      const formatRegex = /(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)|(`[^`\n]+`)/g;
      let match;
      
      while ((match = formatRegex.exec(line)) !== null) {
        // Adiciona texto antes da formatação
        if (match.index > currentIndex) {
          parts.push(line.substring(currentIndex, match.index));
        }
        
        const matchedText = match[0];
        const innerText = matchedText.substring(1, matchedText.length - 1);
        
        // Aplica o estilo baseado no tipo de formatação
        if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
          // Negrito
          parts.push(
            <span key={`bold-${lineIndex}-${match.index}`} className="font-bold">
              {innerText}
            </span>
          );
        } else if (matchedText.startsWith('_') && matchedText.endsWith('_')) {
          // Itálico
          parts.push(
            <span key={`italic-${lineIndex}-${match.index}`} className="italic">
              {innerText}
            </span>
          );
        } else if (matchedText.startsWith('~') && matchedText.endsWith('~')) {
          // Tachado
          parts.push(
            <span key={`strike-${lineIndex}-${match.index}`} className="line-through">
              {innerText}
            </span>
          );
        } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
          // Monoespaçado
          parts.push(
            <span key={`mono-${lineIndex}-${match.index}`} className="font-mono bg-[#0b1317] px-1 rounded text-xs">
              {innerText}
            </span>
          );
        }
        
        currentIndex = match.index + matchedText.length;
      }
      
      // Adiciona o texto restante da linha
      if (currentIndex < line.length) {
        parts.push(line.substring(currentIndex));
      }
      
      // Se a linha está vazia, adiciona um espaço para manter a altura
      if (parts.length === 0 && line.length === 0) {
        return <div key={`line-${lineIndex}`}>&nbsp;</div>;
      }
      
      return (
        <div key={`line-${lineIndex}`}>
          {parts.length > 0 ? parts : line}
        </div>
      );
    });
  };

  // Função para aplicar template
  const applyTemplate = (templateId: number) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.content);
      setSelectedTemplate(templateId.toString());
      
      // Auto-selecionar filtro baseado no template key
      if (template.key === 'clientes_vencidos') {
        setSelectedFilter('vencidos_10_dias');
      } else if (template.key === 'boas_vindas') {
        setSelectedFilter('novos');
      }
      
      // Track template usage
      apiRequest(`/api/campaign-templates/${templateId}/usage`, {
        method: 'POST',
      }).catch(error => {
        console.error('Failed to track template usage:', error);
      });
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
    <div className="min-h-screen bg-slate-950">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-slate-950 rounded-lg border border-slate-800 p-8 shadow-lg" data-testid="header-promocoes">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <Megaphone className="w-8 h-8 text-blue-500" data-testid="icon-megaphone" />
                </div>
                <h1 className="text-3xl font-bold text-slate-100">
                  Central de Promoções
                </h1>
              </div>
              <p className="text-slate-400 text-base mt-2">
                Envie mensagens promocionais em massa via WhatsApp
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="bg-slate-900 rounded-lg px-5 py-3 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-100 font-semibold text-xl">{filteredClients.length}</span>
                  <span className="text-slate-400">clientes</span>
                </div>
              </div>
              <div className="bg-slate-900 rounded-lg px-5 py-3 border border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  <span className="text-slate-100 font-semibold text-xl">{selectedClients.length}</span>
                  <span className="text-slate-400">selecionados</span>
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
            <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-lg overflow-hidden">
              <div className="bg-slate-950 p-6 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                      <Sparkles className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-100">
                        Templates de Campanhas
                      </h2>
                      <p className="text-slate-400 text-sm mt-1">
                        Escolha um template pronto ou crie sua própria mensagem
                      </p>
                    </div>
                  </div>
                  <Link href="/template-editor">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Edit className="mr-2 h-4 w-4" />
                      Editar Templates
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {isLoadingTemplates ? (
                    <div className="col-span-full text-center py-8 text-slate-400">
                      Carregando templates...
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="col-span-full text-center py-8">
                      <p className="text-slate-400 mb-4">Nenhum template disponível</p>
                      <Link href="/template-editor">
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          <Plus className="mr-2 h-4 w-4" />
                          Criar Template
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    templates.map((template) => {
                      const isSelected = selectedTemplate === template.id.toString();
                      
                      return (
                        <button
                          key={template.id}
                          onClick={() => applyTemplate(template.id)}
                          data-testid={`template-${template.key}`}
                          className={cn(
                            "relative group overflow-hidden rounded-lg p-4 transition-all duration-200",
                            isSelected
                              ? "bg-slate-800 ring-2 ring-blue-500 shadow-lg"
                              : "bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600"
                          )}
                        >
                          <div className="relative z-10">
                            <IconComponent 
                              name={template.icon}
                              className={cn(
                                "w-8 h-8 mb-2",
                                isSelected ? "text-blue-500" : "text-slate-400"
                              )} 
                            />
                            <div className="text-left">
                              <div className={cn(
                                "font-semibold text-sm",
                                isSelected ? "text-slate-100" : "text-slate-300"
                              )}>
                                {template.title}
                              </div>
                              <div className={cn(
                                "text-xs mt-1 capitalize",
                                isSelected ? "text-slate-400" : "text-slate-500"
                              )}>
                                {template.category?.replace(/_/g, ' ') || 'geral'}
                              </div>
                              {template.usageCount > 0 && (
                                <div className="text-xs mt-1 text-slate-600">
                                  Usado {template.usageCount}x
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle className="w-5 h-5 text-blue-500" />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Editor de Mensagem */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-lg overflow-hidden">
              <div className="bg-slate-950 p-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <Edit className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">
                      Composição da Mensagem
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
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
                    data-testid="textarea-message"
                    className="min-h-[280px] bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 font-mono text-sm"
                  />
                  <div className="mt-4 p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      VARIÁVEIS DINÂMICAS
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['{{nome}}', '{{telefone}}', '{{dias_vencido}}', '{{data_vencimento}}', '{{codigo_indicacao}}'].map(variable => (
                        <button
                          key={variable}
                          onClick={() => setMessage(prev => prev + ' ' + variable)}
                          data-testid={`variable-${variable.replace(/[{}]/g, '')}`}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-lg transition-all group"
                        >
                          <span className="text-xs font-mono text-slate-400 group-hover:text-blue-500">
                            {variable}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Variáveis Customizadas */}
                {(selectedTemplate === 'manutencao') && (
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <h4 className="text-sm font-semibold text-slate-300 mb-4">CONFIGURAR VARIÁVEIS</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400">Data Manutenção</Label>
                        <Input
                          type="date"
                          value={messageVariables.data_manutencao}
                          onChange={(e) => setMessageVariables(prev => ({ ...prev, data_manutencao: e.target.value }))}
                          data-testid="input-data-manutencao"
                          className="h-9 bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">Horário Início</Label>
                        <Input
                          type="time"
                          value={messageVariables.horario_inicio}
                          onChange={(e) => setMessageVariables(prev => ({ ...prev, horario_inicio: e.target.value }))}
                          data-testid="input-horario-inicio"
                          className="h-9 bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">Horário Fim</Label>
                        <Input
                          type="time"
                          value={messageVariables.horario_fim}
                          onChange={(e) => setMessageVariables(prev => ({ ...prev, horario_fim: e.target.value }))}
                          data-testid="input-horario-fim"
                          className="h-9 bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">Duração (horas)</Label>
                        <Input
                          type="number"
                          value={messageVariables.duracao}
                          onChange={(e) => setMessageVariables(prev => ({ ...prev, duracao: e.target.value }))}
                          data-testid="input-duracao"
                          className="h-9 bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview WhatsApp Mobile */}
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                    <Phone className="w-4 h-4" />
                    PREVIEW WHATSAPP
                  </h4>
                  <div className="mx-auto max-w-[360px]">
                    {/* Mockup do celular */}
                    <div className="bg-slate-800 rounded-[2.5rem] p-2 shadow-2xl">
                      <div className="bg-slate-900 rounded-[2rem] p-1">
                        {/* Tela do celular */}
                        <div className="bg-[#0b141a] rounded-[1.75rem] overflow-hidden">
                          {/* Header do WhatsApp */}
                          <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-600" />
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">TV ON</p>
                              <p className="text-[#8696a0] text-xs">online</p>
                            </div>
                            <div className="flex gap-4">
                              <Phone className="w-5 h-5 text-[#8696a0]" />
                              <Search className="w-5 h-5 text-[#8696a0]" />
                            </div>
                          </div>
                          
                          {/* Área de mensagens */}
                          <div className="h-[400px] overflow-y-auto bg-[#0b141a] p-4" style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M0 0h20v20H0z M20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E")`,
                            backgroundSize: '40px 40px'
                          }}>
                            {/* Mensagem do sistema */}
                            <div className="flex justify-start mb-2">
                              <div className="max-w-[85%]">
                                <div className="bg-[#202c33] rounded-lg rounded-tl-none p-3 shadow-sm">
                                  <div className="whitespace-pre-wrap text-[13px] text-white font-sans leading-relaxed">
                                    {formatWhatsAppText(processMessageVariables(message))}
                                  </div>
                                  <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-[10px] text-[#8696a0]">agora</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Input área (decorativa) */}
                          <div className="bg-[#202c33] px-4 py-2 flex items-center gap-3">
                            <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-2">
                              <p className="text-[#8696a0] text-sm">Mensagem</p>
                            </div>
                            <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center">
                              <Send className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl text-slate-100 flex items-center gap-2">
                    <Rocket className="w-6 h-6 text-blue-500" />
                    Pronto para Disparar?
                  </h3>
                  <p className="text-slate-400 mt-2">
                    {selectedClients.length > 0 
                      ? `${selectedClients.length} cliente(s) selecionado(s)` 
                      : `${filteredClients.length} cliente(s) no filtro atual`}
                  </p>
                </div>
                <button
                  onClick={handleSendMessages}
                  disabled={sendMessagesMutation.isPending}
                  data-testid="button-send-messages"
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    {sendMessagesMutation.isPending ? 'Enviando...' : 'Enviar Mensagens'}
                  </span>
                </button>
              </div>
              
              {sendingProgress.status === 'sending' && (
                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-slate-300">Progresso do Envio</span>
                    <span className="font-bold text-slate-100">{sendingProgress.current}/{sendingProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(sendingProgress.current / sendingProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita - Seleção de Clientes */}
          <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-lg overflow-hidden">
              <div className="bg-slate-950 p-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <Target className="w-6 h-6 text-blue-500" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-100">
                    Seleção de Público
                  </h2>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'todos', label: 'Todos', icon: Users },
                    { value: 'ativos', label: 'Ativos', icon: CheckCircle },
                    { value: 'vencidos', label: 'Vencidos', icon: Clock },
                    { value: 'vencidos_10_dias', label: 'Vencidos +10d', icon: AlertTriangle },
                    { value: 'novos', label: 'Novos', icon: UserPlus },
                    { value: 'testes', label: 'Testes', icon: Zap },
                  ].map(filter => {
                    const Icon = filter.icon;
                    const isSelected = selectedFilter === filter.value;
                    return (
                      <button
                        key={filter.value}
                        onClick={() => setSelectedFilter(filter.value)}
                        data-testid={`filter-${filter.value}`}
                        className={cn(
                          "relative group rounded-lg p-4 transition-all duration-200 text-left",
                          isSelected
                            ? "bg-slate-800 ring-2 ring-blue-500 shadow-lg"
                            : "bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-slate-600"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg flex items-center justify-center",
                            isSelected 
                              ? "bg-blue-500/20" 
                              : "bg-slate-800 group-hover:bg-slate-700"
                          )}>
                            <Icon className={cn(
                              "w-5 h-5",
                              isSelected ? "text-blue-400" : "text-slate-400 group-hover:text-slate-300"
                            )} />
                          </div>
                          <div>
                            <p className={cn(
                              "text-sm font-semibold",
                              isSelected ? "text-slate-100" : "text-slate-300 group-hover:text-slate-100"
                            )}>
                              {filter.label}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Lista de Clientes */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-lg overflow-hidden">
              <div className="bg-slate-950 p-6 border-b border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                      <Users className="w-6 h-6 text-blue-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-100">
                      Clientes ({filteredClients.length})
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllFiltered}
                      data-testid="button-select-all"
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-lg transition-all group"
                      title="Selecionar Todos"
                    >
                      <CheckCircle className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                    </button>
                    <button
                      onClick={deselectAll}
                      data-testid="button-deselect-all"
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg transition-all group"
                      title="Limpar Seleção"
                    >
                      <XCircle className="w-5 h-5 text-slate-400 group-hover:text-slate-300" />
                    </button>
                  </div>
                </div>
                
                {/* Campo de busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Nome ou número..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search"
                    className="pl-10 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="p-4 space-y-2">
                  {isLoading ? (
                    <div className="text-center py-12">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                      <p className="text-slate-400">Carregando clientes...</p>
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="text-center py-12">
                      <UserX className="w-16 h-16 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-400">Nenhum cliente encontrado</p>
                      <p className="text-slate-500 text-sm mt-1">Ajuste os filtros para ver mais resultados</p>
                    </div>
                  ) : (
                    filteredClients.map((cliente: Cliente) => {
                      const isSelected = selectedClients.includes(cliente.id);
                      const isExpired = cliente.vencimento && new Date(cliente.vencimento) < new Date();
                      const matchesSearch = clientMatchesSearch(cliente);
                      
                      return (
                        <div
                          key={cliente.id}
                          ref={(el) => { clientRefs.current[cliente.id] = el }}
                          onClick={() => toggleClientSelection(cliente.id)}
                          data-testid={`client-card-${cliente.id}`}
                          className={cn(
                            "relative p-4 rounded-lg cursor-pointer transition-all duration-200 border",
                            isSelected
                              ? "bg-slate-800 border-blue-500 ring-1 ring-blue-500 shadow-md"
                              : matchesSearch
                              ? "bg-slate-900 border-yellow-600/50 ring-1 ring-yellow-600/30" // Destaca quem corresponde à busca
                              : "bg-slate-950 hover:bg-slate-800 border-slate-700 hover:border-slate-600"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "mt-0.5 w-5 h-5 rounded border-2 transition-all flex items-center justify-center",
                              isSelected
                                ? "bg-blue-600 border-blue-600"
                                : "border-slate-600 hover:border-slate-500"
                            )}>
                              {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-slate-100">
                                  {selectedFilter === 'testes' ? 'Cliente Teste' : (cliente.nome || 'Cliente')}
                                </span>
                                {matchesSearch && (
                                  <div className="p-1 bg-yellow-900/50 rounded border border-yellow-600/30">
                                    <Search className="w-3.5 h-3.5 text-yellow-400" />
                                  </div>
                                )}
                                {cliente.status === 'ativo' && !isExpired && (
                                  <span className="px-2 py-0.5 bg-slate-800 text-blue-400 text-xs font-semibold rounded border border-slate-700">
                                    ATIVO
                                  </span>
                                )}
                                {isExpired && selectedFilter !== 'testes' && (
                                  <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs font-semibold rounded border border-slate-700">
                                    VENCIDO
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                  <Phone className="w-3.5 h-3.5" />
                                  <span>{formatPhoneNumber(cliente.telefone)}</span>
                                </div>
                                {cliente.vencimento && (
                                  <div className="flex items-center gap-2 text-slate-400 text-sm">
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