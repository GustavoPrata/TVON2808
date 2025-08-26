import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const createClientSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().min(10, 'Telefone deve ter no mínimo 10 dígitos'),
  tipo: z.enum(['regular', 'premium']),
  status: z.enum(['ativo', 'inativo']),
  vencimento: z.string().min(1, 'Vencimento é obrigatório'),
  observacoes: z.string().optional(),
  indicadoPor: z.string().optional(),
});

type CreateClientFormData = z.infer<typeof createClientSchema>;

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhone?: string;
  defaultIndicadoPor?: string;
  onClientCreated?: () => void;
}

export function CreateClientDialog({ open, onOpenChange, defaultPhone, defaultIndicadoPor, onClientCreated }: CreateClientDialogProps) {
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastPhone, setLastPhone] = useState<string>('');
  
  // Calculate default expiration (same day next month)
  const getDefaultVencimento = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    return format(nextMonth, 'yyyy-MM-dd');
  };
  
  const form = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      nome: '',
      telefone: '',
      tipo: 'regular',
      status: 'ativo',
      vencimento: getDefaultVencimento(),
      observacoes: '',
      indicadoPor: '',
    },
  });

  // Initialize form only when phone number changes (new conversation selected)
  useEffect(() => {
    if (defaultPhone && defaultPhone !== lastPhone) {
      // Remove country code 55 if present
      let phone = defaultPhone;
      if (phone.startsWith('55')) {
        phone = phone.substring(2);
      }
      
      // Only update phone and referral code, keep other fields
      form.setValue('telefone', phone);
      if (defaultIndicadoPor) {
        form.setValue('indicadoPor', defaultIndicadoPor);
      }
      
      setLastPhone(defaultPhone);
      setIsInitialized(true);
    }
  }, [defaultPhone, defaultIndicadoPor, lastPhone, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateClientFormData) => {
      const response = await apiRequest('POST', '/api/clientes', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar cliente');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
      toast({
        title: 'Cliente criado',
        description: 'O cliente foi cadastrado com sucesso',
      });
      
      // Reset form with default values for next client
      const phone = defaultPhone ? (defaultPhone.startsWith('55') ? defaultPhone.substring(2) : defaultPhone) : '';
      form.reset({
        nome: '',
        telefone: phone,
        tipo: 'regular',
        status: 'ativo',
        vencimento: getDefaultVencimento(),
        observacoes: '',
        indicadoPor: defaultIndicadoPor || '',
      });
      
      onClientCreated?.(); // Call callback if provided
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Erro ao criar cliente:', error);
      toast({
        title: 'Erro ao criar cliente',
        description: error.message || 'Ocorreu um erro ao criar o cliente',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CreateClientFormData) => {
    // Remove phone formatting before sending
    const cleanData = {
      ...data,
      telefone: data.telefone.replace(/\D/g, ''), // Remove all non-digits
    };
    
    // Ajustar vencimento para 23:59:59 se fornecido
    if (data.vencimento) {
      const vencimentoDate = new Date(data.vencimento);
      vencimentoDate.setHours(23, 59, 59, 999);
      cleanData.vencimento = vencimentoDate.toISOString();
    }
    
    console.log('Enviando dados para criar cliente:', cleanData);
    createMutation.mutate(cleanData);
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-dark-bg border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            Novo Cliente
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Nome do cliente"
                      className="bg-slate-900 border-slate-700"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="(00) 00000-0000"
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        field.onChange(formatted);
                      }}
                      className="bg-slate-900 border-slate-700"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="indicadoPor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de Indicação (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Telefone de quem indicou (00) 00000-0000"
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        field.onChange(formatted);
                      }}
                      className="bg-slate-900 border-slate-700"
                    />
                  </FormControl>
                  <p className="text-xs text-slate-400 mt-1">
                    Se este cliente foi indicado, informe o telefone de quem indicou
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-900 border-slate-700">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-900 border-slate-700">
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="vencimento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      className="bg-slate-900 border-slate-700"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Observações adicionais (opcional)"
                      className="bg-slate-900 border-slate-700 min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-700 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Criar Cliente
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}