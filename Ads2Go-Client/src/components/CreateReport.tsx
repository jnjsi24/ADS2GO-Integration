import React, { useState, useRef } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_USER_REPORT } from '../graphql/userReport/mutations/CreateUserReport';
import { X, FileText, AlertCircle, CheckCircle, Loader2, Upload, Link } from 'lucide-react';
import { uploadFileToFirebase } from '../utils/fileUpload';

interface CreateReportProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormData {
  subject: string;
  description: string;
  category: string;
  attachments: string[];
}

const categories = [
  { value: 'BUG', label: 'Bug' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'CONTENT_VIOLATION', label: 'Content Violation' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
  { value: 'OTHER', label: 'Other' }
];

const CreateReport: React.FC<CreateReportProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<FormData>({
    subject: '',
    description: '',
    category: '',
    attachments: []
  });
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createUserReport] = useMutation(CREATE_USER_REPORT);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleAddAttachment = () => {
    if (attachmentUrl.trim() && attachmentUrl.startsWith('http')) {
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, attachmentUrl.trim()]
      }));
      setAttachmentUrl('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
      return file.size <= maxSize && allowedTypes.includes(file.type);
    });

    if (validFiles.length !== files.length) {
      alert('Some files were rejected. Please ensure files are images, PDFs, or text files under 10MB.');
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formData.subject.length > 200) {
      newErrors.subject = 'Subject must be 200 characters or less';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 2000) {
      newErrors.description = 'Description must be 2000 characters or less';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    
    try {
      let firebaseUrls: string[] = [];
      
      // Upload files to Firebase Storage if any
      if (uploadedFiles.length > 0) {
        console.log('Uploading files to Firebase Storage...');
        
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const progress = Math.round(((i + 1) / uploadedFiles.length) * 100);
          setUploadProgress(progress);
          
          try {
            const firebaseUrl = await uploadFileToFirebase(file, 'user-reports');
            firebaseUrls.push(firebaseUrl);
            console.log(`File ${i + 1}/${uploadedFiles.length} uploaded:`, firebaseUrl);
          } catch (error) {
            console.error(`Failed to upload file ${file.name}:`, error);
            throw new Error(`Failed to upload file: ${file.name}`);
          }
        }
      }

      // Combine URL attachments and Firebase URLs
      const allAttachments = [...formData.attachments, ...firebaseUrls];

      console.log('Submitting report with attachments:', allAttachments);

      const result = await createUserReport({
        variables: {
          input: {
            title: formData.subject.trim(),
            description: formData.description.trim(),
            reportType: formData.category,
            attachments: allAttachments
          }
        }
      });

      if (result.data?.createUserReport?.success) {
        // Reset form
        setFormData({
          subject: '',
          description: '',
          category: '',
          attachments: []
        });
        setAttachmentUrl('');
        setUploadedFiles([]);
        setErrors({});
        setUploadProgress(null);
        
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      console.error('Error creating report:', error);
      setUploadProgress(null);
      // You might want to show a toast notification here
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        subject: '',
        description: '',
        category: '',
        attachments: []
      });
      setAttachmentUrl('');
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-[#3674B5]" />
            <h2 className="text-xl font-semibold text-gray-900">Create New Report</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject *
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              placeholder="Short summary of the issue (ex: 'App keeps freezing on login')"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5] ${
                errors.subject ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={200}
              disabled={isSubmitting}
            />
            {errors.subject && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.subject}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">{formData.subject.length}/200 characters</p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5] ${
                errors.category ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSubmitting}
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.category}
              </p>
            )}
          </div>


          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Detailed explanation of the problem"
              rows={6}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5] ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={2000}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.description}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">{formData.description.length}/2000 characters</p>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments (Optional)
            </label>
            <div className="space-y-4">
              {/* File Upload Section */}
              <div>
                <div className="flex gap-2 mb-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Files
                  </button>
                  <span className="text-xs text-gray-500 self-center">
                    Images, PDFs, text files (max 10MB each)
                  </span>
                </div>

                {/* Uploaded Files Display */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Uploaded Files:</p>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                        <FileText className="w-4 h-4 text-green-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          disabled={isSubmitting}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* URL Input Section */}
              <div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="Or paste a link to screenshots, documents, etc."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={handleAddAttachment}
                    disabled={!attachmentUrl.trim() || isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Link className="w-4 h-4" />
                    Add Link
                  </button>
                </div>
                
                {formData.attachments.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-sm text-gray-600">Links:</p>
                    {formData.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                        <Link className="w-4 h-4 text-blue-600" />
                        <span className="flex-1 text-sm text-gray-700 truncate">{attachment}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(index)}
                          disabled={isSubmitting}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upload Progress */}
          {uploadProgress !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Uploading files to Firebase Storage...
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-blue-600 mt-1">{uploadProgress}% complete</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploadProgress !== null ? 'Uploading...' : 'Creating Report...'}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Create Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateReport;
