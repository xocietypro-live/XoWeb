import React, { useState, useEffect } from "react";
import { Tv, Globe, Settings, Copy, Check, ExternalLink, Plus, Trash2, ListMusic, Shield, Info, FileJson } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"urls" | "manage">("urls");
  
  return (
    <div className="min-h-screen text-white">
      {/* Background Video */}
      <video autoPlay muted loop playsInline className="bg-video">
        <source src="https://www.w3schools.com/howto/rain.mp4" type="video/mp4" />
      </video>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex justify-between items-center p-6 glass rounded-full mb-16 border border-white/10">
          <div className="text-2xl font-extrabold text-[var(--color-accent)] tracking-widest ml-4">XO.PRO</div>
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab("urls")}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition ${activeTab === 'urls' ? 'bg-[var(--color-accent)] text-black' : 'hover:bg-white/10'}`}
            >
              Services
            </button>
            <a href="https://t.me/xocietylive" target="_blank" className="px-6 py-2 rounded-full text-sm font-bold bg-[var(--color-accent)] text-black hover:opacity-90">
              Join Channel
            </a>
          </div>
        </header>

        <div className="text-center mb-16">
          <h1 className="text-6xl font-extrabold mb-4">Streaming Reimagined</h1>
          <p className="text-gray-400">Select your project to start streaming</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Example Card */}
          <a href="https://xoweb.pages.dev/" className="glass p-8 rounded-3xl flex flex-col gap-4 glass-hover">
            <Tv className="w-8 h-8 text-[var(--color-accent)]" />
            <h3 className="text-xl font-bold">JioTV Web</h3>
          </a>
          
          <a href="https://xoweb-blue.vercel.app/" className="glass p-8 rounded-3xl flex flex-col gap-4 glass-hover">
            <ListMusic className="w-8 h-8 text-[var(--color-accent)]" />
            <h3 className="text-xl font-bold">Playlist World</h3>
          </a>
          
          <div className="glass p-8 rounded-3xl flex flex-col gap-4 opacity-50">
            <Globe className="w-8 h-8 text-[var(--color-accent)]" />
            <h3 className="text-xl font-bold">JioTV Worldwide</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
