const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// JWTトークン検証用ミドルウェア
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'トークンが無効です' });
    }
    req.user = payload; // { userId, role, iat, exp }
    next();
  });
};

// サインアップ
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, displayName, role, grade, class: classNum } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email と password が必要です' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role, grade, class)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, display_name, role, grade, class`,
      [email, hashedPassword, displayName || null, role || 'student', grade || null, classNum || null]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    // duplicate key などの処理
    if (error.code === '23505') {
      return res.status(409).json({ error: 'そのメールアドレスは既に使用されています' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ログイン
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email と password が必要です' });

    const result = await pool.query('SELECT id, email, password_hash, display_name, role, grade, class FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    const token = jwt.sign(
      // 教師が担当する grade/class をトークンに含める（フロントでの絞りや権限制御に利用）
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
        class: user.class
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 学習記録作成（認証必須）
app.post('/api/records', authenticateToken, async (req, res) => {
  try {
    const { date, subjects, comment, commentType } = req.body;
    if (!date || !subjects) return res.status(400).json({ error: 'date と subjects が必要です' });

    // subjects を確実に JSON 文字列として保存
    const subjectsJson = (typeof subjects === 'string') ? subjects : JSON.stringify(subjects);
    await pool.query(
      'INSERT INTO study_records (user_id, date, subjects, comment, comment_type) VALUES ($1, $2, $3, $4, $5)',
      [req.user.userId, date, subjectsJson, comment || null, commentType || null]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 指定ユーザーの記録取得（認証必須）
app.get('/api/records/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // 生徒は自分の記録のみ取得可能、教師は全員取得可能
    if (req.user.role !== 'teacher' && Number(req.user.userId) !== Number(userId)) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const result = await pool.query(
      'SELECT id, user_id, date, subjects, comment, comment_type, teacher_comment, created_at FROM study_records WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 週間サマリー作成／更新（認証必須）
app.post('/api/weekly-summary', authenticateToken, async (req, res) => {
  try {
    const { weekStartDate, goal, reflection } = req.body;
    if (!weekStartDate) return res.status(400).json({ error: 'weekStartDate が必要です' });

    await pool.query(
      `INSERT INTO weekly_summaries (user_id, week_start_date, goal, reflection)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, week_start_date) DO UPDATE SET goal = EXCLUDED.goal, reflection = EXCLUDED.reflection, created_at = CURRENT_TIMESTAMP`,
      [req.user.userId, weekStartDate, goal || null, reflection || null]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/weekly-summary/:userId/:weekStartDate', authenticateToken, async (req, res) => {
  try {
    const { userId, weekStartDate } = req.params;
    const result = await pool.query(
      'SELECT * FROM weekly_summaries WHERE user_id = $1 AND week_start_date = $2',
      [userId, weekStartDate]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 教師用：生徒一覧取得（認証必須）
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: '権限がありません' });

    // トークンに含まれる担当学年/クラスで絞る（存在しない場合は全生徒）
    if (req.user.grade != null && req.user.class != null) {
      const result = await pool.query(
        'SELECT id, email, display_name, grade, class FROM users WHERE role = $1 AND grade = $2 AND class = $3',
        ['student', req.user.grade, req.user.class]
      );
      return res.json(result.rows);
    }

    const result = await pool.query('SELECT id, email, display_name, grade, class FROM users WHERE role = $1', ['student']);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 教師用：記録へのコメント（認証必須）
app.post('/api/teacher-comment', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: '権限がありません' });

    const { recordId, comment } = req.body;
    if (!recordId) return res.status(400).json({ error: 'recordId が必要です' });

    await pool.query('UPDATE study_records SET teacher_comment = $1 WHERE id = $2', [comment || null, recordId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});