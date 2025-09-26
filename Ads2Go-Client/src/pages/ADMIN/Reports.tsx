import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronDown, Eye, Edit, MessageSquare, AlertCircle, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { GET_ALL_USER_REPORTS } from '../../graphql/admin/queries/userReports';
import { UPDATE_USER_REPORT_ADMIN } from '../../graphql/admin/mutations/userReports';

type ReportStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'all';
type ReportType = 'BUG' | 'PAYMENT' | 'ACCOUNT' | 'CONTENT_VIOLATION' | 'FEATURE_REQUEST' | 'OTHER' | 'all';

interface UserReport {
  id: string;
  title: string;
  description: string;
  reportType: ReportType;
  status: ReportStatus;
  attachments: string[];
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ReportFilters {
  reportType?: ReportType;
  status?: ReportStatus;
  startDate?: string;
  endDate?: string;
}

const Reports: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    adminNotes: ''
  });
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_ALL_USER_REPORTS, {
    variables: {
      filters,
      limit: 50,
      offset: 0
    }
  });

  const [updateUserReportAdmin] = useMutation(UPDATE_USER_REPORT_ADMIN);

  const reports: UserReport[] = data?.getAllUserReports?.reports || [];

  const filteredReports = reports.filter((report) => {
    const matchSearch = searchTerm
      ? report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.user.email.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    return matchSearch;
  });

  const handleRowClick = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleUpdateReport = (report: UserReport) => {
    setSelectedReport(report);
    setUpdateData({
      status: report.status,
      adminNotes: report.adminNotes || ''
    });
    setIsUpdateModalOpen(true);
  };

  const handleUpdateSubmit = async () => {
    if (!selectedReport) return;

    try {
      await updateUserReportAdmin({
        variables: {
          id: selectedReport.id,
          input: {
            status: updateData.status || undefined,
            adminNotes: updateData.adminNotes || undefined
          }
        }
      });
      
      setIsUpdateModalOpen(false);
      setSelectedReport(null);
      refetch();
    } catch (error) {
      console.error('Error updating report:', error);
    }
  };

  const handleSelectReport = (reportId: string) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleSelectAll = () => {
    if (selectedReports.length === data?.getAllUserReports?.reports?.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(data?.getAllUserReports?.reports?.map((r: UserReport) => r.id) || []);
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedReports.length === 0) return;

    try {
      // Update all selected reports
      await Promise.all(
        selectedReports.map(reportId =>
          updateUserReportAdmin({
            variables: {
              id: reportId,
              input: { status }
            }
          })
        )
      );

      // Clear selection and refresh
      setSelectedReports([]);
      setShowBulkActions(false);
      refetch();
    } catch (error) {
      console.error('Error updating reports:', error);
    }
  };

  const getStatusIcon = (status: ReportStatus) => {
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

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-200 text-yellow-800';
      case 'IN_PROGRESS':
        return 'bg-blue-200 text-blue-800';
      case 'RESOLVED':
        return 'bg-green-200 text-green-800';
      case 'CLOSED':
        return 'bg-gray-200 text-gray-800';
      default:
        return 'bg-gray-200 text-gray-800';
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
      if (dateString instanceof Date) {
        date = dateString;
      } else if (typeof dateString === 'string') {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3674B5] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Error loading reports: {error.message}</p>
          <button 
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">User Reports</h1>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
              placeholder="Search by title, user name, or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="relative w-40">
              <select
                className="appearance-none w-full text-xs text-black rounded-lg pl-5 pr-10 py-3 shadow-md focus:outline-none bg-white"
                value={filters.status || 'all'}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  status: e.target.value === 'all' ? undefined : e.target.value as ReportStatus 
                }))}
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="relative w-40">
              <select
                className="appearance-none w-full text-xs text-black rounded-lg pl-5 pr-10 py-3 shadow-md focus:outline-none bg-white"
                value={filters.reportType || 'all'}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  reportType: e.target.value === 'all' ? undefined : e.target.value as ReportType 
                }))}
              >
                <option value="all">All Types</option>
                <option value="BUG">Bug</option>
                <option value="PAYMENT">Payment</option>
                <option value="ACCOUNT">Account</option>
                <option value="CONTENT_VIOLATION">Content Violation</option>
                <option value="FEATURE_REQUEST">Feature Request</option>
                <option value="OTHER">Other</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Bulk Actions Bar */}
        {selectedReports.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-800">
                  {selectedReports.length} report{selectedReports.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkStatusUpdate('IN_PROGRESS')}
                    className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded hover:bg-yellow-200"
                  >
                    Mark as In Progress
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate('RESOLVED')}
                    className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded hover:bg-green-200"
                  >
                    Mark as Resolved
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate('CLOSED')}
                    className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded hover:bg-gray-200"
                  >
                    Mark as Closed
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedReports([])}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Table Header */}
        <div className="grid grid-cols-11 px-4 py-3 text-sm font-semibold text-gray-600 bg-white rounded-lg shadow-sm">
          <div className="col-span-1 flex justify-center">
            <input 
              type="checkbox" 
              checked={selectedReports.length === data?.getAllUserReports?.reports?.length && data?.getAllUserReports?.reports?.length > 0}
              onChange={handleSelectAll}
            />
          </div>
          <div className="col-span-3">Title</div>
          <div className="col-span-2">User</div>
          <div className="col-span-1">Category</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-1 text-center">Actions</div>
        </div>

      {/* Rows */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow-sm">
          No reports found.
        </div>
      ) : (
        filteredReports.map((report) => (
          <div key={report.id} className="bg-white mb-3 rounded-lg shadow-md">
            {/* Main Row */}
            <div
              className="grid grid-cols-11 items-center px-5 py-5 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
              onClick={() => handleRowClick(report.id)}
            >
              {/* Checkbox */}
              <div className="col-span-1 flex justify-center">
                <input 
                  type="checkbox" 
                  checked={selectedReports.includes(report.id)}
                  onChange={() => handleSelectReport(report.id)}
                />
              </div>

              {/* Title */}
              <div className="col-span-3 truncate font-medium" title={report.title}>
                {report.title}
              </div>

              {/* User */}
              <div className="col-span-2 truncate" title={`${report.user.firstName} ${report.user.lastName}`}>
                {report.user.firstName} {report.user.lastName}
              </div>

              {/* Category */}
              <div className="col-span-1 text-xs">
                {report.reportType.replace('_', ' ')}
              </div>

              {/* Status */}
              <div className="col-span-1 flex items-center gap-1">
                {getStatusIcon(report.status)}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(report.status)}`}>
                  {report.status.replace('_', ' ')}
                </span>
              </div>

              {/* Created */}
              <div className="col-span-2 text-xs text-gray-600">
                {formatDate(report.createdAt)}
              </div>

              {/* Actions */}
              <div className="col-span-1 flex items-center justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateReport(report);
                  }}
                  className="p-1 text-[#3674B5] hover:bg-blue-100 rounded transition-colors"
                  title="Update Report"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded Row */}
            {expandedRow === report.id && (
              <div className="bg-gray-50 px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Description:</strong>
                    <p className="mt-1 text-gray-700">{report.description}</p>
                  </div>
                  <div>
                    <strong>User Email:</strong>
                    <p className="mt-1 text-gray-700">{report.user.email}</p>
                  </div>
                  <div>
                    <strong>Last Updated:</strong>
                    <p className="mt-1 text-gray-700">{formatDate(report.updatedAt)}</p>
                  </div>
                  {report.resolvedAt && (
                  <div>
                      <strong>Resolved At:</strong>
                      <p className="mt-1 text-gray-700">{formatDate(report.resolvedAt)}</p>
                    </div>
                  )}
                  {report.adminNotes && (
                    <div className="md:col-span-2">
                      <strong>Admin Notes:</strong>
                      <p className="mt-1 text-gray-700 bg-white p-2 rounded border">{report.adminNotes}</p>
                    </div>
                  )}
                  {report.attachments.length > 0 && (
                    <div className="md:col-span-2">
                      <strong>Attachments:</strong>
                      <div className="mt-2 space-y-3">
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
                            <div key={index} className="border border-gray-200 rounded-lg p-3 bg-white">
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
                                  <div className="max-w-lg">
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
                </div>
              </div>
            )}
          </div>
        ))
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-6">
        <span className="text-sm text-gray-600">
          Found: {filteredReports.length} report(s)
        </span>
        <div className="flex space-x-2">
          <button className="px-4 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50 text-sm">
            Export to Excel
          </button>
        </div>
      </div>

      {/* Update Modal */}
      {isUpdateModalOpen && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Update Report Details</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Report: <strong>{selectedReport?.title}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={updateData.status}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={updateData.adminNotes}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, adminNotes: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                  placeholder="Add admin notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSubmit}
                className="px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;