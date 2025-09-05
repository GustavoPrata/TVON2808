import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Copy, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";

export default function ConfigUser() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Query para buscar usuários gerados
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["/api/usuarios-gerados"],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Mutation para gerar novo usuário
  const generateUserMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/usuarios-gerados/gerar", {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios-gerados"] });
      toast({
        title: "Usuário gerado com sucesso!",
        description: `Usuário: ${data.usuario} - Senha: ${data.senha}`,
      });
      
      // Copia automaticamente as credenciais
      copyToClipboard(`Usuário: ${data.usuario}\nSenha: ${data.senha}`);
    },
    onError: (error) => {
      toast({
        title: "Erro ao gerar usuário",
        description: error.message || "Erro ao gerar usuário de teste",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleCopyCredentials = (usuario: any) => {
    const text = `Usuário: ${usuario.usuario}\nSenha: ${usuario.senha}\nApp: https://onlineoffice.zip`;
    copyToClipboard(text);
    setCopiedId(usuario.id);
    toast({
      title: "Credenciais copiadas!",
      description: "As credenciais foram copiadas para a área de transferência.",
    });
    
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerateUser = () => {
    setIsGenerating(true);
    generateUserMutation.mutate();
  };

  const getStatusBadge = (status: string, dataExpiracao: string) => {
    const now = new Date();
    const expiracao = new Date(dataExpiracao);
    const isExpired = expiracao < now;

    if (isExpired || status === "expirado") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Expirado
        </Badge>
      );
    }

    return (
      <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Ativo
      </Badge>
    );
  };

  const getTimeRemaining = (dataExpiracao: string) => {
    const now = new Date();
    const expiracao = new Date(dataExpiracao);
    const diff = expiracao.getTime() - now.getTime();

    if (diff <= 0) {
      return "Expirado";
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}min restantes`;
    }

    return `${minutes}min restantes`;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Config User</h1>
        <p className="text-gray-600">
          Geração automática de usuários IPTV com expiração de 6 horas
        </p>
      </div>

      <div className="grid gap-6">
        {/* Card de Geração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Gerar Novo Usuário
            </CardTitle>
            <CardDescription>
              Cria um novo usuário de teste com validade de 6 horas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Button
                onClick={handleGenerateUser}
                disabled={isGenerating}
                className="w-full sm:w-auto"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando usuário...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Gerar Usuário de Teste
                  </>
                )}
              </Button>
              
              <div className="text-sm text-gray-600">
                <p>• Usuário gerado automaticamente com acesso completo</p>
                <p>• Validade: 6 horas a partir da criação</p>
                <p>• Credenciais copiadas automaticamente após geração</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Usuários Gerados
            </CardTitle>
            <CardDescription>
              Lista de todos os usuários gerados e seu status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : usuarios && usuarios.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Senha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Tempo Restante</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios.map((usuario: any) => (
                      <TableRow key={usuario.id}>
                        <TableCell className="font-mono font-semibold">
                          {usuario.usuario}
                        </TableCell>
                        <TableCell className="font-mono">
                          {usuario.senha}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(usuario.status, usuario.dataExpiracao)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(usuario.dataCriacao), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          {getTimeRemaining(usuario.dataExpiracao)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyCredentials(usuario)}
                            className="flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedId === usuario.id ? "Copiado!" : "Copiar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhum usuário gerado ainda. Clique em "Gerar Usuário de Teste" para começar.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card de Informações */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Importantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Os usuários são gerados através da API do sistema IPTV</p>
              <p>• Cada usuário tem validade de 6 horas a partir da criação</p>
              <p>• Após expiração, o usuário será automaticamente desativado</p>
              <p>• O sistema mantém histórico de todos os usuários gerados</p>
              <p>• App para acesso: https://onlineoffice.zip</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}