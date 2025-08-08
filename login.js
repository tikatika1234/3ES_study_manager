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
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupBtn = document.getElementById('showSignup');
    const showLoginBtn = document.getElementById('showLogin');

    // 認証状態の監視
    auth.onAuthStateChanged(async user => {
        if (user) {
            // ログイン済みの場合、ユーザーの役割をチェックしてリダイレクト
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
        }
    });

    // ログインフォームと新規登録フォームの表示切り替え
    if (showSignupBtn && showLoginBtn) {
        showSignupBtn.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        });
        showLoginBtn.addEventListener('click', () => {
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
    }

    // ログイン処理
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.email.value;
            const password = loginForm.password.value;
            try {
                await auth.signInWithEmailAndPassword(email, password);
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
                    role: 'student', // ここで'student'を設定
                });
                alert('登録が完了しました。ログインしてください。');
                window.location.reload();
            } catch (error) {
                alert(error.message);
            }
        });
    }
});
