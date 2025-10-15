import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin only if credentials are provided
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey && 
      projectId !== 'your_firebase_project_id' && 
      clientEmail !== 'your_firebase_client_email' && 
      privateKey !== 'your_firebase_private_key') {
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    
    console.log('✅ Firebase Admin initialized');
  } else {
    console.log('⚠️  Firebase Admin not initialized - missing or invalid credentials');
  }
}

export const db = admin.firestore();
export default admin;