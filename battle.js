document.addEventListener('DOMContentLoaded', () => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const token = localStorage.getItem('token');

    // 認証チェック
    if (!userData || !token) {
        window.location.href = 'login.html';
        return;
    }

    // 教師はアクセス不可
    if (userData.role === 'teacher') {
        alert('教師はこのページにアクセスできません');
        window.location.href = 'teacher.html';
        return;
    }

    /* ========== 要素取得 ========== */
    const battleTitle = document.getElementById('battleTitle');
    const periodForm = document.getElementById('periodForm');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const fetchBtn = document.getElementById('fetchBtn');
    const resultContainer = document.getElementById('resultContainer');
    const backBtn = document.getElementById('backBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    /* ========== 初期表示 ========== */
    if (battleTitle) {
        battleTitle.textContent = '勉強記録合戦（仮）';
    }

    // 日付入力の初期値（今日の日付）
    const today = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (startDateInput) startDateInput.value = oneWeekAgo;
    if (endDateInput) endDateInput.value = today;

    /* ========== 期間別学習時間取得 ========== */
    const fetchBattleData = async () => {
        try {
            if (!startDateInput || !endDateInput) {
                alert('日付入力が見つかりません');
                return;
            }

            const startDate = startDateInput.value;
            const endDate = endDateInput.value;

            if (!startDate || !endDate) {
                alert('開始日と終了日を入力してください');
                return;
            }

            if (new Date(startDate) > new Date(endDate)) {
                alert('開始日は終了日より前に設定してください');
                return;
            }

            // APIで期間別データを取得
            const res = await fetch(
                `/api/battle-stats?startDate=${startDate}&endDate=${endDate}&studentId=${userData.id}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'データ取得に失敗しました');
            }

            const data = await res.json();
            displayBattleResult(data, startDate, endDate);

        } catch (error) {
            console.error('データ取得エラー:', error);
            if (resultContainer) {
                resultContainer.innerHTML = `<div class="text-red-500">エラー: ${escapeHtml(error.message)}</div>`;
            }
        }
    };

    /* ========== 結果表示 ========== */
    const displayBattleResult = (data, startDate, endDate) => {
        if (!resultContainer) return;

        // 現在のUIは仮ですので、簡易的に総学習時間を表示
        const html = `
            <div style="padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h3>期間: ${escapeHtml(startDate)} ～ ${escapeHtml(endDate)}</h3>
                <div style="margin-top: 20px;">
                    <p><strong>あなたの総学習時間:</strong> ${escapeHtml(String(data.totalMinutes || 0))} 分</p>
                    <details style="margin-top: 10px;">
                        <summary>科目別詳細</summary>
                        <div style="margin-top: 10px;">
                            ${data.subjectBreakdown && Object.keys(data.subjectBreakdown).length > 0
                                ? Object.entries(data.subjectBreakdown)
                                    .map(([subject, minutes]) => 
                                        `<p>${escapeHtml(subject)}: ${escapeHtml(String(minutes))} 分</p>`
                                    ).join('')
                                : '<p>記録がありません</p>'
                            }
                        </div>
                    </details>
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #999;">
                    ※ 仮画面です。HTML・CSSは後ほど反映されます
                </p>
            </div>
        `;

        resultContainer.innerHTML = html;
    };

    /* ========== ボタンイベント ========== */
    if (fetchBtn) {
        fetchBtn.addEventListener('click', fetchBattleData);
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'student_Home.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        });
    }

    /* ========== XSS対策 ========== */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
});
