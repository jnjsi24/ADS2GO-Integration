import React, { useState, useRef } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_USER_REPORT } from '../graphql/userReport/mutations/CreateUserReport';
import { X, FileText, ChevronDown, AlertCircle, CheckCircle, Loader2, Upload, Link, CloudUpload } from 'lucide-react';
import { uploadFileToFirebase } from '../utils/fileUpload';
import { motion, AnimatePresence } from "framer-motion";

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
  mediaFile?: File;
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
    attachments: [],
    mediaFile: undefined,
  });
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mediaFileError, setMediaFileError] = useState('');

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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
        'application/pdf', 'text/plain', 
        'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime'
      ];
      const isValid = file.size <= maxSize && allowedTypes.includes(file.type);
      if (!isValid) {
        setMediaFileError('Please ensure files are images, videos, PDFs, or text files under 10MB.');
      }
      return isValid;
    });

    if (validFiles.length !== files.length) {
      setMediaFileError('Some files were rejected. Please ensure files are images, videos, PDFs, or text files under 10MB.');
    } else {
      setMediaFileError('');
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
    setFormData(prev => ({ ...prev, mediaFile: validFiles[0] }));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
        'application/pdf', 'text/plain', 
        'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime'
      ];
      const isValid = file.size <= maxSize && allowedTypes.includes(file.type);
      if (!isValid) {
        setMediaFileError('Please ensure files are images, videos, PDFs, or text files under 10MB.');
      }
      return isValid;
    });

    if (validFiles.length !== files.length) {
      setMediaFileError('Some files were rejected. Please ensure files are images, videos, PDFs, or text files under 10MB.');
    } else {
      setMediaFileError('');
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
    setFormData(prev => ({ ...prev, mediaFile: validFiles[0] }));
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({ ...prev, mediaFile: undefined }));
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
        setFormData({
          subject: '',
          description: '',
          category: '',
          attachments: [],
          mediaFile: undefined,
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
        attachments: [],
        mediaFile: undefined,
      });
      setAttachmentUrl('');
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Create New Report</h2>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Subject */}
          <div className="relative">
            <input
              type="text"
              id="subject"
              name="subject"
              required
              value={formData.subject}
              onChange={handleInputChange}
              placeholder=" "
              maxLength={200}
              disabled={isSubmitting}
              className={`peer w-full px-0 pt- pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-[#3674B5] placeholder-transparent transition 
                ${errors.subject ? 'border-red-500' : 'border-gray-300'}`}
            />
            <label
              htmlFor="subject"
              className={`absolute -top-5 left-0 text-gray-600 transition-all duration-200
                ${formData.subject
                  ? '-top-5 text-sm text-[#3674B5] font-semibold'
                  : 'peer-placeholder-shown:top-1 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'}
                peer-focus:-top-5 peer-focus:text-sm peer-focus:text-black peer-focus:font-semibold`}
            >
              Subject
            </label>
            {errors.subject && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.subject}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">{formData.subject.length}/200 characters</p>
          </div>

          {/* Category */}
          <div className="relative">
            <label className="block text-sm font-medium mt-6 text-gray-700 mb-2">
              Category
            </label>
            <button
              type="button"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className={`flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2 ${
                errors.category ? "border-red-500" : "border-gray-300"
              }`}
              disabled={isSubmitting}
            >
              {formData.category
                ? categories.find((c) => c.value === formData.category)?.label
                : "Select a category"}
              <ChevronDown
                size={18}
                className={`transform transition-transform duration-200 ${
                  showCategoryDropdown ? "rotate-180" : "rotate-0"
                }`}
              />
            </button>
            <AnimatePresence>
              {showCategoryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-md bg-white border border-gray-200 overflow-hidden"
                >
                  {categories.map((category) => (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => {
                        handleInputChange({
                          target: { name: "category", value: category.value },
                        } as React.ChangeEvent<HTMLSelectElement>);
                        setShowCategoryDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {category.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {errors.category && (
                <motion.p
                  key="category-error"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 text-sm text-red-600 flex items-center gap-1"
                >
                  <AlertCircle className="w-4 h-4" />
                  {errors.category}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Description */}
          <div className="relative mt-6">
            <textarea
              id="description"
              name="description"
              required
              value={formData.description}
              onChange={(e) => {
                handleInputChange(e);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 320)}px`;
              }}
              placeholder=" "
              disabled={isSubmitting}
              maxLength={2000}
              className={`peer w-full px-0 pt-6 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-[#3674B5] placeholder-transparent transition 
                ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
              style={{
                minHeight: "40px",
                maxHeight: "100px",
                resize: "none",
                overflowY: "auto",
              }}
            />
            <label
              htmlFor="description"
              className={`absolute left-0 bg-white text-gray-600 transition-all duration-200
                ${
                  formData.description
                    ? '-top-2 text-sm text-[#3674B5] font-semibold'
                    : 'peer-placeholder-shown:top-5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'
                }
                peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black peer-focus:font-semibold`}
            >
              Description
            </label>
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.description}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">{formData.description.length}/2000 characters</p>
          </div>

          {/* Media File Upload */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Media File
            </label>
            <div
              className={`border-2 border-dashed border-black/70 rounded-lg p-6 transition-colors flex flex-col items-center justify-center text-center
                ${isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : mediaFileError
                  ? 'border-red-500 bg-red-50'
                  : 'border-black/60 bg-transparent'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <CloudUpload
                className={`w-12 h-12 mb-4 ${mediaFileError ? 'text-red-400' : 'text-black/60'}`}
              />
              <p className="text-black/80 mb-4">Drag your file image/video here</p>
              <div className="flex items-center justify-center mb-4 w-full">
                <div
                  className={`grow max-w-40 h-px ${mediaFileError ? 'bg-red-300' : 'bg-gray-300'}`}
                ></div>
                <span
                  className={`mx-3 text-sm ${mediaFileError ? 'text-red-400' : 'text-black/80'}`}
                >
                  or
                </span>
                <div
                  className={`grow max-w-40 h-px ${mediaFileError ? 'bg-red-300' : 'bg-gray-300'}`}
                ></div>
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setMediaFileError('');
                    document.getElementById('media-upload')?.click();
                  }}
                  onMouseMove={(e: React.MouseEvent<HTMLButtonElement>) => {
                    const button = e.currentTarget;
                    const rect = button.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    button.style.setProperty('--x', `${x}px`);
                    button.style.setProperty('--y', `${y}px`);
                  }}
                  className={`relative p-3 font-medium text-xs text-white w-40 transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group hover:scale-105 shadow-md
                    ${mediaFileError
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-gradient-to-r from-[#1B5087] to-[#3674B5]'}`}
                >
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background:
                        'radial-gradient(circle at var(--x, 20%) var(--y, 80%), rgba(255, 255, 255, 0.15) 0%, transparent 50%)',
                    }}
                  />
                  <span className="relative z-10">Click to upload file</span>
                </button>
              </div>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.ogg,.webm,.mov,image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/mpeg,video/ogg,video/webm,video/quicktime"
                onChange={handleFileInputChange}
                className="hidden"
                id="media-upload"
              />
              {formData.mediaFile && !mediaFileError && (
                <p className="text-sm text-green-600 mt-2">
                  Selected: {formData.mediaFile.name}
                </p>
              )}
            </div>
            {(mediaFileError || errors.mediaFile) && (
              <p className="text-sm text-red-600 mt-1">
                {mediaFileError}
              </p>
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
                className="flex-1 px-3 py-2 border-b border-gray-300 focus:outline-none"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleAddAttachment}
                disabled={!attachmentUrl.trim() || isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-black hover:text-black/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

          {/* Upload Progress */}
          {uploadProgress !== null && (
            <div className="p-3">
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
          <div className="flex justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              onMouseMove={(e: React.MouseEvent<HTMLButtonElement>) => {
                const button = e.currentTarget;
                const rect = button.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                button.style.setProperty('--x', `${x}px`);
                button.style.setProperty('--y', `${y}px`);
              }}
              className={`relative px-6 py-2 font-medium text-sm text-white transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group hover:scale-105 shadow-md
                ${isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#1B5087] to-[#3674B5] hover:from-[#2B5F9B] hover:to-[#4C8CD4]'}`}
            >
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    'radial-gradient(circle at var(--x, 20%) var(--y, 80%), rgba(255, 255, 255, 0.15) 0%, transparent 50%)',
                }}
              />
              <span className="relative z-10 flex items-center gap-2">
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
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateReport;