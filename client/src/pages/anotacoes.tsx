import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Edit, GripVertical, Plus, Trash2, Calendar, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Anotacao } from "@shared/schema";

interface SortableNoteProps {
  note: Anotacao;
  onToggle: (id: number) => void;
  onEdit: (note: Anotacao) => void;
  onDelete: (id: number) => void;
}

function SortableNote({ note, onToggle, onEdit, onDelete }: SortableNoteProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityBadgeColor = (prioridade: string) => {
    switch (prioridade) {
      case "baixa":
        return "bg-gray-100 text-gray-700 hover:bg-gray-200";
      case "media":
        return "bg-blue-100 text-blue-700 hover:bg-blue-200";
      case "alta":
        return "bg-red-100 text-red-700 hover:bg-red-200";
      default:
        return "bg-gray-100 text-gray-700 hover:bg-gray-200";
    }
  };

  const isExpired = note.prazo && new Date(note.prazo) < new Date() && !note.concluida;

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`group relative ${isDragging ? 'z-50' : ''}`}
      data-testid={`card-note-${note.id}`}
    >
      <Card 
        className={`transition-all hover:shadow-lg ${
          note.concluida ? "opacity-60 bg-gray-50" : ""
        } ${isExpired ? "border-red-400" : ""}`}
        style={{ borderLeftColor: note.cor || '#4F46E5', borderLeftWidth: '4px' }}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`drag-handle-${note.id}`}
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
            
            <button
              onClick={() => onToggle(note.id)}
              className="mt-1 transition-colors"
              data-testid={`button-toggle-${note.id}`}
            >
              {note.concluida ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className={`font-semibold text-gray-900 ${
                    note.concluida ? "line-through" : ""
                  }`}>
                    {note.titulo}
                  </h3>
                  {note.descricao && (
                    <p className="text-sm text-gray-600 mt-1">{note.descricao}</p>
                  )}
                </div>
                
                <div className="flex gap-1">
                  <Badge 
                    variant="secondary" 
                    className={getPriorityBadgeColor(note.prioridade)}
                    data-testid={`badge-priority-${note.id}`}
                  >
                    {note.prioridade}
                  </Badge>
                  {note.categoria && (
                    <Badge variant="outline" data-testid={`badge-category-${note.id}`}>
                      {note.categoria}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  {note.prazo && (
                    <div className={`flex items-center gap-1 ${
                      isExpired ? "text-red-600 font-medium" : ""
                    }`}>
                      {isExpired && <AlertCircle className="h-3 w-3" />}
                      <Calendar className="h-3 w-3" />
                      <span data-testid={`text-deadline-${note.id}`}>
                        {format(new Date(note.prazo), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  <span data-testid={`text-created-${note.id}`}>
                    Criado em {format(new Date(note.criadoEm), "dd/MM", { locale: ptBR })}
                  </span>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(note)}
                    data-testid={`button-edit-${note.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(note.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`button-delete-${note.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Anotacoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Anotacao | null>(null);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    prioridade: "media",
    cor: "#4F46E5",
    categoria: "",
    prazo: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: notes = [], isLoading } = useQuery<Anotacao[]>({
    queryKey: ["/api/anotacoes"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/anotacoes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anotacoes"] });
      toast({
        title: "Sucesso",
        description: "Anotação criada com sucesso!",
      });
      setIsOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar anotação",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      return await apiRequest("PUT", `/api/anotacoes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anotacoes"] });
      toast({
        title: "Sucesso",
        description: "Anotação atualizada com sucesso!",
      });
      setIsOpen(false);
      setEditingNote(null);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar anotação",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/anotacoes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anotacoes"] });
      toast({
        title: "Sucesso",
        description: "Anotação deletada com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao deletar anotação",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const note = notes.find(n => n.id === id);
      if (!note) return;
      
      return await apiRequest("PUT", `/api/anotacoes/${id}`, { concluida: !note.concluida });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anotacoes"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return await apiRequest("PUT", "/api/anotacoes/reorder", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anotacoes"] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = notes.findIndex((note) => note.id === active.id);
      const newIndex = notes.findIndex((note) => note.id === over.id);
      
      const newOrder = arrayMove(notes, oldIndex, newIndex);
      queryClient.setQueryData(["/api/anotacoes"], newOrder);
      
      reorderMutation.mutate(newOrder.map(note => note.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingNote) {
      updateMutation.mutate({ 
        id: editingNote.id, 
        data: formData 
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (note: Anotacao) => {
    setEditingNote(note);
    setFormData({
      titulo: note.titulo,
      descricao: note.descricao || "",
      prioridade: note.prioridade,
      cor: note.cor || "#4F46E5",
      categoria: note.categoria || "",
      prazo: note.prazo ? format(new Date(note.prazo), "yyyy-MM-dd") : "",
    });
    setIsOpen(true);
  };

  const resetForm = () => {
    setFormData({
      titulo: "",
      descricao: "",
      prioridade: "media",
      cor: "#4F46E5",
      categoria: "",
      prazo: "",
    });
    setEditingNote(null);
  };

  const colors = [
    "#4F46E5", // Indigo
    "#EF4444", // Red
    "#10B981", // Green
    "#F59E0B", // Amber
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#6B7280", // Gray
  ];

  const pendingNotes = notes.filter(note => !note.concluida);
  const completedNotes = notes.filter(note => note.concluida);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Anotações</h1>
          <p className="text-gray-600 mt-1">Organize suas tarefas e lembretes</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            resetForm();
            setEditingNote(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-new-note">
              <Plus className="h-4 w-4" />
              Nova Anotação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingNote ? "Editar Anotação" : "Nova Anotação"}
                </DialogTitle>
                <DialogDescription>
                  {editingNote ? "Edite os detalhes da sua anotação" : "Adicione uma nova anotação para não esquecer"}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="titulo">Título *</Label>
                  <Input
                    id="titulo"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Digite o título da anotação"
                    required
                    data-testid="input-title"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Adicione mais detalhes (opcional)"
                    rows={3}
                    data-testid="input-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="prioridade">Prioridade</Label>
                    <Select
                      value={formData.prioridade}
                      onValueChange={(value) => setFormData({ ...formData, prioridade: value })}
                    >
                      <SelectTrigger id="prioridade" data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Input
                      id="categoria"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      placeholder="Ex: Trabalho, Pessoal"
                      data-testid="input-category"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="prazo">Prazo</Label>
                  <Input
                    id="prazo"
                    type="date"
                    value={formData.prazo}
                    onChange={(e) => setFormData({ ...formData, prazo: e.target.value })}
                    data-testid="input-deadline"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    {colors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          formData.cor === color ? "scale-110 border-gray-400" : "border-gray-200"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, cor: color })}
                        data-testid={`button-color-${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingNote ? "Salvar Alterações" : "Criar Anotação"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : notes.length === 0 ? (
        <Card className="bg-gray-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma anotação encontrada</h3>
            <p className="text-gray-600 text-center max-w-sm">
              Comece criando sua primeira anotação para organizar suas tarefas e lembretes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingNotes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Circle className="h-5 w-5" />
                Pendentes ({pendingNotes.length})
              </h2>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pendingNotes.map(note => note.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="grid gap-3">
                    {pendingNotes.map((note) => (
                      <SortableNote
                        key={note.id}
                        note={note}
                        onToggle={toggleMutation.mutate}
                        onEdit={handleEdit}
                        onDelete={deleteMutation.mutate}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {completedNotes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Concluídas ({completedNotes.length})
              </h2>
              <div className="grid gap-3">
                {completedNotes.map((note) => (
                  <SortableNote
                    key={note.id}
                    note={note}
                    onToggle={toggleMutation.mutate}
                    onEdit={handleEdit}
                    onDelete={deleteMutation.mutate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}