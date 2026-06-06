/**
 * SwiftShare - Premium SaaS Chat Application
 * File: src/index.js
 * Description: Cloudflare Worker entry point. Handles routing, API requests
 * for Authentication (Login/Signup), and WebSocket upgrades.
 */

export default {
    async fetch(request, env) {
        return await handleRequest(request, env);
    }
};

/**
 * Main Request Handler
 */
async function handleRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // --- 1. CORS Preflight Handling ---
    if (method === 'OPTIONS') {
        return new Response(null, {
            headers: getCorsHeaders(),
            status: 204
        });
    }

    try {
        // --- 2. API Routes ---
        
        // POST /api/signup
        if (path === '/api/signup' && method === 'POST') {
            return await handleSignup(request, env);
        }
        
        // POST /api/login
        if (path === '/api/login' && method === 'POST') {
            return await handleLogin(request, env);
        }

        // --- 3. WebSocket Upgrade Route (/chat) ---
        if (path === '/chat') {
            // Upgrade request to WebSocket
            if (request.headers.get('Upgrade') !== 'websocket') {
                return new Response('Expected Upgrade: websocket', { status: 426 });
            }
            
            // Forward to Durable Object for WebSocket handling
            const id = env.CHAT_ROOM.idFromName("global_room");
            const obj = env.CHAT_ROOM.get(id);
            return await obj.fetch(request);
        }

        // --- 4. Fallback/404 ---
        return new Response(JSON.stringify({ error: "Not Found" }), { 
            status: 404, 
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders() } 
        });

    } catch (error) {
        console.error("Worker Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders() } 
        });
    }
}

/**
 * Handle User Signup
 */
async function handleSignup(request, env) {
    try {
        // Parsing FormData (handles text and files)
        const formData = await request.formData();
        const username = formData.get('username');
        const mobile = formData.get('mobile');
        const password = formData.get('password'); // Note: In production, hash this with bcrypt/argon2
        const profilePic = formData.get('profilePic'); // File object

        if (!username || !mobile || !password) {
            return apiResponse({ success: false, message: "Missing required fields." }, 400);
        }

        // 1. Check if user exists
        const existingUser = await env.DB.prepare(
            "SELECT id FROM Users WHERE username = ? OR mobile = ?"
        ).bind(username, mobile).first();

        if (existingUser) {
            return apiResponse({ success: false, message: "Username or mobile already in use." }, 409);
        }

        // 2. Generate UUID
        const userId = crypto.randomUUID();

        // 3. Handle Image Upload to R2 (if provided)
        let profilePicUrl = 'shohag.jpg'; // Default fallback
        if (profilePic && profilePic.size > 0 && env.BUCKET) {
            const fileName = `${userId}-${profilePic.name}`;
            await env.BUCKET.put(fileName, profilePic.stream(), {
                httpMetadata: { contentType: profilePic.type }
            });
            // Assume R2 bucket is mapped to a public domain
            profilePicUrl = `https://your-r2-domain.com/${fileName}`; 
        }

        // 4. Insert into Database
        await env.DB.prepare(
            `INSERT INTO Users (id, username, mobile, password_hash, name, profile_pic) 
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(userId, username, mobile, password, username, profilePicUrl).run();

        return apiResponse({ success: true, message: "Account created successfully." }, 201);

    } catch (err) {
        return apiResponse({ success: false, message: err.message }, 500);
    }
}

/**
 * Handle User Login
 */
async function handleLogin(request, env) {
    try {
        const body = await request.json();
        const { identifier, password } = body;

        if (!identifier || !password) {
            return apiResponse({ success: false, message: "Missing credentials." }, 400);
        }

        // Fetch user by username or mobile
        const user = await env.DB.prepare(
            "SELECT * FROM Users WHERE username = ? OR mobile = ?"
        ).bind(identifier, identifier).first();

        if (!user) {
            return apiResponse({ success: false, message: "User not found." }, 404);
        }

        // Verify password (Simple comparison here. Use bcrypt in production)
        if (user.password_hash !== password) {
            return apiResponse({ success: false, message: "Invalid password." }, 401);
        }

        // Generate JWT Token (Simulated here. Use a library like @tsndr/cloudflare-worker-jwt)
        // For demonstration, we'll create a simple base64 token
        const tokenPayload = {
            id: user.id,
            username: user.username,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24h expiration
        };
        const token = btoa(JSON.stringify(tokenPayload));

        // Return user data (excluding password) and token
        const userData = {
            id: user.id,
            username: user.username,
            name: user.name,
            profilePic: user.profile_pic,
            mobile: user.mobile
        };

        return apiResponse({ 
            success: true, 
            token: token,
            user: userData 
        }, 200);

    } catch (err) {
        return apiResponse({ success: false, message: err.message }, 500);
    }
}

/**
 * Utility: Create API JSON Response with CORS
 */
function apiResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders()
        }
    });
}

/**
 * Utility: Standard CORS Headers
 */
function getCorsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*", // Or specify your frontend domain
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
}