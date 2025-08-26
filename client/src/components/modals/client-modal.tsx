import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Plus, Trash2, Edit, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { Cliente, Ponto, Pagamento } from '@/types';

const clienteSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  telefone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  tipo: z.enum(['regular', 'familia']),
  vencimento: z.string().optional(),
  status: z.enum(['ativo', 'inativo', 'suspenso']),
  observacoes: z.string().optional(),
  indicadoPor: z.string().optional(),
});

const pontoSchema = z.object({
  aplicativo: z.enum(['ibo_pro', 'ibo_player', 'shamel']),
  dispositivo: z.enum(['smart_tv', 'tv_box', 'celular', 'notebook']),
  usuario: z.string().min(3, 'Usuário deve ter pelo menos 3 caracteres'),
  senha: z.string().min(4, 'Senha deve ter pelo menos 4 caracteres'),
  expiracao: z.string(),
  macAddress: z.string().optional(),
  deviceKey: z.string().optional(),
  descricao: z.string().optional(),
});

type ClienteForm = z.infer<typeof clienteSchema>;
type PontoForm = z.infer<typeof pontoSchema>;

interface ClientModalProps {
  cliente?: Cliente;
  isOpen: boolean;
  onClose: () => void;
}

export function ClientModal({ cliente, isOpen, onClose }: ClientModalProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [editingPonto, setEditingPonto] = useState<Ponto | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Função para formatar telefone brasileiro
  const formatPhoneNumber = (value: string) => {
    // Remove tudo que não é número
    let phone = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos (sem código do país)
    if (phone.length > 11) {
      phone = phone.slice(0, 11);
    }
    
    // Aplica a formatação
    if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (phone.length === 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (phone.length > 6) {
      return phone.replace(/(\d{2})(\d{4,5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    } else if (phone.length > 2) {
      return phone.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    } else if (phone.length > 0) {
      return phone.replace(/(\d{0,2})/, '($1');
    }
    
    return phone;
  };

  const clienteForm = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome: cliente?.nome || '',
      telefone: cliente?.telefone ? formatPhoneNumber(cliente.telefone) : '',
      tipo: cliente?.tipo || 'regular',
      vencimento: cliente?.vencimento?.split('T')[0] || '',
      status: cliente?.status || 'ativo',
      observacoes: cliente?.observacoes || '',
      indicadoPor: cliente?.indicadoPor || '',
    },
  });

  const pontoForm = useForm<PontoForm>({
    resolver: zodResolver(pontoSchema),
    defaultValues: {
      aplicativo: 'ibo_pro',
      dispositivo: 'smart_tv',
      usuario: '',
      senha: '',
      expiracao: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      macAddress: '',
      deviceKey: '',
      descricao: '',
    },
  });

  const { data: pontos } = useQuery({
    queryKey: ['/api/clientes', cliente?.id, 'pontos'],
    queryFn: () => api.getPontos(cliente!.id),
    enabled: !!cliente,
  });

  const { data: pagamentos } = useQuery({
    queryKey: ['/api/clientes', cliente?.id, 'pagamentos'],
    queryFn: () => api.getPagamentos(cliente!.id),
    enabled: !!cliente,
  });

  const updateClienteMutation = useMutation({
    mutationFn: (data: ClienteForm) => api.updateCliente(cliente!.id, data),
    onSuccess: () => {
      toast({ title: 'Cliente atualizado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      onClose();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar cliente', variant: 'destructive' });
    },
  });

  const createClienteMutation = useMutation({
    mutationFn: (data: ClienteForm) => api.createCliente(data),
    onSuccess: () => {
      toast({ title: 'Cliente criado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      onClose();
    },
    onError: () => {
      toast({ title: 'Erro ao criar cliente', variant: 'destructive' });
    },
  });

  const createPontoMutation = useMutation({
    mutationFn: (data: PontoForm) => api.createPonto(cliente!.id, { ...data, syncWithApi: true }),
    onSuccess: () => {
      toast({ title: 'Ponto criado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes', cliente?.id, 'pontos'] });
      pontoForm.reset();
    },
    onError: () => {
      toast({ title: 'Erro ao criar ponto', variant: 'destructive' });
    },
  });

  const updatePontoMutation = useMutation({
    mutationFn: (data: PontoForm) => api.updatePonto(editingPonto!.id, { ...data, syncWithApi: true }),
    onSuccess: () => {
      toast({ title: 'Ponto atualizado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes', cliente?.id, 'pontos'] });
      setEditingPonto(null);
      pontoForm.reset();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar ponto', variant: 'destructive' });
    },
  });

  const deletePontoMutation = useMutation({
    mutationFn: (id: number) => api.deletePonto(id),
    onSuccess: () => {
      toast({ title: 'Ponto excluído com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes', cliente?.id, 'pontos'] });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir ponto', variant: 'destructive' });
    },
  });

  const createPagamentoMutation = useMutation({
    mutationFn: (data: { valor: string; descricao: string }) => api.createPagamento(cliente!.id, data),
    onSuccess: () => {
      toast({ title: 'Pagamento PIX criado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes', cliente?.id, 'pagamentos'] });
    },
    onError: () => {
      toast({ title: 'Erro ao criar pagamento', variant: 'destructive' });
    },
  });

  const onSubmitCliente = (data: ClienteForm) => {
    // Remove formatação do telefone antes de salvar
    const cleanedData = {
      ...data,
      telefone: data.telefone.replace(/\D/g, '')
    };
    
    // Ajustar vencimento para 23:59:59 se fornecido
    if (data.vencimento) {
      const vencimentoDate = new Date(data.vencimento);
      vencimentoDate.setHours(23, 59, 59, 999);
      cleanedData.vencimento = vencimentoDate.toISOString();
    }
    
    if (cliente) {
      updateClienteMutation.mutate(cleanedData);
    } else {
      createClienteMutation.mutate(cleanedData);
    }
  };

  const onSubmitPonto = (data: PontoForm) => {
    if (editingPonto) {
      updatePontoMutation.mutate(data);
    } else {
      createPontoMutation.mutate(data);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado para a área de transferência!' });
  };

  const handleEditPonto = (ponto: Ponto) => {
    setEditingPonto(ponto);
    pontoForm.setValue('aplicativo', ponto.aplicativo);
    pontoForm.setValue('dispositivo', ponto.dispositivo);
    pontoForm.setValue('usuario', ponto.usuario);
    pontoForm.setValue('senha', ponto.senha);
    pontoForm.setValue('expiracao', ponto.expiracao.split('T')[0]);
    pontoForm.setValue('macAddress', ponto.macAddress || '');
    pontoForm.setValue('deviceKey', ponto.deviceKey || '');
    pontoForm.setValue('descricao', ponto.descricao || '');
  };

  const handleGeneratePix = () => {
    // Calculate total value from pontos
    const totalValue = pontos?.reduce((sum, ponto) => {
      return sum + parseFloat(ponto.valor || '0');
    }, 0) || 0;
    
    createPagamentoMutation.mutate({
      valor: totalValue.toFixed(2),
      descricao: `Pagamento ${cliente?.nome || 'Cliente'}`
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      ativo: 'bg-green-500/20 text-green-400',
      inativo: 'bg-red-500/20 text-red-400',
      suspenso: 'bg-yellow-500/20 text-yellow-400',
      pago: 'bg-green-500/20 text-green-400',
      pendente: 'bg-yellow-500/20 text-yellow-400',
      cancelado: 'bg-red-500/20 text-red-400',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${cliente ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto bg-dark-card border-slate-600`}>
        <DialogHeader>
          <DialogTitle className="text-white">
            {cliente ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>

        {cliente ? (
          // Modo edição: mostra tabs
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="pontos">Pontos</TabsTrigger>
              <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <form onSubmit={clienteForm.handleSubmit(onSubmitCliente)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    {...clienteForm.register('nome')}
                    placeholder="Nome do cliente"
                    className="bg-dark-surface border-slate-600"
                  />
                  {clienteForm.formState.errors.nome && (
                    <p className="text-red-400 text-sm">{clienteForm.formState.errors.nome.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    {...clienteForm.register('telefone')}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      clienteForm.setValue('telefone', formatted);
                    }}
                    value={clienteForm.watch('telefone')}
                    placeholder="(00) 00000-0000"
                    className="bg-dark-surface border-slate-600"
                  />
                  {clienteForm.formState.errors.telefone && (
                    <p className="text-red-400 text-sm">{clienteForm.formState.errors.telefone.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={clienteForm.watch('tipo')} onValueChange={(value) => clienteForm.setValue('tipo', value as 'regular' | 'familia')}>
                    <SelectTrigger className="bg-dark-surface border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="familia">Família</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={clienteForm.watch('status')} onValueChange={(value) => clienteForm.setValue('status', value as 'ativo' | 'inativo' | 'suspenso')}>
                    <SelectTrigger className="bg-dark-surface border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="vencimento">Vencimento</Label>
                  <Input
                    id="vencimento"
                    type="date"
                    {...clienteForm.register('vencimento')}
                    className="bg-dark-surface border-slate-600"
                  />
                </div>

                <div>
                  <Label htmlFor="indicadoPor">Código de Indicação (Opcional)</Label>
                  <Input
                    id="indicadoPor"
                    {...clienteForm.register('indicadoPor')}
                    placeholder="Telefone de quem indicou"
                    className="bg-dark-surface border-slate-600"
                  />
                  <p className="text-xs text-gray-400 mt-1">Use o telefone de um cliente existente como código</p>
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  {...clienteForm.register('observacoes')}
                  className="bg-dark-surface border-slate-600"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateClienteMutation.isPending || createClienteMutation.isPending}>
                  {cliente ? 'Atualizar' : 'Criar'} Cliente
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="pontos" className="space-y-4">
            <Card className="bg-dark-surface border-slate-600">
              <CardHeader>
                <CardTitle className="text-white">Adicionar Ponto</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={pontoForm.handleSubmit(onSubmitPonto)} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="aplicativo">Aplicativo</Label>
                      <Select value={pontoForm.watch('aplicativo')} onValueChange={(value) => pontoForm.setValue('aplicativo', value as 'ibo_pro' | 'ibo_player' | 'shamel')}>
                        <SelectTrigger className="bg-dark-card border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ibo_pro">IBO Pro</SelectItem>
                          <SelectItem value="ibo_player">IBO Player</SelectItem>
                          <SelectItem value="shamel">Shamel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="dispositivo">Dispositivo</Label>
                      <Select value={pontoForm.watch('dispositivo')} onValueChange={(value) => pontoForm.setValue('dispositivo', value as 'smart_tv' | 'tv_box' | 'celular' | 'notebook')}>
                        <SelectTrigger className="bg-dark-card border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="smart_tv">Smart TV</SelectItem>
                          <SelectItem value="tv_box">TV Box</SelectItem>
                          <SelectItem value="celular">Celular</SelectItem>
                          <SelectItem value="notebook">Notebook</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="expiracao">Expiração</Label>
                      <Input
                        id="expiracao"
                        type="date"
                        {...pontoForm.register('expiracao')}
                        className="bg-dark-card border-slate-600"
                      />
                    </div>

                    <div>
                      <Label htmlFor="usuario">Usuário</Label>
                      <div className="flex">
                        <Input
                          id="usuario"
                          {...pontoForm.register('usuario')}
                          className="bg-dark-card border-slate-600 rounded-r-none"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-l-none"
                          onClick={() => copyToClipboard(pontoForm.getValues('usuario'))}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="senha">Senha</Label>
                      <div className="flex">
                        <Input
                          id="senha"
                          type="password"
                          {...pontoForm.register('senha')}
                          className="bg-dark-card border-slate-600 rounded-r-none"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-l-none"
                          onClick={() => copyToClipboard(pontoForm.getValues('senha'))}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="macAddress">MAC Address</Label>
                      <Input
                        id="macAddress"
                        {...pontoForm.register('macAddress')}
                        className="bg-dark-card border-slate-600"
                        placeholder="00:00:00:00:00:00"
                      />
                    </div>

                    <div>
                      <Label htmlFor="deviceKey">Device Key</Label>
                      <Input
                        id="deviceKey"
                        {...pontoForm.register('deviceKey')}
                        className="bg-dark-card border-slate-600"
                      />
                    </div>

                    <div>
                      <Label htmlFor="descricao">Descrição</Label>
                      <Input
                        id="descricao"
                        {...pontoForm.register('descricao')}
                        className="bg-dark-card border-slate-600"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={createPontoMutation.isPending || updatePontoMutation.isPending}>
                    <Plus className="w-4 h-4 mr-2" />
                    {editingPonto ? 'Atualizar' : 'Adicionar'} Ponto
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {pontos?.map((ponto) => (
                <Card key={ponto.id} className="bg-dark-surface border-slate-600">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="grid grid-cols-2 gap-4 flex-1">
                        <div>
                          <p className="text-sm text-slate-400">Aplicativo</p>
                          <p className="font-medium">{ponto.aplicativo}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Dispositivo</p>
                          <p className="font-medium">{ponto.dispositivo}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Usuário</p>
                          <p className="font-medium">{ponto.usuario}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Expiração</p>
                          <p className="font-medium">{new Date(ponto.expiracao).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Status</p>
                          <Badge className={getStatusBadge(ponto.status)}>
                            {ponto.status}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Último Acesso</p>
                          <p className="font-medium">
                            {ponto.ultimoAcesso 
                              ? new Date(ponto.ultimoAcesso).toLocaleDateString('pt-BR')
                              : 'Nunca'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPonto(ponto)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePontoMutation.mutate(ponto.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pagamentos" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Histórico de Pagamentos</h3>
              <Button onClick={handleGeneratePix} disabled={createPagamentoMutation.isPending}>
                <Plus className="w-4 h-4 mr-2" />
                Gerar PIX
              </Button>
            </div>

            <div className="space-y-4">
              {pagamentos?.map((pagamento) => (
                <Card key={pagamento.id} className="bg-dark-surface border-slate-600">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">PIX #{pagamento.pixId || pagamento.id}</p>
                          <Badge className={getStatusBadge(pagamento.status)}>
                            {pagamento.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-400">Valor</p>
                            <p>R$ {pagamento.valor}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Data</p>
                            <p>{new Date(pagamento.dataCriacao).toLocaleDateString('pt-BR')}</p>
                          </div>
                          {pagamento.dataVencimento && (
                            <div>
                              <p className="text-slate-400">Vencimento</p>
                              <p>{new Date(pagamento.dataVencimento).toLocaleDateString('pt-BR')}</p>
                            </div>
                          )}
                          {pagamento.dataPagamento && (
                            <div>
                              <p className="text-slate-400">Pago em</p>
                              <p>{new Date(pagamento.dataPagamento).toLocaleDateString('pt-BR')}</p>
                            </div>
                          )}
                        </div>
                        {pagamento.qrCode && (
                          <div className="mt-2">
                            <p className="text-slate-400 text-sm">Código PIX</p>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs bg-dark-card p-2 rounded flex-1 overflow-x-auto">
                                {pagamento.qrCode}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(pagamento.qrCode!)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
        ) : (
          // Modo criação: mostra apenas o formulário
          <form onSubmit={clienteForm.handleSubmit(onSubmitCliente)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  {...clienteForm.register('nome')}
                  placeholder="Nome do cliente"
                  className="bg-dark-surface border-slate-600"
                />
                {clienteForm.formState.errors.nome && (
                  <p className="text-red-400 text-sm">{clienteForm.formState.errors.nome.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  {...clienteForm.register('telefone')}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    clienteForm.setValue('telefone', formatted);
                  }}
                  value={clienteForm.watch('telefone')}
                  placeholder="(00) 00000-0000"
                  className="bg-dark-surface border-slate-600"
                />
                {clienteForm.formState.errors.telefone && (
                  <p className="text-red-400 text-sm">{clienteForm.formState.errors.telefone.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={clienteForm.watch('tipo')} onValueChange={(value) => clienteForm.setValue('tipo', value as 'regular' | 'familia')}>
                  <SelectTrigger className="bg-dark-surface border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="familia">Família</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={clienteForm.watch('status')} onValueChange={(value) => clienteForm.setValue('status', value as 'ativo' | 'inativo' | 'suspenso')}>
                  <SelectTrigger className="bg-dark-surface border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="vencimento">Vencimento</Label>
                <Input
                  id="vencimento"
                  type="date"
                  {...clienteForm.register('vencimento')}
                  className="bg-dark-surface border-slate-600"
                />
              </div>

              <div>
                <Label htmlFor="indicadoPor">Código de Indicação (Opcional)</Label>
                <Input
                  id="indicadoPor"
                  {...clienteForm.register('indicadoPor')}
                  placeholder="Telefone de quem indicou"
                  className="bg-dark-surface border-slate-600"
                />
                <p className="text-xs text-gray-400 mt-1">Use o telefone de um cliente existente como código</p>
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                {...clienteForm.register('observacoes')}
                className="bg-dark-surface border-slate-600"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createClienteMutation.isPending}>
                Criar Cliente
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
