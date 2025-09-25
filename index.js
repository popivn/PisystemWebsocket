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
const clients = new Map(); // username -> WebSocket
const userSockets = new Map(); // WebSocket -> username

// Helper functions
function parseChannel(channel) {
  // Parse "chat.user.john_doe" -> username: "john_doe"
  const parts = channel.split('.');
  if (parts.length >= 3 && parts[0] === 'chat' && parts[1] === 'user') {
    return String(parts[2]); // username
  }
  return null;
}

function handleLaravelMessage(ws, data) {
  console.log(`📨 Laravel message: ${data.event} on ${data.channel}`);
  
  // Parse target username from channel
  const targetUsername = parseChannel(data.channel);
  console.log(`🎯 Target username: ${targetUsername} (type: ${typeof targetUsername})`);
  console.log(`📊 Available users: ${Array.from(clients.keys())}`);
  
  // Log message details
  const senderUser = data.data?.user || 'Unknown';
  const messageContent = data.data?.message || 'No message';
  const receiverId = data.data?.receiverId || 'Unknown';
  const conversationId = data.data?.conversationId || 'Unknown';
  
  console.log(`💬 Message Details:`);
  console.log(`   👤 From: ${senderUser}`);
  console.log(`   📝 Content: ${messageContent}`);
  console.log(`   🎯 To Username: ${targetUsername}`);
  console.log(`   💬 Conversation: ${conversationId}`);
  console.log(`   ⏰ Time: ${data.data?.timestamp || 'Unknown'}`);
  
  if (targetUsername) {
    // Send to specific user by username
    const targetWs = clients.get(targetUsername);
    console.log(`🔍 Target WS exists: ${!!targetWs}`);
    console.log(`🔍 Target WS ready state: ${targetWs ? targetWs.readyState : 'N/A'}`);
    
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(JSON.stringify({
        type: "laravel_message",
        event: data.event,
        channel: data.channel,
        data: data.data,
        timestamp: new Date().toISOString()
      }));
      console.log(`📤 ✅ Message delivered: ${senderUser} → ${targetUsername}`);
      console.log(`📤 ✅ Content: "${messageContent}"`);
    } else {
      console.log(`❌ User ${targetUsername} not connected`);
      
      // Check if user not registered
      if (!clients.has(targetUsername)) {
        console.log(`⚠️ User ${targetUsername} chưa register WebSocket`);
      }
      
      // Clean up stale connection
      if (targetWs && targetWs.readyState !== WebSocket.OPEN) {
        console.log(`🧹 Cleaning up stale connection for user ${targetUsername}`);
        clients.delete(targetUsername);
        userSockets.delete(targetWs);
      }
    }
  } else {
    console.log(`❌ Invalid channel format: ${data.channel}`);
  }
}

function handleSimpleMessage(ws, data) {
  // Get sender info
  const senderUsername = userSockets.get(ws) || 'Unknown';
  const messageContent = data.message || 'No message';
  
  console.log(`💬 Simple Message Details:`);
  console.log(`   👤 From Username: ${senderUsername}`);
  console.log(`   📝 Content: ${messageContent}`);
  console.log(`   📊 Broadcasting to ${clients.size - 1} other users`);
  
  // Broadcast message đến tất cả client khác
  const broadcastMessage = {
    type: "broadcast",
    from: "server",
    message: data.message,
    timestamp: new Date().toISOString(),
    clientCount: clients.size
  };
  
  let broadcastCount = 0;
  clients.forEach((client, username) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(broadcastMessage));
      broadcastCount++;
      console.log(`📤 ✅ Broadcasted to User ${username}`);
    }
  });
  
  console.log(`📤 ✅ Simple message delivered: User ${senderUsername} → ${broadcastCount} users`);
  console.log(`📤 ✅ Content: "${messageContent}"`);
  
  // Echo back to sender
  ws.send(JSON.stringify({
    type: "echo",
    message: `Echo: ${data.message}`,
    timestamp: new Date().toISOString()
  }));
}

