import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExtensionStatus {
  active: boolean;
  loggedIn: boolean;
  currentUrl?: string;
  lastSeen?: string;
  secondsSinceLastHeartbeat?: number;
  extensionVersion?: string;
}

export function ExtensionStatusIndicator() {
  const { data: status, isLoading } = useQuery<ExtensionStatus>({
    queryKey: ["/api/extension/status"],
    refetchInterval: 5000, // Poll every 5 seconds
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Verificando...
        </span>
      </div>
    );
  }

  // Determine status state
  const getStatusInfo = () => {
    if (!status || !status.active) {
      return {
        icon: XCircle,
        text: "Extensão Inativa",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/20",
        pulseColor: "bg-red-500",
        description: "A extensão não está respondendo",
      };
    }

    if (!status.loggedIn) {
      return {
        icon: AlertCircle,
        text: "Extensão Ativa - Deslogada",
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/20",
        pulseColor: "bg-yellow-500",
        description: "Extensão ativa mas não está logada no OnlineOffice",
      };
    }

    return {
      icon: CheckCircle2,
      text: "Extensão Ativa e Logada",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
      pulseColor: "bg-green-500",
      description: "Extensão funcionando corretamente",
    };
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  // Format last seen time
  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return "Nunca";
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s atrás`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    return `${Math.floor(diff / 3600)}h atrás`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            data-testid="extension-status-indicator"
            aria-label={statusInfo.description}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-200",
              statusInfo.bgColor,
              statusInfo.borderColor,
              "hover:scale-105 cursor-default"
            )}
          >
            <div className="relative">
              <Icon className={cn("h-3.5 w-3.5", statusInfo.color)} />
              {status?.active && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span
                    className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      statusInfo.pulseColor
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex rounded-full h-2 w-2",
                      statusInfo.pulseColor
                    )}
                  />
                </span>
              )}
            </div>
            <span className={cn("text-xs font-medium", statusInfo.color)}>
              {statusInfo.text}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">{statusInfo.description}</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between gap-4">
                <span>Status:</span>
                <span className="font-mono">
                  {status?.active ? "Ativa" : "Inativa"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Login:</span>
                <span className="font-mono">
                  {status?.loggedIn ? "Sim" : "Não"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Última resposta:</span>
                <span className="font-mono">
                  {formatLastSeen(status?.lastSeen)}
                </span>
              </div>
              {status?.currentUrl && (
                <div className="flex flex-col gap-1">
                  <span>URL atual:</span>
                  <span className="font-mono text-xs truncate">
                    {status.currentUrl}
                  </span>
                </div>
              )}
              {status?.extensionVersion && (
                <div className="flex justify-between gap-4">
                  <span>Versão:</span>
                  <span className="font-mono">{status.extensionVersion}</span>
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}