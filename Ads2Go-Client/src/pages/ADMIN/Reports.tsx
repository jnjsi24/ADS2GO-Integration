import React, { useState, useEffect } from 'react';
import { Mail, ChevronDown, Edit, CalendarClock, CalendarCheck, FileText, Users, Car, Save, X as CloseIcon, CheckCircle, AlertCircle, Loader, MessageSquare } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useSearchParams } from 'react-router-dom';
import { GET_ALL_USER_REPORTS } from '../../graphql/admin/queries/userReports';
import { UPDATE_USER_REPORT_ADMIN } from '../../graphql/admin/mutations/userReports';
import { GET_ALL_DRIVER_REPORTS } from '../../graphql/admin/queries/driverReports';
import { UPDATE_DRIVER_REPORT_ADMIN } from '../../graphql/admin/mutations/driverReports';
import { GET_DRIVER_BY_ID } from '../../graphql/admin/queries/driverDetails';
import { UPDATE_DRIVER } from '../../graphql/admin/mutations/updateDriver';
import { GET_ALL_CONTACT_MESSAGES } from '../../graphql/admin/queries/contactMessages';
import { UPDATE_CONTACT_MESSAGE, SEND_CONTACT_REPLY } from '../../graphql/admin/mutations/contactMessages';
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

interface AdminInfo {
  adminId?: string;
  adminName?: string;
  adminEmail?: string;
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
  adminNotesUpdatedAt?: string;
  adminNotesBy?: AdminInfo;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  category: string;
  adminReply?: {
    subject?: string;
    message?: string;
    sentBy?: AdminInfo;
    sentAt?: string;
  };
  resolvedAt?: string;
  resolvedBy?: AdminInfo;
  createdAt: string;
  updatedAt: string;
}

type ReportStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type ReportSource = 'users' | 'drivers' | 'messages';

