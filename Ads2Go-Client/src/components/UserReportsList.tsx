import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_USER_REPORTS } from '../graphql/userReport/queries/GetUserReports';
import { Clock, CheckCircle, AlertCircle, XCircle, Eye, EyeOff, FileText } from 'lucide-react';

interface UserReport {
  id: string;
  title: string;
  description: string;
  reportType: string;
  status: string;
  attachments: string[];
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

const UserReportsList: React.FC = () => {
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const { data, loading, error } = useQuery(GET_USER_REPORTS, {
    variables: {
      limit: 50,
      offset: 0
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'IN_PROGRESS':
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
      case 'RESOLVED':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'CLOSED':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      // Handle different date formats
      let date: Date;
      
      if (!dateString) {
        return 'No Date';
      }
      
      // If it's already a Date object or timestamp
      if (typeof dateString === 'string') {
        // Try parsing as ISO string first
        date = new Date(dateString);
        
        // If that fails, try parsing as timestamp
        if (isNaN(date.getTime())) {
          const timestamp = parseInt(dateString);
          if (!isNaN(timestamp)) {
            date = new Date(timestamp);
          }
        }
      } else {
        return 'Invalid Format';
      }
      
      if (isNaN(date.getTime())) {
        console.error('Invalid date string:', dateString);
        return 'Invalid Date';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'Input:', dateString);
      return 'Invalid Date';
    }
  };

  const getCategoryLabel = (reportType: string) => {
    const categoryMap: { [key: string]: string } = {
      'BUG': 'Bug',
      'PAYMENT': 'Payment',
      'ACCOUNT': 'Account',
      'CONTENT_VIOLATION': 'Content Violation',
      'FEATURE_REQUEST': 'Feature Request',
      'OTHER': 'Other'
    };
    return categoryMap[reportType] || reportType;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          <p>Error loading reports: {error.message}</p>
        </div>
      </div>
    );
  }

  const reports = data?.getUserReports?.reports || [];

  if (reports.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <h3 className="text-lg font-medium mb-2">No reports submitted yet</h3>
          <p>You haven't submitted any reports yet. Create your first report to get help!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="divide-y divide-gray-200">
        {reports.map((report: UserReport) => (
          <div key={report.id}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{report.title}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(report.status)}`}>
                    {getStatusIcon(report.status)}
                    {report.status.replace('_', ' ')}
                  </span>
                </div>
                
               <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-gray-600 mb-3">
                <span className="flex items-center gap-2 rounded-md px-2 py-1 bg-[#3674B5]/70 text-white"> {getCategoryLabel(report.reportType)}</span>
                {report.resolvedAt && (
                  <span className="flex items-center gap-2 rounded-md px-2 py-1 bg-gray-300"><strong>Resolved:</strong> {formatDate(report.resolvedAt)}</span>
                )}
                <span className="flex items-center gap-2 rounded-md px-2 py-1 bg-gray-300"> {report.id}</span>
                <span className="flex items-center gap-2 rounded-md px-2 py-1 bg-gray-300"><strong>Last Updated:</strong> {formatDate(report.updatedAt)}</span>
                {report.status === 'RESOLVED' && report.resolvedAt && (
                  <span className="flex items-center gap-2 rounded-md px-2 py-1 bg-gray-300"><strong>Resolution Date:</strong> {formatDate(report.resolvedAt)}</span>
                )}
              </div>


              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  <strong>Created:</strong> {formatDate(report.createdAt)}
                </span>
                <button
                  onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {expandedReport === report.id ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {expandedReport === report.id && (
              <div className="pt-4">
                <div className="space-y-4">
                  {/* Description */}
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2"><strong>Description:</strong></p>
                    <p className="text-gray-700">{report.description}</p>
                  </div>

                  {/* Attachments */}
                  {report.attachments && report.attachments.length > 0 && (
  <div>
    <p className="text-sm font-medium text-gray-600 mb-2">
      <strong>Attachments:</strong>
    </p>

    <div className="space-y-3">
      {/* Image attachments grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {report.attachments.map((attachment, index) => {
          const isImage =
            attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
            attachment.includes('data:image/') ||
            (attachment.includes('firebasestorage.googleapis.com') &&
              (attachment.includes('image') ||
                attachment.match(/\.(jpg|jpeg|png|gif|webp)/i)));

          const isPdf = attachment.match(/\.pdf$/i) || attachment.includes('application/pdf');

          const getFileType = (url: string) => {
            if (isImage) return 'image';
            if (isPdf) return 'pdf';
            if (url.includes('data:text/')) return 'text';
            return 'file';
          };

          const fileType = getFileType(attachment);
          const fileName = `Attachment ${index + 1}`;

          // 🖼 If image: show in fixed grid cell
          if (fileType === 'image') {
            return (
              <div
                key={index}
                className="relative border border-gray-200 rounded-lg p-2 bg-white shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-gray-700">{fileName}</span>
                  </div>
                  <a
                    href={attachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-xs underline"
                  >
                    Open
                  </a>
                </div>
                <img
                  src={attachment}
                  alt={fileName}
                  className="w-full h-40 object-cover rounded-md border border-gray-200 cursor-pointer"
                  onClick={() => window.open(attachment, '_blank')}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              </div>
            );
          }

          // 📄 Non-image file layout
          return (
            <div
              key={index}
              className="flex items-center justify-between border border-gray-200 rounded-lg p-3 shadow-sm bg-white"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {fileType === 'pdf' ? (
                    <FileText className="w-5 h-5 text-red-600" />
                  ) : fileType === 'text' ? (
                    <FileText className="w-5 h-5 text-blue-600" />
                  ) : (
                    <FileText className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{fileName}</p>
                  <p className="text-xs text-gray-500 capitalize">{fileType} file</p>
                </div>
              </div>
              <a
                href={attachment}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Open
              </a>
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}


                  {/* Admin Notes */}
                  {report.adminNotes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-blue-800 mb-1">Admin Response:</p>
                      <p className="text-sm text-blue-700">{report.adminNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserReportsList;
