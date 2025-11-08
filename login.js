const API_URL = 'https://threees-study-manager.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // 既にログイン済みならリダイレクト
    const existingUser = JSON.parse(localStorage.getItem('userData'));
    const existingToken = localStorage.getItem('token');
    if (existingUser && existingToken) {
        window.location.href = existingUser.role === 'teacher' ? 'teacher.html' : 'Home.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupBtn = document.getElementById('showSignup');
    const showLoginBtn = document.getElementById('showLogin');

    // フォーム切り替え
    if (showSignupBtn && showLoginBtn) {
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
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'ログインに失敗しました');

            localStorage.setItem('token', data.token);
            localStorage.setItem('userData', JSON.stringify(data.user));

            // 生徒は Home.html に遷移、教師は teacher.html
            window.location.href = data.user.role === 'teacher' ? 'teacher.html' : 'Home.html';
        } catch (error) {
            alert(`ログインエラー: ${error.message}`);
        }
    });

    // 新規登録処理
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const displayName = document.getElementById('signup-displayName').value;

        try {
            const response = await fetch(`${API_URL}/api/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, displayName })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '登録に失敗しました');

            alert('登録が完了しました。ログインしてください。');
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        } catch (error) {
            alert(`登録エラー: ${error.message}`);
        }
    });
});