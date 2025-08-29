import React, { useState } from 'react';
import { Container, Typography, Paper, Tabs, Tab, Box } from '@mui/material';
import FileUploader from '../components/FileUploader';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`upload-tabpanel-${index}`}
      aria-labelledby={`upload-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const UploadExamples = () => {
  const [tabValue, setTabValue] = useState(0);
  const currentUserId = 'user123'; // In a real app, get from auth context

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleUploadComplete = (result) => {
    console.log('Upload completed:', result);
    // You can update your state or show a success message here
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        File Upload Examples
      </Typography>
      
      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="upload examples"
          variant="fullWidth"
        >
          <Tab label="Profile Picture" />
          <Tab label="Driver's License" />
          <Tab label="Vehicle Registration" />
          <Tab label="Advertisement Media" />
        </Tabs>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>
            Profile Picture Upload
          </Typography>
          <Typography variant="body1" paragraph>
            This example shows a direct client-side upload for a user's profile picture.
            The file is uploaded directly from the browser to Firebase Storage.
          </Typography>
          <FileUploader
            userId={currentUserId}
            onUploadComplete={handleUploadComplete}
            label="Upload Profile Picture"
            accept="image/*"
            maxSizeMB={2}
            path={`users/${currentUserId}/profile`}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Driver's License Upload
          </Typography>
          <Typography variant="body1" paragraph>
            This example shows a secure server-side upload for a driver's license.
            The file is first sent to our server for validation before being stored.
          </Typography>
          <FileUploader
            userId={currentUserId}
            onUploadComplete={handleUploadComplete}
            documentType="license"
            uploadType="document"
            label="Upload Driver's License"
            accept="image/*,.pdf"
            maxSizeMB={5}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Vehicle Registration (OR/CR) Upload
          </Typography>
          <Typography variant="body1" paragraph>
            This example shows a secure server-side upload for vehicle registration documents.
            The file is validated and processed on the server before storage.
          </Typography>
          <FileUploader
            userId={currentUserId}
            onUploadComplete={handleUploadComplete}
            documentType="orcr"
            uploadType="document"
            label="Upload OR/CR"
            accept="image/*,.pdf"
            maxSizeMB={5}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Advertisement Media Upload
          </Typography>
          <Typography variant="body1" paragraph>
            This example shows a direct client-side upload for advertisement media.
            Multiple file types are supported, and files are uploaded directly to Firebase.
          </Typography>
          <FileUploader
            userId={currentUserId}
            onUploadComplete={handleUploadComplete}
            label="Upload Ad Media"
            accept="image/*,video/*"
            maxSizeMB={10}
            path={`ads/media`}
          />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default UploadExamples;
