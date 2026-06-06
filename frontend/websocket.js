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
        setupSearchBox(); // সার্চ বার ইনিশিয়ালাইজ করা হলো
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
    // Search Functionality (Updated with UI Fixes)
    // ==========================================
    function setupSearchBox() {
        const searchInput = document.getElementById('searchInput'); 
        const searchResultsContainer = document.getElementById('contactList'); 
        
        if (!searchInput) return;

        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                // সার্চ বার খালি থাকলে আগের চ্যাট লিস্ট ফেরত আনবে
                if(query.length === 0 && window.ChatUIController) {
                     window.ChatUIController.restoreActiveChats();
                }
                return; 
            }

            searchTimeout = setTimeout(async () => {
                searchResultsContainer.innerHTML = `<div style="text-align:center; padding:10px; color:var(--text-muted);">Searching...</div>`;
                
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
                        searchResultsContainer.innerHTML = `<div class="empty-state-list" style="text-align: center; padding: 20px; color: var(--text-muted);"><p>No users found for "${query}"</p></div>`;
                    }

                } catch (error) {
                    console.error("Search failed:", error);
                    searchResultsContainer.innerHTML = `<div class="empty-state-list" style="text-align: center; padding: 20px; color: var(--color-danger);"><p>Search error. Try again.</p></div>`;
                }
            }, 500);
        });
    }

    function displaySearchResults(users, container) {
        if (!container) return;
        container.innerHTML = ''; 

        // বর্তমান লগিন করা ইউজারের ID বাদ দিয়ে অন্যদের দেখাবে
        let myUserId = null;
        try {
            const userData = JSON.parse(localStorage.getItem('swiftshare_user'));
            myUserId = userData?.id;
        } catch (e) {
            console.error("Error parsing user data");
        }

        const filteredUsers = users.filter(user => user.id !== myUserId);

        if(filteredUsers.length === 0) {
             container.innerHTML = `<div class="empty-state-list" style="text-align: center; padding: 20px; color: var(--text-muted);"><p>No other users found.</p></div>`;
             return;
        }

        filteredUsers.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'chat-item'; // index.html এর CSS ক্লাস অনুযায়ী
            
            const avatarSrc = user.profile_pic && user.profile_pic !== 'default.jpg' 
                                ? user.profile_pic 
                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;

            userDiv.innerHTML = `
                <img src="${avatarSrc}" alt="${user.name}" class="avatar">
                <div class="chat-item-info">
                    <div class="chat-item-header">
                        <span class="chat-item-name">${user.name}</span>
                    </div>
                    <div class="chat-item-last-msg" style="font-size: 0.8rem;">@${user.username}</div>
                </div>
            `;
            
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