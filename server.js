const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // ← PostgreSQL用
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// JSON受け取り有効化
app.use(express.json());

// 静的ファイル提供
app.use(express.static(path.join(__dirname)));

// ✅ PostgreSQL接続プール設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ✅ 確認用エンドポイント
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database connection error');
  }
});

// ✅ データ挿入例
app.post('/api/add', async (req, res) => {
  const { name, score } = req.body;
  try {
    await pool.query('INSERT INTO students (name, score) VALUES ($1, $2)', [name, score]);
    res.send('データを追加しました');
  } catch (err) {
    console.error(err);
    res.status(500).send('SQLエラー');
  }
});

// ✅ データ取得例
app.get('/api/list', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('SQLエラー');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
