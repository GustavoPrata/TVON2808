/**
 * PADRÃO DE LAYOUT PARA PÁGINAS DO ADMIN
 * ========================================
 * Use este template para criar ou atualizar páginas do admin
 * Isso garante consistência visual em todo o painel administrativo
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CountUp from "react-countup";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter,
  TrendingUp,
  TrendingDown,
  Activity,
  // Adicione ícones conforme necessário
} from "lucide-react";

/**
 * ESTRUTURA PADRÃO DE PÁGINA
 * ===========================
 */
export function AdminPageTemplate() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  return (
    <div className="space-y-6">
      {/* 1. HEADER DA PÁGINA - Sempre no topo */}
      <PageHeader 
        title="Título da Página"
        description="Descrição breve do que a página faz"
        stats={{
          total: 100,
          active: 25,
          pending: 5
        }}
      />

      {/* 2. CARDS DE ESTATÍSTICAS - Métricas principais */}
      <StatsCards />

      {/* 3. BARRA DE FILTROS E AÇÕES */}
      <FilterBar 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
      />

      {/* 4. CONTEÚDO PRINCIPAL - Tabela ou Grid */}
      <MainContent />

      {/* 5. GRÁFICOS (opcional) */}
      <ChartsSection />
    </div>
  );
}

/**
 * COMPONENTE: HEADER DA PÁGINA
 * =============================
 * Use no topo de cada página admin
 */
