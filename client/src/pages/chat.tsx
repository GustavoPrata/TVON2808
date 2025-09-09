import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWebSocket } from '@/hooks/use-websocket';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Search, Send, Paperclip, Camera, Smile, User, Bot, Phone, MessageSquare, 
  Circle, Clock, CheckCheck, Check, QrCode, Wifi, WifiOff, Users, UserPlus, 
  AlertCircle, Loader2, X, MoreVertical, Archive, Trash2, Ban, Volume2, VolumeX,
  Star, Pin, Reply, Forward, Copy, Download, Image, FileText, Mic, Video, Info,
  Settings, LogOut, RefreshCw, Filter, Bell, BellOff, ExternalLink, ChevronDown,
  Plus, UserCheck, Sparkles, Ticket, CheckCircle, Zap, ChevronUp, ArrowLeft,
  Menu, ChevronRight, Edit2, Shield, Activity, Clock3, DollarSign, XCircle, Hash
} from 'lucide-react';

import defaultProfileIcon from '../assets/default-profile.webp';
import type { Conversa, Mensagem } from '@/types';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { AttachmentMenu } from '@/components/chat/AttachmentMenu';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { MediaPreview } from '@/components/chat/MediaPreview';
import { AudioRecorder } from '@/components/chat/AudioRecorder';
import { EditMessageDialog } from '@/components/chat/EditMessageDialog';
import { useSettings } from '@/contexts/settings-context';
import { CreateTestDialog } from '@/components/modals/create-test-dialog';
import { CreateClientDialog } from '@/components/modals/create-client-dialog';
import { TestDetailsDialog } from '@/components/modals/test-details-dialog';
import { DraggableTestChat } from '@/components/DraggableTestChat';
import { PixGeneratorSidebar } from '@/components/pix-generator-sidebar';


interface WhatsAppStatus {
  status: {
    connection: string;
  };
  qr: string | null;
}

interface ConversaWithDetails extends Conversa {
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
  isTyping?: boolean;
  isOnline?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  isCliente?: boolean;
  isTeste?: boolean;
  clienteNome?: string | null;
  clienteStatus?: string | null;
  profilePicture?: string | null;
  isTemporary?: boolean;
  hasOpenTicket?: boolean;
  ticket?: any;
  ultimoRemetente?: string;
  mensagemLida?: boolean;
  metadados?: string | null;
}

interface MessageStatus {
  sent: boolean;
  delivered: boolean;
  read: boolean;
  timestamp: Date;
}

