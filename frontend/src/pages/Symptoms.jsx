import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar"
import { Plus, Clock, Pencil, Pill, Trash2, X, Check, Search, AlertCircle } from 'lucide-react';

export default function Symptoms(){
    return(
        <div className="min-h-screen bg-sky-50 p-6">
            <Navbar/>
            <header className="pt-20 max-w-6xl mx-auto mb-6">
                <div>
                    <h1 className="text-3xl text-slate-700 font-bold mb-3">Symptoms Management</h1>
                
                </div>
            </header>
            <div className="bg-white p-6 rounded-2xl shadow-md">
                <h2 className="text-lg font-semibold text-slate-700 mb-4">How are you feeling today?</h2>
                <div className="flex flex-wrap gap-3">
                    <button className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-700 hover:bg-emerald-100 hover:scale-105 transition">
                        😃 Good
                    </button>
                    <button className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-700 hover:bg-emerald-100 hover:scale-105 transition">
                        😐 Okay
                    </button>
                    <button className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-700 hover:bg-emerald-100 hover:scale-105 transition">
                        😞 Bad
                    </button>
                    <button className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-700 hover:bg-emerald-100 hover:scale-105 transition">
                        🤒 Very Unwell
                    </button>
                </div>
            </div>
        </div>
        
    );
}