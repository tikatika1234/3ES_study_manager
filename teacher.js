const API_URL = 'https://threees-study-manager.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // 認証情報の確認
    const userData = JSON.parse(localStorage.getItem('userData'));
    const token = localStorage.getItem('token');

    if (!userData || !token || userData.role !== 'teacher') {
        window.location.href = 'login.html';
        return;
    }

    // DOM要素の取得
    const dateSelect = document.getElementById('dateSelect');
    const studentRecordsContainer = document.getElementById('studentRecordsContainer');
    const userNameElement = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const classTitle = document.getElementById('classTitle');
    const submitAllCommentsBtn = document.getElementById('submitAllCommentsBtn');
    const recordCountElement = document.getElementById('recordCount');

    // 初期化
    let currentStudents = [];
    let currentRecords = [];

    // ユーザー名表示
    userNameElement.textContent = userData.displayName || '先生';
    classTitle.textContent = `${userData.displayName || '先生'}の担当生徒の記録`;

    // ログアウト処理
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }

    // 初期日付の設定 (今日の日付)
    dateSelect.value = new Date().toISOString().split('T')[0];

    // 日付変更時の処理
    dateSelect.addEventListener('change', () => {
        loadStudentsAndRecords(dateSelect.value);
    });
    
    // コメントの一括保存処理
    submitAllCommentsBtn.addEventListener('click', async () => {
        await submitAllComments();
    });

    /**
     * 生徒一覧と、指定日の学習記録をまとめて取得します。
     * @param {string} date - YYYY-MM-DD形式の日付
     */
    const loadStudentsAndRecords = async (date) => {
        studentRecordsContainer.innerHTML = '<p style="padding: 20px; text-align: center; grid-column: 1 / -1;">生徒と記録を読み込み中...</p>';
        recordCountElement.textContent = '';
        
        try {
            // 1. 生徒一覧の取得 (前回のロジックを流用)
            const studentsResponse = await fetch(`${API_URL}/api/students`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!studentsResponse.ok) throw new Error('生徒一覧の取得に失敗しました');
            currentStudents = await studentsResponse.json();

            // 2. 各生徒の記録を取得し、指定日でフィルタリング (前回のロジックを流用)
            currentRecords = [];
            for (const student of currentStudents) {
                const recordsResponse = await fetch(`${API_URL}/api/records/${student.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const allRecords = await recordsResponse.json();
                
                const targetRecord = allRecords.find(r => r.date.split('T')[0] === date);
                
                currentRecords.push({ student, record: targetRecord });
            }

            displayStudentRecordsTable(currentRecords);

        } catch (error) {
            console.error('データ取得エラー:', error);
            studentRecordsContainer.innerHTML = `<p style="padding: 20px; text-align: center; grid-column: 1 / -1;" class="text-red-500">エラー: ${error.message}</p>`;
        }
    };

    /**
     * グリッドテーブルに生徒の記録を表示します。
     * @param {Array} records - { student, record } の配列
     */
    const displayStudentRecordsTable = (records) => {
        recordCountElement.textContent = `表示件数: ${records.length} 件`;
        if (!records || records.length === 0) {
            studentRecordsContainer.innerHTML = '<p style="padding: 20px; text-align: center; grid-column: 1 / -1;">指定された日付の記録がありません。</p>';
            return;
        }

        const rowsHtml = records.map(({ student, record }) => {
            const studentId = student.id;
            const recordId = record?.id || null;
            
            // レコードがない場合のデフォルト値
            const defaultText = '<span class="text-gray-400">記録なし</span>';
            let subjects = record?.subjects;
            let subjectsHtml = defaultText;

            // subjectsがオブジェクトであることを確認し、HTMLを生成
            if (subjects) {
                if (typeof subjects === 'string') {
                    try { subjects = JSON.parse(subjects); } catch (e) { subjects = subjects; }
                }
                
                if (typeof subjects === 'object' && subjects !== null) {
                    subjectsHtml = Object.entries(subjects)
                        .map(([k, v]) => `<p>${escapeHtml(k)}: ${v.h || 0}時間${v.m || 0}分</p>`)
                        .join('');
                }
            }

            const studentComment = record?.comment || '';
            const teacherComment = record?.teacher_comment || '';
            
            // コメント入力欄がある（記録がある）場合にチェックボックスを有効化
            const isCommentable = !!recordId;

            return `
                <div class="table-row" role="row" data-record-id="${recordId}">
                    <div class="col-student-list student-info" role="cell">
                        <span class="student-id">ID: ${escapeHtml(studentId)}</span>
                        <span class="student-name">${escapeHtml(student.display_name || student.email)}</span>
                    </div>
                    
                    <div class="col-checkbox" role="cell">
                        <input type="checkbox" 
                                class="record-checkbox" 
                                id="checkbox-${recordId}"
                                data-record-id="${recordId}"
                                ${isCommentable ? '' : 'disabled'} 
                                ${isCommentable && !teacherComment ? 'checked' : ''} 
                                aria-label="コメント保存対象として選択">
                    </div>
                    
                    <div class="col-study-record record-detail" role="cell">
                        ${subjectsHtml}
                    </div>
                    
                    <div class="col-student-comment comment-data" role="cell">
                        ${escapeHtml(studentComment) || defaultText}
                    </div>
                    
                    <div class="col-teacher-comment comment-input" role="cell">
                        ${isCommentable
                            ? `<textarea id="comment-${recordId}" 
                                   class="teacher-comment-input" 
                                   placeholder="コメントを入力..." 
                                   data-record-id="${recordId}" 
                                   aria-label="教師コメント">${escapeHtml(teacherComment)}</textarea>`
                            : defaultText}
                    </div>
                </div>
            `;
        }).join('');

        studentRecordsContainer.innerHTML = rowsHtml;
    };

    /**
     * チェックされた行のコメント入力欄をチェックし、変更があったコメントを一括保存します。
     */
    const submitAllComments = async () => {
        // チェックが入っているチェックボックスを取得
        const checkedBoxes = document.querySelectorAll('.record-checkbox:checked');
        
        if (checkedBoxes.length === 0) {
            alert('保存対象としてチェックされた記録がありません。');
            return;
        }
        
        const commentsToSave = [];
        
        // チェックされた行のコメント入力欄のみを対象とする
        checkedBoxes.forEach(checkbox => {
            const recordId = checkbox.dataset.recordId;
            const input = document.getElementById(`comment-${recordId}`);
            
            if (!input) return; // コメント入力欄が存在しない場合はスキップ

            const currentComment = input.value;
            
            // 元のコメントを特定するために、currentRecordsから元の値を取得
            const originalRecordItem = currentRecords.find(item => item.record?.id === recordId);
            const originalComment = originalRecordItem?.record?.teacher_comment || '';

            // 変更があった場合、または新規コメントの場合のみ保存対象とする
            if (currentComment !== originalComment && currentComment.trim() !== '') {
                commentsToSave.push({ recordId, comment: currentComment });
            }
        });
        
        if (commentsToSave.length === 0) {
            alert('チェックされた記録の中で、変更されたコメントまたは新規コメントはありません。');
            return;
        }

        submitAllCommentsBtn.disabled = true;
        submitAllCommentsBtn.textContent = `保存中... (${commentsToSave.length}件)`;

        let successCount = 0;
        let failCount = 0;

        // コメントを個別に送信
        for (const { recordId, comment } of commentsToSave) {
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
                    throw new Error(error.error || `ID ${recordId} のコメント保存に失敗しました`);
                }

                // 成功した場合は、currentRecordsの値を更新し、再度変更として検出されないようにする
                const updatedRecordItem = currentRecords.find(item => item.record?.id === recordId);
                if (updatedRecordItem) {
                    updatedRecordItem.record.teacher_comment = comment;
                    // 保存成功した行のチェックを外す
                    const savedCheckbox = document.getElementById(`checkbox-${recordId}`);
                    if (savedCheckbox) {
                        savedCheckbox.checked = false;
                    }
                }

                successCount++;
            } catch (error) {
                console.error('コメント保存エラー:', error.message);
                failCount++;
            }
        }
        
        submitAllCommentsBtn.disabled = false;
        submitAllCommentsBtn.textContent = '✅ チェック済みを保存';
        
        alert(`コメントの保存が完了しました。\n成功: ${successCount}件\n失敗: ${failCount}件`);
    };

    // XSS対策：簡易エスケープ
    const escapeHtml = (str) => {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    // 初期ロード
    loadStudentsAndRecords(dateSelect.value);
});