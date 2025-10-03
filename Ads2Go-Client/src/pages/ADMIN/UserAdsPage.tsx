import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation} from "@apollo/client";
import {
  ChevronLeft,
  ChevronDown,
  Check,
  X,
  Trash,
  Clock,
  Calendar,
  Info,
  DollarSign,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GET_ADS_BY_USER, GET_ALL_ADS,
  UPDATE_AD,
  DELETE_AD,
  type Ad,
  type User } from "../../graphql/admin/ads";
import { GET_ALL_USERS } from "../../graphql/admin/queries/manageUsers";

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
      
      // Auto remove toast after duration (default 5 seconds)
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    };
  
    const removeToast = (id: string) => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    };
  
    
  const [updateAd] = useMutation(UPDATE_AD, {
      onCompleted: (data) => {
        console.log('Ad updated successfully:', data);
        refetch(); // Refresh the ads list
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
  
    const [deleteAd] = useMutation(DELETE_AD, {
      onCompleted: () => {
        refetch(); // Refresh the ads list
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

  // Fetch all users to get user information even when no ads exist
  const { data: usersData } = useQuery(GET_ALL_USERS, {
    skip: !userId,
  });

  // Get user name from ads data if available, otherwise from users data
  const userName = (() => {
    // First try to get from ads data
    if (data?.getAdsByUser?.[0]?.userId) {
      return `${data.getAdsByUser[0].userId.firstName || ""} ${
        data.getAdsByUser[0].userId.lastName || ""
      }`.trim();
    }
    
    // If no ads, get from users data
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
      addToast({
        type: 'success',
        title: 'Ad Approved',
        message: `Ad ${adId} approved successfully!`,
        duration: 4000
      });
    } catch (error) {
      console.error('Error approving ad:', error);
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: `Failed to approve ad: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 6000
      });
    }
  };

  const handleReject = (adId: string) => {
    setAdToReject(adId);
    setShowRejectModal(true);
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
    return (
      <div className="p-10 text-center text-gray-500">Loading ads...</div>
    );
  if (error)
    return (
      <div className="p-10 text-center text-red-500">
        Error loading ads: {error.message}
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center mb-3">
          <Link
            to="/admin/users"
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft size={24} />
            <span className="ml-2 font-semibold">Back to Advertisers</span>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-xl text-gray-800">
            Advertisements of <span className="font-bold">{userName}</span>
          </h1>

          {/* Search + Filter */}
          <div className="flex gap-2">
            <input
              type="text"
              className="text-xs text-black rounded-lg pl-4 py-2 w-64 shadow-md focus:outline-none bg-white"
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="relative w-32">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg px-4 py-2 shadow-md bg-white"
              >
                {selectedStatusFilter === "All"
                  ? "All Status"
                  : capitalize(selectedStatusFilter)}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${
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
                    className="absolute z-10 mt-2 w-full rounded-lg shadow-lg bg-white"
                  >
                    {statusFilterOptions.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusFilterChange(s)}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                      >
                        {s === "All" ? "All Status" : capitalize(s)}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[7rem,1.3fr,0.8fr,1fr,1fr,10rem] text-gray-700 text-sm font-semibold px-6 mb-4">
        <div>Image</div>
        <div>Title</div>
        <div>Price</div>
        <div>Status</div>
        <div>Date Created</div>
        <div className="text-center">Actions</div>
      </div>

      {/* Ads List with gaps */}
      <div className="space-y-4">
        {filteredAds.length === 0 ? (
          <div className="p-6 text-center text-gray-500 bg-white rounded-xl shadow-md">
            No advertisements found.
          </div>
        ) : (
          filteredAds.map((ad) => (
            <React.Fragment key={ad.id}>
              {/* Main Row */}
              <div
                className={`grid grid-cols-[7rem,1.3fr,0.8fr,1fr,1fr,10rem] items-center bg-white rounded-xl shadow-md px-6 py-4 transition-shadow duration-200 ${
                  expandedAdId === ad.id ? "shadow-lg" : "hover:shadow-lg"
                } cursor-pointer`}
                onClick={() => handleRowClick(ad.id)}
              >
                {/* Image */}
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

                {/* Title */}
                <div className="font-medium text-gray-800 truncate">
                  {ad.title}
                </div>

                {/* Price */}
                <div>${ad.price.toFixed(2)}</div>

                {/* Status */}
                <div>
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

                {/* Date Created */}
                <div>{new Date(ad.createdAt).toLocaleDateString()}</div>
                
                {/* Actions */}
                <div
                  className="flex items-center justify-center gap-1 w-[10rem]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {ad.status === "PENDING" && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(ad.id); }}
                        className="group flex items-center bg-green-200 hover:bg-green-200 text-green-700 rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-20 transition-[width] duration-300"
                      >
                        <Check className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                        <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                          Approve
                        </span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReject(ad.id); }}
                        className="group flex items-center bg-red-200 hover:bg-red-200 text-red-700 rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-16 transition-[width] duration-300"
                      >
                        <X className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                        <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 text-xs whitespace-nowrap transition-all duration-300">
                          Reject
                        </span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(ad.id)}
                    className="group flex items-center text-red-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                  >
                    <Trash 
                    className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300"
                    size={16} />
                    <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                    Delete
                  </span>
                  </button>
                </div>
              </div>

              {/* Expanded Details Card */}
              <AnimatePresence>
                {expandedAdId === ad.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="bg-gray-50 rounded-xl shadow-inner p-6 mt-[-1rem] mx-4 border border-t-0 border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Column 1 */}
                        <div className="flex flex-col space-y-4">
                          {/* Image and Title/Price/Status */}
                          <div className="flex flex-col md:flex-row md:items-start md:space-x-4 space-y-4 md:space-y-0">
                            {/* Image */}
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
                            {/* Title, Price, Status & Details List */}
                            <div className="flex-1 flex flex-col space-y-4">
                                <div className="flex items-center justify-between">
                                  {/* Title and Price */}
                                  <div className="flex flex-col">
                                    <h3 className="text-xl font-bold text-gray-800">{ad.title}</h3>
                                    <p className="text-lg text-gray-600 font-semibold">${ad.price.toFixed(2)}</p>
                                  </div>
                                </div>
                                {/* Details List */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm text-gray-700">
                                  <div className="flex items-center space-x-2">
                                    <Calendar size={16} className="text-gray-500" />
                                    <div className="flex flex-col">
                                      <p className="font-semibold">Start Date</p>
                                      <p>{new Date(ad.startTime).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Calendar size={16} className="text-gray-500" />
                                    <div className="flex flex-col">
                                      <p className="font-semibold">End Date</p>
                                      <p>{new Date(ad.endTime).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Info size={16} className="text-gray-500" />
                                    <div className="flex flex-col">
                                      <p className="font-semibold">Material ID</p>
                                      <p>{ad.materialId?.materialId || 'N/A'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Clock size={16} className="text-gray-500" />
                                    <div className="flex flex-col">
                                      <p className="font-semibold">Duration</p>
                                      <p>{ad.durationDays} days</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Clock size={16} className="text-gray-500" />
                                    <div className="flex flex-col">
                                      <p className="font-semibold">Ad Length</p>
                                      <p>{ad.adLengthSeconds ? `${ad.adLengthSeconds}s` : 'N/A'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Info size={16} className="text-gray-500" />
                                    <div className="flex flex-col">
                                      <p className="font-semibold">Plan Name</p>
                                      <p>{ad.planId?.name || 'N/A'}</p>
                                    </div>
                                  </div>
                                </div>
                            </div>
                          </div>
                        </div>
                        {/* Column 2 */}
                        <div className="flex flex-col space-y-4">
                          {/* Ad ID */}
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-500">Ad ID:</span>
                            <p className="text-sm text-gray-800">{ad.id}</p>
                          </div>
                          {/* Description */}
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-500">Description:</span>
                            <p className="text-gray-600">
                              {ad.description || "No description provided."}
                            </p>
                          </div>
                          {/* Payment Status section */}
                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-2 text-gray-700">Payment Status</h4>
                            <div className="flex flex-col space-y-2 text-sm text-gray-700">
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
    </div>
  );
};

export default UserAdsPage;