// teacher.js (置き換えファイル)
// ファイルパス: teacher.js

const API_URL = 'https://threees-study-manager.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const token = localStorage.getItem('token');

    if (!userData || !token || userData.role !== 'teacher') {
        window.location.href = 'login.html';
        return;
    }

    const dateSelect = document.getElementById('dateSelect');
    const studentRecordsContainer = document.getElementById('studentRecordsContainer');
    const userNameElement = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const classTitle = document.getElementById('classTitle');
    const submitAllCommentsBtn = document.getElementById('submitAllCommentsBtn');
    const recordCountElement = document.getElementById('recordCount');

    let currentStudents = [];
    let currentRecords = [];

    userNameElement.textContent = userData.displayName || '先生';
    classTitle.textContent = `${userData.displayName || '先生'}の担当生徒の記録`;

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }

    dateSelect.value = new Date().toISOString().split('T')[0];

    dateSelect.addEventListener('change', () => {
        loadStudentsAndRecords(dateSelect.value);
    });

    submitAllCommentsBtn.addEventListener('click', async () => {
        await submitAllComments();
    });

    const loadStudentsAndRecords = async (date) => {
        studentRecordsContainer.innerHTML = '<p style="padding: 20px; text-align: center; grid-column: 1 / -1;">生徒と記録を読み込み中...</p>';
        recordCountElement.textContent = '';

        try {
            const studentsResponse = await fetch(`${API_URL}/api/students`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!studentsResponse.ok) throw new Error('生徒一覧の取得に失敗しました');
            let students = await studentsResponse.json();

            const teacherGrade = userData.grade;
            const teacherClass = userData.class;
            if (teacherGrade != null && teacherClass != null) {
                students = students.filter(s => String(s.grade) === String(teacherGrade) && String(s.class) === String(teacherClass));
            }
            currentStudents = students;

            currentRecords = [];
            for (const student of currentStudents) {
                try {
                    const recordsResponse = await fetch(`${API_URL}/api/records/${student.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!recordsResponse.ok) {
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
                } catch (e) {
                    // 個別失敗は空扱いで継続
                    currentRecords.push({ student, record: null });
                }
            }

            displayStudentRecordsTable(currentRecords);
        } catch (error) {
            console.error('データ取得エラー:', error);
            studentRecordsContainer.innerHTML = `<p style="padding: 20px; text-align: center; grid-column: 1 / -1;" class="text-red-500">エラー: ${error.message}</p>`;
        }
    };

    const displayStudentRecordsTable = (records) => {
        recordCountElement.textContent = `表示件数: ${records.length} 件`;
        if (!records || records.length === 0) {
            studentRecordsContainer.innerHTML = '<p style="padding: 20px; text-align: center; grid-column: 1 / -1;">指定された日付の記録がありません。</p>';
            return;
        }

        const rowsHtml = records.map(({ student, record }) => {
            const studentName = escapeHtml(student.display_name || student.email || '名無し');
            const recordId = record?.id ?? null;

            // 学習時間: 全科目の合計（minutes または {h,m} の混在に対応）
            let totalMinutes = 0;
            if (record && record.subjects) {
                let subjects = record.subjects;
                if (typeof subjects === 'string') {
                    try { subjects = JSON.parse(subjects); } catch { subjects = {}; }
                }
                if (typeof subjects === 'object' && subjects !== null) {
                    for (const [, v] of Object.entries(subjects)) {
                        if (typeof v === 'number') {
                            totalMinutes += Number(v) || 0;
                        } else if (v && typeof v === 'object') {
                            const h = Number(v.h) || 0;
                            const m = Number(v.m) || 0;
                            totalMinutes += h * 60 + m;
                        }
                    }
                }
            }
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            const studyTimeHtml = (totalMinutes > 0) ? `<p>合計: ${hours}時間${mins}分</p>` : '<span class="text-gray-400">記録なし</span>';

            // 生徒コメント
            const studentComment = record?.comment || '';

            // 教師コメント: レコードがある場合は有効な textarea (id を付与)、ない場合は disabled の textarea を表示
            let teacherCommentHtml = '';
            if (recordId) {
                const teacherComment = record?.teacher_comment || '';
                teacherCommentHtml = `<textarea id="comment-${recordId}" class="teacher-comment-input" placeholder="コメントを入力..." data-record-id="${recordId}" aria-label="教師コメント">${escapeHtml(teacherComment)}</textarea>`;
            } else {
                teacherCommentHtml = `<textarea class="teacher-comment-input" placeholder="該当日の記録がないためコメント不可" disabled aria-label="教師コメント（無効）"></textarea>`;
            }

            // チェックボックス: レコードがない場合は disabled。チェックボックスのみ表示
            const checkboxHtml = recordId
                ? `<input type="checkbox" class="record-checkbox" id="checkbox-${recordId}" data-record-id="${recordId}" aria-label="コメント保存対象として選択">`
                : `<input type="checkbox" class="record-checkbox" aria-label="コメント保存対象（無効）" disabled>`;

            return `
                <div class="table-row" role="row" data-record-id="${recordId ?? ''}">
                    <div class="col-student-list" role="cell">
                        <span class="student-name">${studentName}</span>
                    </div>

                    <div class="col-study-record record-detail" role="cell">
                        ${studyTimeHtml}
                    </div>

                    <div class="col-student-comment" role="cell">
                        ${studentComment ? escapeHtml(studentComment) : '<span class="text-gray-400">記録なし</span>'}
                    </div>

                    <div class="col-teacher-comment" role="cell">
                        ${teacherCommentHtml}
                    </div>

                    <div class="col-checkbox" role="cell">
                        ${checkboxHtml}
                    </div>
                </div>
            `;
        }).join('');

        studentRecordsContainer.innerHTML = rowsHtml;
    };

    const submitAllComments = async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.record-checkbox:checked'));

        if (checkedBoxes.length === 0) {
            alert('保存対象としてチェックされた記録がありません。');
            return;
        }

        const commentsToSave = [];

        checkedBoxes.forEach(checkbox => {
            const recordId = String(checkbox.dataset.recordId || '');
            if (!recordId) return; // レコードIDがないチェック（本来disabled）は無視

            const input = document.getElementById(`comment-${recordId}`);
            if (!input) return;

            const currentComment = input.value;
            const originalRecordItem = currentRecords.find(item => String(item.record?.id) === recordId);
            const originalComment = originalRecordItem?.record?.teacher_comment || '';

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
                    const error = await response.json().catch(()=>({error: '不明なエラー'}));
                    throw new Error(error.error || `ID ${recordId} のコメント保存に失敗しました`);
                }

                const updatedRecordItem = currentRecords.find(item => String(item.record?.id) === String(recordId));
                if (updatedRecordItem) {
                    updatedRecordItem.record.teacher_comment = comment;
                    const savedCheckbox = document.getElementById(`checkbox-${recordId}`);
                    if (savedCheckbox) savedCheckbox.checked = false;
                }

                successCount++;
            } catch (error) {
                console.error('コメント保存エラー:', error.message || error);
                failCount++;
            }
        }

        submitAllCommentsBtn.disabled = false;
        submitAllCommentsBtn.textContent = '✅ チェック済みを保存';

        alert(`コメントの保存が完了しました。\n成功: ${successCount}件\n失敗: ${failCount}件`);
    };

    const escapeHtml = (str) => {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    loadStudentsAndRecords(dateSelect.value);
});
