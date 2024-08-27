'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { v4 as uuidv4 } from 'uuid' 
import { ImageIcon, MicIcon, LinkIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/ui/use-toast'

type ChatMessage = {
  id: number
  text: string
  sender: 'user' | 'other' | 'system'
  type: 'chat' | 'system'
  senderId: string
}

type Props = {
  id: string
}

type WebSocketMessage = {
  type: 'chat' | 'system' | 'pong' | 'user_count' | 'typing'
  count?: number
  id?: number
  text?: string
  senderId?: string
  isTyping?: boolean
}

interface CustomWebSocket extends WebSocket {
  closeIntentionally?: boolean;
}

export default function ChatComponent({ id: roomId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [connectionState, setConnectionState] = useState({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
  })
  const [chatState, setChatState] = useState({
    senderId: '',
    connectedUsers: 0,
    isOtherUserTyping: false,
    lastPongTime: Date.now(),
  })
  const [settings, setSettings] = useState({
    allowImages: true,
    allowAudio: true,
  })
  const router = useRouter()

  const maxReconnectAttempts = 5
  const wsRef = useRef<CustomWebSocket | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Generate and set senderId when the component mounts
  useEffect(() => {
    const newSenderId = uuidv4()
    setChatState(prev => ({ ...prev, senderId: newSenderId }))
    
    // Clean up function to reset senderId when component unmounts
    return () => {
      setChatState(prev => ({ ...prev, senderId: '' }))
    }
  }, [])

  const connectWebSocket = useCallback(() => {
    if (connectionState.isConnecting || connectionState.isConnected || connectionState.reconnectAttempts >= maxReconnectAttempts) return;

    setConnectionState(prev => ({ ...prev, isConnecting: true }));

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.NEXT_PUBLIC_WS_URL || 'localhost:3001';
    const wsUrl = `${wsProtocol}//${wsHost}/chat/${roomId}`;

    console.log('Attempting to connect WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl) as CustomWebSocket;

    ws.onopen = () => {
      setConnectionState({ isConnected: true, isConnecting: false, reconnectAttempts: 0 });
      wsRef.current = ws;
      setChatState(prev => ({ ...prev, lastPongTime: Date.now() }));
      
      // Send init message with senderId
      ws.send(JSON.stringify({ type: 'init', senderId: chatState.senderId }));
      
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 15000);
    };

    ws.onerror = () => {
      setConnectionState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        if (message.type === 'pong') {
          setChatState(prev => ({ ...prev, lastPongTime: Date.now() }));
        } else if (message.type === 'user_count') {
          setChatState(prev => ({ ...prev, connectedUsers: message.count || 0 }));
        } else if (message.type === 'typing') {
          setChatState(prev => ({ ...prev, isOtherUserTyping: message.isTyping || false }));
        } else {
          const chatMessage = message as ChatMessage;
          setMessages((prevMessages) => {
            if (prevMessages.some(m => m.id === chatMessage.id)) {
              return prevMessages;
            }
            return [...prevMessages, chatMessage];
          });
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onclose = (event) => {
      setConnectionState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
      wsRef.current = null;
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      if (event.reason === 'room_full') {
        window.location.href = '/error?reason=room_full';
      } else if (!ws.closeIntentionally && connectionState.reconnectAttempts < maxReconnectAttempts) {
        setConnectionState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
        setTimeout(connectWebSocket, 5000);
      }
    };

    return ws;
  }, [roomId, connectionState, chatState.senderId, maxReconnectAttempts]);

  useEffect(() => {
    if (chatState.senderId && !connectionState.isConnected && !connectionState.isConnecting && connectionState.reconnectAttempts < maxReconnectAttempts) {
      const ws = connectWebSocket();

      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.closeIntentionally = true;
          ws.close();
        }
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
      };
    }
  }, [connectWebSocket, connectionState, maxReconnectAttempts, chatState.senderId]);

  useEffect(() => {
    const checkServerConnection = setInterval(() => {
      if (Date.now() - chatState.lastPongTime > 45000) {
        if (wsRef.current) {
          wsRef.current.close();
        }
        connectWebSocket();
      }
    }, 15000);

    return () => clearInterval(checkServerConnection);
  }, [chatState.lastPongTime, connectWebSocket]);

  useEffect(() => {
    if (connectionState.isConnected && inputRef.current) {
      inputRef.current.focus()
    }
  }, [connectionState.isConnected])

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatState.isOtherUserTyping, scrollToBottom]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputMessage.trim() && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const newMessage: ChatMessage = {
        id: Date.now(),
        text: inputMessage,
        sender: 'user',
        type: 'chat',
        senderId: chatState.senderId
      };
      wsRef.current.send(JSON.stringify(newMessage));
      setInputMessage('');
      scrollToBottom();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', isTyping: true, senderId: chatState.senderId }));
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'typing', isTyping: false, senderId: chatState.senderId }));
        }
      }, 1000);
    }
  };

  useEffect(() => {
    if (chatState.connectedUsers > 2) {
      router.push('/error?reason=chat_interrupted')
    }
  }, [chatState.connectedUsers, router])

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      toast({
        title: "Invite link copied!",
        description: "The invite link has been copied to your clipboard.",
      });
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast({
        title: "Failed to copy",
        description: "An error occurred while copying the invite link.",
        variant: "destructive",
      });
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white p-4 shadow flex justify-between items-center">
        <h1 className="text-xl font-bold">Shh</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${connectionState.isConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {connectionState.isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <span className="px-2 py-1 bg-blue-200 rounded-full text-xs font-semibold">
              Users: {chatState.connectedUsers}
            </span>
            <span className="px-2 py-1 bg-gray-200 rounded-full text-xs font-semibold">
              Room: {roomId.substring(0, 10)}...
            </span>
          </div>
          <div className="flex items-center">
            <ImageIcon className="w-4 h-4 mr-2" /> 
            <Switch checked={settings.allowImages} onCheckedChange={(checked) => setSettings(prev => ({ ...prev, allowImages: checked }))} />
          </div>
          <div className="flex items-center">
            <MicIcon className="w-4 h-4 mr-2" />
            <Switch checked={settings.allowAudio} onCheckedChange={(checked) => setSettings(prev => ({ ...prev, allowAudio: checked }))} />
          </div>
          <Button 
            onClick={(event) => {
              copyInviteLink();
              const button = event.currentTarget as HTMLButtonElement;
              const originalText = button.textContent || 'Copy Invite Link';
              button.textContent = 'Copied!';
              setTimeout(() => {
                button.textContent = originalText;
              }, 2000);
            }} 
            className="flex items-center"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Copy Invite Link
          </Button>
        </div>
      </header>
      
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        {messages.map((message, index) => {
          const isCurrentUser = message.senderId === chatState.senderId;
          return (
            <div key={`${message.id}-${index}`} className={`mb-4 flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg p-3 ${
                message.type === 'system'
                  ? 'bg-yellow-200 text-black'
                  : isCurrentUser 
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-black'
              }`}>
                <p className="text-sm">{message.text}</p>
              </div>
            </div>
          );
        })}
        {chatState.isOtherUserTyping && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-200 rounded-lg p-3">
              <div className="flex space-x-2 items-center">
                <span className="text-sm text-gray-500">Typing</span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
      
      <div className="p-4 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={inputMessage}
            onChange={handleInputChange}
            disabled={!connectionState.isConnected || chatState.connectedUsers > 2} // if someone guesses link URL somehow, it locks the room and the joining user won't see any messages, + notifies current users if something bad happens like a 3rd user joins.
          />
          <Button className='bg-blue-500' type="submit" disabled={!connectionState.isConnected || chatState.connectedUsers > 2}>Send</Button>
        </form>
      </div>
    </div>
  );
}