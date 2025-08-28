import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SettingsProvider } from "@/contexts/settings-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { WhatsAppNotifier } from "@/components/whatsapp-notifier";
import Dashboard from "@/pages/dashboard";
import Clientes from "@/pages/clientes";
import ClienteDetalhes from "@/pages/cliente-detalhes";
import Vencimentos from "@/pages/vencimentos";
import Apps from "@/pages/apps";
import Chat from "@/pages/chat";
import Tickets from "@/pages/tickets";
import BotConfig from "@/pages/bot-config-new";
import Integracoes from "@/pages/integracoes";
import Logs from "@/pages/logs";
import WhatsAppSettings from "@/pages/whatsapp-settings";
import ConfigTV from "@/pages/config-tv";
import Testes from "@/pages/testes";
import Woovi from "@/pages/woovi";
import Indicacoes from "@/pages/indicacoes";
import Ajuda from "@/pages/ajuda";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clientes" component={Clientes} />
      <Route path="/clientes/:id" component={ClienteDetalhes} />
      <Route path="/vencimentos" component={Vencimentos} />
      <Route path="/apps" component={Apps} />
      <Route path="/chat" component={Chat} />
      <Route path="/tickets" component={Tickets} />
      <Route path="/bot-config" component={BotConfig} />
      <Route path="/integracoes" component={Integracoes} />
      <Route path="/config-tv" component={ConfigTV} />
      <Route path="/whatsapp-settings" component={WhatsAppSettings} />
      <Route path="/woovi" component={Woovi} />
      <Route path="/testes" component={Testes} />
      <Route path="/indicacoes" component={Indicacoes} />
      <Route path="/ajuda" component={Ajuda} />
      <Route path="/logs" component={Logs} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <WebSocketProvider>
          <TooltipProvider>
            <WhatsAppNotifier />
            <div className="flex h-screen bg-slate-950 text-white">
              <Sidebar />
              <main className="flex-1 overflow-auto p-6 bg-gradient-to-br from-slate-900 to-slate-950">
                <Router />
              </main>
            </div>
            <Toaster />
          </TooltipProvider>
        </WebSocketProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
