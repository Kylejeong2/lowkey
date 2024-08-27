import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const server = createServer();
const wss = new WebSocketServer({ noServer: true });

interface RoomClient {
  ws: WebSocket;
  senderId: string;
}

const rooms = new Map<string, Map<string, RoomClient>>();

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  console.log('Upgrade request received for path:', pathname);

  if (pathname?.startsWith('/chat/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const roomId = pathname.split('/').pop();
      if (roomId) {
        handleConnection(ws, roomId);
      } else {
        console.error('Invalid room ID');
        ws.close(1008, 'Invalid room ID');
      }
    });
  } else {
    console.error('Invalid WebSocket path');
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
  }
});

function handleConnection(ws: WebSocket, roomId: string) {
  const truncatedRoomId = roomId.length > 10 ? `${roomId.slice(0, 10)}...` : roomId;
  console.log(`New connection to room: ${truncatedRoomId}`);

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  let senderId: string;
  let lastHeartbeatTime = Date.now();

  const heartbeatCheck = setInterval(() => {
    const now = Date.now();
    if (now - lastHeartbeatTime > 45000) { // 45 seconds without a heartbeat
      console.log(`No heartbeat received from client in room ${truncatedRoomId}, closing connection`);
      clearInterval(heartbeatCheck);
      ws.close(1000, 'No heartbeat');
    } else {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }, 30000);

  ws.on('message', (message) => {
    console.log(`Message received in room ${truncatedRoomId}:`, message.toString());
    try {
      const parsedMessage = JSON.parse(message.toString());
      
      if (parsedMessage.type === 'init') {
        senderId = parsedMessage.senderId;
        const roomClients = rooms.get(roomId)!;
        roomClients.set(senderId, { ws, senderId });
        
        // Send user count to all clients in the room
        const userCount = roomClients.size;
        roomClients.forEach(client => {
          client.ws.send(JSON.stringify({ type: 'user_count', count: userCount }));
        });
        
        return;
      }
      
      if (parsedMessage.type === 'heartbeat') {
        console.log(`Heartbeat received from client in room ${truncatedRoomId}`);
        lastHeartbeatTime = Date.now();
        return;
      }
      
      if (parsedMessage.type === 'typing') {
        // Forward typing status to the other client in the room
        rooms.get(roomId)!.forEach((client, clientSenderId) => {
          if (clientSenderId !== senderId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: 'typing',
              isTyping: parsedMessage.isTyping
            }));
          }
        });
        return;
      }
      
      // For other message types (chat messages)
      rooms.get(roomId)!.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message.toString());
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    clearInterval(heartbeatCheck);
    const roomClients = rooms.get(roomId);
    if (roomClients) {
      roomClients.delete(senderId);
      if (roomClients.size === 0) {
        rooms.delete(roomId);
      } else {
        // Notify remaining users of the updated user count
        const userCount = roomClients.size;
        roomClients.forEach(client => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({ type: 'user_count', count: userCount }));
            client.ws.send(JSON.stringify({ id: Date.now(), text: 'A user has left the room.', sender: 'system', type: 'system' }));
          }
        });
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error in room ${truncatedRoomId}:`, error);
  });
}

const port = process.env.WS_PORT || 3001;
server.listen(port, () => {
  console.log(`WebSocket server is running on port ${port}`);
});