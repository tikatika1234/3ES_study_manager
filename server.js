const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// データベース接続設定
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// JWT秘密鍵
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// メインページのルーティング
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ログインページ
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// 記録ページ
app.get('/record', (req, res) => {
    res.sendFile(path.join(__dirname, 'record.html'));
});

// API エンドポイント
// ログイン
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 新規登録
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *',
            [email, hashedPassword, role || 'student']
        );

        const user = result.rows[0];
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
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

// 記録の保存
app.post('/api/records', authenticateToken, async (req, res) => {
    try {
        const { date, subjects, comment, comment_type } = req.body;
        const result = await pool.query(
            'INSERT INTO study_records (user_id, date, subjects, comment, comment_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [req.user.id, date, JSON.stringify(subjects), comment, comment_type]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Save record error:', err);
        res.status(500).json({ error: 'Failed to save record' });
    }
});

// 記録の取得
app.get('/api/records', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM study_records WHERE user_id = $1 ORDER BY date DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get records error:', err);
        res.status(500).json({ error: 'Failed to get records' });
    }
});

// サーバー起動
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});