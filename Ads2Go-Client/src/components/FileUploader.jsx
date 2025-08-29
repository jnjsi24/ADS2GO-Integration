import React, { useState, useCallback } from 'react';
import { uploadFileToFirebase, uploadDriverDocument } from '../utils/mediaUploader';
import { CircularProgress, LinearProgress, Box, Typography, Button, Paper, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { CloudUpload, CheckCircle, Error, InsertDriveFile, Image, PictureAsPdf } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const getFileIcon = (fileType) => {
  if (fileType.startsWith('image/')) return <Image color="primary" />;
  if (fileType === 'application/pdf') return <PictureAsPdf color="error" />;
  return <InsertDriveFile color="action" />;
};

const FileUploader = ({ 
  userId, 
  onUploadComplete, 
  documentType, 
  label = 'Upload File',
  accept = 'image/*,.pdf',
  maxSizeMB = 5,
  uploadType = 'direct', // 'direct' or 'document'
  path = 'uploads' // Base path for direct uploads
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [error, setError] = useState(null);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Reset state
    setError(null);
    setIsUploading(true);
    setProgress(0);

    try {
      // File validation
      if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`File size must be less than ${maxSizeMB}MB`);
      }

      let result;
      
      if (uploadType === 'document') {
        // Server-side upload for sensitive documents
        if (!documentType) {
          throw new Error('Document type is required for document uploads');
        }
        
        result = await uploadDriverDocument(
          file,
          documentType,
          userId,
          (progress) => setProgress(progress)
        );
      } else {
        // Direct client-side upload
        result = await uploadFileToFirebase(
          file,
          path,
          userId,
          { uploadType: 'direct' },
          (progress) => setProgress(progress)
        );
      }

      if (result.success) {
        setUploadedFiles(prev => [
          ...prev, 
          {
            name: file.name,
            url: result.url,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            status: 'completed'
          }
        ]);
        
        if (onUploadComplete) {
          onUploadComplete(result);
        }
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
      
      setUploadedFiles(prev => [
        ...prev, 
        {
          name: file.name,
          error: err.message,
          status: 'error'
        }
      ]);
    } finally {
      setIsUploading(false);
      setProgress(0);
      // Reset file input
      event.target.value = null;
    }
  }, [userId, documentType, onUploadComplete, uploadType, path, maxSizeMB]);

  return (
    <Paper variant="outlined" sx={{ p: 3, width: '100%' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          {label}
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Max file size: {maxSizeMB}MB • Accepted: {accept}
        </Typography>
        
        <Button
          component="label"
          variant="contained"
          color="primary"
          startIcon={<CloudUpload />}
          disabled={isUploading}
          sx={{ mt: 1 }}
        >
          Choose File
          <VisuallyHiddenInput 
            type="file" 
            onChange={handleFileChange} 
            accept={accept}
            disabled={isUploading}
          />
        </Button>
        
        {isUploading && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress 
              variant={progress > 0 ? "determinate" : "indeterminate"}
              value={progress} 
            />
            <Typography variant="caption" display="block" textAlign="right">
              {progress}%
            </Typography>
          </Box>
        )}
        
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </Box>
      
      {uploadedFiles.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Uploaded Files:
          </Typography>
          <List dense>
            {uploadedFiles.map((file, index) => (
              <ListItem 
                key={index}
                sx={{ 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: file.status === 'error' ? 'error.light' : 'background.paper'
                }}
              >
                <ListItemIcon>
                  {file.status === 'completed' ? (
                    <CheckCircle color="success" />
                  ) : file.status === 'error' ? (
                    <Error color="error" />
                  ) : (
                    getFileIcon(file.type)
                  )}
                </ListItemIcon>
                <ListItemText 
                  primary={file.name}
                  secondary={
                    file.status === 'error' 
                      ? file.error 
                      : file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''
                  }
                  secondaryTypographyProps={{
                    color: file.status === 'error' ? 'error' : 'textSecondary'
                  }}
                />
                {file.url && (
                  <Button 
                    size="small" 
                    href={file.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    View
                  </Button>
                )}
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  );
};

export default FileUploader;
