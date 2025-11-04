document.addEventListener('DOMContentLoaded', () => {
    // API設定（本番URLをデフォルトに）
    const API_BASE = 'https://threees-study-manager.onrender.com';

    // DOM要素取得
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupBtn = document.getElementById('showSignup');
    const showLoginBtn = document.getElementById('showLogin');

    // ログインフォームのイベントハンドラ
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                // ログインリクエスト
                const res = await fetch(`${API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        email: document.getElementById('loginEmail').value,
                        password: document.getElementById('loginPassword').value
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || `ログイン失敗 (${res.status})`);
                }

                const data = await res.json();
                if (!data.token || !data.user) {
                    throw new Error('サーバーからの応答が不正です');
                }

                // トークンとユーザー情報を保存
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // ホームページへリダイレクト
                window.location.href = 'index.html';
            } catch (err) {
                console.error('ログインエラー:', err);
                alert(err.message || 'ログインに失敗しました');
            }
        });
    }

    // 新規登録フォームのイベントハンドラ
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const password = document.getElementById('signupPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;

                // パスワード確認
                if (password !== confirmPassword) {
                    throw new Error('パスワードが一致しません');
                }

                // 登録リクエスト
                const res = await fetch(`${API_BASE}/api/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        email: document.getElementById('signupEmail').value,
                        password: password,
                        role: 'student'
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || `登録失敗 (${res.status})`);
                }

                const data = await res.json();
                if (!data.token || !data.user) {
                    throw new Error('サーバーからの応答が不正です');
                }

                // トークンとユーザー情報を保存
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // ホームページへリダイレクト
                window.location.href = 'index.html';
            } catch (err) {
                console.error('登録エラー:', err);
                alert(err.message || '登録に失敗しました');
            }
        });
    }

    // フォーム切り替えボタンのイベントハンドラ
    if (showSignupBtn) {
        showSignupBtn.addEventListener('click', () => {
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('signupSection').classList.remove('hidden');
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', () => {
            document.getElementById('signupSection').classList.add('hidden');
            document.getElementById('loginSection').classList.remove('hidden');
        });
    }

    // 既存のトークンチェック（ログイン済みならリダイレクト）
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (token && user) {
        window.location.href = 'index.html';
    }
});