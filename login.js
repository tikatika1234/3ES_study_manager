const API_URL = 'https://threees-study-manager.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // 既にログイン済みならリダイレクト
    const existingUser = JSON.parse(localStorage.getItem('userData'));
    const existingToken = localStorage.getItem('token');
    if (existingUser && existingToken) {
        window.location.href = existingUser.role === 'teacher' ? 'teacher.html' : 'student_Home.html';
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
            window.location.href = data.user.role === 'teacher' ? 'teacher.html' : 'student_Home.html';
        } catch (error) {
            alert(`ログインエラー: ${error.message}`);
        }
    });

    // 新規登録処理
    // --- リアルタイム検証: パスワード一致・長さチェック ---
    const signupPasswordInput = document.getElementById('signup-password');
    const signupConfirmInput = document.getElementById('signup-password-confirm');
    const signupMessage = document.getElementById('signup-password-message');
    const signupSubmitBtn = document.getElementById('signup-submit');

    const validateSignupPassword = () => {
        const pwd = signupPasswordInput.value;
        const cpwd = signupConfirmInput.value;
        const minLen = 6;

        if (!pwd && !cpwd) {
            signupMessage.textContent = '';
            signupMessage.className = 'text-sm mt-1';
            signupSubmitBtn.disabled = true;
            return;
        }

        if (pwd.length < minLen) {
            signupMessage.textContent = `パスワードは最低 ${minLen} 文字必要です。`;
            signupMessage.className = 'text-sm mt-1 text-red-600';
            signupSubmitBtn.disabled = true;
            return;
        }

        if (pwd !== cpwd) {
            signupMessage.textContent = 'パスワードが一致しません。';
            signupMessage.className = 'text-sm mt-1 text-red-600';
            signupSubmitBtn.disabled = true;
            return;
        }

        signupMessage.textContent = 'パスワードが一致しました。';
        signupMessage.className = 'text-sm mt-1 text-green-600';
        signupSubmitBtn.disabled = false;
    };

    signupPasswordInput.addEventListener('input', validateSignupPassword);
    signupConfirmInput.addEventListener('input', validateSignupPassword);

    // 初期評価
    validateSignupPassword();

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-password-confirm').value;
        const displayName = document.getElementById('signup-displayName').value;
        const grade = document.getElementById('signup-grade').value;
        const classNum = document.getElementById('signup-class').value;

        if (password !== confirmPassword) {
            alert('パスワードが一致しません。確認のため同じパスワードを入力してください。');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, displayName, grade, class: classNum })
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