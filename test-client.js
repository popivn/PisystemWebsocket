// test-client.js - Node.js WebSocket test client
const WebSocket = require('ws');
const readline = require('readline');

// Tạo interface để nhập input từ console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// WebSocket URL (có thể thay đổi)
const WS_URL = process.env.WS_URL || 'ws://localhost:3000/ws';

console.log('🚀 WebSocket Test Client');
console.log(`📡 Connecting to: ${WS_URL}`);
console.log('💡 Type "exit" to quit, "help" for commands\n');

let socket = null;
let isConnected = false;

function connect() {
  try {
    socket = new WebSocket(WS_URL);
    
    socket.on('open', () => {
      console.log('✅ Connected to WebSocket server!');
      isConnected = true;
      showPrompt();
    });
    
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('\n📨 Message from server:');
        console.log(`   Type: ${message.type}`);
        console.log(`   Message: ${message.message}`);
        if (message.timestamp) {
          console.log(`   Time: ${new Date(message.timestamp).toLocaleString()}`);
        }
        if (message.clientCount) {
          console.log(`   Clients: ${message.clientCount}`);
        }
        showPrompt();
      } catch (error) {
        console.log('\n📨 Raw message:', data.toString());
        showPrompt();
      }
    });
    
    socket.on('close', () => {
      console.log('\n👋 Connection closed');
      isConnected = false;
      showPrompt();
    });
    
    socket.on('error', (error) => {
      console.error('\n❌ WebSocket error:', error.message);
      isConnected = false;
      showPrompt();
    });
    
  } catch (error) {
    console.error('❌ Error creating WebSocket:', error.message);
    showPrompt();
  }
}

function sendMessage(message) {
  if (!isConnected) {
    console.log('❌ Not connected to WebSocket server');
    return;
  }
  
  try {
    const data = {
      message: message
    };
    
    socket.send(JSON.stringify(data));
    console.log(`📤 Sent: ${message}`);
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
  }
}

function showPrompt() {
  rl.question('💬 Enter message (or "help" for commands): ', (input) => {
    const command = input.trim().toLowerCase();
    
    switch (command) {
      case 'exit':
      case 'quit':
        console.log('👋 Goodbye!');
        if (socket) {
          socket.close();
        }
        rl.close();
        process.exit(0);
        break;
        
      case 'help':
        console.log('\n📋 Available commands:');
        console.log('   help     - Show this help');
        console.log('   test     - Send test message');
        console.log('   ping     - Send ping message');
        console.log('   status   - Show connection status');
        console.log('   connect  - Reconnect to server');
        console.log('   exit     - Exit the program');
        console.log('');
        showPrompt();
        break;
        
      case 'test':
        sendMessage('Hello from Node.js test client! 🧪');
        showPrompt();
        break;
        
      case 'ping':
        sendMessage('ping');
        showPrompt();
        break;
        
      case 'status':
        console.log(`📊 Connection status: ${isConnected ? '✅ Connected' : '❌ Disconnected'}`);
        showPrompt();
        break;
        
      case 'connect':
        if (isConnected) {
          console.log('Already connected!');
        } else {
          connect();
        }
        break;
        
      case '':
        showPrompt();
        break;
        
      default:
        sendMessage(input);
        showPrompt();
        break;
    }
  });
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  if (socket) {
    socket.close();
  }
  rl.close();
  process.exit(0);
});

// Start connection
connect();
