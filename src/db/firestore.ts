import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from '../config';

const app =
  getApps()[0] ??
  initializeApp(
    process.env.FIRESTORE_EMULATOR_HOST
      ? { projectId: config.firebaseProjectId }
      : { projectId: config.firebaseProjectId, credential: applicationDefault() },
  );

export const firestore = getFirestore(app);
