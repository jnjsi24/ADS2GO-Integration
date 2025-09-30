import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ALL_FAQS } from '../../graphql/faq/queries/GetAllFAQs';
import { CREATE_FAQ, UPDATE_FAQ, DELETE_FAQ, REORDER_FAQS } from '../../graphql/faq/mutations/FAQMutations';
import { UPDATE_CATEGORY_ORDER } from '../../graphql/admin/mutations/updateCategoryOrder';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  GripVertical, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<FAQCategory | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const categoryFilterOptions = ['all', 'ADVERTISERS', 'DRIVERS', 'EVERYONE'];
  const statusFilterOptions = ['all', 'active', 'inactive'];

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
  const [reorderFAQs] = useMutation(REORDER_FAQS);
  const [updateCategoryOrder] = useMutation(UPDATE_CATEGORY_ORDER);

  const faqs = data?.getAllFAQs?.faqs || [];
  const categoryOrders = data?.getAllFAQs?.categoryOrders || [];

  // Filter FAQs based on selected filters
  const filteredFAQs = faqs.filter((faq: FAQ) => {
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
        .sort((a: FAQ, b: FAQ) => a.order - b.order)
    }))
    .filter((group: any) => group.faqs.length > 0);

  const handleCreateFAQ = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  const handleEditFAQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFAQ) return;
    
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
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this FAQ?')) {
      try {
        await deleteFAQ({
          variables: { id }
        });
        refetch();
      } catch (error) {
        console.error('Error deleting FAQ:', error);
      }
    }
  };

  const handleToggleStatus = async (faq: FAQ) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3674B5] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading FAQs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-[#3674B5]" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">FAQ Management</h1>
                <p className="text-gray-600">Manage frequently asked questions for users</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-40">
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  {getCategoryLabel(selectedCategory)}
                  <ChevronDown
                    size={16}
                    className={`transform transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : 'rotate-0'}`}
                  />
                </button>
                <AnimatePresence>
                  {showCategoryDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
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
              <div className="relative w-32">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  {selectedStatus === 'all' ? 'All Status' : selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
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
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add FAQ
            </button>
          </div>
        </div>

        {/* FAQs List */}
        <div className=" bg-gray-100 rounded-lg shadow-sm">
          {filteredFAQs.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No FAQs found</p>
              <p className="text-sm text-gray-400 mt-2">Create your first FAQ to get started</p>
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
                    className={` px-6 py-4 border-b cursor-move hover:bg-gray-100 transition-colors ${
                      draggedCategory === group.category ? 'opacity-50' : ''
                    } ${
                      draggedCategory && draggedCategory !== group.category ? 'border-blue-300 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-5 h-5 text-gray-400" />
                        <span className={`px-3 py-1 text-sm font-medium ${getCategoryColor(group.category)}`}>
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
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(faq.category)}`}>
                                {getCategoryLabel(faq.category)}
                              </span>
                              <div className="flex items-center gap-1">
                                {faq.isActive ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <EyeOff className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="text-xs text-gray-500">
                                  {faq.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">{faq.question}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                faq.isActive 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {faq.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <span>Order: {faq.order}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
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
                              className={`group flex items-center rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-20 transition-[width] duration-300 ${
                                faq.isActive
                                  ? "bg-green-200 text-green-700 hover:bg-green-200"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-200"
                              }`}
                              title={faq.isActive ? "Click to deactivate" : "Click to activate"}
                            >
                              {faq.isActive ? (
                                <Eye className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                              ) : (
                                <EyeOff className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                              )}
                              <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-sm transition-all duration-300">
                                {faq.isActive ? "Active" : "Inactive"}
                              </span>
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleEditClick(faq)}
                              className="group flex items-center text-blue-700 rounded-md overflow-hidden h-6 w-7 hover:w-16 transition-[width] duration-300"
                              title="Edit FAQ"
                            >
                              <Edit className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                              <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-sm transition-all duration-300">
                                Edit
                              </span>
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteFAQ(faq.id)}
                              className="group flex items-center text-red-700 rounded-md overflow-hidden d h-6 w-7 hover:w-20 transition-[width] duration-300"
                              title="Delete FAQ"
                            >
                              <Trash2 className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                              <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-sm transition-all duration-300">
                                Delete
                              </span>
                            </button>
                          </div>
                        </div>

                        {expandedFAQ === faq.id && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="prose max-w-none">
                              <p className="text-gray-700 whitespace-pre-wrap">{faq.answer}</p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span><strong>Created:</strong> {formatDate(faq.createdAt)}</span>
                                {faq.createdAt !== faq.updatedAt && (
                                  <span><strong>Updated:</strong> {formatDate(faq.updatedAt)}</span>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Create New FAQ</h2>
              <form onSubmit={handleCreateFAQ} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Question *</label>
                  <input
                    type="text"
                    value={createFormData.question}
                    onChange={(e) => setCreateFormData({ ...createFormData, question: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Answer *</label>
                  <textarea
                    value={createFormData.answer}
                    onChange={(e) => setCreateFormData({ ...createFormData, answer: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <select
                    value={createFormData.category}
                    onChange={(e) => setCreateFormData({ ...createFormData, category: e.target.value as FAQCategory })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  >
                    <option value="EVERYONE">Everyone</option>
                    <option value="ADVERTISERS">Advertisers</option>
                    <option value="DRIVERS">Drivers</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={createFormData.isActive}
                    onChange={(e) => setCreateFormData({ ...createFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-[#3674B5] bg-gray-100 border-gray-300 rounded focus:ring-[#3674B5] focus:ring-2"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">
                    Active (FAQ will be visible to users)
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA]"
                  >
                    Create FAQ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit FAQ Modal */}
        {isEditModalOpen && editingFAQ && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Edit FAQ</h2>
              <form onSubmit={handleEditFAQ} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Question *</label>
                  <input
                    type="text"
                    value={editFormData.question}
                    onChange={(e) => setEditFormData({ ...editFormData, question: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Answer *</label>
                  <textarea
                    value={editFormData.answer}
                    onChange={(e) => setEditFormData({ ...editFormData, answer: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as FAQCategory })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  >
                    <option value="EVERYONE">Everyone</option>
                    <option value="ADVERTISERS">Advertisers</option>
                    <option value="DRIVERS">Drivers</option>
                  </select>
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
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA]"
                  >
                    Update FAQ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FAQManagement;