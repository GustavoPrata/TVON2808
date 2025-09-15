import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, CheckCircle, Trash2, Monitor, UserPlus, Globe, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface IPTVUser {
  id: string;
  usuario: string;
  senha: string;
  vencimento?: string;
  createdAt: string;
}

export default function PainelOffice() {
  const [users, setUsers] = useState<IPTVUser[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState({ usuario: '', senha: '', vencimento: '' });
  const [iframeKey, setIframeKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/office/generate-human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        const newUser: IPTVUser = {
          id: Date.now().toString(),
          usuario: data.usuario,
          senha: data.senha,
          vencimento: data.vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
          createdAt: new Date().toISOString()
        };
        
        setUsers(prev => [...prev, newUser]);
        
        // Also save to backend
        await saveCredentialsToBackend(newUser);
        
        toast({
          title: "🎉 Gerado com Sucesso!",
          description: `Usuário: ${data.usuario} | Senha: ${data.senha}`,
          variant: "default",
        });
      } else {
        const error = await response.json();
        toast({
          title: "❌ Erro ao Gerar",
          description: error.error || 'Não foi possível gerar as credenciais automaticamente',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao gerar credenciais:', error);
      toast({
        title: "❌ Erro de Conexão",
        description: "Não foi possível conectar ao servidor. Verifique se o serviço está rodando.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveCredentialsToBackend = async (user: IPTVUser) => {
    try {
      const response = await fetch('/api/office/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      toast({
        title: "✅ Salvo!",
        description: "Credenciais salvas no banco de dados",
        variant: "default"
      });
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      toast({
        title: "⚠️ Aviso",
        description: "As credenciais foram adicionadas mas houve erro ao salvar no banco de dados.",
        variant: "destructive"
      });
    }
  };

  const handleManualSubmit = () => {
    if (!manualInput.usuario || !manualInput.senha) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Por favor, preencha usuário e senha",
        variant: "destructive"
      });
      return;
    }

    const newUser: IPTVUser = {
      id: Date.now().toString(),
      usuario: manualInput.usuario,
      senha: manualInput.senha,
      vencimento: manualInput.vencimento || new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('pt-BR'),
      createdAt: new Date().toISOString()
    };

    setUsers(prev => [...prev, newUser]);
    saveCredentialsToBackend(newUser);
    setManualInput({ usuario: '', senha: '', vencimento: '' });
    
    toast({
      title: "✅ Credenciais Adicionadas!",
      description: `Usuário: ${newUser.usuario} | Senha: ${newUser.senha}`,
      variant: "default"
    });
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      toast({
        title: "Copiado!",
        description: `${field} copiado para a área de transferência`,
        variant: "default"
      });
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const deleteUser = (userId: string) => {
    setUsers(prev => prev.filter(user => user.id !== userId));
    toast({
      title: "Removido",
      description: "Credenciais removidas da lista",
      variant: "default"
    });
  };

  const refreshIframe = () => {
    setIframeKey(prev => prev + 1);
    toast({
      title: "Recarregado",
      description: "O iframe foi recarregado",
      variant: "default"
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl p-4 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg shadow-purple-500/30">
              <Monitor className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Painel Office - IPTV
              </h1>
              <p className="text-xs text-slate-400">
                Gerador de credenciais IPTV
              </p>
            </div>
          </div>
          <Badge className="bg-green-500/20 text-green-400">
            <Globe className="w-3 h-3 mr-1" />
            OnlineOffice.zip
          </Badge>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Left Side - Controls and Users List */}
        <div className="flex flex-col gap-4 min-h-0">
          
          {/* Automation Card - Primary Option */}
          <Card className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/50 shadow-lg shadow-purple-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Geração Automática Humanizada
              </CardTitle>
              <CardDescription className="text-xs text-slate-300">
                Gera credenciais automaticamente com nomes e sobrenomes realistas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleAutoGenerate}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                size="lg"
                data-testid="button-auto-generate"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Gerando Credenciais...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Gerar Automaticamente
                  </>
                )}
              </Button>
              {isGenerating && (
                <p className="text-xs text-center mt-3 text-purple-300 animate-pulse">
                  Criando credenciais humanizadas... Aguarde!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Manual Input Card - Secondary Option */}
          <Card className="bg-dark-card border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Adicionar Manualmente
              </CardTitle>
              <CardDescription className="text-xs">
                Ou adicione credenciais manualmente caso já tenha gerado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="usuario" className="text-xs">Usuário</Label>
                <Input
                  id="usuario"
                  placeholder="Digite o usuário gerado"
                  value={manualInput.usuario}
                  onChange={(e) => setManualInput({...manualInput, usuario: e.target.value})}
                  className="h-9"
                  data-testid="input-usuario"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="senha" className="text-xs">Senha</Label>
                <Input
                  id="senha"
                  placeholder="Digite a senha gerada"
                  value={manualInput.senha}
                  onChange={(e) => setManualInput({...manualInput, senha: e.target.value})}
                  className="h-9"
                  data-testid="input-senha"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="vencimento" className="text-xs">Vencimento (opcional)</Label>
                <Input
                  id="vencimento"
                  placeholder="Ex: 20/01/2025"
                  value={manualInput.vencimento}
                  onChange={(e) => setManualInput({...manualInput, vencimento: e.target.value})}
                  className="h-9"
                  data-testid="input-vencimento"
                />
              </div>
              
              <Button
                onClick={handleManualSubmit}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
                data-testid="button-add-credentials"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar Credenciais
              </Button>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card className="bg-dark-card border-slate-600 flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Credenciais Salvas</CardTitle>
                  <CardDescription className="text-xs">
                    Lista de credenciais IPTV
                  </CardDescription>
                </div>
                <Badge className="bg-purple-500/20 text-purple-400">
                  {users.length} {users.length === 1 ? 'credencial' : 'credenciais'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ScrollArea className="h-full max-h-[400px]">
                {users.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Usuário</TableHead>
                        <TableHead className="text-xs">Senha</TableHead>
                        <TableHead className="text-xs">Vencimento</TableHead>
                        <TableHead className="text-xs text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-1">
                              {user.usuario}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(user.usuario, `Usuário`)}
                                className="h-5 w-5 p-0"
                                data-testid={`button-copy-user-${user.id}`}
                              >
                                {copiedField === `Usuário` ? (
                                  <CheckCircle className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-1">
                              {user.senha}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(user.senha, `Senha`)}
                                className="h-5 w-5 p-0"
                                data-testid={`button-copy-pass-${user.id}`}
                              >
                                {copiedField === `Senha` ? (
                                  <CheckCircle className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{user.vencimento}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteUser(user.id)}
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                              data-testid={`button-delete-${user.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma credencial salva</p>
                    <p className="text-xs mt-1">
                      Gere credenciais no painel ao lado e adicione aqui
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - OnlineOffice iFrame */}
        <Card className="bg-dark-card border-slate-600 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">OnlineOffice</CardTitle>
                <CardDescription className="text-xs">
                  Faça login e gere as credenciais IPTV
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={refreshIframe}
                className="h-8 w-8 p-0"
                title="Recarregar iframe"
                data-testid="button-refresh-iframe"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-2">
            <div className="h-full min-h-[600px] bg-slate-900 rounded-lg overflow-hidden">
              <iframe
                key={iframeKey}
                src="https://onlineoffice.zip/"
                className="w-full h-full"
                title="OnlineOffice IPTV"
                allow="clipboard-read; clipboard-write"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}