const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------------------------------------------
   PostgreSQL 接続設定
----------------------------------------------------- */

// .env に DATABASE_URL がある場合 → そのまま使用
// ない場合 → フォールバック（localhost）
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️  DATABASE_URL が見つからないためフォールバックを使用します");
  connectionString = "postgresql://study_user:2012son@localhost:5432/study_manager";
}

// 🔑 localhost 判定
const isLocal =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");

console.log("🔌 DB接続先:", connectionString);
console.log("🔐 SSL:", isLocal ? "OFF (local)" : "ON (production)");

// ✅ ここが一番重要
const pool = new Pool({
  connectionString,
  ssl: isLocal
    ? false
    : { rejectUnauthorized: false },
});


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ---------------------------------------------------
   JWT ミドルウェア
----------------------------------------------------- */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: '認証が必要です' });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'トークンが無効です' });

    req.user = payload; // { userId, role }
    next();
  });
};

/* ---------------------------------------------------
   サインアップ
----------------------------------------------------- */
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, displayName, role, grade, class: classNum, studentNumber } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email と password が必要です' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role, grade, class, student_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, display_name, role, grade, class, student_number`,
      [email, hashedPassword, displayName || null, role || 'student', grade || null, classNum || null, studentNumber || null]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'そのメールアドレスは既に使用されています' });
    }
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------
   ログイン
----------------------------------------------------- */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email と password が必要です' });

    const result = await pool.query(
      'SELECT id, email, password_hash, display_name, role, grade, class, student_number FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword)
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });

    const token = jwt.sign(
      { userId: user.id, role: user.role, grade: user.grade, class: user.class },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        grade: user.grade,
        class: user.class,
        studentNumber: user.student_number
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------
   学習記録 作成
----------------------------------------------------- */
app.post('/api/records', authenticateToken, async (req, res) => {
  try {
    const { date, subjects, comment, commentType } = req.body;

    if (!date || !subjects)
      return res.status(400).json({ error: 'date と subjects が必要です' });

    const subjectsJson = typeof subjects === 'string'
      ? subjects
      : JSON.stringify(subjects);

    await pool.query(
      `INSERT INTO records (user_id, date, subjects, comment)
       VALUES ($1, $2, $3, $4)`,
      [req.user.userId, date, subjectsJson, comment || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------
   学習記録 取得
----------------------------------------------------- */
app.get('/api/records/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== 'teacher' && Number(req.user.userId) !== Number(userId))
      return res.status(403).json({ error: '権限がありません' });

    const result = await pool.query(
      `SELECT id, user_id, date, subjects, comment, teacher_comment, created_at
       FROM records WHERE user_id = $1 ORDER BY date DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------
   週間サマリー 作成・更新
----------------------------------------------------- */
app.post('/api/weekly-summary', authenticateToken, async (req, res) => {
  try {
    const { weekStartDate, goal, reflection } = req.body;

    if (!weekStartDate)
      return res.status(400).json({ error: 'weekStartDate が必要です' });

    await pool.query(
      `INSERT INTO weekly_summaries (user_id, week_start_date, goal, reflection)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, week_start_date)
       DO UPDATE SET goal = EXCLUDED.goal, reflection = EXCLUDED.reflection, created_at = CURRENT_TIMESTAMP`,
      [req.user.userId, weekStartDate, goal || null, reflection || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------
   週間サマリー 取得
----------------------------------------------------- */
app.get('/api/weekly-summary/:userId/:weekStartDate', authenticateToken, async (req, res) => {
  try {
    const { userId, weekStartDate } = req.params;

    const result = await pool.query(
      'SELECT * FROM weekly_summaries WHERE user_id = $1 AND week_start_date = $2',
      [userId, weekStartDate]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------
   教師：生徒一覧
----------------------------------------------------- */
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher')
      return res.status(403).json({ error: '権限がありません' });

    if (req.user.grade != null && req.user.class != null) {
      const result = await pool.query(
        'SELECT id, email, display_name, grade, class, student_number FROM users WHERE role = $1 AND grade = $2 AND class = $3',
        ['student', req.user.grade, req.user.class]
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      'SELECT id, email, display_name, grade, class, student_number FROM users WHERE role = $1',
      ['student']
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------
   教師コメント
----------------------------------------------------- */
app.post('/api/teacher-comment', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher')
      return res.status(403).json({ error: '権限がありません' });

    const { recordId, comment } = req.body;
    if (!recordId)
      return res.status(400).json({ error: 'recordId が必要です' });

    await pool.query(
      'UPDATE records SET teacher_comment = $1 WHERE id = $2',
      [comment || null, recordId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------
   勉強記録合戦用API：期間別学習時間統計取得
----------------------------------------------------- */
app.get('/api/battle-stats', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, studentId } = req.query;

    if (!startDate || !endDate || !studentId)
      return res.status(400).json({ error: 'startDate, endDate, studentId が必要です' });

    // 権限チェック：本人か教師のみ
    if (req.user.role !== 'teacher' && Number(req.user.userId) !== Number(studentId))
      return res.status(403).json({ error: '権限がありません' });

    // 期間内のすべての記録を取得
    const result = await pool.query(
      `SELECT date, subjects FROM records 
       WHERE user_id = $1 AND date >= $2 AND date <= $3 
       ORDER BY date ASC`,
      [studentId, startDate, endDate]
    );

    const records = result.rows;
    let totalMinutes = 0;
    const subjectBreakdown = {};

    // 各記録のsubjectsを解析して合計を計算
    records.forEach(record => {
      let subjects = record.subjects;
      
      // JSON文字列の場合はパース
      if (typeof subjects === 'string') {
        try {
          subjects = JSON.parse(subjects);
        } catch (e) {
          subjects = {};
        }
      }

      // 科目ごとの時間を加算
      Object.entries(subjects || {}).forEach(([subject, minutes]) => {
        const mins = parseInt(minutes, 10) || 0;
        totalMinutes += mins;
        subjectBreakdown[subject] = (subjectBreakdown[subject] || 0) + mins;
      });
    });

    res.json({
      totalMinutes,
      subjectBreakdown,
      recordCount: records.length
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------
   サーバー起動
----------------------------------------------------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});