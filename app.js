document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('recordForm');
    const recordsList = document.getElementById('recordsList');

    // ローカルストレージからデータを読み込む
    const loadRecords = () => {
        const records = JSON.parse(localStorage.getItem('studyRecords')) || [];
        recordsList.innerHTML = ''; // 一度クリア
        records.forEach(record => {
            const div = document.createElement('div');
            div.className = 'record-item';
            div.textContent = `${record.date}: ${record.subject} - ${record.time}分`;
            recordsList.appendChild(div);
        });
    };

    // フォーム送信時の処理
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const date = document.getElementById('date').value;
        const subject = document.getElementById('subject').value;
        const time = parseInt(document.getElementById('time').value, 10);

        if (!date || !subject || isNaN(time) || time <= 0) {
            alert('すべての項目を正しく入力してください。');
            return;
        }

        const newRecord = { date, subject, time };
        const records = JSON.parse(localStorage.getItem('studyRecords')) || [];
        records.push(newRecord);
        localStorage.setItem('studyRecords', JSON.stringify(records));

        form.reset();
        loadRecords();
    });

    loadRecords(); // ページ読み込み時に記録を表示
});