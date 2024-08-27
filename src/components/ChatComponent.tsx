'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { v4 as uuidv4 } from 'uuid' 
import { ImageIcon, MicIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

type Message = {
  id: number
  text: string
  sender: 'user' | 'other' | 'system'
  type: 'message' | 'pong'
  senderId: string
}

type Props = {
  id: string
}

interface CustomWebSocket extends WebSocket {
  closeIntentionally?: boolean;
}

export default function ChatComponent({ id }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const maxReconnectAttempts = 5
  const [roomId] = useState(id)
  const wsRef = useRef<CustomWebSocket | null>(null)
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  const [senderId, setSenderId] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [allowImages, setAllowImages] = useState(true)
  const [allowAudio, setAllowAudio] = useState(true)

  // Generate a unique senderId when the component mounts
  useEffect(() => {
    const newSenderId = uuidv4() + uuidv4() + uuidv4() + uuidv4() // make it longer
    setSenderId(newSenderId)

    // Clean up function to "delete" the senderId when the component unmounts
    return () => {
      setSenderId('')
    }
  }, [])

  const sendHeartbeat = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (isConnecting || isConnected || reconnectAttempts >= maxReconnectAttempts) return;

    setIsConnecting(true);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.NEXT_PUBLIC_WS_URL || 'localhost:3001';
    const wsUrl = `${wsProtocol}//${wsHost}/chat/${roomId}`;

    console.log('Attempting to connect WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl) as CustomWebSocket;

    ws.onopen = (event) => {
      console.log('WebSocket connection opened:', event);
      setIsConnected(true);
      setIsConnecting(false);
      setReconnectAttempts(0);
      wsRef.current = ws;
      
      // Set up heartbeat interval
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 15000); // Send heartbeat every 15 seconds
      setHeartbeatInterval(interval);
    };

    ws.onerror = (event) => {
      console.error('WebSocket error event:', event);
      setIsConnected(false);
      setIsConnecting(false);
    };

    ws.onmessage = (event) => {
      console.log('WebSocket message received:', event.data);
      try {
        const message: Message = JSON.parse(event.data);
        if (message.type === 'pong') {
          console.log('Received pong from server');
          return;
        }
        setMessages((prevMessages) => {
          if (prevMessages.some(m => m.id === message.id)) {
            return prevMessages;
          }
          return [...prevMessages, message];
        });
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket connection closed:', event);
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;
      
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        setHeartbeatInterval(null);
      }
      
      if (event.reason === 'room_full') {
        window.location.href = '/error?reason=room_full';
      } else if (!ws.closeIntentionally && reconnectAttempts < maxReconnectAttempts) {
        console.log(`Attempting to reconnect... (Attempt ${reconnectAttempts + 1})`);
        setReconnectAttempts(prev => prev + 1);
        setTimeout(connectWebSocket, 5000);
      }
    };

    return ws;
  }, [roomId, senderId, heartbeatInterval, isConnecting, isConnected, reconnectAttempts, maxReconnectAttempts]);

  useEffect(() => {
    if (!isConnected && !isConnecting && reconnectAttempts < maxReconnectAttempts) {
      const ws = connectWebSocket();

      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          console.log('Closing WebSocket connection intentionally');
          ws.closeIntentionally = true;
          ws.close();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      };
    }
  }, [connectWebSocket, isConnected, isConnecting, reconnectAttempts, maxReconnectAttempts]);

  // Add this useEffect to focus the input
  useEffect(() => {
    if (isConnected && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isConnected])

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputMessage.trim() && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const newMessage: Message = {
        id: Date.now(),
        text: inputMessage,
        sender: 'user',
        type: 'message',
        senderId: senderId // Use the generated senderId
      };
      wsRef.current.send(JSON.stringify(newMessage));
      setInputMessage('');
      // setMessages(prevMessages => [...prevMessages, newMessage]); // makes it double?
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white p-4 shadow flex justify-between items-center">
        <h1 className="text-xl font-bold">Shh</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <span className="px-2 py-1 bg-gray-200 rounded-full text-xs font-semibold">
              Room: {roomId}
            </span>
          </div>
          <div className="flex items-center">
            <ImageIcon className="w-4 h-4 mr-2" /> 
            <Switch checked={allowImages} onCheckedChange={setAllowImages} />
          </div>
          <div className="flex items-center">
            <MicIcon className="w-4 h-4 mr-2" />
            <Switch checked={allowAudio} onCheckedChange={setAllowAudio} />
          </div>
        </div>
      </header>
      
      <ScrollArea className="flex-grow p-4">
        {messages.map((message, index) => {
          const isCurrentUser = message.senderId === senderId;
          return (
            <div key={`${message.id}-${index}`} className={`mb-4 flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg p-3 ${
                isCurrentUser 
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-black'
              }`}>
                {!isCurrentUser && (
                  <div className="flex items-center mb-1">
                    {/* <p className="font-semibold text-sm">{message.senderId.slice(0, 8)}</p> */}
                  </div>
                )}
                <p className="text-sm">{message.text}</p>
              </div>
            </div>
          );
        })}
      </ScrollArea>
      
      <div className="p-4 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={!isConnected}
          />
          <Button type="submit" disabled={!isConnected}>Send</Button>
        </form>
      </div>
    </div>
  );
}