document.addEventListener('DOMContentLoaded', () => {
    // --- 日付処理ヘルパー（ローカル日付ベース） ---
    const pad = n => n < 10 ? '0' + n : String(n);
    function dateToKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    function parseDateInput(dateStr) {
        if (!dateStr) return null;
        const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
        if (isoDateOnly.test(dateStr)) {
            const [y,m,d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        const dt = new Date(dateStr);
        return isNaN(dt) ? null : dt;
    }
    // --- /日付処理ヘルパー ---

    // --- HTML エスケープヘルパー ---
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    // --- /HTML エスケープヘルパー ---

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
    const studentNameHeader = document.getElementById('studentNameHeader');

    let currentStudents = [];
    let currentRecords = [];
    let sortOrder = 'asc'; // 'asc' or 'desc'

    userNameElement.textContent = userData.displayName || '先生';
    classTitle.textContent = `${userData.displayName || '先生'}の担当生徒の記録`;

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }

    // ソートヘッダーのクリックイベント
    if (studentNameHeader) {
        studentNameHeader.addEventListener('click', () => {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            sortRecords();
            updateSortIndicator();
        });
    }

    dateSelect.value = dateToKey(new Date());

    dateSelect.addEventListener('change', () => {
        loadStudentsAndRecords(dateSelect.value);
    });

    submitAllCommentsBtn.addEventListener('click', async () => {
        await submitAllComments();
    });

    // ソートインジケーターの更新
    const updateSortIndicator = () => {
        const indicator = studentNameHeader.querySelector('.sort-indicator');
        if (indicator) {
            indicator.textContent = sortOrder === 'asc' ? '▲' : '▼';
        }
    };

    // レコードをソート
    const sortRecords = () => {
        currentRecords.sort((a, b) => {
            const rosterA = a.student?.roster;
            const rosterB = b.student?.roster;
            
            // roster が存在しない場合は最後に配置
            if (rosterA === undefined || rosterA === null || rosterA === '') {
                return 1;
            }
            if (rosterB === undefined || rosterB === null || rosterB === '') {
                return -1;
            }
            
            // 数値として比較
            const numA = Number(rosterA);
            const numB = Number(rosterB);
            
            // 数値に変換できない場合は文字列として比較
            if (isNaN(numA) || isNaN(numB)) {
                const strA = String(rosterA);
                const strB = String(rosterB);
                return sortOrder === 'asc' 
                    ? strA.localeCompare(strB)
                    : strB.localeCompare(strA);
            }
            
            // 数値として比較
            return sortOrder === 'asc' ? numA - numB : numB - numA;
        });
        
        displayRecords(currentRecords);
    };

    const loadStudentsAndRecords = async (date) => {
        studentRecordsContainer.innerHTML = '<p style="grid-column: 1 / -1; padding: 20px; text-align: center;">読み込み中...</p>';
        recordCountElement.textContent = '';
        
        try {
            const studentsResponse = await fetch(`/api/students`, {
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
                const recordsResponse = await fetch(`/api/records/${student.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!recordsResponse.ok) {
                    currentRecords.push({ student, record: null });
                    continue;
                }
                const allRecords = await recordsResponse.json();
                const targetRecord = allRecords.find(r => {
                    try {
                        const recDate = parseDateInput(r.date);
                        if (!recDate) return false;
                        return dateToKey(recDate) === date;
                    } catch { return false; }
                }) || null;
                currentRecords.push({ student, record: targetRecord });
            }

            // 初期表示は名簿順（昇順）
            sortOrder = 'asc';
            sortRecords();
            updateSortIndicator();
        } catch (error) {
            console.error('エラー:', error);
            studentRecordsContainer.innerHTML = `<p style="grid-column: 1 / -1; padding: 20px; text-align: center; color: red;">エラー: ${error.message}</p>`;
        }
    };

    const displayRecords = (records) => {
        recordCountElement.textContent = `表示件数: ${records.length} 件`;
        if (!records || records.length === 0) {
            studentRecordsContainer.innerHTML = '<p style="grid-column: 1 / -1; padding: 20px; text-align: center;">指定された日付の記録がありません。</p>';
            return;
        }

        const rows = records.map(({ student, record }) => {
            const recordId = record?.id ?? null;
            const isCommentable = !!recordId;

            let subjectsHtml = '<span class="no-record">記録なし</span>';
            if (record?.subjects) {
                let subjects = record.subjects;
                if (typeof subjects === 'string') {
                    try { subjects = JSON.parse(subjects); } catch (e) { subjects = {}; }
                }
                if (typeof subjects === 'object' && subjects !== null) {
                    const items = Object.entries(subjects).map(([k, v]) => {
                        const mins = typeof v === 'number' ? v : Number(v) || 0;
                        const h = Math.floor(mins / 60);
                        const m = mins % 60;
                        return `<p>${escapeHtml(k)}: ${h}時間${m}分</p>`;
                    });
                    subjectsHtml = items.join('');
                }
            }

            const studentComment = record?.comment ? escapeHtml(record.comment) : '<span class="no-record">記録なし</span>';
            const teacherComment = record?.teacher_comment || '';
            const recIdStr = isCommentable ? String(recordId) : '';

            const rosterDisplay = student?.roster !== undefined && student?.roster !== null && student?.roster !== '' ? ` <span class="roster">(#${escapeHtml(String(student.roster))})</span>` : '';

            return `
                <div class="record-row" data-record-id="${recIdStr}">
                    <div class="col-student-list">
                        ${escapeHtml(student.display_name || student.email || '')}${rosterDisplay}
                    </div>
                    <div class="col-study-record">
                        ${subjectsHtml}
                    </div>
                    <div class="col-student-comment">
                        ${studentComment}
                    </div>
                    <div class="col-teacher-comment">
                        ${isCommentable
                            ? `<textarea id="comment-${recIdStr}" class="teacher-comment-input" placeholder="コメントを入力..." data-record-id="${recIdStr}">${escapeHtml(teacherComment)}</textarea>`
                            : '<span class="no-record">記録なし</span>'}
                    </div>
                    <div class="col-checkbox">
                        ${isCommentable
                            ? `<input type="checkbox" class="record-checkbox" id="checkbox-${recIdStr}" data-record-id="${recIdStr}" ${!teacherComment ? 'checked' : ''}>`
                            : `<input type="checkbox" disabled>`}
                    </div>
                </div>
            `;
        }).join('');

        studentRecordsContainer.innerHTML = rows;
    };

    const submitAllComments = async () => {
        const checkedBoxes = document.querySelectorAll('.record-checkbox:checked');
        
        if (checkedBoxes.length === 0) {
            alert('チェックされた記録がありません。');
            return;
        }
        
        const commentsToSave = [];
        checkedBoxes.forEach(checkbox => {
            const recordId = String(checkbox.dataset.recordId);
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
            alert('変更されたコメントがありません。');
            return;
        }

        submitAllCommentsBtn.disabled = true;
        submitAllCommentsBtn.textContent = `保存中... (${commentsToSave.length}件)`;

        let successCount = 0;
        let failCount = 0;

        for (const { recordId, comment } of commentsToSave) {
            try {
                const response = await fetch(`/api/teacher-comment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ recordId, comment })
                });

                if (!response.ok) {
                    throw new Error(await response.json().then(e => e.error || 'エラー'));
                }

                const updatedRecordItem = currentRecords.find(item => String(item.record?.id) === recordId);
                if (updatedRecordItem && updatedRecordItem.record) {
                    updatedRecordItem.record.teacher_comment = comment;
                }

                successCount++;
            } catch (error) {
                console.error(`Record ID ${recordId} のコメント保存に失敗:`, error);
                failCount++;
            }
        }

        submitAllCommentsBtn.disabled = false;
        submitAllCommentsBtn.textContent = 'チェック済みを保存';

        alert(`保存完了: ${successCount}件成功, ${failCount}件失敗`);
        displayRecords(currentRecords);
    };

    // 初期ロード
    loadStudentsAndRecords(dateSelect.value);
});