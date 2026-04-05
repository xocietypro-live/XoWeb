import React, { useState, useEffect, useRef } from "react";
import { Tv, Globe, Settings, Copy, Check, ExternalLink, Plus, Trash2, ListMusic, Shield, X, Info, FileJson } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Hls from "hls.js";

interface Channel {
  id: string;
  name: string;
  logo: string;
  url?: string;
  mpd?: string;
  category?: string;
  userAgent?: string;
  token?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"urls" | "manage">("urls");
  const [status, setStatus] = useState<any>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [customChannels, setCustomChannels] = useState<any[]>([]);
  const [externalPlaylists, setExternalPlaylists] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status").then(res => res.json()).then(setStatus);
    fetch("/api/admin/custom-channels").then(res => res.json()).then(setCustomChannels);
    fetch("/api/admin/external-playlists").then(res => res.json()).then(setExternalPlaylists);
  }, []);

  return (
    <div className="min-h-screen text-white font-['Outfit',sans-serif]">
      {/* Background Video */}
      <video autoPlay muted loop playsInline className="fixed top-0 left-0 w-full h-full object-cover -z-10 opacity-30">
        <source src="https://www.w3schools.com/howto/rain.mp4" type="video/mp4" />
      </video>

      <div className="max-w-[1000px] mx-auto px-5 py-10">
        {/* Header - XO.PRO Style */}
        <header className="flex justify-between items-center px-10 py-5 mb-20 bg-[rgba(255,255,255,0.03)] rounded-[100px] backdrop-blur-[20px] border border-[rgba(255,255,255,0.1)]">
          <div className="text-2xl font-extrabold text-[#00f2ff] tracking-[2px]">XO.PRO</div>
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab("urls")}
              className={`px-6 py-3 rounded-[50px] border transition ${activeTab === "urls" ? "bg-[rgba(255,255,255,0.1)]" : "border-transparent"}`}
            >
              Services
            </button>
            <a href="https://t.me/xocietylive" target="_blank" className="px-6 py-3 rounded-[50px] bg-[#00f2ff] text-black font-extrabold text-sm hover:opacity-90 transition">
              Join Channel
            </a>
          </div>
        </header>

        {/* Hero */}
        <div className="text-center mb-20">
          <h1 className="text-5xl font-extrabold mb-4">Streaming Reimagined</h1>
          <p className="text-[#888]">Select your project to start streaming</p>
        </div>

        {/* Grid Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          <button onClick={() => setActiveTab("urls")} className="bg-[rgba(255,255,255,0.02)] p-8 rounded-[25px] border border-[rgba(255,255,255,0.05)] hover:border-[#00f2ff] hover:bg-[rgba(0,242,255,0.05)] transition-all text-left group">
            <Tv className="w-8 h-8 text-[#00f2ff] mb-4" />
            <h3 className="text-xl font-bold">JioTV Web</h3>
          </button>
          
          <a href="https://xoweb-blue.vercel.app/" className="bg-[rgba(255,255,255,0.02)] p-8 rounded-[25px] border border-[rgba(255,255,255,0.05)] hover:border-[#00f2ff] hover:bg-[rgba(0,242,255,0.05)] transition-all group">
            <ListMusic className="w-8 h-8 text-[#00f2ff] mb-4" />
            <h3 className="text-xl font-bold">Playlist World</h3>
          </a>

          <button onClick={() => setActiveTab("manage")} className="bg-[rgba(255,255,255,0.02)] p-8 rounded-[25px] border border-[rgba(255,255,255,0.05)] hover:border-[#00f2ff] hover:bg-[rgba(0,242,255,0.05)] transition-all group">
            <Settings className="w-8 h-8 text-[#00f2ff] mb-4" />
            <h3 className="text-xl font-bold">Manage API</h3>
          </button>
        </div>

        {/* Management Section (Visible when tab is set to manage) */}
        {activeTab === "manage" && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[rgba(255,255,255,0.02)] p-10 rounded-[30px] border border-[rgba(255,255,255,0.05)]"
          >
            <h2 className="text-2xl font-bold mb-8">API Configuration</h2>
            <div className="space-y-6">
              <p className="text-[#888]">Connected Channels: {status?.channelCount || 0}</p>
              {/* Add your existing form logic here */}
              <div className="flex gap-4">
                 <button onClick={() => setActiveTab("urls")} className="text-[#00f2ff] border-b border-[#00f2ff]">Back to Services</button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
