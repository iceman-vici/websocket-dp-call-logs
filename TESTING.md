# Testing Guide - Rate Limit & Retry

Complete guide for testing the WebSocket server with rate limiting and automatic retry logic.

## 🧪 Available Tests

### 1. Simple Test (Quick Verification)
**10 requests with 3 concurrent** - Perfect for quick testing

```bash
npm run test:simple
```

**What it tests:**
- Server is running and responding
- WebSocket broadcasting works
- Basic retry logic
- Connection stability

**Expected output:**
```
🧪 Simple Test - 10 Requests
✅ WebSocket connected: abc123
📊 Progress: 10/10 (100.0%) | ✅ 10 | ❌ 0 | ⚠️  0 rate limited

📊 TEST RESULTS
Request Statistics:
  Total sent:        10
  ✅ Successful:     10 (100.0%)
  ❌ Failed:         0 (0.0%)
  Events received:   10
  Match rate:        100.0%
```

---

### 2. Load Test (Realistic Traffic)
**100 requests with 10 concurrent** - Simulates normal high traffic

```bash
npm run test:load
```

**Custom load tests:**
```bash
# 500 requests, 20 concurrent
npm run test:load-500

# Custom
node test-rate-limit-retry.js load 200 15
```

**What it tests:**
- Server handles concurrent requests
- Rate limiting works correctly
- Retry logic on rate limit (429)
- WebSocket broadcasts all events
- Performance metrics

**Expected output:**
```
🚀 Starting Load Test with Rate Limit & Retry

Webhook URL: http://localhost:3000/webhook
Total requests: 100
Concurrent requests: 10
📊 Progress: 100/100 (100.0%) | ✅ 98 | ❌ 2 | ⚠️  15 rate limited

📊 TEST RESULTS
Request Statistics:
  Total sent:        100
  ✅ Successful:     98 (98.0%)
  ❌ Failed:         2 (2.0%)
  ⚠️  Rate limited:  15
  🔄 Retry attempts: 13

WebSocket Verification:
  Events received:   98
  Match rate:        100.0%

Performance:
  Total time:        12.34s
  Throughput:        8.10 req/s
  Avg response:      45ms

Retry Statistics:
  Requests retried:  13
  Avg attempts:      2.1
  Max attempts:      4
```

---

### 3. Stress Test (Maximum Load)
**1500+ requests with 50+ concurrent** - Deliberately triggers rate limits

```bash
npm run test:stress
```

**Custom stress tests:**
```bash
# 2000 requests, 100 concurrent
npm run test:stress-2000

# Custom
node test-rate-limit-retry.js stress 3000 150
```

**What it tests:**
- Server stability under extreme load
- Rate limit enforcement
- Exponential backoff retry
- Server doesn't crash
- Recovery after rate limits

**Expected output:**
```
🔥 Starting Stress Test - Maximum Rate

Total requests: 1500
Concurrent requests: 50
⚠️  This WILL trigger rate limits - testing retry logic

📊 Progress: 1500/1500 (100%) | Rate limited: 842 | Retries: 1205

📊 TEST RESULTS
Request Statistics:
  Total sent:        1500
  ✅ Successful:     1485 (99.0%)
  ❌ Failed:         15 (1.0%)
  ⚠️  Rate limited:  842
  🔄 Retry attempts: 1205

WebSocket Verification:
  Events received:   1485
  Unique events:     1485
  Match rate:        100.0%

Performance:
  Total time:        95.67s
  Throughput:        15.68 req/s
  Avg response:      52ms

Retry Statistics:
  Requests retried:  785
  Avg attempts:      2.8
  Max attempts:      5
```

---

## 🎯 Quick Test Commands

| Command | Requests | Concurrent | Purpose |
|---------|----------|------------|---------|
| `npm run test:simple` | 10 | 3 | Quick verification |
| `npm run test:load` | 100 | 10 | Normal load test |
| `npm run test:load-100` | 100 | 10 | Same as above |
| `npm run test:load-500` | 500 | 20 | Heavy load test |
| `npm run test:stress` | 1500 | 50 | Stress test |
| `npm run test:stress-2000` | 2000 | 100 | Extreme stress |

---

## 📊 Understanding the Results

### Success Metrics

**100% Success Rate**
```
✅ Successful:     100 (100.0%)
🎉 Perfect! All requests succeeded!
```
- No rate limits hit OR
- All rate-limited requests successfully retried

**95-99% Success Rate**
```
✅ Successful:     98 (98.0%)
✅ Excellent! >95% success rate!
```
- Some rate limits hit
- Most retries succeeded
- A few requests failed after max retries
- **This is expected under heavy load**

**90-95% Success Rate**
```
✅ Successful:     92 (92.0%)
👍 Good! >90% success rate
```
- Significant rate limiting
- Retry logic working
- Some requests exceeded max retries
- **Normal for stress tests**

### Key Metrics Explained

**Rate Limited Count**
```
⚠️  Rate limited:  842
```
- Number of times rate limit (429) was hit
- Higher in stress tests (expected)
- Server is protecting itself correctly

**Retry Attempts**
```
🔄 Retry attempts: 1205
```
- Total number of retry operations
- Can be higher than rate limited count (multiple retries per request)
- Shows retry logic is working

