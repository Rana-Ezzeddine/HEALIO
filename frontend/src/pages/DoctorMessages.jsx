import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";

const initialConversations = [
    {
        id: "sarah-khalil",
        patientName: "Sarah Khalil",
        lastUpdatedAt: "10:45 AM",
        messages: [
            {
                id: "m1",
                sender: "patient",
                text: "Hi doctor, I have a mild headache since this morning.",
                time: "10:10 AM",
            },
            {
                id: "m2",
                sender: "doctor",
                text: "Thanks for the update. Please drink water and monitor for 2-3 hours.",
                time: "10:20 AM",
            },
        ],
    },
    {
        id: "omar-haddad",
        patientName: "Omar Haddad",
        lastUpdatedAt: "Yesterday",
        messages: [
            {
                id: "m3",
                sender: "patient",
                text: "Can I take my evening dose earlier today?",
                time: "Yesterday",
            },
        ],
    },
    {
        id: "lina-saad",
        patientName: "Lina Saad",
        lastUpdatedAt: "Mon",
        messages: [
            {
                id: "m4",
                sender: "patient",
                text: "My blood pressure was 135/88 this morning.",
                time: "Mon",
            },
        ],
    },
];

export default function DoctorMessages() {
    const [searchTerm, setSearchTerm] = useState("");
    const [newPatientName, setNewPatientName] = useState("");
    const [isAddingConversation, setIsAddingConversation] = useState(false);
    const [conversations, setConversations] = useState(initialConversations);
    const [selectedConversationId, setSelectedConversationId] = useState(initialConversations[0]?.id || null);
    const [draftMessage, setDraftMessage] = useState("");

    const filteredConversations = useMemo(() => {
        return conversations.filter((conversation) =>
            conversation.patientName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [conversations, searchTerm]);

    const selectedConversation = conversations.find(
        (conversation) => conversation.id === selectedConversationId
    );

    function handleAddConversation(e) {
        e.preventDefault();
        const trimmedName = newPatientName.trim();

        if (!trimmedName) {
            return;
        }

        const existingConversation = conversations.find(
            (conversation) => conversation.patientName.toLowerCase() === trimmedName.toLowerCase()
        );

        if (existingConversation) {
            setSelectedConversationId(existingConversation.id);
            setSearchTerm("");
            setNewPatientName("");
            return;
        }

        const generatedId = `${trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
        const newConversation = {
            id: generatedId,
            patientName: trimmedName,
            lastUpdatedAt: "Just now",
            messages: [],
        };

        setConversations((previousConversations) => [newConversation, ...previousConversations]);
        setSelectedConversationId(generatedId);
        setSearchTerm("");
        setNewPatientName("");
        setIsAddingConversation(false);
    }

    function handleSendMessage(e) {
        e.preventDefault(); //to prevent errors
        const trimmedMessage = draftMessage.trim();

        if (!trimmedMessage || !selectedConversationId) {
            return;
        }

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        setConversations((previousConversations) =>
            previousConversations.map((conversation) => {
                if (conversation.id !== selectedConversationId) {
                    return conversation;
                }

                return {
                    ...conversation,
                    lastUpdatedAt: time,
                    messages: [
                        ...conversation.messages,
                        {
                            id: `${conversation.id}-${conversation.messages.length + 1}`,
                            sender: "doctor",
                            text: trimmedMessage,
                            time,
                        },
                    ],
                };
            })
        );

        setDraftMessage("");
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-800">Patient Messages</h1>
                    <p className="mt-1 text-slate-500">Review and reply to your patients in one place.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <aside className="md:col-span-1 bg-white rounded-2xl shadow p-4">
                        <input
                            type="text"
                            placeholder="Search patient..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full mb-4 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />

                        <div className="mb-4">
                            {!isAddingConversation ? (
                                <button
                                    type="button"
                                    onClick={() => setIsAddingConversation(true)}
                                    className="w-full rounded-xl bg-sky-500 text-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-sky-400 transition"
                                >
                                    + New Patient Chat
                                </button>
                            ) : (
                                <form onSubmit={handleAddConversation} className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Patient full name"
                                        value={newPatientName}
                                        onChange={(e) => setNewPatientName(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            className="flex-1 rounded-xl bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600 transition"
                                        >
                                            Create Chat
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAddingConversation(false);
                                                setNewPatientName("");
                                            }}
                                            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                            {filteredConversations.map((conversation) => {
                                const isActive = conversation.id === selectedConversationId;
                                const lastMessage = conversation.messages[conversation.messages.length - 1];

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
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-slate-800">{conversation.patientName}</p>
                                            <span className="text-xs text-slate-400">{conversation.lastUpdatedAt}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1 truncate">{lastMessage?.text || "No messages yet"}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <section className="md:col-span-2 bg-white rounded-2xl shadow p-4 flex flex-col h-[620px]">
                        {selectedConversation ? (
                            <>
                                <div className="border-b border-slate-200 pb-3 mb-3">
                                    <h2 className="text-lg font-semibold text-slate-800">{selectedConversation.patientName}</h2>
                                    <p className="text-xs text-slate-500">Secure chat</p>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                                    {selectedConversation.messages.map((message) => {
                                        const isDoctorMessage = message.sender === "doctor";

                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex ${isDoctorMessage ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                                        isDoctorMessage
                                                            ? "bg-sky-500 text-white"
                                                            : "bg-slate-100 text-slate-800"
                                                    }`}
                                                >
                                                    <p>{message.text}</p>
                                                    <p
                                                        className={`text-[11px] mt-1 ${
                                                            isDoctorMessage ? "text-sky-100" : "text-slate-500"
                                                        }`}
                                                    >
                                                        {message.time}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <form onSubmit={handleSendMessage} className="pt-3 mt-3 border-t border-slate-200 flex gap-2">
                                    <input
                                        type="text"
                                        value={draftMessage}
                                        onChange={(e) => setDraftMessage(e.target.value)}
                                        placeholder="Type your reply..."
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
                                Select a conversation to start messaging.
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}