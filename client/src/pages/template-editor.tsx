import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import * as Icons from "lucide-react";
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

// Available icons from lucide-react
const AVAILABLE_ICONS = [
  "MessageSquare",
  "FileText",
  "Users",
  "UserPlus",
  "Gift",
  "DollarSign",
  "CreditCard",
  "Calendar",
  "Bell",
  "Heart",
  "Star",
  "Award",
  "Trophy",
  "Target",
  "TrendingUp",
  "BarChart",
  "Activity",
  "Mail",
  "Send",
  "Share2",
  "Megaphone",
  "Sparkles",
  "Zap",
  "Rocket",
  "Tag",
  "ShoppingCart",
  "Package",
  "Box",
  "Archive",
  "AlertCircle",
  "Info",
  "HelpCircle",
  "CheckCircle",
  "XCircle",
  "AlertTriangle",
  "Settings",
  "Tool",
  "Wrench",
  "Shield",
  "Lock",
  "Unlock",
  "Key",
  "Eye",
  "EyeOff",
  "Phone",
  "Smartphone",
  "MessageCircle",
  "Wifi",
  "Globe",
  "MapPin",
  "Navigation",
  "Compass",
  "Home",
  "Building",
  "Store",
] as const;

type IconName = typeof AVAILABLE_ICONS[number];

