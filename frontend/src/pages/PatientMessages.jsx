import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";

const initialConversations = [
    {
        id: "dr-hadi-rahme",
        doctorName: "Dr. Hadi Rahme",
        specialty: "Internal Medicine",
        lastUpdatedAt: "11:20 AM",
        messages: [
            {
                id: "m1",
                sender: "doctor",
                text: "Good morning. How are your symptoms today?",
                time: "10:50 AM",
            },
            {
                id: "m2",
                sender: "patient",
                text: "Better than yesterday, but still a little dizzy.",
                time: "11:05 AM",
            },
        ],
    },
    {
        id: "dr-rania-khoury",
        doctorName: "Dr. Rania Khoury",
        specialty: "Cardiology",
        lastUpdatedAt: "Yesterday",
        messages: [
            {
                id: "m3",
                sender: "doctor",
                text: "Please continue tracking your blood pressure twice daily.",
                time: "Yesterday",
            },
        ],
    },
    {
        id: "dr-karim-nasr",
        doctorName: "Dr. Karim Nasr",
        specialty: "Neurology",
        lastUpdatedAt: "Mon",
        messages: [
            {
                id: "m4",
                sender: "doctor",
                text: "If headaches persist, book a follow-up this week.",
                time: "Mon",
            },
        ],
    },
];

export default function PatientMessages() {
    const [searchTerm, setSearchTerm] = useState("");
    const [conversations, setConversations] = useState(initialConversations);
    const [selectedConversationId, setSelectedConversationId] = useState(initialConversations[0]?.id || null);
    const [draftMessage, setDraftMessage] = useState("");

    const filteredConversations = useMemo(() => {
        return conversations.filter((conversation) =>
            conversation.doctorName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [conversations, searchTerm]);

    const selectedConversation = conversations.find(
        (conversation) => conversation.id === selectedConversationId
    );

    function handleSendMessage(e) {
        e.preventDefault();
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
                            sender: "patient",
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
                    <h1 className="text-3xl font-bold text-slate-800">Messages</h1>
                    <p className="mt-1 text-slate-500">Chat securely with your doctors.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <aside className="md:col-span-1 bg-white rounded-2xl shadow p-4">
                        <input
                            type="text"
                            placeholder="Search doctor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full mb-4 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />

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
                                            <p className="font-semibold text-slate-800">{conversation.doctorName}</p>
                                            <span className="text-xs text-slate-400">{conversation.lastUpdatedAt}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">{conversation.specialty}</p>
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
                                    <h2 className="text-lg font-semibold text-slate-800">{selectedConversation.doctorName}</h2>
                                    <p className="text-xs text-slate-500">{selectedConversation.specialty}</p>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                                    {selectedConversation.messages.map((message) => {
                                        const isPatientMessage = message.sender === "patient";

                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex ${isPatientMessage ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                                        isPatientMessage
                                                            ? "bg-sky-500 text-white"
                                                            : "bg-slate-100 text-slate-800"
                                                    }`}
                                                >
                                                    <p>{message.text}</p>
                                                    <p
                                                        className={`text-[11px] mt-1 ${
                                                            isPatientMessage ? "text-sky-100" : "text-slate-500"
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
                                Select a conversation to start messaging.
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
