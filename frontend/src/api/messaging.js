import { apiUrl, authHeaders } from "./http";

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export function getConversations() {
  return request("/api/conversations");
}

export function createConversation(payload) {
  return request("/api/conversations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getConversationMessages(conversationId) {
  return request(`/api/conversations/${conversationId}/messages`);
}

export function sendConversationMessage(conversationId, body, options = {}) {
  return request(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      body,
      contextId: options.contextId,
      contextType: options.contextType,
      contextRelatedId: options.contextRelatedId,
      contextMetadata: options.contextMetadata,
    }),
  });
}
