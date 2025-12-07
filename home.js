// ...existing code...
const API_URL = 'http://160.251.251.133:3000/';

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

    // student_Home.html 向け要素取得
    const nameplate = document.querySelector('.nameplate-box');
    const recordBtn = document.querySelector('.record-btn');
    const viewBtn = document.querySelector('.view-btn');
    const topRight = document.querySelector('.top-right');
    const studyTimeDetail = document.querySelector('.record-table .study-time-detail');
    const studentCommentDisplay = document.querySelector('.record-table .student-comment-display');
    const teacherCommentDisplay = document.querySelector('.record-table .teacher-comment-display');

    // 表示名・学年・クラスをネームプレートに表示
    if (nameplate) {
        const display = escapeHtml(userData.displayName || userData.email);
        const grade = userData.grade ? `学年:${escapeHtml(String(userData.grade))}` : '';
        const cls = userData.class ? `クラス:${escapeHtml(String(userData.class))}` : '';
        nameplate.textContent = `${display} ${grade} ${cls}`.trim();
    }

    // ログアウトボタンを右上に追加（存在しなければ）
    if (topRight && !document.getElementById('home-logout')) {
        const btn = document.createElement('button');
        btn.id = 'home-logout';
        btn.textContent = 'ログアウト';
        btn.className = 'bg-red-500 text-white font-bold p-2 rounded-md hover:bg-red-600 transition duration-200';
        btn.style.alignSelf = 'flex-start';
        btn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
        topRight.insertBefore(btn, topRight.firstChild);
    }

    // ボタン動作：記録ページへ移動
    if (recordBtn) {
        recordBtn.addEventListener('click', () => window.location.href = 'record.html');
    }
    if (viewBtn) {
        viewBtn.addEventListener('click', () => window.location.href = 'view.html');
    }

    // 最新記録を取得して record-table の要素に反映
    const loadLatestRecord = async () => {
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
                if (studyTimeDetail) studyTimeDetail.innerHTML = '<div class="text-gray-500">記録がありません</div>';
                if (studentCommentDisplay) studentCommentDisplay.innerHTML = '<div class="text-gray-500">--</div>';
                if (teacherCommentDisplay) teacherCommentDisplay.innerHTML = '<div class="text-gray-500">--</div>';
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

            // subjects を左カラムに整形
            const subjectsHtml = Object.entries(subjects || {})
                .map(([k,v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))} 分</p>`)
                .join('');

            if (studyTimeDetail) studyTimeDetail.innerHTML = subjectsHtml || '<div class="text-gray-500">記録なし</div>';
            if (studentCommentDisplay) studentCommentDisplay.innerHTML = `<div class="text-sm text-gray-700"><strong>感想:</strong><div>${escapeHtml(latest.comment || '') || '<span class="text-gray-500">なし</span>'}</div></div>`;
            if (teacherCommentDisplay) teacherCommentDisplay.innerHTML = latest.teacher_comment ? `<div class="text-sm text-gray-700"><strong>先生コメント:</strong><div>${escapeHtml(latest.teacher_comment)}</div></div>` : '<div class="text-gray-500">--</div>';

        } catch (error) {
            console.error('最新記録取得エラー:', error);
            if (studyTimeDetail) studyTimeDetail.innerHTML = `<div class="text-red-500">エラー: ${escapeHtml(error.message)}</div>`;
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