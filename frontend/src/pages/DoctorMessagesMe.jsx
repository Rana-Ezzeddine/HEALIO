import {useState} from "react";
import Navbar from "../components/Navbar";

const initialConversations = [
    {
        id: "sarah-khalil",
        patientName: "Sarah Khalil",
        lastUpdatedAt: "10:45 AM",
        messages:[
            {
                id: "m1",
                sender: "patient",
                text: "Hi doctor, I have a mild headache since this morning.",
                time: "10:20 AM",
            },
            {
                id: "m2",
                sender: "doctor",
                text: "Thanks for the update. Please drink water and monitor for 2-3 hours.",
                time: "10:25 AM",
            },
        ],
    },
    {
        id: "omar-haddad",
        patientName: "Omar Haddad",
        lastUpdatedAt: "yesterday",
        messages:[
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
        messages:[
            {
                id: "m4",
                sender: "patient",
                text: "My blood pressure was 135/88 this morning.",
                time: "Mon",
            },
        ],
    }
];

export default function DoctorMessage(){
    return(
        <div className="min-h-screen bg-slate-50">
            <Navbar/>

            <main className="pt-28 max-w-6xl mx-auto px-6 py-8">
                <div className="">
                    <h1>
                        Patient Messages
                    </h1>
                </div>
            </main>
        </div>
    );
}