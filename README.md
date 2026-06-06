# 🚀 SwiftShare - Premium SaaS Chat & Calling App

SwiftShare is a cutting-edge, ultra-modern Peer-to-Peer (P2P) network application designed to facilitate instantaneous, secure file transfers, real-time chat, and HD video/audio calling. Built entirely on the Cloudflare Serverless ecosystem.

## ✨ Core Features

* **Real-Time Messaging:** Instant message delivery using Cloudflare Durable Objects and WebSockets.
* **HD Video & Audio Calls:** Direct peer-to-peer media streaming powered by WebRTC.
* **Cloud Database:** Persistent chat history and user profiles stored in Cloudflare D1 (SQLite).
* **Profile & File Storage:** Fast and secure media storage using Cloudflare R2 Buckets.
* **Premium UI/UX:** Aesthetic glassmorphism design with a native dark mode, fully responsive across all devices.
* **Offline Support:** Messages sent to offline users are securely stored and delivered upon next login.

## 🛠️ Technology Stack

**Frontend:**
* HTML5, CSS3 (Glassmorphism UI)
* Vanilla JavaScript (ES6+)
* WebRTC (RTCPeerConnection, MediaStream API)
* Native WebSockets

**Backend:**
* Cloudflare Workers (Serverless API)
* Cloudflare Durable Objects (WebSocket Connection Manager)
* Cloudflare D1 (Relational SQL Database)
* Cloudflare R2 (Object Storage for Images/Files)

## 📂 Project Structure

```text
SwiftShare/
├── frontend/
│   ├── index.html        # Main Application UI
│   ├── style.css         # Premium Glassmorphism Styles
│   ├── auth.js           # Login/Signup Logic
│   ├── chat.js           # Chat Interface & UI State
│   ├── media.js          # WebRTC Video/Audio Engine
│   └── websocket.js      # Real-Time Cloudflare Socket Connection
├── backend/
│   ├── src/
│   │   ├── index.js      # Worker Entry & Auth API
│   │   └── chat.js       # Durable Objects Logic
│   ├── schema.sql        # Database Table Structures
│   ├── package.json      # Dependencies & Scripts
│   └── wrangler.toml     # Cloudflare Configuration
├── .gitignore
└── README.md