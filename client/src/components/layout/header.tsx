import { useLocation } from 'wouter';
import { Bell, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/use-websocket';
import { ExtensionStatusIndicator } from '@/components/extension-status-indicator';

const pageConfig = {
  '/': { title: 'Dashboard', subtitle: 'Visão geral do sistema' },
  '/clientes': { title: 'Clientes', subtitle: 'Gerenciamento de clientes' },
  '/vencimentos': { title: 'Vencimentos', subtitle: 'Controle de vencimentos' },
  '/chat': { title: 'Chat', subtitle: 'Conversas e atendimento' },
  '/tickets': { title: 'Tickets', subtitle: 'Suporte e atendimento' },
  '/bot-config': { title: 'Configuração do Bot', subtitle: 'Configurações do bot WhatsApp' },
  '/integracoes': { title: 'Integrações', subtitle: 'APIs e configurações' },
  '/logs': { title: 'Logs', subtitle: 'Histórico de atividades' },
};

export function Header() {
  const [location] = useLocation();
  const { isConnected } = useWebSocket();
  
  const currentPage = pageConfig[location as keyof typeof pageConfig] || {
    title: 'Página',
    subtitle: 'Navegação'
  };

  return (
    <header className="bg-dark-surface border-b border-slate-600 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{currentPage.title}</h2>
          <p className="text-slate-400 text-sm">{currentPage.subtitle}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <ExtensionStatusIndicator />
          
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-400">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          
          <Button variant="ghost" size="sm">
            <Bell className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm">
            <Search className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
