#!/usr/bin/env node

/**
 * Advanced Test Script with Rate Limiting and Retry
 * 
 * Features:
 * - Tests webhook endpoint with rate limits
 * - Exponential backoff retry on 429 errors
 * - WebSocket client to verify broadcasts
 * - Real-time statistics
 * - Multiple concurrent requests
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
const { io } = require('socket.io-client');
require('dotenv').config();

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook';
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'http://localhost:3000';
const SECRET = process.env.DIALPAD_WEBHOOK_SECRET || 'dp_call_logs';
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 60 seconds

// Statistics
const stats = {
  sent: 0,
  success: 0,
  failed: 0,
  retried: 0,
  rateLimited: 0,
  websocketReceived: 0,
  startTime: null,
  endTime: null
};

// WebSocket client for verification
let wsClient = null;
const receivedEvents = new Set();

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(attempt, retryAfter = null) {
  if (retryAfter) {
    return retryAfter * 1000;
  }
  
  const delay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, attempt),
    MAX_RETRY_DELAY
  );
  
  const jitter = Math.random() * 1000;
  return delay + jitter;
}

/**
 * Generate test event
 */
function generateTestEvent(index) {
  const eventTypes = ['call.created', 'call.ended', 'sms.inbound', 'voicemail.created'];
  const type = eventTypes[index % eventTypes.length];
  
  return {
    type,
    timestamp: new Date().toISOString(),
    data: {
      id: `test-${Date.now()}-${index}`,
      call_id: `test-${Date.now()}-${index}`,
      direction: index % 2 === 0 ? 'inbound' : 'outbound',
      from_number: `+123456${String(index).padStart(4, '0')}`,
      to_number: `+098765${String(index).padStart(4, '0')}`,
      duration: Math.floor(Math.random() * 300),
      state: type === 'call.ended' ? 'ended' : 'active'
    }
  };
}

/**
 * Send webhook with retry logic
 */
async function sendWebhookWithRetry(event, index, attempt = 0) {
  try {
    const token = jwt.sign(event, SECRET, { algorithm: 'HS256' });
    
    const startTime = Date.now();
    const response = await axios.post(WEBHOOK_URL, token, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 10000
    });
    
    const duration = Date.now() - startTime;
    
    stats.success++;
    
    return {
      success: true,
      attempt: attempt + 1,
      duration,
      broadcasted: response.data.broadcasted,
      eventId: event.data.id
    };
    
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const retryAfter = error.response.data?.retryAfter || 
                        error.response.headers['retry-after'];
      
      if (status === 429) {
        stats.rateLimited++;
        
        if (attempt < MAX_RETRIES) {
          stats.retried++;
          const delay = calculateRetryDelay(attempt, retryAfter);
          
          if (attempt === 0) {
            console.log(`⚠️  [${index}] Rate limited! Retrying in ${(delay/1000).toFixed(1)}s...`);
          }
          
          await sleep(delay);
          return sendWebhookWithRetry(event, index, attempt + 1);
        } else {
          stats.failed++;
          return {
            success: false,
            error: 'Max retries exceeded',
            attempts: attempt + 1
          };
        }
      } else {
        stats.failed++;
        return {
          success: false,
          error: `HTTP ${status}`,
          status,
          attempts: attempt + 1
        };
      }
    } else {
      stats.failed++;
      return {
        success: false,
        error: error.message,
        attempts: attempt + 1
      };
    }
  }
}

/**
 * Setup WebSocket client
 */
function setupWebSocketClient() {
  return new Promise((resolve, reject) => {
    console.log('🔌 Connecting WebSocket client for verification...');
    
    wsClient = io(WEBSOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: false
    });
    
    wsClient.on('connect', () => {
      console.log(`✅ WebSocket connected: ${wsClient.id}\n`);
      resolve();
    });
    
    wsClient.on('dialpad:event', (event) => {
      receivedEvents.add(event.data.id);
      stats.websocketReceived++;
    });
    
    wsClient.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      reject(error);
    });
  });
}

/**
 * Load test
 */
