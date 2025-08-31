// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAWs_lSL0Z09pYVQ70lvxEaqQl6YSsE6tY",
  projectId: "kibbler-24518",
  databaseURL: "https://kibbler-24518-default-rtdb.asia-southeast1.firebasedatabase.app",
  appId: "1:1093837743559:web:3d4a3a0a1f4e3f5c1a2f1f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);

export { app, database };