const Reports: React.FC = () => {
  const { admin, isLoading: authLoading, isInitialized } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const [isMobile, setIsMobile] = useState(false);
  const [reportSource, setReportSource] = useState<ReportSource>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All Types');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortBy, setSortBy] = useState('Newest First');
  const [expandedRow, setExpandedRow] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedContactForDetails, setSelectedContactForDetails] = useState<ContactMessage | null>(null);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [showModalStatusDropdown, setShowModalStatusDropdown] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: 'PENDING' as ReportStatus,
    adminNotes: ''
  });

  // Driver Edit Modal States
  const [isDriverEditModalOpen, setIsDriverEditModalOpen] = useState(false);
  const [driverDetails, setDriverDetails] = useState<any>(null);
  const [requestedChanges, setRequestedChanges] = useState<any>(null);
  const [isLoadingDriverDetails, setIsLoadingDriverDetails] = useState(false);
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [showRejectPromptModal, setShowRejectPromptModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isApprovingChanges, setIsApprovingChanges] = useState(false);
  const [isRejectingChanges, setIsRejectingChanges] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Contact Message Reply Modal States
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [selectedContactMessage, setSelectedContactMessage] = useState<ContactMessage | null>(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [userRegistrationStatus, setUserRegistrationStatus] = useState<'checking' | 'registered' | 'not_registered'>('checking');

  // Status filter options - different for Contact Messages vs Reports
  const statusFilterOptions = reportSource === 'messages'
    ? ['All Status', 'Pending', 'In Progress', 'Resolved']  // Contact Messages: No 'Closed'
    : ['All Status', 'Pending', 'In Progress', 'Resolved', 'Closed'];  // User/Driver Reports: Include 'Closed'
  
  const userTypeFilterOptions = ['All Types', 'BUG', 'PAYMENT', 'ACCOUNT', 'CONTENT_VIOLATION', 'FEATURE_REQUEST', 'OTHER'];
  const driverTypeFilterOptions = ['All Types', 'BUG', 'PAYMENT', 'ACCOUNT', 'VEHICLE_ISSUE', 'MATERIAL_ISSUE', 'APP_ISSUE', 'REQUEST_ACCOUNT_CLOSURE', 'UPDATE_PROFILE_DETAILS', 'OTHER'];
  const sortByOptions = ['Newest First', 'Oldest First', 'Alphabetical (A-Z)', 'Alphabetical (Z-A)'];

  // Helper function to format type labels for display
  const formatTypeLabel = (type: string | undefined): string => {
    if (!type || type === 'All Types') return type || '';
    
    // Convert underscores to spaces and capitalize each word
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Read URL parameter to set the correct tab and filter
  useEffect(() => {
    const tab = searchParams.get('tab');
    const status = searchParams.get('status');
    
    if (tab === 'driver') {
      setReportSource('drivers');
    } else if (tab === 'user') {
      setReportSource('users');
    }
    
    // Set status filter if specified in URL
    if (status === 'pending') {
      setSelectedStatusFilter('Pending');
    }
  }, [searchParams]);

  // Reset status filter to "All Status" if "Closed" is selected when switching to General Inquiries
  useEffect(() => {
    if (reportSource === 'messages' && selectedStatusFilter === 'Closed') {
      setSelectedStatusFilter('All Status');
    }
  }, [reportSource, selectedStatusFilter]);

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

  // Fetch contact messages
  const { data: contactData, loading: contactLoading, error: contactError } = useQuery(GET_ALL_CONTACT_MESSAGES, {
    fetchPolicy: 'network-only',
    skip: reportSource !== 'messages',
  });

  // Update mutations
  const [updateUserReport] = useMutation(UPDATE_USER_REPORT_ADMIN);
  const [updateDriverReport] = useMutation(UPDATE_DRIVER_REPORT_ADMIN);
  const [updateContactMessage] = useMutation(UPDATE_CONTACT_MESSAGE);
  const [sendContactReply] = useMutation(SEND_CONTACT_REPLY);
  const [updateDriver] = useMutation(UPDATE_DRIVER);

  // Select appropriate data based on report source
  const data = reportSource === 'users' ? userData : reportSource === 'drivers' ? driverData : contactData;
  const loading = reportSource === 'users' ? userLoading : reportSource === 'drivers' ? driverLoading : contactLoading;
  const error = reportSource === 'users' ? userError : reportSource === 'drivers' ? driverError : contactError;
  const updateReport = reportSource === 'users' ? updateUserReport : updateDriverReport;
  const typeFilterOptions = reportSource === 'users' 
    ? userTypeFilterOptions 
    : reportSource === 'drivers' 
    ? driverTypeFilterOptions 
    : []; // General Inquiries don't have types

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
    : reportSource === 'drivers'
    ? data?.getAllDriverReports?.reports
    : data?.getAllContactMessages?.contactMessages;

  const filteredReports = reports?.filter((report: Report | ContactMessage) => {
    const searchLower = searchTerm.toLowerCase();
    
    // Handle different report types
    let matchesSearch = false;
    
    if (reportSource === 'messages') {
      const message = report as ContactMessage;
      matchesSearch = 
        message.name.toLowerCase().includes(searchLower) ||
        message.email.toLowerCase().includes(searchLower) ||
        message.message.toLowerCase().includes(searchLower);
    } else {
      const normalReport = report as Report;
      matchesSearch = normalReport.title?.toLowerCase().includes(searchLower) || false;
    }
    
    if (reportSource === 'users' && (report as Report).user) {
      const userReport = report as Report;
      matchesSearch = matchesSearch ||
        userReport.user!.firstName.toLowerCase().includes(searchLower) ||
        userReport.user!.lastName.toLowerCase().includes(searchLower) ||
        userReport.user!.email.toLowerCase().includes(searchLower);
    } else if (reportSource === 'drivers' && (report as Report).driver) {
      const driverReport = report as Report;
      matchesSearch = matchesSearch ||
        driverReport.driver!.firstName.toLowerCase().includes(searchLower) ||
        driverReport.driver!.lastName.toLowerCase().includes(searchLower) ||
        driverReport.driver!.email.toLowerCase().includes(searchLower) ||
        driverReport.driver!.driverId.toLowerCase().includes(searchLower) ||
        (driverReport.driver!.vehiclePlateNumber && driverReport.driver!.vehiclePlateNumber.toLowerCase().includes(searchLower));
    }
    
    const matchesStatus = selectedStatusFilter === 'All Status' || 
      report.status === selectedStatusFilter.toUpperCase().replace(' ', '_');
    
    // Contact messages don't have reportType, skip type filter for them
    const matchesType = reportSource === 'messages' || 
      selectedTypeFilter === 'All Types' || 
      (report as Report).reportType === selectedTypeFilter.toUpperCase().replace(' ', '_');
    
    return matchesSearch && matchesStatus && matchesType;
  }).sort((a, b) => {
    // Handle sorting for different types
    if (sortBy === 'Alphabetical (A-Z)' || sortBy === 'Alphabetical (Z-A)') {
      const aValue = reportSource === 'messages' ? (a as ContactMessage).name : (a as Report).title;
      const bValue = reportSource === 'messages' ? (b as ContactMessage).name : (b as Report).title;
      return sortBy === 'Alphabetical (A-Z)' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    switch (sortBy) {
      case 'Newest First':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'Oldest First':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      default:
        return 0;
    }
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

  // Clear selections when switching tabs
  useEffect(() => {
    setSelectedReports([]);
  }, [reportSource]);

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatusFilter(status);
    setShowStatusDropdown(false);
  };

  const handleTypeFilterChange = (type: string) => {
    setSelectedTypeFilter(type);
    setShowTypeDropdown(false);
  };

  const handleRowClick = (report: Report | ContactMessage) => {
    if (reportSource === 'messages') {
      setSelectedContactForDetails(report as ContactMessage);
      return;
    }
    setSelectedReport(report as Report);
    setExpandedRow(true);
  };

  const handleCloseDetailsModal = () => {
    setExpandedRow(false);
    setSelectedReport(null);
  };

  const handleCloseContactDetailsModal = () => {
    setSelectedContactForDetails(null);
  };

  const handleSelectReport = (id: string) => {
    setSelectedReports(prev =>
      prev.includes(id)
        ? prev.filter(reportId => reportId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const currentPageIds = paginatedReports.map((report: Report) => report.id);
    const allCurrentPageSelected = currentPageIds.every((id: string) => selectedReports.includes(id));
    
    if (allCurrentPageSelected) {
      // Deselect only items from current page
      setSelectedReports(prev => prev.filter((id: string) => !currentPageIds.includes(id)));
    } else {
      // Add current page items to existing selection
      setSelectedReports(prev => {
        const newSelection = [...prev];
        currentPageIds.forEach((id: string) => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  const handleUpdateReport = (report: Report | ContactMessage) => {
    if (reportSource === 'messages') {
      // For contact messages, open reply modal
      setSelectedContactMessage(report as ContactMessage);
      setReplySubject('Ads2Go Help Support');
      setReplyMessage('');
      setIsReplyModalOpen(true);
      return;
    }
    setSelectedReport(report as Report);
    const reportData = report as Report;
    setUpdateData({
      status: reportData.status,
      adminNotes: reportData.adminNotes || ''
    });
    setIsUpdateModalOpen(true);
  };

  const handleUpdateSubmit = async () => {
    if (!selectedReport) return;

    try {
      await updateReport({
        variables: {
          id: selectedReport.id,
          input: {
            status: updateData.status,
            adminNotes: updateData.adminNotes
          }
        },
        refetchQueries: [
          { query: reportSource === 'users' ? GET_ALL_USER_REPORTS : GET_ALL_DRIVER_REPORTS }
        ],
      });
      setIsUpdateModalOpen(false);
      setSelectedReport(null);
    } catch (error) {
      console.error('Error updating report:', error);
    }
  };

  const handleBulkStatusUpdate = async (status: ReportStatus) => {
    try {
      if (reportSource === 'messages') {
        // Handle Contact Messages bulk update
        await Promise.all(
          selectedReports.map(id =>
            updateContactMessage({
              variables: {
                id,
                input: {
                  status
                }
              },
              refetchQueries: [{ query: GET_ALL_CONTACT_MESSAGES }],
            })
          )
        );
      } else {
        // Handle User/Driver Reports bulk update
        await Promise.all(
          selectedReports.map(id =>
            updateReport({
              variables: {
                id,
                input: {
                  status
                }
              },
              refetchQueries: [
                { query: reportSource === 'users' ? GET_ALL_USER_REPORTS : GET_ALL_DRIVER_REPORTS }
              ],
            })
          )
        );
      }
      setSelectedReports([]);
    } catch (error) {
      console.error('Error bulk updating reports:', error);
    }
  };

  // Handle sending reply to contact message via email
  const handleSendReply = async () => {
    if (!selectedContactMessage || !replySubject.trim() || !replyMessage.trim()) {
      setErrorMessage('Please fill in both subject and message fields.');
      setShowErrorModal(true);
      return;
    }

    setIsSendingReply(true);

    try {
      const result = await sendContactReply({
        variables: {
          input: {
            contactMessageId: selectedContactMessage.id,
            subject: replySubject.trim(),
            message: replyMessage.trim()
          }
        },
        refetchQueries: [{ query: GET_ALL_CONTACT_MESSAGES }]
      });

      if (result.data?.sendContactReply?.success) {
        setSuccessMessage('Reply sent successfully via email!');
        setShowSuccessModal(true);
        setIsReplyModalOpen(false);
        setSelectedContactMessage(null);
        setReplySubject('');
        setReplyMessage('');
      } else {
        setErrorMessage(result.data?.sendContactReply?.message || 'Failed to send reply');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      console.error('Error sending reply:', error);
      setErrorMessage(error.message || 'Failed to send reply. Please try again.');
      setShowErrorModal(true);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Handle updating contact message status
  const handleUpdateContactStatus = async (messageId: string, newStatus: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED') => {
    try {
      await updateContactMessage({
        variables: {
          id: messageId,
          input: {
            status: newStatus
          }
        },
        refetchQueries: [{ query: GET_ALL_CONTACT_MESSAGES }]
      });

      setSuccessMessage(`Message status updated to ${newStatus.replace('_', ' ')}`);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error updating contact message status:', error);
      setErrorMessage(error.message || 'Failed to update status');
      setShowErrorModal(true);
    }
  };

  const handleExportToCSV = () => {
    if (selectedReports.length === 0) return;

    const reports = reportSource === 'users' 
      ? data?.getAllUserReports?.reports 
      : reportSource === 'drivers'
      ? data?.getAllDriverReports?.reports
      : data?.getAllContactMessages?.contactMessages;

    const selectedReportData = reports?.filter((r: any) => selectedReports.includes(r.id)) || [];
    
    let csvData;
    let filename;

    if (reportSource === 'messages') {
      // General Inquiries CSV
      csvData = selectedReportData.map((msg: ContactMessage) => ({
        'Message ID': msg.id,
        'Name': msg.name,
        'Email': msg.email,
        'Message': msg.message.replace(/,/g, ';').replace(/\n/g, ' '), // Replace commas and newlines
        'Category': msg.category,
        'Status': msg.status,
        'Created At': formatDate(msg.createdAt),
        'Resolved At': msg.resolvedAt ? formatDate(msg.resolvedAt) : 'N/A',
        'Resolved By': msg.resolvedBy?.adminName || 'N/A',
        'Admin Reply': msg.adminReply ? 'Yes' : 'No'
      }));
      filename = `general_inquiries_export_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (reportSource === 'users') {
      // User Reports CSV
      csvData = selectedReportData.map((report: Report) => ({
        'Report ID': report.id,
        'Title': report.title.replace(/,/g, ';'),
        'Type': report.reportType,
        'Status': report.status,
        'User Name': report.user ? `${report.user.firstName} ${report.user.lastName}` : 'N/A',
        'User Email': report.user?.email || 'N/A',
        'Description': report.description.replace(/,/g, ';').replace(/\n/g, ' '),
        'Admin Notes': report.adminNotes?.replace(/,/g, ';').replace(/\n/g, ' ') || 'N/A',
        'Created At': formatDate(report.createdAt),
        'Updated At': formatDate(report.updatedAt),
        'Resolved At': report.resolvedAt ? formatDate(report.resolvedAt) : 'N/A',
        'Attachments': report.attachments.length
      }));
      filename = `user_reports_export_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      // Driver Reports CSV
      csvData = selectedReportData.map((report: Report) => ({
        'Report ID': report.id,
        'Title': report.title.replace(/,/g, ';'),
        'Type': report.reportType,
        'Status': report.status,
        'Driver ID': report.driver?.driverId || 'N/A',
        'Driver Name': report.driver ? `${report.driver.firstName} ${report.driver.lastName}` : 'N/A',
        'Driver Email': report.driver?.email || 'N/A',
        'Vehicle Plate': report.driver?.vehiclePlateNumber || 'N/A',
        'Description': report.description.replace(/,/g, ';').replace(/\n/g, ' '),
        'Admin Notes': report.adminNotes?.replace(/,/g, ';').replace(/\n/g, ' ') || 'N/A',
        'Created At': formatDate(report.createdAt),
        'Updated At': formatDate(report.updatedAt),
        'Resolved At': report.resolvedAt ? formatDate(report.resolvedAt) : 'N/A',
        'Attachments': report.attachments.length
      }));
      filename = `driver_reports_export_${new Date().toISOString().split('T')[0]}.csv`;
    }

    if (csvData.length === 0) return;

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).map(val => `"${val}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Driver Edit Modal Handlers
  const handleOpenDriverEditModal = async (report: Report) => {
    if (report.reportType !== 'UPDATE_PROFILE_DETAILS' || !report.driver) {
      return;
    }

    setIsLoadingDriverDetails(true);
    setIsDriverEditModalOpen(true);

    try {
      // Parse requested changes from report description
      const changes = JSON.parse(report.description);
      setRequestedChanges(changes);
      setSelectedReport(report);

      // Fetch current driver details using lazy query
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({
          query: `
            query GetDriverById($driverId: ID!) {
              getDriverById(driverId: $driverId) {
                id
                driverId
                firstName
                middleName
                lastName
                email
                contactNumber
                address
                licenseNumber
                licensePictureURL
                licenseFrontURL
                licenseBackURL
                vehiclePlateNumber
                vehicleModel
                vehicleType
                vehicleYear
                vehiclePhotoURL
                orCrPictureURL
                orPictureURL
                crPictureURL
                profilePicture
              }
            }
          `,
          variables: { driverId: report.driver.driverId },
        }),
      });

      const result = await response.json();
      
      // Check for GraphQL errors
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        setIsDriverEditModalOpen(false);
        setIsLoadingDriverDetails(false);
        return;
      }
      
      if (result.data?.getDriverById) {
        setDriverDetails(result.data.getDriverById);
      } else {
        console.error('No driver data returned');
        setIsDriverEditModalOpen(false);
      }
    } catch (error) {
      console.error('Error fetching driver details:', error);
      setIsDriverEditModalOpen(false);
    } finally {
      setIsLoadingDriverDetails(false);
    }
  };

  const handleApproveDriverChanges = async () => {
    if (!selectedReport || !driverDetails || !requestedChanges || isApprovingChanges) return;

    setIsApprovingChanges(true);

    try {
      // Build update input from requested changes
      const updateInput: any = {};

      requestedChanges.changes.forEach((change: any) => {
        const fieldKey = change.fieldKey;
        
        // Map field keys to actual driver fields
        if (fieldKey === 'vehiclePhoto') {
          updateInput.vehiclePhotoURL = change.newValue;
        } else if (fieldKey === 'orCrDocument') { // legacy single field
          updateInput.orCrPictureURL = change.newValue;
        } else if (fieldKey === 'orPicture') {
          updateInput.orPictureURL = change.newValue;
        } else if (fieldKey === 'crPicture') {
          updateInput.crPictureURL = change.newValue;
        } else if (fieldKey === 'licenseFront') {
          updateInput.licenseFrontURL = change.newValue;
        } else if (fieldKey === 'licenseBack') {
          updateInput.licenseBackURL = change.newValue;
        } else if (fieldKey === 'profilePicture') {
          updateInput.profilePicture = change.newValue;
        } else if (change.newValue && change.newValue !== 'See attachment') {
          updateInput[fieldKey] = change.newValue;
        }
      });

      // Update driver details
      await updateDriver({
        variables: {
          driverId: driverDetails.driverId,
          input: updateInput,
        },
      });

      // Update report status to RESOLVED
      await updateDriverReport({
        variables: {
          id: selectedReport.id,
          input: {
            status: 'RESOLVED',
            adminNotes: `Profile details updated successfully by ${admin?.firstName || 'Admin'} on ${new Date().toLocaleString()}`,
          },
        },
        refetchQueries: [{ query: GET_ALL_DRIVER_REPORTS }],
      });

      // Show success modal
      setSuccessMessage('Driver details updated successfully!');
      setShowSuccessModal(true);
      setIsDriverEditModalOpen(false);
      setShowApproveConfirmModal(false);
      setSelectedReport(null);
      setDriverDetails(null);
      setRequestedChanges(null);
    } catch (error: any) {
      console.error('Error updating driver details:', error);
      setErrorMessage(`Failed to update driver details: ${error.message || 'Unknown error'}`);
      setShowErrorModal(true);
    } finally {
      setIsApprovingChanges(false);
    }
  };

  const handleRejectDriverChanges = async () => {
    if (!selectedReport || !rejectReason.trim() || isRejectingChanges) return;

    setIsRejectingChanges(true);

    try {
      // Update report status to CLOSED
      await updateDriverReport({
        variables: {
          id: selectedReport.id,
          input: {
            status: 'CLOSED',
            adminNotes: `Request rejected by ${admin?.firstName || 'Admin'}: ${rejectReason}`,
          },
        },
        refetchQueries: [{ query: GET_ALL_DRIVER_REPORTS }],
      });

      // Show success modal
      setSuccessMessage('Request rejected successfully');
      setShowSuccessModal(true);
      setIsDriverEditModalOpen(false);
      setShowRejectPromptModal(false);
      setRejectReason('');
      setSelectedReport(null);
      setDriverDetails(null);
      setRequestedChanges(null);
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      setErrorMessage(`Failed to reject request: ${error.message || 'Unknown error'}`);
      setShowErrorModal(true);
    } finally {
      setIsRejectingChanges(false);
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
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
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
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-md w-fit">
          <button
            onClick={() => {
              setReportSource('users');
              setCurrentPage(1);
              setSelectedTypeFilter('All Types');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              reportSource === 'users'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={18} />
            <span className="font-medium">User Reports</span>
          </button>
          <button
            onClick={() => {
              setReportSource('drivers');
              setCurrentPage(1);
              setSelectedTypeFilter('All Types');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              reportSource === 'drivers'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Car size={18} />
            <span className="font-medium">Driver Reports</span>
          </button>
          <button
            onClick={() => {
              setReportSource('messages');
              setCurrentPage(1);
              setSelectedTypeFilter('All Types');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              reportSource === 'messages'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <MessageSquare size={18} />
            <span className="font-medium">General Inquiries</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:justify-end lg:items-center gap-4 mb-6">
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-col sm:flex-row gap-1 w-full">
            <input
              type="text"
              className="text-xs text-black rounded-md pl-4 lg:pl-5 py-3 w-full lg:w-80 shadow-md focus:outline-none bg-white"
              placeholder={
                reportSource === 'users' 
                  ? "Search by title, user name, or email" 
                  : reportSource === 'drivers'
                  ? "Search by title, driver name, ID, or vehicle"
                  : "Search by name, email, or message"
              }
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
              {/* Only show Type filter for User Reports and Driver Reports, not General Inquiries */}
              {reportSource !== 'messages' && (
                <div className="relative w-full sm:w-40">
                  <button
                    onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                    className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 lg:pl-6 pr-3 lg:pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                  >
                    <span className="truncate">{formatTypeLabel(selectedTypeFilter)}</span>
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
                        className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                      >
                        {typeFilterOptions.map((type) => (
                          <button
                            key={type}
                            onClick={() => handleTypeFilterChange(type)}
                            className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                          >
                            {formatTypeLabel(type)}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              <div className="relative w-full sm:w-36">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 lg:pl-6 pr-3 lg:pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  <span className="truncate">{sortBy}</span>
                  <ChevronDown
                    size={16}
                    className={`transform transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : 'rotate-0'}`}
                  />
                </button>
                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                    >
                      {sortByOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => { setSortBy(option); setShowSortDropdown(false); }}
                          className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {option}
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
      {selectedReports.length > 0 && (() => {
        // Get statuses of selected reports
        const selectedReportStatuses = filteredReports
          .filter((r: Report | ContactMessage) => selectedReports.includes(r.id))
          .map((r: Report | ContactMessage) => r.status);

        // Determine which bulk actions are valid based on selected statuses
        let canBulkResolve = false;
        let canBulkClose = false;
        let infoMessage = '';

        // Check if ALL selected are final statuses
        const allFinalStatuses = selectedReportStatuses.every(
          (s: string) => s === 'RESOLVED' || s === 'CLOSED'
        );

        // Check if statuses are mixed
        const hasMixedStatuses = new Set(selectedReportStatuses).size > 1;

        if (reportSource === 'messages') {
          // Contact Messages: Can only resolve if ALL are IN_PROGRESS
          canBulkResolve = selectedReportStatuses.every((s: string) => s === 'IN_PROGRESS');
          
          if (!canBulkResolve) {
            if (allFinalStatuses) {
              infoMessage = selectedReports.length === 1 
                ? 'Final status - cannot be changed' 
                : 'Final statuses - cannot be changed';
            } else {
              infoMessage = 'Only IN_PROGRESS messages can be bulk resolved';
            }
          }
        } else {
          // User/Driver Reports: Can resolve if ALL are IN_PROGRESS
          canBulkResolve = selectedReportStatuses.every((s: string) => s === 'IN_PROGRESS');
          // Can close if ALL are PENDING or IN_PROGRESS
          canBulkClose = selectedReportStatuses.every((s: string) => s === 'PENDING' || s === 'IN_PROGRESS');
          
          if (!canBulkResolve && !canBulkClose) {
            if (allFinalStatuses) {
              infoMessage = selectedReports.length === 1 
                ? 'Final status - cannot be changed' 
                : 'Final statuses - cannot be changed';
            } else if (hasMixedStatuses) {
              infoMessage = 'Cannot bulk update reports with mixed statuses';
            }
          }
        }

        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-sm font-medium text-blue-800">
                  {selectedReports.length} {reportSource === 'messages' ? 'message' : 'report'}{selectedReports.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex flex-wrap gap-2">
                  {/* Mark as Resolved - Only if ALL selected are IN_PROGRESS */}
                  {canBulkResolve && (
                    <button
                      onClick={() => handleBulkStatusUpdate('RESOLVED')}
                      className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded hover:bg-green-200"
                    >
                      Mark as Resolved
                    </button>
                  )}
                  
                  {/* Mark as Closed - Only for User/Driver Reports, and only if ALL are PENDING or IN_PROGRESS */}
                  {reportSource !== 'messages' && canBulkClose && (
                    <button
                      onClick={() => handleBulkStatusUpdate('CLOSED')}
                      className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded hover:bg-gray-200"
                    >
                      Mark as Closed
                    </button>
                  )}
                  
                  {/* Show info message if no status actions available */}
                  {infoMessage && (
                    <span className="text-xs text-gray-600 italic px-2 py-1">
                      {infoMessage}
                    </span>
                  )}
                  
                  {/* Export to CSV - Always available */}
                  <button
                    onClick={handleExportToCSV}
                    className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded hover:bg-blue-200"
                  >
                    Export to CSV
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
        );
      })()}

      {/* Table Content */}
      {error ? (
        <div className="text-center py-10 text-red-500">Error: {error.message}</div>
      ) : loading ? (
        <AdminLoader />
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {searchTerm ? 'No reports match your search criteria' : 'No reports found'}
        </div>
      ) : (
        <>
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-gray-600">
            <div className="col-span-3 flex items-center gap-2">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={paginatedReports.length > 0 && paginatedReports.every((report: Report) => selectedReports.includes(report.id))}
                onChange={handleSelectAll}
              />
              <span className="cursor-pointer truncate font-semibold" onClick={handleSelectAll}>
                {reportSource === 'messages' ? 'Name' : 'Title'}
              </span>
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>
            <div className={reportSource === 'messages' ? 'col-span-4' : 'col-span-2'}>
              {reportSource === 'messages' ? 'Email' : reportSource === 'users' ? 'User' : 'Driver'}
            </div>
            {reportSource !== 'messages' && (
              <div className="col-span-2 flex items-center">Category</div>
            )}
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
          <div className="flex-1">
            {paginatedReports.map((report: Report) => (
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
                        title={reportSource === 'messages' ? (report as ContactMessage).name : report.title}
                      >
                        {reportSource === 'messages' ? (report as ContactMessage).name : report.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span>{formatDate(report.createdAt)}</span>
                    </div>
                  </div>
                </div>

                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="grid grid-cols-2 gap-2">
                    {/* User or Driver or Email */}
                    <div>
                      <div className="font-medium">{reportSource === 'messages' ? 'Email:' : reportSource === 'users' ? 'User:' : 'Driver:'}</div>
                      <div>
                        {reportSource === 'messages'
                          ? (report as ContactMessage).email
                          : reportSource === 'users' && report.user
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

                    {/* Category - Only show for User/Driver reports */}
                    {reportSource !== 'messages' && (
                      <div>
                        <div className="font-medium">Category:</div>
                        <div>{formatTypeLabel((report as Report).reportType)}</div>
                      </div>
                    )}
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
                  <span className="truncate font-semibold" title={reportSource === 'messages' ? (report as ContactMessage).name : report.title}>
                    {reportSource === 'messages' ? (report as ContactMessage).name : report.title}
                  </span>
                </div>
                <div className={reportSource === 'messages' ? 'col-span-4' : 'col-span-2'} title={
                  reportSource === 'messages'
                    ? (report as ContactMessage).email
                    : reportSource === 'users' && report.user
                    ? `${report.user.firstName} ${report.user.lastName}`
                    : reportSource === 'drivers' && report.driver
                    ? `${report.driver.firstName} ${report.driver.lastName}`
                    : 'N/A'
                }>
                  {reportSource === 'messages'
                    ? (report as ContactMessage).email
                    : reportSource === 'users' && report.user
                    ? `${report.user.firstName} ${report.user.lastName}`
                    : reportSource === 'drivers' && report.driver
                    ? `${report.driver.firstName} ${report.driver.lastName}`
                    : 'N/A'}
                </div>
                {reportSource !== 'messages' && (
                  <div className="col-span-2 truncate">{formatTypeLabel((report as Report).reportType)}</div>
                )}
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
          ))}
          </div>
        </>
      )}

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
                <strong className="text-sm font-bold text-gray-700">
                  {selectedReport.reportType === 'UPDATE_PROFILE_DETAILS' ? 'Requested Changes:' : 'Description:'}
                </strong>
                {selectedReport.reportType === 'UPDATE_PROFILE_DETAILS' ? (
                  (() => {
                    try {
                      const data = JSON.parse(selectedReport.description);
                      return (
                        <div className="mt-3 space-y-3">
                          {data.changes?.map((change: any, index: number) => (
                            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <p className="font-semibold text-gray-900 mb-2">{change.fieldLabel}</p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-gray-500">Current:</span>
                                  <p className="text-gray-900 font-medium mt-1">{change.currentValue || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-blue-600">Requested:</span>
                                  <p className="text-blue-900 font-semibold mt-1">{change.newValue || 'N/A'}</p>
                                </div>
                              </div>
                              {change.hasAttachment && (
                                <p className="text-xs text-gray-500 mt-2 italic">📎 Document attached (see attachments below)</p>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    } catch {
                      return <p className="mt-1 text-gray-700">{selectedReport.description}</p>;
                    }
                  })()
                ) : (
                  <p className="mt-1 text-gray-700">{selectedReport.description}</p>
                )}</div>
              {selectedReport.adminNotes && (
                <div>
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-medium text-gray-700">Admin Notes:</strong>
                    {selectedReport.adminNotesUpdatedAt && (
                      <span className="text-xs text-gray-500">
                        Updated: {formatDate(selectedReport.adminNotesUpdatedAt)}
                      </span>
                    )}
                  </div>
                  <p className="w-full px-3 py-2 bg-white shadow-md border border-gray-100 rounded-lg focus:outline-none mt-1">
                    {selectedReport.adminNotes}
                  </p>
                  {selectedReport.adminNotesBy && selectedReport.adminNotesBy.adminName && (
                    <p className="text-xs text-gray-500 mt-1">
                      Added by: {selectedReport.adminNotesBy.adminName}
                      {selectedReport.adminNotesBy.adminEmail && ` (${selectedReport.adminNotesBy.adminEmail})`}
                    </p>
                  )}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-600" />
                  <strong className="text-sm font-medium text-gray-700">
                    {reportSource === 'users' ? 'User Email' : 'Driver Email'}
                  </strong>
                </div>
                <p className="mt-1 font-semibold text-black">
                  {reportSource === 'users' && selectedReport.user
                    ? selectedReport.user.email
                    : reportSource === 'drivers' && selectedReport.driver
                    ? selectedReport.driver.email
                    : 'N/A'}
                </p>
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

              {/* Update Profile Details Button */}
              {selectedReport.reportType === 'UPDATE_PROFILE_DETAILS' && 
               reportSource === 'drivers' && 
               (selectedReport.status === 'PENDING' || selectedReport.status === 'IN_PROGRESS') && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => handleOpenDriverEditModal(selectedReport)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    <Edit size={18} />
                    Review & Update Driver Details
                  </button>
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
            disabled={currentPage === 1 || totalPages === 0}
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
              const effectiveTotalPages = totalPages === 0 ? 1 : totalPages;
              let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
              let endPage = Math.min(effectiveTotalPages, startPage + maxVisiblePages - 1);

              if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    disabled={totalPages === 0}
                    className={`px-3 py-1 text-sm rounded ${
                      currentPage === i
                        ? "border border-gray-300 text-black" 
                        : "text-gray-700 hover:border border-gray-300"
                    } ${totalPages === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {i}
                  </button>
                );
              }

              if (endPage < effectiveTotalPages) {
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
            disabled={currentPage === totalPages || totalPages === 0}
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
                
                {(() => {
                  // Determine available status options based on current status
                  const getAvailableStatuses = (currentStatus: ReportStatus): string[] => {
                    switch (currentStatus) {
                      case 'PENDING':
                        return ['Closed']; // Can only close from pending (reject without addressing)
                      case 'IN_PROGRESS':
                        return ['Resolved', 'Closed']; // Can resolve or close after reviewing
                      case 'RESOLVED':
                        return []; // No changes allowed from resolved (final state)
                      case 'CLOSED':
                        return []; // No changes allowed from closed (final state)
                      default:
                        return [];
                    }
                  };

                  const availableStatuses = getAvailableStatuses(selectedReport.status);
                  
                  if (availableStatuses.length === 0) {
                    // Show current status as read-only
                    return (
                      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 text-gray-700 rounded-lg border border-gray-200">
                        <span className="text-sm font-medium">
                          {selectedReport.status.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        <span className="text-xs text-gray-500">(Final status - cannot be changed)</span>
                      </div>
                    );
                  }

                  return (
                    <>
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
                            {availableStatuses.map((status) => (
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
                    </>
                  );
                })()}
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

      {/* Driver Edit Modal */}
      {isDriverEditModalOpen && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">Update Driver Profile Details</h2>
              <button
                onClick={() => {
                  setIsDriverEditModalOpen(false);
                  setDriverDetails(null);
                  setRequestedChanges(null);
                  setSelectedReport(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <CloseIcon size={24} />
              </button>
            </div>

            {isLoadingDriverDetails ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading driver details...</p>
              </div>
            ) : driverDetails && requestedChanges ? (
              <div className="p-6 space-y-6">
                {/* Current Driver Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Users size={20} />
                    Current Driver Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Name:</span>
                      <p className="text-gray-900">
                        {[driverDetails.firstName, driverDetails.middleName, driverDetails.lastName]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Email:</span>
                      <p className="text-gray-900">{driverDetails.email}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Contact:</span>
                      <p className="text-gray-900">{driverDetails.contactNumber}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">License:</span>
                      <p className="text-gray-900">{driverDetails.licenseNumber}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Vehicle Plate:</span>
                      <p className="text-gray-900">{driverDetails.vehiclePlateNumber}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Vehicle:</span>
                      <p className="text-gray-900">
                        {driverDetails.vehicleYear} {driverDetails.vehicleModel} ({driverDetails.vehicleType})
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium text-gray-600">Address:</span>
                      <p className="text-gray-900">{driverDetails.address}</p>
                    </div>
                  </div>
                </div>

                {/* Requested Changes */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Edit size={20} />
                    Requested Changes
                  </h3>
                  <div className="space-y-4">
                    {requestedChanges.changes.map((change: any, index: number) => {
                      // Find the attachment for this field if it exists
                      const attachmentIndex = selectedReport.attachments.findIndex((att: string) =>
                        att.includes(change.fieldKey) || index < selectedReport.attachments.length
                      );
                      const attachment = attachmentIndex >= 0 ? selectedReport.attachments[attachmentIndex] : null;

                      return (
                        <div
                          key={change.fieldKey}
                          className="bg-white border-2 border-blue-100 rounded-lg p-4 hover:border-blue-300 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-2">{change.fieldLabel}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-gray-500">Current:</span>
                                  <p className="text-gray-900 font-medium mt-1">{change.currentValue || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-blue-600">Requested:</span>
                                  <p className="text-blue-900 font-semibold mt-1">
                                    {change.newValue === 'See attachment' ? '📎 See attachment below' : change.newValue}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Show attachment if exists */}
                              {change.hasAttachment && attachment && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <span className="text-sm text-gray-600 font-medium">Uploaded Document:</span>
                                  <div className="mt-2">
                                    {attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                                    attachment.includes('data:image/') ||
                                    attachment.includes('firebasestorage.googleapis.com') ? (
                                      <div>
                                        <img
                                          src={attachment}
                                          alt={change.fieldLabel}
                                          className="max-w-xs h-auto rounded-lg border border-gray-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                                          onClick={() => window.open(attachment, '_blank')}
                                        />
                                        <a
                                          href={attachment}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 text-xs underline mt-2 inline-block"
                                        >
                                          Open in new tab
                                        </a>
                                      </div>
                                    ) : (
                                      <a
                                        href={attachment}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm underline"
                                      >
                                        <FileText size={16} />
                                        View Document
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                {selectedReport && (selectedReport.status === 'PENDING' || selectedReport.status === 'IN_PROGRESS') ? (
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 sticky bottom-0 bg-white">
                    <button
                      onClick={() => setShowRejectPromptModal(true)}
                      className="flex items-center gap-2 px-6 py-3 border-2 border-red-500 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-semibold"
                    >
                      <CloseIcon size={18} />
                      Reject Request
                    </button>
                    <button
                      onClick={() => setShowApproveConfirmModal(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold"
                    >
                      <Save size={18} />
                      Approve & Update Details
                    </button>
                  </div>
                ) : (
                  <div className="pt-6 border-t border-gray-200">
                    <div className={`text-center py-3 px-4 rounded-lg ${
                      selectedReport?.status === 'RESOLVED' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p className="font-semibold">
                        {selectedReport?.status === 'RESOLVED' 
                          ? '✓ This request has been approved and processed' 
                          : `This request has been ${selectedReport?.status?.toLowerCase()}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-600">Failed to load driver details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {showApproveConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Approval</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to approve and apply all these changes to the driver's profile?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowApproveConfirmModal(false)}
                disabled={isApprovingChanges}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowApproveConfirmModal(false);
                  handleApproveDriverChanges();
                }}
                disabled={isApprovingChanges}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApprovingChanges && <Loader size={16} className="animate-spin" />}
                Yes, Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Prompt Modal */}
      {showRejectPromptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reject Request</h3>
            <p className="text-gray-700 mb-4">
              Please provide a reason for rejecting this request:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              disabled={isRejectingChanges}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              rows={4}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRejectPromptModal(false);
                  setRejectReason('');
                }}
                disabled={isRejectingChanges}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (rejectReason.trim()) {
                    setShowRejectPromptModal(false);
                    handleRejectDriverChanges();
                  }
                }}
                disabled={!rejectReason.trim() || isRejectingChanges}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isRejectingChanges && <Loader size={16} className="animate-spin" />}
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle size={24} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Success</h3>
            </div>
            <p className="text-gray-700 mb-6">{successMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessMessage('');
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Error</h3>
            </div>
            <p className="text-gray-700 mb-6">{errorMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowErrorModal(false);
                  setErrorMessage('');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Message Reply Modal */}
      {isReplyModalOpen && selectedContactMessage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!isSendingReply) {
              setIsReplyModalOpen(false);
              setSelectedContactMessage(null);
              setReplySubject('');
              setReplyMessage('');
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <MessageSquare size={24} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Contact Message</h2>
                  <p className="text-sm text-gray-500">Reply via email</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isSendingReply) {
                    setIsReplyModalOpen(false);
                    setSelectedContactMessage(null);
                    setReplySubject('');
                    setReplyMessage('');
                  }
                }}
                disabled={isSendingReply}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CloseIcon size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-500">From</p>
                    <p className="font-semibold text-gray-900">{selectedContactMessage.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={18} className="text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-semibold text-gray-900">{selectedContactMessage.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="font-semibold text-gray-900">{formatTypeLabel(selectedContactMessage.category)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedContactMessage.status === 'PENDING' 
                      ? 'bg-yellow-100 text-yellow-800'
                      : selectedContactMessage.status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {selectedContactMessage.status.replace('_', ' ')}
                  </div>
                </div>
              </div>

              {/* User's Message */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  User's Message
                </label>
                <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedContactMessage.message}</p>
                </div>
              </div>

              {/* Already Replied Notice */}
              {selectedContactMessage.adminReply && selectedContactMessage.adminReply.subject && selectedContactMessage.adminReply.message && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-900 mb-2">Reply Already Sent</p>
                      <div className="space-y-2 text-sm text-green-800">
                        <p><strong>Subject:</strong> {selectedContactMessage.adminReply.subject}</p>
                        <p><strong>Message:</strong> {selectedContactMessage.adminReply.message}</p>
                        <p className="text-xs text-green-600">
                          Sent by {selectedContactMessage.adminReply.sentBy?.adminName || 'Admin'} on{' '}
                          {selectedContactMessage.adminReply.sentAt 
                            ? new Date(selectedContactMessage.adminReply.sentAt).toLocaleString()
                            : 'Unknown date'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reply Form (only show if not already replied) */}
              {(!selectedContactMessage.adminReply || !selectedContactMessage.adminReply.subject || !selectedContactMessage.adminReply.message) && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Reply Subject *
                    </label>
                    <input
                      type="text"
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="Enter email subject..."
                      disabled={isSendingReply}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Reply Message *
                    </label>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Enter your reply message..."
                      disabled={isSendingReply}
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> This reply will be sent to <strong>{selectedContactMessage.email}</strong> via email. 
                      The message status will automatically change to "In Progress" after sending.
                    </p>
                  </div>
                </>
              )}

              {/* Status Update Options */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Update Status
                </label>
                
                {selectedContactMessage.status === 'IN_PROGRESS' ? (
                  // Only show "Mark as Resolved" when status is IN_PROGRESS
                  <button
                    onClick={() => handleUpdateContactStatus(selectedContactMessage.id, 'RESOLVED')}
                    disabled={isSendingReply}
                    className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Mark as Resolved
                  </button>
                ) : selectedContactMessage.status === 'RESOLVED' ? (
                  // Show status when already resolved
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle size={18} />
                    <p className="text-sm font-medium">
                      This message has been marked as resolved
                    </p>
                  </div>
                ) : (
                  // Show info when PENDING
                  <p className="text-sm text-gray-600">
                    Status will automatically change to "In Progress" when you send a reply.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  if (!isSendingReply) {
                    setIsReplyModalOpen(false);
                    setSelectedContactMessage(null);
                    setReplySubject('');
                    setReplyMessage('');
                  }
                }}
                disabled={isSendingReply}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>
              {(!selectedContactMessage.adminReply || !selectedContactMessage.adminReply.subject || !selectedContactMessage.adminReply.message) && (
                <button
                  onClick={handleSendReply}
                  disabled={isSendingReply || !replySubject.trim() || !replyMessage.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isSendingReply && <Loader size={16} className="animate-spin" />}
                  {isSendingReply ? 'Sending...' : 'Send Reply via Email'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Message Details Modal (for General Inquiries) */}
      {selectedContactForDetails && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseContactDetailsModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">General Inquiry Details</h2>
                <p className="text-sm text-gray-500 mt-1">Contact form submission</p>
              </div>
              <button
                onClick={handleCloseContactDetailsModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <CloseIcon size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Name and Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={16} className="text-gray-600" />
                    <strong className="text-sm font-medium text-gray-700">Name</strong>
                  </div>
                  <p className="text-gray-900 font-semibold">{selectedContactForDetails.name}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Mail size={16} className="text-gray-600" />
                    <strong className="text-sm font-medium text-gray-700">Email</strong>
                  </div>
                  <p className="text-gray-900 font-semibold">{selectedContactForDetails.email}</p>
                </div>
              </div>

              {/* Category and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-gray-600" />
                    <strong className="text-sm font-medium text-gray-700">Category</strong>
                  </div>
                  <p className="text-gray-900">{formatTypeLabel(selectedContactForDetails.category)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(selectedContactForDetails.status)}
                    <strong className="text-sm font-medium text-gray-700">Status</strong>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedContactForDetails.status)}`}>
                    {selectedContactForDetails.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* User's Message */}
              <div>
                <strong className="text-sm font-bold text-gray-700 block mb-2">User's Message:</strong>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedContactForDetails.message}</p>
                </div>
              </div>

              {/* Admin Reply (if exists) */}
              {selectedContactForDetails.adminReply && selectedContactForDetails.adminReply.subject && selectedContactForDetails.adminReply.message && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-900 mb-2">Admin Reply Sent</p>
                      <div className="space-y-2 text-sm text-green-800">
                        <div>
                          <strong>Subject:</strong> {selectedContactForDetails.adminReply.subject}
                        </div>
                        <div>
                          <strong>Message:</strong>
                          <p className="mt-1 whitespace-pre-wrap">{selectedContactForDetails.adminReply.message}</p>
                        </div>
                        <p className="text-xs text-green-600 mt-2">
                          Sent by {selectedContactForDetails.adminReply.sentBy?.adminName || 'Admin'} on{' '}
                          {selectedContactForDetails.adminReply.sentAt
                            ? new Date(selectedContactForDetails.adminReply.sentAt).toLocaleString()
                            : 'Unknown date'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarClock size={16} className="text-blue-500" />
                    <strong className="text-sm font-medium text-gray-700">Created</strong>
                  </div>
                  <p className="text-gray-900">{formatDate(selectedContactForDetails.createdAt)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarClock size={16} className="text-yellow-500" />
                    <strong className="text-sm font-medium text-gray-700">Last Updated</strong>
                  </div>
                  <p className="text-gray-900">{formatDate(selectedContactForDetails.updatedAt)}</p>
                </div>
              </div>

              {/* Resolved Info */}
              {selectedContactForDetails.resolvedAt && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarCheck size={16} className="text-green-500" />
                    <strong className="text-sm font-medium text-gray-700">Resolved At</strong>
                  </div>
                  <p className="text-gray-900">{formatDate(selectedContactForDetails.resolvedAt)}</p>
                  {selectedContactForDetails.resolvedBy && (
                    <p className="text-xs text-gray-500 mt-1">
                      Resolved by: {selectedContactForDetails.resolvedBy.adminName}
                      {selectedContactForDetails.resolvedBy.adminEmail && ` (${selectedContactForDetails.resolvedBy.adminEmail})`}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCloseContactDetailsModal}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;