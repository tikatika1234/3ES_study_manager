document.addEventListener('DOMContentLoaded', () => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const token = localStorage.getItem('token');

    // 認証チェック
    if (!userData || !token) {
        window.location.href = 'login.html';
        return;
    }

    // 役割チェック（教師なら教師ダッシュボードへ）
    if (userData.role === 'teacher') {
        window.location.href = 'teacher.html';
        return;
    }

    // ユーザー名を表示（存在する場所がなければトップに追加）
    const header = document.querySelector('.main-content');
    if (header) {
        const greetId = 'home-greeting';
        if (!document.getElementById(greetId)) {
            const el = document.createElement('div');
            el.id = greetId;
            el.className = 'mb-6 text-right w-full';
            el.innerHTML = `<span class="text-gray-800">ようこそ、${escapeHtml(userData.displayName || userData.email)} さん</span>`;
            header.prepend(el);
        }
    }

    // 記録ボタン -> 記録ページへ
    const recordBtn = document.querySelector('.record-button');
    if (recordBtn) {
        recordBtn.addEventListener('click', () => {
            window.location.href = 'record.html';
        });
    }

    // 追加: タスクボタン（必要なら別ページへ）
    const taskBtn = document.querySelector('.task-button');
    if (taskBtn) {
        taskBtn.addEventListener('click', () => {
            // 未実装の機能なら適宜変更
            alert('課題機能は未実装です');
        });
    }

    // ログアウトUIを右上に追加
    const container = document.querySelector('.container');
    if (container && !document.getElementById('home-logout')) {
        const btn = document.createElement('button');
        btn.id = 'home-logout';
        btn.textContent = 'ログアウト';
        btn.className = 'absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded';
        btn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
        container.appendChild(btn);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
});