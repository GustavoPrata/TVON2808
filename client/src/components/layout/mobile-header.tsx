import { Menu, X, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ExtensionStatusIndicator } from '@/components/extension-status-indicator';
import { useWebSocket } from '@/hooks/use-websocket';

interface MobileHeaderProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileHeader({ isOpen, onToggle }: MobileHeaderProps) {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 to-slate-950 border-b border-slate-700/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
            <Tv className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            TV ON
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          <ExtensionStatusIndicator />
          
          <Button
            onClick={onToggle}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {isOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}