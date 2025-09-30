import { Link, useLocation } from 'wouter';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  MessageSquare, 
  Ticket, 
  Bot, 
  Settings, 
  FileText,
  Tv,
  Smartphone,
  Server,
  Monitor,
  CreditCard,
  UserPlus,
  HelpCircle,
  Bell,
  BellOff,
  Router,
  LogOut,
  StickyNote,
  Activity,
  Workflow,
  AlertTriangle,
  X,
  Megaphone
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from '@/hooks/use-toast';

const menuItems = [
  { path: '/', icon: TrendingUp, label: 'Dashboard' },
  { path: '/chat', icon: MessageSquare, label: 'Chat', badge: 'chat' },
  { path: '/tickets', icon: Ticket, label: 'Tickets', badge: 'tickets' },
  { path: '/vencimentos', icon: Calendar, label: 'Vencimentos' },
  { path: '/acessos', icon: Activity, label: 'Acessos' },
  { path: '/testes', icon: Monitor, label: 'Testes' },
  { path: '/clientes', icon: Users, label: 'Clientes' },
  { path: '/apps', icon: Router, label: 'APPs' },
  { path: '/painel-office', icon: Monitor, label: 'Painel Office' },
  { path: '/indicacoes', icon: UserPlus, label: 'Indicações' },
  { path: '/promocoes', icon: Megaphone, label: 'Promoções' },
  { path: '/ajuda', icon: HelpCircle, label: 'Ajuda' },
  { path: '/anotacoes', icon: StickyNote, label: 'Anotações' },
  { path: '/whatsapp-settings', icon: Smartphone, label: 'WhatsApp Config' },
  { path: '/bot-config', icon: Bot, label: 'Config. Bot' },
  { path: '/bot-menu', icon: Workflow, label: 'Bot Menu' },
  { path: '/woovi', icon: CreditCard, label: 'Woovi' },
  { path: '/config-tv', icon: Server, label: 'Config da API' },
  { path: '/logs', icon: FileText, label: 'Logs' },
];

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const [location, setLocation] = useLocation();
  const { notificationsSilenced, toggleNotifications } = useSettings();
  const { toast } = useToast();
  
  const { data: conversas } = useQuery({
    queryKey: ['/api/conversas'],
    queryFn: api.getConversas,
    refetchInterval: 3000,
    staleTime: 0,
  });

  const { data: divergences } = useQuery({
    queryKey: ['/api/system-divergences'],
    queryFn: async () => {
      const response = await fetch('/api/system-divergences');
      if (!response.ok) throw new Error('Failed to fetch divergences');
      return response.json();
    },
    refetchInterval: 30000,
    staleTime: 0,
  });

  const { data: tickets } = useQuery({
    queryKey: ['/api/tickets'],
    queryFn: api.getTickets,
    refetchInterval: 5000,
    staleTime: 0,
  });

  const unreadMessages = conversas?.reduce((acc, conv) => acc + conv.mensagensNaoLidas, 0) || 0;
  const openTickets = tickets?.filter(t => t.status === 'aberto').length || 0;

  const getBadgeCount = (badge: string) => {
    switch (badge) {
      case 'chat': return unreadMessages;
      case 'tickets': return openTickets;
      default: return 0;
    }
  };

  const isPathActive = (path: string) => {
    if (path === '/') {
      return location === '/';
    }
    return location.startsWith(path);
  };

  const handleToggleNotifications = () => {
    toggleNotifications();
    toast({
      title: notificationsSilenced ? "Notificações ativadas" : "Notificações silenciadas",
      description: notificationsSilenced 
        ? "Você receberá notificações de novas mensagens" 
        : "Você não receberá notificações de novas mensagens",
      duration: 3000,
    });
  };

  const handleNavClick = (path: string) => {
    setLocation(path);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "md:hidden fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-700/50 flex flex-col shadow-xl transition-transform duration-300 z-50",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
                <Tv className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  TV ON
                </h1>
                <p className="text-slate-400 text-xs">Sistema de Gestão</p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {divergences?.hasDivergences && (
            <button
              onClick={() => handleNavClick('/config-tv')}
              className="mt-3 w-full p-2 bg-yellow-500/20 rounded-lg hover:bg-yellow-500/30 transition-all animate-pulse flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-400 font-medium">
                {divergences.count} divergências detectadas
              </span>
            </button>
          )}
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = isPathActive(item.path);
              const badgeCount = item.badge ? getBadgeCount(item.badge) : 0;
              
              return (
                <li key={item.path}>
                  <button
                    onClick={() => handleNavClick(item.path)}
                    className={cn(
                      "w-full flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200",
                      isActive 
                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-md' 
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    )}
                  >
                    <div className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      isActive ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/30' : 'bg-slate-800/50'
                    )}>
                      <Icon className={cn(
                        "w-4 h-4",
                        isActive ? 'text-blue-400' : 'text-slate-400'
                      )} />
                    </div>
                    <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                    {badgeCount > 0 && (
                      <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white border-0 text-xs font-bold">
                        {badgeCount}
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-700/50 space-y-2">
          <Button
            onClick={handleToggleNotifications}
            variant="ghost"
            size="sm"
            className={cn(
              "w-full gap-2 justify-start px-3 py-2.5 transition-all",
              notificationsSilenced 
                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' 
                : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
            )}
          >
            <div className="p-1.5 rounded-lg bg-slate-800/50">
              {notificationsSilenced ? (
                <BellOff className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </div>
            <span className="flex-1 text-left text-sm font-medium">
              {notificationsSilenced ? "Silenciado" : "Notificações"}
            </span>
          </Button>
          
          <Button
            onClick={async () => {
              try {
                await fetch('/api/logout', { method: 'POST' });
                setLocation('/');
              } catch (error) {
                console.error('Logout error:', error);
              }
            }}
            variant="ghost"
            size="sm"
            className="w-full gap-2 justify-start px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <div className="p-1.5 rounded-lg bg-slate-800/50">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="flex-1 text-left text-sm font-medium">
              Sair
            </span>
          </Button>
        </div>
      </div>
    </>
  );
}