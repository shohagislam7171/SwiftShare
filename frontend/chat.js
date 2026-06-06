/**
 * SwiftShare - Premium SaaS Chat Application
 * File: chat.js
 * Description: Handles UI interactions for the chat interface, sidebar,
 * message formatting, and search functionality.
 */

window.ChatUIController = (function() {
    // --- 1. DOM Elements ---
    const UI = {
        // Sidebar Elements
        contactList: document.getElementById('contactList'),
        searchInput: document.getElementById('searchInput'),
        
        // Chat Area Elements
        idleChatView: document.getElementById('idleChatView'),
        activeChatView: document.getElementById('activeChatView'),
        peerName: document.getElementById('peerName'),
        peerAvatar: document.getElementById('peerAvatar'),
        peerStatus: document.getElementById('peerStatus'),
        messagesBoard: document.getElementById('messagesBoard'),
        
        // Input Controls
        messageTextBox: document.getElementById('messageTextBox'),
        sendMsgBtn: document.getElementById('sendMsgBtn'),
        fileInput: document.getElementById('fileInput'),
        
        // Call Buttons
        startAudioCallBtn: document.getElementById('startAudioCallBtn'),
        startVideoCallBtn: document.getElementById('startVideoCallBtn')
    };

    // --- State ---
    let activeChatId = null;
    let chatHistoryCache = {}; // Stores messages by peer ID
    let currentTheme = 'dark'; // Placeholder for future theme switching

    // --- 2. Initialize Chat Interface ---
    function init(userData) {
        // Fetch existing chats from backend (Simulated)
        loadRecentChats();
        
        // Setup Event Listeners
        setupEventListeners();
    }

    // --- 3. Sidebar Logic ---
    function loadRecentChats() {
        // Simulated data - in reality, fetch from Cloudflare D1
        const dummyChats = [
            { id: 'user_101', name: 'Alif Rahman', avatar: '', lastMsg: 'Project file sent.', time: '10:30 AM', unread: 2 },
            { id: 'user_102', name: 'Sarah Jane', avatar: '', lastMsg: 'Let's hop on a quick call.', time: 'Yesterday', unread: 0 },
            { id: 'user_103', name: 'Design Team', avatar: '', lastMsg: 'The new UI looks great!', time: 'Monday', unread: 0 }
        ];

        renderContactList(dummyChats);
    }

    function renderContactList(chats) {
        UI.contactList.innerHTML = '';
        
        if(chats.length === 0) {
            UI.contactList.innerHTML = `<div class="empty-state-list"><p>No active chats yet. Search to start messaging.</p></div>`;
            return;
        }

        chats.forEach(chat => {
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name)}&background=random`;
            const avatarSrc = chat.avatar || defaultAvatar;

            const chatEl = document.createElement('div');
            chatEl.className = `chat-item ${chat.id === activeChatId ? 'active-chat-item' : ''}`;
            chatEl.dataset.id = chat.id;
            chatEl.dataset.name = chat.name;
            chatEl.dataset.avatar = avatarSrc;

            chatEl.innerHTML = `
                <img src="${avatarSrc}" alt="${chat.name}" class="avatar">
                <div class="chat-item-info">
                    <div class="chat-item-header">
                        <span class="chat-item-name">${chat.name}</span>
                        <span class="chat-item-time">${chat.time}</span>
                    </div>
                    <div class="chat-item-last-msg">${chat.lastMsg}</div>
                </div>
                ${chat.unread > 0 ? `<div class="unread-badge">${chat.unread}</div>` : ''}
            `;

            chatEl.addEventListener('click', () => openChat(chat));
            UI.contactList.appendChild(chatEl);
        });
    }

    // Search functionality
    UI.searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = UI.contactList.querySelectorAll('.chat-item');
        
        items.forEach(item => {
            const name = item.dataset.name.toLowerCase();
            if(name.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // --- 4. Chat Window Logic ---
    function openChat(peerData) {
        activeChatId = peerData.id;
        
        // Update UI
        UI.idleChatView.classList.add('hidden');
        UI.activeChatView.classList.remove('hidden');
        
        UI.peerName.textContent = peerData.name;
        UI.peerAvatar.src = peerData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(peerData.name)}&background=random`;
        UI.peerStatus.textContent = 'Online'; // In reality, determine based on WebSocket presence
        
        // Highlight active item in sidebar
        document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active-chat-item'));
        const activeEl = document.querySelector(`.chat-item[data-id="${activeChatId}"]`);
        if(activeEl) activeEl.classList.add('active-chat-item');

        // Load Messages
        loadMessages(activeChatId);
    }

    function loadMessages(peerId) {
        UI.messagesBoard.innerHTML = '';
        
        // Retrieve from cache or fetch from DB
        const messages = chatHistoryCache[peerId] || [
            { text: 'Hey there! How is the new app coming along?', sender: 'peer', time: '10:00 AM' },
            { text: 'It is looking amazing! The glassmorphism UI is super sleek.', sender: 'me', time: '10:05 AM' }
        ];

        messages.forEach(msg => appendMessageToUI(msg));
        scrollToBottom();
    }

    function appendMessageToUI(msgData) {
        const isOutgoing = msgData.sender === 'me';
        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
        
        let contentHTML = '';
        
        if (msgData.type === 'file') {
            // File Rendering Logic
            contentHTML = `
                <div class="msg-bubble file-bubble">
                    <div class="file-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                    </div>
                    <div class="file-details">
                        <span class="file-name">${msgData.fileName}</span>
                        <span class="file-size">${msgData.fileSize}</span>
                    </div>
                </div>`;
        } else {
            // Text Rendering Logic
            contentHTML = `<div class="msg-bubble">${escapeHTML(msgData.text)}</div>`;
        }
        
        wrapper.innerHTML = `
            ${contentHTML}
            <span class="msg-time">${msgData.time || getCurrentTime()}</span>
        `;
        
        UI.messagesBoard.appendChild(wrapper);
        scrollToBottom();
    }

    // --- 5. Message Sending Logic ---
    function handleSendMessage() {
        if(!activeChatId) return;

        const text = UI.messageTextBox.value.trim();
        if(!text) return;

        const msgData = {
            id: Date.now().toString(),
            text: text,
            sender: 'me',
            time: getCurrentTime(),
            type: 'text'
        };

        // 1. Update UI Immediately (Optimistic UI)
        appendMessageToUI(msgData);
        
        // 2. Clear Input
        UI.messageTextBox.value = '';
        UI.messageTextBox.style.height = 'auto'; // reset height
        
        // 3. Save to Cache
        if(!chatHistoryCache[activeChatId]) chatHistoryCache[activeChatId] = [];
        chatHistoryCache[activeChatId].push(msgData);

        // 4. Send via WebSocket (Delegated to websocket.js)
        if(window.SocketEngine) {
            window.SocketEngine.sendMessage(activeChatId, msgData);
        }
    }

    function setupEventListeners() {
        // Send Button
        UI.sendMsgBtn.addEventListener('click', handleSendMessage);
        
        // Enter Key to Send
        UI.messageTextBox.addEventListener('keydown', (e) => {
            if(e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        // Auto-resize textarea
        UI.messageTextBox.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            scrollToBottom();
        });

        // File Selection Dummy Handler
        UI.fileInput.addEventListener('change', (e) => {
            if(e.target.files.length > 0 && activeChatId) {
                const file = e.target.files[0];
                const fileMsg = {
                    fileName: file.name,
                    fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                    sender: 'me',
                    type: 'file',
                    time: getCurrentTime()
                };
                appendMessageToUI(fileMsg);
                // Trigger WebRTC file transfer mechanism here
            }
        });

        // Call Buttons
        UI.startVideoCallBtn.addEventListener('click', () => {
            if(window.MediaEngine && activeChatId) {
                window.MediaEngine.initiateCall(activeChatId, true);
            }
        });

        UI.startAudioCallBtn.addEventListener('click', () => {
            if(window.MediaEngine && activeChatId) {
                window.MediaEngine.initiateCall(activeChatId, false);
            }
        });
    }

    // --- Utility Functions ---
    function scrollToBottom() {
        UI.messagesBoard.scrollTop = UI.messagesBoard.scrollHeight;
    }

    function getCurrentTime() {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; 
        minutes = minutes < 10 ? '0'+minutes : minutes;
        return hours + ':' + minutes + ' ' + ampm;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Public API Exposed to other modules
    return {
        init: init,
        receiveMessage: function(senderId, msgData) {
            // Store in cache
            if(!chatHistoryCache[senderId]) chatHistoryCache[senderId] = [];
            chatHistoryCache[senderId].push(msgData);

            // If chat is open, display it
            if(activeChatId === senderId) {
                appendMessageToUI(msgData);
            } else {
                // Otherwise, update badge count in sidebar
                console.log(`New unread message from ${senderId}`);
                // Add logic to increment unread counter on the specific chat item
            }
        }
    };
})();