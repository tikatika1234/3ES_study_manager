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
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameElement = document.getElementById('userName');
    const studentList = document.getElementById('studentList');
    const studentRecordsContainer = document.getElementById('studentRecordsContainer');

    const subjects = ['国語', '数学', '理科', '社会', 'その他'];

    // ヘルパー関数: 指定された日付の週の月曜日（ISO文字列）を取得
    function getMondayOfWeek(dateString) {
        const d = new Date(dateString);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    }

    // 認証状態の監視
    auth.onAuthStateChanged(async user => {
        if (user) {
            // ユーザーの役割をチェック
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            if (!userData || userData.role !== 'teacher') {
                alert('このページは教師専用です。');
                auth.signOut().then(() => {
                    window.location.href = 'login.html';
                });
                return;
            }
            userNameElement.textContent = user.displayName || user.email;
            loadStudents();
        } else {
            window.location.href = 'login.html';
        }
    });

    // 生徒リストを読み込み、表示する
    const loadStudents = async () => {
        try {
            const studentsSnapshot = await db.collection('users').where('role', '==', 'student').get();
            studentList.innerHTML = '';
            if (studentsSnapshot.empty) {
                studentList.innerHTML = '<p class="text-gray-500">生徒がいません。</p>';
                return;
            }
            studentsSnapshot.forEach(doc => {
                const student = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `<button class="w-full text-left p-3 rounded-md bg-white hover:bg-gray-200 transition duration-300 border border-gray-200" data-uid="${doc.id}">${student.displayName || student.email}</button>`;
                studentList.appendChild(li);
            });
            
            // 生徒選択時のイベントリスナー
            studentList.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', () => {
                    const studentId = button.dataset.uid;
                    loadStudentRecords(studentId);
                });
            });

        } catch (error) {
            console.error("Error loading students: ", error);
            studentList.innerHTML = '<p class="text-red-500">生徒リストの読み込み中にエラーが発生しました。</p>';
        }
    };

    // 選択された生徒の学習記録を読み込み、表示する
    const loadStudentRecords = async (studentId) => {
        try {
            studentRecordsContainer.innerHTML = '<p class="text-gray-500 text-center">記録を読み込み中...</p>';

            const dailyRecordsSnapshot = await db.collection('users').doc(studentId).collection('dailyRecords')
                                                .orderBy('date', 'desc')
                                                .get();
            
            const weeklySummariesSnapshot = await db.collection('users').doc(studentId).collection('weeklySummaries')
                                                    .orderBy('weekStartDate', 'desc')
                                                    .get();
            
            const weeklyData = new Map();
            dailyRecordsSnapshot.forEach(doc => {
                const record = doc.data();
                const weekStartDate = getMondayOfWeek(record.date);
                if (!weeklyData.has(weekStartDate)) {
                    weeklyData.set(weekStartDate, { goal: '', reflection: '', dailyRecords: [] });
                }
                weeklyData.get(weekStartDate).dailyRecords.push(record);
            });
            weeklySummariesSnapshot.forEach(doc => {
                const summary = doc.data();
                const weekStartDate = summary.weekStartDate;
                if (!weeklyData.has(weekStartDate)) {
                    weeklyData.set(weekStartDate, { goal: '', reflection: '', dailyRecords: [] });
                }
                weeklyData.get(weekStartDate).goal = summary.goal || '';
                weeklyData.get(weekStartDate).reflection = summary.reflection || '';
            });

            const sortedWeekStarts = Array.from(weeklyData.keys()).sort().reverse();
            studentRecordsContainer.innerHTML = '';
            
            if (sortedWeekStarts.length === 0) {
                studentRecordsContainer.innerHTML = '<p class="text-gray-500 text-center">この生徒の記録はまだありません。</p>';
                return;
            }

            sortedWeekStarts.forEach(weekStartDate => {
                const week = weeklyData.get(weekStartDate);
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

                        let studentCommentHtml = '';
                        if (record.comment) {
                            if (record.commentType === 'text') {
                                studentCommentHtml = `<p class="text-sm text-gray-600 mt-2"><strong>生徒の感想:</strong> ${record.comment}</p>`;
                            } else if (record.commentType === 'signature') {
                                studentCommentHtml = `<div class="mt-2">
                                                    <p class="text-sm text-gray-600 mb-1"><strong>生徒の感想（手書き）:</strong></p>
                                                    <img src="${record.comment}" alt="Daily Signature" class="w-full h-auto border border-gray-200 rounded-md bg-white">
                                               </div>`;
                            }
                        }

                        let teacherCommentFormHtml = `
                            <div class="mt-4 p-2 bg-gray-100 rounded-md">
                                <p class="text-sm font-semibold text-gray-800 mb-1">先生からのコメント:</p>
                                <textarea id="teacherComment-${studentId}-${record.date}" rows="3" class="w-full p-2 text-sm border border-gray-300 rounded-md" placeholder="コメントを入力してください">${record.teacherComment || ''}</textarea>
                                <button data-uid="${studentId}" data-date="${record.date}" class="save-comment-btn w-full mt-2 bg-green-500 text-white font-bold p-2 rounded-md hover:bg-green-600 transition duration-300">コメントを保存</button>
                            </div>
                        `;

                        weekHtml += `
                            <div class="record-item p-3 border border-gray-200 rounded-md shadow-sm">
                                <p class="text-gray-800 font-bold mb-1">${record.date}</p>
                                <ul class="list-disc list-inside text-sm text-gray-700">
                                    ${subjectsHtml}
                                </ul>
                                <p class="text-right text-gray-900 font-semibold mt-2">合計: ${dailyTotal}分</p>
                                ${studentCommentHtml}
                                ${teacherCommentFormHtml}
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
                    studentRecordsContainer.innerHTML += weekHtml;
                }
            });

            // コメント保存ボタンのイベントリスナー
            document.querySelectorAll('.save-comment-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const uid = e.target.dataset.uid;
                    const date = e.target.dataset.date;
                    const comment = document.getElementById(`teacherComment-${uid}-${date}`).value;
                    try {
                        await db.collection('users').doc(uid).collection('dailyRecords').doc(date).update({
                            teacherComment: comment
                        });
                        alert('コメントが保存されました！');
                    } catch (error) {
                        console.error("Error saving teacher comment: ", error);
                        alert("コメントの保存中にエラーが発生しました。");
                    }
                });
            });

        } catch (error) {
            console.error("Error fetching student records: ", error);
            studentRecordsContainer.innerHTML = '<p class="text-red-500 text-center">記録の読み込み中にエラーが発生しました。</p>';
        }
    };

    // ログアウトボタンのイベントリスナー
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    });
});
