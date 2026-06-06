/**
 * SwiftShare - Premium SaaS Chat Application
 * File: src/chat.js
 * Description: Cloudflare Durable Objects for Real-Time Chat & Signaling.
 */

export class ChatRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map();
    }

    async fetch(request) {
        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("Expected Upgrade: websocket", { status: 426 });
        }

        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const userId = url.searchParams.get("userId");

        if (!token || !userId) {
            return new Response("Authentication required", { status: 401 });
        }

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        server.accept();

        const sessionData = { socket: server, userId: userId };
        this.sessions.set(userId, sessionData);

        this.broadcastPresence(userId, 'online');

        server.addEventListener("message", async (event) => {
            try {
                const message = JSON.parse(event.data);
                await this.handleIncomingMessage(userId, message);
            } catch (err) {
                console.error("Error parsing WebSocket message:", err);
            }
        });

        server.addEventListener("close", () => {
            this.handleDisconnect(userId);
        });

        server.addEventListener("error", () => {
            this.handleDisconnect(userId);
        });

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

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
                
                // 2. Save message to D1 Database
                try {
                    await this.env.DB.prepare(
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
                    ).run();
                } catch (err) {
                    console.error("DB Insert Error:", err);
                }
                break;

            case 'send-signal':
                this.routeToPeer(senderId, targetId, {
                    type: data.type,
                    senderId: senderId,
                    data: data
                });
                break;
                
            default:
                console.warn("Unknown action received:", action);
        }
    }

    routeToPeer(senderId, targetId, payload) {
        const targetSession = this.sessions.get(targetId);
        if (targetSession && targetSession.socket.readyState === WebSocket.OPEN) {
            targetSession.socket.send(JSON.stringify(payload));
        } else {
            if(payload.type.startsWith('call-') || payload.type === 'ice-candidate') {
                 const senderSession = this.sessions.get(senderId);
                 if(senderSession && senderSession.socket.readyState === WebSocket.OPEN) {
                     senderSession.socket.send(JSON.stringify({
                         type: 'call-rejected', 
                         senderId: targetId,
                         data: { reason: 'User is currently offline' }
                     }));
                 }
            }
        }
    }

    handleDisconnect(userId) {
        this.sessions.delete(userId);
        this.broadcastPresence(userId, 'offline');
    }

    broadcastPresence(userId, status) {
        const payload = JSON.stringify({
            type: 'presence-update',
            userId: userId,
            status: status
        });

        for (const [id, session] of this.sessions) {
            if (id !== userId && session.socket.readyState === WebSocket.OPEN) {
                session.socket.send(payload);
            }
        }
    }
}