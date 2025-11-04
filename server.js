const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 認証ミドルウェア: Bearer トークンを検証し、DBからユーザー情報を読み込む
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'ユーザーが見つかりません' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('認証エラー:', err);
    res.status(401).json({ error: '無効なトークンです' });
  }
}

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName, role = 'student' } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードは必須です' });
  }
  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, role',
      [email, hashedPassword, displayName, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('登録エラー:', err);
    res.status(500).json({ error: 'ユーザー登録に失敗しました' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードは必須です' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('ログインエラー:', err);
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.display_name,
      role: req.user.role
    });
  } catch (err) {
    console.error('ユーザー情報取得エラー:', err);
    res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
  }
});

// GET /api/teacher/students - 教師が生徒一覧を取得
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
  } catch (err) {
    console.error('生徒一覧取得エラー:', err);
    res.status(500).json({ error: '生徒一覧の取得に失敗しました' });
  }
});

// GET /api/teacher/students/:studentId/records - 教師が指定生徒の記録を参照
app.get('/api/teacher/students/:studentId/records', authMiddleware, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: '権限がありません' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM study_records WHERE user_id = $1 ORDER BY date DESC',
      [req.params.studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('学習記録取得エラー:', err);
    res.status(500).json({ error: '学習記録の取得に失敗しました' });
  }
});

// GET /api/records/:studentId - 指定生徒の記録（教師または本人）
app.get('/api/records/:studentId', authMiddleware, async (req, res) => {
  const { studentId } = req.params;
  if (req.user.role !== 'teacher' && req.user.id !== studentId) {
    return res.status(403).json({ error: '権限がありません' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM study_records WHERE user_id = $1 ORDER BY date DESC',
      [studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('学習記録取得エラー:', err);
    res.status(500).json({ error: '学習記録の取得に失敗しました' });
  }
});

// PUT /api/records/:studentId/comment - 先生が日付指定でコメント保存
app.put('/api/records/:studentId/comment', authMiddleware, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: '権限がありません' });
  }
  const { studentId } = req.params;
  const { date, teacherComment } = req.body;
  if (!date) {
    return res.status(400).json({ error: '日付は必須です' });
  }
  try {
    const result = await pool.query(
      'UPDATE study_records SET teacher_comment = $1 WHERE user_id = $2 AND date = $3 RETURNING *',
      [teacherComment, studentId, date]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '指定された日付の記録が見つかりません' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('コメント保存エラー:', err);
    res.status(500).json({ error: 'コメントの保存に失敗しました' });
  }
});

// POST /api/records - 生徒が自分の記録を作成/更新
app.post('/api/records', authMiddleware, async (req, res) => {
  const { date, subjects = {}, comment = null, comment_type = null } = req.body;
  const userId = req.user.id;
  if (!date) {
    return res.status(400).json({ error: '日付は必須です' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO study_records (user_id, date, subjects, comment, comment_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, date)
       DO UPDATE SET subjects = $3, comment = $4, comment_type = $5
       RETURNING *`,
      [userId, date, subjects, comment, comment_type]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('学習記録保存エラー:', err);
    res.status(500).json({ error: '学習記録の保存に失敗しました' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`APIサーバーがポート${port}で起動しました`));