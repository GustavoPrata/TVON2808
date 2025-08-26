import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Paperclip, 
  Image, 
  FileText, 
  Camera, 
  Mic, 
  MapPin,
  User,
  Video
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface AttachmentMenuProps {
  onAttachmentSelect: (type: string) => void;
}

export function AttachmentMenu({ onAttachmentSelect }: AttachmentMenuProps) {
  const attachmentOptions = [
    { icon: Image, label: 'Imagem', type: 'image', color: 'text-green-400' },
    { icon: Video, label: 'Vídeo', type: 'video', color: 'text-pink-400' },
    { icon: FileText, label: 'Documento', type: 'document', color: 'text-purple-400' },
    { icon: Mic, label: 'Áudio', type: 'audio', color: 'text-red-400' },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Paperclip className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 bg-dark-surface border-slate-700" align="start" side="top">
        <div className="grid grid-cols-3 gap-2">
          {attachmentOptions.map((option) => (
            <button
              key={option.type}
              onClick={() => onAttachmentSelect(option.type)}
              className="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-slate-700 transition-colors group"
            >
              <div className={`p-2 rounded-full bg-slate-700 group-hover:bg-slate-600 transition-colors`}>
                <option.icon className={`w-5 h-5 ${option.color}`} />
              </div>
              <span className="text-xs mt-1 text-slate-400">{option.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}