**WebSocket Match Rate**
```
WebSocket Verification:
  Events received:   98
  Match rate:        100.0%
```
- Should be 100% or close
- Verifies all successful webhooks were broadcast
- Lower rate may indicate WebSocket issues

**Throughput**
```
Performance:
  Throughput:        15.68 req/s
```
- Requests processed per second
- Lower during rate limiting (expected)
- Higher = better performance

---

## 🔍 What Each Test Verifies

### Simple Test ✓
- [x] Server is running
- [x] Webhook endpoint works
- [x] JWT verification works
- [x] WebSocket broadcasting works
- [x] Basic functionality

### Load Test ✓
- [x] Concurrent request handling
- [x] Rate limit detection
- [x] Retry logic activates
- [x] All events broadcast via WebSocket
- [x] Performance under normal load

### Stress Test ✓
- [x] Server stability under extreme load
- [x] Rate limiting enforcement
- [x] Exponential backoff works
- [x] Server doesn't crash
- [x] Recovery after rate limits
- [x] Max retry limit works

---

## 🚀 Testing Workflow

### Step 1: Start the Server

**Terminal 1:**
```bash
npm run dev
```

Wait for:
```
🚀 Dialpad WebSocket Server
📡 WebSocket endpoint: ws://localhost:3000
📥 Webhook endpoint: http://localhost:3000/webhook
```

### Step 2: Run Tests

**Terminal 2:**

**Quick check:**
```bash
npm run test:simple
```

**Normal load:**
```bash
npm run test:load
```

**Stress test:**
```bash
npm run test:stress
```

### Step 3: Verify Results

Check for:
- ✅ Success rate > 90%
- ✅ WebSocket match rate ~100%
- ✅ Server still running (check Terminal 1)
- ✅ No errors in server logs

---

## 🐛 Troubleshooting

### Server Not Responding

```bash
# Check health
curl http://localhost:3000/health

# Restart server
npm run dev
```

### Low Success Rate (<90%)

**Possible causes:**
1. Server overloaded - reduce concurrent requests
2. Rate limit too low - check `RATE_LIMIT_MAX` in `.env`
3. Network issues - check connectivity

**Solutions:**
```bash
# Increase rate limit in .env
RATE_LIMIT_MAX=2400

# Reduce concurrent requests
node test-rate-limit-retry.js load 100 5
```

### WebSocket Match Rate Low

**Possible causes:**
1. WebSocket client disconnected during test
2. Server WebSocket issues
3. Events arriving after verification check

**Solutions:**
```bash
# Check server WebSocket status
curl http://localhost:3000/clients

# Increase wait time (edit test script)
# Change: await sleep(2000);
# To:     await sleep(5000);
```

### All Requests Failing

```bash
# Check server is running
curl http://localhost:3000/health

# Check webhook secret matches
echo $DIALPAD_WEBHOOK_SECRET

# Check server logs
# Look for JWT errors or other issues
```

---

## 📈 Expected Behavior

### Rate Limit Triggers

**At 1200 requests/minute:**
- Simple test (10 req): ❌ No rate limits
- Load test (100 req): ⚠️  Possible rate limits
- Stress test (1500 req): ✅ Guaranteed rate limits

### Retry Behavior

**First rate limit (429):**
```
⚠️  [42] Rate limited! Retrying in 1.3s...
```
- Waits ~1 second
- Retries request

**Second rate limit:**
```
⚠️  [42] Rate limited! Retrying in 2.7s...
```
- Waits ~2 seconds (exponential backoff)
- Retries request

**Pattern continues:** 1s → 2s → 4s → 8s → 16s (max 60s)

---

## ✅ Test Checklist

Before deploying to production:

- [ ] Simple test passes (100% success)
- [ ] Load test passes (>95% success)
- [ ] Stress test passes (>90% success)
- [ ] WebSocket match rate >95%
- [ ] Server doesn't crash during stress test
- [ ] Retry logic activates correctly
- [ ] Rate limiting works as expected
- [ ] No memory leaks (run stress test multiple times)

---

## 🎓 Advanced Testing

### Custom Test Scenarios

**Test specific rate limit:**
```bash
# Set rate limit to 600/min in .env
RATE_LIMIT_MAX=600

# Send 800 requests
node test-rate-limit-retry.js load 800 20
```

**Test retry logic:**
```bash
# Send requests faster than rate limit
node test-rate-limit-retry.js stress 2000 200
```

**Test WebSocket only:**
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Connect WebSocket client
npm test

# Terminal 3: Send single webhook
npm run test:webhook call.created
```

### Monitor Server During Tests

**Terminal 1: Server**
```bash
npm run dev
```

**Terminal 2: Monitor clients**
```bash
watch -n 1 'curl -s http://localhost:3000/clients | jq'
```

**Terminal 3: Run test**
```bash
npm run test:stress
```

---

## 📚 Additional Resources

- **Server Code:** `server.js`
- **Test Script:** `test-rate-limit-retry.js`
- **WebSocket Client:** `test-client.js`
- **Simple Webhook Test:** `test-webhook.js`

---

**Ready to test! 🚀**

Start with `npm run test:simple` and work your way up to stress testing!
