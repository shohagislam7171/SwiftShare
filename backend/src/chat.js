/**
 * SwiftShare - Premium SaaS Chat Application
 * File: src/chat.js
 * Description: Cloudflare Durable Objects for Real-Time Chat & Signaling.
 * Manages active WebSocket connections, routes messages, and handles WebRTC signals.
 */

export class ChatRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        // Store connected WebSockets and their associated user IDs
        // Map: userId -> { socket, ...userData }
        this.sessions = new Map();
    }

    async fetch(request) {
        // Only accept WebSocket upgrades
        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("Expected Upgrade: websocket", { status: 426 });
        }

        // Parse query parameters for authentication
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const userId = url.searchParams.get("userId");

        if (!token || !userId) {
            return new Response("Authentication required", { status: 401 });
        }

        // TODO: Validate Token (In production, use JWT verification here)
        // For now, we trust the token if it exists

        // Create the WebSocket pair (client and server ends)
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        // Accept the WebSocket connection on the server side
        server.accept();

        // Add the new connection to our session map
        const sessionData = { socket: server, userId: userId };
        this.sessions.set(userId, sessionData);

        // Notify others that this user is online (Optional but good for UX)
        this.broadcastPresence(userId, 'online');

        // Handle incoming messages from this client
        server.addEventListener("message", async (event) => {
            try {
                const message = JSON.parse(event.data);
                await this.handleIncomingMessage(userId, message);
            } catch (err) {
                console.error("Error parsing WebSocket message:", err);
            }
        });

        // Handle client disconnects
        server.addEventListener("close", () => {
            this.handleDisconnect(userId);
        });

        server.addEventListener("error", () => {
            this.handleDisconnect(userId);
        });

        // Return the client end to the caller
        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    /**
     * Route messages based on their action type
     */
    async handleIncomingMessage(senderId, payload) {
        const { action, targetId, data } = payload;

        if (!targetId || !data) return;

        switch (action) {
            case 'send-message':
                // 1. Send real-time message to target if online
                this.routeToPeer(senderId, targetId, {
                    type: 'chat-message',
                    senderId: senderId,
                    data: data
                });
                
                // 2. Save message to D1 Database (Background task)
                this.env.DB.prepare(
                    `INSERT INTO Messages (id, sender_id, receiver_id, message_type, content, file_name, file_size)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    data.id || crypto.randomUUID(), 
                    senderId, 
                    targetId, 
                    data.type || 'text', 
                    data.text || '', 
                    data.fileName || null, 
                    data.fileSize || null
                ).run().catch(err => console.error("DB Insert Error:", err));
                break;

            case 'send-signal':
                // Route WebRTC signaling data directly to the target peer
                // This includes call offers, answers, and ICE candidates
                this.routeToPeer(senderId, targetId, {
                    type: data.type,
                    senderId: senderId,
                    data: data
                });

                // Optional: Log call attempts to database
                if(data.type === 'call-offer') {
                    this.env.DB.prepare(
                        `INSERT INTO Call_History (id, caller_id, receiver_id, call_type, status)
                         VALUES (?, ?, ?, ?, ?)`
                    ).bind(crypto.randomUUID(), senderId, targetId, data.isVideo ? 'video' : 'audio', 'initiated')
                    .run().catch(err => console.error("Call Log Error:", err));
                }
                break;
                
            default:
                console.warn("Unknown action received:", action);
        }
    }

    /**
     * Send a message to a specific user if they are connected
     */
    routeToPeer(senderId, targetId, payload) {
        const targetSession = this.sessions.get(targetId);
        if (targetSession && targetSession.socket.readyState === WebSocket.OPEN) {
            targetSession.socket.send(JSON.stringify(payload));
        } else {
            // Target is offline. 
            // For chat-message, it's already saved to DB, so they'll get it on next login.
            // For call signals, we might want to send a 'peer-offline' message back to sender.
            if(payload.type.startsWith('call-') || payload.type === 'ice-candidate') {
                 const senderSession = this.sessions.get(senderId);
                 if(senderSession && senderSession.socket.readyState === WebSocket.OPEN) {
                     senderSession.socket.send(JSON.stringify({
                         type: 'call-rejected', // Or 'peer-offline'
                         senderId: targetId,
                         data: { reason: 'User is currently offline' }
                     }));
                 }
            }
        }
    }

    /**
     * Handle cleanup when a user disconnects
     */
    handleDisconnect(userId) {
        this.sessions.delete(userId);
        this.broadcastPresence(userId, 'offline');
    }

    /**
     * Optional: Tell everyone that a user is online/offline
     */
    broadcastPresence(userId, status) {
        const payload = JSON.stringify({
            type: 'presence-update',
            userId: userId,
            status: status
        });

        // In a large app, you wouldn't broadcast to EVERYONE, 
        // just to the people in the user's contact list.
        for (const [id, session] of this.sessions) {
            if (id !== userId && session.socket.readyState === WebSocket.OPEN) {
                session.socket.send(payload);
            }
        }
    }
}