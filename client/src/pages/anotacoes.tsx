import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Circle, GripVertical, Plus, Trash2, StickyNote } from "lucide-react";
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
  onDelete: (id: number) => void;
}

function SortableNote({ note, onToggle, onDelete }: SortableNoteProps) {
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

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`group relative ${isDragging ? 'z-50' : ''}`}
      data-testid={`card-note-${note.id}`}
    >
      <Card 
        className={`transition-all hover:shadow-lg bg-slate-800 border-slate-700 ${
          note.concluida ? "opacity-60" : ""
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`drag-handle-${note.id}`}
            >
              <GripVertical className="h-4 w-4 text-slate-400" />
            </div>
            
            <button
              onClick={() => onToggle(note.id)}
              className="transition-colors"
              data-testid={`button-toggle-${note.id}`}
            >
              {note.concluida ? (
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              ) : (
                <Circle className="h-5 w-5 text-slate-400 hover:text-slate-300" />
              )}
            </button>

            <div className="flex-1">
              <p className={`text-white ${note.concluida ? "line-through opacity-60" : ""}`}>
                {note.titulo}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {format(new Date(note.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(note.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/10"
              data-testid={`button-delete-${note.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Anotacoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");

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
    mutationFn: async (titulo: string) => {
      return await apiRequest("POST", "/api/anotacoes", { 
        titulo,
        prioridade: "media"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anotacoes"] });
      toast({
        title: "Anotação criada",
        description: "Sua anotação foi salva com sucesso.",
      });
      setNewNote("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar anotação",
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
        title: "Anotação removida",
        description: "A anotação foi deletada com sucesso.",
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
    if (newNote.trim()) {
      createMutation.mutate(newNote.trim());
    }
  };

  const pendingNotes = notes.filter(note => !note.concluida);
  const completedNotes = notes.filter(note => note.concluida);

  return (
    <div className="space-y-6">
      {/* Beautiful Header - igual ao site */}
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <StickyNote className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Anotações
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {pendingNotes.length} {pendingNotes.length === 1 ? 'anotação pendente' : 'anotações pendentes'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Input Form - Simples e Rápido */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Digite uma nova anotação e pressione Enter..."
          className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
          data-testid="input-new-note"
        />
        <Button 
          type="submit"
          disabled={!newNote.trim() || createMutation.isPending}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
          data-testid="button-add-note"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </form>

      {/* Notes List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : notes.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <StickyNote className="h-12 w-12 text-slate-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Nenhuma anotação ainda</h3>
            <p className="text-slate-400 text-center max-w-sm">
              Digite algo no campo acima para criar sua primeira anotação rápida.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pendentes */}
          {pendingNotes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Circle className="h-5 w-5 text-slate-400" />
                Pendentes
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
                  <div className="grid gap-2">
                    {pendingNotes.map((note) => (
                      <SortableNote
                        key={note.id}
                        note={note}
                        onToggle={toggleMutation.mutate}
                        onDelete={deleteMutation.mutate}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Concluídas */}
          {completedNotes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                Concluídas
              </h2>
              <div className="grid gap-2">
                {completedNotes.map((note) => (
                  <SortableNote
                    key={note.id}
                    note={note}
                    onToggle={toggleMutation.mutate}
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