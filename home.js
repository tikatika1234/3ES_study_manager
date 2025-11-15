// ...existing code...
const API_URL = 'https://threees-study-manager.onrender.com';

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

    // 週の目標テーブル tbody を取得
    const tableBody = document.querySelector('.weekly-goal table tbody');

    // 最新記録を取得して表示
    const loadLatestRecord = async () => {
        if (!tableBody) return;

        tableBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500">読み込み中...</td></tr>`;

        try {
            const res = await fetch(`${API_URL}/api/records/${userData.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                const err = await res.json().catch(()=>({}));
                throw new Error(err.error || '記録の取得に失敗しました');
            }

            const records = await res.json();
            if (!Array.isArray(records) || records.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="2" class="text-gray-500">最新の記録はありません</td></tr>`;
                return;
            }

            // 日付で降順ソートして最新を取得
            records.sort((a,b) => new Date(b.date) - new Date(a.date));
            const latest = records[0];

            // subjects が文字列ならパース
            let subjects = latest.subjects;
            if (typeof subjects === 'string') {
                try { subjects = JSON.parse(subjects); } catch (e) { subjects = {}; }
            }

            // subjects を見やすく整形（行毎に表示）
            const subjectsHtml = Object.entries(subjects || {})
                .map(([k,v]) => `<div class="text-sm text-gray-700"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))} 分</div>`)
                .join('');

            const dateStr = latest.date ? new Date(latest.date).toLocaleDateString() : '日付不明';
            const comment = latest.comment ? escapeHtml(latest.comment) : '<span class="text-gray-500">なし</span>';

            // テーブルの tbody を最新記録表示に置換
            tableBody.innerHTML = `
                <tr>
                  <td style="vertical-align: top; padding: 0.75rem;">
                    <div class="text-sm text-gray-600">最新記録（${escapeHtml(dateStr)}）</div>
                    <div class="mt-2">${subjectsHtml}</div>
                  </td>
                  <td style="vertical-align: top; padding: 0.75rem;">
                    <div class="text-sm text-gray-600">感想</div>
                    <div class="mt-2">${comment}</div>
                  </td>
                </tr>
            `;
        } catch (error) {
            console.error('最新記録取得エラー:', error);
            tableBody.innerHTML = `<tr><td colspan="2" class="text-red-500">エラー: ${escapeHtml(error.message)}</td></tr>`;
        }
    };

    // XSS対策の簡易エスケープ
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 初期表示
    loadLatestRecord();
});
// ...existing code...