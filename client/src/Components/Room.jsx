import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import "./Room.css";
import EmojiPicker from "emoji-picker-react";

// ── Sentiment Engine ──────────────────────────────────────────────────────────
// Lightweight NLP keyword engine that classifies chat messages into moods.
// Each word list is weighted; cumulative scores determine the dominant mood.
const SENTIMENT_WORDS = {
  joy:     ["haha", "lol", "wow", "amazing", "love", "great", "funny", "best", "cute", "yay", "😂", "❤️", "😍", "🎉", "🔥"],
  tense:   ["scary", "dark", "omg", "creepy", "shocking", "panic", "run", "danger", "no!", "😱", "😨", "💀", "🫣"],
  sad:     ["sad", "cry", "tears", "miss", "why", ":(", "😢", "😭", "💔", "alone"],
  excited: ["wow", "insane", "legendary", "goat", "fire", "epic", "unreal", "🤯", "😤", "⚡", "🏆"],
};

function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  const scores = { joy: 0, tense: 0, sad: 0, excited: 0 };
  for (const [mood, words] of Object.entries(SENTIMENT_WORDS)) {
    for (const word of words) {
      if (lower.includes(word)) scores[mood]++;
    }
  }
  return scores;
}

function getDominantMood(cumulative) {
  const entries = Object.entries(cumulative);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return "neutral";
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

// ── Floating Emoji Overlay ────────────────────────────────────────────────────
// Renders animated emojis that float upward over the video when any user reacts.
// Each emoji has randomised position, size, speed and lateral drift so that
// simultaneous reactions from multiple users look distinct and lively.
function FloatingEmojiOverlay({ emojis }) {
  return (
    <div className="floating-overlay">
      {emojis.map(({ id, emoji, username, x, duration, drift, size }) => (
        <div
          key={id}
          className="floating-emoji-wrapper"
          style={{
            left: `${x}%`,
            '--float-duration': `${duration}s`,
            '--float-drift':    `${drift}px`,
            '--emoji-size':     `${size}rem`,
          }}
        >
          <span className="floating-emoji">{emoji}</span>
          <span className="floating-username">{username}</span>
        </div>
      ))}
    </div>
  );
}

// ── Latency Badge ─────────────────────────────────────────────────────────────
function LatencyBadge({ latency }) {
  const color = latency < 80 ? "#22c55e" : latency < 200 ? "#f59e0b" : "#ef4444";
  const label = latency < 80 ? "Excellent" : latency < 200 ? "Good" : "High";
  return (
    <div className="latency-badge" style={{ borderColor: color, color }}>
      <span className="latency-dot" style={{ background: color }} />
      {latency}ms · {label}
    </div>
  );
}

// ── Main Room Component ────────────────────────────────────────────────────────
function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef       = useRef(null);
  const chatBoxRef     = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const copyTimeout    = useRef(null);
  const isSyncing      = useRef(false);
  const socket         = useRef(io("http://localhost:4000")).current;

  // Basic state
  const [username, setUsername]           = useState("");
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  const [genre, setGenre]                 = useState("");
  const [messages, setMessages]           = useState([]);
  const [message, setMessage]             = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCopied, setIsCopied]           = useState(false);
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [playing, setPlaying]             = useState(false);
  const [currentTime, setCurrentTime]     = useState(0);
  const [videoSrc, setVideoSrc]           = useState("");
  const [formError, setFormError]         = useState("");

  // Algorithm 1: ALCS — measured one-way latency
  const [latency, setLatency] = useState(0);

  // Feature: Floating Emoji Reactions
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  // Feature: Chat Sentiment Engine
  const [sentimentScore, setSentimentScore] = useState({ joy: 0, tense: 0, sad: 0, excited: 0 });
  const [dominantMood, setDominantMood]     = useState("neutral");

  // ── ALGORITHM 1: Latency Measurement (Ping/Pong RTT) ──────────────────────
  useEffect(() => {
    const measureLatency = () => {
      const clientTime = Date.now();
      socket.emit("ping-latency", { clientTime });
      socket.once("pong-latency", ({ clientTime: ct }) => {
        const rtt = Date.now() - ct;
        const oneWay = Math.round(rtt / 2);
        setLatency(oneWay);
        socket.emit("pong-latency-result", { rtt });
      });
    };
    measureLatency();
    const interval = setInterval(measureLatency, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Room Closed: redirect non-creator users when host leaves ──────────────
  useEffect(() => {
    socket.on("room-closed", () => {
      alert("The host has left. The room is now closed.");
      navigate("/");
    });
    return () => socket.off("room-closed");
  }, []);

  // ── Sentiment → Dominant Mood ──────────────────────────────────────────────
  useEffect(() => {
    setDominantMood(getDominantMood(sentimentScore));
  }, [sentimentScore]);

  // ── Video Upload ───────────────────────────────────────────────────────────
  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("video", file);
    try {
      const res  = await fetch("http://localhost:4000/upload", { method: "POST", body: formData });
      const data = await res.json();
      setVideoSrc(data.videoURL);
      socket.emit("video-url", { roomId: id, url: data.videoURL });
    } catch (err) {
      console.error("Video upload failed:", err);
    }
  };

  const handleCopyLink = () => {
    const roomLink = `${window.location.origin}/room/${id}`;
    navigator.clipboard.writeText(roomLink).then(() => {
      setIsCopied(true);
      copyTimeout.current = setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleUsernameSubmit = () => {
    if (!username.trim()) { setFormError("Please enter your name"); return; }
    if (!genre)           { setFormError("Please select a genre"); return; }
    setFormError("");
    socket.emit("joinRoom", { roomId: id, username }, ({ isCreator }) => {
      setIsRoomCreator(isCreator);
      setIsUsernameSet(true);
    });
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else         videoRef.current.play();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit("chatImage", { roomId: id, username, image: reader.result });
      setMessages((prev) => [...prev, { username, image: reader.result }]);
    };
    reader.readAsDataURL(file);
  };

  // ── Chat + Sentiment ───────────────────────────────────────────────────────
  const handleSendMessage = () => {
    if (!message.trim()) return;
    socket.emit("chatMessage", { roomId: id, username, message });
    // Run sentiment analysis on the outgoing message
    const delta = analyzeSentiment(message);
    setSentimentScore((prev) => ({
      joy:     prev.joy     + delta.joy,
      tense:   prev.tense   + delta.tense,
      sad:     prev.sad     + delta.sad,
      excited: prev.excited + delta.excited,
    }));
    setMessage("");
  };

  const handleLeaveRoom = () => {
    if (window.confirm("Are you sure you want to leave the room?")) {
      socket.emit("leaveRoom", id);
      navigate("/");
    }
  };

  const handleFullscreen = () => {
    document.querySelector(".room-container")?.requestFullscreen?.();
  };

  const handleSeek = () => {
    if (!isSyncing.current && videoRef.current) {
      socket.emit("video-seek", { roomId: id, time: videoRef.current.currentTime });
    }
  };

  // ── FEATURE: Emit Timestamped Reaction ────────────────────────────────────
  const handleReaction = useCallback((emoji) => {
    if (!videoRef.current) return;
    socket.emit("send-reaction", {
      roomId: id,
      timestamp: videoRef.current.currentTime,
      emoji,
      username,
    });
  }, [id, username, socket]);

  // ── Socket event subscriptions ────────────────────────────────────────────
  useEffect(() => {
    socket.on("video-url", ({ url }) => setVideoSrc(url || ""));
    return () => socket.off("video-url");
  }, []);

  // ── Floating Emoji Reaction Listener ────────────────────────────────────
  // Server broadcasts floating-reaction to all users; client spawns an
  // animated emoji with randomised position, size, drift and speed.
  useEffect(() => {
    socket.on("floating-reaction", ({ emoji, username }) => {
      const id       = Date.now() + Math.random();
      const x        = 8 + Math.random() * 75;           // % from left
      const duration = 2.5 + Math.random() * 1.8;       // float duration (s)
      const drift    = (Math.random() - 0.5) * 60;      // lateral drift (px)
      const size     = 2 + Math.random() * 1.2;         // emoji font-size (rem)

      setFloatingEmojis(prev => [...prev, { id, emoji, username, x, duration, drift, size }]);

      // Auto-remove after animation completes
      setTimeout(() => {
        setFloatingEmojis(prev => prev.filter(e => e.id !== id));
      }, duration * 1000 + 300);
    });
    return () => socket.off("floating-reaction");
  }, []);

  useEffect(() => {
    if (!isUsernameSet) return;

    socket.on("userJoined", (name) =>
      setMessages((prev) => [...prev, { username: "System", message: `${name} joined.` }])
    );
    socket.on("userLeft", (name) =>
      setMessages((prev) => [...prev, { username: "System", message: `${name} left.` }])
    );

    // ── ALGORITHM 1: Scheduled Play Handler ─────────────────────────────────
    // Server sends a future UTC timestamp (startAt). The client waits until
    // that exact moment to press play, ensuring all peers start simultaneously
    // regardless of individual network latencies.
    socket.on("scheduled-play", ({ time, startAt }) => {
      if (videoRef.current) {
        isSyncing.current = true;
        if (Math.abs(videoRef.current.currentTime - time) > 1) {
          videoRef.current.currentTime = time;
        }
        const delay = Math.max(0, startAt - Date.now());
        setTimeout(() => {
          videoRef.current?.play().finally(() => { isSyncing.current = false; });
          setPlaying(true);
        }, delay);
      }
    });

    // Fallback play/pause for non-creator triggered events
    socket.on("video-play", ({ time }) => {
      if (videoRef.current) {
        isSyncing.current = true;
        if (time !== undefined && Math.abs(videoRef.current.currentTime - time) > 1)
          videoRef.current.currentTime = time;
        videoRef.current.play().finally(() => { isSyncing.current = false; });
        setPlaying(true);
      }
    });

    socket.on("video-pause", ({ time }) => {
      if (videoRef.current) {
        isSyncing.current = true;
        if (time !== undefined && Math.abs(videoRef.current.currentTime - time) > 1)
          videoRef.current.currentTime = time;
        videoRef.current.pause();
        setTimeout(() => { isSyncing.current = false; }, 50);
        setPlaying(false);
      }
    });

    socket.on("video-seek", ({ time }) => {
      if (videoRef.current && time !== undefined && Math.abs(videoRef.current.currentTime - time) > 1) {
        isSyncing.current = true;
        videoRef.current.currentTime = time;
        setTimeout(() => { isSyncing.current = false; }, 50);
      }
    });

    // ── ALGORITHM 2: Drift Correction Handlers ───────────────────────────────
    // Server polls every 15s; client reports its current playback position
    socket.on("request-time", () => {
      if (videoRef.current) {
        socket.emit("report-time", { roomId: id, currentTime: videoRef.current.currentTime });
      }
    });

    // If this client is > DRIFT_THRESHOLD seconds from median, server corrects it
    socket.on("force-seek", ({ time }) => {
      if (videoRef.current) {
        isSyncing.current = true;
        videoRef.current.currentTime = time;
        setTimeout(() => { isSyncing.current = false; }, 100);
        setMessages((prev) => [
          ...prev,
          { username: "System", message: "⚡ Auto-corrected playback drift." },
        ]);
      }
    });

    socket.on("chatMessage", ({ username, message }) =>
      setMessages((prev) => [...prev, { username, message }])
    );
    socket.on("chatImage", ({ username, image }) =>
      setMessages((prev) => [...prev, { username, image }])
    );

    return () => {
      socket.off("userJoined");
      socket.off("userLeft");
      socket.off("scheduled-play");
      socket.off("video-play");
      socket.off("video-pause");
      socket.off("video-seek");
      socket.off("request-time");
      socket.off("force-seek");
      socket.off("chatMessage");
      socket.off("chatImage");
    };
  }, [isUsernameSet, id]);

  useEffect(() => {
    if (chatBoxRef.current)
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !emojiButtonRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ── Username / Genre Entry Screen ─────────────────────────────────────────
  if (!isUsernameSet) {
    return (
      <div className="username-box">
        <h1>🎬 Join the Room</h1>
        <input
          className="username-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your name"
          onKeyDown={(e) => e.key === "Enter" && handleUsernameSubmit()}
        />
        <br />
        <select className="username-input" value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">Select Genre</option>
          <option value="horror">🧟 Horror</option>
          <option value="romance">💖 Romance</option>
          <option value="action">💥 Action</option>
          <option value="comedy">😂 Comedy</option>
        </select>
        <br /><br />
        <button onClick={handleUsernameSubmit}>Join Room</button>
        {formError && <p style={{ color: "red", marginTop: "10px" }}>{formError}</p>}
      </div>
    );
  }

  const REACTION_EMOJIS = ["😂", "😱", "❤️", "🔥", "👏", "🤯", "😭", "👀"];

  // ── Main Room UI ──────────────────────────────────────────────────────────
  return (
    <div className={`room-container genre-${genre} mood-${dominantMood}`}>

      {/* ── VIDEO SECTION ── */}
      <div className="video-section">

        {/* Top bar */}
        <div className="top-bar">
          <button className="btn-secondary" onClick={handleCopyLink}>
            📋 Copy Link
          </button>
          {isCopied && <div className="copy-popup">Link copied!</div>}
          <LatencyBadge latency={latency} />
          <div className="mood-indicator">
            Mood: <strong className={`mood-label mood-${dominantMood}`}>
              {dominantMood.charAt(0).toUpperCase() + dominantMood.slice(1)}
            </strong>
          </div>
        </div>

        {/* Upload (creator only) */}
        {isRoomCreator && (
          <div className="upload-bar">
            <label htmlFor="video-upload" className="upload-label">📂 Upload Video</label>
            <input id="video-upload" type="file" accept="video/mp4" onChange={handleVideoUpload} />
          </div>
        )}

        {/* Video player wrapper — position:relative lets the overlay sit on top */}
        <div className="video-wrapper">
          <video
            ref={videoRef}
            controls
            src={videoSrc}
            className="video-player"
            onPlay={() => {
              if (!isSyncing.current && videoRef.current)
                socket.emit("play", { roomId: id, time: videoRef.current.currentTime });
              setPlaying(true);
            }}
            onPause={() => {
              if (!isSyncing.current && videoRef.current)
                socket.emit("pause", { roomId: id, time: videoRef.current.currentTime });
              setPlaying(false);
            }}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onSeeked={handleSeek}
            onLoadedMetadata={() => {}}
          />

          {/* ── Floating Emoji Overlay ───────────────────────────────────
               Rendered on top of the video, pointer-events:none so
               it never blocks video controls. */}
          <FloatingEmojiOverlay emojis={floatingEmojis} />
        </div>

        {/* ── Reaction Buttons ── */}
        <div className="reaction-bar">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              className="reaction-btn"
              onClick={() => handleReaction(emoji)}
              title={`Send ${emoji} reaction to everyone`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="video-controls-row">
          <button className="btn-primary" onClick={handlePlayPause}>
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button className="btn-secondary" onClick={handleFullscreen}>⛶ Fullscreen</button>
          <div className="video-time">⏱ {currentTime.toFixed(1)}s</div>
        </div>

        {/* Leave */}
        <div className="leave-button">
          <button className="btn-danger" onClick={handleLeaveRoom}>🚪 Leave Room</button>
        </div>
      </div>

      {/* ── CHAT SECTION ── */}
      <div className="chat-section">
        <h3>💬 Chat</h3>

        {/* Image upload */}
        <label className="img-upload-label">
          🖼 Share Image
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
        </label>

        {/* Message list */}
        <div className="chat-box" ref={chatBoxRef}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-message ${msg.username === "System" ? "system-msg" : ""}`}
            >
              {msg.image ? (
                <div>
                  <strong>{msg.username}:</strong>
                  <br />
                  <img src={msg.image} alt="shared" style={{ maxWidth: "100%", borderRadius: 6 }} />
                </div>
              ) : (
                <div>
                  <strong>{msg.username}:</strong> {msg.message}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input row */}
        <div className="chat-input-row">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type a message..."
          />
          <button ref={emojiButtonRef} onClick={() => setShowEmojiPicker((p) => !p)}>😀</button>
          <button className="btn-primary" onClick={handleSendMessage}>Send</button>
          {showEmojiPicker && (
            <div ref={emojiPickerRef} style={{ position: "absolute", bottom: "50px", right: 0, zIndex: 2 }}>
              <EmojiPicker onEmojiClick={(d) => setMessage((p) => p + d.emoji)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Room;
