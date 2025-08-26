import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStats } from '@/types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

interface DashboardChartsProps {
  stats: DashboardStats;
}

export function DashboardCharts({ stats }: DashboardChartsProps) {
  const clientesPorAppData = stats.clientesPorApp.map((item, index) => ({
    ...item,
    fill: COLORS[index % COLORS.length]
  }));

  const vencimentosData = stats.vencimentosProximos.map(cliente => ({
    nome: cliente.nome,
    dias: Math.ceil((new Date(cliente.vencimento || '').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-dark-card border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">Clientes por Aplicativo</CardTitle>
          <CardDescription className="text-slate-400">
            Distribuição de clientes por tipo de aplicativo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={clientesPorAppData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ aplicativo, count }) => `${aplicativo}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {clientesPorAppData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-dark-card border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">Vencimentos Próximos</CardTitle>
          <CardDescription className="text-slate-400">
            Dias restantes para vencimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={vencimentosData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis 
                dataKey="nome" 
                tick={{ fill: '#94a3b8' }}
                axisLine={{ stroke: '#475569' }}
              />
              <YAxis 
                tick={{ fill: '#94a3b8' }}
                axisLine={{ stroke: '#475569' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#f1f5f9'
                }}
              />
              <Bar dataKey="dias" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
