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

    let currentStudents = [];
    let currentRecords = [];
    let sortState = { column: 0, ascending: true }; // ソート状態を管理

    userNameElement.textContent = userData.displayName || '先生';
    classTitle.textContent = `${userData.displayName || '先生'}の担当生徒の記録`;

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }

    dateSelect.value = dateToKey(new Date());

    dateSelect.addEventListener('change', () => {
        sortState = { column: 0, ascending: true }; // ソート状態をリセット
        loadStudentsAndRecords(dateSelect.value);
    });

    submitAllCommentsBtn.addEventListener('click', async () => {
        await submitAllComments();
    });

    // テーブルをソートする関数
    const sortTable = (records, ascending) => {
        const sorted = [...records].sort((a, b) => {
            const aNum = a.student?.studentNumber !== null && a.student?.studentNumber !== undefined 
                ? Number(a.student.studentNumber) 
                : Infinity;
            const bNum = b.student?.studentNumber !== null && b.student?.studentNumber !== undefined 
                ? Number(b.student.studentNumber) 
                : Infinity;
            
            return ascending ? aNum - bNum : bNum - aNum;
        });
        return sorted;
    };

    // ソート矢印のリセット
    const resetSortIndicators = () => {
        const headers = document.querySelectorAll('.sort-header');
        headers.forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
        });
    };

    // ヘッダークリックイベント
    const setupSortHeaders = () => {
        const headers = document.querySelectorAll('.sort-header');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const isCurrentlySorted = header.classList.contains('sorted-asc') || 
                                         header.classList.contains('sorted-desc');
                
                // ソート状態の切り替え
                if (isCurrentlySorted && header.classList.contains('sorted-asc')) {
                    sortState.ascending = false;
                } else {
                    sortState.ascending = true;
                }

                // 矢印をリセットして再表示
                resetSortIndicators();
                
                // ソート実行
                const sortedRecords = sortTable(currentRecords, sortState.ascending);
                currentRecords = sortedRecords;
                displayRecords(currentRecords);

                // ソート矢印を表示
                if (sortState.ascending) {
                    header.classList.add('sorted-asc');
                } else {
                    header.classList.add('sorted-desc');
                }
            });
        });
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

            displayRecords(currentRecords);
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

            // 名簿番号表示を追加（生徒名の右）
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
        
        // ソートヘッダーをセットアップ
        setupSortHeaders();
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
                            } catch (error) {
                                failCount++;
                                console.error('コメント保存失敗:', error);
                            } finally {
                                successCount++;
                            }
                        }
                
                        submitAllCommentsBtn.disabled = false;
                        submitAllCommentsBtn.textContent = 'すべてのコメントを保存';
                
                        alert(`保存完了: ${successCount}件, 失敗: ${failCount}件`);
                        displayRecords(currentRecords);
                    };
                
                    // 初期ロード
                    loadStudentsAndRecords(dateSelect.value);
                });