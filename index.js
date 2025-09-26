// index.js
const express = require("express");
const cors = require("cors");
const { WebSocketServer, WebSocket } = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

// --- HTTP Server Setup ---
const app = express();

// CORS Middleware
// Tạm thời cho phép tất cả các origin để debug.
// Sau khi xác nhận thành công, chúng ta sẽ đổi lại thành origin cụ thể.
app.use(cors()); 

// const corsOptions = {
//   origin: "https://study.vttu.edu.vn:8338", // Allow specific origin
//   methods: ["GET", "POST", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// };
// app.use(cors(corsOptions));
app.use(express.json()); // Middleware to parse JSON

const server = app.listen(PORT, () => {
  console.log(`🚀 HTTP server listening on port ${PORT}`);
});

// --- WebSocket Server Setup ---
const wss = new WebSocketServer({ server, path: "/ws" });

// --- Data Storage ---
// Enhanced client tracking for presence
// clients: Map<username, { ws: WebSocket, lastSeen: string, sessionId: string }>
const clients = new Map(); 
// userSockets: Map<WebSocket, username>
const userSockets = new Map(); 

// --- Helper Functions ---

function broadcast(message) {
  const messageString = JSON.stringify(message);
  clients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageString);
    }
  });
}

function broadcastPresenceUpdate(changedUser, status) {
  console.log(`📢 Broadcasting presence update: ${changedUser} is ${status}`);
  const message = {
    type: "presence_update",
    changed: {
      username: changedUser,
      status: status,
      changedAt: new Date().toISOString(),
    },
    users: Array.from(clients.keys()), // Full online user list
  };
  broadcast(message);
}

function parseChannel(channel) {
  const parts = channel.split('.');
  if (parts.length >= 3 && parts[0] === 'chat' && parts[1] === 'user') {
    return String(parts[2]); // username
  }
  return null;
}

// --- HTTP Endpoints for Presence and Health ---

app.get("/health", (req, res) => {
  res.status(200).json({ 
    ok: true, 
    serverTime: new Date().toISOString() 
  });
});

app.get("/online-users", (req, res) => {
  const onlineUsers = Array.from(clients.entries()).map(([username, data]) => ({
    username,
    lastSeen: data.lastSeen,
    online: true,
  }));
  res.status(200).json({
    success: true,
    serverTime: new Date().toISOString(),
    users: onlineUsers,
  });
});

app.get("/online-users/check", (req, res) => {
  const usernames = req.query.usernames ? req.query.usernames.split(',') : [];
  const statuses = {};
  usernames.forEach(username => {
    statuses[username] = clients.has(username);
  });
  res.status(200).json({
    success: true,
    serverTime: new Date().toISOString(),
    statuses,
  });
});

// --- WebSocket Event Handlers ---

function handleLaravelMessage(ws, data) {
  const targetUsername = parseChannel(data.channel);
  const senderUsername = data.data?.user;
  const messageId = data.data?.messageId; // From Laravel client

  if (targetUsername) {
    const targetClient = clients.get(targetUsername);

    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
      // Forward the original message to the target
      targetClient.ws.send(JSON.stringify({
        type: "laravel_message",
        ...data,
      }));
      console.log(`✅ Message delivered: ${senderUsername} → ${targetUsername}`);
      
      // Send delivery acknowledgement back to the sender
      const senderClient = clients.get(senderUsername);
      if (senderClient && senderClient.ws.readyState === WebSocket.OPEN) {
        senderClient.ws.send(JSON.stringify({
          type: "delivery_status",
          to: targetUsername,
          delivered: true,
          messageId: messageId,
          receiverUsername: targetUsername
        }));
        console.log(`✅ Delivery ack sent to ${senderUsername}`);
      }
    } else {
      console.log(`❌ User ${targetUsername} not connected`);
    }
  } else {
    console.log(`❌ Invalid channel format: ${data.channel}`);
  }
}

function handleUserRegistration(ws, data) {
  const username = data.username;
  if (!username) {
    console.log("❌ Registration failed: username missing");
    return;
  }
  
  if (ws.readyState !== WebSocket.OPEN) {
     console.log(`❌ WebSocket not open for user ${username}`);
     return;
  }

  const sessionId = crypto.randomUUID();
  const userData = {
    ws,
    lastSeen: new Date().toISOString(),
    sessionId,
  };

  clients.set(username, userData);
  userSockets.set(ws, username);

  console.log(`✅ User ${username} registered with session ${sessionId}`);
  
  // Send "registered" acknowledgement to the user
  ws.send(JSON.stringify({
    type: "registered",
    username: username,
    sessionId: sessionId,
    users: Array.from(clients.keys()), // Send initial online list
  }));

  // Notify all other users about the new user
  broadcastPresenceUpdate(username, "online");
}

wss.on("connection", (ws, req) => {
  console.log("🔗 New client connected from:", req.socket.remoteAddress);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📨 Received:`, data);

      if (data.event && data.channel && data.data) {
        handleLaravelMessage(ws, data);
      } else if (data.type === "register" && data.username) {
        handleUserRegistration(ws, data);
      } else if (data.type === "is_online_request" && data.username) {
        ws.send(JSON.stringify({
          type: "is_online_response",
          username: data.username,
          online: clients.has(data.username),
        }));
      } else {
        console.log(`❌ Unknown message format`);
      }
    } catch (error) {
      console.error("❌ Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    const username = userSockets.get(ws);
    if (username) {
      clients.delete(username);
      userSockets.delete(ws);
      console.log(`👋 User ${username} disconnected.`);
      broadcastPresenceUpdate(username, "offline");
    }
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });

  // Update lastSeen on pong to keep user alive
  ws.on("pong", () => {
    const username = userSockets.get(ws);
    if (username && clients.has(username)) {
      clients.get(username).lastSeen = new Date().toISOString();
      // console.log(`🏓 Pong from ${username}, lastSeen updated.`);
    }
  });
});

// --- Periodic Tasks ---

// Ping clients to check for liveness
setInterval(() => {
  clients.forEach(data => {
    if (data.ws.readyState === WebSocket.OPEN) {
      data.ws.ping();
    }
  });
}, 30000);

// Cleanup stale connections
setInterval(() => {
  const now = Date.now();
  const staleUsers = [];
  
  clients.forEach((data, username) => {
    const lastSeen = new Date(data.lastSeen).getTime();
    // If last seen is more than 65 seconds ago, mark as stale
    if (now - lastSeen > 65000) {
      staleUsers.push(username);
      data.ws.terminate(); // Force close the connection
    }
  });

  if (staleUsers.length > 0) {
    console.log(`🧹 Cleaning up ${staleUsers.length} stale connections: ${staleUsers.join(', ')}`);
  }
}, 35000); // Run slightly offset from ping

// --- Graceful Shutdown ---
function shutdown() {
  console.log('🛑 Shutting down gracefully...');
  wss.close(() => {
    server.close(() => {
      console.log('✅ Server closed.');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
