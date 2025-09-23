import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import { SettingsProvider } from "@/contexts/settings-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { WhatsAppNotifier } from "@/components/whatsapp-notifier";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import Clientes from "@/pages/clientes";
import ClienteDetalhes from "@/pages/cliente-detalhes";
import Vencimentos from "@/pages/vencimentos";
import Acessos from "@/pages/acessos";
import Apps from "@/pages/apps";
import Chat from "@/pages/chat";
import Tickets from "@/pages/tickets";
import BotConfig from "@/pages/bot-config-new";
import BotMenu from "@/pages/bot-menu";
import Logs from "@/pages/logs";
import WhatsAppSettings from "@/pages/whatsapp-settings";
import ConfigTV from "@/pages/config-tv";
import Testes from "@/pages/testes";
import Woovi from "@/pages/woovi";
import Indicacoes from "@/pages/indicacoes";
import Ajuda from "@/pages/ajuda";
import Anotacoes from "@/pages/anotacoes";
import PainelOffice from "@/pages/painel-office";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import { Loader2 } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clientes" component={Clientes} />
      <Route path="/clientes/:id" component={ClienteDetalhes} />
      <Route path="/vencimentos" component={Vencimentos} />
      <Route path="/acessos" component={Acessos} />
      <Route path="/apps" component={Apps} />
      <Route path="/chat" component={Chat} />
      <Route path="/tickets" component={Tickets} />
      <Route path="/bot-config" component={BotConfig} />
      <Route path="/bot-menu" component={BotMenu} />
      <Route path="/config-tv" component={ConfigTV} />
      <Route path="/whatsapp-settings" component={WhatsAppSettings} />
      <Route path="/woovi" component={Woovi} />
      <Route path="/testes" component={Testes} />
      <Route path="/indicacoes" component={Indicacoes} />
      <Route path="/ajuda" component={Ajuda} />
      <Route path="/anotacoes" component={Anotacoes} />
      <Route path="/painel-office" component={PainelOffice} />
      <Route path="/logs" component={Logs} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthProtectedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isMobile, isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useMobileMenu();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-300">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <SettingsProvider>
      <WebSocketProvider>
        <TooltipProvider>
          <WhatsAppNotifier />
          <div className="flex h-screen bg-slate-950 text-white">
            {/* Desktop Sidebar */}
            <div className="hidden md:block">
              <Sidebar />
            </div>
            
            {/* Mobile Header */}
            {isMobile && (
              <MobileHeader 
                isOpen={isMobileMenuOpen} 
                onToggle={toggleMobileMenu} 
              />
            )}
            
            {/* Mobile Sidebar */}
            {isMobile && (
              <MobileSidebar 
                isOpen={isMobileMenuOpen} 
                onClose={closeMobileMenu} 
              />
            )}
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Desktop Header */}
              {!isMobile && <Header />}
              
              {/* Content Area */}
              <main className="flex-1 overflow-auto p-3 md:p-6 bg-gradient-to-br from-slate-900 to-slate-950 pt-16 md:pt-0">
                <Router />
              </main>
            </div>
          </div>
          <Toaster />
        </TooltipProvider>
      </WebSocketProvider>
    </SettingsProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProtectedApp />
    </QueryClientProvider>
  );
}

export default App;
