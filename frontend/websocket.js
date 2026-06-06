/**
 * SwiftShare - Premium SaaS Chat & Calling Application
 * File: websocket.js
 * Description: Client-side WebSocket engine for real-time communication.
 * Connects to Cloudflare Durable Objects to route messages and WebRTC signals.
 */

window.SocketEngine = (function() {
    // --- 1. State Variables ---
    let socket = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000; // 3 seconds
    
    // TODO: Replace this with your actual Cloudflare Worker WebSocket URL later
    const WEBSOCKET_URL = 'wss://swiftshare-backend.mdshohagislam30.workers.dev/';

    // --- 2. Initialization & Connection ---
    function init(userData) {
        if (!userData || !userData.id) {
            console.error('Cannot initialize WebSocket: User data missing.');
            return;
        }
        connect(userData);
    }

    function connect(userData) {
        // Retrieve token for authentication
        const token = localStorage.getItem('swiftshare_token');
        if (!token) return;

        // Append token and user ID to URL for secure connection
        const connectionUrl = `${WEBSOCKET_URL}?token=${token}&userId=${userData.id}`;
        
        socket = new WebSocket(connectionUrl);

        // --- Event Listeners ---
        socket.onopen = () => {
            console.log('🟢 Connected to SwiftShare Secure Server');
            reconnectAttempts = 0; // Reset attempts on successful connection
            
            // Optional: Update UI to show "Online" status globally
            const myStatus = document.querySelector('.my-status');
            if(myStatus) {
                myStatus.textContent = 'Online';
                myStatus.style.color = 'var(--color-success)';
            }
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                routeIncomingData(data);
            } catch (error) {
                console.error('Error parsing incoming WebSocket message:', error);
            }
        };

        socket.onclose = (event) => {
            console.log('🔴 Disconnected from Server', event.reason);
            updateStatusToOffline();
            attemptReconnect(userData);
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            socket.close(); // Force close to trigger reconnect
        };
    }

    // --- 3. Reconnection Logic ---
    function attemptReconnect(userData) {
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`⏳ Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
            setTimeout(() => connect(userData), reconnectDelay);
        } else {
            console.error('❌ Max reconnection attempts reached. Please refresh the page.');
            alert('Connection lost. Please check your internet or refresh the page.');
        }
    }

    function updateStatusToOffline() {
        const myStatus = document.querySelector('.my-status');
        if(myStatus) {
            myStatus.textContent = 'Offline';
            myStatus.style.color = 'var(--text-muted)';
        }
    }

    // --- 4. Data Router (The Brain) ---
    function routeIncomingData(payload) {
        const { type, senderId, data } = payload;

        switch (type) {
            // Text or File Message
            case 'chat-message':
                if (window.ChatUIController) {
                    window.ChatUIController.receiveMessage(senderId, data);
                }
                break;

            // WebRTC Call Initiation (Incoming Call)
            case 'call-offer':
                if (window.MediaEngine) {
                    // Pass the offer details to media.js
                    window.MediaEngine.handleIncomingCall({
                        callerId: senderId,
                        callerName: data.callerName,
                        callerAvatar: data.callerAvatar,
                        isVideo: data.isVideo,
                        offer: data.offer
                    });
                }
                break;

            // WebRTC Signaling (Answers, ICE Candidates, Hang-ups)
            case 'call-answer':
            case 'ice-candidate':
            case 'call-rejected':
            case 'call-ended':
                if (window.MediaEngine) {
                    // Let media.js handle the WebRTC handshake continuation
                    window.MediaEngine.processSignal({
                        type: type,
                        ...data
                    });
                }
                break;

            default:
                console.warn('Received unknown message type:', type);
        }
    }

    // --- 5. Outgoing Transmitters ---
    
    // Send standard chat message
    function sendMessage(targetUserId, messageData) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            const payload = {
                action: 'send-message',
                targetId: targetUserId,
                data: messageData
            };
            socket.send(JSON.stringify(payload));
        } else {
            console.error('Cannot send message: WebSocket is not open.');
            // Implement logic to save to an outbox queue if offline
        }
    }

    // Send WebRTC signals for audio/video calls
    function sendCallSignal(targetUserId, signalData) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            const payload = {
                action: 'send-signal',
                targetId: targetUserId,
                data: signalData
            };
            socket.send(JSON.stringify(payload));
        } else {
            console.error('Cannot send call signal: WebSocket is not open.');
        }
    }

    // Clean Disconnect (Used when user logs out)
    function disconnect() {
        if (socket) {
            // Setting a flag so it doesn't try to auto-reconnect on intentional logout
            reconnectAttempts = maxReconnectAttempts; 
            socket.close();
            socket = null;
        }
    }

    // --- Public API ---
    return {
        init,
        sendMessage,
        sendCallSignal,
        disconnect
    };
})();