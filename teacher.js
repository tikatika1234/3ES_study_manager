const API_URL = 'https://threees-study-manager.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const token = localStorage.getItem('token');

    if (!userData || !token || userData.role !== 'teacher') {
        window.location.href = 'login.html';
        return;
    }

    const studentList = document.getElementById('studentList');
    const studentRecordsContainer = document.getElementById('studentRecordsContainer');
    const userNameElement = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');

      // 生徒一覧の表示
    const displayStudents = (students) => {
        if (!students || students.length === 0) {
            studentList.innerHTML = '<p class="text-gray-500">生徒が登録されていません。</p>';
            return;
        }

        studentList.innerHTML = students.map(student => `
            <li class="p-3 bg-white rounded shadow-sm hover:bg-gray-50 cursor-pointer transition duration-200"
                onclick="loadStudentRecords('${student.id}')">
                <div class="font-medium text-gray-800">${escapeHtml(student.display_name || '名前未設定')}</div>
                <div class="text-sm text-gray-500">${escapeHtml(student.email)}</div>
            </li>
        `).join('');
    };

    // 生徒の記録の表示
    const displayStudentRecords = (records) => {
        if (!records || records.length === 0) {
            studentRecordsContainer.innerHTML = '<p class="text-gray-500 text-center">記録がありません。</p>';
            return;
        }

        studentRecordsContainer.innerHTML = records.map(record => {
            let subjects = record.subjects;
            if (typeof subjects === 'string') {
                try { subjects = JSON.parse(subjects); } catch (e) { subjects = {}; }
            }

            const subjectsHtml = Object.entries(subjects || {})
                .map(([k, v]) => `<div class="text-sm text-gray-700"><span class="font-medium">${k}:</span> ${v} 分</div>`)
                .join('');

            const commentInputId = `comment-${record.id}`;

            return `
                <div class="p-4 bg-white border rounded shadow-sm mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <div class="text-sm text-gray-500">日付: ${new Date(record.date).toLocaleDateString()}</div>
                        <div class="text-xs px-2 py-1 rounded ${
                            record.comment_type === 'good' ? 'bg-green-100 text-green-700' : 
                            record.comment_type === 'bad' ? 'bg-red-100 text-red-700' : 
                            'bg-yellow-100 text-yellow-700'
                        }">
                            ${escapeHtml(record.comment_type || 'normal')}
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        ${subjectsHtml}
                    </div>
                    <div class="mt-2 text-sm text-gray-800">
                        <strong>生徒コメント:</strong>
                        <div class="mt-1">${escapeHtml(record.comment) || '<span class="text-gray-500">なし</span>'}</div>
                    </div>
                    <div class="mt-3 border-t pt-3">
                        <div class="mb-2">
                            <label for="${commentInputId}" class="block text-sm font-medium text-gray-700">先生からのコメント:</label>
                            <textarea id="${commentInputId}" 
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                rows="2">${escapeHtml(record.teacher_comment || '')}</textarea>
                        </div>
                        <button onclick="submitTeacherComment('${record.id}', document.getElementById('${commentInputId}').value)"
                            class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition duration-200">
                            コメントを保存
                        </button>
                    </div>
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

    // グローバルスコープに関数を公開（onclick用）
    window.loadStudentRecords = loadStudentRecords;
    window.submitTeacherComment = submitTeacherComment;

    // ユーザー名表示
    userNameElement.textContent = userData.displayName || userData.email;

    // ログアウト処理
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }

    // 生徒一覧の取得
    const loadStudents = async () => {
        try {
            const response = await fetch(`${API_URL}/api/students`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '生徒一覧の取得に失敗しました');
            }

            const students = await response.json();
            displayStudents(students);
        } catch (error) {
            console.error('生徒一覧取得エラー:', error);
            alert(`エラー: ${error.message}`);
        }
    };

    // 生徒の記録取得
    const loadStudentRecords = async (studentId) => {
        try {
            studentRecordsContainer.innerHTML = '<p class="text-center">読み込み中...</p>';
            
            const response = await fetch(`${API_URL}/api/records/${studentId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '記録の取得に失敗しました');
            }

            const records = await response.json();
            displayStudentRecords(records);
        } catch (error) {
            console.error('記録取得エラー:', error);
            studentRecordsContainer.innerHTML = `<p class="text-red-500 text-center">エラー: ${error.message}</p>`;
        }
    };

    // コメント送信
    const submitTeacherComment = async (recordId, comment) => {
        try {
            const response = await fetch(`${API_URL}/api/teacher-comment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ recordId, comment })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'コメントの保存に失敗しました');
            }

            alert('コメントを保存しました');
        } catch (error) {
            console.error('コメント保存エラー:', error);
            alert(`エラー: ${error.message}`);
        }
    };

    // ...existing code (displayStudents, displayStudentRecords, escapeHtml functions)...

    // グローバルスコープに関数を公開
    window.loadStudentRecords = loadStudentRecords;
    window.submitTeacherComment = submitTeacherComment;

    // 初期読み込み
    loadStudents();
});