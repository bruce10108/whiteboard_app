import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Firebase web config is public by design; data access is protected by
// Firestore security rules (set in the Firebase console), not by keeping
// these values secret.
const firebaseConfig = {
  apiKey: 'AIzaSyCzgonNEV5CZYbTjtjcJISwYnXthFTlW2k',
  authDomain: 'whiteboard-app-6db39.firebaseapp.com',
  projectId: 'whiteboard-app-6db39',
  storageBucket: 'whiteboard-app-6db39.firebasestorage.app',
  messagingSenderId: '259991445788',
  appId: '1:259991445788:web:99ea14cc63cce2b0239ad9',
}

export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// Cache data on the device so the board opens instantly and works offline;
// changes sync automatically when the connection comes back.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
