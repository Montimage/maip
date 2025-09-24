// Common helpers for flow-based XAI (LIME/SHAP)
// NOTE: These utilities are designed to work with existing class components.

export function getFlowParams() {
  const params = new URLSearchParams(window.location.search);
  const sampleId = params.get('sampleId');
  const predictionId = params.get('predictionId');
  return {
    isFlowBased: !!predictionId,
    predictionId,
    sampleId,
  };
}

// Post a flow-based XAI request and start polling until finished.
// Returns the polling intervalId so callers can clear it on completion.
export async function runFlowAndPoll({ endpointUrl, payload, fetchXAIStatus, onDone, pollMs = 1000 }) {
  await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const intervalId = setInterval(() => { fetchXAIStatus(); }, pollMs);
  if (onDone) onDone(intervalId);
  return intervalId;
}

export async function fetchInstanceProbs({ serverUrl, modelId }) {
  const res = await fetch(`${serverUrl}/api/xai/lime/instance-probs/${modelId}`);
  if (!res.ok) return null;
  return res.json();
}
