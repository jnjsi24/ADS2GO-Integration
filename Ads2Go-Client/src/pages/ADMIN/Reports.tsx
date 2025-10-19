import React, { useState, useEffect } from 'react';
import { Mail, ChevronDown, Edit, CalendarClock, CalendarCheck, FileText, Users, Car } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { GET_ALL_USER_REPORTS } from '../../graphql/admin/queries/userReports';
import { UPDATE_USER_REPORT_ADMIN } from '../../graphql/admin/mutations/userReports';
import { GET_ALL_DRIVER_REPORTS } from '../../graphql/admin/queries/driverReports';
import { UPDATE_DRIVER_REPORT_ADMIN } from '../../graphql/admin/mutations/driverReports';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminLoader } from "../../components/ProtectedRoute";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Driver {
  driverId: string;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  vehiclePlateNumber: string;
}

interface Report {
  id: string;
  title: string;
  description: string;
  reportType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  user?: User;
  driver?: Driver;
  driverId?: string;
  attachments: string[];
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

type ReportStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type ReportSource = 'users' | 'drivers';

const Reports: React.FC = () => {
  const { admin, isLoading: authLoading, isInitialized } = useAdminAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [reportSource, setReportSource] = useState<ReportSource>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All Types');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [expandedRow, setExpandedRow] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [showModalStatusDropdown, setShowModalStatusDropdown] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: 'PENDING' as ReportStatus,
    adminNotes: ''
  });

  const statusFilterOptions = ['All Status', 'Pending', 'In Progress', 'Resolved', 'Closed'];
  const userTypeFilterOptions = ['All Types', 'BUG', 'PAYMENT', 'ACCOUNT', 'CONTENT_VIOLATION', 'FEATURE_REQUEST', 'OTHER'];
  const driverTypeFilterOptions = ['All Types', 'BUG', 'PAYMENT', 'ACCOUNT', 'VEHICLE_ISSUE', 'MATERIAL_ISSUE', 'APP_ISSUE', 'OTHER'];

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch user reports
  const { data: userData, loading: userLoading, error: userError } = useQuery(GET_ALL_USER_REPORTS, {
    fetchPolicy: 'network-only',
    skip: reportSource !== 'users',
  });

  // Fetch driver reports
  const { data: driverData, loading: driverLoading, error: driverError } = useQuery(GET_ALL_DRIVER_REPORTS, {
    fetchPolicy: 'network-only',
    skip: reportSource !== 'drivers',
  });

  // Update mutations
  const [updateUserReport] = useMutation(UPDATE_USER_REPORT_ADMIN);
  const [updateDriverReport] = useMutation(UPDATE_DRIVER_REPORT_ADMIN);

  // Select appropriate data based on report source
  const data = reportSource === 'users' ? userData : driverData;
  const loading = reportSource === 'users' ? userLoading : driverLoading;
  const error = reportSource === 'users' ? userError : driverError;
  const updateReport = reportSource === 'users' ? updateUserReport : updateDriverReport;
  const typeFilterOptions = reportSource === 'users' ? userTypeFilterOptions : driverTypeFilterOptions;

  // Detect mobile screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Filter reports based on search term, status, and type
  const reports = reportSource === 'users' 
    ? data?.getAllUserReports?.reports 
    : data?.getAllDriverReports?.reports;

  const filteredReports = reports?.filter((report: Report) => {
    const searchLower = searchTerm.toLowerCase();
    
    let matchesSearch = report.title.toLowerCase().includes(searchLower);
    
    if (reportSource === 'users' && report.user) {
      matchesSearch = matchesSearch ||
        report.user.firstName.toLowerCase().includes(searchLower) ||
        report.user.lastName.toLowerCase().includes(searchLower) ||
        report.user.email.toLowerCase().includes(searchLower);
    } else if (reportSource === 'drivers' && report.driver) {
      matchesSearch = matchesSearch ||
        report.driver.firstName.toLowerCase().includes(searchLower) ||
        report.driver.lastName.toLowerCase().includes(searchLower) ||
        report.driver.email.toLowerCase().includes(searchLower) ||
        report.driver.driverId.toLowerCase().includes(searchLower) ||
        (report.driver.vehiclePlateNumber && report.driver.vehiclePlateNumber.toLowerCase().includes(searchLower));
    }
    
    const matchesStatus = selectedStatusFilter === 'All Status' || 
      report.status === selectedStatusFilter.toUpperCase().replace(' ', '_');
    
    const matchesType = selectedTypeFilter === 'All Types' || 
      report.reportType === selectedTypeFilter.toUpperCase().replace(' ', '_');
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReports = filteredReports.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatusFilter, selectedTypeFilter]);

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatusFilter(status);
    setShowStatusDropdown(false);
  };

  const handleTypeFilterChange = (type: string) => {
    setSelectedTypeFilter(type);
    setShowTypeDropdown(false);
  };

  const handleRowClick = (report: Report) => {
    setSelectedReport(report);
    setExpandedRow(true);
  };

  const handleCloseDetailsModal = () => {
    setExpandedRow(false);
    setSelectedReport(null);
  };

  const handleSelectReport = (id: string) => {
    setSelectedReports(prev =>
      prev.includes(id)
        ? prev.filter(reportId => reportId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedReports.length === filteredReports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(filteredReports.map((report: Report) => report.id));
    }
  };

  const handleUpdateReport = (report: Report) => {
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
      await updateReport({
        variables: {
          id: selectedReport.id,
          status: updateData.status,
          adminNotes: updateData.adminNotes
        },
        refetchQueries: [{ query: GET_ALL_USER_REPORTS }],
      });
      setIsUpdateModalOpen(false);
      setSelectedReport(null);
    } catch (error) {
      console.error('Error updating report:', error);
    }
  };

  const handleBulkStatusUpdate = async (status: ReportStatus) => {
    try {
      await Promise.all(
        selectedReports.map(id =>
          updateReport({
            variables: {
              id,
              status
            }
          })
        )
      );
      setSelectedReports([]);
      // Refetch data to update UI
      // You might want to use Apollo Client's cache update instead
    } catch (error) {
      console.error('Error bulk updating reports:', error);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'RESOLVED': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    // You can add icons here based on status
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Show loading state while authentication is being checked
  if (authLoading || !isInitialized) {
    return <AdminLoader />;
  }

  // Check if admin is authenticated
  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-100 flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600">You must be logged in to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-100 p-4 md:p-10 flex flex-col ${isMobile ? 'px-10 pl-28' : 'ml-60'}`}>
  
      {/* Mobile Header */}
      {isMobile && (
        <div className="flex items-center mb-4">
          <h1 className="text-xl pt-7 font-bold text-gray-800">Reports Management</h1>
        </div>
      )}

      {/* Header with Title */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
        {!isMobile && (
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Reports Management</h1>
        )}
        {/* Filters */}
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-col sm:flex-row gap-1 w-full">
            <input
              type="text"
              className="text-xs text-black rounded-md pl-4 lg:pl-5 py-3 w-full lg:w-80 shadow-md focus:outline-none bg-white"
              placeholder={reportSource === 'users' ? "Search by title, user name, or email" : "Search by title, driver name, ID, or vehicle"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex gap-1">
              <div className="relative w-full sm:w-32">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 lg:pl-6 pr-3 lg:pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  <span className="truncate">{selectedStatusFilter}</span>
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
                      className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                    >
                      {statusFilterOptions.map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusFilterChange(status)}
                          className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {status}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative w-full sm:w-40">
                <button
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 lg:pl-6 pr-3 lg:pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  <span className="truncate">{selectedTypeFilter}</span>
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
                          className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
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
      </div>
      
      <div className="flex flex-col lg:flex-row lg:justify-end lg:items-center gap-4 mb-2 mt-5">
        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 w-fit">
            {/* USER REPORTS BUTTON */}
            <button
              onClick={() => {
                setReportSource('users');
                setCurrentPage(1);
                setSelectedTypeFilter('All Types');
              }}
              className={`relative group flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-300 ${
                reportSource === 'users'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Users size={18} />
              <span>User Reports</span>

              {/* Animated underline */}
              <span
                className={`absolute bottom-0 left-0 h-0.5 w-full bg-blue-500 transform origin-left transition-transform duration-300 ease-out ${
                  reportSource === 'users' ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </button>

            {/* DRIVER REPORTS BUTTON */}
            <button
              onClick={() => {
                setReportSource('drivers');
                setCurrentPage(1);
                setSelectedTypeFilter('All Types');
              }}
              className={`relative group flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-300 ${
                reportSource === 'drivers'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Car size={18} />
              <span>Driver Reports</span>

              {/* Animated underline */}
              <span
                className={`absolute bottom-0 left-0 h-0.5 w-full bg-blue-500 transform origin-left transition-transform duration-300 ease-out ${
                  reportSource === 'drivers' ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </button>
          </div>
        </div>

      </div>

      {/* Bulk Actions Bar */}
      {selectedReports.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-medium text-blue-800">
                {selectedReports.length} report{selectedReports.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex flex-wrap gap-2">
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
              className="text-blue-600 hover:text-blue-800 text-sm font-medium self-start sm:self-auto"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Table Header */}
      {loading ? (
        <AdminLoader />
      ) : error ? (
        <div className="text-center py-10 text-red-500">Error: {error.message}</div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {searchTerm ? 'No reports match your search criteria' : 'No reports found'}
        </div>
      ) : (
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-gray-600">
          <div className="col-span-3 flex items-center gap-2">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={selectedReports.length === filteredReports.length && filteredReports.length > 0}
              onChange={handleSelectAll}
            />
            <span className="cursor-pointer truncate font-semibold" onClick={handleSelectAll}>
              Title
            </span>
            <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </div>
          <div className="col-span-2 flex items-center">{reportSource === 'users' ? 'User' : 'Driver'}</div>
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
      )}

      {/* Rows */}
      <div className="flex-1">
        {filteredReports.length === 0 ? (
          <div></div>
        ) : (
          paginatedReports.map((report: Report) => (
            <div key={report.id} className="bg-white mb-3 rounded-lg shadow-md">
              {/* Mobile Card View */}
              <div className="md:hidden p-4">
                <div className="flex items-start gap-2">
                  {/* Checkbox */}
                  <div className="flex-shrink-0 order-[-1]">
                    <input type="checkbox" className="w-3 h-3" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-semibold text-gray-800 truncate overflow-hidden whitespace-nowrap"
                        title={report.title}
                      >
                        {report.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span>{formatDate(report.createdAt)}</span>
                    </div>
                  </div>
                </div>

                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="grid grid-cols-2 gap-2">
                    {/* User or Driver */}
                    <div>
                      <div className="font-medium">{reportSource === 'users' ? 'User:' : 'Driver:'}</div>
                      <div>
                        {reportSource === 'users' && report.user
                          ? `${report.user.firstName} ${report.user.lastName}`
                          : reportSource === 'drivers' && report.driver
                          ? `${report.driver.firstName} ${report.driver.lastName}`
                          : 'N/A'}
                      </div>
                      {reportSource === 'drivers' && report.driver && report.driver.vehiclePlateNumber && (
                        <div className="text-xs text-gray-500">
                          Vehicle: {report.driver.vehiclePlateNumber}
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    <div>
                      <div className="font-medium">Category:</div>
                      <div>{report.reportType.replace('_', ' ')}</div>
                    </div>
                  </div>

                  {/* Status and Button */}
                  <div className="flex justify-end gap-2 items-center">
                    {getStatusIcon(report.status)}
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        report.status
                      )}`}
                    >
                      {report.status.replace('_', ' ')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateReport(report);
                      }}
                      title="Update Report"
                      className="flex items-center shadow-md text-gray-700 px-1 py-1 rounded border border-gray-200 hover:bg-gray-50"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop Table Row */}
              <div
                className="hidden md:grid grid-cols-12 gap-4 items-center px-5 py-4 text-sm hover:bg-gray-100 transition-colors cursor-pointer rounded-lg"
                onClick={() => handleRowClick(report)}
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
                <div className="col-span-2 truncate" title={
                  reportSource === 'users' && report.user
                    ? `${report.user.firstName} ${report.user.lastName}`
                    : reportSource === 'drivers' && report.driver
                    ? `${report.driver.firstName} ${report.driver.lastName}`
                    : 'N/A'
                }>
                  {reportSource === 'users' && report.user
                    ? `${report.user.firstName} ${report.user.lastName}`
                    : reportSource === 'drivers' && report.driver
                    ? `${report.driver.firstName} ${report.driver.lastName}`
                    : 'N/A'}
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
            </div>
          ))
        )}
      </div>

      {/* Details Modal */}
      {expandedRow && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={handleCloseDetailsModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Report Details</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <strong className="text-sm font-bold text-gray-700">Description:</strong>
                <p className="mt-1 text-gray-700">{selectedReport.description}</p>
              </div>
              {selectedReport.adminNotes && (
                <div>
                  <strong className="text-sm font-medium text-gray-700">Admin Notes:</strong>
                  <p className="w-full px-3 py-2 bg-white shadow-md border border-gray-100 rounded-lg focus:outline-none">
                    {selectedReport.adminNotes}
                  </p>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-600" />
                  <strong className="text-sm font-medium text-gray-700">User Email</strong>
                </div>
                <p className="mt-1 font-semibold text-black">{selectedReport.user.email}</p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-yellow-500" />
                  <strong className="text-sm font-medium text-gray-700">Last Updated</strong>
                </div>
                <p className="mt-1 font-semibold text-black">{formatDate(selectedReport.updatedAt)}</p>
              </div>
              {selectedReport.resolvedAt && (
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-green-500" />
                    <strong className="text-sm font-medium text-gray-700">Resolved At</strong>
                  </div>
                  <p className="mt-1 font-semibold text-black">{formatDate(selectedReport.resolvedAt)}</p>
                </div>
              )}
              {selectedReport.attachments.length > 0 && (
                <div>
                  <strong className="text-sm font-bold text-gray-700">Attachments:</strong>
                  <div className="mt-2 space-y-3">
                    {selectedReport.attachments.map((attachment, index) => {
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
        </div>
      )}

      {/* Pagination */}
      <div className="mt-auto flex justify-center py-4">
        <div className="flex items-center space-x-2">
          {/* Previous button */}
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          {/* Page numbers */}
          <div className="flex space-x-1">
            {(() => {
              const pages = [];
              const maxVisiblePages = 3;
              let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
              let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

              if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={`px-3 py-1 text-sm rounded ${
                      currentPage === i
                        ? "border border-gray-300 text-black" 
                        : "text-gray-700 hover:border border-gray-300"
                    }`}
                  >
                    {i}
                  </button>
                );
              }

              if (endPage < totalPages) {
                pages.push(
                  <span key="ellipsis" className="px-2 text-gray-500">
                    …
                  </span>
                );
              }

              return pages;
            })()}
          </div>

          {/* Next button */}
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
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