function PageHeader({ title, description, stats }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl font-bold text-white mb-2 flex items-center gap-3"
        >
          {/* Ícone animado opcional */}
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <Activity className="w-8 h-8 text-[#00E880]" />
          </motion.div>
          {title}
        </motion.h2>
        <p className="text-zinc-400">{description}</p>
      </div>
      
      {/* Badges de status no header */}
      {stats && (
        <div className="flex gap-2">
          <Badge variant="outline" className="border-[#00E880] text-[#00E880]">
            Total: {stats.total}
          </Badge>
          <Badge variant="outline" className="border-blue-500 text-blue-400">
            Ativos: {stats.active}
          </Badge>
          {stats.pending > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-400">
              Pendentes: {stats.pending}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * COMPONENTE: CARDS DE ESTATÍSTICAS
 * ==================================
 * Cards coloridos com métricas importantes
 */
function StatsCards() {
  const cards = [
    {
      title: "Métrica 1",
      value: 1234,
      change: 12.5,
      icon: TrendingUp,
      gradient: "from-blue-600 to-blue-700",
      iconBg: "bg-blue-500/20",
      textColor: "text-blue-100"
    },
    {
      title: "Métrica 2", 
      value: 567,
      change: -3.2,
      icon: TrendingDown,
      gradient: "from-purple-600 to-purple-700",
      iconBg: "bg-purple-500/20",
      textColor: "text-purple-100"
    },
    {
      title: "Métrica 3",
      value: 89,
      change: 45.8,
      icon: Activity,
      gradient: "from-green-600 to-green-700",
      iconBg: "bg-green-500/20",
      textColor: "text-green-100"
    },
    {
      title: "Métrica 4",
      value: 2345,
      change: 8.9,
      icon: TrendingUp,
      gradient: "from-amber-600 to-amber-700",
      iconBg: "bg-amber-500/20",
      textColor: "text-amber-100"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className={`bg-gradient-to-br ${card.gradient} border-0 shadow-xl`}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className={`${card.textColor} text-sm mb-1`}>{card.title}</p>
                  <p className="text-3xl font-bold text-white">
                    <CountUp end={card.value} duration={1.5} />
                  </p>
                  <Badge className="mt-2 bg-white/20 text-white border-0">
                    {card.change > 0 ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {Math.abs(card.change)}%
                  </Badge>
                </div>
                <div className={`p-3 ${card.iconBg} backdrop-blur-sm rounded-xl`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * COMPONENTE: BARRA DE FILTROS
 * =============================
 * Pesquisa, filtros e ações
 */
function FilterBar({ searchTerm, onSearchChange, filterStatus, onFilterChange }) {
  return (
    <Card className="bg-black/50 border-zinc-800 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-[#00E880] focus:ring-[#00E880]/20"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={onFilterChange}>
              <SelectTrigger className="w-[140px] bg-zinc-900/50 border-zinc-800 text-zinc-300">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>

            {/* Botões de Ação */}
            <Button 
              variant="outline"
              className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>

            <Button className="bg-[#00E880] text-black hover:bg-[#00E880]/90">
              Nova Ação
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * COMPONENTE: CONTEÚDO PRINCIPAL
 * ===============================
 * Tabela ou grid de dados
 */
function MainContent() {
  return (
    <Card className="bg-black/50 border-zinc-800 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-zinc-900 to-black border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-[#00E880]">
            Título da Tabela
          </CardTitle>
          <Badge variant="outline" className="border-[#00E880] text-[#00E880]">
            10 itens
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">
                  Coluna 1
                </TableHead>
                <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">
                  Coluna 2
                </TableHead>
                <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">
                  Status
                </TableHead>
                <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs">
                  Valor
                </TableHead>
                <TableHead className="text-zinc-400 font-semibold uppercase tracking-wider text-xs text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((item, index) => (
                <motion.tr
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                >
                  <TableCell className="font-medium text-white">
                    Item {item}
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    Descrição do item
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-green-500/20 text-green-400 border-0">
                      Ativo
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    R$ 100,00
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-zinc-400 hover:text-white"
                    >
                      Ver Detalhes
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * COMPONENTE: SEÇÃO DE GRÁFICOS
 * ==============================
 * Área para gráficos e visualizações
 */
function ChartsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Gráfico 1</CardTitle>
            <CardDescription className="text-zinc-400">
              Descrição do gráfico
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Conteúdo do gráfico aqui */}
            <div className="h-64 flex items-center justify-center text-zinc-500">
              Área do Gráfico
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Gráfico 2</CardTitle>
            <CardDescription className="text-zinc-400">
              Descrição do gráfico
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Conteúdo do gráfico aqui */}
            <div className="h-64 flex items-center justify-center text-zinc-500">
              Área do Gráfico
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/**
 * PADRÕES DE ESTILO
 * =================
 */
export const stylePatterns = {
  // Cores principais
  colors: {
    primary: "#00E880",
    secondary: "#00D470",
    background: "from-zinc-950 via-black to-zinc-950",
    cardBg: "bg-black/50 border-zinc-800 backdrop-blur-sm",
    headerGradient: "bg-gradient-to-r from-zinc-900 to-black"
  },

  // Classes padrão para cards
  cards: {
    base: "bg-black/50 border-zinc-800 backdrop-blur-sm",
    gradient: "bg-gradient-to-br from-zinc-900 to-black border-zinc-800",
    stats: "border-0 shadow-xl" // Para cards de estatísticas coloridos
  },

  // Classes para tabelas
  table: {
    header: "border-zinc-800 hover:bg-zinc-900/50",
    headerCell: "text-zinc-400 font-semibold uppercase tracking-wider text-xs",
    row: "border-zinc-800 hover:bg-zinc-900/50 transition-colors",
    cell: "text-zinc-300"
  },

  // Classes para botões
  buttons: {
    primary: "bg-[#00E880] text-black hover:bg-[#00E880]/90",
    secondary: "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50",
    ghost: "text-zinc-400 hover:text-white"
  },

  // Classes para inputs
  inputs: {
    base: "bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-[#00E880] focus:ring-[#00E880]/20"
  },

  // Classes para badges
  badges: {
    success: "bg-green-500/20 text-green-400 border-0",
    warning: "bg-amber-500/20 text-amber-400 border-0",
    error: "bg-red-500/20 text-red-400 border-0",
    info: "bg-blue-500/20 text-blue-400 border-0",
    default: "border-[#00E880] text-[#00E880]"
  },

  // Animações padrão
  animations: {
    fadeIn: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 }
    },
    slideInLeft: {
      initial: { opacity: 0, x: -20 },
      animate: { opacity: 1, x: 0 }
    },
    slideInRight: {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 }
    },
    rotate: {
      initial: { rotate: 0 },
      animate: { rotate: 360 },
      transition: { duration: 1, delay: 0.5 }
    }
  }
};

/**
 * CHECKLIST DE PADRONIZAÇÃO
 * ==========================
 * 
 * ✅ Use sempre a estrutura: Header > Stats Cards > Filtros > Conteúdo > Gráficos
 * ✅ Mantenha espaçamento consistente: space-y-6 entre seções
 * ✅ Use as cores padrão: #00E880 (primária), zinc para neutros
 * ✅ Aplique animações do Framer Motion em elementos importantes
 * ✅ Use CountUp para números grandes
 * ✅ Cards devem ter: bg-black/50 border-zinc-800 backdrop-blur-sm
 * ✅ Tabelas devem ter header gradiente e linhas hover
 * ✅ Badges devem usar cores semânticas (verde=sucesso, amber=aviso, etc)
 * ✅ Botões primários sempre em verde #00E880
 * ✅ Ícones do Lucide React com tamanhos consistentes (w-4 h-4 para pequenos, w-6 h-6 para médios)
 * ✅ Responsividade: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
 * ✅ Loading states com animate-spin ou skeleton
 * ✅ Empty states com ícone e mensagem centralizada
 */

export default AdminPageTemplate;