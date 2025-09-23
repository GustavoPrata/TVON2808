import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Smartphone, Tv, Monitor, Laptop, Plus, Loader2, Copy, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const createTestSchema = z.object({
  telefone: z.string().min(10, 'Telefone deve ter no mínimo 10 dígitos'),
  aplicativo: z.enum(['shamel', 'ibo_pro', 'ibo_player']),
  dispositivo: z.enum(['celular', 'smart_tv', 'tv_box', 'notebook']),
  duracaoHoras: z.number().min(1).max(72),
  mac: z.string().min(1, 'MAC é obrigatório'),
  deviceKey: z.string().min(1, 'Device Key é obrigatório'),
});

type CreateTestFormData = z.infer<typeof createTestSchema>;

interface CreateTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhone?: string;
  sistemaId?: number | null;
  onTestCreated?: () => void;
}

export function CreateTestDialog({ open, onOpenChange, defaultPhone, sistemaId, onTestCreated }: CreateTestDialogProps) {
  const { toast } = useToast();
  const [selectedDevice, setSelectedDevice] = useState<string>('celular');
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{apiUsername: string; apiPassword: string} | null>(null);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);
  
  const form = useForm<CreateTestFormData>({
    resolver: zodResolver(createTestSchema),
    defaultValues: {
      telefone: '',
      aplicativo: 'ibo_pro',
      dispositivo: 'celular',
      duracaoHoras: 3,
      mac: '',
      deviceKey: '',
    },
  });

  // Update form when defaultPhone changes
  useEffect(() => {
    if (defaultPhone) {
      // Remove country code 55 if present
      let phone = defaultPhone;
      if (phone.startsWith('55')) {
        phone = phone.substring(2);
      }
      form.setValue('telefone', phone);
    }
  }, [defaultPhone, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateTestFormData) => {
      const response = await apiRequest('POST', '/api/testes', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar teste');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/testes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      
      // Display credentials immediately in modal if available
      if (data?.apiUsername && data?.apiPassword) {
        setCreatedCredentials({ apiUsername: data.apiUsername, apiPassword: data.apiPassword });
        setShowCredentialsModal(true);
        onOpenChange(false); // Close the create dialog
        form.reset();
        
        // Also show toast notification
        toast({
          title: '✅ Teste criado com sucesso!',
          description: 'As credenciais foram geradas e estão disponíveis para uso.',
          duration: 5000,
        });
      } else {
        toast({
          title: 'Teste criado',
          description: 'O teste foi criado com sucesso',
        });
        onOpenChange(false);
        form.reset();
      }
      
      onTestCreated?.(); // Call callback if provided
    },
    onError: (error: any) => {
      console.error('Erro ao criar teste:', error);
      toast({
        title: 'Erro ao criar teste',
        description: error.message || 'Ocorreu um erro ao criar o teste',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CreateTestFormData) => {
    // Validate MAC and key are provided for all device types
    if (!data.mac || !data.deviceKey) {
      toast({
        title: "Campos obrigatórios",
        description: "MAC e Device Key são obrigatórios para todos os dispositivos",
        variant: "destructive",
      });
      return;
    }
    
    // Remove phone formatting before sending
    const cleanData = {
      ...data,
      telefone: data.telefone.replace(/\D/g, ''), // Remove all non-digits
      ...(sistemaId && { sistemaId }) // Include sistemaId if available
    };
    
    console.log('Enviando dados para criar teste:', cleanData);
    createMutation.mutate(cleanData);
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const formatMAC = (value: string) => {
    // Remove all non-alphanumeric characters and convert to uppercase
    const mac = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    
    // Split into pairs and join with colons
    const pairs = [];
    for (let i = 0; i < mac.length && i < 12; i += 2) {
      if (i + 1 < mac.length) {
        pairs.push(mac.slice(i, i + 2));
      } else {
        pairs.push(mac.slice(i));
      }
    }
    
    return pairs.join(':');
  };

  const copyToClipboard = async (text: string, field: 'username' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: 'Copiado!',
        description: `${field === 'username' ? 'Usuário' : 'Senha'} copiada para a área de transferência`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o texto',
        variant: 'destructive',
      });
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'celular':
        return <Smartphone className="w-8 h-8" />;
      case 'smart_tv':
      case 'tv_box':
        return <Tv className="w-8 h-8" />;
      case 'notebook':
        return <Laptop className="w-8 h-8" />;
      default:
        return <Monitor className="w-8 h-8" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-dark-bg border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            Criar Novo Teste
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="dispositivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Dispositivo</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedDevice(value);
                      }}
                      className="grid grid-cols-2 gap-3"
                    >
                      {[
                        { value: 'celular', label: 'Celular' },
                        { value: 'smart_tv', label: 'Smart TV' },
                        { value: 'tv_box', label: 'TV Box' },
                        { value: 'notebook', label: 'Notebook' },
                      ].map(({ value, label }) => (
                        <label
                          key={value}
                          className={`
                            flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                            ${field.value === value 
                              ? 'border-blue-500 bg-gradient-to-r from-blue-500/10 to-purple-500/10' 
                              : 'border-slate-700 hover:border-slate-600'
                            }
                          `}
                        >
                          <RadioGroupItem value={value} className="sr-only" />
                          <div className={`
                            transition-colors
                            ${field.value === value ? 'text-blue-400' : 'text-slate-400'}
                          `}>
                            {getDeviceIcon(value)}
                          </div>
                          <span className={`
                            font-medium
                            ${field.value === value ? 'text-white' : 'text-slate-300'}
                          `}>
                            {label}
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="aplicativo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aplicativo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-900 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="shamel">Shamel</SelectItem>
                      <SelectItem value="ibo_pro">IBO Pro</SelectItem>
                      <SelectItem value="ibo_player">IBO Player</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duracaoHoras"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração do Teste</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      className="grid grid-cols-3 gap-2"
                    >
                      {[1, 3, 6, 12, 24, 72].map((hours) => (
                        <label
                          key={hours}
                          className={`
                            text-center p-3 rounded-lg border-2 cursor-pointer transition-all
                            ${field.value === hours 
                              ? 'border-blue-500 bg-gradient-to-r from-blue-500/10 to-purple-500/10' 
                              : 'border-slate-700 hover:border-slate-600'
                            }
                          `}
                        >
                          <RadioGroupItem value={hours.toString()} className="sr-only" />
                          <span className={`
                            font-medium
                            ${field.value === hours ? 'text-white' : 'text-slate-300'}
                          `}>
                            {hours === 72 ? '3 dias' : `${hours}h`}
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mac"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MAC Address <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="00:00:00:00:00:00"
                      className="bg-slate-900 border-slate-700 font-mono"
                      onChange={(e) => {
                        const formatted = formatMAC(e.target.value);
                        field.onChange(formatted);
                      }}
                      maxLength={17}
                      required
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deviceKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device Key <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Device key"
                      className="bg-slate-900 border-slate-700"
                      required
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Teste
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Credentials Modal */}
    <AlertDialog open={showCredentialsModal} onOpenChange={setShowCredentialsModal}>
      <AlertDialogContent className="sm:max-w-[500px] bg-dark-bg border-slate-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-semibold flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            Teste Criado com Sucesso!
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            Suas credenciais de acesso foram geradas. Guarde-as em local seguro.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {createdCredentials && (
          <div className="space-y-4 my-4">
            <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
              {/* Username */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <span className="text-sm text-slate-400 font-medium block mb-1">USUÁRIO:</span>
                  <code className="px-3 py-2 bg-slate-800 rounded text-blue-400 font-mono block">
                    {createdCredentials.apiUsername}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(createdCredentials.apiUsername, 'username')}
                  className="ml-2"
                >
                  {copiedField === 'username' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </Button>
              </div>
              
              {/* Password */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="text-sm text-slate-400 font-medium block mb-1">SENHA:</span>
                  <code className="px-3 py-2 bg-slate-800 rounded text-blue-400 font-mono block">
                    {createdCredentials.apiPassword}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(createdCredentials.apiPassword, 'password')}
                  className="ml-2"
                >
                  {copiedField === 'password' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <span className="text-yellow-500 text-sm">⚠️</span>
              <p className="text-xs text-yellow-500">
                Importante: Essas credenciais foram enviadas para o seu e-mail. 
                Guarde-as com segurança pois não poderão ser recuperadas.
              </p>
            </div>
          </div>
        )}
        
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={() => {
              setShowCredentialsModal(false);
              setCreatedCredentials(null);
              setCopiedField(null);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Entendi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}