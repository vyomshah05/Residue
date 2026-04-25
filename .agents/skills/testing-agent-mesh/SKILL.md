# Testing: Residue Agent Mesh & AgentPanel

## Overview
ResIdue uses Fetch.ai uAgents with Chat Protocol for multi-agent communication. The frontend has an AgentPanel component that displays agent addresses, provides a "Chat with Agent on ASI:One" button, and a "Test Agent Pipeline" button that calls ASI1-Mini.

## Devin Secrets Needed
- `ASI1_API_KEY` — Required for the "Test Agent Pipeline" button (calls ASI1-Mini via /api/agents/orchestrate)
- `AGENTVERSE_API_KEY` — Required only if starting Python agents for liveness testing
- `MONGODB_URI` — Required for session persistence features
- `ELEVENLABS_API_KEY` — Required for AI Personalized Bed generation

## How to Start the Dev Server
```bash
cd /home/ubuntu/repos/Residue
# Kill any existing process on port 3000
fuser 3000/tcp 2>/dev/null | xargs kill -9 2>/dev/null
npx next dev -p 3000
```

Note: `lsof` may not be available in the test environment. Use `fuser` instead.

## Key Test Endpoints

### GET /api/agents/status
Returns agent addresses and liveness status. When no Python agents are running:
- All 3 agents show `status: "offline"`
- Addresses are deterministic from seeds (hardcoded defaults)
- Expected fields: `status`, `agents.gateway`, `agents.buddy_user`, `agents.buddy_peer`, `mesh_protocol`, `framework`

### POST /api/agents/orchestrate
The "Test Agent Pipeline" button calls this with test acoustic data. Two response paths:
1. **Python orchestrator running** (port 8765): Returns flat response (`data.cognitive_state`, `data.confidence`)
2. **In-process fallback** (no Python): Calls ASI1-Mini directly, returns nested (`data.perception.cognitive_state`, `data.perception.confidence`)

The AgentPanel handles both shapes via fallback chaining (lines 92-95 of AgentPanel.tsx).

## What to Test

### AgentPanel UI (browser testing)
1. **Renders correctly**: "Agent Network" header with "Fetch.ai" badge, 3 agent address rows with role badges (gateway/user/peer), gray offline dots
2. **Copy address**: Click copy icon next to any agent → checkmark appears for 2s. Note: clipboard API may be restricted in automated environments
3. **Test Agent Pipeline**: Click button → shows "Querying agent..." spinner → after 5-15s shows ASI1-Mini reasoning text + activity feed entry with cognitive state and confidence
4. **Collapse/expand**: Click header to toggle panel content visibility
5. **Chat on ASI:One button**: Opens https://asi1.ai/chat in new tab

### API testing (shell)
```bash
# Status endpoint
curl -s http://localhost:3000/api/agents/status | python3 -m json.tool

# Orchestrate endpoint (requires ASI1_API_KEY in .env)
curl -s -X POST http://localhost:3000/api/agents/orchestrate \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test","user_id":"u1","goal_mode":"focus","acoustic":{"overall_db":48,"frequency_bands":[0.3,0.5,0.6,0.4,0.3,0.2,0.1],"spectral_centroid":1200,"dominant_frequency":400}}' \
  | python3 -m json.tool
```

## Known Environment Limitations
- **Clipboard API**: `navigator.clipboard.readText()` may be blocked by browser security policy in automated test environments. The copy function still fires but verification requires manual testing or explicit permission grants.
- **Microphone**: The dashboard's acoustic analysis requires mic input. Without a mic, the "Acoustic Environment" panel shows "Enable microphone to see frequency analysis".
- **Python agents**: Starting `run_agent_mesh.py` requires all secrets + network access to Agentverse. For UI-only testing, the in-process ASI1-Mini fallback works without Python agents.

## Agent Addresses (Deterministic from Seeds)
- Gateway: `agent1qvuwcewf5lj7p5vpnfdev3ja80f7wmdmwg3sj7y2dqk335cgfjc2vhf4af8` (port 8780)
- Buddy User: `agent1qtgdgv6nj6zd7hkpv4rwrzs8aqem6cyvxqcxvxgsrwfe5qdz96ulyp77sc6` (port 8781)
- Buddy Peer: `agent1qgacmc25lmnv9e9c4c2gt6yd09m4xwmyjg7vy0823mqsgy4c0f6q7ptsl5c` (port 8782)
