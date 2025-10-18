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
const showRegister = document.getElementById('show-register');
const showSignin = document.getElementById('show-signin');
const googleSigninBtn = document.getElementById('google-signin');

signInBtn.addEventListener('click', async () => {
  if (!currentUser) {
    authModal.classList.remove('hidden');
    // show sign-in form
    document.getElementById('auth-title').textContent = 'Sign in';
    signInForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
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

signInForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = document.getElementById('sign-email').value.trim();
  const pw = document.getElementById('sign-password').value;
  try { await auth.signInWithEmailAndPassword(email, pw); authModal.classList.add('hidden'); }
  catch(e){ alert(e.message); }
});

registerForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const pw = document.getElementById('reg-password').value;
  const conf = document.getElementById('reg-confirm').value;
  if (pw !== conf) { alert('Passwords do not match'); return; }
  try { await auth.createUserWithEmailAndPassword(email, pw); authModal.classList.add('hidden'); }
  catch(e){ alert(e.message); }
});

// Show checked modal
viewCheckedBtn.addEventListener('click', () => {
  if (!currentUser) { alert('Please sign in to view your checked items.'); return; }
  checkedModal.classList.remove('hidden');
  loadCheckedItems();
});
closeChecked.addEventListener('click', () => checkedModal.classList.add('hidden'));

// Add item
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = newItemInput.value.trim();
  if (!text) return;
  if (!currentUser) { alert('Please sign in to save items.'); return; }
  try {
    await db.collection('users').doc(currentUser.uid).collection('items').add({
      text,
      checked: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    newItemInput.value = '';
  } catch (e) { alert(e.message); }
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
