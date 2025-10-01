import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import {
  Plus,
  Save,
  X,
  Copy,
  Trash2,
  Edit,
  Check,
  CheckCheck,
  Search,
  MessageSquare,
  FileText,
  Send,
  Users,
  UserPlus,
  Gift,
  DollarSign,
  CreditCard,
  Calendar,
  Bell,
  Heart,
  Star,
  Award,
  Trophy,
  Target,
  TrendingUp,
  BarChart,
  Activity,
  Mail,
  Share2,
  Megaphone,
  Sparkles,
  Zap,
  Rocket,
  Tag,
  ShoppingCart,
  Package,
  Box,
  Archive,
  AlertCircle,
  Info,
  HelpCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  ArrowLeft,
  Wrench,
  Shield,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  Phone,
  Smartphone,
  MessageCircle,
  Wifi,
  Globe,
  MapPin,
  Navigation,
  Compass,
  Home,
  Building,
  Store,
} from "lucide-react";
import { insertCampaignTemplateSchema, type CampaignTemplate } from "@shared/schema";

// Sample data for preview
const SAMPLE_DATA = {
  nome: "João Silva",
  telefone: "11987654321",
  vencimento: "15/10/2025",
  valor: "R$ 150,00",
  usuario: "joao123",
  senha: "senha123",
  aplicativo: "Netflix",
  plano: "Premium",
};

// Create icon map with all imported icons
const ICON_MAP = {
  MessageSquare,
  FileText,
  Users,
  UserPlus,
  Gift,
  DollarSign,
  CreditCard,
  Calendar,
  Bell,
  Heart,
  Star,
  Award,
  Trophy,
  Target,
  TrendingUp,
  BarChart,
  Activity,
  Mail,
  Send,
  Share2,
  Megaphone,
  Sparkles,
  Zap,
  Rocket,
  Tag,
  ShoppingCart,
  Package,
  Box,
  Archive,
  AlertCircle,
  Info,
  HelpCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,

  Wrench,
  Shield,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  Phone,
  Smartphone,
  MessageCircle,
  Wifi,
  Globe,
  MapPin,
  Navigation,
  Compass,
  Home,
  Building,
  Store,
} as const;

// Available icons from lucide-react
const AVAILABLE_ICONS = Object.keys(ICON_MAP) as (keyof typeof ICON_MAP)[];

type IconName = keyof typeof ICON_MAP;

// Helper to render icon component - now using the icon map
const IconComponent = ({ name, className }: { name: string; className?: string }) => {
  const Icon = ICON_MAP[name as keyof typeof ICON_MAP];
  if (!Icon) {
    return <FileText className={className} />;
  }
  return <Icon className={className} />;
};

// Format WhatsApp message with bold and italic
const formatWhatsAppMessage = (text: string): JSX.Element => {
  if (!text) return <></>;

  // Replace variables with sample data
  let formattedText = text;
  Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    formattedText = formattedText.replace(regex, value);
  });

  // Split by both bold and italic markers
  const parts = formattedText.split(/(\*[^*]+\*|_[^_]+_)/g);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          return <strong key={index}>{part.slice(1, -1)}</strong>;
        } else if (part.startsWith('_') && part.endsWith('_')) {
          return <em key={index}>{part.slice(1, -1)}</em>;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};

