import React, { useState } from 'react';
import { X, Send, Image, FileText, Video, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface MediaPreviewProps {
  file: File;
  onSend: (caption: string) => void;
  onCancel: () => void;
}

export function MediaPreview({ file, onSend, onCancel }: MediaPreviewProps) {
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState<string>('');
  
  React.useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [file]);

  const getFileIcon = () => {
    if (file.type.startsWith('image/')) return <Image className="w-8 h-8" />;
    if (file.type.startsWith('video/')) return <Video className="w-8 h-8" />;
    if (file.type.startsWith('audio/')) return <Music className="w-8 h-8" />;
    return <FileText className="w-8 h-8" />;
  };

  const handleSend = () => {
    onSend(caption);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <div className="flex items-center gap-3">
          <h2 className="text-white text-lg font-medium">Enviar {file.type.startsWith('image/') ? 'Imagem' : 'Arquivo'}</h2>
          <span className="text-slate-400 text-sm">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        {file.type.startsWith('image/') ? (
          <img
            src={preview}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        ) : file.type.startsWith('video/') ? (
          <video
            src={preview}
            controls
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          />
        ) : (
          <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center gap-4">
            {getFileIcon()}
            <div className="text-center">
              <p className="text-white font-medium text-lg">{file.name}</p>
              <p className="text-slate-400 text-sm mt-1">
                {file.type || 'Arquivo'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Caption and Send */}
      <div className="p-4 bg-black/50 border-t border-slate-700">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Adicione uma legenda..."
                className={cn(
                  "min-h-[44px] max-h-32 bg-slate-800 border-slate-600",
                  "text-white placeholder:text-slate-500 resize-none",
                  "focus:ring-2 focus:ring-green-500/50"
                )}
                onKeyPress={handleKeyPress}
                autoFocus
              />
            </div>
            <Button
              onClick={handleSend}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="mt-2 text-xs text-slate-400">
            Pressione Enter para enviar • Shift+Enter para nova linha
          </div>
        </div>
      </div>
    </div>
  );
}