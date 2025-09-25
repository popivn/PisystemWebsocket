# 🚀 WebSocket Server với Node.js

Một WebSocket server đơn giản được xây dựng với Node.js và Express, sẵn sàng deploy lên Render free tier.

## ✨ Tính năng

- 🔗 WebSocket server với Express HTTP server
- 📡 Broadcast messages đến tất cả clients
- 🎯 Echo messages về sender
- 💚 Health check endpoints
- 🛡️ Graceful shutdown
- 📊 Client connection tracking

## 🚀 Cài đặt và chạy local

```bash
# Clone repository
git clone <your-repo-url>
cd my-websocket-server

# Cài đặt dependencies
npm install

# Chạy server
npm start
```

Server sẽ chạy tại: `http://localhost:10000`

## 📡 WebSocket Endpoints

- **WebSocket**: `ws://localhost:10000/ws`
- **HTTP Health**: `http://localhost:10000/health`
- **HTTP Root**: `http://localhost:10000/`

## 🎯 Deploy lên Render

### Bước 1: Push code lên GitHub
```bash
git init
git add .
git commit -m "Initial WebSocket server"
git remote add origin <your-github-repo>
git push -u origin main
```

### Bước 2: Deploy trên Render
1. Đăng nhập vào [Render.com](https://render.com)
2. Chọn **New → Web Service**
3. Kết nối với GitHub repository
4. Cấu hình:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Click **Deploy Web Service**

### Bước 3: Kết nối WebSocket
Sau khi deploy thành công, WebSocket sẽ có sẵn tại:
```
wss://your-app-name.onrender.com/ws
```

## 🧪 Test WebSocket

### Test bằng Browser Console
```javascript
const socket = new WebSocket("wss://your-app.onrender.com/ws");

socket.onopen = () => {
  console.log("✅ Connected to WebSocket");
  socket.send(JSON.stringify({
    message: "Hello from browser!"
  }));
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("📨 Message from server:", data);
};

socket.onclose = () => {
  console.log("👋 Connection closed");
};

socket.onerror = (error) => {
  console.error("❌ WebSocket error:", error);
};
```

### Test bằng Node.js client
```javascript
const WebSocket = require('ws');

const socket = new WebSocket("wss://your-app.onrender.com/ws");

socket.on('open', () => {
  console.log("✅ Connected to WebSocket");
  socket.send(JSON.stringify({
    message: "Hello from Node.js!"
  }));
});

socket.on('message', (data) => {
  const message = JSON.parse(data);
  console.log("📨 Message from server:", message);
});
```

## 📋 API Messages

### Server → Client
```json
{
  "type": "welcome",
  "message": "Connected to WebSocket server! 🎉",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "clientCount": 1
}
```

### Client → Server
```json
{
  "message": "Your message here"
}
```

### Server Response
```json
{
  "type": "echo",
  "message": "Echo: Your message here",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🛠️ Development

```bash
# Chạy development mode
npm run dev

# Check logs
npm start
```

## 📝 Environment Variables

- `PORT`: Port cho server (Render sẽ tự động set)

## 🚨 Lưu ý Render Free Tier

- ⏰ 750 giờ/tháng
- 😴 Sleep sau 15 phút không hoạt động
- 🔄 Tự động wake up khi có request
- 📊 Monitor usage tại Render dashboard

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.
