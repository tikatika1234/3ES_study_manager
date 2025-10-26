document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:3000';  // 本番環境では適切なURLに変更
    const logoutBtn = document.getElementById('logoutBtn');
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    const userNameElement = document.getElementById('userName');
    const recordForm = document.getElementById('recordForm');
    const recordsList = document.getElementById('recordsList');
    const dateInput = document.getElementById('date');
    const subjects = ['国語', '数学', '理科', '社会', 'その他'];

    // 認証チェック
    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!token || !user) {
            window.location.href = 'login.html';
            return null;
        }
        return user;
    };

    // APIリクエストヘッダー
    const getHeaders = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    // 初期化
    const init = async () => {
        const user = await checkAuth();
        if (!user) return;
        userNameElement.textContent = user.displayName || user.email;

        // 今日の日付をデフォルトに設定
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.max = today;

        loadRecords();
    };

    // 記録の保存
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = dateInput.value;
        const subjectTimes = {};
        subjects.forEach(subject => {
            const time = parseInt(document.getElementById(`${subject}Time`).value) || 0;
            if (time > 0) subjectTimes[subject] = time;
        });

        const commentType = document.querySelector('input[name="commentType"]:checked').value;
        const comment = commentType === 'text' 
            ? document.getElementById('dailyCommentText').value
            : document.getElementById('signatureCanvas').toDataURL();

        try {
            const response = await fetch(`${API_BASE}/api/records`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    date,
                    subjects: subjectTimes,
                    comment,
                    commentType
                })
            });

            if (!response.ok) throw new Error('記録の保存に失敗しました');
            alert('記録を保存しました！');
            loadRecords();
        } catch (error) {
            alert(error.message);
        }
    });

    // 記録の読み込み
    const loadRecords = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/records`, {
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('記録の取得に失敗しました');
            
            const records = await response.json();
            displayRecords(records);
        } catch (error) {
            console.error('Error:', error);
            recordsList.innerHTML = '<p class="text-red-500">記録の読み込みに失敗しました。</p>';
        }
    };

    // 記録の表示
    const displayRecords = (records) => {
        const weeklyData = new Map();
        records.forEach(record => {
            const weekStart = getMondayOfWeek(record.date);
            if (!weeklyData.has(weekStart)) {
                weeklyData.set(weekStart, []);
            }
            weeklyData.get(weekStart).push(record);
        });

        recordsList.innerHTML = '';
        weeklyData.forEach((weekRecords, weekStart) => {
            const weekDiv = document.createElement('div');
            weekDiv.className = 'mb-8 bg-white p-4 rounded-lg shadow';
            
            let weekHtml = `<h3 class="text-lg font-bold mb-4">${weekStart}の週</h3>`;
            weekRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            weekRecords.forEach(record => {
                const total = Object.values(record.subjects).reduce((sum, time) => sum + time, 0);
                weekHtml += `
                    <div class="mb-4 p-3 bg-gray-50 rounded">
                        <p class="font-bold">${record.date}</p>
                        <ul class="list-disc list-inside">
                            ${Object.entries(record.subjects)
                                .map(([subject, time]) => `<li>${subject}: ${time}分</li>`)
                                .join('')}
                        </ul>
                        <p class="text-right">合計: ${total}分</p>
                        ${record.comment ? `
                            <div class="mt-2">
                                ${record.commentType === 'text' 
                                    ? `<p class="text-gray-600">${record.comment}</p>`
                                    : `<img src="${record.comment}" alt="手書きコメント" class="max-w-full h-auto">`}
                            </div>
                        ` : ''}
                    </div>`;
            });
            weekDiv.innerHTML = weekHtml;
            recordsList.appendChild(weekDiv);
        });
    };

    // ヘルパー関数: 週の月曜日を取得
    const getMondayOfWeek = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff)).toISOString().split('T')[0];
    };

    // ログアウト処理
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    // 初期化実行
    init();
});
