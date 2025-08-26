import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, Clock, Users, Trophy, Gift, AlertCircle, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Indicacao {
  id: number;
  indicadorId: number;
  indicadoId: number;
  codigoIndicacao: string;
  dataIndicacao: string;
  status: string;
  dataConfirmacao?: string;
  mesGratisAplicado: boolean;
  observacoes?: string;
  indicadorNome?: string;
  indicadorTelefone?: string;
  indicadoNome?: string;
  indicadoTelefone?: string;
}

export default function Indicacoes() {
  const [activeTab, setActiveTab] = useState("todas");
  const { toast } = useToast();

  // Buscar indicações
  const { data: indicacoes = [], isLoading, refetch } = useQuery<Indicacao[]>({
    queryKey: ['/api/indicacoes', activeTab],
    queryFn: async () => {
      const params = activeTab !== 'todas' ? `?status=${activeTab}` : '';
      const response = await fetch(`/api/indicacoes${params}`);
      if (!response.ok) throw new Error('Erro ao buscar indicações');
      return response.json();
    }
  });

  // Confirmar indicação
  const confirmarIndicacao = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/indicacoes/confirmar/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Indicação confirmada",
        description: "O mês grátis foi aplicado ao indicador com sucesso!",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao confirmar indicação",
        description: error.message || "Ocorreu um erro ao confirmar a indicação",
        variant: "destructive",
      });
    }
  });

  // Estatísticas
  const totalIndicacoes = indicacoes.length;
  const pendentes = indicacoes.filter(i => i.status === 'pendente').length;
  const confirmadas = indicacoes.filter(i => i.status === 'confirmada').length;
  const mesesDistribuidos = indicacoes.filter(i => i.mesGratisAplicado).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/30">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>;
      case 'confirmada':
        return <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="w-3 h-3 mr-1" />
          Confirmada
        </Badge>;
      case 'expirada':
        return <Badge className="bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border-red-500/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Expirada
        </Badge>;
      default:
        return <Badge className="bg-slate-700/50 text-slate-400 border-slate-600">{status}</Badge>;
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Indicações
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Gerencie o programa "Indique e Ganhe" da TV ON
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="todas" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-slate-900 border border-slate-700">
          <TabsTrigger value="todas" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            Todas
          </TabsTrigger>
          <TabsTrigger value="pendente" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-yellow-600 data-[state=active]:text-white">
            <Clock className="w-4 h-4 mr-2" />
            Pendentes
          </TabsTrigger>
          <TabsTrigger value="confirmada" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white">
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirmadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todas">
          <div className="space-y-6">
            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Total de Indicações</CardTitle>
                  <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                    <Users className="h-4 w-4 text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text">
                    {totalIndicacoes}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Pendentes</CardTitle>
                  <div className="p-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg">
                    <Clock className="h-4 w-4 text-yellow-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text">
                    {pendentes}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Confirmadas</CardTitle>
                  <div className="p-2 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-transparent bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text">
                    {confirmadas}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Meses Distribuídos</CardTitle>
                  <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
                    <Gift className="h-4 w-4 text-purple-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
                    {mesesDistribuidos}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Indicações */}
            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
                    <Trophy className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Indicações</CardTitle>
                    <CardDescription className="text-slate-400">
                      Visualize e gerencie todas as indicações do sistema
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-400">Carregando indicações...</p>
                  </div>
                ) : indicacoes.length === 0 ? (
                  <div className="text-center py-12">
                    <UserPlus className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">Nenhuma indicação encontrada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-700/50">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700/50 bg-slate-800/30">
                          <TableHead className="text-slate-300 font-semibold">Indicador</TableHead>
                          <TableHead className="text-slate-300 font-semibold">Indicado</TableHead>
                          <TableHead className="text-slate-300 font-semibold">Código</TableHead>
                          <TableHead className="text-slate-300 font-semibold">Data</TableHead>
                          <TableHead className="text-slate-300 font-semibold">Status</TableHead>
                          <TableHead className="text-slate-300 font-semibold">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {indicacoes.map((indicacao) => (
                          <TableRow key={indicacao.id} className="border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                            <TableCell className="text-white">
                              <div>
                                <div className="font-medium">{indicacao.indicadorNome}</div>
                                <div className="text-sm text-slate-400">
                                  {formatPhoneNumber(indicacao.indicadorTelefone || '')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-white">
                              <div>
                                <div className="font-medium">{indicacao.indicadoNome}</div>
                                <div className="text-sm text-slate-400">
                                  {formatPhoneNumber(indicacao.indicadoTelefone || '')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-purple-400 font-mono">
                                {formatPhoneNumber(indicacao.codigoIndicacao)}
                              </span>
                            </TableCell>
                            <TableCell className="text-slate-300">
                              <div>
                                <div>{format(new Date(indicacao.dataIndicacao), 'dd/MM/yyyy', { locale: ptBR })}</div>
                                {indicacao.dataConfirmacao && (
                                  <div className="text-sm text-green-400">
                                    Confirmada em {format(new Date(indicacao.dataConfirmacao), 'dd/MM/yyyy', { locale: ptBR })}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(indicacao.status)}</TableCell>
                            <TableCell>
                              {indicacao.status === 'pendente' && (
                                <Button
                                  size="sm"
                                  onClick={() => confirmarIndicacao.mutate(indicacao.id)}
                                  disabled={confirmarIndicacao.isPending}
                                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Confirmar
                                </Button>
                              )}
                              {indicacao.mesGratisAplicado && (
                                <Badge className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-blue-500/30">
                                  <Gift className="w-3 h-3 mr-1" />
                                  Mês aplicado
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Indicadores */}
            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Top Indicadores</CardTitle>
                    <CardDescription className="text-slate-400">
                      Ranking dos melhores indicadores do sistema
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
            {(() => {
              const topIndicadores = indicacoes.reduce((acc, ind) => {
                const key = ind.indicadorNome || 'Desconhecido';
                if (!acc[key]) {
                  acc[key] = { nome: key, telefone: ind.indicadorTelefone || '', count: 0, confirmadas: 0 };
                }
                acc[key].count++;
                if (ind.status === 'confirmada') acc[key].confirmadas++;
                return acc;
              }, {} as Record<string, { nome: string; telefone: string; count: number; confirmadas: number }>);

              const sorted = Object.values(topIndicadores)
                .sort((a, b) => b.confirmadas - a.confirmadas)
                .slice(0, 5);

              return sorted.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Nenhum indicador ainda</p>
                </div>
              ) : (
                <div className="space-y-3 pt-4">
                  {sorted.map((indicador, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl hover:bg-slate-800/50 transition-colors border border-slate-700/50">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                          ${index === 0 ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white' : 
                            index === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500 text-white' : 
                            index === 2 ? 'bg-gradient-to-br from-orange-600 to-red-600 text-white' : 
                            'bg-slate-700 text-slate-400'}`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-white font-medium">{indicador.nome}</div>
                          <div className="text-sm text-slate-400">{formatPhoneNumber(indicador.telefone)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-transparent bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text font-semibold">
                          {indicador.confirmadas} confirmadas
                        </div>
                        <div className="text-sm text-slate-400">{indicador.count} total</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pendente">
          <div className="space-y-6">
            {/* Content for pendente tab - same structure as todas */}
            {/* Will show filtered pendente items */}
          </div>
        </TabsContent>

        <TabsContent value="confirmada">
          <div className="space-y-6">
            {/* Content for confirmada tab - same structure as todas */}
            {/* Will show filtered confirmada items */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}