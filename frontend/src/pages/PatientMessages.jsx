import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { getUser } from "../api/http";
import { getMyCaregivers } from "../api/links";
import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  getConversations,
  sendConversationMessage,
} from "../api/messaging";

function formatTimestamp(dateLike) {
  return new Date(dateLike).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getOtherParticipant(conversation, currentUserId) {
  if (!conversation) return null;
  return (conversation.participants || []).find((participant) => participant.id !== currentUserId) || null;
}

function participantLabel(participant) {
  return participant?.displayName || participant?.email || "Caregiver";
}

export default function PatientMessages() {
  const user = getUser();
  const currentUserId = user?.id;

  const [searchTerm, setSearchTerm] = useState("");
  const [caregiverOptions, setCaregiverOptions] = useState([]);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [sendError, setSendError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function loadConversations() {
    const data = await getConversations();
    const list = data.conversations || [];
    setConversations(list);

    if (!selectedConversationId && list[0]?.id) {
      setSelectedConversationId(list[0].id);
    } else if (selectedConversationId && !list.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(list[0]?.id || "");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      setLoading(true);
      setError("");

      try {
        const [caregiversData, conversationsData] = await Promise.all([
          getMyCaregivers(),
          getConversations(),
        ]);

        if (cancelled) return;

        const caregivers = caregiversData.caregivers || [];
        const conversationsList = conversationsData.conversations || [];
        const caregiverMap = new Map();

        for (const record of caregivers) {
          if (record.caregiver?.id) {
            caregiverMap.set(record.caregiver.id, {
              id: record.caregiver.id,
              label: participantLabel(record.caregiver),
            });
          }
        }

        for (const conversation of conversationsList) {
          const other = getOtherParticipant(conversation, currentUserId);
          if (other?.id) {
            caregiverMap.set(other.id, {
              id: other.id,
              label: participantLabel(other),
            });
          }
        }

        setCaregiverOptions(Array.from(caregiverMap.values()).sort((left, right) => left.label.localeCompare(right.label)));
        setConversations(conversationsList);
        setSelectedConversationId((current) => current || conversationsList[0]?.id || "");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load messages.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPageData();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }

      try {
        setMessagesLoading(true);
        setSendError("");
        const data = await getConversationMessages(selectedConversationId);
        if (!cancelled) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        if (!cancelled) {
          setSendError(err.message || "Failed to load conversation.");
        }
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
        }
      }
    }

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [selectedConversationId]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const other = getOtherParticipant(conversation, currentUserId);
      return participantLabel(other).toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [conversations, currentUserId, searchTerm]);

  const caregiverIdsWithConversation = useMemo(() => {
    const ids = new Set();
    for (const conversation of conversations) {
      const other = getOtherParticipant(conversation, currentUserId);
      if (other?.id) ids.add(other.id);
    }
    return ids;
  }, [conversations, currentUserId]);

  const availableCaregiverOptions = useMemo(
    () => caregiverOptions.filter((caregiver) => !caregiverIdsWithConversation.has(caregiver.id)),
    [caregiverIdsWithConversation, caregiverOptions]
  );

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) || null;
  const deleteTargetLabel = selectedConversation
    ? participantLabel(getOtherParticipant(selectedConversation, currentUserId))
    : "this participant";

  async function handleCreateConversation(event) {
    event.preventDefault();
    setCreateError("");

    if (!selectedCaregiverId) {
      setCreateError("Select a caregiver first.");
      return;
    }

    try {
      const existingConversation = conversations.find((conversation) => {
        const other = getOtherParticipant(conversation, currentUserId);
        return other?.id === selectedCaregiverId;
      });

      if (existingConversation?.id) {
        setSelectedConversationId(existingConversation.id);
        setCreateError("A conversation with this caregiver already exists.");
        return;
      }

      const data = await createConversation({ recipientId: selectedCaregiverId });
      const conversationId = data.conversation?.id;
      await loadConversations();
      if (conversationId) {
        setSelectedConversationId(conversationId);
      }
      setSelectedCaregiverId("");
      setShowCreatePanel(false);
    } catch (err) {
      setCreateError(err.message || "Failed to start conversation.");
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    setSendError("");
    const trimmedMessage = draftMessage.trim();

    if (!trimmedMessage || !selectedConversationId) {
      return;
    }

    try {
      const data = await sendConversationMessage(selectedConversationId, trimmedMessage);
      setMessages((current) => [...current, data.data]);
      setDraftMessage("");
      await loadConversations();
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
    }
  }

  async function handleDeleteConversation() {
    if (!selectedConversationId || deletingConversation) return;
    setDeleteError("");
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteConversation() {
    if (!selectedConversationId || deletingConversation) return;

    try {
      setDeletingConversation(true);
      setDeleteError("");
      await deleteConversation(selectedConversationId);
      setMessages([]);
      setDraftMessage("");
      setShowDeleteConfirm(false);
      await loadConversations();
    } catch (err) {
      setDeleteError(err.message || "Failed to delete chat.");
    } finally {
      setDeletingConversation(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col">
      <Navbar />

      <main className="pt-26 max-w-6xl mx-auto w-full px-6 pb-5 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="mb-6 shrink-0">
          <h1 className="text-3xl font-bold text-slate-800">Updates & Communication</h1>
          <p className="mt-1 text-slate-500">Chat securely with caregivers linked to your care.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shrink-0">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1 min-h-0 pb-2">
          <aside className="md:col-span-1 bg-white rounded-2xl shadow p-4 h-full overflow-hidden flex flex-col">
            <input
              type="text"
              placeholder="Search caregiver..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full mb-4 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shrink-0"
            />

            <div className="mb-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowCreatePanel((current) => !current);
                  setCreateError("");
                }}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-500 hover:text-sky-700"
              >
                {showCreatePanel ? "Hide new conversation" : "Start new conversation"}
              </button>

              {showCreatePanel ? (
                <form onSubmit={handleCreateConversation} className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <select
                    value={selectedCaregiverId}
                    onChange={(event) => setSelectedCaregiverId(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Choose caregiver</option>
                    {availableCaregiverOptions.map((caregiver) => (
                      <option key={caregiver.id} value={caregiver.id}>
                        {caregiver.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 transition"
                    disabled={!selectedCaregiverId || availableCaregiverOptions.length === 0}
                  >
                    Create Conversation
                  </button>
                  {availableCaregiverOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">All linked caregivers already have an existing conversation.</p>
                  ) : null}
                  {createError && <p className="text-sm text-red-700">{createError}</p>}
                </form>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {loading ? (
                <p className="text-sm text-slate-500">Loading conversations...</p>
              ) : filteredConversations.length > 0 ? (
                filteredConversations.map((conversation) => {
                  const isActive = conversation.id === selectedConversationId;
                  const other = getOtherParticipant(conversation, currentUserId);

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full text-left rounded-xl p-3 border transition ${
                        isActive
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-800 truncate">{participantLabel(other)}</p>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {conversation.updatedAt ? formatTimestamp(conversation.updatedAt) : ""}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1 truncate">
                        {conversation.lastMessage?.body || "No messages yet"}
                      </p>
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No conversations found. Start a new conversation with a linked caregiver to begin communication.</p>
              )}
            </div>
          </aside>

          <section className="md:col-span-2 bg-white rounded-2xl shadow p-4 flex flex-col h-full overflow-hidden">
            {selectedConversation ? (
              <>
                <div className="border-b border-slate-200 pb-3 mb-3 shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">
                        {participantLabel(getOtherParticipant(selectedConversation, currentUserId))}
                      </h2>
                      <p className="text-xs text-slate-500">Secure chat</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteConversation}
                      disabled={deletingConversation}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingConversation ? "Deleting..." : "Delete chat"}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
                  {messagesLoading ? (
                    <p className="text-sm text-slate-500">Loading messages...</p>
                  ) : messages.length > 0 ? (
                    messages.map((message) => {
                      const isCurrentUser = message.sender?.id === currentUserId;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                              isCurrentUser
                                ? "bg-sky-500 text-white"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            <p>{message.body}</p>
                            <p
                              className={`text-[11px] mt-1 ${
                                isCurrentUser ? "text-sky-100" : "text-slate-500"
                              }`}
                            >
                              {formatTimestamp(message.sentAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">No messages yet. Send the first message to start this care update thread.</p>
                  )}
                </div>

                {sendError && <p className="mt-3 text-sm text-red-700 shrink-0">{sendError}</p>}
                {deleteError && <p className="mt-2 text-sm text-red-700 shrink-0">{deleteError}</p>}

                <form onSubmit={handleSendMessage} className="pt-3 mt-3 border-t border-slate-200 flex gap-2 shrink-0">
                  <input
                    type="text"
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition"
                  >
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Select or create a conversation to start messaging.
              </div>
            )}
          </section>
        </div>
      </main>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete chat with {deleteTargetLabel}?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will remove the conversation and all messages for both participants.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteConversation}
                disabled={deletingConversation}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingConversation ? "Deleting..." : "Delete chat"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
