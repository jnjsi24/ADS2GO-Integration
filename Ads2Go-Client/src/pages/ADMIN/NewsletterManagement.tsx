import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

interface Subscriber {
  _id: string;
  email: string;
  subscribedAt: string;
  isActive: boolean;
  source: string;
  emailCount: number;
  lastEmailSent?: string;
}

const NewsletterManagement: React.FC = () => {
  const { admin } = useAdminAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    userSubscribers: 0,
    nonUserSubscribers: 0
  });

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://192.168.100.22:5000').replace(/\/$/, '');
      const apiUrl = `${baseUrl}/api/newsletter/subscribers?t=${Date.now()}`;
      
      console.log('Fetching subscribers from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.success) {
        setSubscribers(data.subscribers || []);
        
        const subscribers = data.subscribers || [];
        const activeCount = subscribers.filter((sub: Subscriber) => sub.isActive).length;
        const inactiveCount = subscribers.filter((sub: Subscriber) => !sub.isActive).length;
        
        // Categorize by source
        const userSubscribers = subscribers.filter((sub: Subscriber) => 
          sub.isActive && (sub.source === 'registration' || sub.source === 'existing_user_migration')
        ).length;
        const nonUserSubscribers = subscribers.filter((sub: Subscriber) => 
          sub.isActive && !['registration', 'existing_user_migration'].includes(sub.source)
        ).length;
        
        setStats({
          total: subscribers.length,
          active: activeCount,
          inactive: inactiveCount,
          userSubscribers,
          nonUserSubscribers
        });
      } else {
        setError(`Failed to fetch subscribers: ${data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(`Failed to fetch subscribers: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setLoading(false);
    }
  };

  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);
  const [emailToUnsubscribe, setEmailToUnsubscribe] = useState('');

  const handleUnsubscribe = async (email: string) => {
    setEmailToUnsubscribe(email);
    setShowUnsubscribeModal(true);
  };

  const confirmUnsubscribe = async () => {
    try {
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://192.168.100.22:5000').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/newsletter/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToUnsubscribe }),
      });

      const data = await response.json();
      
      if (data.success) {
        fetchSubscribers(); // Refresh the list
        setShowUnsubscribeModal(false);
        setEmailToUnsubscribe('');
      } else {
        alert('Failed to unsubscribe: ' + data.message);
      }
    } catch (err) {
      alert('Failed to unsubscribe');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pl-64 pr-5">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#3674B5] mb-2">Newsletter Management</h1>
            <p className="text-gray-600">Manage newsletter subscribers and send updates</p>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-lg mb-2">Loading newsletter subscribers...</div>
              <div className="text-sm text-gray-500">Please check the browser console for any errors</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white pl-64 pr-5">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#3674B5] mb-2">Newsletter Management</h1>
            <p className="text-gray-600">Manage newsletter subscribers and send updates</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-red-600 font-semibold text-lg mb-2">Error Loading Newsletter Data</div>
            </div>
            <div className="text-red-700 mb-4">{error}</div>
            <div className="text-sm text-red-600 mb-4">
              <strong>Possible causes:</strong>
              <ul className="list-disc list-inside mt-2">
                <li>Server is not running on {process.env.REACT_APP_API_URL || 'REACT_APP_API_URL not set in .env'}</li>
                <li>Network connectivity issues</li>
                <li>API endpoint not accessible</li>
                <li>Database connection issues</li>
              </ul>
            </div>
            <button
              onClick={fetchSubscribers}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-white pl-64 pr-5">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#3674B5] mb-2">Newsletter Management</h1>
          <p className="text-gray-600">Manage newsletter subscribers and send updates</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">Total Subscribers</div>
                <div className="text-xs text-gray-500">All time</div>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-green-600">{stats.active}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">Active Subscribers</div>
                <div className="text-xs text-gray-500">Currently subscribed</div>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-purple-600">{stats.userSubscribers}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">User Subscribers</div>
                <div className="text-xs text-gray-500">Website users</div>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-orange-600">{stats.nonUserSubscribers}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">Non-User Subscribers</div>
                <div className="text-xs text-gray-500">Landing page only</div>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-red-600">{stats.inactive}</div>
              <div className="ml-4">
                <div className="text-sm text-gray-600">Unsubscribed</div>
                <div className="text-xs text-gray-500">No longer active</div>
              </div>
            </div>
          </div>
        </div>

        {/* Subscribers Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Subscribers List</h2>
          </div>
          
          {error && (
            <div className="px-6 py-4 bg-red-50 text-red-600">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscribed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Emails Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscribers.map((subscriber) => (
                  <tr key={subscriber._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {subscriber.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        subscriber.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {subscriber.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        subscriber.source === 'registration' || subscriber.source === 'existing_user_migration'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {subscriber.source === 'registration' ? 'USER REGISTRATION' :
                         subscriber.source === 'existing_user_migration' ? 'EXISTING USER' :
                         subscriber.source === 'landing_page' ? 'LANDING PAGE' :
                         subscriber.source === 'contact_form' ? 'CONTACT FORM' :
                         subscriber.source === 'manual' ? 'MANUAL' :
                         subscriber.source.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(subscriber.subscribedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {subscriber.emailCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {subscriber.isActive && (
                        <button
                          onClick={() => handleUnsubscribe(subscriber.email)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Unsubscribe
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {subscribers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No subscribers found
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex space-x-4">
            <button
              onClick={fetchSubscribers}
              className="bg-[#3674B5] text-white px-4 py-2 rounded-md hover:bg-[#2c5a8a] transition-colors duration-200"
            >
              Refresh List
            </button>
            <button
              onClick={() => window.open('mailto:' + subscribers.filter(s => s.isActive).map(s => s.email).join(','))}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-200"
              disabled={stats.active === 0}
            >
              Email All Active Subscribers
            </button>
          </div>
        </div>

        {/* Unsubscribe Confirmation Modal */}
        {showUnsubscribeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Unsubscribe</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to unsubscribe <strong>{emailToUnsubscribe}</strong> from the newsletter?
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={confirmUnsubscribe}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors duration-200"
                >
                  Yes, Unsubscribe
                </button>
                <button
                  onClick={() => {
                    setShowUnsubscribeModal(false);
                    setEmailToUnsubscribe('');
                  }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsletterManagement;
