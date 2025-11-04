const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// auth middleware
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName, role = 'student' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name, role) VALUES ($1,$2,$3,$4) RETURNING id, email, display_name, role',
      [email, hashed, displayName || null, role]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'email exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const result = await pool.query('SELECT id, email, password_hash, display_name, role FROM users WHERE email=$1', [email]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, display_name, role FROM users WHERE id=$1', [req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/teacher/students - 教師が生徒一覧を取得
app.get('/api/teacher/students', authMiddleware, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query('SELECT id, email, display_name FROM users WHERE role=$1 ORDER BY display_name NULLS LAST', ['student']);
    res.json({ students: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/records/:studentId - 指定生徒の記録（教師または本人）
app.get('/api/records/:studentId', authMiddleware, async (req, res) => {
  const { studentId } = req.params;
  if (req.user.role !== 'teacher' && req.user.id !== studentId) return res.status(403).json({ error: 'Forbidden' });
  try {
    const daily = await pool.query('SELECT date, subjects, comment, comment_type, teacher_comment FROM daily_records WHERE user_id=$1 ORDER BY date DESC', [studentId]);
    const weekly = await pool.query('SELECT week_start_date, goal, reflection FROM weekly_summaries WHERE user_id=$1 ORDER BY week_start_date DESC', [studentId]);
    res.json({ dailyRecords: daily.rows, weeklySummaries: weekly.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/records/:studentId/comment - 先生が日付指定でコメント保存
app.put('/api/records/:studentId/comment', authMiddleware, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
  const { studentId } = req.params;
  const { date, teacherComment } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  try {
    const q = 'UPDATE daily_records SET teacher_comment=$1 WHERE user_id=$2 AND date=$3';
    await pool.query(q, [teacherComment || null, studentId, date]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/records - 生徒が自分の記録を作成（簡易）
app.post('/api/records', authMiddleware, async (req, res) => {
  const { date, subjects = {}, comment = null, comment_type = null } = req.body;
  const userId = req.user.id;
  try {
    await pool.query(
      'INSERT INTO daily_records (user_id, date, subjects, comment, comment_type) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id,date) DO UPDATE SET subjects = EXCLUDED.subjects, comment = EXCLUDED.comment, comment_type = EXCLUDED.comment_type',
      [userId, date, subjects, comment, comment_type]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API server listening on ${port}`));