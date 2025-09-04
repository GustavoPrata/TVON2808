import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Clock, Reply, Forward, Copy, Trash2, Download, MoreVertical, FileText, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ImageViewer } from './ImageViewer';
import { AudioMessage } from './AudioMessage';

interface MessageBubbleProps {
  message: {
    id: number;
    conteudo: string;
    remetente: string;
    timestamp: string;
    tipo?: string;
    mediaUrl?: string;
    metadados?: any;
    status?: {
      sent?: boolean;
      delivered?: boolean;
      read?: boolean;
    };
    isReply?: boolean;
    replyTo?: {
      content: string;
      sender: string;
    };
    deletada?: boolean;
    deletadaEm?: string;
    conteudoOriginal?: string;
    editada?: boolean;
    editadaEm?: string;
  };
  isOwn: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  contactName?: string;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  isSelected,
  onSelect,
  onReply,
  onForward,
  onDelete,
  onCopy,
  onEdit,
  contactName,
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
}: MessageBubbleProps) {
  const [showImageViewer, setShowImageViewer] = useState(false);
  
  // Function to format text with WhatsApp-style formatting (bold and italic)
  const formatMessageText = (text: string) => {
    if (!text) return null;
    
    // Regular expression to match bold (*text*) and italic (_text_) patterns
    const formatPattern = /(\*[^*]+\*|_[^_]+_)/g;
    const parts = text.split(formatPattern);
    
    return parts.map((part, index) => {
      // Check if this part is wrapped in asterisks (bold)
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        // Remove asterisks and make it bold
        return (
          <strong key={index} className="font-bold">
            {part.slice(1, -1)}
          </strong>
        );
      }
      // Check if this part is wrapped in underscores (italic)
      if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
        // Remove underscores and make it italic
        return (
          <em key={index} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };
  
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm', { locale: ptBR });
  };

  const renderStatus = () => {
    if (!isOwn) return null;
    
    if (!message.status?.sent) {
      return <Clock className="w-3 h-3 text-slate-400" />;
    }
    
    if (message.status?.read) {
      return <CheckCheck className="w-3 h-3 text-blue-400" />;
    }
    
    if (message.status?.delivered) {
      return <CheckCheck className="w-3 h-3 text-slate-400" />;
    }
    
    return <Check className="w-3 h-3 text-slate-400" />;
  };

  const renderMedia = () => {
    if (!message.mediaUrl) return null;

    if (message.tipo === 'image') {
      return (
        <>
          <div className="relative group cursor-pointer" onClick={() => setShowImageViewer(true)}>
            <img
              src={message.mediaUrl}
              alt="Imagem"
              className="rounded-lg max-w-sm w-full hover:brightness-95 transition-all duration-200"
              style={{ maxHeight: '400px', objectFit: 'cover' }}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded-lg" />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black/70 rounded-full p-2 backdrop-blur-sm">
                <Download 
                  className="w-5 h-5 text-white" 
                  onClick={(e) => {
                    e.stopPropagation();
                    const link = document.createElement('a');
                    link.href = message.mediaUrl!;
                    link.download = 'imagem';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                />
              </div>
            </div>
          </div>
          {showImageViewer && (
            <ImageViewer
              src={message.mediaUrl!}
              alt="Imagem"
              isOpen={showImageViewer}
              onClose={() => setShowImageViewer(false)}
            />
          )}
        </>
      );
    }

    if (message.tipo === 'video') {
      return (
        <div className="relative">
          <video 
            controls 
            className="rounded-lg max-w-xs"
            preload="metadata"
          >
            <source src={message.mediaUrl} type="video/mp4" />
            Seu navegador não suporta vídeos.
          </video>
        </div>
      );
    }

    if (message.tipo === 'audio') {
      return (
        <AudioMessage
          audioUrl={message.mediaUrl}
          duration={message.metadados?.duration || 0}
          isFromMe={isOwn}
          timestamp={new Date(message.timestamp)}
          status={isOwn ? message.status : undefined}
        />
      );
    }

    if (message.tipo === 'document') {
      const fileName = message.conteudo || 'Documento';
      const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
      
      return (
        <a 
          href={message.mediaUrl}
          download={fileName}
          className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700/70 transition-colors no-underline"
        >
          <div className="flex-shrink-0">
            <FileText className="w-5 h-5 text-slate-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{fileName}</p>
            <p className="text-xs text-slate-400 uppercase">{fileExt}</p>
          </div>
          <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </a>
      );
    }

    if (message.tipo === 'sticker') {
      return (
        <div className="relative">
          <img 
            src={message.mediaUrl} 
            alt="Figurinha"
            className="max-w-[200px] max-h-[200px] cursor-pointer"
            onClick={() => setShowImageViewer(true)}
          />
          {showImageViewer && (
            <ImageViewer
              src={message.mediaUrl!}
              alt="Figurinha"
              isOpen={showImageViewer}
              onClose={() => setShowImageViewer(false)}
            />
          )}
        </div>
      );
    }

    return null;
  };

  const messageContent = (
    <div
      className={cn(
        "group relative max-w-[320px] transition-all duration-200",
        isOwn ? "ml-auto" : "mr-auto",
        isSelected && "ring-2 ring-blue-500 ring-offset-2 ring-offset-dark-background"
      )}
    >
      <div className={cn(
        "flex items-end gap-2",
        isOwn && "flex-row-reverse"
      )}>

        
        <div className={cn(
            "relative px-3 py-2 rounded-2xl",
            isOwn 
              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white" 
              : "bg-slate-700 text-slate-100",
            isFirstInGroup && !isOwn && "rounded-tl-sm",
            isFirstInGroup && isOwn && "rounded-tr-sm",
            "shadow-lg"
          )}>
            {message.isReply && message.replyTo && (
              <div className={cn(
                "mb-2 p-2 rounded-lg text-xs",
                isOwn ? "bg-blue-700/50" : "bg-slate-800/50"
              )}>
                <div className="font-medium opacity-70">{message.replyTo.sender}</div>
                <div className="opacity-50 line-clamp-1">{message.replyTo.content}</div>
              </div>
            )}
            
            {message.deletada ? (
              <div>
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "text-sm italic opacity-70",
                    isOwn ? "text-blue-100" : "text-slate-400"
                  )}>
                    <span>🚫 Mensagem apagada</span>
                    {message.tipo && message.tipo !== 'text' && (
                      <span className="ml-1 text-xs">
                        ({message.tipo === 'audio' ? '🎵 Áudio' : 
                          message.tipo === 'image' ? '📷 Foto' : 
                          message.tipo === 'video' ? '🎬 Vídeo' : 
                          message.tipo === 'document' ? '📄 Documento' : 
                          message.tipo === 'sticker' ? '✨ Figurinha' :
                          message.tipo})
                      </span>
                    )}
                  </p>
                </div>
                {(message.conteudo || message.mediaUrl) && (
                  <div className={cn(
                    "mt-2 p-2 rounded text-xs",
                    isOwn ? "bg-blue-700/20" : "bg-slate-800/20"
                  )}>
                    {/* Show original media if it was media */}
                    {message.mediaUrl && message.tipo !== 'text' && (
                      <div className="mb-2 opacity-50">
                        {message.tipo === 'audio' && (
                          <AudioMessage
                            audioUrl={message.mediaUrl}
                            duration={message.metadados?.duration || 0}
                            isFromMe={isOwn}
                            timestamp={new Date(message.timestamp)}
                            status={undefined}
                          />
                        )}
                        {message.tipo === 'image' && (
                          <img
                            src={message.mediaUrl}
                            alt="Imagem apagada"
                            className="rounded-lg max-w-[200px] opacity-40"
                          />
                        )}
                        {message.tipo === 'video' && (
                          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                            <p className="text-xs">🎬 Vídeo apagado</p>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Show current content (not original) when deleted */}
                    {message.conteudo && (
                      <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere opacity-50 line-through max-w-[280px] overflow-hidden"
                           style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {formatMessageText(message.conteudo)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {renderMedia()}
                {/* Only show text content for non-media messages */}
                {message.conteudo && 
                 message.tipo !== 'audio' && 
                 message.tipo !== 'image' && 
                 message.tipo !== 'video' &&
                 message.tipo !== 'sticker' &&
                 message.tipo !== 'document' && (
                  <p className={cn(
                    "text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere",
                    "max-w-[280px] overflow-hidden",
                    message.mediaUrl && "mt-2"
                  )} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {formatMessageText(message.conteudo)}
                  </p>
                )}
              </>
            )}

            
            {message.editada && !message.deletada && (
              <div className="text-[10px] opacity-50 italic mt-1">
                editada
              </div>
            )}
            
            <div className="flex items-center gap-1 mt-1 justify-end">
              <span className="text-[10px] opacity-70">
                {formatTime(message.timestamp)}
              </span>
              {renderStatus()}
            </div>
            
            {/* Hover Actions - Hide for deleted messages */}
            {!message.deletada && (
              <div className={cn(
                "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity",
                isOwn ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"
              )}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded-full hover:bg-slate-600/50 transition-colors">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isOwn ? "end" : "start"} className="bg-dark-card border-slate-600">
                    <DropdownMenuItem onClick={onReply} className="hover:bg-slate-700">
                      <Reply className="w-4 h-4 mr-2" />
                      Responder
                    </DropdownMenuItem>
                    {/* Only show more options for own messages */}
                    {isOwn && (
                      <>
                        <DropdownMenuItem onClick={onForward} className="hover:bg-slate-700">
                          <Forward className="w-4 h-4 mr-2" />
                          Encaminhar
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={onCopy} className="hover:bg-slate-700">
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar
                    </DropdownMenuItem>
                    {isOwn && !message.deletada && onEdit && message.tipo === 'text' && (
                      <>
                        <DropdownMenuSeparator className="bg-slate-600" />
                        <DropdownMenuItem onClick={onEdit} className="hover:bg-slate-700">
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                      </>
                    )}
                    {/* Only allow delete for own messages */}
                    {isOwn && (
                      <>
                        <DropdownMenuSeparator className="bg-slate-600" />
                        <DropdownMenuItem onClick={onDelete} className="hover:bg-red-500/20 text-red-400">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Apagar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
        </div>
        
        {/* Reaction Display */}
        {(message.metadados?.reaction || message.metadados?.reactionFrom) && (
          <div className={cn(
            "absolute -bottom-3 bg-slate-800 rounded-full px-2 py-0.5 text-lg shadow-md",
            isOwn ? "right-4" : "left-4"
          )}>
            <span>{message.metadados?.reaction || ""}</span>
          </div>
        )}
      </div>
    </div>
  );

  return messageContent;
}