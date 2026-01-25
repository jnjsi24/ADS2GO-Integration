import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config/api';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'ADVERTISERS' | 'DRIVERS' | 'EVERYONE';
  order: number;
  isActive: boolean;
}

interface FAQItemProps {
  question: string;
  answer: string;
  searchQuery?: string;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, searchQuery = '' }) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={styles.faqQuestionText}>{question}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6b7280"
        />
      </TouchableOpacity>
      {open && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{answer}</Text>
        </View>
      )}
    </View>
  );
};

const GET_ALL_FAQS = `
  query GetAllFAQs($filters: FAQFiltersInput) {
    getAllFAQs(filters: $filters) {
      success
      message
      faqs {
        id
        question
        answer
        category
        order
        isActive
      }
      totalCount
      categoryOrders {
        category
        order
      }
    }
  }
`;

export default function FAQsScreen() {
  const router = useRouter();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFAQs, setFilteredFAQs] = useState<FAQ[]>([]);

  useEffect(() => {
    loadFAQs();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFAQs(filtered);
    } else {
      setFilteredFAQs([]);
    }
  }, [searchQuery, faqs]);

  const loadFAQs = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: GET_ALL_FAQS,
          variables: {
            filters: {
              isActive: true,
            },
          },
        }),
      });

      const result = await response.json();

      if (result.data?.getAllFAQs?.success) {
        setFaqs(result.data.getAllFAQs.faqs || []);
      } else {
        console.error('Failed to load FAQs:', result.data?.getAllFAQs?.message);
      }
    } catch (error) {
      console.error('Error loading FAQs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFAQs();
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'ADVERTISERS':
        return 'For Advertisers:';
      case 'DRIVERS':
        return 'For Drivers:';
      case 'EVERYONE':
        return 'For Everyone:';
      default:
        return category;
    }
  };

  // Group FAQs by category
  const faqsByCategory = (searchQuery ? filteredFAQs : faqs).reduce(
    (acc: Record<string, FAQ[]>, faq: FAQ) => {
      if (!acc[faq.category]) {
        acc[faq.category] = [];
      }
      acc[faq.category].push(faq);
      return acc;
    },
    {}
  );

  // Sort categories: EVERYONE, DRIVERS, ADVERTISERS
  const sortedCategories = Object.keys(faqsByCategory).sort((a, b) => {
    const order = ['EVERYONE', 'DRIVERS', 'ADVERTISERS'];
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3674B5" />
        <Text style={styles.loadingText}>Loading FAQs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQs</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search FAQs..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* FAQs Content */}
        {searchQuery && filteredFAQs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="help-circle-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No FAQs found</Text>
            <Text style={styles.emptySubtext}>
              Try different keywords or check spelling
            </Text>
          </View>
        ) : sortedCategories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="help-circle-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No FAQs available</Text>
            <Text style={styles.emptySubtext}>
              Please check back later or contact support
            </Text>
          </View>
        ) : (
          <View style={styles.faqsContainer}>
            {sortedCategories.map((category) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>
                  {getCategoryTitle(category)}
                </Text>
                {faqsByCategory[category].map((faq) => (
                  <FAQItem
                    key={faq.id}
                    question={faq.question}
                    answer={faq.answer}
                    searchQuery={searchQuery}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  clearButton: {
    padding: 4,
  },
  faqsContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  faqItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 40,
  },
});