function handleUserRegistration(ws, data) {
  const username = data.username || 'Unknown';
  
  console.log(`🔍 Registering user ${username} (type: ${typeof username})`);
  console.log(`🔍 Current clients: ${Array.from(clients.keys())}`);
  console.log(`🔍 WebSocket ready state: ${ws.readyState}`);
  
  // Check if WebSocket is still open
  if (ws.readyState !== WebSocket.OPEN) {
    console.log(`❌ WebSocket not open for user ${username}`);
    return;
  }
  
  clients.set(username, ws);
  userSockets.set(ws, username);
  
  console.log(`👤 ✅ User ${username} registered successfully`);
  console.log(`📊 Total users online: ${clients.size}`);
  console.log(`📊 All users: ${Array.from(clients.keys())}`);
  console.log(`🔗 Connection from: ${ws._socket?.remoteAddress || 'Unknown'}`);
  
  ws.send(JSON.stringify({
    type: "registered",
    username: username,
    message: `User ${username} registered successfully`,
    timestamp: new Date().toISOString(),
    onlineUsers: Array.from(clients.keys())
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
      
      // Debug: Check message format
      console.log(`🔍 Debug - event: ${data.event}, channel: ${data.channel}, data: ${data.data ? 'exists' : 'missing'}`);
      
      // Handle Laravel WebSocket format
      if (data.event && data.channel && data.data) {
        console.log(`🎯 Handling Laravel message`);
        handleLaravelMessage(ws, data);
      } 
      // Handle simple message format (backward compatibility)
      else if (data.message) {
        console.log(`🎯 Handling simple message`);
        handleSimpleMessage(ws, data);
      }
      // Handle user registration
      else if (data.type === "register" && data.userId) {
        console.log(`🎯 Handling user registration`);
        handleUserRegistration(ws, data);
      }
      else {
        console.log(`❌ Unknown message format`);
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

  ws.on("close", (code, reason) => {
    console.log(`👋 Client disconnected - Code: ${code}, Reason: ${reason}`);
    // Remove from user tracking
    const username = userSockets.get(ws);
    if (username) {
      clients.delete(username);
      userSockets.delete(ws);
      console.log(`👤 ❌ User ${username} disconnected`);
      console.log(`📊 Remaining users online: ${clients.size}`);
      console.log(`📊 Available users: ${Array.from(clients.keys())}`);
      console.log(`🔗 Disconnection reason: ${reason || 'Normal closure'}`);
    } else {
      console.log(`⚠️ Client disconnected but no username found`);
    }
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
    const username = userSockets.get(ws);
    if (username) {
      clients.delete(username);
      userSockets.delete(ws);
      console.log(`👤 User ${username} disconnected due to error`);
      console.log(`📊 Remaining users online: ${clients.size}`);
    }
  });

  // Ping/pong to keep connection alive
  ws.on("pong", () => {
    const username = userSockets.get(ws);
    console.log(`🏓 Pong received from ${username || 'unknown'}`);
  });

  // Send ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      const username = userSockets.get(ws);
      console.log(`🏓 Ping sent to ${username || 'unknown'}`);
    } else {
      console.log(`🏓 Ping stopped - WebSocket state: ${ws.readyState}`);
      clearInterval(pingInterval);
    }
  }, 30000);
});

// Periodic cleanup of stale connections
setInterval(() => {
  console.log(`🧹 Periodic cleanup - checking ${clients.size} users`);
  const staleUsers = [];
  
  clients.forEach((ws, username) => {
    console.log(`🔍 User ${username} - WS state: ${ws.readyState}`);
    if (ws.readyState !== WebSocket.OPEN) {
      staleUsers.push(username);
    }
  });
  
  if (staleUsers.length > 0) {
    console.log(`🧹 Cleaning up ${staleUsers.length} stale connections: ${staleUsers.join(', ')}`);
    staleUsers.forEach(username => {
      const ws = clients.get(username);
      clients.delete(username);
      if (ws) userSockets.delete(ws);
    });
    console.log(`📊 Remaining users: ${clients.size}`);
  }
}, 30000); // Check every 30 seconds

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
