import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, CalendarClock, CalendarCheck, ChevronDown, Edit, AlertCircle, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
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
  const [updateData, setUpdateData] = useState({ status: '', adminNotes: '' });
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showModalStatusDropdown, setShowModalStatusDropdown] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_ALL_USER_REPORTS, {
    variables: { filters, limit: 50, offset: 0 },
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
    setUpdateData({ status: report.status, adminNotes: report.adminNotes || '' });
    setIsUpdateModalOpen(true);
  };

  const handleUpdateSubmit = async () => {
    if (!selectedReport) return;
    try {
      await updateUserReportAdmin({
        variables: {
          id: selectedReport.id,
          input: { status: updateData.status || undefined, adminNotes: updateData.adminNotes || undefined },
        },
      });
      setIsUpdateModalOpen(false);
      setSelectedReport(null);
      refetch();
    } catch (error) {
      console.error('Error updating report:', error);
    }
  };

  const handleSelectReport = (reportId: string) => {
    setSelectedReports((prev) =>
      prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId]
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
      await Promise.all(
        selectedReports.map((reportId) =>
          updateUserReportAdmin({ variables: { id: reportId, input: { status } } })
        )
      );
      setSelectedReports([]);
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
      if (!dateString) return 'No Date';
      let date: Date;
      if (dateString instanceof Date) {
        date = dateString;
      } else if (typeof dateString === 'string') {
        date = new Date(dateString);
        if (isNaN(date.getTime())) {
          const timestamp = parseInt(dateString);
          if (!isNaN(timestamp)) date = new Date(timestamp);
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
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'Input:', dateString);
      return 'Invalid Date';
    }
  };

  const statusFilterOptions = ['All Status', 'Pending', 'In Progress', 'Resolved', 'Closed'];
  const typeFilterOptions = ['All Types', 'Bug', 'Payment', 'Account', 'Content Violation', 'Feature Request', 'Other'];

  const handleStatusFilterChange = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status === 'All Status' ? undefined : status.toUpperCase().replace(' ', '_') as ReportStatus,
    }));
    setShowStatusDropdown(false);
  };

  const handleTypeFilterChange = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      reportType: type === 'All Types' ? undefined : type.toUpperCase().replace(' ', '_') as ReportType,
    }));
    setShowTypeDropdown(false);
    setShowModalStatusDropdown(false);
  };

  const selectedStatusFilter = filters.status
    ? filters.status.charAt(0) + filters.status.slice(1).toLowerCase().replace('_', ' ')
    : 'All Status';
  const selectedTypeFilter = filters.reportType
    ? filters.reportType.charAt(0) + filters.reportType.slice(1).toLowerCase().replace('_', ' ')
    : 'All Types';

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
        <h1 className="text-3xl font-bold text-gray-800">Reports Management</h1>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
              placeholder="Search by title, user name, or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="relative w-32">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                {selectedStatusFilter}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : 'rotate-0'}`}
                />
              </button>
              <AnimatePresence>
                {showStatusDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                  >
                    {statusFilterOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusFilterChange(status)}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {status}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative w-40">
              <button
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                {selectedTypeFilter}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${showTypeDropdown ? 'rotate-180' : 'rotate-0'}`}
                />
              </button>
              <AnimatePresence>
                {showTypeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                  >
                    {typeFilterOptions.map((type) => (
                      <button
                        key={type}
                        onClick={() => handleTypeFilterChange(type)}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {type}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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
      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-gray-600">
        <div className="col-span-3 flex items-center gap-2">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={selectedReports.length === data?.getAllUserReports?.reports?.length && data?.getAllUserReports?.reports?.length > 0}
            onChange={handleSelectAll}
          />
          <span className="cursor-pointer truncate font-semibold" onClick={handleSelectAll}>
            Title
          </span>
          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
        <div className="col-span-2 flex items-center">User</div>
        <div className="col-span-2 flex items-center">Category</div>
        <div className="col-span-2 flex items-center gap-1">
          <span>Status</span>
          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
        <div className="col-span-2 flex items-center">Created</div>
        <div className="col-span-1 flex items-center justify-center">Actions</div>
      </div>

      {/* Rows */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-7 text-gray-500 bg-white rounded-lg shadow-sm">No reports found.</div>
      ) : (
        filteredReports.map((report) => (
          <div key={report.id} className="bg-white mb-3 rounded-lg shadow-md">
            <div
              className="grid grid-cols-12 gap-4 items-center px-5 py-4 text-sm hover:bg-gray-100 transition-colors cursor-pointer rounded-lg"
              onClick={() => handleRowClick(report.id)}
            >
              <div className="col-span-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={selectedReports.includes(report.id)}
                  onChange={() => handleSelectReport(report.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="truncate font-semibold" title={report.title}>
                  {report.title}
                </span>
              </div>
              <div className="col-span-2 truncate" title={`${report.user.firstName} ${report.user.lastName}`}>
                {report.user.firstName} {report.user.lastName}
              </div>
              <div className="col-span-2 truncate">{report.reportType.replace('_', ' ')}</div>
              <div className="col-span-2 flex items-center gap-1">
                {getStatusIcon(report.status)}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(report.status)}`}>
                  {report.status.replace('_', ' ')}
                </span>
              </div>
              <div className="col-span-2 truncate">{formatDate(report.createdAt)}</div>
              <div className="col-span-1 flex items-center justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateReport(report);
                  }}
                  className="group flex items-center text-gray-700 overflow-hidden h-6 w-7 hover:w-20 transition-[width] duration-300"
                  title="Update Report"
                >
                  <Edit className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                  <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                    Update
                  </span>
                </button>
              </div>
            </div>
            {expandedRow === report.id && (
            <div className="bg-white rounded-b-lg px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                {/* Column 1 */}
                <div className="space-y-4">
                  <div>
                    <strong>Description:</strong>
                    <p className="mt-1 text-gray-700">{report.description}</p>
                  </div>
                  {report.adminNotes && (
                    <div>
                      <strong>Admin Notes:</strong>
                      <p className="mt-1 text-gray-700 bg-white p-2 rounded-md border">
                        {report.adminNotes}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {/* User Email */}
                  <div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-600">User Email</span>
                    </div>
                    <p className="mt-1 font-semibold text-black">{report.user.email}</p>
                  </div>

                  {/* Last Updated */}
                  <div>
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-600">Last Updated</span>
                    </div>
                    <p className="mt-1 font-semibold text-black">
                      {formatDate(report.updatedAt)}
                    </p>
                  </div>

                  {/* Resolved At */}
                  {report.resolvedAt && (
                    <div>
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-600">Resolved At</span>
                      </div>
                      <p className="mt-1 font-semibold text-black">
                        {formatDate(report.resolvedAt)}
                      </p>
                    </div>
                  )}
                </div>
                {/* Column 3 */}
                {report.attachments.length > 0 && (
                  <div>
                    <strong>Attachments:</strong>
                    <div className="mt-2 space-y-3">
                      {report.attachments.map((attachment, index) => {
                        const isImage =
                          attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                          attachment.includes("data:image/") ||
                          (attachment.includes("firebasestorage.googleapis.com") &&
                            (attachment.includes("image") ||
                              attachment.match(/\.(jpg|jpeg|png|gif|webp)/i)));
                        const isPdf =
                          attachment.match(/\.pdf$/i) ||
                          attachment.includes("application/pdf");

                        const getFileType = (url: string) => {
                          if (isImage) return "image";
                          if (isPdf) return "pdf";
                          if (url.includes("data:text/")) return "text";
                          return "file";
                        };

                        const fileType = getFileType(attachment);
                        const fileName = `Attachment ${index + 1}`;

                        return (
                          <div
                            key={index}
                            className="border border-gray-200 rounded-md p-3 bg-white"
                          >
                            {fileType === "image" ? (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-medium text-gray-700">
                                    {fileName}
                                  </span>
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
                                    onClick={() => window.open(attachment, "_blank")}
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                      e.currentTarget.nextElementSibling?.classList.remove(
                                        "hidden"
                                      );
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
                                  {fileType === "pdf" ? (
                                    <FileText className="w-5 h-5 text-red-600" />
                                  ) : fileType === "text" ? (
                                    <FileText className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <FileText className="w-5 h-5 text-gray-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-700">
                                    {fileName}
                                  </p>
                                  <p className="text-xs text-gray-500 capitalize">
                                    {fileType} file
                                  </p>
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
        <span className="text-sm text-gray-600">Found: {filteredReports.length} report(s)</span>
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
            <div className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Update Report Details</h2>
                <p className="text-md text-gray-600 mt-1">
                  Title: <strong>{selectedReport?.title}</strong>
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Dropdown */}
              <div className="relative w-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <button
                  onClick={() => setShowModalStatusDropdown(!showModalStatusDropdown)}
                  className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-3 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
                  {/* Display human-readable status */}
                  {updateData.status
                    .replace('_', ' ')
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                  <ChevronDown
                    size={16}
                    className={`transform transition-transform duration-200 ${
                      showModalStatusDropdown ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {showModalStatusDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                    >
                      {['Pending', 'In Progress', 'Resolved', 'Closed'].map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            // Convert human-readable back to API format
                            const apiStatus = status.toUpperCase().replace(' ', '_') as ReportStatus;
                            setUpdateData((prev) => ({ ...prev, status: apiStatus }));
                            setShowModalStatusDropdown(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {status}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>


              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                <textarea
                  value={updateData.adminNotes}
                  onChange={(e) => setUpdateData((prev) => ({ ...prev, adminNotes: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 bg-white shadow-md border border-gray-100 rounded-lg focus:outline-none"
                  placeholder="Add admin notes..."
                />
              </div>
            </div>

            <div className="flex justify-between gap-3 p-6 border-t">
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="px-4 py-2 text-gray-700 rounded-lg hover:text-gray-900 transition-colors"
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