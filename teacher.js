const API_URL = 'https://threees-study-manager.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const token = localStorage.getItem('token');

    if (!userData || !token || userData.role !== 'teacher') {
        window.location.href = 'login.html';
        return;
    }

    const studentList = document.getElementById('studentList');
    const studentRecordsContainer = document.getElementById('studentRecordsContainer');

    // 生徒一覧の取得
    const loadStudents = async () => {
        try {
            const response = await fetch(`${API_URL}/api/students`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('生徒一覧の取得に失敗しました');

            const students = await response.json();
            displayStudents(students);
        } catch (error) {
            alert(`エラー: ${error.message}`);
        }
    };

    // 生徒の記録取得
    const loadStudentRecords = async (studentId) => {
        try {
            const response = await fetch(`${API_URL}/api/records/${studentId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('生徒の記録の取得に失敗しました');

            const records = await response.json();
            displayStudentRecords(records);
        } catch (error) {
            alert(`エラー: ${error.message}`);
        }
    };

    // コメント送信
    const submitTeacherComment = async (recordId, comment) => {
        try {
            const response = await fetch(`${API_URL}/api/teacher-comment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ recordId, comment })
            });

            if (!response.ok) throw new Error('コメントの保存に失敗しました');

            alert('コメントを保存しました');
        } catch (error) {
            alert(`エラー: ${error.message}`);
        }
    };

    // 初期読み込み
    loadStudents();
});