# Dialpad WebSocket Server - Real-Time Call Logs

🎉 **Real-time Dialpad events via WebSocket!** This server receives webhooks from Dialpad and broadcasts them to connected WebSocket clients in real-time.

## 🏗️ Architecture

```
Dialpad → HTTP Webhook → Server → WebSocket → Your Application
                         (JWT)              (Socket.IO)
```

**How it works:**
1. Dialpad sends webhook events to your server via HTTP POST with JWT signature
2. Server verifies the JWT signature (HS256)
3. Server broadcasts the event to all connected WebSocket clients
4. Your applications receive events in real-time via WebSocket

## ✨ Features

- ✅ **WebSocket Broadcasting** - Real-time event distribution using Socket.IO
- ✅ **JWT Verification** - Secure webhook authentication (HS256)
- ✅ **Rate Limiting** - Protects against abuse (1200 req/min)
- ✅ **Automatic Retry** - Exponential backoff on rate limits
- ✅ **Event Subscriptions** - Clients can subscribe to specific event types
- ✅ **Connection Tracking** - Monitor connected clients
- ✅ **Auto-Reconnection** - Clients automatically reconnect
- ✅ **CORS Support** - Configurable cross-origin access
- ✅ **Browser & Node.js Clients** - Examples included
- ✅ **Production Ready** - Crash-resistant and well-tested

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/iceman-vici/websocket-dp-call-logs.git
cd websocket-dp-call-logs
npm install
```

### 2. Configure Environment

```bash
# Copy development environment
cp .env.development .env

# Edit and set your webhook secret
nano .env
```

### 3. Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will start on port 3000 (configurable).

### 4. Test It!

**Quick verification:**
```bash
npm run test:simple
```

**Load test with retry:**
```bash
npm run test:load
```

**Stress test (triggers rate limits):**
```bash
npm run test:stress
```

📖 **Full testing guide:** [TESTING.md](TESTING.md)

## 🧪 Testing Features

### Built-in Test Scripts

| Command | Requests | Purpose |
|---------|----------|---------|
| `npm run test:simple` | 10 | Quick verification |
| `npm run test:load` | 100 | Normal load with retry |
| `npm run test:load-500` | 500 | Heavy load test |
| `npm run test:stress` | 1500 | Stress test (triggers rate limits) |
| `npm run test:stress-2000` | 2000 | Extreme stress test |

**Features tested:**
- ✅ Rate limit handling
- ✅ Exponential backoff retry (1s → 2s → 4s → 8s → 16s)
- ✅ WebSocket broadcast verification
- ✅ Server stability under load
- ✅ Concurrent request handling
- ✅ Recovery after rate limits

**Example output:**
```
🚀 Starting Load Test with Rate Limit & Retry
📊 Progress: 100/100 (100.0%) | ✅ 98 | ❌ 2 | ⚠️  15 rate limited

📊 TEST RESULTS
Request Statistics:
  ✅ Successful:     98 (98.0%)
  ❌ Failed:         2 (2.0%)
  ⚠️  Rate limited:  15
  🔄 Retry attempts: 13
  
WebSocket Verification:
  Events received:   98
  Match rate:        100.0%
  
Performance:
  Throughput:        8.10 req/s
  Avg response:      45ms
```

See [TESTING.md](TESTING.md) for detailed testing guide.

## 📡 WebSocket Client Examples

### Node.js Client

```javascript
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected!', socket.id);
  
  // Subscribe to specific events (optional)
  socket.emit('subscribe', ['call.created', 'call.ended']);
});

// Listen for all Dialpad events
socket.on('dialpad:event', (event) => {
  console.log('Event received:', event.type);
  console.log('Data:', event.data);
});

// Or listen to specific event types
socket.on('call.created', (event) => {
  console.log('New call!', event.data);
});
```

### Browser Client (JavaScript)

```html
<script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
<script>
  const socket = io('http://localhost:3000');
  
  socket.on('connect', () => {
    console.log('Connected!');
  });
  
  socket.on('dialpad:event', (event) => {
    console.log('Event:', event);
    // Update your UI here
  });
</script>
```

### Python Client

```python
import socketio

sio = socketio.Client()

@sio.event
def connect():
    print('Connected!')
    sio.emit('subscribe', ['call.created', 'call.ended'])

