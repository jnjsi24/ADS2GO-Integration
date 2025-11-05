import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ALL_FAQS } from '../../graphql/faq/queries/GetAllFAQs';
import { CREATE_FAQ, UPDATE_FAQ, DELETE_FAQ, RESTORE_FAQ, REORDER_FAQS } from '../../graphql/faq/mutations/FAQMutations';
import { UPDATE_CATEGORY_ORDER } from '../../graphql/admin/mutations/updateCategoryOrder';
import { 
  Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, AlertCircle, HelpCircle, ChevronDown, ChevronUp, CalendarPlus, CalendarArrowUp, Archive, RotateCcw
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminLoader } from "../../components/ProtectedRoute";
import ConfirmationModal from "../../components/ConfirmationModal";

type FAQCategory = 'ADVERTISERS' | 'DRIVERS' | 'EVERYONE';
type FAQStatus = 'all' | 'active' | 'inactive';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  scheduledDeletionDate?: string | null;
}

interface FAQCategoryOrder {
  category: FAQCategory;
  order: number;
}

interface CreateFAQFormData {
  question: string;
  answer: string;
  category: FAQCategory;
  order: number;
  isActive: boolean;
}

const FAQManagement: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<FAQStatus>('all');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<FAQCategory | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCreateCategoryDropdown, setShowCreateCategoryDropdown] = useState(false); // New state for Create modal
  const [showEditCategoryDropdown, setShowEditCategoryDropdown] = useState(false); // New state for Edit modal
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortBy, setSortBy] = useState('Newest First');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Refs for dropdown click-outside handling
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const createCategoryDropdownRef = useRef<HTMLDivElement>(null);
  const editCategoryDropdownRef = useRef<HTMLDivElement>(null);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
      if (createCategoryDropdownRef.current && !createCategoryDropdownRef.current.contains(event.target as Node)) {
        setShowCreateCategoryDropdown(false);
      }
      if (editCategoryDropdownRef.current && !editCategoryDropdownRef.current.contains(event.target as Node)) {
        setShowEditCategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Processing states for double-click prevention
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [faqToDelete, setFaqToDelete] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [faqToRestore, setFaqToRestore] = useState<string | null>(null);

  const categoryFilterOptions = ['all', 'ADVERTISERS', 'DRIVERS', 'EVERYONE'];
  const statusFilterOptions = ['all', 'active', 'inactive'];
  const sortByOptions = ['Newest First', 'Oldest First', 'Alphabetical (A-Z)', 'Alphabetical (Z-A)'];

  const [createFormData, setCreateFormData] = useState<CreateFAQFormData>({
    question: '',
    answer: '',
    category: 'EVERYONE',
    order: 0,
    isActive: true
  });

  const [editFormData, setEditFormData] = useState<CreateFAQFormData>({
    question: '',
    answer: '',
    category: 'EVERYONE',
    order: 0,
    isActive: true
  });

  // GraphQL queries and mutations
  const { data, loading, error, refetch } = useQuery(GET_ALL_FAQS, {
    variables: {
      filters: {
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        ...(selectedStatus !== 'all' && { isActive: selectedStatus === 'active' })
      }
    }
  });

  const [createFAQ] = useMutation(CREATE_FAQ);
  const [updateFAQ] = useMutation(UPDATE_FAQ);
  const [deleteFAQ] = useMutation(DELETE_FAQ);
  const [restoreFAQ] = useMutation(RESTORE_FAQ);
  const [reorderFAQs] = useMutation(REORDER_FAQS);
  const [updateCategoryOrder] = useMutation(UPDATE_CATEGORY_ORDER);

  const faqs = data?.getAllFAQs?.faqs || [];
  const categoryOrders = data?.getAllFAQs?.categoryOrders || [];

  // Filter FAQs based on selected filters
  const filteredFAQs = faqs.filter((faq: FAQ) => {
    // Filter by archive status based on active tab
    const isArchivedMatch = activeTab === 'archived' ? faq.isArchived === true : faq.isArchived !== true;
    if (!isArchivedMatch) return false;
    
    const categoryMatch = selectedCategory === 'all' || faq.category === selectedCategory;
    const statusMatch = selectedStatus === 'all' || 
      (selectedStatus === 'active' && faq.isActive) || 
      (selectedStatus === 'inactive' && !faq.isActive);
    return categoryMatch && statusMatch;
  });

  // Group FAQs by category and sort categories by order
  const availableCategories = Array.from(new Set(filteredFAQs.map((faq: FAQ) => faq.category)));
  const defaultCategoryOrders = availableCategories.map((category, index) => ({
    category,
    order: index + 1
  }));
  
  const effectiveCategoryOrders = categoryOrders.length > 0 ? categoryOrders : defaultCategoryOrders;
  
  const groupedFAQs = [...effectiveCategoryOrders]
    .sort((a: FAQCategoryOrder, b: FAQCategoryOrder) => a.order - b.order)
    .map((categoryOrder: FAQCategoryOrder) => ({
      category: categoryOrder.category,
      order: categoryOrder.order,
      faqs: [...filteredFAQs]
        .filter((faq: FAQ) => faq.category === categoryOrder.category)
        .sort((a: FAQ, b: FAQ) => {
          // Apply custom sorting
          switch (sortBy) {
            case 'Newest First':
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case 'Oldest First':
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case 'Alphabetical (A-Z)':
              return a.question.localeCompare(b.question);
            case 'Alphabetical (Z-A)':
              return b.question.localeCompare(a.question);
            default:
              return a.order - b.order;
          }
        })
    }))
    .filter((group: any) => group.faqs.length > 0);

  const handleCreateFAQ = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple clicks
    if (isCreating) {
      return;
    }
    
    setIsCreating(true);
    
    try {
      const categoryFAQs = faqs.filter((faq: FAQ) => faq.category === createFormData.category);
      const maxOrder = categoryFAQs.length > 0 ? Math.max(...categoryFAQs.map((faq: FAQ) => faq.order)) : 0;
      const nextOrder = maxOrder + 1;

      await createFAQ({
        variables: {
          input: {
            ...createFormData,
            order: nextOrder
          }
        }
      });
      setIsCreateModalOpen(false);
      setCreateFormData({
        question: '',
        answer: '',
        category: 'EVERYONE',
        order: 0,
        isActive: true
      });
      refetch();
    } catch (error) {
      console.error('Error creating FAQ:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditFAQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFAQ) return;
    
    // Prevent multiple clicks
    if (isUpdating) {
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const { order, ...updateInput } = editFormData;
      await updateFAQ({
        variables: {
          id: editingFAQ.id,
          input: updateInput
        }
      });
      setIsEditModalOpen(false);
      setEditingFAQ(null);
      refetch();
    } catch (error) {
      console.error('Error updating FAQ:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    // Prevent multiple clicks
    if (isDeleting) {
      return;
    }
    
    setFaqToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!faqToDelete) return;

    setIsDeleting(true);
    
    try {
      await deleteFAQ({
        variables: { id: faqToDelete }
      });
      refetch();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setFaqToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setFaqToDelete(null);
  };

  const handleRestoreFAQ = async (id: string) => {
    if (isRestoring) return;
    setFaqToRestore(id);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!faqToRestore) return;
    setIsRestoring(true);
    try {
      await restoreFAQ({ variables: { id: faqToRestore } });
      refetch();
    } catch (error) {
      console.error('Error restoring FAQ:', error);
    } finally {
      setIsRestoring(false);
      setShowRestoreModal(false);
      setFaqToRestore(null);
    }
  };

  const cancelRestore = () => {
    setShowRestoreModal(false);
    setFaqToRestore(null);
  };

  const handleToggleStatus = async (faq: FAQ) => {
    // Prevent multiple clicks on the same FAQ
    if (togglingId === faq.id) {
      return;
    }
    
    setTogglingId(faq.id);
    
    try {
      await updateFAQ({
        variables: {
          id: faq.id,
          input: {
            isActive: !faq.isActive
          }
        }
      });
      refetch();
    } catch (error) {
      console.error('Error toggling FAQ status:', error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleEditClick = (faq: FAQ) => {
    setEditingFAQ(faq);
    setEditFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order: faq.order,
      isActive: faq.isActive
    });
    setIsEditModalOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, faqId: string) => {
    setDraggedItem(faqId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetFaqId: string) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const draggedFaq = faqs.find((faq: FAQ) => faq.id === draggedItem);
    const targetFaq = faqs.find((faq: FAQ) => faq.id === targetFaqId);
    
    if (draggedFaq && targetFaq && draggedFaq.category === targetFaq.category) {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFaqId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetFaqId) return;

    const draggedFaq = faqs.find((faq: FAQ) => faq.id === draggedItem);
    const targetFaq = faqs.find((faq: FAQ) => faq.id === targetFaqId);

    if (!draggedFaq || !targetFaq) return;

    if (draggedFaq.category !== targetFaq.category) {
      setDraggedItem(null);
      return;
    }

    const categoryFAQs = faqs.filter((faq: FAQ) => faq.category === draggedFaq.category);
    const draggedIndex = categoryFAQs.findIndex((faq: FAQ) => faq.id === draggedItem);
    const targetIndex = categoryFAQs.findIndex((faq: FAQ) => faq.id === targetFaqId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...categoryFAQs];
    const [draggedFaqItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedFaqItem);

    const reorderedIds = newOrder.map((faq: FAQ) => faq.id);

    try {
      await reorderFAQs({
        variables: { faqIds: reorderedIds }
      });
      refetch();
    } catch (error) {
      console.error('Error reordering FAQs:', error);
    }

    setDraggedItem(null);
  };

  const handleCategoryDragStart = (e: React.DragEvent, category: FAQCategory) => {
    setDraggedCategory(category);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryDragOver = (e: React.DragEvent, targetCategory: FAQCategory) => {
    e.preventDefault();
    
    if (!draggedCategory || draggedCategory === targetCategory) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCategoryDrop = async (e: React.DragEvent, targetCategory: FAQCategory) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === targetCategory) return;

    const currentOrders = [...effectiveCategoryOrders];
    const draggedIndex = currentOrders.findIndex((order: FAQCategoryOrder) => order.category === draggedCategory);
    const targetIndex = currentOrders.findIndex((order: FAQCategoryOrder) => order.category === targetCategory);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newOrders = [...currentOrders];
    [newOrders[draggedIndex], newOrders[targetIndex]] = [newOrders[targetIndex], newOrders[draggedIndex]];
    
    const reorderedCategories = newOrders.map((order: FAQCategoryOrder, index: number) => ({
      ...order,
      order: index + 1
    }));

    const cleanOrders = reorderedCategories.map((order: any) => {
      const { __typename, ...cleanOrder } = order;
      return cleanOrder;
    });

    try {
      await updateCategoryOrder({
        variables: { categoryOrders: cleanOrders }
      });
      refetch();
    } catch (error) {
      console.error('Error updating category order:', error);
    }

    setDraggedCategory(null);
  };

  const handleCategoryDragEnd = () => {
    setDraggedCategory(null);
  };

  const handleCategoryFilterChange = (category: FAQCategory | 'all') => {
    setSelectedCategory(category);
    setShowCategoryDropdown(false);
  };

  const handleStatusFilterChange = (status: FAQStatus) => {
    setSelectedStatus(status);
    setShowStatusDropdown(false);
  };

  const getCategoryLabel = (category: FAQCategory | 'all') => {
    switch (category) {
      case 'ADVERTISERS': return 'Advertisers';
      case 'DRIVERS': return 'Drivers';
      case 'EVERYONE': return 'Everyone';
      case 'all': return 'All Categories';
      default: return category;
    }
  };

  const getCategoryColor = (category: FAQCategory) => {
    switch (category) {
      case 'ADVERTISERS': return 'bg-blue-100 text-blue-800';
      case 'DRIVERS': return 'bg-orange-100 text-orange-800';
      case 'EVERYONE': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      let date: Date;
      
      if (!dateString) {
        return 'No Date';
      }
      
      if (typeof dateString === 'string') {
        date = new Date(dateString);
        
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

  if (error) {
    return (
      <div className={`min-h-screen bg-gray-100 ${isMobile ? 'ml-0 pt-16' : 'ml-0 md:ml-16 lg:ml-60'} md:pr-5 p-4 md:p-6 flex items-center justify-center`}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Error loading FAQs: {error.message}</p>
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
    <div className={`min-h-screen bg-gray-100 ${isMobile ? 'ml-0 pt-16' : 'ml-0 md:ml-16 lg:ml-60'} md:pr-5 p-4 md:p-6 flex flex-col transition-all duration-300`}>
      <div className="max-w-8xl mx-auto w-full">
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex items-center mb-4">
            <h1 className="text-xl font-bold text-gray-800">FAQ Management</h1>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className={`flex ${isMobile ? 'flex-col' : 'flex-row items-center justify-between pt-4'} mb-4 gap-4`}>
            {!isMobile && (
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">FAQ Management</h1>
                </div>
              </div>
            )}
            <div className={`flex ${isMobile ? 'flex-row gap-2 w-full min-w-0' : 'flex-wrap items-center gap-3 sm:gap-1'}`}>
              <div className={`relative ${isMobile ? 'flex-1 min-w-0' : 'w-40'}`} ref={categoryDropdownRef}>
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2 min-w-0"
                >
                  <span className="truncate min-w-0">{getCategoryLabel(selectedCategory)}</span>
                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 transform transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : 'rotate-0'}`}
                  />
                </button>
                <AnimatePresence>
                  {showCategoryDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                    >
                      {categoryFilterOptions.map((category) => (
                        <button
                          key={category}
                          onClick={() => handleCategoryFilterChange(category as FAQCategory | 'all')}
                          className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {getCategoryLabel(category as FAQCategory | 'all')}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className={`relative ${isMobile ? 'flex-1 min-w-0' : 'w-32'}`} ref={statusDropdownRef}>
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2 min-w-0"
                >
                  <span className="truncate min-w-0">{selectedStatus === 'all' ? 'All Status' : selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}</span>
                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 transform transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : 'rotate-0'}`}
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
                          onClick={() => handleStatusFilterChange(status as FAQStatus)}
                          className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className={`relative ${isMobile ? 'flex-1 min-w-0' : 'w-36'}`} ref={sortDropdownRef}>
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2 min-w-0"
                >
                  <span className="truncate min-w-0">{sortBy}</span>
                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 transform transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : 'rotate-0'}`}
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
                          className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pt-2">
            {/* Archive Tabs - Left Side */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('active')}
                className={`relative flex items-center py-2 px-4 font-medium text-sm transition-colors group ${
                  activeTab === 'active' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active FAQs
                <span
                  className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300 ${
                    activeTab === 'active' ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </button>
              <button
                onClick={() => setActiveTab('archived')}
                className={`relative flex items-center py-2 px-4 font-medium text-sm transition-colors group ${
                  activeTab === 'archived' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Archived
                <span
                  className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300 ${
                    activeTab === 'archived' ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </button>
            </div>

            {/* Add Button - Right Side */}
            <div className={`flex ${isMobile ? 'justify-end' : ''}`}>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex text-sm items-center gap-2 px-4 py-3 w-32 bg-[#3674B5] text-white rounded-md hover:bg-[#578FCA] transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add FAQ
              </button>
            </div>
          </div>
        </div>

        {/* FAQs List */}
        <div className="bg-gray-100 rounded-lg shadow-sm">
          {loading ? (
            <AdminLoader />
          ) : error ? (
            <div className="text-center py-10 text-red-500">
              Error: {error}
            </div>
          ) : filteredFAQs.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No FAQs found</p>
              <p className="text-sm text-gray-400 mt-2">
                Create your first FAQ to get started
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedFAQs.map((group: any) => (
                <div key={group.category} className="rounded-lg">
                  <div
                    draggable
                    onDragStart={(e) => handleCategoryDragStart(e, group.category)}
                    onDragOver={(e) => handleCategoryDragOver(e, group.category)}
                    onDrop={(e) => handleCategoryDrop(e, group.category)}
                    onDragEnd={handleCategoryDragEnd}
                    className={`px-6 py-4 border-b cursor-move hover:bg-gray-100 transition-colors ${
                      draggedCategory === group.category ? 'opacity-50' : ''
                    } ${
                      draggedCategory && draggedCategory !== group.category ? 'border-blue-300 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-5 h-5 text-gray-400" />
                        <span className={`py-1 text-lg font-bold ${(group.category)}`}>
                          {getCategoryLabel(group.category)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {group.faqs.length} FAQ{group.faqs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        Drag to reorder categories
                      </div>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-gray-200">
                    {group.faqs.map((faq: FAQ) => (
                      <div
                        key={faq.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, faq.id)}
                        onDragOver={(e) => handleDragOver(e, faq.id)}
                        onDrop={(e) => handleDrop(e, faq.id)}
                        className={`p-6 bg-white hover:bg-gray-50 transition-colors ${
                          draggedItem === faq.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(faq.category)}`}>
                                {getCategoryLabel(faq.category)}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  faq.isActive 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {faq.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">{faq.question}</h3>
                          </div>
                          <div className="flex items-center gap-2 sm:ml-4 flex-wrap">
                            <button
                              onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {expandedFAQ === faq.id ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>
                            {/* Toggle Status Button */}
                            <button
                              onClick={() => handleToggleStatus(faq)}
                              disabled={togglingId === faq.id}
                              className={`group flex items-center rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-20 transition-[width] duration-300 ${
                                togglingId === faq.id
                                  ? "bg-gray-300 cursor-not-allowed"
                                  : faq.isActive
                                  ? "bg-green-200 text-green-700 hover:bg-green-200"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-200"
                              }`}
                              title={togglingId === faq.id ? "Processing..." : faq.isActive ? "Click to deactivate" : "Click to activate"}
                            >
                              {togglingId === faq.id ? (
                                <div className="w-4 h-4 animate-spin border-2 border-gray-600 border-t-transparent rounded-full mx-auto" />
                              ) : faq.isActive ? (
                                <Eye className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                              ) : (
                                <EyeOff className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                              )}
                              {togglingId !== faq.id && (
                                <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-sm transition-all duration-300">
                                  {faq.isActive ? "Active" : "Inactive"}
                                </span>
                              )}
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleEditClick(faq)}
                              className="group flex items-center text-gray-700 rounded-md overflow-hidden h-6 w-7 hover:w-16 transition-[width] duration-300"
                              title="Edit FAQ"
                            >
                              <Pencil className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                              <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-sm transition-all duration-300">
                                Edit
                              </span>
                            </button>

                            {/* Delete / Restore Button */}
                            {faq.isArchived ? (
                              <button
                                onClick={() => handleRestoreFAQ(faq.id)}
                                disabled={isRestoring}
                                className={`group flex items-center rounded-md overflow-hidden h-6 w-7 hover:w-22 transition-[width] duration-300 ${
                                  isRestoring
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-green-700'
                                }`}
                                title={isRestoring ? "Processing..." : "Restore FAQ"}
                              >
                                {isRestoring ? (
                                  <div className="w-4 h-4 animate-spin border-2 border-green-600 border-t-transparent rounded-full mx-auto" />
                                ) : (
                                  <>
                                    <RotateCcw className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                                    <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-sm transition-all duration-300">
                                      Restore
                                    </span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDeleteFAQ(faq.id)}
                                disabled={isDeleting}
                                className={`group flex items-center rounded-md overflow-hidden h-6 w-7 hover:w-20 transition-[width] duration-300 ${
                                  isDeleting
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-red-700'
                                }`}
                                title={isDeleting ? "Processing..." : "Delete FAQ"}
                              >
                                {isDeleting ? (
                                  <div className="w-4 h-4 animate-spin border-2 border-red-600 border-t-transparent rounded-full mx-auto" />
                                ) : (
                                  <>
                                    <Trash2 className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                                    <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-sm transition-all duration-300">
                                      Delete
                                    </span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {expandedFAQ === faq.id && (
                          <div className="mt-4 pt-4">
                            <div className="prose max-w-none">
                              <p className="text-gray-700 whitespace-pre-wrap">{faq.answer}</p>
                            </div>
                            <div className="mt-4 pt-4">
                            <div className="flex items-center justify-end gap-4 text-sm text-gray-500">
                              {/* Created */}
                              <span className="flex items-center gap-1">
                                <CalendarPlus size={16} className="text-green-500" />
                                <p className="text-green-500">Created:</p>
                                <p className="font-semibold">{formatDate(faq.createdAt)}</p>
                              </span>

                              {/* Updated (only show if different) */}
                              {faq.createdAt !== faq.updatedAt && (
                                <span className="flex items-center gap-1">
                                  <CalendarArrowUp size={16} className="text-yellow-500" />
                                  <p className="text-yellow-600">Updated:</p>
                                  <p className="font-semibold">{formatDate(faq.updatedAt)}</p>
                                </span>
                              )}
                            </div>

                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create FAQ Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className={`bg-white rounded-lg ${isMobile ? 'p-4 w-full mx-4' : 'p-6 w-full'} max-w-xl max-h-[90vh] overflow-y-auto`}>
              <h2 className="text-2xl font-bold mb-4">Create New FAQ</h2>
              <form onSubmit={handleCreateFAQ} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black/80 mb-2">Question </label>
                  <input
                    type="text"
                    value={createFormData.question}
                    onChange={(e) => setCreateFormData({ ...createFormData, question: e.target.value })}
                    className="w-full px-3 py-2 bg-white shadow-md border border-gray-100 rounded-lg focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black/80 mb-2">Answer</label>
                  <textarea
                    value={createFormData.answer}
                    onChange={(e) => setCreateFormData({ ...createFormData, answer: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 bg-white h-20 shadow-md border border-gray-100 rounded-lg focus:outline-none"
                    required
                  />
                </div>
                <div className="relative" ref={createCategoryDropdownRef}>
                  <label className="block text-sm font-bold text-black/80 mb-2">Category</label>
                  <button
                    type="button"
                    onClick={() => setShowCreateCategoryDropdown(!showCreateCategoryDropdown)}
                    className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-3 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                    >
                    {createFormData.category.charAt(0).toUpperCase() + createFormData.category.slice(1).toLowerCase()}
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${showCreateCategoryDropdown ? "rotate-180" : "rotate-0"}`}
                    />
                  </button>

                  <AnimatePresence>
                    {showCreateCategoryDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                      >
                        {["EVERYONE", "ADVERTISERS", "DRIVERS"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setCreateFormData({ ...createFormData, category: cat as FAQCategory });
                              setShowCreateCategoryDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                          >
                            {cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={createFormData.isActive}
                    onChange={(e) => setCreateFormData({ ...createFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-[#3674B5] bg-gray-100 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">
                    Active (FAQ will be visible to users)
                  </label>
                </div>
                <div className="flex justify-between gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isCreating}
                    className="px-4 py-2 text-gray-700 rounded-lg border hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 ${
                      isCreating
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-[#3674B5] hover:bg-[#578FCA]'
                    }`}
                    >
                    {isCreating && (
                      <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                    )}
                    {isCreating ? 'Creating...' : 'Create FAQ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit FAQ Modal */}
        {isEditModalOpen && editingFAQ && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className={`bg-white rounded-lg ${isMobile ? 'p-4 w-full mx-4' : 'p-6 w-full'} max-w-2xl max-h-[90vh] overflow-y-auto`}>
              <h2 className="text-2xl font-bold mb-4">Edit FAQ</h2>
              <form onSubmit={handleEditFAQ} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Question *</label>
                  <input
                    type="text"
                    value={editFormData.question}
                    onChange={(e) => setEditFormData({ ...editFormData, question: e.target.value })}
                    className="w-full px-3 py-2 bg-white shadow-md border border-gray-100 rounded-lg focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Answer *</label>
                  <textarea
                    value={editFormData.answer}
                    onChange={(e) => setEditFormData({ ...editFormData, answer: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 bg-white shadow-md border border-gray-100 rounded-lg focus:outline-none"
                    required
                  />
                </div>
                <div className="relative" ref={editCategoryDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <button
                    type="button"
                    onClick={() => setShowEditCategoryDropdown(!showEditCategoryDropdown)}
                    className="flex items-center justify-between w-full text-sm text-gray-800 rounded-lg px-4 py-2 border border-gray-300 shadow-sm focus:outline-none bg-white"
                  >
                    {editFormData.category.charAt(0).toUpperCase() + editFormData.category.slice(1).toLowerCase()}
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${showEditCategoryDropdown ? "rotate-180" : "rotate-0"}`}
                    />
                  </button>

                  <AnimatePresence>
                    {showEditCategoryDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                      >
                        {["EVERYONE", "ADVERTISERS", "DRIVERS"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setEditFormData({ ...editFormData, category: cat as FAQCategory });
                              setShowEditCategoryDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                          >
                            {cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editIsActive"
                    checked={editFormData.isActive}
                    onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-[#3674B5] bg-gray-100 border-gray-300 rounded focus:ring-[#3674B5] focus:ring-2"
                  />
                  <label htmlFor="editIsActive" className="text-sm text-gray-700">
                    Active (FAQ will be visible to users)
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    disabled={isUpdating}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 ${
                      isUpdating
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-[#3674B5] hover:bg-[#578FCA]'
                    }`}
                  >
                    {isUpdating && (
                      <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                    )}
                    {isUpdating ? 'Updating...' : 'Update FAQ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          title="Delete FAQ"
          message="Are you sure you want to delete this FAQ? It will be archived and permanently deleted after 30 days."
          confirmText="Delete"
          cancelText="Cancel"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          isProcessing={isDeleting}
        />

        {/* Restore Confirmation Modal */}
        <ConfirmationModal
          isOpen={showRestoreModal}
          onClose={cancelRestore}
          onConfirm={confirmRestore}
          title="Restore FAQ"
          message="Are you sure you want to restore this FAQ?"
          confirmText="Restore"
          cancelText="Cancel"
          confirmButtonClass="bg-green-600 hover:bg-green-700"
          isProcessing={isRestoring}
        />

      </div>
    </div>
  );
};

export default FAQManagement;