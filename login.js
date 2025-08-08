// Firebaseの初期化設定（あなたのFirebaseコンソールの設定に置き換えてください）
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupBtn = document.getElementById('showSignup');
    const showLoginBtn = document.getElementById('showLogin');

    // 認証状態の監視
    auth.onAuthStateChanged(user => {
        if (user) {
            // ログイン済みの場合、ホーム画面にリダイレクト
            window.location.href = 'index.html';
        }
    });

    // ログイン処理
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.email.value;
            const password = loginForm.password.value;
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                // ログイン成功後、ユーザーの役割をチェック
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.role === 'teacher') {
                        window.location.href = 'teacher.html';
                    } else {
                        window.location.href = 'record.html';
                    }
                } else {
                    // ドキュメントが存在しない場合は生徒として扱う
                    window.location.href = 'record.html';
                }
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // 新規登録処理
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = signupForm.email.value;
            const password = signupForm.password.value;
            const displayName = signupForm.displayName.value;
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                await user.updateProfile({ displayName: displayName });
                // 新規ユーザーをFirestoreに保存し、初期ロールを'student'に設定
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    displayName: displayName,
                    role: 'student', // 新規登録時はデフォルトで生徒
                });
                alert('登録が完了しました。ログインしてください。');
                window.location.reload();
            } catch (error) {
                alert(error.message);
            }
        });
    }
});
