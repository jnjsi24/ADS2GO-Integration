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
      <div className="bg-white rounded-lg shadow-sm p-6">
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
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center text-red-600">
          <p>Error loading reports: {error.message}</p>
        </div>
      </div>
    );
  }

  const reports = data?.getUserReports?.reports || [];

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No reports submitted yet</h3>
          <p>You haven't submitted any reports yet. Create your first report to get help!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-900">Your Submitted Reports</h2>
        <p className="text-sm text-gray-600 mt-1">
          Track the status of your reports and see admin responses
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {reports.map((report: UserReport) => (
          <div key={report.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{report.title}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(report.status)}`}>
                    {getStatusIcon(report.status)}
                    {report.status.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span><strong>Category:</strong> {getCategoryLabel(report.reportType)}</span>
                  {report.resolvedAt && (
                    <span><strong>Resolved:</strong> {formatDate(report.resolvedAt)}</span>
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
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="space-y-4">
                  {/* Report Details */}
                  <div className="text-sm text-gray-600">
                    <p><strong>Report ID:</strong> {report.id}</p>
                    <p><strong>Last Updated:</strong> {formatDate(report.updatedAt)}</p>
                    {report.status === 'RESOLVED' && report.resolvedAt && (
                      <p><strong>Resolution Date:</strong> {formatDate(report.resolvedAt)}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2"><strong>Description:</strong></p>
                    <p className="text-gray-700">{report.description}</p>
                  </div>

                  {/* Attachments */}
                  {report.attachments && report.attachments.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2"><strong>Attachments:</strong></p>
                      <div className="space-y-3">
                        {report.attachments.map((attachment, index) => {
                          const isImage = attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) || 
                                         attachment.includes('data:image/') ||
                                         attachment.includes('firebasestorage.googleapis.com') && 
                                         (attachment.includes('image') || attachment.match(/\.(jpg|jpeg|png|gif|webp)/i));
                          
                          const isPdf = attachment.match(/\.pdf$/i) || attachment.includes('application/pdf');
                          
                          const getFileType = (url: string) => {
                            if (isImage) return 'image';
                            if (isPdf) return 'pdf';
                            if (url.includes('data:text/')) return 'text';
                            return 'file';
                          };

                          const fileType = getFileType(attachment);
                          const fileName = `Attachment ${index + 1}`;

                          return (
                            <div key={index} className="border border-gray-200 rounded-lg p-3">
                              {fileType === 'image' ? (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileText className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-medium text-gray-700">{fileName}</span>
                                    <a
                                      href={attachment}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 text-xs underline ml-auto"
                                    >
                                      Open in new tab
                                    </a>
                                  </div>
                                  <div className="max-w-md">
                                    <img
                                      src={attachment}
                                      alt={fileName}
                                      className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                      onClick={() => window.open(attachment, '_blank')}
                                      onError={(e) => {
                                        // Fallback to link if image fails to load
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                    <div className="hidden">
                                      <a
                                        href={attachment}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                                      >
                                        {fileName} (Image)
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              ) : (
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
                                  <a
                                    href={attachment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                                  >
                                    Open
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
