document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:3000';  // 本番環境では適切なURLに変更
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameElement = document.getElementById('userName');
    const studentList = document.getElementById('studentList');
    const studentRecordsContainer = document.getElementById('studentRecordsContainer');
    const subjects = ['国語', '数学', '理科', '社会', 'その他'];

    // 認証チェック
    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!token || !user || user.role !== 'teacher') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
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

    // 生徒一覧の読み込み
    const loadStudents = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/teacher/students`, {
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('生徒一覧の取得に失敗しました');
            
            const students = await response.json();
            studentList.innerHTML = '';
            
            if (students.length === 0) {
                studentList.innerHTML = '<p class="text-gray-500">生徒が登録されていません。</p>';
                return;
            }

            students.forEach(student => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <button class="w-full text-left p-3 rounded-md bg-white hover:bg-gray-100 transition duration-300 border border-gray-200"
                            data-student-id="${student.id}">
                        ${student.display_name || student.email}
                    </button>`;
                studentList.appendChild(li);
            });

            // 生徒選択イベントの設定
            studentList.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', () => {
                    loadStudentRecords(button.dataset.studentId);
                });
            });
        } catch (error) {
            console.error('Error:', error);
            studentList.innerHTML = '<p class="text-red-500">生徒一覧の読み込みに失敗しました。</p>';
        }
    };

    // 生徒の記録を読み込む
    const loadStudentRecords = async (studentId) => {
        try {
            studentRecordsContainer.innerHTML = '<p class="text-gray-500">読み込み中...</p>';
            const response = await fetch(`${API_BASE}/api/teacher/students/${studentId}/records`, {
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('記録の取得に失敗しました');
            
            const records = await response.json();
            displayStudentRecords(records);
        } catch (error) {
            console.error('Error:', error);
            studentRecordsContainer.innerHTML = '<p class="text-red-500">記録の読み込みに失敗しました。</p>';
        }
    };

    // 生徒の記録を表示
    const displayStudentRecords = (records) => {
        if (records.length === 0) {
            studentRecordsContainer.innerHTML = '<p class="text-gray-500">まだ記録がありません。</p>';
            return;
        }

        const weeklyData = new Map();
        records.forEach(record => {
            const weekStart = getMondayOfWeek(record.date);
            if (!weeklyData.has(weekStart)) {
                weeklyData.set(weekStart, []);
            }
            weeklyData.get(weekStart).push(record);
        });

        studentRecordsContainer.innerHTML = '';
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
                                <p class="font-semibold">生徒のコメント:</p>
                                ${record.commentType === 'text' 
                                    ? `<p class="text-gray-600">${record.comment}</p>`
                                    : `<img src="${record.comment}" alt="手書きコメント" class="max-w-full h-auto">`}
                            </div>
                        ` : ''}
                        <div class="mt-4">
                            <p class="font-semibold">先生からのコメント:</p>
                            <textarea
                                class="w-full p-2 border rounded-md"
                                data-date="${record.date}"
                                data-student-id="${record.user_id}"
                            >${record.teacher_comment || ''}</textarea>
                            <button
                                class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300 save-comment-btn"
                                data-date="${record.date}"
                                data-student-id="${record.user_id}"
                            >コメントを保存</button>
                        </div>
                    </div>`;
            });
            weekDiv.innerHTML = weekHtml;
            studentRecordsContainer.appendChild(weekDiv);
        });

        // コメント保存ボタンのイベント設定
        document.querySelectorAll('.save-comment-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const date = e.target.dataset.date;
                const studentId = e.target.dataset.studentId;
                const textarea = document.querySelector(`textarea[data-date="${date}"][data-student-id="${studentId}"]`);
                const comment = textarea.value;

                try {
                    const response = await fetch(`${API_BASE}/api/teacher/students/${studentId}/comments`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            date,
                            comment
                        })
                    });
                    if (!response.ok) throw new Error('コメントの保存に失敗しました');
                    alert('コメントを保存しました！');
                } catch (error) {
                    alert(error.message);
                }
            });
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

    // 初期化
    (async () => {
        const user = await checkAuth();
        if (user) {
            userNameElement.textContent = user.displayName || user.email;
            loadStudents();
        }
    })();
});
