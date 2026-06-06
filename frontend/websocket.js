/**
 * SwiftShare - Premium SaaS Chat & Calling Application
 * File: websocket.js
 */

window.SocketEngine = (function() {
    let socket = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000; 
    
    // তোমার বর্তমান Cloudflare Worker URL
    const API_BASE_URL = 'https://swiftshare-backend.mdshohagislam30.workers.dev';
    const WEBSOCKET_URL = 'wss://swiftshare-backend.mdshohagislam30.workers.dev/chat';

    function init(userData) {
        if (!userData || !userData.id) {
            console.error('Cannot initialize WebSocket: User data missing.');
            return;
        }
        connect(userData);
        setupSearchBox(); // সার্চ বার ইনিশিয়ালাইজ করা হলো
    }

    function connect(userData) {
        const token = localStorage.getItem('swiftshare_token');
        if (!token) return;

        const connectionUrl = `${WEBSOCKET_URL}?token=${token}&userId=${userData.id}`;
        
        socket = new WebSocket(connectionUrl);

        socket.onopen = () => {
            console.log('🟢 Connected to SwiftShare Secure Server');
            reconnectAttempts = 0; 
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
                console.error('Error parsing message:', error);
            }
        };

        socket.onclose = (event) => {
            console.log('🔴 Disconnected from Server', event.reason);
            updateStatusToOffline();
            attemptReconnect(userData);
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            socket.close(); 
        };
    }

    function attemptReconnect(userData) {
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`⏳ Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
            setTimeout(() => connect(userData), reconnectDelay);
        } else {
            console.error('❌ Max reconnection attempts reached.');
        }
    }

    function updateStatusToOffline() {
        const myStatus = document.querySelector('.my-status');
        if(myStatus) {
            myStatus.textContent = 'Offline';
            myStatus.style.color = 'var(--text-muted)';
        }
    }

    // ==========================================
    // নতুন Search Functionality 
    // ==========================================
    function setupSearchBox() {
        const searchInput = document.querySelector('.search-bar input'); // তোমার HTML এর সার্চ বারের সিলেক্টর
        const searchResultsContainer = document.querySelector('.contact-list'); // যেখানে রেজাল্ট দেখাবে
        
        if (!searchInput) return;

        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                // ৩ অক্ষরের কম হলে সার্চ করবে না, আগের লিস্ট দেখাবে
                return; 
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });

                const data = await response.json();

                if (data.success && data.users.length > 0) {
                    displaySearchResults(data.users, searchResultsContainer);
                } else {
                    searchResultsContainer.innerHTML = `<div class="no-results">No users found for "${query}"</div>`;
                }

            } catch (error) {
                console.error("Search failed:", error);
            }
        });
    }

    function displaySearchResults(users, container) {
        if (!container) return;
        
        container.innerHTML = ''; // আগের লিস্ট ক্লিয়ার করা

        users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'contact-item'; // তোমার CSS ক্লাস অনুযায়ী
            userDiv.innerHTML = `
                <img src="${user.profile_pic || 'default.jpg'}" alt="${user.name}" class="contact-avatar">
                <div class="contact-info">
                    <h4>${user.name}</h4>
                    <p>@${user.username}</p>
                </div>
            `;
            
            // ক্লিক করলে চ্যাট ওপেন হবে
            userDiv.addEventListener('click', () => {
                if(window.ChatUIController) {
                    window.ChatUIController.openChatWith(user);
                }
            });

            container.appendChild(userDiv);
        });
    }

    function routeIncomingData(payload) {
        const { type, senderId, data } = payload;
        switch (type) {
            case 'chat-message':
                if (window.ChatUIController) window.ChatUIController.receiveMessage(senderId, data);
                break;
            case 'call-offer':
                if (window.MediaEngine) window.MediaEngine.handleIncomingCall({...data, callerId: senderId});
                break;
            case 'call-answer':
            case 'ice-candidate':
            case 'call-rejected':
            case 'call-ended':
                if (window.MediaEngine) window.MediaEngine.processSignal({ type, ...data });
                break;
        }
    }

    function sendMessage(targetUserId, messageData) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'send-message', targetId: targetUserId, data: messageData }));
        }
    }

    function sendCallSignal(targetUserId, signalData) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'send-signal', targetId: targetUserId, data: signalData }));
        }
    }

    function disconnect() {
        if (socket) {
            reconnectAttempts = maxReconnectAttempts; 
            socket.close();
            socket = null;
        }
    }

    return { init, sendMessage, sendCallSignal, disconnect };
})();