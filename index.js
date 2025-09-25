// index.js
const express = require("express");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000; // Render sẽ inject PORT

// HTTP server (Render yêu cầu có HTTP endpoint)
const app = express();

// Middleware để parse JSON
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "WebSocket server is running! 🚀",
    status: "online",
    timestamp: new Date().toISOString(),
    websocket: "ws://" + req.get('host') + "/ws"
  });
});

// Health check endpoint cho Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 HTTP server listening on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});

// WebSocket server (chạy cùng cổng với HTTP)
const wss = new WebSocketServer({ 
  server,
  path: "/ws" // WebSocket endpoint tại /ws
});

// Store connected clients with user info
const clients = new Map(); // userId -> WebSocket
const userSockets = new Map(); // WebSocket -> userId

// Helper functions
function parseChannel(channel) {
  // Parse "chat.user.10001254" -> userId: 10001254
  const parts = channel.split('.');
  if (parts.length >= 3 && parts[0] === 'chat' && parts[1] === 'user') {
    return parts[2];
  }
  return null;
}

function handleLaravelMessage(ws, data) {
  console.log(`📨 Laravel message: ${data.event} on ${data.channel}`);
  
  // Parse target user from channel
  const targetUserId = parseChannel(data.channel);
  
  if (targetUserId) {
    // Send to specific user
    const targetWs = clients.get(targetUserId);
    if (targetWs && targetWs.readyState === ws.OPEN) {
      targetWs.send(JSON.stringify({
        type: "laravel_message",
        event: data.event,
        channel: data.channel,
        data: data.data,
        timestamp: new Date().toISOString()
      }));
      console.log(`📤 Sent to user ${targetUserId}`);
    } else {
      console.log(`❌ User ${targetUserId} not connected`);
    }
  } else {
    console.log(`❌ Invalid channel format: ${data.channel}`);
  }
}

function handleSimpleMessage(ws, data) {
  // Broadcast message đến tất cả client khác
  const broadcastMessage = {
    type: "broadcast",
    from: "server",
    message: data.message,
    timestamp: new Date().toISOString(),
    clientCount: clients.size
  };
  
  clients.forEach((client) => {
    if (client !== ws && client.readyState === ws.OPEN) {
      client.send(JSON.stringify(broadcastMessage));
    }
  });
  
  // Echo back to sender
  ws.send(JSON.stringify({
    type: "echo",
    message: `Echo: ${data.message}`,
    timestamp: new Date().toISOString()
  }));
}

function handleUserRegistration(ws, data) {
  const userId = data.userId;
  clients.set(userId, ws);
  userSockets.set(ws, userId);
  
  console.log(`👤 User ${userId} registered`);
  
  ws.send(JSON.stringify({
    type: "registered",
    userId: userId,
    message: `User ${userId} registered successfully`,
    timestamp: new Date().toISOString()
  }));
}

wss.on("connection", (ws, req) => {
  console.log("🔗 New client connected from:", req.socket.remoteAddress);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: "welcome",
    message: "Connected to WebSocket server! 🎉",
    timestamp: new Date().toISOString(),
    clientCount: clients.size
  }));

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📨 Received:`, data);
      
      // Handle Laravel WebSocket format
      if (data.event && data.channel && data.data) {
        handleLaravelMessage(ws, data);
      } 
      // Handle simple message format (backward compatibility)
      else if (data.message) {
        handleSimpleMessage(ws, data);
      }
      // Handle user registration
      else if (data.type === "register" && data.userId) {
        handleUserRegistration(ws, data);
      }
      else {
        // Unknown format
        ws.send(JSON.stringify({
          type: "error",
          message: "Unknown message format",
          timestamp: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      console.error("❌ Error parsing message:", error);
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON format",
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on("close", () => {
    console.log("👋 Client disconnected");
    // Remove from user tracking
    const userId = userSockets.get(ws);
    if (userId) {
      clients.delete(userId);
      userSockets.delete(ws);
      console.log(`👤 User ${userId} disconnected`);
    }
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
    clients.delete(ws);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
