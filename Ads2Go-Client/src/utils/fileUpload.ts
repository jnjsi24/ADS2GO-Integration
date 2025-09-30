import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/init';

export const uploadFileToFirebase = async (file: File, folder: string): Promise<string> => {
  try {
    // Create a unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `${folder}/${fileName}`);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
};

export const uploadProfilePicture = async (file: File): Promise<string> => {
  return uploadFileToFirebase(file, 'drivers');
};

export const uploadAdminProfilePicture = async (file: File): Promise<string> => {
  return uploadFileToFirebase(file, 'admin');
};

export const uploadUserProfilePicture = async (file: File): Promise<string> => {
  return uploadFileToFirebase(file, 'users');
};

export const uploadSuperAdminProfilePicture = async (file: File): Promise<string> => {
  return uploadFileToFirebase(file, 'superadmin');
};