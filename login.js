document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'https://threees-study-manager.onrender.com';  // 開発環境用。本番環境では適切なURLに変更
    
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupBtn = document.getElementById('showSignup');
    const showLoginBtn = document.getElementById('showLogin');

    // フォーム切り替え
    if (showSignupBtn && showLoginBtn && loginForm && signupForm) {
        showSignupBtn.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        });
        showLoginBtn.addEventListener('click', () => {
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
    }

    // ログイン処理
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch(`${API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'ログインに失敗しました');
                }

                // トークンとユーザー情報を保存
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // ロール別リダイレクト
                if (data.user.role === 'teacher') {
                    window.location.href = 'teacher.html';
                } else {
                    window.location.href = 'record.html';
                }
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // 新規登録処理
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const displayName = document.getElementById('signup-displayName').value;

            try {
                const response = await fetch(`${API_BASE}/api/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email,
                        password,
                        displayName,
                        role: 'student'  // デフォルトで生徒として登録
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || '登録に失敗しました');
                }

                // トークンとユーザー情報を保存
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // 記録ページへリダイレクト
                window.location.href = 'record.html';
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // ログイン状態チェック
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (token && user) {
        if (user.role === 'teacher') {
            window.location.href = 'teacher.html';
        } else {
            window.location.href = 'record.html';
        }
    }
});