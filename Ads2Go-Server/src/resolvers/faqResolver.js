const FAQ = require('../models/FAQ');
const FAQCategoryOrder = require('../models/FAQCategoryOrder');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const faqResolver = {
  Query: {
    getAllFAQs: async (_, { filters = {} }, context) => {
      try {
        // Check if user is authenticated (for public access)
        let user = null;
        try {
          user = checkAuth(context.user);
        } catch (authError) {
          // If not authenticated, show only active FAQs
          const queryFilters = { ...filters, isActive: true };
          const result = await FAQ.getFAQs(queryFilters);
          
          // Get category order for public access too
          try {
            const categoryOrders = await FAQCategoryOrder.getCategoryOrder();
            console.log('Backend: Category orders for public access:', categoryOrders);
            result.categoryOrders = categoryOrders;
          } catch (categoryError) {
            console.error('Error getting category orders:', categoryError);
            result.categoryOrders = [];
          }
          
          return result;
        }
        
        // Only show active FAQs for non-admin users
        const queryFilters = { ...filters };
        if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
          queryFilters.isActive = true;
        }

        const result = await FAQ.getFAQs(queryFilters);
        
        // Get category order for all authenticated users
        try {
          const categoryOrders = await FAQCategoryOrder.getCategoryOrder();
          console.log('Backend: Category orders for user:', categoryOrders);
          result.categoryOrders = categoryOrders;
        } catch (categoryError) {
          console.error('Error getting category orders:', categoryError);
          result.categoryOrders = [];
        }
        
        return result;
      } catch (error) {
        console.error('Error in getAllFAQs:', error);
        return {
          success: false,
          message: 'Failed to retrieve FAQs',
          faqs: [],
          totalCount: 0,
          categoryOrders: []
        };
      }
    },

    getFAQById: async (_, { id }, context) => {
      try {
        const user = checkAuth(context.user);
        
        const faq = await FAQ.findById(id);
        if (!faq) {
          return {
            success: false,
            message: 'FAQ not found',
            faq: null
          };
        }

        // Non-admin users can only see active FAQs
        if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && !faq.isActive) {
          return {
            success: false,
            message: 'FAQ not found',
            faq: null
          };
        }

        return {
          success: true,
          message: 'FAQ retrieved successfully',
          faq: faq
        };
      } catch (error) {
        console.error('Error in getFAQById:', error);
        return {
          success: false,
          message: error.message || 'Failed to retrieve FAQ',
          faq: null
        };
      }
    }
  },

  Mutation: {
    createFAQ: async (_, { input }, context) => {
      try {
        // Check admin authentication
        checkAdmin(context.user);

        const { question, answer, category, order, isActive = true } = input;

        // Validate required fields
        if (!question || !answer || !category) {
          throw new Error('Question, answer, and category are required');
        }

        // Get the next order number if not provided
        let faqOrder = order;
        if (faqOrder === undefined || faqOrder === null || faqOrder === 0) {
          const lastFAQ = await FAQ.findOne({ category }).sort({ order: -1 });
          faqOrder = lastFAQ ? lastFAQ.order + 1 : 1;
        }

        const newFAQ = new FAQ({
          question: question.trim(),
          answer: answer.trim(),
          category,
          order: faqOrder,
          isActive
        });

        await newFAQ.save();

        return {
          success: true,
          message: 'FAQ created successfully',
          faq: newFAQ
        };
      } catch (error) {
        console.error('Error in createFAQ:', error);
        return {
          success: false,
          message: error.message || 'Failed to create FAQ',
          faq: null
        };
      }
    },

    updateFAQ: async (_, { id, input }, context) => {
      try {
        // Check admin authentication
        checkAdmin(context.user);

        const faq = await FAQ.findById(id);
        if (!faq) {
          throw new Error('FAQ not found');
        }

        const updateData = {};
        if (input.question) updateData.question = input.question.trim();
        if (input.answer) updateData.answer = input.answer.trim();
        if (input.category) updateData.category = input.category;
        if (input.order !== undefined) updateData.order = input.order;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        // Handle order conflicts when category or order changes
        if (input.category || input.order !== undefined) {
          const targetCategory = input.category || faq.category;
          const targetOrder = input.order !== undefined ? input.order : faq.order;

          // If category is changing, we need to handle the move
          if (input.category && input.category !== faq.category) {
            // First, shift down FAQs in the old category that come after the current FAQ
            await FAQ.updateMany(
              {
                _id: { $ne: id },
                category: faq.category,
                order: { $gt: faq.order }
              },
              { $inc: { order: -1 } }
            );

            // Then, shift up FAQs in the new category that come at or after the target order
            await FAQ.updateMany(
              {
                _id: { $ne: id },
                category: targetCategory,
                order: { $gte: targetOrder }
              },
              { $inc: { order: 1 } }
            );
          } else if (input.order !== undefined && input.order !== faq.order) {
            // Only order is changing within the same category
            if (input.order > faq.order) {
              // Moving down: shift FAQs between old and new position up
              await FAQ.updateMany(
                {
                  _id: { $ne: id },
                  category: faq.category,
                  order: { $gt: faq.order, $lte: input.order }
                },
                { $inc: { order: -1 } }
              );
            } else {
              // Moving up: shift FAQs between new and old position down
              await FAQ.updateMany(
                {
                  _id: { $ne: id },
                  category: faq.category,
                  order: { $gte: input.order, $lt: faq.order }
                },
                { $inc: { order: 1 } }
              );
            }
          }
        }

        const updatedFAQ = await FAQ.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );

        return {
          success: true,
          message: 'FAQ updated successfully',
          faq: updatedFAQ
        };
      } catch (error) {
        console.error('Error in updateFAQ:', error);
        return {
          success: false,
          message: error.message || 'Failed to update FAQ',
          faq: null
        };
      }
    },

    deleteFAQ: async (_, { id }, context) => {
      try {
        // Check admin authentication
        checkAdmin(context.user);

        const faq = await FAQ.findById(id);
        if (!faq) {
          throw new Error('FAQ not found');
        }

        await FAQ.findByIdAndDelete(id);

        return {
          success: true,
          message: 'FAQ deleted successfully'
        };
      } catch (error) {
        console.error('Error in deleteFAQ:', error);
        return {
          success: false,
          message: error.message || 'Failed to delete FAQ'
        };
      }
    },

    reorderFAQs: async (_, { faqIds }, context) => {
      try {
        // Check admin authentication
        checkAdmin(context.user);

        if (!faqIds || faqIds.length === 0) {
          throw new Error('FAQ IDs are required for reordering');
        }

        const result = await FAQ.reorderFAQs(faqIds);
        return result;
      } catch (error) {
        console.error('Error in reorderFAQs:', error);
        return {
          success: false,
          message: error.message || 'Failed to reorder FAQs'
        };
      }
    },

    fixFAQOrders: async (_, { category }, context) => {
      try {
        // Check admin authentication
        checkAdmin(context.user);

        // Get all FAQs in the specified category, sorted by current order
        const faqs = await FAQ.find({ category }).sort({ order: 1 });
        
        // Reassign orders sequentially starting from 1
        for (let i = 0; i < faqs.length; i++) {
          await FAQ.findByIdAndUpdate(faqs[i]._id, { order: i + 1 });
        }

        return {
          success: true,
          message: `Fixed order conflicts for ${category} category`,
          fixedCount: faqs.length
        };
      } catch (error) {
        console.error('Error in fixFAQOrders:', error);
        return {
          success: false,
          message: error.message || 'Failed to fix FAQ orders',
          fixedCount: 0
        };
      }
    },

    fixAllFAQOrders: async (_, __, context) => {
      try {
        // Check admin authentication
        checkAdmin(context.user);

        const categories = ['EVERYONE', 'ADVERTISERS', 'DRIVERS'];
        let totalFixed = 0;

        for (const category of categories) {
          const faqs = await FAQ.find({ category }).sort({ order: 1 });
          
          for (let i = 0; i < faqs.length; i++) {
            const expectedOrder = i + 1;
            if (faqs[i].order !== expectedOrder) {
              await FAQ.findByIdAndUpdate(faqs[i]._id, { order: expectedOrder });
              totalFixed++;
            }
          }
        }

        return {
          success: true,
          message: `Fixed ${totalFixed} FAQ orders across all categories`,
          fixedCount: totalFixed
        };
      } catch (error) {
        console.error('Error in fixAllFAQOrders:', error);
        return {
          success: false,
          message: error.message || 'Failed to fix FAQ orders',
          fixedCount: 0
        };
      }
    },

    updateCategoryOrder: async (_, { categoryOrders }, context) => {
      try {
        // Check admin authentication
        checkAdmin(context.user);

        await FAQCategoryOrder.updateCategoryOrder(categoryOrders);
        
        return {
          success: true,
          message: 'Category order updated successfully'
        };
      } catch (error) {
        console.error('Error in updateCategoryOrder:', error);
        return {
          success: false,
          message: error.message || 'Failed to update category order'
        };
      }
    }
  }
};

module.exports = faqResolver;