export default function TemplateEditor() {
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchIcon, setSearchIcon] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<CampaignTemplate[]>({
    queryKey: ["/api/campaign-templates"],
  });

  // Form for editing/creating templates
  const form = useForm<z.infer<typeof insertCampaignTemplateSchema>>({
    resolver: zodResolver(insertCampaignTemplateSchema),
    defaultValues: {
      key: "",
      title: "",
      content: "",
      icon: "MessageSquare",
      isActive: true,
    },
  });

  // Watch form content for live preview
  const watchedContent = form.watch("content");
  const watchedIcon = form.watch("icon");

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof insertCampaignTemplateSchema>) =>
      apiRequest("POST", "/api/campaign-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-templates"] });
      toast({
        title: "Template criado",
        description: "Template criado com sucesso!",
      });
      setIsEditing(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<z.infer<typeof insertCampaignTemplateSchema>> }) =>
      apiRequest("PUT", `/api/campaign-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-templates"] });
      toast({
        title: "Template atualizado",
        description: "Template atualizado com sucesso!",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/campaign-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-templates"] });
      toast({
        title: "Template deletado",
        description: "Template deletado com sucesso!",
      });
      setSelectedTemplate(null);
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao deletar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Load template into form
  const loadTemplate = (template: CampaignTemplate) => {
    setSelectedTemplate(template);
    form.reset({
      key: template.key,
      title: template.title,
      content: template.content,
      icon: template.icon,
      isActive: template.isActive,
    });
    setIsEditing(true);
  };

  // Start new template
  const startNewTemplate = () => {
    setSelectedTemplate(null);
    form.reset({
      key: "",
      title: "",
      content: "",
      icon: "MessageSquare",
      isActive: true,
    });
    setIsEditing(true);
  };

  // Save template
  const onSubmit = (data: z.infer<typeof insertCampaignTemplateSchema>) => {
    if (selectedTemplate) {
      updateMutation.mutate({ id: selectedTemplate.id, data });
    } else {
      // Generate key from title if not provided
      if (!data.key) {
        data.key = data.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      }
      createMutation.mutate(data);
    }
  };

  // Insert variable into content
  const insertVariable = (variable: string) => {
    const currentContent = form.getValues("content");
    const newContent = currentContent + ` {{${variable}}}`;
    form.setValue("content", newContent);
  };

  // Duplicate template
  const duplicateTemplate = () => {
    if (!selectedTemplate) return;
    
    const newData = {
      ...form.getValues(),
      key: `${selectedTemplate.key}_copia`,
      title: `${selectedTemplate.title} (Cópia)`,
    };
    
    createMutation.mutate(newData);
  };

  // Filter icons based on search
  const filteredIcons = AVAILABLE_ICONS.filter((icon) =>
    icon.toLowerCase().includes(searchIcon.toLowerCase())
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950">
      <div className="flex h-full flex-col max-w-[1920px] mx-auto">
        {/* Header sticky fino */}
        <div className="h-14 sticky top-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/promocoes">
              <Button variant="ghost" size="lg" className="hover:bg-slate-800/50">
                <ArrowLeft className="mr-2 h-5 w-5" />
                <span className="text-base">Voltar</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Editor de Templates</h1>
            </div>
          </div>
          <Button
            onClick={startNewTemplate}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 shadow-xl hidden lg:flex"
            data-testid="button-new-template"
          >
            <Plus className="mr-2 h-5 w-5" />
            <span className="text-base">Novo Template</span>
          </Button>
        </div>

        {/* Mobile Layout - Tabs ocupando tela toda */}
        <div className="flex-1 min-h-0 block lg:hidden">
          <Tabs defaultValue="templates" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 bg-slate-900 border-b border-slate-800 rounded-none h-14">
              <TabsTrigger value="templates" data-testid="tab-templates-editor" className="data-[state=active]:bg-slate-800 h-full text-base">
                Templates
              </TabsTrigger>
              <TabsTrigger value="editor" data-testid="tab-editor-editor" className="data-[state=active]:bg-slate-800 h-full text-base">
                Editor
              </TabsTrigger>
              <TabsTrigger value="preview" data-testid="tab-preview-editor" className="data-[state=active]:bg-slate-800 h-full text-base">
                Preview
              </TabsTrigger>
            </TabsList>

            {/* Tab Content - Templates List */}
            <TabsContent value="templates" className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full bg-slate-900/70">
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
                  <h2 className="text-xl font-bold text-white">Templates</h2>
                  <Button
                    onClick={startNewTemplate}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-new-template-mobile"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Novo
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100%-80px)]">
                  <div className="p-4 space-y-3">
                    {isLoading ? (
                      <div className="text-slate-400 text-center py-8 text-base">Carregando templates...</div>
                    ) : templates.length === 0 ? (
                      <div className="text-slate-400 text-center py-8 text-base">Nenhum template encontrado</div>
                    ) : (
                      templates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => loadTemplate(template)}
                          className={`w-full min-h-[72px] p-4 rounded-xl border transition-all duration-200 text-left shadow-lg hover:shadow-xl ${
                            selectedTemplate?.id === template.id
                              ? "bg-gradient-to-r from-blue-900/30 to-blue-800/20 border-blue-600"
                              : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70"
                          }`}
                          data-testid={`button-template-mobile-${template.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <IconComponent
                              name={template.icon}
                              className="h-6 w-6 text-blue-400 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-white text-base truncate">{template.title}</div>
                              <div className="text-sm text-slate-400 mt-1 line-clamp-2">
                                {template.content.substring(0, 50)}...
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Tab Content - Editor */}
            <TabsContent value="editor" className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full bg-slate-900/70">
                {isEditing ? (
                  <div className="h-full flex flex-col">
                    <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
                      <h2 className="text-xl font-bold text-white">
                        {selectedTemplate ? "Editar" : "Novo"}
                      </h2>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={() => setIsEditing(false)}
                          data-testid="button-cancel-mobile"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                        <Button
                          onClick={form.handleSubmit(onSubmit)}
                          size="lg"
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={createMutation.isPending || updateMutation.isPending}
                          data-testid="button-save-mobile"
                        >
                          <Save className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto p-4">
                      <Form {...form}>
                        <form className="space-y-4">
                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-base">Título do Template</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Ex: Promoção Especial"
                                    className="h-12 text-base bg-slate-950 border-slate-800"
                                    data-testid="input-title-mobile"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-base">Conteúdo da Mensagem</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    rows={15}
                                    placeholder="Digite o conteúdo do template aqui..."
                                    className="bg-slate-950 border-slate-800 text-base resize-none"
                                    data-testid="textarea-content-mobile"
                                  />
                                </FormControl>
                                <div className="flex justify-between mt-2">
                                  <span className="text-sm text-slate-400">
                                    Use *texto* para negrito e _texto_ para itálico
                                  </span>
                                  <span className="text-sm text-slate-400">
                                    {field.value?.length || 0} / 4096
                                  </span>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </form>
                      </Form>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                    <MessageSquare className="h-20 w-20 mb-4 opacity-50" />
                    <p className="text-xl">Selecione um template para editar</p>
                    <p className="text-base mt-2">ou crie um novo template</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab Content - Preview */}
            <TabsContent value="preview" className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full bg-slate-900/70 p-4 flex flex-col">
                <h2 className="text-xl font-bold text-white mb-4">Preview do WhatsApp</h2>
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-[360px]">
                    <div className="bg-gradient-to-b from-slate-950 to-slate-900 rounded-2xl p-6 shadow-2xl">
                      <div className="bg-gradient-to-br from-green-900 to-green-800 text-white p-5 rounded-xl rounded-tr-sm shadow-xl">
                        <div className="whitespace-pre-wrap break-words text-base">
                          {formatWhatsAppMessage(watchedContent || "Digite sua mensagem...")}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-2">
                          <span className="text-sm text-green-300">9:41 AM</span>
                          <CheckCheck className="h-4 w-4 text-blue-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop Layout - Grid de 3 Colunas FULLSCREEN */}
        <div className="hidden lg:grid grid-cols-[280px_1fr_380px] gap-3 p-5 h-full overflow-hidden">
          
          {/* Painel 1: Lista de Templates (280px fixo) */}
          <div className="h-full min-h-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
            {/* Barra de busca STICKY no topo */}
            <div className="sticky top-0 z-10 p-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Buscar templates..."
                  className="h-10 text-base bg-slate-950 border-slate-700"
                  data-testid="input-search-templates"
                />
              </div>
            </div>
            
            {/* Lista scrollável */}
            <ScrollArea className="h-[calc(100%-68px)]">
              <div className="p-3 space-y-2">
                {isLoading ? (
                  <div className="text-slate-400 text-center py-8 text-base">Carregando templates...</div>
                ) : templates.length === 0 ? (
                  <div className="text-slate-400 text-center py-8 text-base">Nenhum template encontrado</div>
                ) : (
                  templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template)}
                      className={`w-full min-h-[56px] p-4 rounded-xl border transition-all duration-200 text-left hover:shadow-xl ${
                        selectedTemplate?.id === template.id
                          ? "bg-gradient-to-r from-blue-900/30 to-blue-800/20 border-blue-600 shadow-xl"
                          : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                      }`}
                      data-testid={`button-template-${template.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <IconComponent
                          name={template.icon}
                          className="h-6 w-6 text-blue-400 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-base truncate">{template.title}</div>
                          <div className="text-sm text-slate-400 mt-1 line-clamp-2">
                            {template.content.substring(0, 40)}...
                          </div>
                          {template.usageCount > 0 && (
                            <div className="mt-1">
                              <span className="text-xs text-slate-500">
                                Usado {template.usageCount}x
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Painel 2: Editor Central (flex-grow) */}
          <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-900/70">
            {/* Barra de ações STICKY */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
              <h3 className="text-xl font-bold text-white">
                {isEditing ? (selectedTemplate ? "Editando Template" : "Novo Template") : "Editor"}
              </h3>
              {isEditing && (
                <div className="flex gap-2">
                  {selectedTemplate && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={duplicateTemplate}
                        data-testid="button-duplicate"
                        className="shadow-xl"
                      >
                        <Copy className="h-5 w-5 mr-2" />
                        Duplicar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => deleteMutation.mutate(selectedTemplate.id)}
                        className="text-red-400 hover:text-red-300 shadow-xl"
                        data-testid="button-delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setIsEditing(false)}
                    data-testid="button-cancel"
                    className="shadow-xl"
                  >
                    <X className="h-5 w-5 mr-2" />
                    <span className="text-base">Cancelar (Esc)</span>
                  </Button>
                  <Button
                    onClick={form.handleSubmit(onSubmit)}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 shadow-xl"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    <span className="text-base">Salvar (Ctrl+S)</span>
                  </Button>
                </div>
              )}
            </div>
            
            {/* Formulário flexível */}
            {isEditing ? (
              <div className="flex-1 min-h-0 flex flex-col p-4 overflow-y-auto">
                <Form {...form}>
                  <form className="flex flex-col h-full">
                    {/* Grid de campos superiores */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Título</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Ex: Promoção Especial"
                                className="h-12 text-base bg-slate-950 border-slate-700"
                                data-testid="input-title"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="icon"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Ícone</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full h-12 justify-start text-base bg-slate-950 border-slate-700"
                                  onClick={() => setShowIconPicker(!showIconPicker)}
                                  data-testid="button-icon-picker"
                                >
                                  <IconComponent name={field.value || "MessageSquare"} className="h-6 w-6 mr-2" />
                                  {field.value || "MessageSquare"}
                                </Button>
                                
                                {showIconPicker && (
                                  <div className="absolute top-full mt-2 p-4 bg-slate-900 border border-slate-800 rounded-xl z-50 w-80 shadow-2xl">
                                    <Input
                                      placeholder="Buscar ícone..."
                                      value={searchIcon}
                                      onChange={(e) => setSearchIcon(e.target.value)}
                                      className="mb-3 h-10 bg-slate-800 border-slate-700"
                                      data-testid="input-search-icon"
                                    />
                                    <ScrollArea className="h-48">
                                      <div className="grid grid-cols-6 gap-2">
                                        {filteredIcons.map((iconName) => (
                                          <button
                                            key={iconName}
                                            type="button"
                                            onClick={() => {
                                              field.onChange(iconName);
                                              setShowIconPicker(false);
                                              setSearchIcon("");
                                            }}
                                            className="p-3 hover:bg-slate-800 rounded-lg"
                                            title={iconName}
                                            data-testid={`button-icon-${iconName}`}
                                          >
                                            <IconComponent name={iconName} className="h-6 w-6" />
                                          </button>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Barra de variáveis */}
                    <div className="p-3 bg-slate-950/50 rounded-lg mb-4">
                      <Label className="text-base mb-2 block">Variáveis Disponíveis</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(SAMPLE_DATA).map((variable) => (
                          <Button
                            key={variable}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => insertVariable(variable)}
                            className="h-9 text-base shadow-lg"
                            data-testid={`button-variable-${variable}`}
                          >
                            {`{{${variable}}}`}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Textarea FLEXÍVEL ocupando TODO espaço restante */}
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem className="flex-1 flex flex-col">
                          <FormLabel className="text-base">Conteúdo da Mensagem</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Digite o conteúdo do template aqui..."
                              className="flex-1 resize-none text-base leading-6 bg-slate-950/70 border-slate-700 p-4"
                              data-testid="textarea-content"
                            />
                          </FormControl>
                          <div className="flex justify-between mt-2">
                            <span className="text-sm text-slate-500">
                              Use *texto* para negrito e _texto_ para itálico
                            </span>
                            <span className="text-sm text-slate-500">
                              {field.value?.length || 0} / 4096
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <MessageSquare className="h-20 w-20 mb-4 opacity-50" />
                <p className="text-xl">Selecione um template para editar</p>
                <p className="text-base mt-2">ou crie um novo template</p>
              </div>
            )}
          </div>

          {/* Painel 3: Preview WhatsApp (380px fixo) */}
          <div className="h-full min-h-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            {/* Controle de Zoom opcional */}
            <div className="flex justify-center mb-4">
              <Select defaultValue="1.0">
                <SelectTrigger className="w-32 h-10 bg-slate-950 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.8">80%</SelectItem>
                  <SelectItem value="1.0">100%</SelectItem>
                  <SelectItem value="1.2">120%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* iPhone MAIOR centralizado */}
            <div className="h-[calc(100%-56px)] flex items-center justify-center">
              <div className="aspect-[9/19.5] w-full max-w-[360px] rounded-[32px] border-2 border-slate-700 bg-gradient-to-b from-slate-950 to-slate-900 shadow-2xl p-5">
                <div className="h-full bg-slate-950 rounded-[24px] overflow-hidden relative">
                  {/* Status Bar */}
                  <div className="h-8 bg-slate-900 flex items-center justify-between px-6 text-xs text-slate-400">
                    <span>9:41 AM</span>
                    <div className="flex gap-1">
                      <div className="w-4 h-3 bg-slate-400 rounded-sm"></div>
                      <div className="w-1 h-3 bg-slate-400 rounded-sm"></div>
                      <div className="w-4 h-3 bg-slate-400 rounded-sm"></div>
                    </div>
                  </div>

                  {/* WhatsApp Header */}
                  <div className="h-14 bg-green-900 flex items-center px-4 gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700"></div>
                    <div className="flex-1">
                      <div className="text-white font-medium text-base">Sua Empresa</div>
                      <div className="text-sm text-green-300">online</div>
                    </div>
                  </div>

                  {/* Chat Area */}
                  <div className="h-[calc(100%-144px)] bg-gradient-to-b from-slate-950 to-slate-900 p-4 overflow-y-auto">
                    {(watchedContent || isEditing) && (
                      <div className="flex justify-end mb-2">
                        <div className="max-w-[85%] bg-gradient-to-br from-green-900 to-green-800 text-white p-4 rounded-xl rounded-tr-sm shadow-xl">
                          <div className="whitespace-pre-wrap break-words text-base">
                            {formatWhatsAppMessage(watchedContent || "Digite sua mensagem...")}
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-2">
                            <span className="text-sm text-green-300">9:41 AM</span>
                            <CheckCheck className="h-4 w-4 text-blue-400" />
                          </div>
                        </div>
                      </div>
                    )}

                    {!watchedContent && !isEditing && (
                      <div className="text-center text-slate-500 text-base mt-20">
                        O preview da mensagem aparecerá aqui
                      </div>
                    )}
                  </div>

                  {/* Input Area */}
                  <div className="h-16 bg-slate-900 flex items-center px-4 gap-2">
                    <div className="flex-1 h-11 bg-slate-800 rounded-full px-4 flex items-center">
                      <span className="text-slate-400 text-base">Mensagem</span>
                    </div>
                    <div className="w-11 h-11 bg-green-600 rounded-full flex items-center justify-center shadow-xl">
                      <Send className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}