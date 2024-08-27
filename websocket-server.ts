import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';

const server = createServer();
const wss = new WebSocketServer({ noServer: true });

const rooms = new Map<string, Set<WebSocket>>();

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
  console.log(`New connection to room: ${roomId}`);

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId)!.add(ws);

  // Send a welcome message to the client only once when they join
  //   ws.send(JSON.stringify({ id: Date.now(), text: `Welcome to room ${roomId}`, sender: 'system' }));

  // Implement ping-pong
  let isAlive = true;
  const pingInterval = setInterval(() => {
    if (!isAlive) {
      console.log(`Terminating inactive connection in room ${roomId}`);
      clearInterval(pingInterval);
      return ws.terminate();
    }
    isAlive = false;
    ws.send(JSON.stringify({ type: 'pong', text: 'pong' }));
  }, 30000);

  ws.on('pong', () => {
    isAlive = true;
  });

  ws.on('message', (message) => {
    console.log(`Message received in room ${roomId}:`, message.toString());
    try {
      const parsedMessage = JSON.parse(message.toString());
      if (parsedMessage.type === 'heartbeat') {
        console.log(`Heartbeat received from client in room ${roomId}`);
        return;
      }
      rooms.get(roomId)!.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`Connection closed in room ${roomId}. Code: ${code}, Reason: ${reason}`);
    clearInterval(pingInterval);
    rooms.get(roomId)!.delete(ws);
    if (rooms.get(roomId)!.size === 0) {
      rooms.delete(roomId);
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error in room ${roomId}:`, error);
  });
}

const port = process.env.WS_PORT || 3001;
server.listen(port, () => {
  console.log(`WebSocket server is running on port ${port}`);
});