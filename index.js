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

// Store connected clients
const clients = new Set();

wss.on("connection", (ws, req) => {
  console.log("🔗 New client connected from:", req.socket.remoteAddress);
  
  // Add client to set
  clients.add(ws);
  
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
      
      // Broadcast message đến tất cả client khác
      const broadcastMessage = {
        type: "broadcast",
        from: "server",
        message: data.message || data,
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
        message: `Echo: ${data.message || data}`,
        timestamp: new Date().toISOString()
      }));
      
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
    clients.delete(ws);
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
