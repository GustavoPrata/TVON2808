import { useState } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, CreditCard, Edit, Bell, Calendar, Clock, AlertTriangle, CheckCircle, XCircle, Users, Phone, DollarSign, Filter, Monitor } from 'lucide-react';
import { api } from '@/lib/api';
import type { Cliente } from '@/types';

export default function Vencimentos() {
  const [filterType, setFilterType] = useState<'proximos' | 'vencidos' | 'todos'>('proximos');
  const [diasFiltro, setDiasFiltro] = useState(5);

  const { data: vencimentos, isLoading } = useQuery({
    queryKey: ['/api/vencimentos', { tipo: filterType === 'todos' ? undefined : filterType, dias: diasFiltro }],
    queryFn: () => api.getVencimentos({
      tipo: filterType === 'todos' ? undefined : filterType,
      dias: diasFiltro
    }),
  });

  const getDaysUntilExpiry = (vencimento: string) => {
    // Criar data de vencimento no timezone de São Paulo
    const expiryDate = new Date(vencimento);
    
    // Obter a data atual em São Paulo
    const nowSaoPaulo = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const today = new Date(nowSaoPaulo);
    
    // Zerar as horas para comparar apenas as datas
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      ativo: 'bg-green-500/20 text-green-400',
      inativo: 'bg-red-500/20 text-red-400',
      suspenso: 'bg-yellow-500/20 text-yellow-400',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-500/20 text-gray-400';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      ativo: CheckCircle,
      inativo: XCircle,
      suspenso: AlertTriangle,
    };
    return icons[status as keyof typeof icons] || XCircle;
  };

  const getDaysRemainingBadge = (days: number) => {
    if (days <= 0) return 'bg-red-500/20 text-red-400';
    if (days <= 2) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-green-500/20 text-green-400';
  };

  const getAplicativo = (cliente: Cliente) => {
    // This would come from the pontos relationship in a real app
    return 'IBO Pro'; // Placeholder
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Vencimentos
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Controle de vencimentos dos clientes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex bg-dark-surface border border-slate-600 rounded-lg">
          <Button
            variant={filterType === 'proximos' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterType('proximos')}
            className="rounded-r-none"
          >
            Próximos {diasFiltro} dias
          </Button>
          <Button
            variant={filterType === 'vencidos' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterType('vencidos')}
            className="rounded-none"
          >
            Vencidos
          </Button>
          <Button
            variant={filterType === 'todos' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterType('todos')}
            className="rounded-l-none"
          >
            Todos
          </Button>
        </div>
        
        <Button className="bg-primary hover:bg-primary/80">
          <Bell className="w-4 h-4 mr-2" />
          Notificar Todos
        </Button>
      </div>

      {/* Vencimentos Table */}
      <Card className="bg-dark-card border-slate-600">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-tv-border">
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Cliente
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Contato
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Aplicativo
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Vencimento
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Dias Restantes
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Status
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-tv-text-muted font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {vencimentos?.map((cliente) => {
                  const daysRemaining = cliente.vencimento ? getDaysUntilExpiry(cliente.vencimento) : 0;
                  
                  return (
                    <tr key={cliente.id} className="table-row hover-card">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {cliente.nome.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium">{cliente.nome}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="font-mono text-sm">{cliente.telefone}</span>
                      </td>
                      <td className="table-cell">
                        {getAplicativo(cliente)}
                      </td>
                      <td className="table-cell">
                        {cliente.vencimento ? (
                          new Date(cliente.vencimento).toLocaleDateString('pt-BR')
                        ) : (
                          <span className="text-slate-400">Não definido</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <Badge className={getDaysRemainingBadge(daysRemaining)}>
                          {daysRemaining <= 0 ? `${Math.abs(daysRemaining)} dias atrás` : `${daysRemaining} dias`}
                        </Badge>
                      </td>
                      <td className="table-cell">
                        <Badge className={`${getStatusBadge(cliente.status)} flex items-center gap-1 w-fit`}>
                          {React.createElement(getStatusIcon(cliente.status), { size: 12 })}
                          {cliente.status}
                        </Badge>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Notificar cliente"
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Gerar cobrança"
                          >
                            <CreditCard className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Editar cliente"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {!vencimentos?.length && (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-400">
                {filterType === 'proximos' && `Nenhum cliente vencendo nos próximos ${diasFiltro} dias`}
                {filterType === 'vencidos' && 'Nenhum cliente com vencimento em atraso'}
                {filterType === 'todos' && 'Nenhum cliente encontrado'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
