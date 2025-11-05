import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import {
  ChevronLeft,
  ChevronDown,
  Check,
  X,
  Trash,
  Clock,
  Calendar,
  Info,
} from "lucide-react";
import { AdminLoader } from "../../components/ProtectedRoute";
import { motion, AnimatePresence } from "framer-motion";
import { GET_ADS_BY_USER, GET_ALL_ADS, UPDATE_AD, DELETE_AD, type Ad, type User } from "../../graphql/admin/ads";
import { GET_ALL_USERS } from "../../graphql/admin/queries/manageUsers";
import { ToastContainer } from "../../components/ToastNotification";
import ConfirmationModal from '../../components/ConfirmationModal';

interface QueryResult {
  getAdsByUser: Ad[];
}

const UserAdsPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [filteredAds, setFilteredAds] = useState<Ad[]>([]);
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [adToReject, setAdToReject] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adToDelete, setAdToDelete] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const [processingAds, setProcessingAds] = useState<Set<string>>(new Set());

  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
  }>>([]);

  // Toast notification functions
  const addToast = (toast: Omit<typeof toasts[0], 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      removeToast(id);
    }, toast.duration || 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const [updateAd, { refetch }] = useMutation(UPDATE_AD, {
    onCompleted: (data) => {
      console.log('Ad updated successfully:', data);
      refetch();
      addToast({
        type: 'success',
        title: 'Success!',
        message: 'Advertisement has been updated successfully',
        duration: 5000
      });
    },
    onError: (error) => {
      console.error('Error updating ad:', error);
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: `Error updating ad: ${error.message}`,
        duration: 6000
      });
    }
  });

  const confirmDelete = async () => {
  if (!adToDelete) return;

  try {
    await deleteAd({
      variables: { id: adToDelete }
    });
    addToast({
      type: 'success',
      title: 'Success!',
      message: 'Advertisement has been deleted successfully',
      duration: 5000
    });
    setShowDeleteModal(false);
    setAdToDelete(null);
  } catch (error) {
    console.error('Error deleting ad:', error);
    addToast({
      type: 'error',
      title: 'Error!',
      message: 'Something went wrong.',
      duration: 5000
    });
  }
};

