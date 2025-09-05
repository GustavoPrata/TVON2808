import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Plus, Copy, Trash2, Eye, EyeOff, Server, 
  Check, X, Edit2, Save, Calendar, User, Key
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const createCredencialSchema = z.object({
  usuario: z.string().min(3, 'Usuário deve ter no mínimo 3 caracteres'),
  senha: z.string().min(4, 'Senha deve ter no mínimo 4 caracteres'),
  servidor: z.string().optional(),
  porta: z.string().optional(),
  tipo: z.enum(['iptv', 'vod', 'series']).optional(),
  observacoes: z.string().optional(),
});

type CreateCredencialFormData = z.infer<typeof createCredencialSchema>;

export default function CredenciaisIptv() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todas' | 'disponivel' | 'em_uso' | 'expirado'>('todas');
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreateCredencialFormData>({
    resolver: zodResolver(createCredencialSchema),
    defaultValues: {
      usuario: '',
      senha: '',
      servidor: '',
      porta: '',
      tipo: 'iptv',
      observacoes: '',
    },
  });

  // Query credenciais
  const { data: credenciais, isLoading } = useQuery({
    queryKey: ['/api/credenciais-iptv'],
  });

  // Criar credencial
  const createCredencialMutation = useMutation({
    mutationFn: async (data: CreateCredencialFormData) => {
      return await apiRequest('/api/credenciais-iptv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Credencial adicionada',
        description: 'A credencial foi adicionada com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/credenciais-iptv'] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adicionar credencial',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Deletar credencial
  const deleteCredencialMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/credenciais-iptv/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Credencial removida',
        description: 'A credencial foi removida com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/credenciais-iptv'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover credencial',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Atualizar status da credencial
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest(`/api/credenciais-iptv/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/credenciais-iptv'] });
    },
  });

  const filteredCredenciais = credenciais?.filter((cred: any) => {
    const matchesSearch = searchTerm === '' || 
      cred.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cred.servidor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cred.observacoes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'todas' || cred.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const togglePassword = (id: number) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponivel': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'em_uso': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'expirado': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'disponivel': return 'Disponível';
      case 'em_uso': return 'Em Uso';
      case 'expirado': return 'Expirado';
      default: return status;
    }
  };

  const handleSubmit = (data: CreateCredencialFormData) => {
    createCredencialMutation.mutate(data);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/30">
              <Server className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Credenciais IPTV
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {filteredCredenciais?.length || 0} credenciais cadastradas
              </p>
            </div>
          </div>
          <Button 
            size="lg"
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold px-6 shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Credencial
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por usuário, servidor ou observações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-400"
          />
        </div>
        
        <div className="flex bg-dark-bg border border-slate-700 rounded-lg p-1">
          {(['todas', 'disponivel', 'em_uso', 'expirado'] as const).map((status) => (
            <Button
              key={status}
              variant="ghost"
              size="sm"
              onClick={() => setFilterStatus(status)}
              className={`
                transition-all duration-200 font-medium
                ${filterStatus === status 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white' 
                  : 'text-slate-400'
                }
              `}
            >
              {status === 'todas' ? 'Todas' : getStatusLabel(status)}
            </Button>
          ))}
        </div>
      </div>

      {/* Lista de Credenciais */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : filteredCredenciais?.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-700">
          <div className="p-12 text-center">
            <Server className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              Nenhuma credencial encontrada
            </h3>
            <p className="text-sm text-slate-500">
              Adicione credenciais IPTV geradas pela sua automação externa
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCredenciais?.map((cred: any) => (
            <Card key={cred.id} className="bg-slate-900/50 border-slate-700 hover:border-slate-600 transition-all">
              <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(cred.status)}>
                      {getStatusLabel(cred.status)}
                    </Badge>
                    {cred.tipo && (
                      <Badge variant="outline" className="text-slate-400">
                        {cred.tipo.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteCredencialMutation.mutate(cred.id)}
                    className="text-red-400 hover:text-red-300 -mr-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Credenciais */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-mono">{cred.usuario}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(cred.usuario, 'Usuário')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-mono">
                        {showPasswords[cred.id] ? cred.senha : '••••••••'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => togglePassword(cred.id)}
                      >
                        {showPasswords[cred.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(cred.senha, 'Senha')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Servidor e Porta */}
                {(cred.servidor || cred.porta) && (
                  <div className="text-sm text-slate-400">
                    {cred.servidor && (
                      <div className="flex items-center gap-2">
                        <Server className="w-3 h-3" />
                        <span>{cred.servidor}{cred.porta ? `:${cred.porta}` : ''}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Observações */}
                {cred.observacoes && (
                  <div className="text-sm text-slate-500 italic">
                    {cred.observacoes}
                  </div>
                )}

                {/* Informações de uso */}
                {cred.usadoPor && (
                  <div className="pt-2 border-t border-slate-700/50 text-xs text-slate-400">
                    <div>Usado por: {cred.usadoPor}</div>
                    {cred.dataUso && (
                      <div>
                        Desde: {format(new Date(cred.dataUso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    )}
                  </div>
                )}

                {/* Data de criação */}
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Adicionado em {format(new Date(cred.dataGeracao), "dd/MM/yyyy", { locale: ptBR })}
                </div>

                {/* Ações rápidas */}
                {cred.status === 'disponivel' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-yellow-400 border-yellow-500/50"
                      onClick={() => updateStatusMutation.mutate({ id: cred.id, status: 'em_uso' })}
                    >
                      Marcar como Em Uso
                    </Button>
                  </div>
                )}
                {cred.status === 'em_uso' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-green-400 border-green-500/50"
                      onClick={() => updateStatusMutation.mutate({ id: cred.id, status: 'disponivel' })}
                    >
                      Liberar
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para criar credencial */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Credencial IPTV</DialogTitle>
            <DialogDescription>
              Adicione as credenciais geradas pela sua automação
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="usuario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuário</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="senha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="servidor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Servidor (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="http://servidor.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="porta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porta (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="8080" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="iptv">IPTV</SelectItem>
                        <SelectItem value="vod">VOD</SelectItem>
                        <SelectItem value="series">Séries</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ex: Gerado em 01/01/2024, válido por 30 dias"
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createCredencialMutation.isPending}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                >
                  {createCredencialMutation.isPending ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}