import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
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

// Upload with progress callback (0-100). Returns the download URL when complete.
export const uploadFileToFirebaseWithProgress = (
  file: File,
  folder: string,
  onProgress: (progressPercent: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `${folder}/${fileName}`);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(Math.round(progress));
        },
        (error) => reject(error),
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
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