const cancelDelete = () => {
  setShowDeleteModal(false);
  setAdToDelete(null);
};

  const [deleteAd] = useMutation(DELETE_AD, {
    onCompleted: () => {
      refetch();
      addToast({
        type: 'success',
        title: 'Success!',
        message: 'Advertisement has been deleted successfully',
        duration: 5000
      });
    },
    onError: (error) => {
      console.error('Error deleting ad:', error);
      addToast({
        type: 'error',
        title: 'Deletion Failed',
        message: `Error deleting ad: ${error.message}`,
        duration: 6000
      });
    }
  });

  const statusFilterOptions = [
    "All",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "RUNNING",
    "ENDED",
  ];

  const { data, loading, error } = useQuery<QueryResult>(GET_ADS_BY_USER, {
    variables: { userId },
    skip: !userId,
  });

  const { data: usersData } = useQuery(GET_ALL_USERS, {
    skip: !userId,
  });

  const userName = (() => {
    if (data?.getAdsByUser?.[0]?.userId) {
      return `${data.getAdsByUser[0].userId.firstName || ""} ${
        data.getAdsByUser[0].userId.lastName || ""
      }`.trim();
    }
    if (usersData?.getAllUsers && userId) {
      const user = usersData.getAllUsers.find((u: any) => u.id === userId);
      if (user) {
        return `${user.firstName || ""} ${user.lastName || ""}`.trim();
      }
    }
    return "";
  })();

  useEffect(() => {
    if (data?.getAdsByUser) {
      let tempAds = data.getAdsByUser;
      if (searchTerm) {
        tempAds = tempAds.filter(
          (ad) =>
            ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ad.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      if (selectedStatusFilter !== "All") {
        tempAds = tempAds.filter((ad) => ad.status === selectedStatusFilter);
      }
      setFilteredAds(tempAds);
    }
  }, [data, searchTerm, selectedStatusFilter]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatusFilter(status);
    setShowStatusDropdown(false);
  };

  const capitalize = (str: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const handleRowClick = (adId: string) => {
    setExpandedAdId(expandedAdId === adId ? null : adId);
  };

  const handleApprove = async (adId: string) => {
    try {
      await updateAd({
        variables: {
          id: adId,
          input: {
            status: 'APPROVED'
          }
        }
      });
    } catch (error) {
      console.error('Error approving ad:', error);
    }
  };

  const handleReject = (adId: string) => {
    setAdToReject(adId);
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!adToReject || !rejectReason.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please provide a reason for rejection',
        duration: 4000
      });
      return;
    }

    // Prevent multiple clicks
    if (processingAds.has(adToReject)) {
      return;
    }

    // Add to processing set
    setProcessingAds(prev => new Set(prev).add(adToReject));

    try {
      await updateAd({
        variables: {
          id: adToReject,
          input: {
            status: 'REJECTED',
            reasonForReject: rejectReason
          }
        }
      });
      addToast({
        type: 'success',
        title: 'Success!',
        message: 'Advertisement has been rejected successfully',
        duration: 5000
      });
      setShowRejectModal(false);
      setRejectReason('');
      setAdToReject(null);
    } catch (error) {
      console.error('Error rejecting ad:', error);
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Something went wrong.',
        duration: 5000
      });
    } finally {
      // Remove from processing set
      setProcessingAds(prev => {
        const newSet = new Set(prev);
        newSet.delete(adToReject!);
        return newSet;
      });
    }
  };

  const handleDelete = (adId: string) => {
    setAdToDelete(adId);
    setShowDeleteModal(true);
  };

  if (!userId)
    return (
      <div className="p-10 text-center text-gray-700">No user ID provided.</div>
    );
  if (loading)
    return <AdminLoader />;
  if (error)
    return (
      <div className="p-10 text-center text-red-500">
        Error loading ads: {error.message}
      </div>
    );

  return (
    <div
      className={`min-h-screen bg-gray-100 p-4 md:p-10 flex flex-col ${
        isMobile ? "px-10 pl-28" : "md:pl-64 md:pr-5"
      }`}
    >
      {/* Header */}
      <div className="flex items-center pt-7 sm:pt-3 mb-3">
        <Link
          to="/admin/users"
          className="flex items-center text-gray-600 hover:text-gray-800 text-xs sm:text-sm"
        >
          <ChevronLeft size={20} />
          <span className="ml-2 font-semibold">Back to Advertisers</span>
        </Link>
      </div>

      {/* Mobile Header */}
      {isMobile && (
        <div className="flex items-center mb-4">
          <h1 className="text-xl font-bold text-gray-800">
            Advertisements of <span className="font-bold">{userName}</span>
          </h1>
        </div>
      )}

      {/* Header with Title + Filters */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
        {!isMobile && (
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
            Advertisements of <span className="font-bold">{userName}</span>
          </h1>
        )}

        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          {/* Search Input */}
          <div className="w-full lg:w-80">
            <input
              type="text"
              className="w-full text-xs text-black rounded-lg pl-4 py-3 shadow-md focus:outline-none bg-white"
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div
            className={`relative flex-1 sm:flex-none ${
              isMobile ? 'w-28 self-end' : 'sm:w-32'
            }`}
          >
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
            >
              <span className="truncate">
                {selectedStatusFilter === "All"
                  ? "All Status"
                  : capitalize(selectedStatusFilter)}
              </span>
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${
                  showStatusDropdown ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {showStatusDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute z-10 top-full mt-2 ${
                    isMobile ? 'right-0 w-24' : 'left-0 w-full'
                  } rounded-lg shadow-lg bg-white overflow-hidden`}
                >
                  {statusFilterOptions.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusFilterChange(status)}
                      className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      {status === "All" ? "All Status" : capitalize(status)}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="hidden md:grid grid-cols-[7rem,1.3fr,0.8fr,1fr,1fr] text-gray-700 text-sm font-semibold px-6 pt-4 mb-4">
        <div>Image</div>
        <div>Title</div>
        <div>Price</div>
        <div>Status</div>
        <div>Date Created</div>
      </div>

      {/* Ads List */}
      <div className="space-y-4">
        {filteredAds.length === 0 ? (
          <div className="p-6 text-center text-gray-500 bg-white rounded-xl shadow-md">
            No advertisements found.
          </div>
        ) : (
          filteredAds.map((ad) => (
            <React.Fragment key={ad.id}>
              <AnimatePresence>
                {/* Row Container (Hidden when expanded) */}
                {expandedAdId !== ad.id && (
                  <motion.div
                    initial={{ opacity: 1, height: "auto" }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className={`grid md:grid-cols-[7rem,1.3fr,0.8fr,1fr,1fr] bg-white rounded-xl shadow-md px-4 md:px-6 py-4 items-center transition-shadow duration-200 hover:shadow-lg cursor-pointer`}
                    onClick={() => handleRowClick(ad.id)}
                  >
                    {/* Mobile Layout (Stacked Info) */}
                    <div className="md:hidden flex flex-col text-sm text-gray-800">
                      <div className="flex items-start gap-4">
                        <div className="w-24 h-24 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {ad.mediaFile ? (
                            ad.adFormat === "IMAGE" ? (
                              <img
                                src={ad.mediaFile}
                                alt={ad.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video controls className="w-full h-full object-cover">
                                <source src={ad.mediaFile} />
                              </video>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs text-center">No Media</span>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900 leading-tight truncate">
                              {ad.title}
                            </h3>
                            <p className="text-gray-600 text-sm">${ad.price.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(ad.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Columns */}
                    <div className="hidden md:flex items-center">
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                        {ad.mediaFile ? (
                          ad.adFormat === "IMAGE" ? (
                            <img
                              src={ad.mediaFile}
                              alt={ad.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video controls className="w-full h-full object-cover">
                              <source src={ad.mediaFile} />
                            </video>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs text-center">
                            No Media
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="hidden md:block font-medium text-gray-800 truncate">
                      {ad.title}
                    </div>
                    <div className="hidden md:block font-semibold">${ad.price.toFixed(2)}</div>
                    <div className="hidden md:block">
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          ad.status === "APPROVED" || ad.status === "RUNNING"
                            ? "bg-green-200 text-green-800"
                            : ad.status === "PENDING"
                            ? "bg-yellow-200 text-yellow-800"
                            : "bg-red-200 text-red-800"
                        }`}
                      >
                        {capitalize(ad.status)}
                      </span>
                    </div>
                    <div className="hidden md:block">
                      {new Date(ad.createdAt).toLocaleDateString()}
                    </div>
                  </motion.div>
                )}

                {/* Expanded Content (Shown when row is expanded) */}
                {expandedAdId === ad.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="bg-white rounded-xl shadow-lg px-4 md:px-1 py-2 cursor-pointer"
                    onClick={() => handleRowClick(ad.id)}
                  >
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 ">
                        {/* Column 1 */}
                        <div className="flex flex-col space-y-4">
                          <div className="flex flex-col md:flex-row md:items-start md:space-x-4 space-y-4 md:space-y-0">
                            <div className="w-48 h-48 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center shadow-md">
                              {ad.mediaFile ? (
                                ad.adFormat === "IMAGE" ? (
                                  <img
                                    src={ad.mediaFile}
                                    alt={ad.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <video controls className="w-full h-full object-cover">
                                    <source src={ad.mediaFile} />
                                  </video>
                                )
                              ) : (
                                <span className="text-gray-400 text-sm text-center p-4">
                                  No Media Available
                                </span>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <h3 className="text-xl font-bold text-gray-800">{ad.title}</h3>
                                  <p className="text-lg text-gray-600 font-semibold">${ad.price.toFixed(2)}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm text-gray-700">
                                <div className="flex items-center space-x-2">
                                  <Calendar size={16} className="text-gray-500" />
                                  <div className="flex flex-col">
                                    <p>Start Date</p>
                                    <p className="font-semibold">{new Date(ad.startTime).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Calendar size={16} className="text-gray-500" />
                                  <div className="flex flex-col">
                                    <p>End Date</p>
                                    <p className="font-semibold">{new Date(ad.endTime).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Info size={16} className="text-gray-500" />
                                  <div className="flex flex-col">
                                    <p>Material ID</p>
                                    <p className="font-semibold">{ad.materialId?.materialId || 'N/A'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Clock size={16} className="text-gray-500" />
                                  <div className="flex flex-col">
                                    <p>Duration</p>
                                    <p className="font-semibold">{ad.durationDays} days</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Clock size={16} className="text-gray-500" />
                                  <div className="flex flex-col">
                                    <p>Ad Length</p>
                                    <p className="font-semibold">{ad.adLengthSeconds ? `${ad.adLengthSeconds}s` : 'N/A'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Column 2 */}
                        <div className="flex flex-col space-y-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-500">Ad ID:</span>
                            <p className="text-sm text-black font-semibold">{ad.id}</p>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-500">Description:</span>
                            <p className="text-sm text-black font-semibold">
                              {ad.description || "No description provided."}
                            </p>
                          </div>
                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-2 text-gray-700">Payment Status</h4>
                            <div className="flex flex-col space-y-2 text-sm text-black font-semibold">
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                                <span>Created: {new Date(ad.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                <span>Pending Payment</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                <span>Payment Paid</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </React.Fragment>
          ))
        )}
      </div>
      
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 mb-5">Reject Advertisement</h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-6">
              <textarea
                id="rejectReason"
                name="rejectReason"
                required
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  // 🔹 Auto-expand behavior
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`; // max height ≈ 100px
                }}
                placeholder=" "
                className={`peer w-full px-0 pt-6 pb-2 text-gray-800 border-b bg-transparent focus:outline-none focus:border-blue-500 placeholder-transparent transition
                  ${!rejectReason.trim() ? 'border-gray-300' : 'border-gray-400'}
                `}
                style={{
                  minHeight: "40px",
                  maxHeight: "100px",
                  resize: "none",
                  overflowY: "auto",
                }}
              />

              {/* 🔹 Floating label with better spacing */}
              <label
                htmlFor="rejectReason"
                className={`absolute left-0 bg-white text-gray-600 transition-all duration-200
                  ${
                    rejectReason
                      ? '-top-2 text-sm text-blue-600 font-semibold'
                      : 'peer-placeholder-shown:top-5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'
                  }
                  peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600 peer-focus:font-semibold`}
              >
                Reason for rejection
              </label>

              <p className="mt-1 text-xs text-gray-500">This reason will be visible to the advertiser.</p>
            </div>
            <div className="flex gap-3 justify-between">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim() || (adToReject ? processingAds.has(adToReject) : false)}
                className={`px-4 py-2 text-white rounded transition-colors flex items-center gap-2 ${
                  !rejectReason.trim() || (adToReject ? processingAds.has(adToReject) : false)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {adToReject && processingAds.has(adToReject) && (
                  <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                )}
                {adToReject && processingAds.has(adToReject)
                  ? 'Processing...'
                  : 'Reject Advertisement'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Advertisement"
        message="Are you sure you want to delete this ad? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default UserAdsPage;
