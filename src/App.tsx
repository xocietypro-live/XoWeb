import React, { useState, useEffect, useRef } from "react";
import { 
  Tv, 
  Globe, 
  Settings, 
  Copy, 
  Check, 
  ExternalLink, 
  Plus, 
  Trash2, 
  ListMusic, 
  Shield, 
  Search, 
  Filter, 
  Play, 
  X,
  Info,
  FileJson
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Hls from "hls.js";

interface Channel {
  id: string;
  name: string;
  logo: string;
  url?: string;
  mpd?: string;
  category?: string;
  drmId?: string;
  drmKey?: string;
  cookies?: string;
  referer?: string;
  userAgent?: string;
  token?: string;
}

interface Status {
  channelCount: number;
  lastFetch: number;
  minExpiry: number | null;
  serverTime: number;
  isStale: boolean;
}

const VideoPlayer = ({ channel, onClose }: { channel: Channel; onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const streamUrl = channel.mpd || channel.url;
    if (!streamUrl) {
      setError("No stream URL found");
      return;
    }

    // Append token if exists
    const finalUrl = channel.token ? (streamUrl.includes("?") ? streamUrl + "&" + channel.token : streamUrl + "?" + channel.token) : streamUrl;

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          if (channel.userAgent) xhr.setRequestHeader("User-Agent", channel.userAgent);
          if (channel.referer) xhr.setRequestHeader("Referer", channel.referer);
        }
      });
      hls.loadSource(finalUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError(`Playback error: ${data.type}`);
        }
      });
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = finalUrl;
    } else {
      setError("HLS playback not supported in this browser");
    }
  }, [channel]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 sm:p-8 backdrop-blur-xl"
    >
      <div className="relative w-full max-w-5xl aspect-video glass rounded-[2rem] overflow-hidden border-white/10 shadow-2xl shadow-brand-primary/20">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-10 p-3 glass-hover rounded-2xl text-white/70 hover:text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <div className="p-6 bg-red-500/10 rounded-full mb-6 border border-red-500/20">
              <Info className="w-12 h-12 text-red-400" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Playback Failed</h3>
            <p className="text-gray-400 max-w-md mb-8">{error}</p>
            <div className="p-5 glass rounded-2xl text-xs font-mono text-gray-500 break-all max-w-lg">
              {channel.mpd || channel.url}
            </div>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            controls 
            autoPlay 
            className="w-full h-full object-contain"
          />
        )}

        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-black/50 p-2 border border-white/10">
              {channel.logo ? (
                <img src={channel.logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <Tv className="w-full h-full text-gray-700" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{channel.name}</h3>
              <p className="text-brand-primary text-sm font-medium uppercase tracking-widest">{channel.category || "General"}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"urls" | "manage" | "channels">("urls");
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState<boolean>(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [customChannels, setCustomChannels] = useState<any[]>([]);
  const [externalPlaylists, setExternalPlaylists] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activePlayer, setActivePlayer] = useState<Channel | null>(null);

  const [newChannel, setNewChannel] = useState({
    name: "",
    logo: "",
    url: "",
    drmId: "",
    drmKey: "",
    cookies: "",
    referer: "",
    category: "Custom"
  });

  const [newPlaylistUrl, setNewPlaylistUrl] = useState("");
  const [newPlaylistType, setNewPlaylistType] = useState<"m3u" | "json">("m3u");

  const appUrl = window.location.origin;
  const endpoints = [
    {
      id: "json",
      name: "JSON Endpoint",
      description: "Optimized for web applications and mobile apps. Returns a clean JSON array of all aggregated channels.",
      url: `${appUrl}/api/channels`,
      icon: <FileJson className="w-6 h-6" />,
    },
    {
      id: "m3u",
      name: "M3U Playlist",
      description: "Universal format for IPTV players like VLC, TiviMate, and OTT Navigator. Includes full metadata and DRM support.",
      url: `${appUrl}/api/playlist`,
      icon: <ListMusic className="w-6 h-6" />,
    },
  ];

  useEffect(() => {
    fetchStatus();
    fetchManagementData();
    
    // Auto-refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === "channels") {
      fetchChannels();
    }
  }, [activeTab]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setStatus(data);
      setStatusError(false);
    } catch (error) {
      console.error("Status fetch error:", error);
      setStatusError(true);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/channels");
      if (!res.ok) throw new Error("Failed to fetch channels");
      const data = await res.json();
      setChannels(data);
    } catch (error) {
      console.error("Channels fetch error:", error);
    }
  };

  const fetchManagementData = async () => {
    try {
      const [channelsRes, playlistsRes] = await Promise.all([
        fetch("/api/admin/custom-channels"),
        fetch("/api/admin/external-playlists"),
      ]);
      setCustomChannels(await channelsRes.json());
      setExternalPlaylists(await playlistsRes.json());
    } catch (error) {
      console.error("Management data fetch error:", error);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/custom-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newChannel),
      });
      if (res.ok) {
        setNewChannel({ name: "", logo: "", url: "", drmId: "", drmKey: "", cookies: "", referer: "", category: "Custom" });
        fetchManagementData();
        fetchStatus();
      }
    } catch (error) {
      console.error("Add channel error:", error);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/custom-channels/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchManagementData();
        fetchStatus();
      }
    } catch (error) {
      console.error("Delete channel error:", error);
    }
  };

  const handleAddPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/external-playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newPlaylistUrl }),
      });
      if (res.ok) {
        setNewPlaylistUrl("");
        fetchManagementData();
        fetchStatus();
      }
    } catch (error) {
      console.error("Add playlist error:", error);
    }
  };

  const handleDeletePlaylist = async (url: string) => {
    try {
      const res = await fetch("/api/admin/external-playlists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        fetchManagementData();
        fetchStatus();
      }
    } catch (error) {
      console.error("Delete playlist error:", error);
    }
  };

  const handleOneTimeImport = async () => {
    if (!newPlaylistUrl) return;
    setIsImporting(true);
    try {
      const res = await fetch("/api/admin/import-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newPlaylistUrl, type: newPlaylistType }),
      });
      if (res.ok) {
        setNewPlaylistUrl("");
        fetchManagementData();
        fetchStatus();
      }
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      setIsImporting(false);
    }
  };

  const categories = ["All", ...Array.from(new Set(channels.map(c => c.category || "General")))];
  const filteredChannels = channels.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || (c.category || "General") === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen selection:bg-brand-primary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="inline-flex items-center justify-center p-4 glass rounded-3xl mb-8 border-brand-primary/20 shadow-2xl shadow-brand-primary/10"
          >
            <Tv className="w-12 h-12 text-brand-primary" />
          </motion.div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6 text-gradient italic">
            𝐒𝐄𝐂𝐑𝐄𝐓 𝐒𝐎𝐂𝐈𝐄𝐓𝐘
          </h1>
          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto font-light leading-relaxed">
            The ultimate IPTV management layer. Seamlessly aggregate sources, manage custom streams, and distribute optimized playlists across all your devices.
          </p>
        </motion.div>

        {/* Tabs Navigation */}
        <div className="flex justify-center mb-12 p-1.5 glass rounded-2xl w-fit mx-auto overflow-x-auto max-w-full no-scrollbar">
          <button
            onClick={() => setActiveTab("urls")}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all duration-300 whitespace-nowrap ${activeTab === "urls" ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/25" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
          >
            <Globe className="w-5 h-5" />
            <span>Access URLs</span>
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all duration-300 whitespace-nowrap ${activeTab === "manage" ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/25" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
          >
            <Settings className="w-5 h-5" />
            <span>Manage Sources</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "urls" ? (
            <motion.div
              key="urls"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Status Bar */}
              <div className="glass rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="flex flex-wrap items-center gap-8">
                    {statusError ? (
                      <div className="flex items-center gap-3 text-red-400">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                        <span className="font-medium">Connection Interrupted</span>
                        <button 
                          onClick={fetchStatus}
                          className="px-3 py-1.5 glass-hover rounded-lg text-xs font-semibold uppercase tracking-wider"
                        >
                          Reconnect
                        </button>
                      </div>
                    ) : status ? (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                          <span className="text-gray-400 font-medium uppercase text-xs tracking-widest">Active Channels</span>
                          <span className="font-mono text-brand-secondary text-lg font-bold">{status.channelCount}</span>
                        </div>
                        {status.minExpiry && (
                          <div className="flex items-center gap-3 pl-8 border-l border-white/10">
                            <Shield className="w-4 h-4 text-brand-primary" />
                            <span className="text-gray-400 font-medium uppercase text-xs tracking-widest">Token Validity</span>
                            <span className={`font-mono font-bold ${status.minExpiry - status.serverTime < 3600 ? 'text-red-400' : 'text-brand-primary'}`}>
                              {new Date(status.minExpiry * 1000).toLocaleString([], { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit' 
                              })}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-3 text-gray-500">
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-600 animate-pulse" />
                        <span className="font-medium uppercase text-xs tracking-widest">Initializing System...</span>
                      </div>
                    )}
                  </div>
                  {status && (
                    <div className="text-gray-500 text-xs font-medium uppercase tracking-widest">
                      Synced {status.lastFetch > 0 ? new Date(status.lastFetch).toLocaleTimeString() : "Pending..."}
                    </div>
                  )}
                </div>
                
                {window.location.hostname.includes('vercel.app') && (
                  <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
                    <Info className="w-4 h-4 shrink-0" />
                    <p>
                      <span className="font-bold">Vercel Notice:</span> Custom channels and linked sources will reset periodically. Use Firebase for permanent storage.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {endpoints.map((endpoint) => (
                  <div
                    key={endpoint.id}
                    className="group glass rounded-3xl p-8 glass-hover relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                      {React.cloneElement(endpoint.icon as React.ReactElement, { className: "w-32 h-32" })}
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 bg-brand-primary/10 rounded-2xl text-brand-primary group-hover:scale-110 transition-transform duration-500">
                          {endpoint.icon}
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">{endpoint.name}</h2>
                      </div>
                      
                      <p className="text-gray-400 mb-8 leading-relaxed font-light">
                        {endpoint.description}
                      </p>
                      
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3 bg-black/40 rounded-2xl px-5 py-4 border border-white/5 font-mono text-sm text-brand-primary/90 overflow-hidden">
                          <span className="truncate flex-1">{endpoint.url || "Initializing..."}</span>
                        </div>
                        
                        <div className="flex gap-3">
                          <button
                            onClick={() => copyToClipboard(endpoint.url, endpoint.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-4 glass rounded-2xl font-semibold hover:bg-white/10 transition-all active:scale-95"
                          >
                            {copied === endpoint.id ? (
                              <>
                                <Check className="w-5 h-5 text-green-400" />
                                <span className="text-green-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-5 h-5" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                          <a 
                            href={endpoint.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-4 glass rounded-2xl hover:bg-white/10 transition-all active:scale-95"
                          >
                            <ExternalLink className="w-6 h-6" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="manage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12"
            >
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
                <div className="xl:col-span-2 space-y-12">
                  {/* Add Custom Channel */}
                  <section className="glass rounded-[2.5rem] p-8 sm:p-10">
                    <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                      <Plus className="w-8 h-8 text-brand-primary" />
                      Add Channel
                    </h2>
                    <form onSubmit={handleAddChannel} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">Channel Name</label>
                        <input
                          type="text"
                          placeholder="e.g. HBO HD"
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-primary transition-colors"
                          value={newChannel.name}
                          onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">Logo URL</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-primary transition-colors"
                          value={newChannel.logo}
                          onChange={(e) => setNewChannel({ ...newChannel, logo: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">Stream Source (m3u8/mpd)</label>
                        <input
                          type="text"
                          placeholder="https://source.com/index.m3u8"
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-primary transition-colors"
                          value={newChannel.url}
                          onChange={(e) => setNewChannel({ ...newChannel, url: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-6 sm:col-span-2">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">DRM Key ID</label>
                          <input
                            type="text"
                            placeholder="Optional"
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-primary transition-colors"
                            value={newChannel.drmId}
                            onChange={(e) => setNewChannel({ ...newChannel, drmId: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">DRM Key</label>
                          <input
                            type="text"
                            placeholder="Optional"
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-primary transition-colors"
                            value={newChannel.drmKey}
                            onChange={(e) => setNewChannel({ ...newChannel, drmKey: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">Cookies</label>
                        <input
                          type="text"
                          placeholder="Optional"
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-primary transition-colors"
                          value={newChannel.cookies}
                          onChange={(e) => setNewChannel({ ...newChannel, cookies: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">Referer</label>
                        <input
                          type="text"
                          placeholder="Optional"
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-brand-primary transition-colors"
                          value={newChannel.referer}
                          onChange={(e) => setNewChannel({ ...newChannel, referer: e.target.value })}
                        />
                      </div>
                      <button type="submit" className="sm:col-span-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold py-5 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-brand-primary/20">
                        Add to Collection
                      </button>
                    </form>
                  </section>

                  {/* Import External Playlist */}
                  <section className="glass rounded-[2.5rem] p-8 sm:p-10">
                    <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                      <ListMusic className="w-8 h-8 text-brand-primary" />
                      Import Source
                    </h2>
                    <div className="space-y-8">
                      <form onSubmit={handleAddPlaylist} className="flex flex-col sm:flex-row gap-4">
                        <select
                          className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-brand-primary text-gray-300 font-bold"
                          value={newPlaylistType}
                          onChange={(e) => setNewPlaylistType(e.target.value as "m3u" | "json")}
                        >
                          <option value="m3u">M3U</option>
                          <option value="json">JSON</option>
                        </select>
                        <input
                          type="url"
                          placeholder="Enter playlist URL..."
                          className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-brand-primary transition-colors"
                          value={newPlaylistUrl}
                          onChange={(e) => setNewPlaylistUrl(e.target.value)}
                          required
                        />
                        <button 
                          type="submit"
                          className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold px-8 py-4 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-brand-primary/20"
                        >
                          Link (Live Sync)
                        </button>
                      </form>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button 
                          onClick={handleOneTimeImport}
                          disabled={isImporting}
                          className="flex-1 glass-hover text-white font-bold py-5 rounded-2xl border border-white/10 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                          {isImporting ? "Importing..." : "One-time Import"}
                        </button>
                      </div>
                      <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-sm text-gray-400 leading-relaxed">
                          <span className="text-brand-primary font-bold">Live Sync:</span> Fetches channels dynamically on every request. Best for active sources.
                          <br />
                          <span className="text-brand-primary font-bold">One-time:</span> Downloads all channels now and saves them to your local collection.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-12">
                  {/* Custom Channels List */}
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-3 px-2">
                      <Shield className="w-6 h-6 text-brand-primary" />
                      Collection ({customChannels.length})
                    </h3>
                    <div className="glass rounded-3xl overflow-hidden">
                      <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
                        {customChannels.length === 0 ? (
                          <div className="py-12 text-center text-gray-500 italic font-light">No custom channels yet</div>
                        ) : (
                          customChannels.map((c) => (
                            <div key={c.id} className="flex items-center justify-between glass-hover bg-white/[0.02] p-4 rounded-2xl border border-white/5 group">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center overflow-hidden border border-white/5">
                                  {c.logo ? (
                                    <img src={c.logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Tv className="w-6 h-6 text-gray-700" />
                                  )}
                                </div>
                                <span className="font-semibold text-gray-200">{c.name}</span>
                              </div>
                              <button 
                                onClick={() => handleDeleteChannel(c.id)} 
                                className="text-gray-600 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* External Playlists List */}
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-3 px-2">
                      <Globe className="w-6 h-6 text-brand-primary" />
                      Linked Sources ({externalPlaylists.length})
                    </h3>
                    <div className="glass rounded-3xl overflow-hidden">
                      <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                        {externalPlaylists.length === 0 ? (
                          <div className="py-12 text-center text-gray-500 italic font-light">No linked playlists</div>
                        ) : (
                          externalPlaylists.map((url) => (
                            <div key={url} className="flex items-center justify-between glass-hover bg-white/[0.02] p-4 rounded-2xl border border-white/5 group">
                              <span className="text-sm text-gray-400 truncate max-w-[200px] font-mono">{url}</span>
                              <button 
                                onClick={() => handleDeletePlaylist(url)} 
                                className="text-gray-600 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-32 pt-12 border-t border-white/5 text-center"
        >
          <p className="text-gray-500 text-sm font-medium tracking-widest uppercase">
            © 2026 𝐒𝐄𝐂𝐑𝐄𝐓 𝐒𝐎𝐂𝐈𝐄𝐓𝐘 • Engineered for Excellence
          </p>
        </motion.div>
      </div>

      <AnimatePresence>
        {activePlayer && (
          <VideoPlayer 
            channel={activePlayer} 
            onClose={() => setActivePlayer(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
