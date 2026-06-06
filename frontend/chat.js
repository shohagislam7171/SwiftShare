/**
 * SwiftShare - Premium SaaS Chat Application
 * File: chat.js
 */

window.ChatUIController = (function() {
    // --- 1. DOM Elements ---
    const UI = {
        contactList: document.getElementById('contactList'),
        searchInput: document.getElementById('searchInput'),
        
        idleChatView: document.getElementById('idleChatView'),
        activeChatView: document.getElementById('activeChatView'),
        peerName: document.getElementById('peerName'),
        peerAvatar: document.getElementById('peerAvatar'),
        peerStatus: document.getElementById('peerStatus'),
        messagesBoard: document.getElementById('messagesBoard'),
        
        messageTextBox: document.getElementById('messageTextBox'),
        sendMsgBtn: document.getElementById('sendMsgBtn'),
        fileInput: document.getElementById('fileInput'),
        
        startAudioCallBtn: document.getElementById('startAudioCallBtn'),
        startVideoCallBtn: document.getElementById('startVideoCallBtn')
    };

    let activeChatId = null;
    let chatHistoryCache = {}; 
    let activeChatUsers = new Map(); // Store full user info for active chats

    // --- 2. Initialize Chat Interface ---
    function init(userData) {
        // শুরুতে লিস্ট ফাঁকা থাকবে বা লোকাল স্টোরেজ থেকে রিসেন্ট চ্যাট লোড হবে
        renderContactList([]);
        setupEventListeners();
    }

    // --- 3. Sidebar Logic ---
    function renderContactList(chats) {
        UI.contactList.innerHTML = '';
        
        if(chats.length === 0) {
            UI.contactList.innerHTML = `<div class="empty-state-list" style="text-align: center; padding: 20px; color: var(--text-muted);"><p>Search for a mobile number or username to start chatting.</p></div>`;
            return;
        }

        chats.forEach(chat => {
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name)}&background=random`;
            const avatarSrc = chat.avatar || defaultAvatar;

            const chatEl = document.createElement('div');
            chatEl.className = `chat-item ${chat.id === activeChatId ? 'active-chat-item' : ''}`;
            chatEl.dataset.id = chat.id;

            chatEl.innerHTML = `
                <img src="${avatarSrc}" alt="${chat.name}" class="avatar">
                <div class="chat-item-info">
                    <div class="chat-item-header">
                        <span class="chat-item-name">${chat.name}</span>
                    </div>
                </div>
            `;

            chatEl.addEventListener('click', () => openChat(chat));
            UI.contactList.appendChild(chatEl);
        });
    }

    // --- 4. Chat Window Logic ---
    // নতুন ইউজারকে সার্চ করে ক্লিক করলে এই ফাংশনটি কল হবে (websocket.js থেকে)
    function openChatWithUser(user) {
        const chatData = {
            id: user.id,
            name: user.name,
            avatar: user.profile_pic
        };
        
        // লিস্টে না থাকলে যোগ করো
        if (!activeChatUsers.has(user.id)) {
            activeChatUsers.set(user.id, chatData);
            renderContactList(Array.from(activeChatUsers.values()));
        }
        
        openChat(chatData);
        UI.searchInput.value = ''; // সার্চ ক্লিয়ার করো
    }

    function openChat(peerData) {
        activeChatId = peerData.id;
        
        UI.idleChatView.classList.add('hidden');
        UI.activeChatView.classList.remove('hidden');
        
        UI.peerName.textContent = peerData.name;
        UI.peerAvatar.src = peerData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(peerData.name)}&background=random`;
        UI.peerStatus.textContent = 'Online'; 
        
        document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active-chat-item'));
        const activeEl = document.querySelector(`.chat-item[data-id="${activeChatId}"]`);
        if(activeEl) activeEl.classList.add('active-chat-item');

        loadMessages(activeChatId);
    }

    function loadMessages(peerId) {
        UI.messagesBoard.innerHTML = '';
        const messages = chatHistoryCache[peerId] || [];
        messages.forEach(msg => appendMessageToUI(msg));
        scrollToBottom();
    }

    function appendMessageToUI(msgData) {
        const isOutgoing = msgData.sender === 'me';
        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
        
        let contentHTML = '';
        if (msgData.type === 'file') {
            contentHTML = `
                <div class="msg-bubble file-bubble">
                    <div class="file-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                    </div>
                    <div class="file-details">
                        <span class="file-name">${msgData.fileName}</span>
                        <span class="file-size">${msgData.fileSize}</span>
                    </div>
                </div>`;
        } else {
            contentHTML = `<div class="msg-bubble">${escapeHTML(msgData.text)}</div>`;
        }
        
        wrapper.innerHTML = `${contentHTML}<span class="msg-time">${msgData.time || getCurrentTime()}</span>`;
        
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

        appendMessageToUI(msgData);
        
        UI.messageTextBox.value = '';
        UI.messageTextBox.style.height = 'auto'; 
        
        if(!chatHistoryCache[activeChatId]) chatHistoryCache[activeChatId] = [];
        chatHistoryCache[activeChatId].push(msgData);

        if(window.SocketEngine) {
            window.SocketEngine.sendMessage(activeChatId, msgData);
        }
    }

    function setupEventListeners() {
        UI.sendMsgBtn.addEventListener('click', handleSendMessage);
        
        UI.messageTextBox.addEventListener('keydown', (e) => {
            if(e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        UI.messageTextBox.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            scrollToBottom();
        });

        // Search Bar Event (Local filtering for active chats)
        UI.searchInput.addEventListener('input', (e) => {
             const term = e.target.value.toLowerCase();
             if (term.length === 0) {
                 renderContactList(Array.from(activeChatUsers.values()));
             }
        });

        // File Selection Handler
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
            }
        });

        // Call Buttons Logic
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
        hours = hours % 12 || 12; 
        minutes = minutes < 10 ? '0'+minutes : minutes;
        return hours + ':' + minutes + ' ' + ampm;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    // Public API
    return {
        init: init,
        openChatWith: openChatWithUser,
        
        // সার্চ বার ক্লিয়ার করলে আগের চ্যাট ফেরত আনার জন্য নতুন ফাংশন
        restoreActiveChats: function() {
            renderContactList(Array.from(activeChatUsers.values()));
        },
        
        receiveMessage: function(senderId, msgData) {
            if(!chatHistoryCache[senderId]) chatHistoryCache[senderId] = [];
            chatHistoryCache[senderId].push(msgData);

            if(activeChatId === senderId) {
                appendMessageToUI(msgData);
            }
        }
    };
})();