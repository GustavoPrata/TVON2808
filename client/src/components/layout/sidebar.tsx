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
  ChevronLeft,
  ChevronRight,
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
  Workflow
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  { path: '/ajuda', icon: HelpCircle, label: 'Ajuda' },
  { path: '/anotacoes', icon: StickyNote, label: 'Anotações' },
  { path: '/whatsapp-settings', icon: Smartphone, label: 'WhatsApp Config' },
  { path: '/bot-config', icon: Bot, label: 'Config. Bot' },
  { path: '/bot-menu', icon: Workflow, label: 'Bot Menu' },
  { path: '/woovi', icon: CreditCard, label: 'Woovi' },
  { path: '/config-tv', icon: Server, label: 'Config da API' },
  { path: '/logs', icon: FileText, label: 'Logs' },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { notificationsSilenced, toggleNotifications } = useSettings();
  const { toast } = useToast();
  
  const { data: conversas } = useQuery({
    queryKey: ['/api/conversas'],
    queryFn: api.getConversas,
    refetchInterval: 3000, // Auto-refresh every 3 seconds for real-time badge updates
    staleTime: 0,
  });

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

  const { data: tickets } = useQuery({
    queryKey: ['/api/tickets'],
    queryFn: api.getTickets,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
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
    // Verifica se é a rota exata ou uma subrota
    if (path === '/') {
      return location === '/';
    }
    return location.startsWith(path);
  };

  return (
    <div className={cn(
      "h-screen bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-700/50 flex flex-col shadow-xl transition-all duration-300",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700/50 relative">
        <div className={cn(
          "flex items-center gap-3",
          isCollapsed && "justify-center"
        )}>
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
            <Tv className="w-8 h-8 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                TV ON
              </h1>
              <p className="text-slate-400 text-sm">Sistema de Gestão</p>
            </div>
          )}
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-800 border border-slate-700 rounded-full p-1 hover:bg-slate-700 transition-colors shadow-lg"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>
      
      <nav className="flex-1 px-4 pb-4 pt-2 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isPathActive(item.path);
            const badgeCount = item.badge ? getBadgeCount(item.badge) : 0;
            
            const linkContent = (
              <Link
                href={item.path}
                className={cn(
                  "flex items-center gap-3 py-3 rounded-xl transition-all duration-200 relative",
                  isActive 
                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800/50',
                  isCollapsed ? "px-3 justify-center" : "px-4"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  isActive ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/30' : 'bg-slate-800/50'
                )}>
                  <Icon className={cn(
                    "w-5 h-5",
                    isActive ? 'text-blue-400' : 'text-slate-400'
                  )} />
                </div>
                {!isCollapsed && (
                  <span className="flex-1 font-medium">{item.label}</span>
                )}
                {badgeCount > 0 && (
                  <Badge className={cn(
                    "bg-gradient-to-r from-red-500 to-red-600 text-white border-0 text-xs font-bold shadow-md",
                    isCollapsed ? "absolute -top-1 -right-1 min-w-[18px] h-[18px] p-0 flex items-center justify-center" : ""
                  )}>
                    {badgeCount}
                  </Badge>
                )}
              </Link>
            );
            
            return (
              <li key={item.path}>
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkContent
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* Notifications Toggle Button */}
      <div className="p-4 border-t border-slate-700/50 space-y-2">
        {isCollapsed ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleToggleNotifications}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full p-2 justify-center transition-all",
                    notificationsSilenced 
                      ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' 
                      : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                  )}
                >
                  {notificationsSilenced ? (
                    <BellOff className="w-5 h-5" />
                  ) : (
                    <Bell className="w-5 h-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{notificationsSilenced ? "Notificações Silenciadas" : "Notificações Ativas"}</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={async () => {
                    try {
                      await fetch('/api/logout', { method: 'POST' });
                      window.location.href = '/';
                    } catch (error) {
                      console.error('Logout error:', error);
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full p-2 justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Sair</p>
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <Button
              onClick={handleToggleNotifications}
              variant="ghost"
              size="sm"
              className={cn(
                "w-full gap-2 justify-start px-4 py-3 transition-all",
                notificationsSilenced 
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' 
                  : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
              )}
            >
              <div className="p-2 rounded-lg bg-slate-800/50">
                {notificationsSilenced ? (
                  <BellOff className="w-5 h-5" />
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </div>
              <span className="flex-1 font-medium text-left">
                {notificationsSilenced ? "Silenciado" : "Notificações"}
              </span>
            </Button>
            
            <Button
              onClick={async () => {
                try {
                  await fetch('/api/logout', { method: 'POST' });
                  window.location.href = '/';
                } catch (error) {
                  console.error('Logout error:', error);
                }
              }}
              variant="ghost"
              size="sm"
              className="w-full gap-2 justify-start px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <div className="p-2 rounded-lg bg-slate-800/50">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="flex-1 font-medium text-left">
                Sair
              </span>
            </Button>
          </>
        )}
      </div>

    </div>
  );
}