@sio.on('dialpad:event')
def on_event(data):
    print('Event:', data['type'])
    print('Data:', data['data'])

sio.connect('http://localhost:3000')
sio.wait()
```

## 🎯 API Endpoints

### WebSocket

**Endpoint:** `ws://localhost:3000`

**Events to listen:**
- `connect` - Connection established
- `connected` - Welcome message from server
- `subscribed` - Subscription confirmation
- `dialpad:event` - All Dialpad events
- `call.created`, `call.updated`, `call.ended` - Call events
- `sms.inbound`, `sms.outbound` - SMS events
- `voicemail.created` - Voicemail events
- `server:shutdown` - Server shutting down
- `disconnect` - Disconnected from server

**Events to emit:**
- `subscribe` - Subscribe to specific event types
- `ping` - Health check

### HTTP Endpoints

#### POST `/webhook`
Receives webhooks from Dialpad (JWT-signed).

**Response:**
```json
{
  "success": true,
  "broadcasted": 5,
  "received": "2025-10-05T00:00:00.000Z"
}
```

#### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "environment": "development",
  "uptime": 3600.5,
  "websocket": {
    "connectedClients": 5,
    "transport": "socket.io"
  },
  "rateLimit": {
    "max": 1200,
    "windowMs": 60000
  }
}
```

#### GET `/clients`
Get connected WebSocket clients info.

**Response:**
```json
{
  "total": 5,
  "clients": [...]
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3000

# Dialpad Webhook
DIALPAD_WEBHOOK_SECRET=secret

# WebSocket
CORS_ORIGIN=*

# Features
DEBUG=true
RATE_LIMIT_MAX=1200
```

### Dialpad Webhook Setup

1. Go to [Dialpad Developer Portal](https://www.dialpad.com/developers/)
2. Create webhook: `https://your-domain.com/webhook`
3. Secret: Your `DIALPAD_WEBHOOK_SECRET`
4. Algorithm: HS256
5. Subscribe to events

## 📊 Event Format

```javascript
{
  type: 'call.created',
  data: {
    call_id: '12345',
    direction: 'inbound',
    from_number: '+1234567890',
    to_number: '+0987654321',
    // ... more fields
  },
  timestamp: '2025-10-05T00:00:00.000Z'
}
```

## 🚀 Production Deployment

### PM2

```bash
npm install -g pm2
pm2 start server.js --name dialpad-websocket
pm2 startup
pm2 save
```

### Nginx (WebSocket Support)

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    
    # WebSocket support
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Timeouts
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

## 🔒 Security

- ✅ **JWT Verification** - HS256 only
- ✅ **Rate Limiting** - 1200 req/min
- ✅ **CORS** - Configurable
- ✅ **HTTPS** - Production ready
- ✅ **Auto-retry** - Handles failures

## 📈 Monitoring

```bash
# Health check
curl http://localhost:3000/health

# Connected clients
curl http://localhost:3000/clients

# PM2 monitoring
pm2 monit
pm2 logs dialpad-websocket
```

## 📚 Use Cases

- **Real-time Dashboards** - Live call metrics
- **Call Notifications** - Instant alerts
- **CRM Integration** - Auto-update records
- **Analytics** - Real-time insights
- **Call Center** - Live monitoring
- **Custom Apps** - Event-driven workflows

## 📦 Project Structure

```
.
├── server.js                    # Main WebSocket server
├── test-client.js               # Node.js client
├── test-webhook.js              # Webhook test
├── test-rate-limit-retry.js     # Load/stress testing
├── client.html                  # Browser client UI
├── package.json                 # Dependencies
├── TESTING.md                   # Testing guide
└── README.md                    # This file
```

## 📖 Documentation

- **[TESTING.md](TESTING.md)** - Comprehensive testing guide
- **[Dialpad Docs](https://developers.dialpad.com/)** - Dialpad API
- **[Socket.IO Docs](https://socket.io/docs/)** - WebSocket library

## 🤝 Contributing

Pull requests welcome! Open an issue for major changes.

## 📄 License

MIT

## 🔗 Links

- **Repository:** https://github.com/iceman-vici/websocket-dp-call-logs
- **Webhook Version:** https://github.com/iceman-vici/webhook-dp-call-logs

---

**Ready for real-time Dialpad events! 🎉**

Start with `npm run test:simple` to verify everything works!
