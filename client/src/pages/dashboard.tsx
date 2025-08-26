import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DashboardCharts } from '@/components/charts/dashboard-charts';
import { Users, CheckCircle, AlertTriangle, DollarSign, Mail, Activity, TrendingUp, Calendar, Clock, UserCheck, XCircle, Trophy } from 'lucide-react';
import { api } from '@/lib/api';

export default function Dashboard() {
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: api.getDashboardStats,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="loading-spinner w-12 h-12" />
          <p className="text-slate-400 font-medium">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-400">Erro ao carregar estatísticas</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Beautiful Header */}
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Dashboard Principal
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Visão geral do sistema TV ON
            </p>
          </div>
        </div>
      </div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Clientes</p>
                <p className="text-3xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text mt-1">
                  {stats.totalClientes}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-green-400 text-sm font-semibold">+12%</span>
              <span className="text-slate-500 text-sm">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Clientes Ativos</p>
                <p className="text-3xl font-bold text-transparent bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text mt-1">
                  {stats.clientesAtivos}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-green-400 text-sm font-semibold">
                {stats.totalClientes > 0 ? ((stats.clientesAtivos / stats.totalClientes) * 100).toFixed(1) : 0}%
              </span>
              <span className="text-slate-500 text-sm">taxa de atividade</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Vencendo em 5 dias</p>
                <p className="text-3xl font-bold text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text mt-1">
                  {stats.vencendo5Dias}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-yellow-400 text-sm font-semibold">
                {stats.totalClientes > 0 ? ((stats.vencendo5Dias / stats.totalClientes) * 100).toFixed(1) : 0}%
              </span>
              <span className="text-slate-500 text-sm">do total</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Receita Mensal</p>
                <p className="text-3xl font-bold text-transparent bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text mt-1">
                  R$ {stats.receitaMensal.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-green-400 text-sm font-semibold">+7.3%</span>
              <span className="text-slate-500 text-sm">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Referral Stats Card */}
      {stats.indicacoesStats && (
        <Card className="bg-gradient-to-br from-purple-800/20 to-pink-900/20 border-purple-700/50 backdrop-blur-sm overflow-hidden shadow-xl mb-6">
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-purple-300 text-lg font-semibold mb-1">Programa de Indicações</h3>
                <p className="text-slate-400 text-sm">Acompanhe o desempenho das indicações</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
                <Trophy className="w-8 h-8 text-purple-400" />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <p className="text-3xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text mb-2">
                  {stats.indicacoesStats.total}
                </p>
                <p className="text-sm text-slate-400 font-medium">Total de Indicações</p>
              </div>
              
              <div className="text-center p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <p className="text-3xl font-bold text-green-400 mb-2">
                  {stats.indicacoesStats.confirmadas}
                </p>
                <p className="text-sm text-slate-400 font-medium">Confirmadas</p>
              </div>
              
              <div className="text-center p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <p className="text-3xl font-bold text-yellow-400 mb-2">
                  {stats.indicacoesStats.pendentes}
                </p>
                <p className="text-sm text-slate-400 font-medium">Pendentes</p>
              </div>
            </div>
            

          </CardContent>
        </Card>
      )}
      {/* Charts */}
      <DashboardCharts stats={stats} />
      {/* Top Indicadores - Referral Program */}
      {stats.topIndicadores && stats.topIndicadores.length > 0 && (
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
          <CardHeader className="border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
                <Trophy className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-white">🏆 Top Indicadores</CardTitle>
                <CardDescription className="text-slate-400">
                  Clientes que mais indicaram novos assinantes
                </CardDescription>
              </div>
              {stats.indicacoesStats && (
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-slate-400">Confirmadas: {stats.indicacoesStats.confirmadas}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                    <span className="text-slate-400">Pendentes: {stats.indicacoesStats.pendentes}</span>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {stats.topIndicadores.map((indicador, index) => (
                <div key={indicador.id} className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl font-bold text-lg
                    ${index === 0 ? 'bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 text-yellow-400' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300/20 to-gray-500/20 text-gray-300' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400/20 to-orange-600/20 text-orange-400' :
                      'bg-gradient-to-br from-slate-600/20 to-slate-700/20 text-slate-400'}`}>
                    {index + 1}°
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{indicador.nome}</p>
                    <p className="text-sm text-slate-400">{indicador.telefone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-400">
                      {indicador.indicacoesConfirmadas || 0} confirmadas
                    </p>
                    <p className="text-xs text-slate-500">
                      Total: {indicador.totalIndicacoes || 0} indicações
                    </p>
                  </div>
                  {indicador.mesesGratisAcumulados > 0 && (
                    <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30">
                      {indicador.mesesGratisAcumulados} {indicador.mesesGratisAcumulados === 1 ? 'mês' : 'meses'} grátis
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            {stats.topIndicadores.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma indicação registrada ainda</p>
                <p className="text-sm mt-1">O programa de indicações começará a aparecer aqui</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Recent Activity & Upcoming Expirations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
          <CardHeader className="border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-white">Atividade Recente</CardTitle>
                <CardDescription className="text-slate-400">
                  Últimas atividades do sistema
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Novo cliente cadastrado</p>
                  <p className="text-xs text-slate-400">há 2 minutos</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Pagamento recebido</p>
                  <p className="text-xs text-slate-400">há 5 minutos</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Usuário renovado</p>
                  <p className="text-xs text-slate-400">há 8 minutos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
          <CardHeader className="border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-white">Vencimentos Próximos</CardTitle>
                <CardDescription className="text-slate-400">
                  Próximos 7 dias
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {stats.vencimentosProximos.slice(0, 5).map((cliente) => {
                // Criar data de vencimento no timezone de São Paulo
                const expiryDate = new Date(cliente.vencimento || '');
                
                // Obter a data atual em São Paulo
                const nowSaoPaulo = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
                const today = new Date(nowSaoPaulo);
                
                // Zerar as horas para comparar apenas as datas
                expiryDate.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                
                const diasRestantes = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={cliente.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center">
                        <span className="text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text font-bold">
                          {cliente.nome.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{cliente.nome}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(cliente.vencimento || '').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`font-semibold border-0 ${
                        diasRestantes <= 0 ? 'bg-red-500/20 text-red-400' :
                        diasRestantes <= 2 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {diasRestantes <= 0 ? 'Vencido' : `${diasRestantes} dias`}
                      </Badge>
                      <Button className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2 py-1 h-8">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
