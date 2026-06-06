/**
 * SwiftShare - Premium SaaS Chat & Calling Application
 * File: auth.js
 * Description: Handles User Authentication (Login, Signup, Forgot Password),
 * Profile Image Preview, Session Management, and API communication.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. DOM Elements Selection ---
    
    // Screens
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');
    
    // Forms
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const forgotForm = document.getElementById('forgotForm');
    const otpSection = document.getElementById('otpSection');
    
    // Toggles & Buttons
    const switchToSignup = document.getElementById('switchToSignup');
    const switchToLogin = document.getElementById('switchToLogin');
    const forgotBtn = document.getElementById('forgotBtn');
    const backToLogin = document.getElementById('backToLogin');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Inputs
    const signupPhoto = document.getElementById('signupPhoto');
    const picPreview = document.getElementById('picPreview');
    const loginIdentifier = document.getElementById('loginIdentifier');
    const loginPassword = document.getElementById('loginPassword');
    const signupUsername = document.getElementById('signupUsername');
    const signupMobile = document.getElementById('signupMobile');
    const signupPassword = document.getElementById('signupPassword');
    
    // Profile UI in Main App
    const myName = document.getElementById('myName');
    const myProfilePic = document.getElementById('myProfilePic');

    // Base API URL (Will be configured for Cloudflare Workers later)
    const API_BASE_URL = '/api'; 

    // --- 2. Initial Session Check ---
    function checkSession() {
        const token = localStorage.getItem('swiftshare_token');
        const user = JSON.parse(localStorage.getItem('swiftshare_user'));
        
        if (token && user) {
            activateMainApp(user);
        }
    }

    // --- 3. UI Toggle Controllers ---
    
    function hideAllForms() {
        loginForm.classList.remove('active-form');
        loginForm.classList.add('hidden-form');
        signupForm.classList.remove('active-form');
        signupForm.classList.add('hidden-form');
        forgotForm.classList.remove('active-form');
        forgotForm.classList.add('hidden-form');
    }

    switchToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllForms();
        signupForm.classList.remove('hidden-form');
        signupForm.classList.add('active-form');
        document.getElementById('authTitle').textContent = 'Create Account';
        document.getElementById('authSubtitle').textContent = 'Join SwiftShare to connect securely.';
    });

    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllForms();
        loginForm.classList.remove('hidden-form');
        loginForm.classList.add('active-form');
        document.getElementById('authTitle').textContent = 'Welcome to SwiftShare';
        document.getElementById('authSubtitle').textContent = 'Secure your communication. Login to continue.';
    });

    forgotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllForms();
        forgotForm.classList.remove('hidden-form');
        forgotForm.classList.add('active-form');
        document.getElementById('authTitle').textContent = 'Reset Password';
        document.getElementById('authSubtitle').textContent = 'We will send a 6-digit OTP to your mobile.';
    });

    backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchToLogin.click();
    });

    // --- 4. Profile Image Preview Handling ---
    
    signupPhoto.addEventListener('change', function(e) {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                picPreview.style.backgroundImage = `url(${event.target.result})`;
                picPreview.innerHTML = ''; // Remove the SVG icon
                picPreview.style.border = '2px solid var(--accent-glow-1)';
            };
            reader.readAsDataURL(file);
        }
    });

    // --- 5. Authentication API Logic ---

    // Generic error notification
    function showError(message) {
        // In a real SaaS, use a toast notification. Using alert for structural baseline.
        alert(`Authentication Error: ${message}`);
    }

    // Login Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = loginIdentifier.value.trim();
        const password = loginPassword.value.trim();
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        if (!identifier || !password) return showError('Please fill all fields.');

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Authenticating...';

        try {
            // Simulated API Call structure for Cloudflare Worker Backend
            /*
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });
            const data = await response.json();
            if(!response.ok) throw new Error(data.message);
            */

            // Development fallback simulation (Remove when API is ready)
            const simulatedData = {
                token: 'mock_jwt_token_12345',
                user: {
                    id: 'UID' + Math.floor(Math.random() * 90000),
                    username: identifier,
                    name: 'Md Shohag Islam', // Required default fallback
                    profilePic: 'shohag.jpg',
                    mobile: '01XXXXXXXXX'
                }
            };

            // Save session
            localStorage.setItem('swiftshare_token', simulatedData.token);
            localStorage.setItem('swiftshare_user', JSON.stringify(simulatedData.user));
            
            // Transition to main app
            activateMainApp(simulatedData.user);

        } catch (error) {
            showError(error.message || 'Failed to connect to server.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Secure Login';
        }
    });

    // Signup Submission
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = signupUsername.value.trim();
        const mobile = signupMobile.value.trim();
        const password = signupPassword.value.trim();
        const photoFile = signupPhoto.files[0];
        const submitBtn = signupForm.querySelector('button[type="submit"]');

        if (!username || !mobile || !password) return showError('Please fill all required fields.');

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Creating Account...';

        try {
            // We use FormData to handle image uploads for Cloudflare R2
            const formData = new FormData();
            formData.append('username', username);
            formData.append('mobile', mobile);
            formData.append('password', password);
            if (photoFile) formData.append('profilePic', photoFile);

            /*
            const response = await fetch(`${API_BASE_URL}/signup`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if(!response.ok) throw new Error(data.message);
            */

            // Simulation
            setTimeout(() => {
                alert('Account created successfully! Please login.');
                switchToLogin.click();
                loginIdentifier.value = username; // Auto-fill
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Create Account';
            }, 1000);

        } catch (error) {
            showError(error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Create Account';
        }
    });

    // Forgot Password OTP Flow
    sendOtpBtn.addEventListener('click', () => {
        const mobile = document.getElementById('resetMobile').value.trim();
        if (!mobile) return showError('Please enter your registered mobile number.');
        
        sendOtpBtn.innerHTML = 'Sending...';
        
        // Simulate OTP Send
        setTimeout(() => {
            sendOtpBtn.style.display = 'none';
            otpSection.classList.remove('hidden-form');
            otpSection.classList.add('active-form');
        }, 1000);
    });

    // Logout Functionality
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('swiftshare_token');
        localStorage.removeItem('swiftshare_user');
        
        // Reset UI
        mainApp.classList.add('hidden');
        authScreen.classList.add('active');
        loginPassword.value = '';
        
        // Disconnect WebSockets if active
        if(window.ChatEngine && window.ChatEngine.disconnect) {
            window.ChatEngine.disconnect();
        }
    });

    // --- 6. Main App Activator ---
    function activateMainApp(userData) {
        authScreen.classList.remove('active');
        mainApp.classList.remove('hidden');
        
        // Populate User Info
        myName.textContent = userData.name || userData.username;
        if(userData.profilePic) {
            myProfilePic.src = userData.profilePic;
        }

        // Initialize Chat Engine & WebSockets
        if(window.ChatEngine && window.ChatEngine.init) {
            window.ChatEngine.init(userData);
        }
    }

    // Run Initial Check
    checkSession();
});