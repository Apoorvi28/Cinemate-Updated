const express = require("express");
const http = require("http");
const multer = require("multer");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./Routes/auth");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use("/api/auth", authRoutes);

// Multer setup for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const videoURL = `http://localhost:4000/uploads/${req.file.filename}`;
  res.json({ videoURL });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.get("/", (req, res) => res.send("Server is running"));

// ====== In-memory state ======
const videoURLs    = {};  // roomId -> video URL
const users        = {};  // socketId -> { roomId, username }
const roomCreators = {};  // roomId -> creator socketId

// --- ALGORITHM 1: Adaptive Latency-Compensated Sync (ALCS) ---
// Each client's measured one-way network latency (ms)
const clientLatencies = {}; // socketId -> one-way latency (ms)

// --- ALGORITHM 2: Median-Threshold Drift Correction (MTDC) ---
// Stores latest reported playback times from all clients per room
const roomTimeReports = {}; // roomId -> [{ socketId, time }]
const roomSyncState   = {}; // roomId -> { isPlaying: bool }

// --- FEATURE: Timestamped Reaction Heatmap ---
// Stores reaction events per video second per room
const roomReactions = {}; // roomId -> { second: [{ emoji, username }] }

// ====== Socket.IO logic ======
io.on("connection", (socket) => {

  // ── Join Room ──────────────────────────────────────────────────────────────
  socket.on("joinRoom", ({ roomId, username }, callback) => {
    socket.join(roomId);
    users[socket.id] = { roomId, username };

    const room = io.sockets.adapter.rooms.get(roomId);
    const isCreator = room?.size === 1;

    if (isCreator) {
      roomCreators[roomId] = socket.id;
      roomSyncState[roomId] = { isPlaying: false };
    }

    // Send current video URL to the new joiner
    if (videoURLs[roomId]) {
      socket.emit("video-url", { url: videoURLs[roomId] });
    }

    // Send existing reaction heatmap to the new joiner
    if (roomReactions[roomId]) {
      socket.emit("reaction-update", { reactions: roomReactions[roomId] });
    }

    socket.to(roomId).emit("userJoined", username);
    callback({ isCreator });
  });

  // ── Video URL broadcast ────────────────────────────────────────────────────
  socket.on("video-url", ({ roomId, url }) => {
    videoURLs[roomId] = url;
    // Reset reactions and heatmap for the new video
    roomReactions[roomId] = {};
    roomTimeReports[roomId] = [];
    socket.to(roomId).emit("video-url", { url });
    io.to(roomId).emit("reaction-update", { reactions: {} });
  });

  // ── ALGORITHM 1: Latency Measurement (Ping/Pong) ────────────────────────
  // Step 1: Client sends ping with its own timestamp
  socket.on("ping-latency", ({ clientTime }) => {
    // Reflect back so client can compute RTT
    socket.emit("pong-latency", { clientTime, serverTime: Date.now() });
  });

  // Step 2: Client computes RTT and reports it; server stores one-way latency
  socket.on("pong-latency-result", ({ rtt }) => {
    clientLatencies[socket.id] = Math.min(rtt / 2, 500); // cap at 500ms
    console.log(`[ALCS] Socket ${socket.id} latency: ${clientLatencies[socket.id].toFixed(1)} ms`);
  });

  // ── ALGORITHM 1: Scheduled Synchronized Play ──────────────────────────────
  // Instead of immediate play, all clients receive a future UTC timestamp
  // (startAt) to begin playback simultaneously, accounting for their latencies.
  socket.on("play", ({ roomId, time }) => {
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    let maxLatency = 50; // minimum safety buffer (ms)

    if (roomSockets) {
      for (const sid of roomSockets) {
        const lat = clientLatencies[sid] || 0;
        if (lat > maxLatency) maxLatency = lat;
      }
    }

    // All clients will start playing at this future UTC timestamp
    const startAt = Date.now() + maxLatency + 100;
    if (roomSyncState[roomId]) roomSyncState[roomId].isPlaying = true;

    console.log(`[ALCS] Room ${roomId}: scheduled play at +${maxLatency + 100}ms, t=${time.toFixed(2)}s`);
    io.to(roomId).emit("scheduled-play", { time, startAt });
  });

  socket.on("pause", ({ roomId, time }) => {
    if (roomSyncState[roomId]) roomSyncState[roomId].isPlaying = false;
    socket.to(roomId).emit("video-pause", { time });
  });

  // ── Seek (creator-only guard) ──────────────────────────────────────────────
  socket.on("seek", ({ roomId, time }) => {
    if (roomCreators[roomId] === socket.id) {
      io.to(roomId).emit("seek", time);
    }
  });

  socket.on("video-play", ({ roomId, time }) => {
    socket.to(roomId).emit("video-play", { time });
  });

  socket.on("video-pause", ({ roomId, time }) => {
    socket.to(roomId).emit("video-pause", { time });
  });

  socket.on("video-seek", ({ roomId, time }) => {
    socket.to(roomId).emit("video-seek", { time });
  });

  // ── ALGORITHM 2: Drift Reporting ──────────────────────────────────────────
  // Clients respond to "request-time" events with their current playback time
  socket.on("report-time", ({ roomId, currentTime }) => {
    if (!roomTimeReports[roomId]) roomTimeReports[roomId] = [];
    // Replace any old report from this same socket
    roomTimeReports[roomId] = roomTimeReports[roomId].filter(
      (r) => r.socketId !== socket.id
    );
    roomTimeReports[roomId].push({ socketId: socket.id, time: currentTime });
  });

  // ── FEATURE: Floating Emoji Reactions ───────────────────────────────────────
  // Stores timestamped reactions for data/academic purposes, then broadcasts
  // a floating-reaction event to ALL users (including sender) for live animation.
  socket.on("send-reaction", ({ roomId, timestamp, emoji, username }) => {
    if (!roomReactions[roomId]) roomReactions[roomId] = {};
    const second = Math.floor(timestamp);
    if (!roomReactions[roomId][second]) roomReactions[roomId][second] = [];
    roomReactions[roomId][second].push({ emoji, username });

    // Broadcast to ALL users in room (io.to includes the sender)
    io.to(roomId).emit("floating-reaction", { emoji, username });
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  socket.on("chatMessage", ({ roomId, username, message }) => {
    io.to(roomId).emit("chatMessage", { username, message });
  });

  socket.on("chatImage", ({ roomId, username, image }) => {
    io.to(roomId).emit("chatImage", { username, image });
  });

  // ── Leave ─────────────────────────────────────────────────────────────────
  socket.on("leaveRoom", (roomId) => {
    const user = users[socket.id];
    if (user) {
      socket.leave(roomId);
      socket.to(roomId).emit("userLeft", user.username);
      delete users[socket.id];
      _cleanupCreator(roomId, socket.id);
    }
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      const { roomId, username } = user;
      socket.to(roomId).emit("userLeft", username);
      delete users[socket.id];
      _cleanupCreator(roomId, socket.id);
    }
    delete clientLatencies[socket.id];
  });
});

// ── ALGORITHM 2: Periodic Median-Threshold Drift Correction (MTDC) ──────────
// Every 15 seconds, polls all playing rooms for client playback positions.
// Computes the median time across all clients. Any client deviating more than
// DRIFT_THRESHOLD seconds from the median receives a corrective seek command.
const DRIFT_THRESHOLD = 2; // seconds
const DRIFT_CHECK_INTERVAL = 15000; // ms
const DRIFT_COLLECT_WINDOW = 2000; // ms to wait for reports

setInterval(() => {
  for (const roomId of Object.keys(roomSyncState)) {
    if (!roomSyncState[roomId]?.isPlaying) continue;

    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || room.size < 2) continue;

    // Clear old reports and request fresh ones from all clients
    roomTimeReports[roomId] = [];
    io.to(roomId).emit("request-time");

    // After the collection window, compute median and correct drifters
    setTimeout(() => {
      const reports = roomTimeReports[roomId] || [];
      if (reports.length < 2) return;

      const times = reports.map((r) => r.time).sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];

      console.log(
        `[MTDC] Room ${roomId}: median=${median.toFixed(2)}s, reports=${reports.length}`
      );

      for (const report of reports) {
        if (Math.abs(report.time - median) > DRIFT_THRESHOLD) {
          const driftedSocket = io.sockets.sockets.get(report.socketId);
          if (driftedSocket) {
            console.log(
              `[MTDC]  Correcting socket ${report.socketId}: ${report.time.toFixed(2)}s -> ${median.toFixed(2)}s`
            );
            driftedSocket.emit("force-seek", { time: median });
          }
        }
      }
    }, DRIFT_COLLECT_WINDOW);
  }
}, DRIFT_CHECK_INTERVAL);

// ── Helper: clean up creator state ────────────────────────────────────────────
function _cleanupCreator(roomId, socketId) {
  if (roomCreators[roomId] === socketId) {
    // Notify all remaining members BEFORE wiping state
    io.to(roomId).emit("room-closed");
    delete videoURLs[roomId];
    delete roomCreators[roomId];
    delete roomReactions[roomId];
    delete roomSyncState[roomId];
  }
}

// ====== Start Server ======
server.listen(4000, () => {
  console.log("Server is running on port 4000");
});
