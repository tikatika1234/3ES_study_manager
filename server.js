const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 認証ミドルウェア
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '認証が必要です' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id, email, display_name, role FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'ユーザーが見つかりません' });
    
    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: '無効なトークンです' });
  }
};

// 認証エンドポイント
app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName, role = 'student' } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, role',
      [email, hashedPassword, displayName, role]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ token, user });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    }
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 記録関連エンドポイント
app.get('/api/records', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM daily_records WHERE user_id = $1 ORDER BY date DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/records', authMiddleware, async (req, res) => {
  const { date, subjects, comment, commentType } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO daily_records (user_id, date, subjects, comment, comment_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, date)
       DO UPDATE SET subjects = $3, comment = $4, comment_type = $5
       RETURNING *`,
      [req.user.id, date, subjects, comment, commentType]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 教師用エンドポイント
app.get('/api/teacher/students', authMiddleware, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: '権限がありません' });
  }
  try {
    const result = await pool.query(
      'SELECT id, email, display_name FROM users WHERE role = $1',
      ['student']
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.get('/api/teacher/students/:studentId/records', authMiddleware, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: '権限がありません' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM daily_records WHERE user_id = $1 ORDER BY date DESC',
      [req.params.studentId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
