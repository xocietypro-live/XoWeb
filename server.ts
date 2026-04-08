import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(process.cwd(), "data.json");

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ customChannels: [], externalPlaylists: [] }, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Cache for combined channel data
let cachedData: any[] = [];
let lastFetch = 0;
let minExpiry: number | null = null;
const CACHE_TTL = 30 * 1000; // 30 seconds for "automation" feel
const FETCH_TIMEOUT = 10000; // 10 seconds

  async function fetchWithTimeout(url: string, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  function getStoredData() {
    try {
      if (!fs.existsSync(DATA_FILE)) return { customChannels: [], externalPlaylists: [] };
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (e) {
      console.error("Error reading data file:", e);
      return { customChannels: [], externalPlaylists: [] };
    }
  }

  function saveStoredData(data: any) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("Error saving data file:", e);
    }
  }

  function extractExpiry(token: string): number | null {
    if (!token) return null;
    const match = token.match(/exp=(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  async function parseExternalM3U(url: string) {
    try {
      const response = await fetchWithTimeout(url);
      const text = await response.text();
      const lines = text.split("\n");
      const channels: any[] = [];
      let currentChannel: any = null;

      for (let line of lines) {
        line = line.trim();
        if (line.startsWith("#EXTINF:")) {
          const info = line.split(",")[1];
          const logoMatch = line.match(/tvg-logo="([^"]+)"/);
          const idMatch = line.match(/tvg-id="([^"]+)"/);
          const groupMatch = line.match(/group-title="([^"]+)"/);
          
          currentChannel = {
            name: info || "Unknown",
            logo: logoMatch ? logoMatch[1] : "",
            id: idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 9),
            category: groupMatch ? groupMatch[1] : "External",
            userAgent: "𝐒𝐄𝐂𝐑𝐄𝐓 𝐒𝐎𝐂𝐈𝐄𝐓𝐘",
          };
        } else if (line && !line.startsWith("#") && currentChannel) {
          currentChannel.mpd = line; // Could be m3u8 or mpd
          channels.push(currentChannel);
          currentChannel = null;
        }
      }
      return channels;
    } catch (error) {
      console.error(`Error parsing M3U from ${url}:`, error);
      return [];
    }
  }

  async function parseExternalJSON(url: string) {
    try {
      const response = await fetchWithTimeout(url);
      const text = await response.text();
      let data: any[] = [];
      const jsonMatch = text.match(/=\s*(\[[\s\S]*\])/);
      if (jsonMatch && jsonMatch[1]) {
        data = JSON.parse(jsonMatch[1].trim().replace(/;$/, ""));
      } else {
        data = JSON.parse(text);
      }
      return data.filter(item => item.id).map(item => {
        let ua = item.userAgent || "𝐒𝐄𝐂𝐑𝐄𝐓 𝐒𝐎𝐂𝐈𝐄𝐓𝐘";
        if (ua === "serevtvhub") ua = "𝐒𝐄𝐂𝐑𝐄𝐓 𝐒𝐎𝐂𝐈𝐄𝐓𝐘";
        return {
          ...item,
          userAgent: ua
        };
      });
    } catch (error) {
      console.error(`Error parsing JSON from ${url}:`, error);
      return [];
    }
  }

  async function getChannels() {
    const now = Date.now();
    // If cache is valid, return it
    if (cachedData.length > 0 && now - lastFetch < CACHE_TTL) {
      return cachedData;
    }

    const stored = getStoredData();
    let allChannels: any[] = [];
    let currentMinExpiry: number | null = null;

    // 1. Fetch from worker API (Automation)
    try {
      console.log("Fetching fresh data from worker...");
      const workerChannels = await parseExternalJSON("https://xojioprime.wasmer.app/playlist.php");
      
      if (workerChannels && workerChannels.length > 0) {
        workerChannels.forEach(item => {
          if (item.token) {
            const exp = extractExpiry(item.token);
            if (exp && (currentMinExpiry === null || exp < currentMinExpiry)) {
              currentMinExpiry = exp;
            }
          }
        });
        allChannels = [...workerChannels];
      }
    } catch (error) {
      console.error("Error fetching worker channels:", error);
      // If fetch fails but we have cache, keep using it for now
      if (cachedData.length > 0) return cachedData;
    }

    // 2. Fetch from external playlists
    for (const playlist of stored.externalPlaylists) {
      try {
        const url = typeof playlist === 'string' ? playlist : playlist.url;
        const type = typeof playlist === 'string' ? (url.includes(".json") ? "json" : "m3u") : playlist.type;
        const externalChannels = type === "json" ? await parseExternalJSON(url) : await parseExternalM3U(url);
        allChannels = [...allChannels, ...externalChannels];
      } catch (e) {
        console.error(`Error fetching playlist:`, e);
      }
    }

    // 3. Add custom manual channels
    allChannels = [...allChannels, ...stored.customChannels];

    // Update cache
    cachedData = allChannels;
    lastFetch = now;
    minExpiry = currentMinExpiry;
    console.log(`Cache updated with ${allChannels.length} channels at ${new Date(lastFetch).toLocaleTimeString()}`);
    return allChannels;
  }

  // API: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API: Status and Expiry
  app.get("/api/status", async (req, res) => {
    try {
      // If cache is empty or stale, we MUST wait for the fetch
      if (cachedData.length === 0 || Date.now() - lastFetch > CACHE_TTL) {
        await getChannels();
      }
      
      res.json({
        lastFetch,
        minExpiry,
        channelCount: cachedData.length,
        serverTime: Math.floor(Date.now() / 1000),
        isStale: Date.now() - lastFetch > CACHE_TTL
      });
    } catch (error) {
      console.error("Status endpoint error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API: One-time Import from URL
  app.post("/api/admin/import-from-url", async (req, res) => {
    const { url, type } = req.body;
    const channels = type === "json" ? await parseExternalJSON(url) : await parseExternalM3U(url);
    
    if (channels.length > 0) {
      const stored = getStoredData();
      // Avoid duplicates by ID
      const existingIds = new Set(stored.customChannels.map((c: any) => c.id));
      const newChannels = channels.filter(c => !existingIds.has(c.id));
      stored.customChannels = [...stored.customChannels, ...newChannels];
      saveStoredData(stored);
      lastFetch = 0;
      res.json({ success: true, count: newChannels.length });
    } else {
      res.status(400).json({ error: "No channels found or fetch failed" });
    }
  });

  // API: Manage Custom Channels
  app.get("/api/admin/custom-channels", (req, res) => {
    res.json(getStoredData().customChannels);
  });

  app.post("/api/admin/custom-channels", (req, res) => {
    const stored = getStoredData();
    const newChannel = { ...req.body, id: req.body.id || Date.now().toString() };
    stored.customChannels.push(newChannel);
    saveStoredData(stored);
    lastFetch = 0; // Invalidate cache
    res.json(newChannel);
  });

  app.delete("/api/admin/custom-channels/:id", (req, res) => {
    const stored = getStoredData();
    stored.customChannels = stored.customChannels.filter((c: any) => c.id !== req.params.id);
    saveStoredData(stored);
    lastFetch = 0;
    res.json({ success: true });
  });

  // API: Manage External Playlists
  app.get("/api/admin/external-playlists", (req, res) => {
    res.json(getStoredData().externalPlaylists);
  });

  app.post("/api/admin/external-playlists", (req, res) => {
    const stored = getStoredData();
    const { url } = req.body;
    if (url && !stored.externalPlaylists.includes(url)) {
      stored.externalPlaylists.push(url);
      saveStoredData(stored);
      lastFetch = 0;
    }
    res.json(stored.externalPlaylists);
  });

  app.delete("/api/admin/external-playlists", (req, res) => {
    const stored = getStoredData();
    const { url } = req.body;
    stored.externalPlaylists = stored.externalPlaylists.filter((u: string) => u !== url);
    saveStoredData(stored);
    lastFetch = 0;
    res.json(stored.externalPlaylists);
  });

  // API: Modified JSON
  app.get("/api/channels", async (req, res) => {
    const channels = await getChannels();
    res.json(channels);
  });

  // API: M3U Playlist
  app.get("/api/playlist", async (req, res) => {
    const userAgent = req.headers["user-agent"] || "";
    const isBrowser = /Mozilla/i.test(userAgent) && !/VLC|TiviMate|OTT|Smarters|Kodi|Perfect|Televizo|GSE|Lazy/i.test(userAgent);
    
    if (isBrowser) {
      return res.redirect("https://t.me/xocietylive");
    }

    const channels = await getChannels();
    let m3u = "#EXTM3U x-tvg-url=\"\"\n";
    
    channels.forEach((item: any) => {
      if (item.id) {
        let ua = item.userAgent || "𝐒𝐄𝐂𝐑𝐄𝐓 𝐒𝐎𝐂𝐈𝐄𝐓𝐘";
        if (ua === "serevtvhub") ua = "𝐒𝐄𝐂𝐑𝐄𝐓 𝐒𝐎𝐂𝐈𝐄𝐓𝐘";

        m3u += `#EXTINF:-1 tvg-id=\"${item.id}\" tvg-name=\"${item.name}\" tvg-logo=\"${item.logo}\" group-title=\"${item.category}\",${item.name}\n`;
        
        m3u += `#EXTVLCOPT:http-user-agent=${ua}\n`;
        if (item.referer) {
          m3u += `#EXTVLCOPT:http-referrer=${item.referer}\n`;
        }

        // DRM Support
        if (item.drm && typeof item.drm === 'object') {
          m3u += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
          const drmKeys = Object.entries(item.drm);
          if (drmKeys.length > 0) {
            const keyString = drmKeys.map(([kid, key]) => `${kid}:${key}`).join(",");
            m3u += `#KODIPROP:inputstream.adaptive.license_key=${keyString}\n`;
          }
        }

        const baseUrl = item.mpd || item.url;
        if (!baseUrl) return;

        const token = item.token ? (baseUrl.includes("?") ? "&" : "?") + item.token : "";
        const finalUrl = baseUrl + token;

        // Append headers and cookies
        let headerSuffix = `|User-Agent=${encodeURIComponent(ua)}`;
        if (item.referer) headerSuffix += `&Referer=${encodeURIComponent(item.referer)}`;
        if (item.cookies) headerSuffix += `&Cookie=${encodeURIComponent(item.cookies)}`;
        
        m3u += `${finalUrl}${headerSuffix}\n`;
      }
    });

    res.setHeader("Content-Type", "application/x-mpegurl");
    res.setHeader("Content-Disposition", "attachment; filename=playlist.m3u");
    res.send(m3u);
  });

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production";
  console.log(`Server starting in ${isProd ? "production" : "development"} mode`);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn("Dist folder not found, falling back to development-like behavior or error");
      // In some cases we might want to fail or provide a better fallback
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
