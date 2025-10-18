// Firebase config (from user)
const firebaseConfig = {
  apiKey: "AIzaSyA_jhaLrDW_CXxN4iT-O2rlAWA0Q0AK66w",
  authDomain: "site2-c479a.firebaseapp.com",
  projectId: "site2-c479a",
  storageBucket: "site2-c479a.firebasestorage.app",
  messagingSenderId: "140276684303",
  appId: "1:140276684303:web:e6bb0bf5a3f9dd3b00357a",
  measurementId: "G-X1BDKR6XMP"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.log('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
    } else if (err.code == 'unimplemented') {
      console.log('Browser doesn\'t support persistence');
    }
  });

// UI elements
const signInBtn = document.getElementById('sign-in-btn');
const viewCheckedBtn = document.getElementById('view-checked');
const itemsList = document.getElementById('items');
const addForm = document.getElementById('add-form');
const newItemInput = document.getElementById('new-item');
const checkedModal = document.getElementById('checked-modal');
const closeChecked = document.getElementById('close-checked');
const checkedList = document.getElementById('checked-list');

let currentUser = null;
let unsubscribeItems = null;

// Auth UI: open modal for sign in / register, Google sign-in, sign-out
const authModal = document.getElementById('auth-modal');
const authClose = document.getElementById('auth-close');
const signInForm = document.getElementById('sign-in-form');
const registerForm = document.getElementById('register-form');
const tabSignin = document.getElementById('tab-signin');
const tabRegister = document.getElementById('tab-register');
const googleSigninBtn = document.getElementById('google-signin');

// Tab switching
function switchAuthTab(showSignIn) {
  tabSignin.classList.toggle('active', showSignIn);
  tabRegister.classList.toggle('active', !showSignIn);
  signInForm.classList.toggle('hidden', !showSignIn);
  registerForm.classList.toggle('hidden', showSignIn);
}

tabSignin.addEventListener('click', () => switchAuthTab(true));
tabRegister.addEventListener('click', () => switchAuthTab(false));

signInBtn.addEventListener('click', async () => {
  if (!currentUser) {
    authModal.classList.remove('hidden');
    switchAuthTab(true); // default to sign-in tab
  } else {
    await auth.signOut();
  }
});

authClose.addEventListener('click', () => authModal.classList.add('hidden'));

showRegister.addEventListener('click', (e)=>{ e.preventDefault(); signInForm.classList.add('hidden'); registerForm.classList.remove('hidden'); document.getElementById('auth-title').textContent = 'Create account'; });
showSignin.addEventListener('click', (e)=>{ e.preventDefault(); registerForm.classList.add('hidden'); signInForm.classList.remove('hidden'); document.getElementById('auth-title').textContent = 'Sign in'; });

googleSigninBtn.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try { await auth.signInWithPopup(provider); authModal.classList.add('hidden'); } catch(e){ alert(e.message); }
});

