const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// JWTトークン検証用ミドルウェアを追加
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'トークンが無効です' });
    }
    req.user = user;
    next();
  });
};

// PostgreSQL設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// データベース初期化用のSQL
const initDB = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE NOT NULL,
  subjects JSONB NOT NULL,
  comment TEXT,
  comment_type VARCHAR(50),
  teacher_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_summaries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  week_start_date DATE NOT NULL,
  goal TEXT,
  reflection TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// サーバー起動時にデータベースを初期化
pool.query(initDB)
  .then(() => console.log('データベースの初期化が完了しました'))
  .catch(err => console.error('データベース初期化エラー:', err));

// ...existing code...

// ユーザー認証APIの修正
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, displayName, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, hashedPassword, displayName, role || 'student']
    );
    
    res.json({ success: true, userId: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        displayName: user.display_name 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ...existing code...
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        displayName: user.display_name 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 学習記録API
app.post('/api/records', authenticateToken, async (req, res) => {
  try {
    const { date, subjects, comment, commentType } = req.body;
    
    await pool.query(
      'INSERT INTO study_records (user_id, date, subjects, comment, comment_type) VALUES ($1, $2, $3, $4, $5)',
      [req.user.userId, date, JSON.stringify(subjects), comment, commentType]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/records/:userId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM study_records WHERE user_id = $1 ORDER BY date DESC',
      [req.params.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 週間サマリーAPI
app.post('/api/weekly-summary', authenticateToken, async (req, res) => {
  try {
    const { weekStartDate, goal, reflection } = req.body;
    
    await pool.query(
      'INSERT INTO weekly_summaries (user_id, week_start_date, goal, reflection) VALUES ($1, $2, $3, $4)',
      [req.user.userId, weekStartDate, goal, reflection]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/weekly-summary/:userId/:weekStartDate', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM weekly_summaries WHERE user_id = $1 AND week_start_date = $2',
      [req.params.userId, req.params.weekStartDate]
    );
    
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 教師用API
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: '権限がありません' });
    }

    const result = await pool.query(
      'SELECT id, email, display_name FROM users WHERE role = $1',
      ['student']
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teacher-comment', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: '権限がありません' });
    }

    const { recordId, comment } = req.body;
    
    await pool.query(
      'UPDATE study_records SET teacher_comment = $1 WHERE id = $2',
      [comment, recordId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});