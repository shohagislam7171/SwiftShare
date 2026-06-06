/**
 * SwiftShare - Premium SaaS Chat & Calling Application
 * File: media.js
 * Description: Core WebRTC engine for handling Audio and Video calls.
 * Manages device media streams, peer connections, and call UI states.
 */

window.MediaEngine = (function() {
    // --- 1. DOM Elements ---
    const UI = {
        callModal: document.getElementById('callModal'),
        callStatusText: document.getElementById('callStatusText'),
        localVideo: document.getElementById('localVideo'),
        remoteVideo: document.getElementById('remoteVideo'),
        remoteVideoLabel: document.getElementById('remoteVideoLabel'),
        
        // Call Controls
        toggleAudioBtn: document.getElementById('toggleAudioBtn'),
        toggleVideoBtn: document.getElementById('toggleVideoBtn'),
        endCallBtn: document.getElementById('endCallBtn'),
        
        // Incoming Call Alert
        incomingCallAlert: document.getElementById('incomingCallAlert'),
        callerAvatar: document.getElementById('callerAvatar'),
        callerName: document.getElementById('callerName'),
        callTypeLabel: document.getElementById('callType'),
        acceptCallBtn: document.getElementById('acceptCallBtn'),
        rejectCallBtn: document.getElementById('rejectCallBtn')
    };

    // --- 2. State Variables ---
    let localStream = null;
    let remoteStream = null;
    let peerConnection = null;
    let currentPeerId = null;
    let isVideoCall = true;
    let isAudioMuted = false;
    let isVideoMuted = false;
    let incomingOffer = null; // Stores offer until accepted

    // WebRTC Configuration (Google STUN for public routing)
    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    // --- 3. Core Call Initialization ---

    // Step A: Initiate a call to someone
    async function initiateCall(targetId, withVideo) {
        currentPeerId = targetId;
        isVideoCall = withVideo;
        
        // Update UI
        showCallModal(`Calling...`);
        if (!withVideo) UI.localVideo.classList.add('hidden');
        else UI.localVideo.classList.remove('hidden');

        try {
            // Request camera/mic permissions
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: withVideo, 
                audio: true 
            });
            UI.localVideo.srcObject = localStream;

            // Setup WebRTC connection
            setupPeerConnection();

            // Create Offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            // Send Signal to Backend (via websocket.js)
            if(window.SocketEngine) {
                window.SocketEngine.sendCallSignal(targetId, {
                    type: 'call-offer',
                    isVideo: withVideo,
                    offer: offer
                });
            }
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Could not access Camera/Microphone. Please check permissions.');
            endCall(true);
        }
    }

    // Step B: Handle incoming call alert
    function handleIncomingCall(callerData) {
        currentPeerId = callerData.callerId;
        isVideoCall = callerData.isVideo;
        incomingOffer = callerData.offer;

        // Populate Alert UI
        UI.callerName.textContent = callerData.callerName || 'Someone';
        UI.callTypeLabel.textContent = isVideoCall ? 'Video' : 'Voice';
        UI.callerAvatar.src = callerData.callerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(callerData.callerName)}`;
        
        // Show Alert
        UI.incomingCallAlert.classList.remove('hidden');
    }

    // Step C: Accept Incoming Call
    async function acceptCall() {
        UI.incomingCallAlert.classList.add('hidden');
        showCallModal(`Connecting...`);
        
        if (!isVideoCall) UI.localVideo.classList.add('hidden');
        else UI.localVideo.classList.remove('hidden');

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: isVideoCall, 
                audio: true 
            });
            UI.localVideo.srcObject = localStream;

            setupPeerConnection();
            
            // Set remote offer & create answer
            await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            // Send Answer back
            if(window.SocketEngine) {
                window.SocketEngine.sendCallSignal(currentPeerId, {
                    type: 'call-answer',
                    answer: answer
                });
            }
            UI.callStatusText.textContent = "Connected";
        } catch (error) {
            console.error('Error accepting call:', error);
            rejectCall();
        }
    }

    // Step D: Reject Incoming Call
    function rejectCall() {
        UI.incomingCallAlert.classList.add('hidden');
        if(window.SocketEngine && currentPeerId) {
            window.SocketEngine.sendCallSignal(currentPeerId, { type: 'call-rejected' });
        }
        resetCallState();
    }

    // --- 4. WebRTC Connection Management ---
    function setupPeerConnection() {
        peerConnection = new RTCPeerConnection(rtcConfig);
        remoteStream = new MediaStream();
        UI.remoteVideo.srcObject = remoteStream;

        // Add local tracks to connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Listen for remote tracks
        peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track);
            });
            UI.callStatusText.textContent = "Connected";
        };

        // Listen for ICE candidates to send to peer
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && window.SocketEngine) {
                window.SocketEngine.sendCallSignal(currentPeerId, {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        // Handle connection drops
        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
                endCall(true);
            }
        };
    }

    // --- 5. Signaling Processor (Called from websocket.js) ---
    async function processSignal(signalData) {
        if (!peerConnection) return;

        try {
            if (signalData.type === 'call-answer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.answer));
                UI.callStatusText.textContent = "Connected";
            } 
            else if (signalData.type === 'ice-candidate') {
                await peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
            }
            else if (signalData.type === 'call-rejected') {
                UI.callStatusText.textContent = "Call Rejected";
                setTimeout(() => endCall(true), 2000);
            }
            else if (signalData.type === 'call-ended') {
                endCall(false); // End silently since peer initiated it
            }
        } catch (error) {
            console.error('Error processing WebRTC signal:', error);
        }
    }

    // --- 6. Media Controls (Mute/Video Toggle) ---
    function toggleAudio() {
        if (!localStream) return;
        isAudioMuted = !isAudioMuted;
        localStream.getAudioTracks()[0].enabled = !isAudioMuted;
        
        // Update Button Style (Red when muted)
        if(isAudioMuted) {
            UI.toggleAudioBtn.classList.add('danger');
            UI.toggleAudioBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
        } else {
            UI.toggleAudioBtn.classList.remove('danger');
            UI.toggleAudioBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
        }
    }

    function toggleVideo() {
        if (!localStream || !isVideoCall) return;
        isVideoMuted = !isVideoMuted;
        localStream.getVideoTracks()[0].enabled = !isVideoMuted;
        
        // Update Button Style
        if(isVideoMuted) {
            UI.toggleVideoBtn.classList.add('danger');
            UI.toggleVideoBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
            UI.toggleVideoBtn.classList.remove('danger');
            UI.toggleVideoBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
        }
    }

    // --- 7. Call Cleanup ---
    function endCall(notifyPeer = true) {
        if (notifyPeer && window.SocketEngine && currentPeerId) {
            window.SocketEngine.sendCallSignal(currentPeerId, { type: 'call-ended' });
        }
        resetCallState();
    }

    function resetCallState() {
        // Stop all media tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection) {
            peerConnection.close();
        }

        // Reset Variables
        localStream = null;
        remoteStream = null;
        peerConnection = null;
        currentPeerId = null;
        incomingOffer = null;
        isAudioMuted = false;
        isVideoMuted = false;

        // Reset UI
        UI.localVideo.srcObject = null;
        UI.remoteVideo.srcObject = null;
        UI.callModal.classList.add('hidden');
        UI.incomingCallAlert.classList.add('hidden');
        UI.toggleAudioBtn.classList.remove('danger');
        UI.toggleVideoBtn.classList.remove('danger');
    }

    function showCallModal(status) {
        UI.callStatusText.textContent = status;
        UI.callModal.classList.remove('hidden');
    }

    // --- 8. Event Listeners ---
    UI.acceptCallBtn.addEventListener('click', acceptCall);
    UI.rejectCallBtn.addEventListener('click', rejectCall);
    UI.endCallBtn.addEventListener('click', () => endCall(true));
    UI.toggleAudioBtn.addEventListener('click', toggleAudio);
    UI.toggleVideoBtn.addEventListener('click', toggleVideo);

    // --- Public API ---
    return {
        initiateCall,
        handleIncomingCall,
        processSignal
    };
})();