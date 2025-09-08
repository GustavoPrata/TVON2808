import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Save, 
  Trash2, 
  Edit2, 
  X, 
  MessageSquare, 
  Clock,
  Image,
  Sun,
  Moon,
  Cloud,
  GripVertical
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MensagemRapida {
  id: number;
  titulo: string;
  texto: string;
  imagemUrl?: string;
  tipo: string;
  ordem: number;
  ativo: boolean;
  teclaAtalho?: string;
  variavel: boolean;
  categoria?: string;
  criadoEm: string;
  atualizadoEm: string;
}

// Sortable Message Card Component
function SortableMessageCard({ message, onEdit, onDelete, getGreetingText }: {
  message: MensagemRapida;
  onEdit: (message: MensagemRapida) => void;
  onDelete: (id: number) => void;
  getGreetingText: () => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: message.id,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: 'default',
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      className={`relative h-full flex flex-col transition-shadow ${!message.ativo ? 'opacity-50' : ''} ${isDragging ? 'z-50 shadow-2xl scale-105' : 'hover:shadow-lg'}`}
    >
      <div className="p-4 flex-1 flex flex-col">
        {/* Drag Handle and Header */}
        <div className="flex items-start gap-2 mb-3">
          <div 
            {...attributes} 
            {...listeners}
            className="pt-1 cursor-grab hover:cursor-grabbing active:cursor-grabbing hover:text-blue-400 transition-colors touch-none"
          >
            <GripVertical className="h-5 w-5 text-slate-400 hover:text-blue-400" />
          </div>
          <h3 className="font-semibold text-lg flex-1">{message.titulo}</h3>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(message);
              }}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(message.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">
            {message.variavel && message.texto.includes("{{saudacao}}")
              ? message.texto.replace("{{saudacao}}", getGreetingText())
              : message.texto}
          </p>
        </div>

        {/* Image indicator */}
        {message.imagemUrl && (
          <div className="flex items-center gap-1 text-xs text-blue-500 mt-3">
            <Image className="h-3 w-3" />
            <span>Contém imagem anexa</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 bg-slate-900/50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              message.tipo === 'saudacao' ? 'bg-yellow-500/20 text-yellow-400' :
              message.tipo === 'instalacao' ? 'bg-blue-500/20 text-blue-400' :
              message.tipo === 'suporte' ? 'bg-green-500/20 text-green-400' :
              message.tipo === 'pagamento' ? 'bg-purple-500/20 text-purple-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {message.tipo}
            </span>
            {message.teclaAtalho && (
              <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">
                {message.teclaAtalho}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Ordem: {message.ordem}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function Ajuda() {
  const [editingMessage, setEditingMessage] = useState<MensagemRapida | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    titulo: "",
    texto: "",
    imagemUrl: "",
    tipo: "suporte",
    ordem: 0,
    ativo: true,
    teclaAtalho: "",
    variavel: false,
    categoria: ""
  });

  // Sensors for drag and drop with better configuration
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch all quick messages
  const { data: messages = [], isLoading } = useQuery<MensagemRapida[]>({
    queryKey: ["/api/mensagens-rapidas"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/mensagens-rapidas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mensagens-rapidas"] });
      toast({ title: "Mensagem rápida criada com sucesso!" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao criar mensagem rápida", variant: "destructive" });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: number; body: any }) => 
      apiRequest("PUT", `/api/mensagens-rapidas/${data.id}`, data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mensagens-rapidas"] });
      toast({ title: "Mensagem rápida atualizada com sucesso!" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar mensagem rápida", variant: "destructive" });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/mensagens-rapidas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mensagens-rapidas"] });
      toast({ title: "Mensagem rápida deletada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao deletar mensagem rápida", variant: "destructive" });
    }
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: (data: { messages: { id: number; ordem: number }[] }) => 
      apiRequest("PUT", "/api/mensagens-rapidas/reorder", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mensagens-rapidas"] });
      toast({ title: "Ordem atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar ordem", variant: "destructive" });
    }
  });

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('/api/mensagens-rapidas/upload-image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const result = await response.json();
      return result.imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ 
        title: "Erro ao fazer upload da imagem", 
        variant: "destructive" 
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: "",
      texto: "",
      imagemUrl: "",
      tipo: "suporte",
      ordem: 0,
      ativo: true,
      teclaAtalho: "",
      variavel: false,
      categoria: ""
    });
    setEditingMessage(null);
    setSelectedFile(null);
  };

  const handleEdit = (message: MensagemRapida) => {
    setEditingMessage(message);
    setFormData({
      titulo: message.titulo,
      texto: message.texto,
      imagemUrl: message.imagemUrl || "",
      tipo: message.tipo,
      ordem: message.ordem,
      ativo: message.ativo,
      teclaAtalho: message.teclaAtalho || "",
      variavel: message.variavel,
      categoria: message.categoria || ""
    });
    setIsDialogOpen(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const sortedMessages = [...messages].sort((a, b) => a.ordem - b.ordem);
      const oldIndex = sortedMessages.findIndex((m) => m.id === active.id);
      const newIndex = sortedMessages.findIndex((m) => m.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newMessages = arrayMove(sortedMessages, oldIndex, newIndex);
        
        // Update order for all messages with their new positions
        const updates = newMessages.map((message, index) => ({
          id: message.id,
          ordem: index + 1
        }));
        
        // Optimistically update the UI immediately for smooth experience
        const optimisticUpdate = newMessages.map((m, i) => ({
          ...m,
          ordem: i + 1
        }));
        
        queryClient.setQueryData(["/api/mensagens-rapidas"], optimisticUpdate);
        
        // Send the batch update to the server
        reorderMutation.mutate({ messages: updates });
      }
    }
    
    setActiveId(null);
  };

  const handleSubmit = async () => {
    if (!formData.titulo || !formData.texto) {
      toast({ 
        title: "Por favor, preencha todos os campos obrigatórios", 
        variant: "destructive" 
      });
      return;
    }

    let finalFormData = { ...formData };
    
    // Handle image upload or removal
    if (selectedFile) {
      // User selected a new file, upload it
      const imageUrl = await handleImageUpload(selectedFile);
      if (imageUrl) {
        finalFormData.imagemUrl = imageUrl;
      }
    } else if (formData.imagemUrl === "" && editingMessage?.imagemUrl) {
      // User removed the image (imagemUrl is empty but original had an image)
      finalFormData.imagemUrl = null;
    }
    // Otherwise keep the current imagemUrl value (could be existing URL or null)

    if (editingMessage) {
      updateMutation.mutate({ id: editingMessage.id, body: finalFormData });
    } else {
      createMutation.mutate(finalFormData);
    }
  };

  const getTimeIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return <Sun className="h-4 w-4" />;
    if (hour >= 12 && hour < 18) return <Cloud className="h-4 w-4" />;
    return <Moon className="h-4 w-4" />;
  };

  const getGreetingText = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "Olá, bom dia!";
    if (hour >= 12 && hour < 18) return "Olá, boa tarde!";
    return "Olá, boa noite!";
  };

  // Add default messages on first load if no messages exist
  useEffect(() => {
    if (!isLoading && messages.length === 0) {
      // Create default greeting message
      createMutation.mutate({
        titulo: "Saudação",
        texto: "{{saudacao}}",
        tipo: "saudacao",
        ordem: 1,
        ativo: true,
        variavel: true,
        categoria: "greeting"
      });

      // Create installation help message
      createMutation.mutate({
        titulo: "Iniciar Instalação",
        texto: "Vamos começar... primeiro vou te ajudar a instalar o aplicativo em seu dispositivo!",
        tipo: "instalacao",
        ordem: 2,
        ativo: true,
        categoria: "installation"
      });

      // Create device request message
      createMutation.mutate({
        titulo: "Solicitar Dispositivo",
        texto: "Me envie uma foto do seu dispositivo ou me informa a marca!",
        tipo: "suporte",
        ordem: 3,
        ativo: true,
        categoria: "device"
      });

      // Create IBO app installation message
      createMutation.mutate({
        titulo: "Instalar IBO",
        texto: "Entre na loja de aplicativos do seu dispositivo e pesquise por 'IBO'\n\nApós instalar, me mande uma foto ou me mande escrito as informações que tem em seu app:\n- ID ou CHAVE (formato: gd:54:df:56...)\n- Código de 5 números",
        tipo: "instalacao",
        ordem: 4,
        ativo: true,
        categoria: "app"
      });

      // Create Downloader installation message
      createMutation.mutate({
        titulo: "Instalar via Downloader",
        texto: "Entre na loja de aplicativos e pesquise por 'Downloader'\n\nApós instalar, abra o app e insira o código que vou te enviar.",
        tipo: "instalacao",
        ordem: 5,
        ativo: true,
        categoria: "downloader"
      });
    }
  }, [isLoading, messages]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-purple-600 to-blue-600 border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                Central de Ajuda
              </h1>
              <p className="text-white/80">
                Configure mensagens rápidas para agilizar o atendimento ao cliente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current greeting preview */}
      <div className="p-4 mb-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center gap-2 mb-2">
          {getTimeIcon()}
          <span className="text-sm font-medium text-slate-300">Saudação atual:</span>
        </div>
        <p className="text-lg font-semibold text-white">{getGreetingText()}</p>
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-muted-foreground">
          {messages.length} mensagens cadastradas • {messages.filter(m => m.ativo).length} ativas
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Mensagem
        </Button>
      </div>

      {/* Sortable Messages Grid with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={messages.map(m => m.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {messages.sort((a, b) => a.ordem - b.ordem).map((message) => (
              <SortableMessageCard
                key={message.id}
                message={message}
                onEdit={handleEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                getGreetingText={getGreetingText}
              />
            ))}
          </div>
        </SortableContext>
        
        <DragOverlay>
          {activeId ? (() => {
            const activeMessage = messages.find(m => m.id === activeId);
            return activeMessage ? (
              <Card className="opacity-95 shadow-2xl transform rotate-2 scale-105 cursor-grabbing bg-slate-800/95 border-blue-500/50">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical className="h-5 w-5 text-blue-400" />
                    <h3 className="font-semibold text-lg text-white">{activeMessage.titulo}</h3>
                  </div>
                  <p className="text-sm text-slate-300 line-clamp-2">
                    {activeMessage.texto}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      activeMessage.tipo === 'saudacao' ? 'bg-yellow-500/20 text-yellow-400' :
                      activeMessage.tipo === 'instalacao' ? 'bg-blue-500/20 text-blue-400' :
                      activeMessage.tipo === 'suporte' ? 'bg-green-500/20 text-green-400' :
                      activeMessage.tipo === 'pagamento' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {activeMessage.tipo}
                    </span>
                    <span className="text-xs text-blue-400">
                      Movendo para nova posição...
                    </span>
                  </div>
                </div>
              </Card>
            ) : null;
          })() : null}
        </DragOverlay>
      </DndContext>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMessage ? 'Editar Mensagem Rápida' : 'Nova Mensagem Rápida'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Saudação, Ajuda com instalação..."
              />
            </div>

            <div>
              <Label htmlFor="texto">Texto da Mensagem *</Label>
              <Textarea
                id="texto"
                value={formData.texto}
                onChange={(e) => setFormData({ ...formData, texto: e.target.value })}
                placeholder="Digite o texto da mensagem..."
                className="min-h-[100px]"
              />
              {formData.tipo === 'saudacao' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Use {'{'}saudacao{'}'} para inserir saudação dinâmica baseada no horário
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="image">Imagem (opcional)</Label>
              <div className="space-y-3">
                {/* Current image preview */}
                {formData.imagemUrl && !selectedFile && (
                  <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                    <div className="flex items-start gap-3">
                      <img 
                        src={formData.imagemUrl} 
                        alt="Imagem atual" 
                        className="h-24 w-24 object-cover rounded-lg border border-slate-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-green-400 mb-2">✓ Imagem atual</p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setFormData({ ...formData, imagemUrl: "" });
                              setSelectedFile(null);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remover
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const fileInput = document.getElementById('image') as HTMLInputElement;
                              fileInput?.click();
                            }}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Trocar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* New file selected preview */}
                {selectedFile && (
                  <div className="border border-blue-700 rounded-lg p-3 bg-blue-900/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-blue-400" />
                        <p className="text-sm text-blue-400">
                          Nova imagem: {selectedFile.name}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedFile(null);
                          // If editing, restore original URL
                          if (editingMessage?.imagemUrl) {
                            setFormData({ ...formData, imagemUrl: editingMessage.imagemUrl });
                          }
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* File input */}
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      // Clear the existing URL when selecting new file
                      if (formData.imagemUrl) {
                        setFormData({ ...formData, imagemUrl: "" });
                      }
                    }
                  }}
                  disabled={uploadingImage}
                  className={formData.imagemUrl && !selectedFile ? "hidden" : ""}
                />

                {/* Upload status */}
                {uploadingImage && (
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                    Fazendo upload da imagem...
                  </div>
                )}

                {/* Help text */}
                {!formData.imagemUrl && !selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: JPG, PNG, GIF, WebP (máx. 10MB)
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saudacao">Saudação</SelectItem>
                    <SelectItem value="instalacao">Instalação</SelectItem>
                    <SelectItem value="suporte">Suporte</SelectItem>
                    <SelectItem value="pagamento">Pagamento</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ex: greeting, device, app..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ordem">Ordem de Exibição</Label>
                <Input
                  id="ordem"
                  type="number"
                  value={formData.ordem}
                  onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="teclaAtalho">Tecla de Atalho</Label>
                <Input
                  id="teclaAtalho"
                  value={formData.teclaAtalho}
                  onChange={(e) => setFormData({ ...formData, teclaAtalho: e.target.value })}
                  placeholder="Ex: Ctrl+1"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">Mensagem Ativa</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="variavel"
                  checked={formData.variavel}
                  onCheckedChange={(checked) => setFormData({ ...formData, variavel: checked })}
                />
                <Label htmlFor="variavel">Usar Variáveis</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                <Save className="h-4 w-4 mr-2" />
                {editingMessage ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}