// Handle sign in form
signInForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('sign-email').value.trim();
  const pw = document.getElementById('sign-password').value;
  
  try {
    // Sign in with Firebase Auth
    const userCred = await auth.signInWithEmailAndPassword(email, pw);
    if (userCred.user) {
      // Check if user document exists, create if not
      const userDoc = await db.collection('users').doc(userCred.user.uid).get();
      if (!userDoc.exists) {
        await db.collection('users').doc(userCred.user.uid).set({
          email: userCred.user.email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      authModal.classList.add('hidden');
    }
  } catch(e) {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-message';
    errorBox.textContent = e.message;
    signInForm.insertBefore(errorBox, signInForm.firstChild);
    setTimeout(() => errorBox.remove(), 5000);
  }
});

// Handle register form
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const pw = document.getElementById('reg-password').value;
  const conf = document.getElementById('reg-confirm').value;
  
  if (pw !== conf) {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-message';
    errorBox.textContent = 'Passwords do not match';
    registerForm.insertBefore(errorBox, registerForm.firstChild);
    setTimeout(() => errorBox.remove(), 5000);
    return;
  }
  
  try {
    // Create user in Firebase Auth
    const userCred = await auth.createUserWithEmailAndPassword(email, pw);
    if (userCred.user) {
      // Create user document in Firestore
      await db.collection('users').doc(userCred.user.uid).set({
        email: userCred.user.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Create default bucket list collection
      await db.collection('users').doc(userCred.user.uid).collection('items').add({
        text: 'Welcome to your bucket list! Check this item to get started.',
        checked: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      authModal.classList.add('hidden');
    }
  } catch(e) {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-message';
    errorBox.textContent = e.message;
    registerForm.insertBefore(errorBox, registerForm.firstChild);
    setTimeout(() => errorBox.remove(), 5000);
  }
});

// Show checked modal
viewCheckedBtn.addEventListener('click', () => {
  if (!currentUser) { 
    const errorBox = document.createElement('div');
    errorBox.className = 'error-message';
    errorBox.textContent = 'Please sign in to view your checked items.';
    document.querySelector('.card').insertBefore(errorBox, itemsList);
    setTimeout(() => errorBox.remove(), 3000);
    return; 
  }
  checkedModal.classList.remove('hidden');
  loadCheckedItems();
});
closeChecked.addEventListener('click', () => checkedModal.classList.add('hidden'));

// Add item with user data
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = newItemInput.value.trim();
  if (!text) return;
  
  if (!currentUser) { 
    const errorBox = document.createElement('div');
    errorBox.className = 'error-message';
    errorBox.textContent = 'Please sign in to add items to your bucket list.';
    addForm.insertBefore(errorBox, addForm.firstChild);
    setTimeout(() => errorBox.remove(), 3000);
    return; 
  }
  
  try {
    // Add item to user's collection with metadata
    await db.collection('users').doc(currentUser.uid).collection('items').add({
      text,
      checked: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || null
      }
    });
    newItemInput.value = '';
  } catch (e) {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-message';
    errorBox.textContent = 'Error adding item. Please try again.';
    addForm.insertBefore(errorBox, addForm.firstChild);
    setTimeout(() => errorBox.remove(), 3000);
  }
});

// Render items list
function renderItem(doc) {
  const data = doc.data();
  const li = document.createElement('li');
  li.dataset.id = doc.id;
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = !!data.checked;
  checkbox.disabled = !!data.checked; // cannot uncheck once checked

  const span = document.createElement('span');
  span.textContent = data.text;

  const meta = document.createElement('div');
  meta.className = 'meta';
  if (data.createdAt && data.createdAt.toDate) {
    meta.textContent = new Date(data.createdAt.toDate()).toLocaleString();
  }

  checkbox.addEventListener('change', async () => {
    if (checkbox.checked) {
      // mark checked with timestamp and order (timestamp sufficient)
      await db.collection('users').doc(currentUser.uid).collection('items').doc(doc.id).update({
        checked: true,
        checkedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    // do not allow uncheck - UI will stay disabled after update
  });

  li.appendChild(checkbox);
  li.appendChild(span);
  li.appendChild(meta);
  itemsList.appendChild(li);
}

function clearItems(){ itemsList.innerHTML = ''; }

// Load checked items into modal, ordered by checkedAt asc (order they were checked)
async function loadCheckedItems(){
  checkedList.innerHTML = '';
  const snapshot = await db.collection('users').doc(currentUser.uid).collection('items')
    .where('checked','==',true).orderBy('checkedAt','asc').get();
  snapshot.forEach(doc => {
    const d = doc.data();
    const li = document.createElement('li');
    const t = d.text;
    const time = d.checkedAt && d.checkedAt.toDate ? new Date(d.checkedAt.toDate()).toLocaleString() : 'Unknown time';
    li.textContent = `${t} — ${time}`;
    checkedList.appendChild(li);
  });
}

// Listen for auth changes
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    signInBtn.textContent = 'Sign out';
    viewCheckedBtn.disabled = false;
    // start listening to user's items
    if (unsubscribeItems) unsubscribeItems();
    unsubscribeItems = db.collection('users').doc(user.uid).collection('items')
      .orderBy('createdAt','asc')
      .onSnapshot(snapshot => {
        // re-render
        clearItems();
        snapshot.forEach(doc => renderItem(doc));
      }, err => { console.error(err); });
  } else {
    signInBtn.textContent = 'Sign in';
    viewCheckedBtn.disabled = true;
    if (unsubscribeItems) unsubscribeItems();
    clearItems();
  }
});

// Disable checked view until signed in
viewCheckedBtn.disabled = true;
