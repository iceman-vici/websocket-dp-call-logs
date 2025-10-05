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

**Terminal 1 - Start WebSocket Client:**
```bash
npm test
```

**Terminal 2 - Send Test Webhook:**
```bash
npm run test:webhook call.created
```

**Browser Client:**
Open `client.html` in your browser!

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

**Headers:**
```
Content-Type: text/plain
```

**Body:** JWT token from Dialpad

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
  "clients": [
    {
      "id": "socket-id-123",
      "connectedAt": "2025-10-05T00:00:00.000Z",
      "eventsReceived": 42,
      "uptime": 120
    }
  ]
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Server
NODE_ENV=development          # development | production
PORT=3000                     # Server port

# Dialpad Webhook
DIALPAD_WEBHOOK_SECRET=secret # Must match Dialpad webhook secret

# WebSocket
CORS_ORIGIN=*                 # CORS origin (* for dev, domain for prod)

# Features
DEBUG=true                    # Enable debug logging
RATE_LIMIT_MAX=1200          # Max requests per minute
```

### Dialpad Webhook Setup

1. Go to [Dialpad Developer Portal](https://www.dialpad.com/developers/)
2. Create a new webhook:
   - **URL:** `https://your-domain.com/webhook`
   - **Secret:** Your `DIALPAD_WEBHOOK_SECRET`
   - **Algorithm:** HS256

3. Subscribe to events:
   - ✅ call.created
   - ✅ call.updated
   - ✅ call.ended
   - ✅ sms.inbound
   - ✅ sms.outbound
   - ✅ voicemail.created
   - ✅ contact.created
   - ✅ contact.updated

## 🧪 Testing

### Test WebSocket Client

```bash
# Start client (waits for events)
npm test

# Or with custom server URL
WEBSOCKET_URL=http://localhost:3000 npm test
```

### Test Webhook Endpoint

```bash
# Send test call.created event
npm run test:webhook call.created

# Send test call.ended event
node test-webhook.js call.ended

# Send test SMS event
node test-webhook.js sms.inbound
```

### Browser Client

Open `client.html` in your browser:
1. Enter server URL (default: http://localhost:3000)
2. Click "Connect"
3. Events will appear in real-time!

## 📊 Event Format

All events follow this format:

```javascript
{
  type: 'call.created',  // Event type
  data: {                // Event data from Dialpad
    call_id: '12345',
    direction: 'inbound',
    from_number: '+1234567890',
    to_number: '+0987654321',
    // ... more fields
  },
  timestamp: '2025-10-05T00:00:00.000Z'  // When event was received
}
```

## 🚀 Production Deployment

### Option 1: PM2

```bash
# Install dependencies
npm install --production

# Configure environment
cp .env.production .env
nano .env  # Set your production values

# Install PM2
npm install -g pm2

# Start server
pm2 start server.js --name dialpad-websocket

# Setup auto-restart
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t dialpad-websocket .
docker run -p 3000:3000 --env-file .env.production dialpad-websocket
```

### Nginx Configuration (for WebSocket)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

## 🔒 Security

- ✅ **JWT Verification** - All webhooks verified with HS256
- ✅ **Rate Limiting** - 1200 requests/minute max
- ✅ **CORS** - Configurable origin restrictions
- ✅ **HTTPS** - Use SSL/TLS in production
- ✅ **Secret Management** - Never commit secrets to git

**Security Checklist:**
- [ ] Use HTTPS in production
- [ ] Set strong `DIALPAD_WEBHOOK_SECRET`
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Enable firewall rules
- [ ] Set `DEBUG=false` in production
- [ ] Regular dependency updates

## 📈 Monitoring

### Check Server Health

```bash
curl http://localhost:3000/health
```

### Check Connected Clients

```bash
curl http://localhost:3000/clients
```

### View PM2 Logs

```bash
pm2 logs dialpad-websocket
pm2 monit
```

## 🐛 Troubleshooting

### WebSocket Won't Connect

```bash
# Check if server is running
curl http://localhost:3000/health

# Check firewall
sudo ufw status

# Check CORS settings
# Make sure CORS_ORIGIN includes your client's domain
```

### Webhook Not Working

```bash
# Test webhook locally
npm run test:webhook call.created

# Check logs
pm2 logs dialpad-websocket --err

# Verify secret matches Dialpad
echo $DIALPAD_WEBHOOK_SECRET
```

### Rate Limit Issues

Server handles rate limits gracefully - warnings are batched every 5 seconds.

## 📚 Use Cases

- **Real-time Dashboards** - Live call metrics
- **Call Notifications** - Instant alerts for new calls
- **CRM Integration** - Auto-update customer records
- **Analytics** - Real-time call analytics
- **Call Center Monitoring** - Live agent activity
- **Custom Applications** - Any real-time event handling

## 📦 Project Structure

```
.
├── server.js              # Main WebSocket server
├── test-client.js         # Node.js client example
├── test-webhook.js        # Webhook testing script
├── client.html            # Browser client UI
├── package.json           # Dependencies
├── .env.development       # Dev environment
├── .env.production        # Prod environment
└── README.md              # This file
```

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

## 📄 License

MIT

## 🔗 Links

- **Repository:** https://github.com/iceman-vici/websocket-dp-call-logs
- **Dialpad Docs:** https://developers.dialpad.com/
- **Socket.IO Docs:** https://socket.io/docs/

---

**Ready for real-time Dialpad events! 🎉**
