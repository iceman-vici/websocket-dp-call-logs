#!/usr/bin/env node

/**
 * WebSocket Client Test
 * Connects to the WebSocket server and listens for Dialpad events
 */

const { io } = require('socket.io-client');
require('dotenv').config();

// Configuration
const SERVER_URL = process.env.WEBSOCKET_URL || 'http://localhost:3000';
const DEBUG = process.env.DEBUG === 'true';

console.log('🔌 Connecting to WebSocket server...');
console.log(`Server: ${SERVER_URL}\n`);

// Create Socket.IO client
const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Connection event
socket.on('connect', () => {
  console.log('✅ Connected to server!');
  console.log(`Socket ID: ${socket.id}`);
  console.log(`Transport: ${socket.io.engine.transport.name}\n`);
  
  // Subscribe to specific event types (optional)
  const eventTypes = ['call.created', 'call.ended', 'sms.inbound'];
  socket.emit('subscribe', eventTypes);
});

// Welcome message
socket.on('connected', (data) => {
  console.log('📨 Server welcome message:');
  console.log(JSON.stringify(data, null, 2));
  console.log();
});

// Subscription confirmation
socket.on('subscribed', (data) => {
  console.log('📡 Subscribed to events:');
  console.log(data.eventTypes.join(', '));
  console.log('\n⏳ Waiting for Dialpad events...\n');
});

// Generic event listener - receives ALL events
socket.on('dialpad:event', (event) => {
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📞 DIALPAD EVENT RECEIVED [${timestamp}]`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Type: ${event.type}`);
  
  if (DEBUG) {
    console.log(`\nFull Event Data:`);
    console.log(JSON.stringify(event, null, 2));
  } else {
    console.log(`\nEvent Summary:`);
    const data = event.data;
    
    // Display relevant info based on event type
    if (event.type.startsWith('call.')) {
      console.log(`  Call ID: ${data.call_id || data.id}`);
      console.log(`  Direction: ${data.direction}`);
      console.log(`  From: ${data.from_number}`);
      console.log(`  To: ${data.to_number}`);
      if (data.duration) console.log(`  Duration: ${data.duration}s`);
      if (data.state) console.log(`  State: ${data.state}`);
    } else if (event.type.startsWith('sms.')) {
      console.log(`  Message ID: ${data.message_id || data.id}`);
      console.log(`  From: ${data.from_number}`);
      console.log(`  To: ${data.to_number}`);
      console.log(`  Text: ${data.text}`);
    } else if (event.type === 'voicemail.created') {
      console.log(`  Voicemail ID: ${data.voicemail_id || data.id}`);
      console.log(`  From: ${data.from_number}`);
      console.log(`  Duration: ${data.duration}s`);
      if (data.transcription) console.log(`  Transcription: ${data.transcription}`);
    }
  }
  console.log(`${'='.repeat(60)}\n`);
});

// Specific event listeners (for subscribed events)
socket.on('call.created', (event) => {
  console.log('📞 New call started!');
});

socket.on('call.ended', (event) => {
  console.log('📞 Call ended!');
});

socket.on('sms.inbound', (event) => {
  console.log('💬 New SMS received!');
});

// Pong response
socket.on('pong', (data) => {
  if (DEBUG) {
    console.log('🏓 Pong received:', data);
  }
});

// Server shutdown notification
socket.on('server:shutdown', (data) => {
  console.log('\n⚠️  Server is shutting down');
  console.log(data.message);
  console.log('Will attempt to reconnect...\n');
});

// Connection error
socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Reconnection attempt
socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
});

// Reconnected
socket.on('reconnect', (attemptNumber) => {
  console.log(`✅ Reconnected after ${attemptNumber} attempt(s)!`);
});

// Failed to reconnect
socket.on('reconnect_failed', () => {
  console.error('❌ Failed to reconnect after maximum attempts');
  process.exit(1);
});

// Disconnection
socket.on('disconnect', (reason) => {
  console.log(`\n🔌 Disconnected: ${reason}`);
  if (reason === 'io server disconnect') {
    // Server initiated disconnect, try to reconnect
    socket.connect();
  }
});

// Send periodic ping to keep connection alive
const pingInterval = setInterval(() => {
  if (socket.connected) {
    socket.emit('ping');
  }
}, 30000); // Every 30 seconds

// Graceful shutdown
const shutdown = () => {
  console.log('\n👋 Disconnecting...');
  clearInterval(pingInterval);
  socket.disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Keep the process running
console.log('Press Ctrl+C to disconnect and exit\n');
