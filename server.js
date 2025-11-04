const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// CORS設定の詳細化
app.use(cors({
    origin: ['http://localhost:3000', 'https://threees-study-manager.onrender.com'],
    credentials: true
}));

// ミドルウェア設定
app.use(express.json());
app.use(express.static(__dirname));

// APIルートの前にデバッグログを追加
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Content-Type を確認するミドルウェア
app.use('/api/*', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// 認証ミドルウェア
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// HTMLファイルのルーティング
app.get(['/', '/login', '/record'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 静的ファイルへのアクセス
app.get('/*.html', (req, res) => {
    res.sendFile(path.join(__dirname, req.path));
});

// API エンドポイント
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const passwordHash = user.password_hash || user.password;
        if (!passwordHash) {
            return res.status(500).json({ error: 'Password hash not found' });
        }

        const match = await bcrypt.compare(password, passwordHash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ...existing code...