import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { getUser } from "../api/http";
import { getMyCaregivers } from "../api/links";
import {
  createConversation,
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
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [sendError, setSendError] = useState("");

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

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) || null;

  async function handleCreateConversation(event) {
    event.preventDefault();
    setCreateError("");

    if (!selectedCaregiverId) {
      setCreateError("Select a caregiver first.");
      return;
    }

    try {
      const data = await createConversation({ recipientId: selectedCaregiverId });
      const conversationId = data.conversation?.id;
      await loadConversations();
      if (conversationId) {
        setSelectedConversationId(conversationId);
      }
      setSelectedCaregiverId("");
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Messages</h1>
          <p className="mt-1 text-slate-500">Chat securely with caregivers linked to your care.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <aside className="md:col-span-1 bg-white rounded-2xl shadow p-4">
            <input
              type="text"
              placeholder="Search caregiver..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full mb-4 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <form onSubmit={handleCreateConversation} className="space-y-2 mb-4">
              <select
                value={selectedCaregiverId}
                onChange={(event) => setSelectedCaregiverId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Start chat with caregiver</option>
                {caregiverOptions.map((caregiver) => (
                  <option key={caregiver.id} value={caregiver.id}>
                    {caregiver.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-xl bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600 transition"
              >
                Start Conversation
              </button>
              {createError && <p className="text-sm text-red-700">{createError}</p>}
            </form>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
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
                <p className="text-sm text-slate-500">No conversations found.</p>
              )}
            </div>
          </aside>

          <section className="md:col-span-2 bg-white rounded-2xl shadow p-4 flex flex-col h-[620px]">
            {selectedConversation ? (
              <>
                <div className="border-b border-slate-200 pb-3 mb-3">
                  <h2 className="text-lg font-semibold text-slate-800">
                    {participantLabel(getOtherParticipant(selectedConversation, currentUserId))}
                  </h2>
                  <p className="text-xs text-slate-500">Secure chat</p>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-3">
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
                    <p className="text-sm text-slate-500">No messages yet.</p>
                  )}
                </div>

                {sendError && <p className="mt-3 text-sm text-red-700">{sendError}</p>}

                <form onSubmit={handleSendMessage} className="pt-3 mt-3 border-t border-slate-200 flex gap-2">
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
    </div>
  );
}
