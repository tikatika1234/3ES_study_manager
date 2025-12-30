const API_URL = 'http://160.251.251.133:3000';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData'));
    const studentsList = document.getElementById('studentsList');
    const backBtn = document.getElementById('backBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const saveAllBtn = document.getElementById('saveAllBtn');
    const statusMsg = document.getElementById('statusMsg');

    if (!token || !userData || userData.role !== 'teacher') {
        window.location.href = 'login.html';
        return;
    }

    backBtn.addEventListener('click', () => window.location.href = 'teacher.html');
    reloadBtn.addEventListener('click', () => loadStudents());
    saveAllBtn.addEventListener('click', () => saveAll());

    let currentStudents = [];

    async function loadStudents() {
        studentsList.innerHTML = '<div style="padding:16px">読み込み中...</div>';
        try {
            const res = await fetch(`${API_URL}/api/students`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('生徒一覧の取得に失敗しました');
            let students = await res.json();

            // 担当学年・組がある場合はフィルタ（teacher.js に合わせる）
            const teacherGrade = userData.grade;
            const teacherClass = userData.class;
            if (teacherGrade != null && teacherClass != null) {
                students = students.filter(s => String(s.grade) === String(teacherGrade) && String(s.class) === String(teacherClass));
            }

            currentStudents = students;
            renderList();
        } catch (e) {
            studentsList.innerHTML = `<div style="padding:16px;color:red">エラー: ${e.message}</div>`;
        }
    }

    function renderList() {
        if (!currentStudents || currentStudents.length === 0) {
            studentsList.innerHTML = '<div style="padding:16px">対象の生徒がいません。</div>';
            return;
        }
        studentsList.innerHTML = currentStudents.map(s => {
            const rosterVal = s.roster !== undefined && s.roster !== null ? String(s.roster) : '';
            return `
                <div class="row" data-id="${s.id}">
                    <div>${escapeHtml(s.display_name || s.email || '')}</div>
                    <div>
                        <select class="grade-select">
                            <option value="">--</option>
                            ${[1,2,3,4,5,6].map(g => `<option value="${g}" ${String(s.grade)===String(g)?'selected':''}>${g}年</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <select class="class-select">
                            <option value="">--</option>
                            ${[1,2].map(c => `<option value="${c}" ${String(s.class)===String(c)?'selected':''}>${c}組</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <input type="number" class="roster-input" value="${escapeHtml(rosterVal)}" placeholder="名簿番号">
                    </div>
                    <div>
                        <button class="save-btn" data-id="${s.id}">保存</button>
                    </div>
                </div>
            `;
        }).join('');
        attachRowHandlers();
    }

    function attachRowHandlers() {
        document.querySelectorAll('.save-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.dataset.id;
                const row = document.querySelector(`.row[data-id="${id}"]`);
                if (!row) return;
                const grade = row.querySelector('.grade-select').value;
                const classVal = row.querySelector('.class-select').value;
                const rosterRaw = row.querySelector('.roster-input').value;
                const roster = rosterRaw === '' ? null : Number(rosterRaw);

                await saveStudent(id, { grade: grade || null, class: classVal || null, roster });
            });
        });
    }

    async function saveStudent(id, payload) {
        statusMsg.textContent = '保存中...';
        try {
            const res = await fetch(`${API_URL}/api/students/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(()=>({}));
            if (!res.ok) throw new Error(data.error || '保存に失敗しました');
            // 更新を反映
            const idx = currentStudents.findIndex(s => String(s.id) === String(id));
            if (idx !== -1) {
                if (payload.grade !== undefined) currentStudents[idx].grade = payload.grade;
                if (payload.class !== undefined) currentStudents[idx].class = payload.class;
                if (payload.roster !== undefined) currentStudents[idx].roster = payload.roster;
            }
            statusMsg.textContent = '保存しました';
            setTimeout(()=> statusMsg.textContent = '', 1500);
        } catch (e) {
            statusMsg.textContent = `エラー: ${e.message}`;
        }
    }

    async function saveAll() {
        const rows = Array.from(document.querySelectorAll('.row'));
        if (rows.length === 0) return;
        saveAllBtn.disabled = true;
        statusMsg.textContent = '一括保存中...';
        let success = 0, fail = 0;
        for (const row of rows) {
            const id = row.dataset.id;
            const grade = row.querySelector('.grade-select').value;
            const classVal = row.querySelector('.class-select').value;
            const rosterRaw = row.querySelector('.roster-input').value;
            const roster = rosterRaw === '' ? null : Number(rosterRaw);
            try {
                await saveStudent(id, { grade: grade || null, class: classVal || null, roster });
                success++;
            } catch {
                fail++;
            }
        }
        saveAllBtn.disabled = false;
        statusMsg.textContent = `一括保存完了 成功:${success} 失敗:${fail}`;
        setTimeout(()=> statusMsg.textContent = '', 2000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    loadStudents();
});
