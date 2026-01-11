document.addEventListener('DOMContentLoaded', () => {
    const weeklyView = document.getElementById('weeklyView');
    const dailyDetailView = document.getElementById('dailyDetailView');
    const detailDayTitle = document.getElementById('detailDayTitle');
    const backToWeeklyBtn = document.getElementById('backToWeeklyBtn');
    const currentWeekSpan = document.getElementById('currentWeek');
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');

    // 読み取り専用の要素
    const impressionTextarea = document.getElementById('impression');
    const teacherCommentTextarea = document.getElementById('teacherComment');

    // 学習時間入力フィールドの要素 (読み取り専用だが、値の表示には使う)
    const subjectInputs = [
        { id: 'japanese', hours: document.getElementById('japaneseHours'), minutes: document.getElementById('japaneseMinutes') },
        { id: 'english', hours: document.getElementById('englishHours'), minutes: document.getElementById('englishMinutes') },
        { id: 'math', hours: document.getElementById('mathHours'), minutes: document.getElementById('mathMinutes') },
        { id: 'social', hours: document.getElementById('socialHours'), minutes: document.getElementById('socialMinutes') },
        { id: 'science', hours: document.getElementById('scienceHours'), minutes: document.getElementById('scienceMinutes') },
        { id: 'other', hours: document.getElementById('otherHours'), minutes: document.getElementById('otherMinutes') },
    ];
    const totalHoursSpan = document.getElementById('totalHours');
    const totalMinutesSpan = document.getElementById('totalMinutes');
    
    // 現在の週の開始日 (月曜日を基準)
    let currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - (currentWeekStart.getDay() + 6) % 7);

    // サーバーから読み込んだデータを格納するオブジェクト（キー: YYYY-MM-DD）
    const learningData = {};

    // 日本語/英語キーを view 側の id にマッピング
    const subjectKeyMap = {
        '国語': 'japanese', '数学': 'math', '英語': 'english', '理科': 'science', '社会': 'social', 'その他': 'other',
        'japanese': 'japanese', 'math': 'math', 'english': 'english', 'science': 'science', 'social': 'social', 'other': 'other'
    };

    // --- 日付処理ヘルパー（ローカル日付ベースでキーを作成） ---
    function pad(n) { return n < 10 ? '0' + n : String(n); }
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
    function dateKeyToDate(dateKey) {
        if (!dateKey) return null;
        const [y,m,d] = dateKey.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    // --- /日付処理ヘルパー ---

    // API から記録を取得して learningData を構築
    async function fetchRecordsFromServer() {
        const userData = JSON.parse(localStorage.getItem('userData'));
        const token = localStorage.getItem('token');
        if (!userData || !token) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const res = await fetch(`/api/records/${userData.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const err = await res.json().catch(()=>({}));
                throw new Error(err.error || '記録の取得に失敗しました');
            }

            const records = await res.json();
            // records を日付キーごとに整形
            records.forEach(rec => {
                const dateObj = parseDateInput(rec.date);
                if (!dateObj) return;
                const dateKey = dateToKey(dateObj);

                learningData[dateKey] = learningData[dateKey] || {};

                // comment / teacher_comment をセット
                if (rec.comment) learningData[dateKey].impression = rec.comment;
                if (rec.teacher_comment) learningData[dateKey].teacherComment = rec.teacher_comment;

                // subjects が文字列の場合はパース
                let subjects = rec.subjects;
                if (typeof subjects === 'string') {
                    try { subjects = JSON.parse(subjects); } catch (e) { subjects = {}; }
                }
                // subjects の各キーをマッピングして h/m に変換
                Object.entries(subjects || {}).forEach(([k, v]) => {
                    const id = subjectKeyMap[k] || null;
                    const minutes = Number(v) || 0;
                    if (id) {
                        learningData[dateKey][id] = { h: Math.floor(minutes / 60), m: minutes % 60 };
                    }
                });
            });

        } catch (error) {
            console.error('記録取得エラー:', error);
            // 失敗時は空のデータのまま表示（またはエラーメッセージ表示ロジックを追加可）
        }
    }

    /**
     * 日付オブジェクトを 'YYYY年M月D日' 形式の文字列にフォーマットします。
     */
    function formatDate(date) {
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    }

    /**
     * 指定された日の学習データの合計時間を分単位で計算します。
     */
    function calculateTotalMinutes(data) {
        let total = 0;
        subjectInputs.forEach(subject => {
            if (data[subject.id]) {
                total += (data[subject.id].h * 60) + data[subject.id].m;
            }
        });
        return total;
    }

    /**
     * 合計学習時間を計算し、表示を更新します。
     */
    function updateTotalLearningTime() {
        let totalMinutes = 0;
        subjectInputs.forEach(subject => {
            // 読み取り専用フィールドから値を取得
            const hours = parseInt(subject.hours.value) || 0;
            const minutes = parseInt(subject.minutes.value) || 0;
            totalMinutes += (hours * 60) + minutes;
        });

        totalHoursSpan.textContent = Math.floor(totalMinutes / 60);
        totalMinutesSpan.textContent = totalMinutes % 60;
    }

    /**
     * 選択された日のデータを詳細ビューにロードします。
     * @param {string} dateKey - 日付キー (YYYY-MM-DD)。
     */
    function loadDailyData(dateKey) {
        const data = learningData[dateKey] || {};
        impressionTextarea.value = data.impression || 'データがありません';
        teacherCommentTextarea.value = data.teacherComment || 'まだコメントはありません';
        subjectInputs.forEach(subject => {
            subject.hours.value = data[subject.id]?.h || 0;
            subject.minutes.value = data[subject.id]?.m || 0;
        });
        updateTotalLearningTime(); // 合計時間を更新
    }
    
    /**
     * 週間表示を更新します。
     */
    function updateWeekDisplay() {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);
        currentWeekSpan.textContent = `${formatDate(currentWeekStart)} - ${formatDate(weekEnd)}`;

        weeklyView.innerHTML = '';

        const dayNames = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];
        for (let i = 0; i < 7; i++) {
            const day = new Date(currentWeekStart);
            day.setDate(currentWeekStart.getDate() + i);
            const dateKey = dateToKey(day);

            const data = learningData[dateKey];
            const totalMins = data ? calculateTotalMinutes(data) : 0;
            const hours = Math.floor(totalMins / 60);
            const minutes = totalMins % 60;
            
            const impressionText = data?.impression ? `一言感想: ${data.impression.substring(0, 15)}${data.impression.length > 15 ? '...' : ''}` : '一言感想: データなし';

            // カードを生成する際に day-card クラスを追加
            const dayCard = document.createElement('div');
            dayCard.className = 'day-card'; // ここにクラスを追加
            dayCard.dataset.date = dateKey;

            dayCard.innerHTML = `
                <h3 class="text-xl font-bold mb-2 text-gray-800">${dayNames[i]}</h3>
                <p class="text-sm text-gray-800">学習時間: ${hours}時間${minutes}分</p>
                <p class="text-sm text-gray-800">${impressionText}</p>
            `;
            weeklyView.appendChild(dayCard);
        }

        // 新しく生成されたカードにイベントリスナーを再割り当て
        document.querySelectorAll('.day-card').forEach(card => {
            card.addEventListener('click', () => {
                const dateKey = card.dataset.date;
                const d = dateKeyToDate(dateKey);
                const dayName = dayNames[d.getDay() === 0 ? 6 : d.getDay() - 1];
                detailDayTitle.textContent = `${dayName}の学習記録 (閲覧)`;
                weeklyView.classList.add('hidden');
                dailyDetailView.classList.remove('hidden');
                dailyDetailView.dataset.date = dateKey; 
                loadDailyData(dateKey);
            });
        });
    }
    
    // イベントリスナー
    backToWeeklyBtn.addEventListener('click', () => {
        dailyDetailView.classList.add('hidden');
        weeklyView.classList.remove('visible');
        weeklyView.classList.remove('hidden');
    });
    
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        updateWeekDisplay();
    });

    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        updateWeekDisplay();
    });

    // 追加: ホームへ戻る矢印ボタン処理
    // ボタン要素がなければ DOM に作成（view.html 側で既にある場合はそれを使う）
    let backToHomeBtn = document.getElementById('backToHomeBtn');
    if (!backToHomeBtn) {
        backToHomeBtn = document.createElement('button');
        backToHomeBtn.id = 'backToHomeBtn';
        backToHomeBtn.className = 'back-arrow back-arrow-circle';
        backToHomeBtn.setAttribute('aria-label', 'ホームに戻る');
        backToHomeBtn.title = 'ホームに戻る';
        backToHomeBtn.textContent = '◀';
        document.body.appendChild(backToHomeBtn);
    }
    backToHomeBtn.addEventListener('click', () => {
        window.location.href = 'student_Home.html';
    });

    // 初期ロード
    (async () => {
        await fetchRecordsFromServer();
        updateWeekDisplay();
    })();
 });