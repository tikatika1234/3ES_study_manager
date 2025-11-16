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

    // ダミーデータストレージ (閲覧のみのため、初期値を設定)
    const learningData = {
        // 例として、過去のデータを設定
        '2025-11-03': { 
            impression: '数学の難しい問題に挑戦できて達成感がありました！', 
            teacherComment: '頑張りが伝わってきます。この調子で続けてください！',
            japanese: {h: 0, m: 30}, english: {h: 1, m: 0}, math: {h: 1, m: 30},
            social: {h: 0, m: 0}, science: {h: 0, m: 0}, other: {h: 0, m: 0}
        },
        '2025-11-04': { 
            impression: '理科のレポートに時間がかかりましたが、丁寧に取り組みました。', 
            teacherComment: '',
            japanese: {h: 0, m: 0}, english: {h: 0, m: 0}, math: {h: 0, m: 0},
            social: {h: 0, m: 0}, science: {h: 2, m: 0}, other: {h: 0, m: 0}
        }
    };

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
            const dateKey = day.toISOString().split('T')[0];

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
                const dayName = dayNames[new Date(dateKey).getDay() === 0 ? 6 : new Date(dateKey).getDay() - 1];
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

    // 初期ロード
    updateWeekDisplay();
});