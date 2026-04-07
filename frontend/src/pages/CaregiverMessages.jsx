import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders, getUser } from "../api/http";
import { createConversation, deleteConversation, getConversationMessages, getConversations, sendConversationMessage } from "../api/messaging";

const fmt = (d) => new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const other = (c, id) => (c?.participants || []).find((p) => p.id !== id) || null;
const label = (p) => p?.displayName || p?.email || "Patient";
const parseStructured = (body) => {
  const text = String(body || "");
  if (!text.startsWith("[Structured:")) return null;
  const lines = text.split("\n");
  const type = (lines.shift() || "").replace("[Structured:", "").replace("]", "").trim();
  return {
    type,
    entries: lines.map((line) => {
      const i = line.indexOf(":");
      return i === -1 ? null : { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
    }).filter(Boolean),
  };
};

function StructuredCard({ message }) {
  const parsed = parseStructured(message.body);
  if (!parsed) return null;
  return (
    <div className="w-full rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-teal-950 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">{parsed.type}</p>
        <span className="text-[11px] opacity-70">{fmt(message.sentAt)}</span>
      </div>
      <div className="mt-3 space-y-2">
        {parsed.entries.map((entry) => (
          <div key={`${parsed.type}-${entry.label}`} className="grid grid-cols-[120px_1fr] gap-2 text-sm">
            <span className="font-semibold opacity-70">{entry.label}</span>
            <span>{entry.value || "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function fetchLinkedPatients() {
  const response = await fetch(`${apiUrl}/api/caregivers/patients`, { headers: { ...authHeaders() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to load linked patients");
  return data;
}

export default function CaregiverMessages() {
  const user = getUser();
  const currentUserId = user?.id;
  const [searchTerm, setSearchTerm] = useState("");
  const [patientOptions, setPatientOptions] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
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
  const [activeComposer, setActiveComposer] = useState(false);
  const [structuredError, setStructuredError] = useState("");
  const [care, setCare] = useState({ updateType: "", summary: "", actionTaken: "", nextStep: "", urgency: "Routine" });

  async function loadConversations() {
    const data = await getConversations();
    const list = data.conversations || [];
    setConversations(list);
    setSelectedConversationId((cur) => (list.some((c) => c.id === cur) ? cur : list[0]?.id || ""));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [patientsData, conversationsData] = await Promise.all([fetchLinkedPatients(), getConversations()]);
        if (cancelled) return;
        setPatientOptions((patientsData.patients || []).map((r) => ({ id: r.patient?.id, label: label(r.patient) })).filter((p) => p.id));
        setConversations(conversationsData.conversations || []);
        setSelectedConversationId((cur) => cur || conversationsData.conversations?.[0]?.id || "");
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load messages.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedConversationId) return void setMessages([]);
      try {
        setMessagesLoading(true);
        setSendError("");
        const data = await getConversationMessages(selectedConversationId);
        if (!cancelled) setMessages(data.messages || []);
      } catch (err) {
        if (!cancelled) setSendError(err.message || "Failed to load conversation.");
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedConversationId]);

  const filteredConversations = useMemo(() => conversations.filter((c) => label(other(c, currentUserId)).toLowerCase().includes(searchTerm.toLowerCase())), [conversations, currentUserId, searchTerm]);
  const patientIdsWithConversation = useMemo(() => new Set(conversations.map((c) => other(c, currentUserId)?.id).filter(Boolean)), [conversations, currentUserId]);
  const availablePatientOptions = useMemo(() => patientOptions.filter((p) => !patientIdsWithConversation.has(p.id)), [patientIdsWithConversation, patientOptions]);
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null;
  const deleteTargetLabel = selectedConversation ? label(other(selectedConversation, currentUserId)) : "this participant";

  async function handleCreateConversation(e) {
    e.preventDefault();
    setCreateError("");
    if (!selectedPatientId) return setCreateError("Select a patient first.");
    try {
      const existing = conversations.find((c) => other(c, currentUserId)?.id === selectedPatientId);
      if (existing?.id) return setSelectedConversationId(existing.id), setCreateError("A conversation with this patient already exists.");
      const data = await createConversation({ recipientId: selectedPatientId });
      await loadConversations();
      if (data.conversation?.id) setSelectedConversationId(data.conversation.id);
      setSelectedPatientId("");
      setShowCreatePanel(false);
    } catch (err) { setCreateError(err.message || "Failed to start conversation."); }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    setSendError("");
    const trimmed = draftMessage.trim();
    if (!trimmed || !selectedConversationId) return;
    try {
      const data = await sendConversationMessage(selectedConversationId, trimmed);
      setMessages((cur) => [...cur, data.data]);
      setDraftMessage("");
      await loadConversations();
    } catch (err) { setSendError(err.message || "Failed to send message."); }
  }

  async function handleSendStructured() {
    if (!selectedConversationId) return;
    setStructuredError("");
    if (!care.updateType.trim() || !care.summary.trim()) return setStructuredError("Update type and summary are required.");
    const body = ["[Structured:Care Coordination Update]", `Update Type: ${care.updateType.trim()}`, `Summary: ${care.summary.trim()}`, `Action Taken: ${care.actionTaken.trim() || "None"}`, `Next Step: ${care.nextStep.trim() || "None"}`, `Urgency: ${care.urgency}`].join("\n");
    try {
      const data = await sendConversationMessage(selectedConversationId, body);
      setMessages((cur) => [...cur, data.data]);
      await loadConversations();
      setActiveComposer(false);
      setCare({ updateType: "", summary: "", actionTaken: "", nextStep: "", urgency: "Routine" });
    } catch (err) { setStructuredError(err.message || "Failed to send care update."); }
  }

  function handleDeleteConversation() {
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
    } catch (err) { setDeleteError(err.message || "Failed to delete chat."); }
    finally { setDeletingConversation(false); }
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col">
      <Navbar />
      <main className="pt-26 max-w-6xl mx-auto w-full px-6 pb-5 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="mb-6 shrink-0"><h1 className="text-3xl font-bold text-slate-800">Patient Messages</h1><p className="mt-1 text-slate-500">Chat securely with linked patients.</p></div>
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shrink-0">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1 min-h-0 pb-2">
          <aside className="md:col-span-1 bg-white rounded-2xl shadow p-4 h-full overflow-hidden flex flex-col">
            <input type="text" placeholder="Search patient..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full mb-4 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shrink-0" />
            <div className="mb-4 shrink-0">
              <button type="button" onClick={() => { setShowCreatePanel((c) => !c); setCreateError(""); }} className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-500 hover:text-sky-700">{showCreatePanel ? "Hide new conversation" : "Start new conversation"}</button>
              {showCreatePanel ? <form onSubmit={handleCreateConversation} className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"><option value="">Choose patient</option>{availablePatientOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
                <button type="submit" className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 transition" disabled={!selectedPatientId || availablePatientOptions.length === 0}>Create Conversation</button>
                {availablePatientOptions.length === 0 ? <p className="text-xs text-slate-500">All linked patients already have an existing conversation.</p> : null}
                {createError && <p className="text-sm text-red-700">{createError}</p>}
              </form> : null}
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {loading ? <p className="text-sm text-slate-500">Loading conversations...</p> : filteredConversations.length > 0 ? filteredConversations.map((c) => {
                const isActive = c.id === selectedConversationId;
                return <button key={c.id} type="button" onClick={() => setSelectedConversationId(c.id)} className={`w-full text-left rounded-2xl p-4 border transition ${isActive ? "border-sky-300 bg-gradient-to-br from-sky-50 to-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"}`}><div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-800 truncate">{label(other(c, currentUserId))}</p><span className="text-xs text-slate-400 whitespace-nowrap">{c.updatedAt ? fmt(c.updatedAt) : ""}</span></div><p className="text-sm text-slate-500 mt-1 truncate">{c.lastMessage?.body || "No messages yet"}</p></button>;
              }) : <p className="text-sm text-slate-500">No conversations found.</p>}
            </div>
          </aside>

          <section className="md:col-span-2 bg-white rounded-2xl shadow p-4 flex flex-col h-full overflow-hidden">
            {selectedConversation ? <>
              <div className="border-b border-slate-200 pb-3 mb-3 shrink-0 flex items-start justify-between gap-3">
                <div><h2 className="text-lg font-semibold text-slate-800">{label(other(selectedConversation, currentUserId))}</h2><p className="text-xs text-slate-500">Secure care thread</p></div>
                <button type="button" onClick={handleDeleteConversation} disabled={deletingConversation} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">{deletingConversation ? "Deleting..." : "Delete chat"}</button>
              </div>
              <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
                {messagesLoading ? <p className="text-sm text-slate-500">Loading messages...</p> : messages.length > 0 ? messages.map((m) => {
                  const structured = parseStructured(m.body);
                  const isCurrentUser = m.sender?.id === currentUserId;
                  return <div key={m.id} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}><div className={`max-w-[84%] rounded-2xl px-4 py-2 text-sm ${isCurrentUser ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-800"}`}>{structured ? <StructuredCard message={m} /> : <><p>{m.body}</p><p className={`text-[11px] mt-1 ${isCurrentUser ? "text-sky-100" : "text-slate-500"}`}>{fmt(m.sentAt)}</p></>}</div></div>;
                }) : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center"><p className="text-base font-semibold text-slate-800">No care updates yet</p><p className="mt-2 text-sm text-slate-500">Start the thread with a care coordination update or a regular message for this patient.</p></div>}
              </div>
              {sendError && <p className="mt-3 text-sm text-red-700 shrink-0">{sendError}</p>}
              {deleteError && <p className="mt-2 text-sm text-red-700 shrink-0">{deleteError}</p>}
              {structuredError && <p className="mt-2 text-sm text-red-700 shrink-0">{structuredError}</p>}
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shrink-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quick updates</p><p className="mt-1 text-sm text-slate-600">Send a structured caregiver coordination update in a cleaner format.</p></div>
                  <button type="button" onClick={() => { setActiveComposer((c) => !c); setStructuredError(""); }} className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${activeComposer ? "border-teal-300 bg-teal-100 text-teal-900" : "border-teal-200 bg-white text-teal-800 hover:bg-teal-50"}`}>Care coordination</button>
                </div>
                {activeComposer ? <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="text" value={care.updateType} onChange={(e) => setCare((c) => ({ ...c, updateType: e.target.value }))} placeholder="Update type" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  <select value={care.urgency} onChange={(e) => setCare((c) => ({ ...c, urgency: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"><option>Routine</option><option>Needs follow-up</option><option>Urgent</option></select>
                  <input type="text" value={care.summary} onChange={(e) => setCare((c) => ({ ...c, summary: e.target.value }))} placeholder="Short summary" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 md:col-span-2" />
                  <input type="text" value={care.actionTaken} onChange={(e) => setCare((c) => ({ ...c, actionTaken: e.target.value }))} placeholder="Action taken" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  <input type="text" value={care.nextStep} onChange={(e) => setCare((c) => ({ ...c, nextStep: e.target.value }))} placeholder="Next step" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  <div className="md:col-span-2 flex justify-end"><button type="button" onClick={handleSendStructured} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Send care update</button></div>
                </div> : null}
              </div>
              <form onSubmit={handleSendMessage} className="pt-3 mt-3 border-t border-slate-200 flex gap-2 shrink-0">
                <input type="text" value={draftMessage} onChange={(e) => setDraftMessage(e.target.value)} placeholder="Type a regular message..." className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                <button type="submit" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition">Send</button>
              </form>
            </> : <div className="h-full flex items-center justify-center text-slate-500 text-sm">Select or create a conversation to start messaging.</div>}
          </section>
        </div>
      </main>
      {showDeleteConfirm ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"><h3 className="text-lg font-semibold text-slate-900">Delete chat with {deleteTargetLabel}?</h3><p className="mt-2 text-sm text-slate-600">This will remove the conversation and all messages for both participants.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={confirmDeleteConversation} disabled={deletingConversation} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">{deletingConversation ? "Deleting..." : "Delete chat"}</button></div></div></div> : null}
    </div>
  );
}
