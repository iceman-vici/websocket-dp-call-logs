#!/usr/bin/env node

/**
 * Test webhook endpoint by sending JWT-signed events
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook';
const SECRET = process.env.DIALPAD_WEBHOOK_SECRET || 'dp_call_logs';

const testEvents = {
  'call.created': {
    type: 'call.created',
    timestamp: new Date().toISOString(),
    data: {
      call_id: `test-${Date.now()}`,
      direction: 'inbound',
      from_number: '+1234567890',
      to_number: '+0987654321',
      state: 'ringing',
      started_at: new Date().toISOString()
    }
  },
  'call.ended': {
    type: 'call.ended',
    timestamp: new Date().toISOString(),
    data: {
      call_id: `test-${Date.now()}`,
      direction: 'outbound',
      from_number: '+0987654321',
      to_number: '+1234567890',
      state: 'ended',
      duration: 120,
      disposition: 'answered',
      started_at: new Date(Date.now() - 120000).toISOString(),
      ended_at: new Date().toISOString()
    }
  },
  'sms.inbound': {
    type: 'sms.inbound',
    timestamp: new Date().toISOString(),
    data: {
      message_id: `msg-${Date.now()}`,
      from_number: '+1234567890',
      to_number: '+0987654321',
      text: 'Test SMS message',
      received_at: new Date().toISOString()
    }
  }
};

async function sendWebhook(eventType) {
  const payload = testEvents[eventType];
  
  if (!payload) {
    console.error(`Unknown event type: ${eventType}`);
    console.log(`Available: ${Object.keys(testEvents).join(', ')}`);
    process.exit(1);
  }
  
  // Create JWT token
  const token = jwt.sign(payload, SECRET, { algorithm: 'HS256' });
  
  console.log(`\n📤 Sending ${eventType} to ${WEBHOOK_URL}...`);
  
  try {
    const response = await axios.post(WEBHOOK_URL, token, {
      headers: { 'Content-Type': 'text/plain' }
    });
    
    console.log(`✅ Success!`);
    console.log(`Response:`, response.data);
    console.log(`Broadcasted to ${response.data.broadcasted} WebSocket client(s)\n`);
    
  } catch (error) {
    console.error(`❌ Error:`, error.response?.data || error.message);
    process.exit(1);
  }
}

// Main
const eventType = process.argv[2] || 'call.created';
sendWebhook(eventType);
