const API_URL = 'http://163.44.113.224:3000';

document.addEventListener('DOMContentLoaded', () => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const token = localStorage.getItem('token');

    if (!userData || !token) {
        window.location.href = 'login.html';
        return;
    }

    const recordForm = document.getElementById('recordForm');
    const userNameElement = document.getElementById('userName');
    const recordsList = document.getElementById('recordsList');
    const logoutBtn = document.getElementById('logoutBtn');
    const backBtn = document.getElementById('backBtn');
    const dateInput = document.getElementById('date');

    // 日付初期値を今日に
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // ユーザー名表示（要素がある場合のみ）
    if (userNameElement) {
        userNameElement.textContent = userData.displayName || userData.email;
    }

    // 学年・クラス表示追加（userNameElement が存在する場合のみ挿入）
    if (userNameElement && userNameElement.parentNode) {
        const userInfoExtra = document.createElement('span');
        userInfoExtra.className = 'ml-2 text-sm text-gray-500';
        userInfoExtra.textContent = `(学年: ${userData.grade} クラス: ${userData.class})`;
        userNameElement.parentNode.insertBefore(userInfoExtra, userNameElement.nextSibling);
    }

    // ログアウト
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }

    // 戻る処理（存在する場合）
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'student_Home.html';
        });
    }

    // 学習記録の送信
    if (recordForm) {
        recordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                date: (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0],
                subjects: {
                    国語: Number(document.getElementById('japanese').value) || 0,
                    数学: Number(document.getElementById('math').value) || 0,
                    英語: Number(document.getElementById('english').value) || 0,
                    理科: Number(document.getElementById('science').value) || 0,
                    社会: Number(document.getElementById('social').value) || 0,
                    その他: Number(document.getElementById('other').value) || 0
                },
                comment: document.getElementById('dailyCommentText').value
                // commentType は削除しました
            };

            try {
                const response = await fetch(`${API_URL}/api/records`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || '記録の保存に失敗しました');
                }

                // フォームをクリアして再読み込み
                recordForm.reset();
                // リセット後に日付を今日に戻す（要素がある場合）
                if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
                alert('学習記録を保存しました');
                loadRecords();
            } catch (error) {
                alert(`エラー: ${error.message}`);
            }
        });
    }

    // 記録の読み込み
    const loadRecords = async () => {
        try {
            const response = await fetch(`${API_URL}/api/records/${userData.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || '記録の取得に失敗しました');
            }

            const records = await response.json();
            displayRecords(records);
        } catch (error) {
            alert(`エラー: ${error.message}`);
        }
    };

    // displayRecords の実装（存在しなかったため追加）
    const displayRecords = (records) => {
        if (!records || records.length === 0) {
            recordsList.innerHTML = '<p class="text-gray-500">記録がありません。</p>';
            return;
        }

        // 新しい順で表示（サーバー側で降順ならそのまま）
        recordsList.innerHTML = records.map(record => {
            // subjects が JSON 文字列の場合に備えてパースを試みる
            let subjects = record.subjects;
            if (typeof subjects === 'string') {
                try { subjects = JSON.parse(subjects); } catch (e) { subjects = {}; }
            }

            const subjectsHtml = Object.entries(subjects || {})
                .map(([k, v]) => `<div class="text-sm text-gray-700"><span class="font-medium">${k}:</span> ${v} 分</div>`)
                .join('');

            const teacherCommentHtml = record.teacher_comment
                ? `<div class="mt-2 p-2 bg-gray-50 border rounded text-sm"><strong>先生コメント:</strong> ${escapeHtml(record.teacher_comment)}</div>`
                : '';

            const userComment = record.comment ? escapeHtml(record.comment) : '';

            return `
                <div class="p-4 bg-white border rounded shadow-sm">
                    <div class="flex justify-between items-center mb-2">
                        <div class="text-sm text-gray-500">日付: ${new Date(record.date).toLocaleDateString()}</div>
                        <div class="text-xs px-2 py-1 rounded ${record.comment_type === 'good' ? 'bg-green-100 text-green-700' : record.comment_type === 'bad' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">
                            ${escapeHtml(record.comment_type || 'normal')}
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        ${subjectsHtml}
                    </div>
                    <div class="mt-2 text-sm text-gray-800">
                        <strong>感想:</strong>
                        <div class="mt-1">${userComment || '<span class="text-gray-500">なし</span>'}</div>
                    </div>
                    ${teacherCommentHtml}
                </div>
            `;
        }).join('');
    };

    // XSS対策：簡易エスケープ
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    // 初期読み込み
    loadRecords();
});