// Helper to render icon component
const IconComponent = ({ name, className }: { name: string; className?: string }) => {
  const IconsObj = Icons as any;
  const Icon = IconsObj[name];
  if (!Icon || typeof Icon !== 'function') return <Icons.FileText className={className} />;
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
    <div className="flex h-[calc(100vh-64px)] bg-slate-950">
      {/* Left Side - Template List & Editor */}
      <div className="flex-1 flex flex-col border-r border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">Editor de Templates</h1>
            <Button
              onClick={startNewTemplate}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-new-template"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Template
            </Button>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Template List */}
          <div className="w-80 border-r border-slate-800 bg-slate-900/50">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar templates..."
                  className="bg-slate-900 border-slate-800"
                  data-testid="input-search-templates"
                />
              </div>
            </div>
            <ScrollArea className="h-[calc(100%-80px)]">
              <div className="p-4 space-y-2">
                {isLoading ? (
                  <div className="text-slate-400 text-center py-8">Carregando templates...</div>
                ) : templates.length === 0 ? (
                  <div className="text-slate-400 text-center py-8">Nenhum template encontrado</div>
                ) : (
                  templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template)}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${
                        selectedTemplate?.id === template.id
                          ? "bg-blue-900/20 border-blue-600"
                          : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      }`}
                      data-testid={`button-template-${template.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <IconComponent
                          name={template.icon}
                          className="h-5 w-5 text-blue-400 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{template.title}</div>
                          <div className="text-sm text-slate-400 mt-1 line-clamp-2">
                            {template.content.substring(0, 50)}...
                          </div>
                          {template.usageCount > 0 && (
                            <div className="mt-2">
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

          {/* Editor */}
          <div className="flex-1 p-6">
            {isEditing ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-white">
                      {selectedTemplate ? "Editar Template" : "Novo Template"}
                    </h2>
                    <div className="flex gap-2">
                      {selectedTemplate && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={duplicateTemplate}
                            data-testid="button-duplicate"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Duplicar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(selectedTemplate.id)}
                            className="text-red-400 hover:text-red-300"
                            data-testid="button-delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                        data-testid="button-cancel"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-save"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título do Template</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex: Promoção Especial"
                              className="bg-slate-900 border-slate-800"
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
                          <FormLabel>Ícone</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-start bg-slate-900 border-slate-800"
                                  onClick={() => setShowIconPicker(!showIconPicker)}
                                  data-testid="button-icon-picker"
                                >
                                  <IconComponent name={field.value || "MessageSquare"} className="h-4 w-4 mr-2" />
                                  {field.value || "MessageSquare"}
                                </Button>
                                
                                {showIconPicker && (
                                  <div className="absolute top-full mt-2 p-4 bg-slate-900 border border-slate-800 rounded-lg z-50 w-80">
                                    <Input
                                      placeholder="Buscar ícone..."
                                      value={searchIcon}
                                      onChange={(e) => setSearchIcon(e.target.value)}
                                      className="mb-3 bg-slate-800 border-slate-700"
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
                                            className="p-2 hover:bg-slate-800 rounded"
                                            title={iconName}
                                            data-testid={`button-icon-${iconName}`}
                                          >
                                            <IconComponent name={iconName} className="h-5 w-5" />
                                          </button>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </div>
                                )}
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <FormLabel>Variáveis Disponíveis</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.keys(SAMPLE_DATA).map((variable) => (
                        <Button
                          key={variable}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => insertVariable(variable)}
                          className="text-xs"
                          data-testid={`button-variable-${variable}`}
                        >
                          {`{{${variable}}}`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conteúdo da Mensagem</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={10}
                            placeholder="Digite o conteúdo do template aqui..."
                            className="bg-slate-900 border-slate-800 font-mono"
                            data-testid="textarea-content"
                          />
                        </FormControl>
                        <div className="flex justify-between mt-2">
                          <span className="text-xs text-slate-400">
                            Use *texto* para negrito e _texto_ para itálico
                          </span>
                          <span className="text-xs text-slate-400">
                            {field.value?.length || 0} caracteres
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <MessageSquare className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg">Selecione um template para editar</p>
                <p className="text-sm mt-2">ou crie um novo template</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Phone Preview */}
      <div className="w-96 bg-slate-900/50 p-6 flex flex-col">
        <h2 className="text-lg font-semibold text-white mb-4">Preview do WhatsApp</h2>
        
        {/* iPhone Frame */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            {/* Phone Frame */}
            <div className="w-80 h-[600px] bg-black rounded-[3rem] p-3 shadow-2xl border border-slate-800">
              <div className="w-full h-full bg-slate-950 rounded-[2.5rem] overflow-hidden relative">
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
                  <div className="w-9 h-9 rounded-full bg-slate-700"></div>
                  <div className="flex-1">
                    <div className="text-white font-medium">Sua Empresa</div>
                    <div className="text-xs text-green-300">online</div>
                  </div>
                </div>

                {/* Chat Area */}
                <div className="h-[calc(100%-112px)] bg-slate-950 p-4 overflow-y-auto">
                  {/* Message Bubble */}
                  {(watchedContent || isEditing) && (
                    <div className="flex justify-end mb-2">
                      <div className="max-w-[85%] bg-green-900 text-white p-3 rounded-lg rounded-tr-sm">
                        <div className="whitespace-pre-wrap break-words text-sm">
                          {formatWhatsAppMessage(watchedContent || "Digite sua mensagem...")}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-xs text-green-300">9:41 AM</span>
                          <CheckCheck className="h-3 w-3 text-blue-400" />
                        </div>
                      </div>
                    </div>
                  )}

                  {!watchedContent && !isEditing && (
                    <div className="text-center text-slate-500 text-sm mt-20">
                      O preview da mensagem aparecerá aqui
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="h-14 bg-slate-900 flex items-center px-4 gap-2">
                  <div className="flex-1 h-9 bg-slate-800 rounded-full px-4 flex items-center">
                    <span className="text-slate-400 text-sm">Mensagem</span>
                  </div>
                  <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
                    <Send className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* iPhone Notch */}
            <div className="absolute top-5 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-full"></div>
          </div>
        </div>

        {/* Character Counter */}
        {isEditing && (
          <div className="mt-4 p-4 bg-slate-900 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Contador de Caracteres</span>
              <span className={`font-mono ${(watchedContent?.length || 0) > 4096 ? "text-red-400" : "text-green-400"}`}>
                {watchedContent?.length || 0} / 4096
              </span>
            </div>
            {(watchedContent?.length || 0) > 4096 && (
              <p className="text-xs text-red-400 mt-2">
                Mensagem muito longa para WhatsApp
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}