export default function Chat() {
  const { showPhotosChat } = useSettings();
  const [location, navigate] = useLocation();
  const [selectedConversa, setSelectedConversa] = useState<ConversaWithDetails | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [contactFilter, setContactFilter] = useState<'novos' | 'clientes' | 'testes'>('novos');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationSound, setNotificationSound] = useState(true);
  const [autoDownloadMedia, setAutoDownloadMedia] = useState(true);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ content: string; sender: string; id?: number } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; type: string } | null>(null);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: number; conteudo: string; timestamp: Date | string; remetente: string } | null>(null);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showCreateTestDialog, setShowCreateTestDialog] = useState(false);
  const [showTestDetailsDialog, setShowTestDetailsDialog] = useState(false);
  const [showTestChatModal, setShowTestChatModal] = useState(false);
  // Menu lateral sempre visível - removido estado showSidebar
  const [showCreateClientDialog, setShowCreateClientDialog] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'bot' | 'human'>('all');
  const [searchById, setSearchById] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState<string>('');
  const [newChatNumber, setNewChatNumber] = useState('');
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number>(0);
  const [autoCloseActive, setAutoCloseActive] = useState(false);
  const [ticketExpanded, setTicketExpanded] = useState(false); // Collapsed by default
  // Estado do PIX por conversa
  const [pixStateByConversation, setPixStateByConversation] = useState<Map<string, any>>(new Map());
  const [isLoadingPixState, setIsLoadingPixState] = useState(false);
  const [isSavingPixState, setIsSavingPixState] = useState(false);
  const pixStateSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const { sendMessage, onMessage, offMessage } = useWebSocket();
  const { toast } = useToast();

  // Get parameters from URL
  const urlParams = new URLSearchParams(window.location.search);
  const phoneFromUrl = urlParams.get('phone');
  const conversaIdFromUrl = urlParams.get('conversaId');
  const tabFromUrl = urlParams.get('tab');

  // WhatsApp Status Query
  const { data: whatsappStatus } = useQuery<WhatsAppStatus>({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: 2000, // Check status every 2 seconds
  });

  // Get conversations with client info
  const { data: conversas = [], refetch: refetchConversas } = useQuery<ConversaWithDetails[]>({
    queryKey: ['/api/whatsapp/conversations'],
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    staleTime: 0,
    gcTime: 0,
  });

  // Get sistemas for test creation
  const { data: sistemas } = useQuery({
    queryKey: ['/api/sistemas'],
  });

  // Get tickets
  const { data: tickets = [] } = useQuery<any[]>({
    queryKey: ['/api/tickets'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch all clients for new chat dialog
  const { data: allClientes = [] } = useQuery<any[]>({
    queryKey: ['/api/clientes'],
  });

  // Get quick messages
  const { data: quickMessages = [] } = useQuery<any[]>({
    queryKey: ['/api/mensagens-rapidas/ativas'],
    enabled: !!selectedConversa,
  });

  // Update when conversations or tickets change
  useEffect(() => {
    // Update selected conversation when conversations list changes
    if (selectedConversa && conversas) {
      const updatedConversation = conversas.find(conv => conv.id === selectedConversa.id);
      if (updatedConversation) {
        // Find open ticket for this conversation
        const openTicket = tickets.find((ticket: any) => 
          ticket.conversaId === updatedConversation.id && ticket.status === 'aberto'
        );
        
        // Update with ticket information
        setSelectedConversa({
          ...updatedConversation,
          hasOpenTicket: !!openTicket,
          ticket: openTicket
        });
      }
    }
  }, [conversas, tickets]);


  // Countdown timer effect
  useEffect(() => {
    if (autoCloseActive && autoCloseCountdown > 0) {
      const countdownInterval = setInterval(() => {
        setAutoCloseCountdown(prev => {
          if (prev <= 1) {
            setAutoCloseActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [autoCloseActive, autoCloseCountdown]);

  // Auto-resize textarea when message text changes
  useEffect(() => {
    const textarea = document.querySelector('textarea[placeholder="Digite sua mensagem..."]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [messageText]);

  // Check timer status when selecting a conversation with open ticket
  useEffect(() => {
    if (selectedConversa?.hasOpenTicket && selectedConversa?.ticket?.id) {
      // Check if timer is active on server
      apiRequest("GET", `/api/tickets/${selectedConversa.ticket.id}/auto-close-status`)
        .then(response => response.json())
        .then(data => {
          if (data.active && data.remainingSeconds > 0) {
            // Timer is active on server, sync frontend state
            setAutoCloseActive(true);
            // Use actual remaining time from server
            setAutoCloseCountdown(data.remainingSeconds);
            
            // Clear any existing timer
            if (autoCloseTimer) {
              clearInterval(autoCloseTimer);
            }
            
            // Start frontend countdown
            const countdownInterval = setInterval(() => {
              setAutoCloseCountdown(prev => {
                if (prev <= 1) {
                  clearInterval(countdownInterval);
                  setAutoCloseActive(false);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
            
            setAutoCloseTimer(countdownInterval as any);
          } else {
            // No timer active on server or timer expired
            if (autoCloseTimer) {
              clearInterval(autoCloseTimer);
              setAutoCloseTimer(null);
            }
            setAutoCloseActive(false);
            setAutoCloseCountdown(0);
          }
        })
        .catch(error => {
          console.error("Erro ao verificar status do timer:", error);
        });
    } else if (!selectedConversa?.hasOpenTicket) {
      // No open ticket, clear timer states
      if (autoCloseTimer) {
        clearInterval(autoCloseTimer);
        setAutoCloseTimer(null);
      }
      setAutoCloseActive(false);
      setAutoCloseCountdown(0);
    }
  }, [selectedConversa?.id, selectedConversa?.hasOpenTicket, selectedConversa?.ticket?.id]);

  // Cancel timer when conversation changes
  useEffect(() => {
    return () => {
      // Cancel server-side timer if active
      if (autoCloseActive && selectedConversa?.ticket?.id) {
        apiRequest("DELETE", `/api/tickets/${selectedConversa.ticket.id}/auto-close`)
          .catch(error => console.error("Erro ao cancelar timer no servidor:", error));
      }
      
      // Clear frontend countdown timer
      if (autoCloseTimer) {
        clearInterval(autoCloseTimer);
        setAutoCloseTimer(null);
        setAutoCloseActive(false);
        setAutoCloseCountdown(0);
      }
    };
  }, [selectedConversa?.id]);

  // Handle phone parameter from URL
  useEffect(() => {
    if (phoneFromUrl && conversas) {
      // Find conversation with matching phone number
      const conversation = conversas.find(conv => conv.telefone === phoneFromUrl);
      if (conversation) {
        // Find open ticket for this conversation
        const openTicket = tickets.find((ticket: any) => 
          ticket.conversaId === conversation.id && ticket.status === 'aberto'
        );
        setSelectedConversa({
          ...conversation,
          hasOpenTicket: !!openTicket,
          ticket: openTicket
        });
      } else if (conversas.length >= 0) {
        // If conversation doesn't exist, create a temporary one
        const tempConversa: ConversaWithDetails = {
          id: -1, // Temporary ID
          telefone: phoneFromUrl,
          nome: formatPhoneNumber(phoneFromUrl),
          ultimaMensagem: '',
          dataUltimaMensagem: new Date().toISOString(),
          status: 'ativo',
          modoAtendimento: 'bot',
          mensagensNaoLidas: 0,
          isTemporary: true,
          isOnline: true,
          ultimoRemetente: 'sistema',
          mensagemLida: true
        };
        setSelectedConversa(tempConversa);
      }
      // Clear the URL parameter after handling
      const url = new URL(window.location.href);
      url.searchParams.delete('phone');
      window.history.replaceState({}, '', url.toString());
    }
  }, [phoneFromUrl, conversas, tickets]);

  // Handle conversaId and tab parameters from URL
  useEffect(() => {
    if (conversaIdFromUrl && conversas) {
      // Find conversation with matching ID
      const conversation = conversas.find(conv => conv.id === parseInt(conversaIdFromUrl));
      if (conversation) {
        // Find open ticket for this conversation
        const openTicket = tickets.find((ticket: any) => 
          ticket.conversaId === conversation.id && ticket.status === 'aberto'
        );
        setSelectedConversa({
          ...conversation,
          hasOpenTicket: !!openTicket,
          ticket: openTicket
        });
        
        // Set the correct tab based on conversation type
        if (conversation.isTeste) {
          setContactFilter('testes');
        } else if (conversation.isCliente) {
          setContactFilter('clientes');
        } else {
          setContactFilter('novos');
        }
        
        // Clear the URL parameters after handling
        const url = new URL(window.location.href);
        url.searchParams.delete('conversaId');
        url.searchParams.delete('tab');
        window.history.replaceState({}, '', url.toString());
      }
    }
    
    // Handle tab parameter separately if no conversaId
    if (tabFromUrl && !conversaIdFromUrl) {
      if (tabFromUrl === 'clientes' || tabFromUrl === 'testes' || tabFromUrl === 'novos') {
        setContactFilter(tabFromUrl);
      }
      // Clear the tab parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState({}, '', url.toString());
    }
  }, [conversaIdFromUrl, tabFromUrl, conversas, tickets]);

  // Get messages for selected conversation with pagination
  const { data: mensagens, refetch: refetchMensagens, isLoading: isLoadingMessages } = useQuery({
    queryKey: [`/api/whatsapp/conversations/${selectedConversa?.id}/messages?limit=30&offset=0`],
    enabled: !!selectedConversa && selectedConversa.id !== -1, // Don't fetch for temporary conversations
    refetchInterval: false,
    staleTime: 0,
  });

  // Connect/Disconnect mutations
  const connectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/connect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
    }
  });

  // Send message mutation - Used for temporary conversations
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { to: string; message: string }) => {
      console.log('Sending message to:', data.to);
      const result = await apiRequest('POST', '/api/whatsapp/send', data);
      console.log('Send message result:', result);
      return result;
    },
    onSuccess: async (responseData) => {
      setMessageText('');
      
      // If not a temporary conversation, refresh messages
      if (selectedConversa?.id !== -1) {
        refetchMensagens();
      }
      // For temporary conversations, the WebSocket event will handle the update
    },
    onError: (error: any) => {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.response?.data?.error || 'Ocorreu um erro ao enviar a mensagem. Verifique a conexão do WhatsApp.',
        variant: 'destructive'
      });
    }
  });

  // Check if user is at bottom of messages
  const checkIfAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
  };

  // Handle scroll to detect if user is at bottom and load more messages
  const handleScroll = () => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);
    if (atBottom) {
      setShowNewMessageIndicator(false);
    }
    
    // Removed automatic loading on scroll - now manual via button
  };

  // Load more messages
  const loadMoreMessages = async () => {
    if (!selectedConversa || isLoadingMore || !hasMoreMessages) return;
    
    setIsLoadingMore(true);
    const newOffset = allMessages.length; // Use allMessages.length instead of messageOffset
    
    try {
      // Fetching messages with offset
      const response = await fetch(`/api/whatsapp/conversations/${selectedConversa.id}/messages?limit=30&offset=${newOffset}`);
      const newMessages = await response.json();
      
      // Messages received from server
      
      // Check if newMessages is an array
      if (!Array.isArray(newMessages)) {
        console.error('Invalid response format for messages:', newMessages);
        setHasMoreMessages(false);
        return;
      }
      
      if (newMessages.length < 30) {
        setHasMoreMessages(false);
        // No more messages to load
      }
      
      if (newMessages.length > 0) {
        // Adding messages to existing list
        setAllMessages(prev => [...newMessages, ...prev]);
        // Remove messageOffset update since we're now using allMessages.length
        
        // Preserve scroll position
        if (messagesContainerRef.current) {
          const prevScrollHeight = messagesContainerRef.current.scrollHeight;
          setTimeout(() => {
            if (messagesContainerRef.current) {
              const newScrollHeight = messagesContainerRef.current.scrollHeight;
              messagesContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
            }
          }, 0);
        }
      } else {
        // No more messages to load
        setHasMoreMessages(false);
        // No messages returned - end of conversation history
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
      setHasMoreMessages(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    if (!isMuted && notificationSound) {
      // Create audio element if not exists
      if (!notificationAudioRef.current) {
        notificationAudioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi2Hy/DWhjAGHGzA7+OZURE');
      }
      notificationAudioRef.current.play().catch(e => console.error('Audio play failed:', e));
    }
  };

  const scrollToBottom = (instant = false) => {
    if (messagesContainerRef.current) {
      // Use scrollTop directly for instant, reliable scrolling
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // Registering WebSocket handlers
    
    // Handle new messages via WebSocket
    const handleNewMessage = (messageData: any) => {
      // New message received - removed console logs
      
      // Update the conversation in the cache with new last message and timestamp
      // Also move the conversation to the top of the list
      queryClient.setQueryData(
        ['/api/whatsapp/conversations'],
        (oldData: any) => {
          if (!oldData) return [];
          
          // Find the conversation that received the message
          const updatedConversation = oldData.find((conv: any) => conv.id === messageData.conversaId);
          if (!updatedConversation) return oldData;
          
          // Update the conversation with new message data
          const updated = {
            ...updatedConversation,
            ultimaMensagem: messageData.conteudo,
            ultimoRemetente: messageData.remetente,
            dataUltimaMensagem: messageData.timestamp || new Date().toISOString(),
            tipoUltimaMensagem: messageData.tipo || 'text',
            mensagensNaoLidas: messageData.remetente !== 'sistema' && 
              (!selectedConversa || selectedConversa.id !== messageData.conversaId) 
                ? (updatedConversation.mensagensNaoLidas || 0) + 1 
                : updatedConversation.mensagensNaoLidas
          };
          
          // Remove the conversation from its current position and add it to the top
          const otherConversations = oldData.filter((conv: any) => conv.id !== messageData.conversaId);
          return [updated, ...otherConversations];
        }
      );
      
      if (selectedConversa && messageData.conversaId === selectedConversa.id) {
        // Message is for current conversation, updating
        // Check if message already exists (avoid duplicates)
        setAllMessages(prev => {
          const exists = prev.some(msg => {
            // Check by database ID first (most reliable)
            if (msg.id && messageData.id && msg.id === messageData.id) {
              return true;
            }
            
            // Check by WhatsApp ID
            if (msg.whatsappMessageId && messageData.whatsappMessageId && 
                msg.whatsappMessageId === messageData.whatsappMessageId) {
              return true;
            }
            
            // Check by metadados.whatsappMessageId
            if (msg.metadados?.whatsappMessageId && messageData.metadados?.whatsappMessageId &&
                msg.metadados.whatsappMessageId === messageData.metadados.whatsappMessageId) {
              return true;
            }
            
            // Check by content + remetente + time window (within 2 seconds)
            if (msg.conteudo === messageData.conteudo && 
                msg.remetente === messageData.remetente) {
              const msgTime = new Date(msg.timestamp).getTime();
              const newTime = new Date(messageData.timestamp || Date.now()).getTime();
              const timeDiff = Math.abs(msgTime - newTime);
              return timeDiff < 2000; // Within 2 seconds
            }
            
            return false;
          });
          
          if (!exists) {
            return [...prev, messageData];
          }
          return prev;
        });
        
        // Play sound for incoming messages
        if (!messageData.ehRemetente) {
          playNotificationSound();
          
          // Cancel auto-close timer if client sends a message
          if (autoCloseActive && messageData.remetente === 'cliente') {
            if (autoCloseTimer) {
              clearTimeout(autoCloseTimer);
              setAutoCloseTimer(null);
            }
            setAutoCloseActive(false);
            setAutoCloseCountdown(0);
            toast({
              title: "Fechamento automático cancelado",
              description: "Cliente enviou mensagem - timer de fechamento cancelado",
            });
          }
        }
        
        // Only auto-scroll if user is at bottom
        if (isAtBottom) {
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        } else {
          // Show new message indicator
          setShowNewMessageIndicator(true);
        }
        
        // NOVO: Marcar automaticamente como lida se estiver visualizando a conversa
        // e a mensagem for do cliente (não do sistema)
        if (messageData.remetente === 'cliente' && !messageData.lida) {
          // Marcar como lida no servidor
          apiRequest('POST', `/api/whatsapp/conversations/${selectedConversa.id}/read`)
            .then(() => {
              // Atualizar o contador local para 0
              queryClient.setQueryData(
                ['/api/whatsapp/conversations'],
                (oldData: any) => {
                  if (!oldData) return [];
                  return oldData.map((conv: any) => 
                    conv.id === selectedConversa.id 
                      ? { ...conv, mensagensNaoLidas: 0 }
                      : conv
                  );
                }
              );

              // Atualizar a conversa selecionada
              setSelectedConversa(prev => prev ? {
                ...prev,
                mensagensNaoLidas: 0
              } : null);
            })
            .catch(error => console.error('Erro ao marcar automaticamente como lida:', error));
        }
      } else {
        // Message is for different conversation or no conversation selected
      }
    };

    // Handle sent messages confirmation
    const handleMessageSent = (messageData: any) => {
      // Message sent event received
      
      if (!messageData || !messageData.conversaId) {
        console.error('Invalid message data received:', messageData);
        return;
      }
      
      // Extract the message from the data
      const newMessage = messageData.mensagem || messageData;
      
      // Update the conversation in the cache with new last message and timestamp
      // Also move the conversation to the top of the list
      queryClient.setQueryData(
        ['/api/whatsapp/conversations'],
        (oldData: any) => {
          if (!oldData) return [];
          
          // Find the conversation that sent the message
          const updatedConversation = oldData.find((conv: any) => conv.id === messageData.conversaId);
          if (!updatedConversation) return oldData;
          
          // Update the conversation with new message data
          const updated = {
            ...updatedConversation,
            ultimaMensagem: newMessage.conteudo,
            ultimoRemetente: 'sistema',
            dataUltimaMensagem: newMessage.timestamp || new Date().toISOString(),
            tipoUltimaMensagem: newMessage.tipo || 'text'
          };
          
          // Remove the conversation from its current position and add it to the top
          const otherConversations = oldData.filter((conv: any) => conv.id !== messageData.conversaId);
          return [updated, ...otherConversations];
        }
      );
      
      // If this is the selected conversation, update messages
      if (selectedConversa && messageData.conversaId === selectedConversa.id) {
        // Check if message already exists (avoid duplicates)
        setAllMessages(prev => {
          const exists = prev.some(msg => {
            // Check by database ID if available (most reliable)
            if (msg.id && newMessage.id && msg.id === newMessage.id) {
              return true;
            }
            
            // Check by WhatsApp ID
            if (msg.whatsappMessageId && newMessage.whatsappMessageId && 
                msg.whatsappMessageId === newMessage.whatsappMessageId) {
              return true;
            }
            
            // Check by metadados WhatsApp ID (for whatsapp_message events)
            if (msg.metadados?.whatsappMessageId && newMessage.metadados?.whatsappMessageId &&
                msg.metadados.whatsappMessageId === newMessage.metadados.whatsappMessageId) {
              return true;
            }
            
            // Check by content + remetente + time window (within 2 seconds)
            // Ensure both messages are from the same sender
            const sameRemetente = (msg.remetente === 'sistema' && (newMessage.remetente === 'sistema' || newMessage.ehRemetente)) ||
                                 (msg.remetente === 'cliente' && newMessage.remetente === 'cliente');
            
            if (msg.conteudo === newMessage.conteudo && sameRemetente) {
              const msgTime = new Date(msg.timestamp).getTime();
              const newTime = new Date(newMessage.timestamp || Date.now()).getTime();
              const timeDiff = Math.abs(msgTime - newTime);
              return timeDiff < 2000; // Within 2 seconds
            }
            
            return false;
          });
          
          if (!exists) {
            return [...prev, newMessage];
          }
          return prev;
        });
        
        // Always scroll to bottom for sent messages
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    };

    // Handle QR Code updates
    const handleQRCode = (data: { qr: string }) => {
      setQrCode(data.qr);
    };

    // Handle connection status updates
    const handleConnectionUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
    };

    const handleMessagesMarkedRead = (data: any) => {
      // Update conversations to reset unread count
      queryClient.setQueryData(
        ['/api/whatsapp/conversations'],
        (oldData: any) => {
          if (!oldData) return [];
          return oldData.map((conv: any) => 
            conv.id === data.conversaId 
              ? { ...conv, mensagensNaoLidas: 0 }
              : conv
          );
        }
      );
    };

    // Handle message deletion
    const handleMessageDeleted = (data: any) => {
      // Message deleted event received
      
      // Update the message in allMessages with complete data
      if (selectedConversa && data.conversaId === selectedConversa.id) {
        setAllMessages(prev => prev.map((msg: any) => 
          msg.id === data.messageId 
            ? { 
                ...msg, 
                ...data.messageData, // Use complete message data from backend
                deletada: true, 
                deletadaEm: data.deletadaEm 
              }
            : msg
        ));
      }
      
      // Update conversation list
      refetchConversas();
    };

    // Handle message editing
    const handleMessageEdited = (data: any) => {
      // Message edited event received
      
      // Update the message in allMessages with complete data
      if (selectedConversa && data.conversaId === selectedConversa.id) {
        setAllMessages(prev => prev.map((msg: any) => {
          if (msg.id === data.messageId) {
            const updatedMsg = { 
              ...msg, 
              ...data.messageData, // Use complete message data from backend
            };
            // Message updated with new content
            return updatedMsg;
          }
          return msg;
        }));
      }
      
      // Update conversation list
      refetchConversas();
    };

    // Handle conversation update (when last message changes)
    const handleConversationUpdated = (data: any) => {
      // Conversation updated event received
      
      // Update the conversation in the cache with the new last message
      queryClient.setQueryData(
        ['/api/whatsapp/conversations'],
        (oldData: any) => {
          if (!oldData) return [];
          return oldData.map((conv: any) => 
            conv.id === data.conversaId 
              ? { ...conv, ultimaMensagem: data.ultimaMensagem }
              : conv
          );
        }
      );
    };
    
    // Handle new conversation created
    const handleConversationCreated = (data: any) => {
      console.log('New conversation created:', data);
      
      // Immediately add the new conversation to the top of the list
      queryClient.setQueryData(
        ['/api/whatsapp/conversations'],
        (oldData: any) => {
          if (!oldData) return [data.conversation];
          
          // Check if conversation already exists
          const exists = oldData.some((conv: any) => conv.id === data.conversation.id);
          if (exists) {
            // Move to top if already exists
            const updated = oldData.find((conv: any) => conv.id === data.conversation.id);
            const others = oldData.filter((conv: any) => conv.id !== data.conversation.id);
            return [updated, ...others];
          }
          
          // Add new conversation at the top
          return [data.conversation, ...oldData];
        }
      );
      
      // Also refresh to ensure we have the latest data
      refetchConversas().then(() => {
        // If we're in a temporary conversation, switch to the new real one
        if (selectedConversa?.id === -1 && data.conversaId) {
          const newConversa = conversas?.find(c => c.id === data.conversaId);
          if (newConversa) {
            setSelectedConversa(newConversa);
          }
        }
      });
    };

    // Handler for ticket auto-closed
    const handleTicketAutoClosed = (data: any) => {
      // Clear any active timer states
      if (autoCloseTimer) {
        clearInterval(autoCloseTimer);
        setAutoCloseTimer(null);
      }
      setAutoCloseActive(false);
      setAutoCloseCountdown(0);
      
      // Update conversation if it's the selected one
      if (selectedConversa && selectedConversa.id === data.conversaId) {
        setSelectedConversa(prev => prev ? {
          ...prev,
          hasOpenTicket: false,
          ticket: undefined,
          modoAtendimento: 'bot'
        } : null);
        
        toast({
          title: "Ticket Fechado Automaticamente",
          description: "O ticket foi fechado após 5 minutos sem resposta do cliente",
        });
      }
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
    };

    // Handle message reactions
    const handleMessageReaction = (data: any) => {
      // Update the message with the reaction
      if (selectedConversa && data.conversaId === selectedConversa.id) {
        setAllMessages(prev => prev.map((msg: any) => {
          if (msg.id === data.targetMessageId) {
            return {
              ...msg,
              metadados: {
                ...(msg.metadados || {}),
                reaction: data.reaction,
                reactionFrom: data.from,
                reactionTimestamp: new Date().toISOString()
              }
            };
          }
          return msg;
        }));
      }
    };

    // Registering handler for whatsapp_message
    onMessage('whatsapp_message', handleNewMessage);
    onMessage('message_sent', handleMessageSent);
    onMessage('whatsapp_qr', handleQRCode);
    onMessage('connected', handleConnectionUpdate);
    onMessage('disconnected', handleConnectionUpdate);
    onMessage('messages_marked_read', handleMessagesMarkedRead);
    onMessage('message_deleted', handleMessageDeleted);
    onMessage('message_edited', handleMessageEdited);
    onMessage('message_reaction', handleMessageReaction);
    onMessage('conversation_updated', handleConversationUpdated);
    onMessage('conversation_created', handleConversationCreated);
    onMessage('ticket_auto_closed', handleTicketAutoClosed);

    return () => {
      // Unregistering WebSocket handlers
      offMessage('whatsapp_message');
      offMessage('message_sent');
      offMessage('whatsapp_qr');
      offMessage('connected');
      offMessage('disconnected');
      offMessage('messages_marked_read');
      offMessage('message_deleted');
      offMessage('message_edited');
      offMessage('message_reaction');
      offMessage('conversation_updated');
      offMessage('conversation_created');
      offMessage('ticket_auto_closed');
    };
  }, [selectedConversa, onMessage, offMessage, refetchMensagens, refetchConversas, isAtBottom, playNotificationSound, scrollToBottom]);

  // Scroll to bottom only when opening a conversation (not when loading more messages)
  useEffect(() => {
    if (allMessages && allMessages.length > 0 && messagesContainerRef.current && !isLoadingMore && messageOffset === 0) {
      // Force immediate scroll without any delay - only on initial load
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [selectedConversa?.id]); // Only trigger on conversation change

  // Also scroll when container height changes (new messages)
  useEffect(() => {
    if (messagesContainerRef.current && selectedConversa) {
      const observer = new ResizeObserver(() => {
        if (isAtBottom) {
          messagesContainerRef.current!.scrollTop = messagesContainerRef.current!.scrollHeight;
        }
      });
      
      observer.observe(messagesContainerRef.current);
      
      return () => {
        observer.disconnect();
      };
    }
  }, [selectedConversa, isAtBottom]);
  
  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (selectedConversa && selectedConversa.mensagensNaoLidas > 0) {
      // Mark as read via HTTP endpoint
      apiRequest('POST', `/api/whatsapp/conversations/${selectedConversa.id}/read`)
        .then(() => {
          // Update local state
          queryClient.setQueryData(
            ['/api/whatsapp/conversations'],
            (oldData: any) => {
              if (!oldData) return [];
              return oldData.map((conv: any) => 
                conv.id === selectedConversa.id 
                  ? { ...conv, mensagensNaoLidas: 0 }
                  : conv
              );
            }
          );
        })
        .catch((error: any) => console.error('Erro ao marcar como lido:', error));
    }
  }, [selectedConversa?.id]);

  // Update QR code from status
  useEffect(() => {
    if (whatsappStatus?.qr) {
      setQrCode(whatsappStatus.qr);
    } else if (whatsappStatus?.status.connection === 'open') {
      setQrCode(null);
    }
  }, [whatsappStatus]);

  // Reset messages when conversation changes
  // Load and save PIX state for conversation
  useEffect(() => {
    if (!selectedConversa || selectedConversa.id === -1) return;

    // Load PIX state from database
    const loadPixState = async () => {
      setIsLoadingPixState(true);
      try {
        const response = await fetch(`/api/pix/state/${selectedConversa.id}`);
        if (response.ok) {
          const state = await response.json();
          if (state) {
            setPixStateByConversation(prev => {
              const newMap = new Map(prev);
              newMap.set(`conv_${selectedConversa.id}`, state);
              return newMap;
            });
          }
        }
      } catch (error) {
        console.error('Erro ao carregar estado do PIX:', error);
      } finally {
        setIsLoadingPixState(false);
      }
    };

    loadPixState();
  }, [selectedConversa?.id]);

  // Save PIX state with debounce when it changes
  useEffect(() => {
    if (!selectedConversa || selectedConversa.id === -1) return;
    
    const currentState = pixStateByConversation.get(`conv_${selectedConversa.id}`);
    if (!currentState) return;

    // Clear existing timeout
    if (pixStateSaveTimeoutRef.current) {
      clearTimeout(pixStateSaveTimeoutRef.current);
    }

    // Set new timeout for saving (debounced)
    pixStateSaveTimeoutRef.current = setTimeout(async () => {
      setIsSavingPixState(true);
      try {
        await fetch(`/api/pix/state/${selectedConversa.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            telefone: selectedConversa.telefone,
            ...currentState
          }),
        });
      } catch (error) {
        console.error('Erro ao salvar estado do PIX:', error);
      } finally {
        setIsSavingPixState(false);
      }
    }, 1000); // 1 second debounce

    return () => {
      if (pixStateSaveTimeoutRef.current) {
        clearTimeout(pixStateSaveTimeoutRef.current);
      }
    };
  }, [pixStateByConversation, selectedConversa]);

  useEffect(() => {
    setAllMessages([]);
    setMessageOffset(0);
    setHasMoreMessages(false); // Don't assume there are more messages until we check
    setIsLoadingMore(false);
    setPendingImageUrl(null); // Clear pending image when changing conversations
  }, [selectedConversa?.id]);

  // Update allMessages when initial messages are loaded
  useEffect(() => {
    if (mensagens && Array.isArray(mensagens)) {
      // Initial messages loaded - mensagens comes directly from React Query
      // Remove duplicates by checking unique IDs
      const uniqueMessages = mensagens.filter((msg: any, index: number, self: any[]) => {
        // Remove duplicates by checking ID
        if (msg.id) {
          return self.findIndex(m => m.id === msg.id) === index;
        }
        // For messages without ID, check by content, sender and timestamp (within 1 second)
        return self.findIndex(m => 
          m.conteudo === msg.conteudo && 
          m.remetente === msg.remetente &&
          Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000
        ) === index;
      });
      
      setAllMessages(uniqueMessages);
      // Only show "load more" button if we got exactly 30 messages (meaning there might be more)
      setHasMoreMessages(uniqueMessages.length === 30);
    } else if (selectedConversa?.id === -1) {
      // For temporary conversations, start with empty messages
      setAllMessages([]);
      setHasMoreMessages(false);
    }
  }, [mensagens, selectedConversa?.id]); // Watch for changes in messages data and conversation

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversa) return;

    // Check if this is a temporary conversation (not yet saved to database)
    if (selectedConversa.id === -1) {
      // Use the API mutation to send message to a new contact
      const to = selectedConversa.telefone.includes('@s.whatsapp.net')
        ? selectedConversa.telefone
        : `${selectedConversa.telefone}@s.whatsapp.net`;
      
      sendMessageMutation.mutate({
        to: selectedConversa.telefone, // Use the phone number without @s.whatsapp.net
        message: messageText.trim()
      });
      
      // After sending, refresh conversations to get the real conversation
      setTimeout(() => {
        refetchConversas();
      }, 1000);
    } else {
      // Existing conversation - use WebSocket
      // Prepare message data
      const messageData: any = {
        conversaId: selectedConversa.id,
        telefone: selectedConversa.telefone,
        conteudo: messageText,
        tipo: 'text'
      };
      
      // Add reply information if replying
      if (replyingTo) {
        messageData.metadados = {
          reply: {
            content: replyingTo.content,
            sender: replyingTo.sender
          }
        };
        messageData.replyToId = replyingTo.id; // Include the ID of the message being replied to
      }
      
      // Send message via WebSocket
      sendMessage('send_message', messageData);
      
      // If there's a pending image, send it after the text message
      if (pendingImageUrl) {
        setTimeout(() => {
          sendMessage('send_message', {
            conversaId: selectedConversa.id,
            telefone: selectedConversa.telefone,
            conteudo: '',
            tipo: 'image',
            mediaUrl: pendingImageUrl
          });
          setPendingImageUrl(null); // Clear the pending image
        }, 500);
      }
      
      setReplyingTo(null); // Clear reply after sending
      // No need to refetch here, WebSocket will notify us
    }
    
    setMessageText('');
  };

  const handleSwitchMode = (modo: 'bot' | 'humano') => {
    if (!selectedConversa) return;

    sendMessage('switch_mode', {
      conversaId: selectedConversa.id,
      modo,
    });

    setSelectedConversa({ ...selectedConversa, modoAtendimento: modo });
  };

  const handleAttachment = async (type: string) => {
    if (type === 'image') {
      // Set accept for images only
      if (fileInputRef.current) {
        fileInputRef.current.accept = 'image/*';
        fileInputRef.current.click();
      }
    } else if (type === 'document') {
      // Set accept for documents
      if (fileInputRef.current) {
        fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar';
        fileInputRef.current.click();
      }
    } else if (type === 'video') {
      // Set accept for videos
      if (fileInputRef.current) {
        fileInputRef.current.accept = 'video/*';
        fileInputRef.current.click();
      }
    } else if (type === 'audio') {
      // Start audio recording
      setIsRecording(true);
    } else if (type === 'camera') {
      // Implement camera capture
      toast({
        title: "Câmera",
        description: "Função de câmera será implementada em breve",
      });
    } else if (type === 'location') {
      // Get and send location
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
          const locationMessage = `📍 Localização: ${position.coords.latitude}, ${position.coords.longitude}`;
          sendMessageMutation.mutate({
            to: selectedConversa!.telefone,
            message: locationMessage
          });
        });
      }
    } else if (type === 'contact') {
      toast({
        title: "Contatos",
        description: "Função de compartilhar contatos será implementada em breve",
      });
    }
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      toast({
        title: "Gravação finalizada",
        description: "Áudio gravado com sucesso",
      });
    } else {
      // Start recording
      setIsRecording(true);
      toast({
        title: "Gravando...",
        description: "Fale agora para gravar sua mensagem",
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedConversa) {
      // Show preview instead of sending immediately
      setSelectedFile(file);
    }
    
    // Reset the input
    event.target.value = '';
  };


  const handleSendMedia = (caption: string) => {
    if (!selectedFile || !selectedConversa) return;

    // For temporary conversations, show error
    if (selectedConversa.id === -1) {
      toast({
        title: "Erro",
        description: "Envie uma mensagem de texto primeiro para iniciar a conversa",
        variant: "destructive"
      });
      setSelectedFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      
      // Determine media type
      let tipo: string = 'document';
      let conteudo = caption || selectedFile.name;
      
      if (selectedFile.type.startsWith('image/')) {
        tipo = 'image';
        conteudo = caption || ''; // Images can have caption or empty content
      } else if (selectedFile.type.startsWith('video/')) {
        tipo = 'video';
        conteudo = caption || '[Vídeo]';
      } else if (selectedFile.type.startsWith('audio/')) {
        tipo = 'audio';
        conteudo = caption || '[Áudio]';
      } else {
        tipo = 'document';
        conteudo = caption || selectedFile.name;
      }
      
      // Send media message
      sendMessage('send_message', {
        conversaId: selectedConversa.id,
        telefone: selectedConversa.telefone,
        conteudo,
        tipo,
        mediaUrl: base64Data,
        metadados: {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type
        }
      });
      
      toast({
        title: "Mídia enviada",
        description: `${selectedFile.name} está sendo enviado...`,
      });

      // Clear selected file
      setSelectedFile(null);
      
      // Refresh messages after sending
      setTimeout(() => {
        refetchMensagens();
        scrollToBottom();
      }, 500);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSendAudio = (audioBlob: Blob, duration: number) => {
    // handleSendAudio called
    
    if (!audioBlob || !selectedConversa) {
      console.error('Missing audioBlob or selectedConversa');
      return;
    }

    // For temporary conversations, show error
    if (selectedConversa.id === -1) {
      toast({
        title: "Erro",
        description: "Envie uma mensagem de texto primeiro para iniciar a conversa",
        variant: "destructive"
      });
      setIsRecording(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      // Audio converted to base64
      
      // Use the actual mime type from the blob or fall back to a common type
      const mimeType = audioBlob.type || 'audio/ogg; codecs=opus';
      
      // Send audio message
      const messageData = {
        conversaId: selectedConversa.id,
        telefone: selectedConversa.telefone,
        conteudo: `[Áudio ${Math.floor(duration)}s]`,
        tipo: 'audio',
        mediaUrl: base64Data,
        metadados: {
          duration,
          mimeType
        }
      };
      
      // Sending audio message
      sendMessage('send_message', messageData);
      
      toast({
        title: "Áudio enviado",
        description: `Mensagem de voz enviada (${Math.floor(duration)}s)`,
      });

      // Clear recording state
      setIsRecording(false);
      
      // Refresh messages after sending
      setTimeout(() => {
        refetchMensagens();
        scrollToBottom();
      }, 500);
    };
    
    reader.onerror = (error) => {
      console.error('Error reading audio blob:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar áudio",
        variant: "destructive",
      });
    };
    
    reader.readAsDataURL(audioBlob);
  };

  const handleCancelMedia = () => {
    setSelectedFile(null);
  };

  const handleTyping = () => {
    if (!selectedConversa || selectedConversa.id === -1) return;
    
    sendMessage('typing', {
      conversaId: selectedConversa.id,
      isTyping: true,
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      sendMessage('typing', {
        conversaId: selectedConversa.id,
        isTyping: false,
      });
    }, 3000);
  };

  // Filter conversations based on contact type, attendance mode and search
  const filteredConversas = conversas?.filter(conv => {
    // Hide own WhatsApp number from the list
    if (conv.telefone.includes('14997220616')) return false;
    
    const matchesSearch = conv.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.telefone.includes(searchTerm);
    
    if (!matchesSearch) return false;
    
    // Filter by attendance mode
    if (attendanceFilter === 'bot' && conv.modoAtendimento !== 'bot') return false;
    if (attendanceFilter === 'human' && conv.modoAtendimento !== 'humano') return false;
    
    if (contactFilter === 'clientes') return conv.isCliente;
    if (contactFilter === 'novos') return !conv.isCliente && !conv.isTeste;
    if (contactFilter === 'testes') return conv.isTeste;
    return true;
  })?.map(conv => {
    // Add ticket information to each conversation
    const openTicket = tickets.find((ticket: any) => 
      ticket.conversaId === conv.id && ticket.status === 'aberto'
    );
    return {
      ...conv,
      hasOpenTicket: !!openTicket,
      ticket: openTicket
    };
  })?.sort((a, b) => {
    // First priority: Pin conversations with open tickets to the top
    if (a.hasOpenTicket && !b.hasOpenTicket) return -1;
    if (!a.hasOpenTicket && b.hasOpenTicket) return 1;
    
    // Second priority: Sort by last message date
    const dateA = a.dataUltimaMensagem ? new Date(a.dataUltimaMensagem).getTime() : 0;
    const dateB = b.dataUltimaMensagem ? new Date(b.dataUltimaMensagem).getTime() : 0;
    return dateB - dateA;
  });

  // Removed debug logs for filtered conversations

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };
  
  // Helper function to format last message date correctly
  const formatLastMessageDate = (timestamp: string | Date) => {
    if (!timestamp) return '';
    
    // Parse the timestamp and ensure it's a valid date
    const messageDate = new Date(timestamp);
    const now = new Date();
    
    // Use date-fns functions that handle timezone correctly
    if (isToday(messageDate)) {
      return formatTime(typeof timestamp === 'string' ? timestamp : timestamp.toISOString());
    } else if (isYesterday(messageDate)) {
      return 'Ontem';
    } else {
      // Check if within last week
      const daysAgo = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo < 7) {
        return messageDate.toLocaleDateString('pt-BR', { weekday: 'long' });
      } else {
        return messageDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Remove country code if present
    let number = digits;
    if (digits.startsWith('55') && digits.length > 11) {
      number = digits.substring(2);
    }
    
    // For numbers longer than 11 digits, try to extract just the phone part
    // Some numbers might have extra IDs concatenated
    if (number.length > 11) {
      // Try to extract the first 11 digits (mobile) or 10 digits (landline)
      // Check if starts with area code (2 digits) + 9 (mobile indicator)
      if (number[2] === '9') {
        number = number.slice(0, 11); // Mobile number
      } else {
        number = number.slice(0, 10); // Landline
      }
    }
    
    // Format as (xx) xxxxx-xxxx for 11 digits
    if (number.length === 11) {
      return `(${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
    }
    
    // Format as (xx) xxxx-xxxx for 10 digits
    if (number.length === 10) {
      return `(${number.slice(0, 2)}) ${number.slice(2, 6)}-${number.slice(6)}`;
    }
    
    // If still doesn't match, try to format what we have
    if (number.length >= 10) {
      const areaCode = number.slice(0, 2);
      const firstPart = number.slice(2, number.length > 10 ? 7 : 6);
      const secondPart = number.slice(number.length > 10 ? 7 : 6, 11);
      return `(${areaCode}) ${firstPart}-${secondPart}`;
    }
    
    // Return original if nothing works
    return phone;
  };

  // Start new chat mutation
  const startNewChatMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      // Format phone number for WhatsApp (add country code if not present)
      let formattedNumber = phoneNumber.replace(/\D/g, '');
      if (!formattedNumber.startsWith('55')) {
        formattedNumber = '55' + formattedNumber;
      }
      
      // First, check if conversation already exists
      const existingConv = conversas?.find(conv => conv.telefone === formattedNumber);
      if (existingConv) {
        return existingConv;
      }
      
      // Check if number has WhatsApp
      const response = await apiRequest('POST', '/api/whatsapp/check-number', { telefone: formattedNumber });
      const checkResponse = await response.json();
      
      // Log the verification result
      console.log('Verificação do número:', checkResponse);
      
      // Only block if explicitly false and no warning
      if (checkResponse.exists === false && !checkResponse.warning) {
        throw new Error('Este número não possui WhatsApp');
      }
      
      // If there's a warning, show it but allow continuing
      if (checkResponse.warning) {
        console.log('Aviso na verificação:', checkResponse.warning);
      }
      
      // Create a temporary conversation object (not saved to database)
      return {
        id: -1, // Temporary ID
        telefone: formattedNumber,
        nome: formatPhoneNumber(formattedNumber),
        ultimaMensagem: '',
        dataUltimaMensagem: new Date().toISOString(),
        status: 'ativo' as const,
        modoAtendimento: 'bot' as const,
        mensagensNaoLidas: 0,
        isTemporary: true // Mark as temporary
      } as ConversaWithDetails;
    },
    onSuccess: (conversa) => {
      setShowNewChatDialog(false);
      setNewChatNumber('');
      
      // Select the conversation (temporary or existing)
      setSelectedConversa(conversa);
    },
    onError: (error) => {
      console.error('Erro ao iniciar conversa:', error);
      
      const errorMessage = error.message === 'Este número não possui WhatsApp' 
        ? 'Este número não possui WhatsApp. Verifique e tente novamente.'
        : 'Não foi possível iniciar a conversa. Verifique o número e tente novamente.';
        
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });

  const isConnected = whatsappStatus?.status.connection === 'open';
  const isConnecting = whatsappStatus?.status.connection === 'connecting';

  return (
    <div className="h-[calc(100vh-40px)] flex flex-col">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
      
      {/* Compact Header */}
      <div className="bg-dark-surface border-b border-slate-700/50 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400">Conectado</span>
              </div>
            ) : isConnecting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                <span className="text-xs text-yellow-400">Conectando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span className="text-xs text-slate-400">Desconectado</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowTestChatModal(true)}
              size="sm"
              variant="ghost"
              className="text-xs h-7"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Testar Bot
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => refetchConversas()}
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
            
            {!isConnected && (
              <Button 
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || isConnecting}
                size="sm"
                className="text-xs h-7"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Wifi className="w-3 h-3 mr-1" />
                )}
                Conectar
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* QR Code Modal Expandido */}
      {showQrModal && qrCode && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000]"
          onClick={() => setShowQrModal(false)}
        >
          <div 
            className="bg-white p-8 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQrModal(false)}
                className="hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrCode)}`}
              alt="QR Code Ampliado"
              className="w-96 h-96"
            />
            <p className="text-center text-gray-600 mt-4">
              Escaneie com o WhatsApp para conectar
            </p>
          </div>
        </div>
      )}
      
      {/* QR Code Modal */}
      {qrCode && !isConnected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <Card className="w-96 bg-dark-surface border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="text-xl font-semibold">Conectar WhatsApp</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setQrCode(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div 
                className="bg-white p-4 rounded-lg cursor-pointer transition-all hover:scale-105 hover:shadow-xl"
                onClick={() => setShowQrModal(true)}
                title="Clique para ampliar"
              >
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
                  alt="QR Code"
                  className="w-64 h-64"
                  style={{ pointerEvents: 'none' }}
                />
              </div>
              <p className="text-sm text-slate-400 text-center">
                Abra o WhatsApp no seu telefone e escaneie o código QR acima
              </p>
              <Alert className="bg-amber-500/10 border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-300 text-sm">
                  Mantenha esta janela aberta até conectar
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Sidebar */}
        <div className="w-96 bg-dark-surface border-r border-slate-600 flex flex-col relative">
          <div className="p-4 border-b border-slate-600 relative z-50" style={{ isolation: 'isolate' }}>
            {/* Contact Type Filter */}
            <div className="relative z-10">
              <Tabs value={contactFilter} onValueChange={(value) => {
                setContactFilter(value as any);
                // Clear test phone number when changing tabs to prevent TestDetailsDialog from rendering
                setTestPhoneNumber('');
                setShowTestDetailsDialog(false);
              }}>
                <TabsList className="grid w-full grid-cols-3 bg-dark-card">
                  <TabsTrigger 
                    value="novos" 
                    className="data-[state=active]:bg-primary"
                    onClick={() => {
                      console.log('Clicked Novos tab');
                      setContactFilter('novos');
                    }}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Novos
                  </TabsTrigger>
                  <TabsTrigger 
                    value="clientes" 
                    className="data-[state=active]:bg-primary"
                    onClick={() => {
                      console.log('Clicked Clientes tab');
                      setContactFilter('clientes');
                    }}
                  >
                    <User className="w-4 h-4 mr-1" />
                    Clientes
                  </TabsTrigger>
                  <TabsTrigger 
                    value="testes" 
                    className="data-[state=active]:bg-primary"
                    onClick={() => {
                      console.log('Clicked Testes tab');
                      setContactFilter('testes');
                    }}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Testes
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex gap-2 mt-4">
              {/* Attendance Filter Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => {
                        // Cycle through: all -> bot -> human -> all
                        if (attendanceFilter === 'all') {
                          setAttendanceFilter('bot');
                        } else if (attendanceFilter === 'bot') {
                          setAttendanceFilter('human');
                        } else {
                          setAttendanceFilter('all');
                        }
                      }}
                      className={cn(
                        "p-2.5 transition-all",
                        attendanceFilter === 'bot' && "bg-green-600 hover:bg-green-700",
                        attendanceFilter === 'human' && "bg-blue-600 hover:bg-blue-700",
                        attendanceFilter === 'all' && "bg-slate-600 hover:bg-slate-700"
                      )}
                      size="icon"
                    >
                      {attendanceFilter === 'bot' ? (
                        <Bot className="w-5 h-5" />
                      ) : attendanceFilter === 'human' ? (
                        <User className="w-5 h-5" />
                      ) : (
                        <Users className="w-5 h-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {attendanceFilter === 'bot' && 'Mostrando apenas conversas com bot'}
                      {attendanceFilter === 'human' && 'Mostrando apenas conversas com atendente'}
                      {attendanceFilter === 'all' && 'Mostrando todas as conversas'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar conversa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-dark-card border-slate-600"
                />
              </div>
              
              {/* New Chat Button */}
              <Button
                onClick={() => setShowNewChatDialog(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 p-2.5"
                size="icon"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Active Filter Indicator */}
            {attendanceFilter !== 'all' && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  {attendanceFilter === 'bot' ? (
                    <>
                      <Bot className="w-3 h-3" />
                      <span>Conversas com Bot</span>
                    </>
                  ) : (
                    <>
                      <User className="w-3 h-3" />
                      <span>Conversas com Atendente</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setAttendanceFilter('all')}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        
        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="p-2 space-y-1 relative">
            {!isConnected ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <WifiOff className="w-12 h-12 mb-4" />
                <p className="text-center">WhatsApp não conectado</p>
                <p className="text-sm text-center mt-1">Clique em "Conectar WhatsApp" para começar</p>
              </div>
            ) : filteredConversas?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <MessageSquare className="w-12 h-12 mb-4" />
                <p className="text-center">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredConversas?.map((conversa: any) => (
                <div key={conversa.id}>
                  <div
                    className={cn(
                      "group relative p-3 rounded-lg cursor-pointer transition-all duration-200",
                      selectedConversa?.id === conversa.id 
                        ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 shadow-lg" 
                        : "hover:bg-slate-800/50 border border-transparent hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-3" onClick={() => {
                      // Include ticket information when selecting a conversation
                      const openTicket = tickets.find((ticket: any) => 
                        ticket.conversaId === conversa.id && ticket.status === 'aberto'
                      );
                      setSelectedConversa({
                        ...conversa,
                        hasOpenTicket: !!openTicket,
                        ticket: openTicket
                      });
                    }}>
                      {/* Avatar with Online Status */}
                      <div className="relative">
                        <Avatar className="w-12 h-12">
                          <AvatarImage 
                            src={showPhotosChat && conversa.profilePicture ? conversa.profilePicture : defaultProfileIcon} 
                            alt={conversa.nome || conversa.telefone}
                            className="object-cover"
                          />
                          <AvatarFallback>
                            <img 
                              src={defaultProfileIcon} 
                              alt="Default profile"
                              className="object-cover w-full h-full"
                            />
                          </AvatarFallback>
                        </Avatar>
                        
                        {/* Cliente/Novo/Teste Status Indicator */}
                        <div className={cn(
                          "absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-lg",
                          conversa.isTeste
                            ? "bg-gradient-to-r from-blue-500 to-purple-600"
                            : conversa.isCliente 
                            ? "bg-gradient-to-r from-purple-500 to-purple-600" 
                            : "bg-gradient-to-r from-green-500 to-green-600"
                        )}>
                          {conversa.isTeste ? 'T' : conversa.isCliente ? 'C' : 'N'}
                        </div>
                        
                        {/* Ticket Indicator - Orange dot with ticket icon */}
                        {conversa.hasOpenTicket && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                            <Ticket className="w-3 h-3 text-white" />
                          </div>
                        )}
                        
                        {/* Mode Indicator Icon */}
                        <div className={cn(
                          "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg",
                          conversa.modoAtendimento === 'bot' 
                            ? "bg-gradient-to-r from-blue-500 to-blue-600" 
                            : "bg-gradient-to-r from-purple-500 to-purple-600"
                        )}>
                          {conversa.modoAtendimento === 'bot' ? (
                            <Bot className="w-3 h-3 text-white" />
                          ) : (
                            <User className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </div>
                      
                      {/* Conversation Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <h4 className="font-semibold truncate text-slate-100">
                                {(() => {
                                  // Se for cliente, usar nome do cliente salvo
                                  if (conversa.isCliente && conversa.clienteNome) {
                                    return conversa.clienteNome;
                                  }
                                  // Se tiver nome do WhatsApp e não for só número
                                  if (conversa.nome && conversa.nome !== conversa.telefone) {
                                    return conversa.nome;
                                  }
                                  // Se for só número, mostrar formatado
                                  return formatPhoneNumber(conversa.telefone);
                                })()}
                              </h4>
                              <span className="text-xs text-slate-500">{formatPhoneNumber(conversa.telefone)}</span>
                            </div>
                            {conversa.isPinned && (
                              <Pin className="w-3 h-3 text-blue-400" />
                            )}
                            {conversa.isMuted && (
                              <VolumeX className="w-3 h-3 text-slate-500" />
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {conversa.dataUltimaMensagem && formatLastMessageDate(conversa.dataUltimaMensagem)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Last Message Preview */}
                          <p className="text-sm text-slate-400 truncate flex-1 flex items-center gap-1 overflow-hidden"
                             style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            {conversa.isTyping ? (
                              <span className="text-blue-400 italic">digitando...</span>
                            ) : (
                              <>
                                {/* Show checkmarks only when last message was sent by system */}
                                {conversa.ultimaMensagem && conversa.ultimoRemetente === 'sistema' && (
                                  <span className="text-xs flex-shrink-0">
                                    <svg className="w-4 h-4 text-slate-500 inline" viewBox="0 0 16 11" fill="none">
                                      <path d="M1 5L5 9L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M5 5L9 9L15 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </span>
                                )}
                                {/* Show media type icon */}
                                {conversa.tipoUltimaMensagem && conversa.tipoUltimaMensagem !== 'text' && (
                                  <span className="flex-shrink-0">
                                    {conversa.tipoUltimaMensagem === 'image' && <Camera className="w-4 h-4 text-slate-400" />}
                                    {conversa.tipoUltimaMensagem === 'video' && <Video className="w-4 h-4 text-slate-400" />}
                                    {conversa.tipoUltimaMensagem === 'audio' && <Mic className="w-4 h-4 text-slate-400" />}
                                    {conversa.tipoUltimaMensagem === 'document' && <FileText className="w-4 h-4 text-slate-400" />}
                                    {conversa.tipoUltimaMensagem === 'sticker' && <Sparkles className="w-4 h-4 text-slate-400" />}
                                  </span>
                                )}
                                <span className="truncate">
                                  {(() => {
                                    if (!conversa.ultimaMensagem || conversa.ultimaMensagem === '') {
                                      return <span className="italic">Clique para iniciar conversa</span>;
                                    }
                                    
                                    // For media messages, show special formatting
                                    if (conversa.tipoUltimaMensagem && conversa.tipoUltimaMensagem !== 'text') {
                                      try {
                                        const parsedMessage = JSON.parse(conversa.ultimaMensagem);
                                        
                                        switch (conversa.tipoUltimaMensagem) {
                                          case 'image':
                                            return parsedMessage.caption ? `Foto: ${parsedMessage.caption}` : 'Foto';
                                          case 'video':
                                            return parsedMessage.caption ? `Vídeo: ${parsedMessage.caption}` : 'Vídeo';
                                          case 'audio':
                                            const duration = parsedMessage.duration || 0;
                                            return `Áudio (${duration}s)`;
                                          case 'document':
                                            const fileName = parsedMessage.fileName || 'arquivo';
                                            return fileName;
                                          case 'sticker':
                                            return 'Figurinha';
                                          default:
                                            return conversa.ultimaMensagem;
                                        }
                                      } catch (e) {
                                        // If parsing fails, check for special media types
                                        if (conversa.tipoUltimaMensagem === 'audio') {
                                          return 'Áudio';
                                        } else if (conversa.tipoUltimaMensagem === 'image') {
                                          return 'Foto';
                                        } else if (conversa.tipoUltimaMensagem === 'video') {
                                          return 'Vídeo';
                                        } else if (conversa.tipoUltimaMensagem === 'document') {
                                          return 'Documento';
                                        } else if (conversa.tipoUltimaMensagem === 'sticker') {
                                          return 'Figurinha';
                                        }
                                        // Show raw message if not empty
                                        return conversa.ultimaMensagem || <span className="italic">Clique para iniciar conversa</span>;
                                      }
                                    }
                                    
                                    // For text messages, show as is
                                    return conversa.ultimaMensagem;
                                  })()}
                                </span>
                              </>
                            )}
                          </p>
                          
                          {/* Unread Count */}
                          {conversa.mensagensNaoLidas > 0 && (
                            <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs min-w-[20px] h-5 px-1.5">
                              {conversa.mensagensNaoLidas > 99 ? '99+' : conversa.mensagensNaoLidas}
                            </Badge>
                          )}
                        </div>
                        


                      </div>
                      
                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className="bg-dark-card border-slate-600"
                          onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                            <DropdownMenuItem 
                              className="hover:bg-red-500/20 text-red-400"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!conversa) return;
                                
                                // Ask for confirmation
                                if (confirm(`Deseja apagar a conversa com ${conversa.nome || formatPhoneNumber(conversa.telefone)}?`)) {
                                  try {
                                    // Delete conversation
                                    await apiRequest('DELETE', `/api/conversas/${conversa.id}`);
                                    
                                    // If it's a client, also delete the client
                                    if (conversa.isCliente && conversa.clienteId) {
                                      await apiRequest('DELETE', `/api/clientes/${conversa.clienteId}`);
                                    }
                                    
                                    toast({
                                      title: "Conversa apagada",
                                      description: conversa.isCliente 
                                        ? "A conversa e o cliente foram removidos"
                                        : "A conversa foi removida",
                                    });
                                    
                                    // If this was the selected conversation, clear it
                                    if (selectedConversa?.id === conversa.id) {
                                      setSelectedConversa(null);
                                    }
                                    
                                    // Refresh list
                                    refetchConversas();
                                  } catch (error) {
                                    toast({
                                      title: "Erro ao apagar",
                                      description: "Não foi possível apagar a conversa",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Apagar conversa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        

        </div>

        {/* Main Content Area with Chat and Sidebar */}
        <div className="flex-1 flex bg-dark-card max-h-screen">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col relative z-0">
        {selectedConversa ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-600 bg-dark-surface">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Back Button for Mobile */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setSelectedConversa(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  
                  {/* Avatar */}
                  <Avatar 
                    className="w-12 h-12 cursor-pointer"
                    onClick={() => setShowContactInfo(true)}
                  >
                    <AvatarImage 
                      src={showPhotosChat && selectedConversa.profilePicture ? selectedConversa.profilePicture : defaultProfileIcon} 
                      alt={selectedConversa.nome || selectedConversa.telefone}
                      className="object-cover"
                    />
                    <AvatarFallback>
                      <img 
                        src={defaultProfileIcon} 
                        alt="Default profile"
                        className="object-cover w-full h-full"
                      />
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Contact Info */}
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => setShowContactInfo(true)}
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-100">
                        {(() => {
                          // Se for cliente, usar nome do cliente salvo
                          if (selectedConversa.isCliente && selectedConversa.clienteNome) {
                            return selectedConversa.clienteNome;
                          }
                          // Se tiver nome do WhatsApp e não for só número
                          if (selectedConversa.nome && selectedConversa.nome !== selectedConversa.telefone) {
                            return selectedConversa.nome;
                          }
                          // Se for só número, mostrar formatado
                          return formatPhoneNumber(selectedConversa.telefone);
                        })()}
                      </h4>
                      {selectedConversa.isCliente && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                          Cliente
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 flex items-center gap-2">
                      {typingUsers.has(selectedConversa.telefone) ? (
                        <span className="text-blue-400">digitando...</span>
                      ) : (
                        <span>{formatPhoneNumber(selectedConversa.telefone)}</span>
                      )}
                    </p>
                  </div>
                </div>
                
              </div>
            </div>

            {/* Ticket Panel - Collapsible */}
            {selectedConversa.hasOpenTicket && selectedConversa.ticket && (
              <div className={cn(
                "bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-b border-amber-500/20 transition-all duration-300",
                ticketExpanded ? "px-4 py-3" : "px-4 py-2"
              )}>
                {!ticketExpanded ? (
                  /* Collapsed View - Compact */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Toggle Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTicketExpanded(!ticketExpanded)}
                        className="p-0 h-auto hover:bg-transparent"
                      >
                        <ChevronDown className="w-4 h-4 text-amber-400" />
                      </Button>
                      
                      <div className="p-1.5 bg-gradient-to-r from-amber-500/20 to-orange-600/20 rounded">
                        <Ticket className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-amber-400">
                          Ticket #{selectedConversa.ticket.id}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {format(new Date(selectedConversa.ticket.dataCriacao), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  
                  {/* Compact Ticket Actions */}
                  <div className="flex items-center gap-2">
                    {autoCloseActive && (
                      <span className="text-[10px] text-orange-400 font-medium">
                        Fechando em {Math.floor(autoCloseCountdown / 60)}:{String(autoCloseCountdown % 60).padStart(2, '0')}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (autoCloseActive) {
                          // Cancel timer on server
                          try {
                            await apiRequest("DELETE", `/api/tickets/${selectedConversa.ticket.id}/auto-close`);
                            
                            // Clear frontend countdown timer
                            if (autoCloseTimer) {
                              clearInterval(autoCloseTimer);
                              setAutoCloseTimer(null);
                            }
                            setAutoCloseActive(false);
                            setAutoCloseCountdown(0);
                            
                            toast({
                              title: "Fechamento automático cancelado",
                              description: "O ticket não será mais fechado automaticamente",
                            });
                          } catch (error) {
                            console.error("Erro ao cancelar timer:", error);
                            toast({
                              title: "Erro",
                              description: "Não foi possível cancelar o timer",
                              variant: "destructive",
                            });
                          }
                        } else {
                          // Start timer on server
                          try {
                            await apiRequest("POST", `/api/tickets/${selectedConversa.ticket.id}/auto-close`);
                            
                            // Start frontend countdown for display
                            setAutoCloseActive(true);
                            setAutoCloseCountdown(300);
                            
                            // Update countdown every second (frontend only for display)
                            const countdownInterval = setInterval(() => {
                              setAutoCloseCountdown(prev => {
                                if (prev <= 1) {
                                  clearInterval(countdownInterval);
                                  setAutoCloseActive(false);
                                  
                                  // Refresh data when timer expires
                                  queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
                                  queryClient.invalidateQueries({ queryKey: ['/api/conversas'] });
                                  queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
                                  
                                  // Update local state
                                  setSelectedConversa(prev => prev ? {
                                    ...prev,
                                    hasOpenTicket: false,
                                    ticket: undefined,
                                    modoAtendimento: 'bot'
                                  } : null);
                                  
                                  toast({
                                    title: "Ticket Fechado Automaticamente",
                                    description: "O ticket foi fechado após 5 minutos sem resposta do cliente",
                                  });
                                  
                                  return 0;
                                }
                                return prev - 1;
                              });
                            }, 1000);
                            
                            setAutoCloseTimer(countdownInterval as any);
                            
                            toast({
                              title: "Fechamento automático ativado",
                              description: "O ticket será fechado em 5 minutos se o cliente não responder",
                            });
                          } catch (error) {
                            console.error("Erro ao iniciar timer:", error);
                            toast({
                              title: "Erro",
                              description: "Não foi possível iniciar o timer de fechamento automático",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                      className={cn(
                        "h-6 px-2 text-[10px]",
                        autoCloseActive 
                          ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          : "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                      )}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {autoCloseActive ? "Cancelar" : "Fechar em 5min"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        // Cancel auto-close if active
                        if (autoCloseActive && selectedConversa.ticket) {
                          try {
                            await apiRequest("DELETE", `/api/tickets/${selectedConversa.ticket.id}/auto-close`);
                          } catch (error) {
                            console.error("Erro ao cancelar timer:", error);
                          }
                        }
                        
                        if (autoCloseTimer) {
                          clearInterval(autoCloseTimer);
                          setAutoCloseTimer(null);
                          setAutoCloseActive(false);
                          setAutoCloseCountdown(0);
                        }
                        
                        // Close ticket and switch to bot mode
                        try {
                          await apiRequest('PUT', `/api/tickets/${selectedConversa.ticket.id}`, {
                            status: 'fechado'
                          });
                          
                          // Update selected conversation to remove ticket
                          setSelectedConversa({
                            ...selectedConversa,
                            hasOpenTicket: false,
                            ticket: undefined,
                            modoAtendimento: 'bot'
                          });
                          
                          toast({
                            title: "Ticket Fechado",
                            description: "O ticket foi fechado e o chat voltou para o modo bot",
                          });
                          
                          // Invalidate queries to refresh data
                          queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/conversas'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
                        } catch (error) {
                          toast({
                            title: "Erro",
                            description: "Não foi possível fechar o ticket",
                            variant: "destructive"
                          });
                        }
                      }}
                      className="h-6 px-2 text-[10px] text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Fechar
                    </Button>
                  </div>
                </div>
                ) : (
                  /* Expanded View - Full Information */
                  <div className="space-y-3">
                    {/* Header with Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Toggle Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTicketExpanded(!ticketExpanded)}
                          className="p-0 h-auto hover:bg-transparent"
                        >
                          <ChevronUp className="w-4 h-4 text-amber-400" />
                        </Button>
                        
                        <div className="p-2 bg-gradient-to-r from-amber-500/20 to-orange-600/20 rounded">
                          <Ticket className="w-4 h-4 text-amber-400" />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-amber-400">
                              Ticket #{selectedConversa.ticket.id}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[11px] h-5 px-2",
                                selectedConversa.ticket.prioridade === 'alta' 
                                  ? "bg-red-500/10 text-red-400 border-red-500/30"
                                  : selectedConversa.ticket.prioridade === 'media'
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  : "bg-green-500/10 text-green-400 border-green-500/30"
                              )}
                            >
                              {selectedConversa.ticket.prioridade === 'alta' ? 'ALTA' : 
                               selectedConversa.ticket.prioridade === 'media' ? 'MÉDIA' : 'BAIXA'}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Criado em {format(new Date(selectedConversa.ticket.dataCriacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {autoCloseActive && (
                          <span className="text-xs text-orange-400 font-medium bg-orange-500/10 px-2 py-1 rounded">
                            ⏱ {Math.floor(autoCloseCountdown / 60)}:{String(autoCloseCountdown % 60).padStart(2, '0')}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (autoCloseActive) {
                              // Cancel timer on server
                              try {
                                await apiRequest("DELETE", `/api/tickets/${selectedConversa.ticket.id}/auto-close`);
                                
                                // Clear frontend countdown timer
                                if (autoCloseTimer) {
                                  clearInterval(autoCloseTimer);
                                  setAutoCloseTimer(null);
                                }
                                setAutoCloseActive(false);
                                setAutoCloseCountdown(0);
                                
                                toast({
                                  title: "Fechamento automático cancelado",
                                  description: "O ticket não será mais fechado automaticamente",
                                });
                              } catch (error) {
                                console.error("Erro ao cancelar timer:", error);
                                toast({
                                  title: "Erro",
                                  description: "Não foi possível cancelar o timer",
                                  variant: "destructive",
                                });
                              }
                            } else {
                              // Start timer on server
                              try {
                                await apiRequest("POST", `/api/tickets/${selectedConversa.ticket.id}/auto-close`);
                                
                                // Start frontend countdown for display
                                setAutoCloseActive(true);
                                setAutoCloseCountdown(300);
                                
                                // Update countdown every second (frontend only for display)
                                const countdownInterval = setInterval(() => {
                                  setAutoCloseCountdown(prev => {
                                    if (prev <= 1) {
                                      clearInterval(countdownInterval);
                                      setAutoCloseActive(false);
                                      
                                      // Refresh data when timer expires
                                      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
                                      queryClient.invalidateQueries({ queryKey: ['/api/conversas'] });
                                      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
                                      
                                      // Update local state
                                      setSelectedConversa(prev => prev ? {
                                        ...prev,
                                        hasOpenTicket: false,
                                        ticket: undefined,
                                        modoAtendimento: 'bot'
                                      } : null);
                                      
                                      toast({
                                        title: "Ticket Fechado Automaticamente",
                                        description: "O ticket foi fechado após 5 minutos sem resposta do cliente",
                                      });
                                      
                                      return 0;
                                    }
                                    return prev - 1;
                                  });
                                }, 1000);
                                
                                setAutoCloseTimer(countdownInterval as any);
                                
                                toast({
                                  title: "Fechamento automático ativado",
                                  description: "O ticket será fechado em 5 minutos se o cliente não responder",
                                });
                              } catch (error) {
                                console.error("Erro ao iniciar timer:", error);
                                toast({
                                  title: "Erro",
                                  description: "Não foi possível iniciar o timer de fechamento automático",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          className={cn(
                            "h-7 px-3 text-xs",
                            autoCloseActive 
                              ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              : "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                          )}
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          {autoCloseActive ? "Cancelar Timer" : "Fechar em 5min"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            // Cancel auto-close if active
                            if (autoCloseActive && selectedConversa.ticket) {
                              try {
                                await apiRequest("DELETE", `/api/tickets/${selectedConversa.ticket.id}/auto-close`);
                              } catch (error) {
                                console.error("Erro ao cancelar timer:", error);
                              }
                            }
                            
                            if (autoCloseTimer) {
                              clearInterval(autoCloseTimer);
                              setAutoCloseTimer(null);
                              setAutoCloseActive(false);
                              setAutoCloseCountdown(0);
                            }
                            
                            // Close ticket and switch to bot mode
                            try {
                              await apiRequest('PUT', `/api/tickets/${selectedConversa.ticket.id}`, {
                                status: 'fechado'
                              });
                              
                              // Update selected conversation to remove ticket
                              setSelectedConversa({
                                ...selectedConversa,
                                hasOpenTicket: false,
                                ticket: undefined,
                                modoAtendimento: 'bot'
                              });
                              
                              toast({
                                title: "Ticket Fechado",
                                description: "O ticket foi fechado e o chat voltou para o modo bot",
                              });
                              
                              // Invalidate queries to refresh data
                              queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/conversas'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
                            } catch (error) {
                              toast({
                                title: "Erro",
                                description: "Não foi possível fechar o ticket",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="h-7 px-3 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Fechar Ticket
                        </Button>
                      </div>
                    </div>
                    
                    {/* Ticket Details */}
                    <div className="bg-dark-card/50 rounded-lg p-3 space-y-2">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Título</p>
                        <p className="text-sm text-slate-200 font-medium">{selectedConversa.ticket.titulo}</p>
                      </div>
                      
                      {selectedConversa.ticket.descricao && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Descrição</p>
                          <p className="text-sm text-slate-300">{selectedConversa.ticket.descricao}</p>
                        </div>
                      )}
                      
                      <div className="flex gap-4">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Status</p>
                          <p className="text-sm text-green-400 font-medium">Aberto</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Atendimento</p>
                          <p className="text-sm text-blue-400 font-medium">Humano</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Messages Area */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="relative flex-1 overflow-y-auto p-4 bg-gradient-to-b from-dark-background to-dark-surface/50"
              style={{ scrollBehavior: 'auto' }}>
              <TooltipProvider>
                {allMessages.length === 0 && !isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <MessageSquare className="w-12 h-12 mb-4" />
                    <p>Nenhuma mensagem ainda</p>
                    <p className="text-sm mt-1">Envie uma mensagem para começar a conversa</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Load more messages button */}
                    {hasMoreMessages && !isLoadingMore && (
                      <div className="flex items-center justify-center py-4">
                        <button
                          onClick={loadMoreMessages}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                          Carregar mensagens antigas
                        </button>
                      </div>
                    )}
                    
                    {/* Loading indicator when loading more messages */}
                    {isLoadingMore && (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                      </div>
                    )}
                    
                    {allMessages?.map((mensagem: any, index: number) => {
                      const currentDate = new Date(mensagem.timestamp);
                      const previousMessage = index > 0 ? allMessages[index - 1] : null;
                      const previousDate = previousMessage ? new Date(previousMessage.timestamp) : null;
                      const showDateSeparator = !previousDate || 
                        currentDate.toDateString() !== previousDate.toDateString();
                      
                      const isFirstInGroup = !previousMessage || 
                        previousMessage.remetente !== mensagem.remetente ||
                        (currentDate.getTime() - previousDate!.getTime()) > 60000; // 1 minute gap
                      
                      const nextMessage = index < allMessages.length - 1 ? allMessages[index + 1] : null;
                      const isLastInGroup = !nextMessage || 
                        nextMessage.remetente !== mensagem.remetente ||
                        (new Date(nextMessage.timestamp).getTime() - currentDate.getTime()) > 60000;

                      return (
                        <div key={mensagem.id} id={`msg-${mensagem.id}`}>
                          {showDateSeparator && (
                            <div className="flex items-center justify-center my-4">
                              <div className="bg-slate-700/50 px-3 py-1 rounded-full text-xs text-slate-400">
                                {isToday(currentDate) 
                                  ? 'Hoje' 
                                  : isYesterday(currentDate) 
                                  ? 'Ontem' 
                                  : format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
                              </div>
                            </div>
                          )}
                          
                          <MessageBubble
                            message={{
                              ...mensagem,
                              tipo: mensagem.tipo || 'text',
                              status: mensagem.remetente === 'sistema' ? {
                                sent: true,
                                delivered: mensagem.entregue || false,
                                read: mensagem.lida || false
                              } : undefined,
                              isReply: mensagem.metadados?.reply ? true : false,
                              replyTo: mensagem.metadados?.reply
                            }}
                            isOwn={mensagem.remetente === 'sistema'}
                            contactName={selectedConversa.nome || selectedConversa.clienteNome || selectedConversa.telefone}
                            showAvatar={mensagem.remetente !== 'sistema' && isLastInGroup}
                            isFirstInGroup={isFirstInGroup}
                            isLastInGroup={isLastInGroup}
                            isSelected={selectedMessages.has(mensagem.id)}
                            onSelect={() => {
                              const newSelected = new Set(selectedMessages);
                              if (newSelected.has(mensagem.id)) {
                                newSelected.delete(mensagem.id);
                              } else {
                                newSelected.add(mensagem.id);
                              }
                              setSelectedMessages(newSelected);
                              setIsSelectionMode(newSelected.size > 0);
                            }}
                            onReply={() => {
                              setReplyingTo({
                                content: mensagem.conteudo,
                                sender: mensagem.remetente === 'sistema' ? 'Você' : 
                                       mensagem.remetente === 'bot' ? 'Bot' : 'Cliente',
                                id: mensagem.id // Add message ID to track which message is being replied to
                              });
                            }}
                            onForward={() => {
                              toast({
                                title: "Encaminhar",
                                description: "Selecione para quem deseja encaminhar esta mensagem",
                              });
                            }}
                            onCopy={() => {
                              navigator.clipboard.writeText(mensagem.conteudo);
                              toast({
                                title: "Copiado!",
                                description: "Mensagem copiada para a área de transferência",
                              });
                            }}
                            onDelete={() => {
                              // Send delete message command
                              sendMessage('delete_message', {
                                messageId: mensagem.id,
                                telefone: selectedConversa.telefone
                              });
                              toast({
                                title: "Mensagem apagada",
                                description: "A mensagem foi apagada para todos",
                              });
                            }}
                            onEdit={() => {
                              setEditingMessage({
                                id: mensagem.id,
                                conteudo: mensagem.conteudo,
                                timestamp: mensagem.timestamp,
                                remetente: mensagem.remetente
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                    
                    {/* Typing Indicator */}
                    {typingUsers.size > 0 && <TypingIndicator />}
                  </div>
                )}
                
                {/* New Message Indicator */}
                {showNewMessageIndicator && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        scrollToBottom();
                        setShowNewMessageIndicator(false);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
                    >
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Nova mensagem
                    </Button>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </TooltipProvider>
            </div>



            {/* Quick Messages - Beautiful Design */}
            {quickMessages.length > 0 && (
              <div className={cn(
                "border-t border-slate-700/50 bg-gradient-to-b from-slate-800/30 to-slate-900/30 backdrop-blur-sm transition-all duration-300",
                showQuickMessages ? "max-h-48" : "max-h-12"
              )}>
                <div 
                  className="px-4 py-2.5 flex items-center justify-between cursor-pointer group hover:bg-white/5 transition-all duration-200"
                  onClick={() => setShowQuickMessages(!showQuickMessages)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      Respostas Rápidas
                    </span>
                    <Badge className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0 h-4">
                      {quickMessages.length}
                    </Badge>
                  </div>
                  <ChevronDown className={cn(
                    "w-3.5 h-3.5 text-slate-400 transition-transform duration-300",
                    showQuickMessages && "rotate-180"
                  )} />
                </div>
                
                <div className={cn(
                  "overflow-hidden transition-all duration-300",
                  showQuickMessages ? "opacity-100" : "opacity-0 h-0"
                )}>
                  <div className="px-3 pb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {quickMessages.map((msg: any) => {
                        // Process greeting variable
                        let displayText = msg.texto;
                        if (msg.variavel && msg.texto.includes('{{saudacao}}')) {
                          const hour = new Date().getHours();
                          let greeting = 'Olá, boa noite!';
                          if (hour >= 6 && hour < 12) greeting = 'Olá, bom dia!';
                          else if (hour >= 12 && hour < 18) greeting = 'Olá, boa tarde!';
                          displayText = msg.texto.replace('{{saudacao}}', greeting);
                        }

                        return (
                          <button
                            key={msg.id}
                            onClick={() => {
                              setMessageText(displayText);
                              
                              if (msg.imagemUrl) {
                                setPendingImageUrl(msg.imagemUrl);
                              } else {
                                setPendingImageUrl(null);
                              }
                            }}
                            className={cn(
                              "group relative px-3 py-1.5 text-[11px] font-medium rounded-full",
                              "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-slate-700/50",
                              "hover:from-blue-500/20 hover:to-purple-500/20 hover:border-blue-500/30",
                              "transition-all duration-200 transform hover:scale-105"
                            )}
                          >
                            <span className="text-slate-300 group-hover:text-white transition-colors">
                              {msg.titulo}
                            </span>
                            {msg.imagemUrl && (
                              <Camera className="inline-block w-3 h-3 ml-1 text-blue-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t border-slate-600 bg-dark-surface">
              {!isConnected ? (
                <Alert className="bg-red-500/10 border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-300">
                    WhatsApp não está conectado. Conecte-se para enviar mensagens.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {/* Reply Preview */}
                  {replyingTo && (
                    <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg">
                      <Reply className="w-4 h-4 text-blue-400" />
                      <div className="flex-1">
                        <p className="text-xs text-blue-400 font-medium">Respondendo para {replyingTo.sender}</p>
                        <p className="text-xs text-slate-400 line-clamp-1">{replyingTo.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyingTo(null)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  
                  {/* Pending Image Indicator */}
                  {pendingImageUrl && (
                    <div className="flex items-center gap-2 p-2 bg-green-700/20 border border-green-500/30 rounded-lg">
                      <Image className="w-4 h-4 text-green-400" />
                      <div className="flex-1">
                        <p className="text-xs text-green-400 font-medium">Imagem anexada</p>
                        <p className="text-xs text-slate-400">A imagem será enviada junto com a mensagem</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingImageUrl(null)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  
                  {/* Input Area */}
                  <div className="flex items-end gap-2">
                    <AttachmentMenu onAttachmentSelect={handleAttachment} />
                    
                    <div className="flex-1 relative">
                      <textarea
                        value={messageText}
                        onChange={(e) => {
                          let value = e.target.value;
                          const inputType = (e.nativeEvent as any).inputType;
                          
                          // Correção ortográfica inteligente em português
                          const correcoes: { [key: string]: string } = {
                            // Erros comuns de digitação
                            'vc': 'você',
                            'vcs': 'vocês',
                            'tb': 'também',
                            'tbm': 'também',
                            'q': 'que',
                            'pq': 'porque',
                            'oq': 'o que',
                            'td': 'tudo',
                            'tds': 'todos',
                            'msg': 'mensagem',
                            'obg': 'obrigado',
                            'obgd': 'obrigado',
                            'obgda': 'obrigada',
                            'dps': 'depois',
                            'hj': 'hoje',
                            'amanha': 'amanhã',
                            'voce': 'você',
                            'esta': 'está',
                            'ja': 'já',
                            'nao': 'não',
                            'entao': 'então',
                            'tambem': 'também',
                            'ate': 'até',
                            'proximo': 'próximo',
                            'numero': 'número',
                            'atraves': 'através',
                            'porque': 'por que', // quando é pergunta
                            'por que': 'porque', // quando é resposta
                            // Concordância
                            'a gente': 'a gente',
                            'agente': 'a gente',
                            'mim fazer': 'eu fazer',
                            'mim falar': 'eu falar',
                            'mim ir': 'eu ir',
                            // Erros comuns
                            'concerteza': 'com certeza',
                            'com certeza': 'com certeza',
                            'derrepente': 'de repente',
                            'de repente': 'de repente',
                            'porisso': 'por isso',
                            'por isso': 'por isso',
                            'apartir': 'a partir',
                            'a partir': 'a partir',
                            // Palavras frequentes
                            'bom dia': 'Bom dia',
                            'boa tarde': 'Boa tarde',
                            'boa noite': 'Boa noite',
                            'ola': 'Olá',
                            'oi': 'Oi',
                            // Correções contextuais
                            'mas': 'mas',
                            'mais': 'mais',
                            'mal': 'mal',
                            'mau': 'mau'
                          };
                          
                          // Aplica correções automáticas quando há espaço ou pontuação
                          const insertedChar = (e.nativeEvent as any).data;
                          if (inputType === 'insertText' && (insertedChar === ' ' || insertedChar === '.' || insertedChar === '!' || insertedChar === '?')) {
                            const words = value.split(/(\s+)/);
                            const lastWordIndex = words.length - 3; // Última palavra antes do espaço
                            
                            if (lastWordIndex >= 0) {
                              const lastWord = words[lastWordIndex].toLowerCase();
                              
                              // Verifica correções simples
                              if (correcoes[lastWord]) {
                                words[lastWordIndex] = correcoes[lastWord];
                                value = words.join('');
                              }
                              
                              // Verifica frases de duas palavras
                              if (lastWordIndex >= 2) {
                                const twoWords = words[lastWordIndex - 2].toLowerCase() + ' ' + lastWord;
                                if (correcoes[twoWords]) {
                                  words[lastWordIndex - 2] = correcoes[twoWords].split(' ')[0];
                                  words[lastWordIndex] = correcoes[twoWords].split(' ')[1];
                                  value = words.join('');
                                }
                              }
                            }
                          }
                          
                          // Auto-capitalização inteligente
                          if (value.length > 0) {
                            // Capitaliza a primeira letra da mensagem
                            if (value.length === 1 && value[0].match(/[a-záàâãéèêíïóôõöúç]/i)) {
                              value = value.charAt(0).toUpperCase();
                            }
                            
                            // Capitaliza após pontuação final seguida de espaço
                            if (inputType === 'insertText' && value.length > 2) {
                              const match = value.match(/([.!?]\s+)([a-záàâãéèêíïóôõöúç])$/i);
                              if (match) {
                                value = value.slice(0, -1) + match[2].toUpperCase();
                              }
                            }
                            
                            // Capitaliza após quebra de linha
                            const lines = value.split('\n');
                            if (lines.length > 1) {
                              const lastLine = lines[lines.length - 1];
                              if (lastLine.length === 1 && lastLine[0].match(/[a-záàâãéèêíïóôõöúç]/i)) {
                                lines[lines.length - 1] = lastLine.charAt(0).toUpperCase();
                                value = lines.join('\n');
                              }
                            }
                          }
                          
                          setMessageText(value);
                          // Auto-resize
                          e.target.style.height = '40px'; // Reset to single line height
                          e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                        }}
                        onPaste={(e) => {
                          // Preserve formatting when pasting
                          setTimeout(() => {
                            const textarea = e.target as HTMLTextAreaElement;
                            textarea.style.height = '40px'; // Reset to single line height
                            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
                          }, 0);
                        }}
                        placeholder="Digite sua mensagem..."
                        className="w-full h-[40px] max-h-[200px] px-3 py-2 bg-dark-card border border-slate-600 rounded-lg text-white placeholder:text-slate-500 pr-12 resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        spellCheck={true}
                        lang="pt-BR"
                        autoCapitalize="sentences"
                        autoCorrect="on"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={sendMessageMutation.isPending}
                        style={{
                          height: '40px', // Start with single line height
                          lineHeight: '1.5',
                          scrollbarWidth: 'thin',
                          scrollbarColor: '#475569 transparent'
                        }}
                      />
                      <div className="absolute right-2 bottom-2">
                        <EmojiPicker onEmojiSelect={(emoji) => setMessageText(prev => prev + emoji)} />
                      </div>
                    </div>
                    
                    {messageText.trim() ? (
                      <Button 
                        onClick={handleSendMessage} 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
                        disabled={!messageText.trim()}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleVoiceRecord}
                              className={cn(
                                "transition-colors",
                                isRecording ? "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white" : "text-slate-400 hover:text-slate-200"
                              )}
                            >
                              <Mic className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isRecording ? "Gravando..." : "Gravar áudio"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-dark-background to-dark-surface/50">
            <div className="text-center space-y-4">
              {!isConnected ? (
                <>
                  <WifiOff className="w-16 h-16 text-slate-500 mx-auto" />
                  <h3 className="text-xl font-semibold text-slate-300">WhatsApp Desconectado</h3>
                  <p className="text-slate-400">Conecte o WhatsApp para ver suas conversas</p>
                  <Button 
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    {connectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4 mr-2" />
                    )}
                    Conectar WhatsApp
                  </Button>
                </>
              ) : (
                <>
                  <MessageSquare className="w-16 h-16 text-slate-500 mx-auto" />
                  <h3 className="text-xl font-semibold text-slate-300">Selecione uma conversa</h3>
                  <p className="text-slate-400">Escolha uma conversa para começar</p>
                </>
              )}
            </div>
          </div>
        )}
        </div>
          
          {/* Sidebar Menu - Sempre Visível */}
          {selectedConversa && (
          <div className="w-48 bg-dark-surface border-l border-slate-700 shadow-xl flex-shrink-0 h-screen">
            {/* Sidebar Header */}
            <div className="p-2.5 border-b border-slate-700 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
              <h3 className="text-xs font-semibold text-slate-200 text-center uppercase">Ações</h3>
            </div>
            
            {/* Sidebar Content */}
            <div className="p-2.5 space-y-3 overflow-y-auto h-[calc(100vh-50px)]">
              {/* Attendance Mode Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">Atendimento</h4>
                <div className="bg-slate-800/40 rounded-lg p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Modo</span>
                    <span className={cn(
                      "text-xs font-medium",
                      selectedConversa.modoAtendimento === 'bot' ? "text-blue-400" : "text-purple-400"
                    )}>
                      {selectedConversa.modoAtendimento === 'bot' ? 'Bot' : 'Humano'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-center py-2">
                    <div className="relative flex items-center gap-2 bg-slate-900 rounded-full p-1 shadow-inner">
                      <div className="flex items-center text-xs font-semibold">
                        <div className={cn(
                          "px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-all duration-300 text-[10px] font-medium",
                          selectedConversa.modoAtendimento === 'bot'
                            ? "text-blue-300"
                            : "text-slate-500"
                        )}>
                          <Bot className="w-3 h-3" />
                          <span>BOT</span>
                        </div>
                        
                        <button
                          onClick={() => handleSwitchMode(selectedConversa.modoAtendimento === 'bot' ? 'humano' : 'bot')}
                          className="relative w-10 h-5 bg-slate-700 rounded-full transition-colors duration-300 hover:bg-slate-600"
                        >
                          <span className={cn(
                            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-lg transform transition-all duration-300",
                            selectedConversa.modoAtendimento === 'bot'
                              ? "translate-x-0 bg-gradient-to-br from-blue-500 to-blue-600"
                              : "translate-x-5 bg-gradient-to-br from-purple-500 to-purple-600"
                          )}>
                            <span className="absolute inset-0 rounded-full animate-pulse bg-white opacity-25"></span>
                          </span>
                        </button>
                        
                        <div className={cn(
                          "px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-all duration-300 text-[10px] font-medium",
                          selectedConversa.modoAtendimento === 'humano'
                            ? "text-purple-300"
                            : "text-slate-500"
                        )}>
                          <span>HUMANO</span>
                          <User className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Client Actions Section */}
              {selectedConversa.isCliente && selectedConversa.clienteId && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">Cliente</h4>
                  <Button
                    onClick={() => {
                      window.open(`/clientes/${selectedConversa.clienteId}`, '_blank');

                    }}
                    className="w-full justify-start bg-gradient-to-r from-green-600/90 to-green-700/90 hover:from-green-500 hover:to-green-600 text-white text-xs py-1.5 h-8"
                  >
                    <UserCheck className="w-3 h-3 mr-1.5" />
                    Ver Cliente
                  </Button>
                </div>
              )}
              
              {/* Test Actions Section */}
              {!selectedConversa.isCliente && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">Cadastro</h4>
                  <div className="space-y-2">
                    {selectedConversa.isTeste ? (
                      <>
                        <Button
                          onClick={() => {
                            setTestPhoneNumber(selectedConversa.telefone);
                            setShowTestDetailsDialog(true);
      
                          }}
                          className="w-full justify-start bg-gradient-to-r from-emerald-600/90 to-green-700/90 hover:from-emerald-500 hover:to-green-600 text-white text-xs py-1.5 h-8"
                        >
                          <Activity className="w-3 h-3 mr-1.5" />
                          Status Teste
                        </Button>
                        <Button
                          onClick={() => {
                            setShowCreateClientDialog(true);
      
                          }}
                          className="w-full justify-start bg-gradient-to-r from-blue-600/90 to-blue-700/90 hover:from-blue-500 hover:to-blue-600 text-white text-xs py-1.5 h-8"
                        >
                          <UserPlus className="w-3 h-3 mr-1.5" />
                          Cadastrar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => {
                            setShowCreateTestDialog(true);
      
                          }}
                          className="w-full justify-start bg-gradient-to-r from-purple-600/90 to-purple-700/90 hover:from-purple-500 hover:to-purple-600 text-white text-xs py-1.5 h-8"
                        >
                          <Clock3 className="w-3 h-3 mr-1.5" />
                          Criar Teste
                        </Button>
                        <Button
                          onClick={() => {
                            setShowCreateClientDialog(true);
      
                          }}
                          className="w-full justify-start bg-gradient-to-r from-blue-600/90 to-blue-700/90 hover:from-blue-500 hover:to-blue-600 text-white text-xs py-1.5 h-8"
                        >
                          <UserPlus className="w-3 h-3 mr-1.5" />
                          Cadastrar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              {/* Conversation Actions Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">Conversa</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSearchDialog(true);

                    }}
                    className="w-full justify-start border-slate-600 hover:bg-slate-800 text-xs py-1.5 h-8"
                  >
                    <Search className="w-3 h-3 mr-1.5" />
                    Buscar
                  </Button>
                </div>
              </div>
              
              {/* PIX Payment Section - Available for all conversations */}
              <PixGeneratorSidebar
                key={selectedConversa.id}
                clienteId={selectedConversa.clienteId}
                clienteNome={selectedConversa.clienteNome || selectedConversa.nome || selectedConversa.telefone || ''}
                telefone={selectedConversa.telefone}
                sendMessage={sendMessage}
                initialState={pixStateByConversation.get(`conv_${selectedConversa.id}`)}
                onStateChange={(state) => {
                  setPixStateByConversation(prev => {
                    const newMap = new Map(prev);
                    newMap.set(`conv_${selectedConversa.id}`, state);
                    return newMap;
                  });
                }}
                onPixGenerated={(pixData) => {
                  console.log('[Chat] PIX gerado:', pixData);
                  setTimeout(() => {
                    refetchMensagens();
                  }, 3000);
                }}
              />
              
              {/* Danger Zone Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-red-500 uppercase tracking-wide px-1">Perigo</h4>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(true);
                    // setShowSidebar removido(false);
                  }}
                  className="w-full justify-start border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 text-xs py-1.5 h-8"
                >
                  <Trash2 className="w-3 h-3 mr-1.5" />
                  Apagar
                </Button>
              </div>
              
            </div>
          </div>
        )}
        </div>
      </div>
      
      {/* Media Preview */}
      {selectedFile && (
        <MediaPreview
          file={selectedFile}
          onSend={handleSendMedia}
          onCancel={handleCancelMedia}
        />
      )}

      {/* Audio Recorder */}
      {isRecording && (
        <AudioRecorder
          onSend={handleSendAudio}
          onCancel={() => setIsRecording(false)}
        />
      )}

      {/* Edit Message Dialog */}
      {editingMessage && (
        <EditMessageDialog
          isOpen={!!editingMessage}
          onClose={() => setEditingMessage(null)}
          onConfirm={(newContent) => {
            if (selectedConversa) {
              sendMessage('edit_message', {
                messageId: editingMessage.id,
                newContent,
                telefone: selectedConversa.telefone
              });
              toast({
                title: "Mensagem editada",
                description: "A mensagem foi editada com sucesso",
              });
            }
            setEditingMessage(null);
          }}
          originalMessage={editingMessage}
        />
      )}

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={(open) => {
        setShowNewChatDialog(open);
        if (!open) {
          setContactSearch('');
          setNewChatNumber('');
          setSearchById(false);
        }
      }}>
        <DialogContent className="sm:max-w-2xl bg-dark-surface border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Nova Conversa</DialogTitle>
            <DialogDescription className="text-slate-400">
              Selecione um contato existente ou digite um novo número
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Número de Telefone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  value={newChatNumber}
                  onChange={(e) => {
                    // Format phone number as user types
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      if (value.length >= 2) {
                        value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                      }
                      if (value.length >= 10) {
                        value = `${value.slice(0, 10)}-${value.slice(10)}`;
                      }
                      setNewChatNumber(value);
                    }
                  }}
                  className="pl-10 bg-dark-card border-slate-600"
                />
              </div>
              <p className="text-xs text-slate-500">
                Digite apenas os números. O código do país (+55) será adicionado automaticamente.
              </p>
            </div>

            {/* Contacts List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Contatos Salvos
                </Label>
                <span className="text-xs text-slate-500">
                  {allClientes.length} contatos
                </span>
              </div>
              
              {/* Search Contacts */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder={searchById ? "Buscar por ID..." : "Buscar por nome ou telefone..."}
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="pl-10 h-9 bg-dark-card border-slate-600 text-sm"
                  />
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setSearchById(!searchById)}
                        className={cn(
                          "h-9 px-3 transition-all",
                          searchById ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-600 hover:bg-slate-700"
                        )}
                        size="sm"
                      >
                        {searchById ? (
                          <Hash className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{searchById ? "Buscando por ID" : "Buscando por nome/telefone"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Contacts List with Scroll */}
              <ScrollArea className="h-48 w-full rounded-md border border-slate-700 bg-dark-card">
                <div className="p-2 space-y-1">
                  {allClientes
                    .filter(cliente => {
                      const searchLower = contactSearch.toLowerCase();
                      if (searchById) {
                        // Search by ID
                        return cliente.id.toString().includes(contactSearch);
                      } else {
                        // Search by name or phone
                        return cliente.nome?.toLowerCase().includes(searchLower) ||
                               cliente.telefone?.includes(contactSearch);
                      }
                    })
                    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                    .map((cliente) => (
                      <button
                        key={cliente.id}
                        onClick={() => {
                          // Format phone for display
                          let phone = cliente.telefone.replace(/\D/g, '');
                          if (phone.startsWith('55')) {
                            phone = phone.substring(2);
                          }
                          if (phone.length === 11) {
                            phone = `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
                          } else if (phone.length === 10) {
                            phone = `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
                          }
                          setNewChatNumber(phone);
                        }}
                        className="w-full p-2 text-left rounded hover:bg-slate-700/50 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                            {(cliente.nome || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              {cliente.nome || 'Sem nome'} 
                              <span className="text-xs text-slate-500 ml-1">#{cliente.id}</span>
                            </div>
                            <div className="text-xs text-slate-400">{formatPhoneNumber(cliente.telefone)}</div>
                          </div>
                        </div>
                        <MessageSquare className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))
                  }
                  {allClientes.filter(cliente => {
                    const searchLower = contactSearch.toLowerCase();
                    if (searchById) {
                      return cliente.id.toString().includes(contactSearch);
                    } else {
                      return cliente.nome?.toLowerCase().includes(searchLower) ||
                             cliente.telefone?.includes(contactSearch);
                    }
                  }).length === 0 && (
                    <div className="text-center py-4 text-sm text-slate-500">
                      {contactSearch ? 'Nenhum contato encontrado' : 'Nenhum contato salvo'}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowNewChatDialog(false);
                setNewChatNumber('');
              }}
              className="border-slate-600"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const cleanNumber = newChatNumber.replace(/\D/g, '');
                if (cleanNumber.length >= 10) {
                  startNewChatMutation.mutate(cleanNumber);
                } else {
                  toast({
                    title: 'Número inválido',
                    description: 'Por favor, digite um número de telefone válido.',
                    variant: 'destructive'
                  });
                }
              }}
              disabled={startNewChatMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {startNewChatMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Iniciar Conversa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Test Dialog */}
      <CreateTestDialog
        open={showCreateTestDialog}
        onOpenChange={setShowCreateTestDialog}
        defaultPhone={selectedConversa?.telefone || ''}
        sistemaId={sistemas && Array.isArray(sistemas) && sistemas.length > 0 ? sistemas[0].id : null}
        onTestCreated={() => {
          // Switch to "testes" tab after creating test
          setContactFilter('testes');
          // Force refresh conversations
          refetchConversas();
        }}
      />

      {/* Create Client Dialog */}
      <CreateClientDialog
        open={showCreateClientDialog}
        onOpenChange={setShowCreateClientDialog}
        defaultPhone={selectedConversa?.telefone || ''}
        defaultIndicadoPor={(() => {
          // Extract referral code from metadata if exists
          if (selectedConversa?.metadados) {
            try {
              const metadata = JSON.parse(selectedConversa.metadados);
              return metadata.codigoIndicacao || '';
            } catch {
              return '';
            }
          }
          return '';
        })()}
        onClientCreated={() => {
          // Switch to "clientes" tab after creating client
          setContactFilter('clientes');
          // Force refresh conversations
          refetchConversas();
        }}
      />

      {/* Test Details Dialog */}
      {showTestDetailsDialog && testPhoneNumber && (
        <TestDetailsDialog
          open={showTestDetailsDialog}
          onOpenChange={setShowTestDetailsDialog}
          phoneNumber={testPhoneNumber}
        />
      )}

      {/* Draggable Test Chat */}
      <DraggableTestChat
        isOpen={showTestChatModal}
        onClose={() => setShowTestChatModal(false)}
      />

      {/* Search Dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="sm:max-w-lg bg-dark-surface border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Buscar na Conversa</DialogTitle>
            <DialogDescription className="text-slate-400">
              Digite o texto que deseja buscar nas mensagens
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Digite sua busca..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // Search in messages
                    if (e.target.value.trim()) {
                      const results = allMessages.filter(msg => 
                        msg.conteudo?.toLowerCase().includes(e.target.value.toLowerCase())
                      );
                      setSearchResults(results);
                    } else {
                      setSearchResults([]);
                    }
                  }}
                  className="pl-10 bg-dark-card border-slate-600"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-80 overflow-y-auto space-y-2 mt-3 border border-slate-700 rounded-lg p-2">
                  {searchResults.map((msg) => (
                    <div 
                      key={msg.id} 
                      className="p-3 bg-dark-card/50 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700/50"
                      onClick={() => {
                        // Scroll to message
                        const element = document.getElementById(`msg-${msg.id}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          // Highlight the message
                          element.classList.add('animate-pulse', 'bg-blue-500/20');
                          setTimeout(() => {
                            element.classList.remove('animate-pulse', 'bg-blue-500/20');
                          }, 2000);
                        }
                        setShowSearchDialog(false);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-slate-400">
                          {msg.remetente === 'cliente' ? 'Cliente' : 'Você'}
                        </p>
                        {msg.timestamp && (
                          <p className="text-xs text-slate-500">
                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 line-clamp-2 break-words">
                        {msg.conteudo}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <p className="text-sm text-slate-500 text-center">Nenhuma mensagem encontrada</p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowSearchDialog(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="border-slate-600"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md bg-dark-surface border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-red-400">Apagar Conversa</DialogTitle>
            <DialogDescription className="text-slate-400">
              Esta ação irá apagar permanentemente a conversa e todas as mensagens.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Alert className="border-red-500/30 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                Esta ação não pode ser desfeita! Todas as mensagens serão perdidas permanentemente.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="border-slate-600"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!selectedConversa) return;
                
                try {
                  // Delete conversation and its messages only (not the client)
                  await apiRequest('DELETE', `/api/conversas/${selectedConversa.id}`);
                  
                  toast({
                    title: "Conversa apagada",
                    description: "A conversa e todas as mensagens foram removidas com sucesso",
                  });
                  
                  // Reset selected conversation and refresh list
                  setSelectedConversa(null);
                  refetchConversas();
                  setShowDeleteDialog(false);
                } catch (error) {
                  toast({
                    title: "Erro ao apagar",
                    description: "Ocorreu um erro ao tentar apagar a conversa",
                    variant: "destructive",
                  });
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Apagar Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