async function loadTest(totalRequests = 100, concurrentRequests = 10) {
  console.log('🚀 Starting Load Test with Rate Limit & Retry\n');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`WebSocket URL: ${WEBSOCKET_URL}`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Concurrent requests: ${concurrentRequests}`);
  console.log(`Max retries per request: ${MAX_RETRIES}`);
  console.log('='.repeat(70));
  
  // Connect WebSocket client first
  try {
    await setupWebSocketClient();
  } catch (error) {
    console.error('Failed to connect WebSocket client. Continuing without verification...\n');
  }
  
  stats.startTime = Date.now();
  const results = [];
  
  // Send requests in batches
  for (let i = 0; i < totalRequests; i += concurrentRequests) {
    const batch = [];
    const batchSize = Math.min(concurrentRequests, totalRequests - i);
    
    for (let j = 0; j < batchSize; j++) {
      const index = i + j;
      stats.sent++;
      
      const event = generateTestEvent(index);
      batch.push(sendWebhookWithRetry(event, index));
    }
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    const completed = i + batchSize;
    const progress = ((completed / totalRequests) * 100).toFixed(1);
    const successful = results.filter(r => r.success).length;
    
    process.stdout.write(`\r📊 Progress: ${completed}/${totalRequests} (${progress}%) | ✅ ${successful} | ❌ ${stats.failed} | ⚠️  ${stats.rateLimited} rate limited`);
    
    // Small delay between batches to avoid overwhelming the server
    if (i + concurrentRequests < totalRequests) {
      await sleep(100);
    }
  }
  
  stats.endTime = Date.now();
  
  // Wait a bit for WebSocket events to arrive
  console.log('\n\n⏳ Waiting for WebSocket events...');
  await sleep(2000);
  
  // Print results
  printResults(results);
  
  // Cleanup
  if (wsClient) {
    wsClient.disconnect();
  }
}

/**
 * Stress test - send requests as fast as possible to trigger rate limits
 */
async function stressTest(totalRequests = 1500, concurrentRequests = 50) {
  console.log('🔥 Starting Stress Test - Maximum Rate\n');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Concurrent requests: ${concurrentRequests}`);
  console.log(`⚠️  This WILL trigger rate limits - testing retry logic`);
  console.log('='.repeat(70));
  
  // Connect WebSocket client
  try {
    await setupWebSocketClient();
  } catch (error) {
    console.error('Failed to connect WebSocket client\n');
  }
  
  stats.startTime = Date.now();
  const results = [];
  
  // Send all requests at once
  const promises = [];
  for (let i = 0; i < totalRequests; i++) {
    stats.sent++;
    const event = generateTestEvent(i);
    promises.push(sendWebhookWithRetry(event, i));
    
    // Add minimal delay every concurrentRequests to avoid completely overwhelming
    if ((i + 1) % concurrentRequests === 0) {
      await Promise.all(promises.splice(0, promises.length));
      
      const progress = ((i + 1) / totalRequests * 100).toFixed(1);
      process.stdout.write(`\r📊 Progress: ${i + 1}/${totalRequests} (${progress}%) | Rate limited: ${stats.rateLimited} | Retries: ${stats.retried}`);
    }
  }
  
  // Wait for remaining promises
  if (promises.length > 0) {
    await Promise.all(promises);
  }
  
  stats.endTime = Date.now();
  
  console.log('\n\n⏳ Waiting for WebSocket events...');
  await sleep(3000);
  
  printResults(results);
  
  if (wsClient) {
    wsClient.disconnect();
  }
}

/**
 * Print test results
 */
function printResults(results) {
  const duration = (stats.endTime - stats.startTime) / 1000;
  const throughput = stats.sent / duration;
  
  const successResults = results.filter(r => r.success);
  const avgDuration = successResults.length > 0
    ? successResults.reduce((sum, r) => sum + r.duration, 0) / successResults.length
    : 0;
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST RESULTS\n');
  
  console.log('Request Statistics:');
  console.log(`  Total sent:        ${stats.sent}`);
  console.log(`  ✅ Successful:     ${stats.success} (${(stats.success/stats.sent*100).toFixed(1)}%)`);
  console.log(`  ❌ Failed:         ${stats.failed} (${(stats.failed/stats.sent*100).toFixed(1)}%)`);
  console.log(`  ⚠️  Rate limited:  ${stats.rateLimited}`);
  console.log(`  🔄 Retry attempts: ${stats.retried}`);
  
  console.log('\nWebSocket Verification:');
  console.log(`  Events received:   ${stats.websocketReceived}`);
  console.log(`  Unique events:     ${receivedEvents.size}`);
  console.log(`  Match rate:        ${(stats.websocketReceived/stats.success*100).toFixed(1)}%`);
  
  console.log('\nPerformance:');
  console.log(`  Total time:        ${duration.toFixed(2)}s`);
  console.log(`  Throughput:        ${throughput.toFixed(2)} req/s`);
  console.log(`  Avg response:      ${avgDuration.toFixed(0)}ms`);
  
  console.log('\nRetry Statistics:');
  const retriedResults = results.filter(r => r.attempt > 1);
  if (retriedResults.length > 0) {
    const avgAttempts = retriedResults.reduce((sum, r) => sum + r.attempt, 0) / retriedResults.length;
    console.log(`  Requests retried:  ${retriedResults.length}`);
    console.log(`  Avg attempts:      ${avgAttempts.toFixed(1)}`);
    console.log(`  Max attempts:      ${Math.max(...retriedResults.map(r => r.attempt))}`);
  } else {
    console.log(`  No retries needed!`);
  }
  
  console.log('='.repeat(70));
  
  // Summary
  if (stats.success === stats.sent) {
    console.log('\n🎉 Perfect! All requests succeeded!');
  } else if (stats.success / stats.sent > 0.95) {
    console.log('\n✅ Excellent! >95% success rate!');
  } else if (stats.success / stats.sent > 0.90) {
    console.log('\n👍 Good! >90% success rate');
  } else {
    console.log('\n⚠️  Some requests failed. Check server logs for details.');
  }
}

/**
 * Simple test - just a few requests
 */
async function simpleTest() {
  console.log('🧪 Simple Test - 10 Requests\n');
  await loadTest(10, 3);
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === 'stress') {
      const count = parseInt(args[1]) || 1500;
      const concurrent = parseInt(args[2]) || 50;
      await stressTest(count, concurrent);
    } else if (command === 'load') {
      const count = parseInt(args[1]) || 100;
      const concurrent = parseInt(args[2]) || 10;
      await loadTest(count, concurrent);
    } else if (command === 'simple') {
      await simpleTest();
    } else {
      console.log('Usage:');
      console.log('  node test-rate-limit-retry.js simple                    - Simple test (10 requests)');
      console.log('  node test-rate-limit-retry.js load [count] [concurrent] - Load test (default: 100, 10)');
      console.log('  node test-rate-limit-retry.js stress [count] [concurrent] - Stress test (default: 1500, 50)');
      console.log('\nExamples:');
      console.log('  node test-rate-limit-retry.js simple');
      console.log('  node test-rate-limit-retry.js load 200 20');
      console.log('  node test-rate-limit-retry.js stress 2000 100');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
