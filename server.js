const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// CORSとJSONミドルウェアの設定
app.use(cors());
app.use(express.json());

// 静的ファイルの配信設定（ルートディレクトリから直接配信）
app.use(express.static(__dirname));

// データベース設定
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// JWT設定
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// HTMLファイルのルーティング
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/record', (req, res) => {
    res.sendFile(path.join(__dirname, 'record.html'));
});

// フォールバックルート - SPAのための設定
app.get('*', (req, res) => {
    // .js や .css などのファイルリクエストは無視
    if (req.url.includes('.')) return res.status(404).send('Not found');
    // HTMLファイルへのリクエストはindex.htmlにリダイレクト
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ...existing code (API routes)...

app.listen(port, () => {
    console.log(`APIサーバーがポート${port}で起動しました`);
});