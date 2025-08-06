// Firebaseの初期化設定（あなたのFirebaseコンソールの設定に置き換えてください）
const firebaseConfig = {
  apiKey: "AIzaSyAP2qW_nwiBbmrBQvjP6i69udDqpP8tbfM",
  authDomain: "esstudymanager.firebaseapp.com",
  projectId: "esstudymanager",
  storageBucket: "esstudymanager.firebasestorage.app",
  messagingSenderId: "9424358863",
  appId: "1:9424358863:web:b1e87b6aad908ed12596ba",
  measurementId: "G-4QGE07EM22"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素を取得
    const logoutBtn = document.getElementById('logoutBtn');
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    const userNameElement = document.getElementById('userName');
    const recordForm = document.getElementById('recordForm');
    const recordsList = document.getElementById('recordsList');
    const dateInput = document.getElementById('date');

    // 週ごとの目標と振り返り用のDOM要素
    const weeklySummaryForm = document.getElementById('weeklySummaryForm');
    const weeklyGoalInput = document.getElementById('weeklyGoal');
    const weeklyReflectionInput = document.getElementById('weeklyReflection');
    const saveWeeklySummaryBtn = document.getElementById('saveWeeklySummaryBtn');

    // 教科のリスト
    const subjects = ['国語', '数学', '理科', '社会', 'その他'];

    // 日付入力の最大値を今日に設定し、初期値を今日に設定
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    dateInput.setAttribute('max', todayISO);
    dateInput.value = todayISO;

    // ヘルパー関数: 指定された日付の週の月曜日（ISO文字列）を取得
    function getMondayOfWeek(dateString) {
        const d = new Date(dateString);
        d.setHours(0, 0, 0, 0); // 時刻をリセットして日付のみを扱う
        const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        // 月曜日に調整 (getDay()が0=日曜日の場合、-6日して月曜日にする)
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    }

    // 認証状態の監視
    auth.onAuthStateChanged(user => {
        if (user) {
            // ログイン済みの場合
            userNameElement.textContent = user.displayName || user.email;
            loadWeeklyRecords(user.uid); // 週ごとの記録を読み込む
            loadCurrentWeekSummary(user.uid); // 今週の目標と振り返りを読み込む
        } else {
            // 未ログインの場合、ログインページにリダイレクト
            window.location.href = 'login.html';
        }
    });

    // フォーム送信時の処理（Firestoreへの書き込み）
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const date = dateInput.value;
        const selectedDate = new Date(date);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6); // 今日から6日前 = 過去7日間

        // 日付のバリデーション (当日を含む過去7日間のみ許可)
        if (selectedDate > today || selectedDate < sevenDaysAgo) {
            alert('記録できるのは当日を含む過去7日間のみです。');
            return;
        }

        const dailyRecord = {
            date: date,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        let totalTimeForDay = 0;
        subjects.forEach(subject => {
            const time = parseInt(document.getElementById(subject).value, 10);
            if (isNaN(time) || time < 0) {
                alert(`${subject}の時間を正しく入力してください。`);
                return; // エラーがあれば処理を中断
            }
            dailyRecord[subject] = time;
            totalTimeForDay += time;
        });

        if (totalTimeForDay === 0) {
            alert('いずれかの教科に0分より大きい時間を入力してください。');
            return;
        }

        try {
            // 日付をドキュメントIDとして使用し、既存の記録があれば更新、なければ新規作成
            await db.collection('users').doc(user.uid).collection('dailyRecords').doc(date).set(dailyRecord, { merge: true });
            alert('記録が保存されました！');
            // フォームをリセット（日付は今日に戻す）
            recordForm.reset();
            dateInput.value = todayISO;
            subjects.forEach(subject => {
                document.getElementById(subject).value = 0; // 各教科の時間を0にリセット
            });
            loadWeeklyRecords(user.uid); // 週ごとの記録リストを再読み込み
        } catch (error) {
            console.error("Error adding/updating document: ", error);
            alert("データの記録中にエラーが発生しました。");
        }
    });

    // 週ごとの目標と振り返りフォームの送信処理
    weeklySummaryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const currentWeekMonday = getMondayOfWeek(todayISO);
        const goal = weeklyGoalInput.value;
        const reflection = weeklyReflectionInput.value;

        try {
            await db.collection('users').doc(user.uid).collection('weeklySummaries').doc(currentWeekMonday).set({
                weekStartDate: currentWeekMonday,
                goal: goal,
                reflection: reflection,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            alert('目標と振り返りが保存されました！');
            loadWeeklyRecords(user.uid); // 週ごとの記録リストを再読み込み
        } catch (error) {
            console.error("Error saving weekly summary: ", error);
            alert("目標と振り返りの保存中にエラーが発生しました。");
        }
    });

    // 今週の目標と振り返りを読み込み、フォームに表示する関数
    const loadCurrentWeekSummary = async (uid) => {
        const currentWeekMonday = getMondayOfWeek(todayISO);
        try {
            const doc = await db.collection('users').doc(uid).collection('weeklySummaries').doc(currentWeekMonday).get();
            if (doc.exists) {
                const data = doc.data();
                weeklyGoalInput.value = data.goal || '';
                weeklyReflectionInput.value = data.reflection || '';
            } else {
                weeklyGoalInput.value = '';
                weeklyReflectionInput.value = '';
            }
        } catch (error) {
            console.error("Error loading current week summary: ", error);
        }
    };

    // Firestoreから週ごとの記録を読み込み、表示する関数
    const loadWeeklyRecords = async (uid) => {
        try {
            recordsList.innerHTML = '<p class="text-gray-500 text-center">記録を読み込み中...</p>';
            
            // 全てのdailyRecordsとweeklySummariesを取得
            const dailyRecordsSnapshot = await db.collection('users').doc(uid).collection('dailyRecords')
                                                .orderBy('date', 'desc') // 日付でソート
                                                .get();
            
            const weeklySummariesSnapshot = await db.collection('users').doc(uid).collection('weeklySummaries')
                                                    .orderBy('weekStartDate', 'desc') // 週の開始日でソート
                                                    .get();

            const weeklyData = new Map(); // { 'YYYY-MM-DD': { goal: '', reflection: '', dailyRecords: [] } }

            // dailyRecordsを週ごとにグループ化
            dailyRecordsSnapshot.forEach(doc => {
                const record = doc.data();
                const weekStartDate = getMondayOfWeek(record.date);
                if (!weeklyData.has(weekStartDate)) {
                    weeklyData.set(weekStartDate, { goal: '', reflection: '', dailyRecords: [] });
                }
                weeklyData.get(weekStartDate).dailyRecords.push(record);
            });

            // weeklySummariesを結合
            weeklySummariesSnapshot.forEach(doc => {
                const summary = doc.data();
                const weekStartDate = summary.weekStartDate;
                if (!weeklyData.has(weekStartDate)) {
                    weeklyData.set(weekStartDate, { goal: '', reflection: '', dailyRecords: [] });
                }
                weeklyData.get(weekStartDate).goal = summary.goal || '';
                weeklyData.get(weekStartDate).reflection = summary.reflection || '';
            });

            // 週の開始日でソート（新しい週が上に来るように）
            const sortedWeekStarts = Array.from(weeklyData.keys()).sort().reverse();

            recordsList.innerHTML = ''; // リストをクリア
            if (sortedWeekStarts.length === 0) {
                recordsList.innerHTML = '<p class="text-gray-500 text-center">まだ記録がありません。</p>';
                return;
            }

            sortedWeekStarts.forEach(weekStartDate => {
                const week = weeklyData.get(weekStartDate);
                
                // 記録、目標、振り返りのいずれかがある週のみ表示
                if (week.dailyRecords.length > 0 || week.goal || week.reflection) {
                    let weekHtml = `
                        <div class="weekly-summary-item bg-blue-50 p-4 rounded-lg shadow-md mb-6">
                            <h3 class="text-xl font-bold text-blue-800 mb-3">${weekStartDate}の週</h3>
                            <div class="mb-4">
                                <h4 class="font-semibold text-blue-700 mb-1">今週の目標:</h4>
                                <p class="text-gray-700 whitespace-pre-wrap">${week.goal || '目標は設定されていません'}</p>
                            </div>
                            <h4 class="font-semibold text-blue-700 mb-2">学習記録:</h4>
                            <div class="space-y-2">
                    `;
                    
                    // 週内の日々の記録を日付の新しい順にソート
                    week.dailyRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

                    week.dailyRecords.forEach(record => {
                        let dailyTotal = 0;
                        let subjectsHtml = '';
                        subjects.forEach(subject => {
                            const time = record[subject] || 0;
                            if (time > 0) {
                                subjectsHtml += `<li>${subject}: ${time}分</li>`;
                                dailyTotal += time;
                            }
                        });
                        weekHtml += `
                            <div class="record-item p-3 border border-gray-200 rounded-md shadow-sm">
                                <p class="text-gray-800 font-bold mb-1">${record.date}</p>
                                <ul class="list-disc list-inside text-sm text-gray-700">
                                    ${subjectsHtml}
                                </ul>
                                <p class="text-right text-gray-900 font-semibold mt-2">合計: ${dailyTotal}分</p>
                            </div>
                        `;
                    });

                    weekHtml += `
                            </div>
                            <div class="mt-4">
                                <h4 class="font-semibold text-blue-700 mb-1">今週の振り返り:</h4>
                                <p class="text-gray-700 whitespace-pre-wrap">${week.reflection || '振り返りはまだありません'}</p>
                            </div>
                        </div>
                    `;
                    recordsList.innerHTML += weekHtml;
                }
            });
        } catch (error) {
            console.error("Error fetching documents: ", error);
            recordsList.innerHTML = '<p class="text-red-500 text-center">データの読み込み中にエラーが発生しました。</p>';
        }
    };

    // ログアウトボタンのイベントリスナー
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    });

    // ホームに戻るボタンのイベントリスナー
    backToHomeBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});
