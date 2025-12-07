require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

/* -------------------------------
   PostgreSQL 接続設定
-------------------------------- */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* -------------------------------
   JWT 認証ミドルウェア
-------------------------------- */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Tokenなし' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token無効' });
    req.user = user;
    next();
  });
}

/* -------------------------------
   API: ユーザー登録 (教師 or 生徒)
-------------------------------- */
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role)
      return res.status(400).json({ error: 'username, password, role が必要です' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, password, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role`,
      [username, hashedPassword, role]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------------
   API: ログイン
-------------------------------- */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: 'ユーザーが存在しません' });

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'パスワードが違います' });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------------
   API: 全生徒一覧（教師のみ）
-------------------------------- */
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher')
      return res.status(403).json({ error: '教師のみ閲覧可能' });

    const result = await pool.query(
      `SELECT id, username
       FROM users
       WHERE role = 'student'
       ORDER BY id ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetch students error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------------
   API: 学習記録 作成
-------------------------------- */
app.post('/api/records', authenticateToken, async (req, res) => {
  try {
    const { date, subjects, comment } = req.body;

    if (!date || !subjects)
      return res.status(400).json({ error: 'date と subjects が必要です' });

    const subjectsJson =
      typeof subjects === 'string' ? subjects : JSON.stringify(subjects);

    await pool.query(
      `INSERT INTO records (user_id, date, subjects, comment)
       VALUES ($1, $2, $3, $4)`,
      [req.user.userId, date, subjectsJson, comment || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Record create error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------------
   API: 学習記録 取得（教師 or 本人のみ）
-------------------------------- */
app.get('/api/records/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== 'teacher' && Number(req.user.userId) !== Number(userId))
      return res.status(403).json({ error: '権限がありません' });

    const result = await pool.query(
      `SELECT id, user_id, date, subjects, comment, teacher_comment, created_at
       FROM records
       WHERE user_id = $1
       ORDER BY date DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Record fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------------
   API: 教師コメント 追加 or 更新
-------------------------------- */
app.post('/api/teacher-comment', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher')
      return res.status(403).json({ error: '教師のみ編集可能' });

    const { recordId, comment } = req.body;

    if (!recordId)
      return res.status(400).json({ error: 'recordId が必要です' });

    await pool.query(
      `UPDATE records
       SET teacher_comment = $1
       WHERE id = $2`,
      [comment || null, recordId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Teacher comment error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------------
   API: 週次サマリー取得（教師 or 本人）
-------------------------------- */
app.get('/api/weekly/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== 'teacher' && Number(req.user.userId) !== Number(userId))
      return res.status(403).json({ error: '権限がありません' });

    const result = await pool.query(
      `SELECT *
       FROM weekly_summary
       WHERE user_id = $1
       ORDER BY week_start DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Weekly summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------------
   サーバー起動
-------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
