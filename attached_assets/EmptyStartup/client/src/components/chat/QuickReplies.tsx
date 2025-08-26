import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Zap,
  Clock,
  ThumbsUp,
  Calendar,
  HelpCircle,
  CheckCircle,
  XCircle,
  Heart,
  Star
} from 'lucide-react';

interface QuickRepliesProps {
  onReplySelect: (reply: string) => void;
}

export function QuickReplies({ onReplySelect }: QuickRepliesProps) {
  const quickReplies = [
    { icon: CheckCircle, text: 'Sim', color: 'text-green-400' },
    { icon: XCircle, text: 'Não', color: 'text-red-400' },
    { icon: HelpCircle, text: 'Ajuda', color: 'text-blue-400' },
    { icon: Heart, text: 'Obrigado!', color: 'text-pink-400' },
    { icon: Zap, text: 'Urgente!', color: 'text-orange-400' },
  ];

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 p-2">
        {quickReplies.map((reply, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onReplySelect(reply.text)}
            className="flex items-center gap-1 shrink-0 bg-slate-700/50 border-slate-600 hover:bg-slate-700"
          >
            <reply.icon className={`w-3 h-3 ${reply.color}`} />
            <span className="text-xs">{reply.text}</span>
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}