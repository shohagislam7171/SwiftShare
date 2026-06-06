/**
 * SwiftShare - Premium SaaS Chat Application
 * Entry point: src/index.js
 */

import { ChatRoom } from './chat.js'; 

// Durable Object Export (Required for Cloudflare)
export { ChatRoom }; 

export default {
    async fetch(request, env) {
        return await handleRequest(request, env);
    }
};

async function handleRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
        return new Response(null, { headers: getCorsHeaders(), status: 204 });
    }

    try {
        if (path === '/api/signup' && method === 'POST') return await handleSignup(request, env);
        if (path === '/api/login' && method === 'POST') return await handleLogin(request, env);
        
        if (path === '/chat') {
            if (request.headers.get('Upgrade') !== 'websocket') {
                return new Response('Expected Upgrade: websocket', { status: 426 });
            }
            const id = env.CHAT_ROOM.idFromName("global_room");
            const obj = env.CHAT_ROOM.get(id);
            return await obj.fetch(request);
        }

        return new Response(JSON.stringify({ error: "Not Found" }), { 
            status: 404, 
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders() } 
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders() } 
        });
    }
}

async function handleSignup(request, env) {
    try {
        const data = await request.json(); // formData এর বদলে json ব্যবহার করা বেশি নিরাপদ
        const { username, mobile, password } = data;

        if (!username || !mobile || !password) {
            return apiResponse({ success: false, message: "Missing fields." }, 400);
        }

        const existing = await env.DB.prepare("SELECT id FROM Users WHERE username = ? OR mobile = ?")
            .bind(username, mobile).first();

        if (existing) return apiResponse({ success: false, message: "User exists." }, 409);

        const userId = crypto.randomUUID();
        await env.DB.prepare(`INSERT INTO Users (id, username, mobile, password_hash, name, profile_pic) VALUES (?, ?, ?, ?, ?, ?)`)
            .bind(userId, username, mobile, password, username, 'default.jpg').run();

        return apiResponse({ success: true, message: "Created successfully." }, 201);
    } catch (err) {
        return apiResponse({ success: false, message: err.message }, 500);
    }
}

async function handleLogin(request, env) {
    try {
        const { identifier, password } = await request.json();
        const user = await env.DB.prepare("SELECT * FROM Users WHERE username = ? OR mobile = ?")
            .bind(identifier, identifier).first();

        if (!user || user.password_hash !== password) {
            return apiResponse({ success: false, message: "Invalid credentials." }, 401);
        }

        const tokenPayload = {
            id: user.id,
            username: user.username,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        };
        const token = btoa(JSON.stringify(tokenPayload));

        const userData = {
            id: user.id,
            username: user.username,
            name: user.name,
            profilePic: user.profile_pic,
            mobile: user.mobile
        };

        return apiResponse({ success: true, token: token, user: userData }, 200);
    } catch (err) {
        return apiResponse({ success: false, message: err.message }, 500);
    }
}

function apiResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
}

function getCorsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
}