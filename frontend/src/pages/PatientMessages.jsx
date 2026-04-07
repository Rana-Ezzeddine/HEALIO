import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { getUser } from "../api/http";
import { getMyCaregivers } from "../api/links";
import { createConversation, deleteConversation, getConversationMessages, getConversations, sendConversationMessage } from "../api/messaging";

const fmt = (d) => new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const other = (c, id) => (c?.participants || []).find((p) => p.id !== id) || null;
const label = (p) => p?.displayName || p?.email || "Caregiver";
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
  const tone =
    parsed.type === "Symptom Update"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : parsed.type === "Medication Update"
        ? "border-cyan-200 bg-cyan-50 text-cyan-950"
        : "border-emerald-200 bg-emerald-50 text-emerald-950";
  return (
    <div className={`w-full rounded-2xl border px-4 py-3 shadow-sm ${tone}`}>
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
  const [activeComposer, setActiveComposer] = useState("");
  const [structuredError, setStructuredError] = useState("");
  const [symptom, setSymptom] = useState({ symptom: "", severity: "Moderate", when: "", details: "" });
  const [medication, setMedication] = useState({ name: "", updateType: "Started", schedule: "", notes: "" });

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
        const [caregiversData, conversationsData] = await Promise.all([getMyCaregivers(), getConversations()]);
        if (cancelled) return;
        const map = new Map();
        for (const record of caregiversData.caregivers || []) if (record.caregiver?.id) map.set(record.caregiver.id, { id: record.caregiver.id, label: label(record.caregiver) });
        for (const c of conversationsData.conversations || []) {
          const p = other(c, currentUserId);
          if (p?.id) map.set(p.id, { id: p.id, label: label(p) });
        }
        setCaregiverOptions(Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label)));
        setConversations(conversationsData.conversations || []);
        setSelectedConversationId((cur) => cur || conversationsData.conversations?.[0]?.id || "");
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load messages.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

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
  const caregiverIdsWithConversation = useMemo(() => new Set(conversations.map((c) => other(c, currentUserId)?.id).filter(Boolean)), [conversations, currentUserId]);
  const availableCaregiverOptions = useMemo(() => caregiverOptions.filter((c) => !caregiverIdsWithConversation.has(c.id)), [caregiverIdsWithConversation, caregiverOptions]);
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null;
  const deleteTargetLabel = selectedConversation ? label(other(selectedConversation, currentUserId)) : "this participant";

  async function handleCreateConversation(e) {
    e.preventDefault();
    setCreateError("");
    if (!selectedCaregiverId) return setCreateError("Select a caregiver first.");
    try {
      const existing = conversations.find((c) => other(c, currentUserId)?.id === selectedCaregiverId);
      if (existing?.id) return setSelectedConversationId(existing.id), setCreateError("A conversation with this caregiver already exists.");
      const data = await createConversation({ recipientId: selectedCaregiverId });
      await loadConversations();
      if (data.conversation?.id) setSelectedConversationId(data.conversation.id);
      setSelectedCaregiverId("");
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
    let body = "";
    if (activeComposer === "symptom") {
      if (!symptom.symptom.trim()) return setStructuredError("Symptom name is required.");
      body = ["[Structured:Symptom Update]", `Symptom: ${symptom.symptom.trim()}`, `Severity: ${symptom.severity}`, `When: ${symptom.when.trim() || "Not specified"}`, `Details: ${symptom.details.trim() || "None"}`].join("\n");
    }
    if (activeComposer === "medication") {
      if (!medication.name.trim()) return setStructuredError("Medication name is required.");
      body = [
        "[Structured:Medication Update]",
        `Medication: ${medication.name.trim()}`,
        `Update: ${medication.updateType}`,
        `Schedule: ${medication.schedule.trim() || "Not specified"}`,
        `Notes: ${medication.notes.trim() || "None"}`,
      ].join("\n");
    }
    try {
      const data = await sendConversationMessage(selectedConversationId, body);
      setMessages((cur) => [...cur, data.data]);
      await loadConversations();
      setActiveComposer("");
      setSymptom({ symptom: "", severity: "Moderate", when: "", details: "" });
      setMedication({ name: "", updateType: "Started", schedule: "", notes: "" });
    } catch (err) { setStructuredError(err.message || "Failed to send structured update."); }
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
        <div className="mb-6 shrink-0">
          <h1 className="text-3xl font-bold text-slate-800">Updates & Communication</h1>
          <p className="mt-1 text-slate-500">Chat securely with caregivers linked to your care.</p>
        </div>
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shrink-0">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1 min-h-0 pb-2">
          <aside className="md:col-span-1 bg-white rounded-2xl shadow p-4 h-full overflow-hidden flex flex-col">
            <input type="text" placeholder="Search caregiver..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full mb-4 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shrink-0" />
            <div className="mb-4 shrink-0">
              <button type="button" onClick={() => { setShowCreatePanel((c) => !c); setCreateError(""); }} className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-500 hover:text-sky-700">
                {showCreatePanel ? "Hide new conversation" : "Start new conversation"}
              </button>
              {showCreatePanel ? (
                <form onSubmit={handleCreateConversation} className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <select value={selectedCaregiverId} onChange={(e) => setSelectedCaregiverId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                    <option value="">Choose caregiver</option>
                    {availableCaregiverOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <button type="submit" className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 transition" disabled={!selectedCaregiverId || availableCaregiverOptions.length === 0}>Create Conversation</button>
                  {availableCaregiverOptions.length === 0 ? <p className="text-xs text-slate-500">All linked caregivers already have an existing conversation.</p> : null}
                  {createError && <p className="text-sm text-red-700">{createError}</p>}
                </form>
              ) : null}
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {loading ? <p className="text-sm text-slate-500">Loading conversations...</p> : filteredConversations.length > 0 ? filteredConversations.map((c) => {
                const isActive = c.id === selectedConversationId;
                return (
                  <button key={c.id} type="button" onClick={() => setSelectedConversationId(c.id)} className={`w-full text-left rounded-2xl p-4 border transition ${isActive ? "border-sky-300 bg-gradient-to-br from-sky-50 to-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800 truncate">{label(other(c, currentUserId))}</p>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{c.updatedAt ? fmt(c.updatedAt) : ""}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 truncate">{c.lastMessage?.body || "No messages yet"}</p>
                  </button>
                );
              }) : <p className="text-sm text-slate-500">No conversations found. Start a new conversation with a linked caregiver to begin communication.</p>}
            </div>
          </aside>

          <section className="md:col-span-2 bg-white rounded-2xl shadow p-4 flex flex-col h-full overflow-hidden">
            {selectedConversation ? (
              <>
                <div className="border-b border-slate-200 pb-3 mb-3 shrink-0 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">{label(other(selectedConversation, currentUserId))}</h2>
                    <p className="text-xs text-slate-500">Secure care thread</p>
                  </div>
                  <button type="button" onClick={handleDeleteConversation} disabled={deletingConversation} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">{deletingConversation ? "Deleting..." : "Delete chat"}</button>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
                  {messagesLoading ? <p className="text-sm text-slate-500">Loading messages...</p> : messages.length > 0 ? messages.map((m) => {
                    const structured = parseStructured(m.body);
                    const isCurrentUser = m.sender?.id === currentUserId;
                    return (
                      <div key={m.id} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[84%] rounded-2xl px-4 py-2 text-sm ${isCurrentUser ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-800"}`}>
                          {structured ? <StructuredCard message={m} /> : <><p>{m.body}</p><p className={`text-[11px] mt-1 ${isCurrentUser ? "text-sky-100" : "text-slate-500"}`}>{fmt(m.sentAt)}</p></>}
                        </div>
                      </div>
                    );
                  }) : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center"><p className="text-base font-semibold text-slate-800">No updates yet</p><p className="mt-2 text-sm text-slate-500">Share a symptom change, appointment request, or regular message to start this care thread.</p></div>}
                </div>
                {sendError && <p className="mt-3 text-sm text-red-700 shrink-0">{sendError}</p>}
                {deleteError && <p className="mt-2 text-sm text-red-700 shrink-0">{deleteError}</p>}
                {structuredError && <p className="mt-2 text-sm text-red-700 shrink-0">{structuredError}</p>}
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shrink-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quick updates</p><p className="mt-1 text-sm text-slate-600">Send a structured care update instead of typing everything manually.</p></div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setActiveComposer((c) => c === "symptom" ? "" : "symptom"); setStructuredError(""); }} className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${activeComposer === "symptom" ? "border-amber-300 bg-amber-100 text-amber-900" : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"}`}>Symptom update</button>
                      <button type="button" onClick={() => { setActiveComposer((c) => c === "medication" ? "" : "medication"); setStructuredError(""); }} className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${activeComposer === "medication" ? "border-cyan-300 bg-cyan-100 text-cyan-900" : "border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50"}`}>Medication update</button>
                    </div>
                  </div>
                  {activeComposer === "symptom" ? <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input type="text" value={symptom.symptom} onChange={(e) => setSymptom((c) => ({ ...c, symptom: e.target.value }))} placeholder="Symptom name" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <select value={symptom.severity} onChange={(e) => setSymptom((c) => ({ ...c, severity: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"><option>Mild</option><option>Moderate</option><option>High</option></select>
                    <input type="text" value={symptom.when} onChange={(e) => setSymptom((c) => ({ ...c, when: e.target.value }))} placeholder="When did this happen?" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input type="text" value={symptom.details} onChange={(e) => setSymptom((c) => ({ ...c, details: e.target.value }))} placeholder="Extra details" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <div className="md:col-span-2 flex justify-end"><button type="button" onClick={handleSendStructured} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">Send symptom update</button></div>
                  </div> : null}
                  {activeComposer === "medication" ? <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input type="text" value={medication.name} onChange={(e) => setMedication((c) => ({ ...c, name: e.target.value }))} placeholder="Medication name" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                    <select value={medication.updateType} onChange={(e) => setMedication((c) => ({ ...c, updateType: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"><option>Started</option><option>Stopped</option><option>Missed dose</option><option>Side effect</option><option>Reminder issue</option></select>
                    <input type="text" value={medication.schedule} onChange={(e) => setMedication((c) => ({ ...c, schedule: e.target.value }))} placeholder="Schedule or dose" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                    <input type="text" value={medication.notes} onChange={(e) => setMedication((c) => ({ ...c, notes: e.target.value }))} placeholder="Extra notes" className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                    <div className="md:col-span-2 flex justify-end"><button type="button" onClick={handleSendStructured} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">Send medication update</button></div>
                  </div> : null}
                </div>
                <form onSubmit={handleSendMessage} className="pt-3 mt-3 border-t border-slate-200 flex gap-2 shrink-0">
                  <input type="text" value={draftMessage} onChange={(e) => setDraftMessage(e.target.value)} placeholder="Type a regular message..." className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                  <button type="submit" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition">Send</button>
                </form>
              </>
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-sm">Select or create a conversation to start messaging.</div>}
          </section>
        </div>
      </main>
      {showDeleteConfirm ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"><h3 className="text-lg font-semibold text-slate-900">Delete chat with {deleteTargetLabel}?</h3><p className="mt-2 text-sm text-slate-600">This will remove the conversation and all messages for both participants.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={confirmDeleteConversation} disabled={deletingConversation} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">{deletingConversation ? "Deleting..." : "Delete chat"}</button></div></div></div> : null}
    </div>
  );
}
