import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, Loader2, AlertCircle, CheckCircle, Copy, User, Key } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const autoTestSchema = z.object({
  telefone: z.string().min(10, 'Telefone deve ter no mínimo 10 dígitos'),
  duracao: z.number().min(6).max(48),
  nota: z.string().optional(),
});

type AutoTestFormData = z.infer<typeof autoTestSchema>;

interface AutoTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTestCreated?: () => void;
}

export function AutoTestDialog({ open, onOpenChange, onTestCreated }: AutoTestDialogProps) {
  const { toast } = useToast();
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    usuario: string;
    senha: string;
  } | null>(null);

  const form = useForm<AutoTestFormData>({
    resolver: zodResolver(autoTestSchema),
    defaultValues: {
      telefone: '',
      duracao: 6,
      nota: '',
    },
  });

  const generateTestMutation = useMutation({
    mutationFn: async (data: AutoTestFormData) => {
      const response = await fetch('/api/testes/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Erro ao gerar teste');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.teste) {
        setGeneratedCredentials({
          usuario: data.teste.usuario,
          senha: data.teste.senha,
        });
        toast({
          title: 'Teste gerado com sucesso!',
          description: `Usuário: ${data.teste.usuario} - Senha: ${data.teste.senha}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/testes'] });
        onTestCreated?.();
        // Don't close immediately, let user see the credentials
        setTimeout(() => {
          onOpenChange(false);
          setGeneratedCredentials(null);
          form.reset();
        }, 5000);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao gerar teste',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: AutoTestFormData) => {
    setGeneratedCredentials(null);
    generateTestMutation.mutate(data);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado para a área de transferência!' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Gerar Teste Automático
          </DialogTitle>
          <DialogDescription>
            Gera automaticamente um teste IPTV usando automação Selenium
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="14999887766" 
                      {...field} 
                      disabled={generateTestMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Telefone do cliente (apenas números)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duracao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração do Teste</FormLabel>
                  <Select
                    value={field.value.toString()}
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    disabled={generateTestMutation.isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a duração" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="6">6 Horas</SelectItem>
                      <SelectItem value="12">12 Horas</SelectItem>
                      <SelectItem value="24">24 Horas</SelectItem>
                      <SelectItem value="48">48 Horas</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nota"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Cliente João - Teste Smart TV" 
                      {...field} 
                      disabled={generateTestMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Adicione uma observação para identificar este teste
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {generateTestMutation.isPending && (
              <Alert>
                <Loader2 className="w-4 h-4 animate-spin" />
                <AlertDescription>
                  Gerando teste automaticamente... Isso pode levar alguns segundos.
                </AlertDescription>
              </Alert>
            )}

            {generateTestMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {generateTestMutation.error?.message || 'Erro ao gerar teste'}
                </AlertDescription>
              </Alert>
            )}

            {generatedCredentials && (
              <Card className="bg-green-500/10 border-green-500/50">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Teste Gerado com Sucesso!</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-slate-900 rounded">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-mono">{generatedCredentials.usuario}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(generatedCredentials.usuario)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-slate-900 rounded">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-mono">{generatedCredentials.senha}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(generatedCredentials.senha)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={generateTestMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={generateTestMutation.isPending || !!generatedCredentials}
                className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700"
              >
                {generateTestMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : generatedCredentials ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Concluído
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Gerar Teste
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}