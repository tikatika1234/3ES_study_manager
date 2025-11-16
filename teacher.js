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
            // 1. 生徒一覧の取得
            const studentsResponse = await fetch(`${API_URL}/api/students`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!studentsResponse.ok) throw new Error('生徒一覧の取得に失敗しました');
            let students = await studentsResponse.json();
            
            // 追加: クライアント側でも念のため教師の担当学年・クラスで絞る（トークン側で絞られていない場合の保険）
            const teacherGrade = userData.grade;
            const teacherClass = userData.class;
            if (teacherGrade != null && teacherClass != null) {
                students = students.filter(s => String(s.grade) === String(teacherGrade) && String(s.class) === String(teacherClass));
            }
            currentStudents = students;

            // 2. 各生徒の記録を取得し、指定日でフィルタリング
            currentRecords = [];
            for (const student of currentStudents) {
                const recordsResponse = await fetch(`${API_URL}/api/records/${student.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!recordsResponse.ok) {
                    // 空配列扱いにして継続
                    currentRecords.push({ student, record: null });
                    continue;
                }
                const allRecords = await recordsResponse.json();
                
                const targetRecord = allRecords.find(r => {
                    try {
                        return new Date(r.date).toISOString().split('T')[0] === date;
                    } catch { return false; }
                }) || null;
                
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
            const recordId = record?.id ?? null;
            const defaultText = '<span class="text-gray-400">記録なし</span>';

            // 学習時間表示（subjects の値が minutes か {h,m} か両方に対応）
            let subjectsHtml = defaultText;
            let subjects = record?.subjects;
            if (subjects) {
                if (typeof subjects === 'string') {
                    try { subjects = JSON.parse(subjects); } catch (e) { subjects = {}; }
                }
                if (typeof subjects === 'object' && subjects !== null) {
                    const items = Object.entries(subjects).map(([k, v]) => {
                        // v が数値（分）または {h,m} か
                        if (typeof v === 'number') {
                            const mins = Number(v) || 0;
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            return `<p>${escapeHtml(k)}: ${h}時間${m}分</p>`;
                        } else if (v && typeof v === 'object') {
                            const h = Number(v.h) || 0;
                            const m = Number(v.m) || 0;
                            return `<p>${escapeHtml(k)}: ${h}時間${m}分</p>`;
                        } else {
                            return `<p>${escapeHtml(k)}: 0分</p>`;
                        }
                    });
                    subjectsHtml = items.join('');
                }
            }

            const studentComment = record?.comment || '';
            const teacherComment = record?.teacher_comment || '';
            const isCommentable = !!recordId;

            // 出力順はヘッダーに合わせる：生徒名 / 学習時間 / 生徒コメント / 教師コメント / チェック
            return `
                <div class="table-row" role="row" ${isCommentable ? `data-record-id="${escapeHtml(String(recordId))}"` : ''}>
                    <!-- 生徒名 -->
                    <div class="col-student-list" role="cell">
                        <span class="student-name">${escapeHtml(student.display_name || student.email || '')}</span>
                    </div>

                    <!-- 学習時間 -->
                    <div class="col-study-record" role="cell">
                        ${subjectsHtml}
                    </div>

                    <!-- 生徒コメント -->
                    <div class="col-student-comment" role="cell">
                        ${studentComment ? escapeHtml(studentComment) : defaultText}
                    </div>

                    <!-- 教師コメント（記録がある場合のみ編集可能な textarea を表示） -->
                    <div class="col-teacher-comment" role="cell">
                        ${isCommentable
                            ? `<textarea ${recordId ? `id="comment-${escapeHtml(String(recordId))}"` : ''} class="teacher-comment-input" placeholder="コメントを入力..." data-record-id="${isCommentable ? escapeHtml(String(recordId)) : ''}" aria-label="教師コメント">${escapeHtml(teacherComment)}</textarea>`
                            : defaultText}
                    </div>

                    <!-- チェックボックス（recordId がない場合は disabled、id は付与しない） -->
                    <div class="col-checkbox" role="cell">
                        ${isCommentable
                            ? `<input type="checkbox" class="record-checkbox" id="checkbox-${escapeHtml(String(recordId))}" data-record-id="${escapeHtml(String(recordId))}" ${!teacherComment ? 'checked' : ''} aria-label="コメント保存対象として選択">`
                            : `<input type="checkbox" class="record-checkbox" disabled aria-label="コメント保存対象として選択">`}
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
            const recordId = String(checkbox.dataset.recordId);
            const input = document.getElementById(`comment-${recordId}`);
            
            if (!input) return; // コメント入力欄が存在しない場合はスキップ

            const currentComment = input.value;
            
            // 元のコメントを特定するために、currentRecordsから元の値を取得
            const originalRecordItem = currentRecords.find(item => String(item.record?.id) === recordId);
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
        if (!str) return '';
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