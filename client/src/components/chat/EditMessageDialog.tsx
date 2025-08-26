import React, { useState, useEffect } from 'react';
import { X, Check, Smile } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/utils';

interface EditMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newContent: string) => void;
  originalMessage: {
    conteudo: string;
    timestamp: Date | string;
    remetente: string;
  };
}

export function EditMessageDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  originalMessage 
}: EditMessageDialogProps) {
  const [editedContent, setEditedContent] = useState(originalMessage.conteudo);
  const isOwn = originalMessage.remetente === 'sistema';

  useEffect(() => {
    setEditedContent(originalMessage.conteudo);
  }, [originalMessage.conteudo]);

  const handleConfirm = () => {
    if (editedContent.trim() && editedContent !== originalMessage.conteudo) {
      onConfirm(editedContent.trim());
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-lg font-normal">
            <span>Editar mensagem</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* Original Message Preview */}
          <div className={cn(
            "p-3 rounded-lg relative max-w-[80%]",
            isOwn 
              ? "bg-gradient-to-br from-blue-500 to-blue-600 ml-auto" 
              : "bg-slate-700"
          )}>
            <p className="text-sm whitespace-pre-wrap break-words">
              {originalMessage.conteudo}
            </p>
            <div className="flex items-center gap-1 mt-1 justify-end">
              <span className="text-[10px] opacity-70">
                {formatTime(originalMessage.timestamp)}
              </span>
              {isOwn && <Check className="w-3 h-3 opacity-70" />}
            </div>
          </div>

          {/* Edit Input */}
          <div className="relative">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite a mensagem editada..."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[80px] pr-10
                       resize-none"
              autoFocus
            />
            
            {/* Character count */}
            <div className="absolute bottom-2 right-2 text-xs text-slate-400">
              {editedContent.length}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 hover:bg-slate-800"
              disabled
              title="Emojis em breve"
            >
              <Smile className="h-5 w-5 text-slate-400" />
            </Button>

            <Button
              onClick={handleConfirm}
              disabled={!editedContent.trim() || editedContent === originalMessage.conteudo}
              className="bg-green-600 hover:bg-green-700 text-white rounded-full h-10 w-10 p-0
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}