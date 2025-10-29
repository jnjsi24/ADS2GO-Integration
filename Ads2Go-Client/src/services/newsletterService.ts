import { gql } from '@apollo/client';

// GraphQL mutation for newsletter subscription
export const SUBSCRIBE_NEWSLETTER = gql`
  mutation SubscribeNewsletter($email: String!) {
    subscribeNewsletter(email: $email) {
      success
      message
    }
  }
`;

// Newsletter service class
export class NewsletterService {
  /**
   * Subscribe to newsletter
   */
  static async subscribeToNewsletter(email: string, source: string = 'landing_page'): Promise<{ success: boolean; message: string }> {
    try {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          success: false,
          message: 'Please enter a valid email address'
        };
      }

      // For now, we'll use a simple fetch to the backend
      // In a real implementation, you'd use Apollo Client with the mutation above
      const apiUrl = process.env.REACT_APP_API_URL;
      
      if (!apiUrl) {
        console.error('❌ Missing REACT_APP_API_URL environment variable');
        throw new Error('REACT_APP_API_URL is required in .env file');
      }
      const response = await fetch(`${apiUrl}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, source }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to subscribe to newsletter');
      }

      return data;
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to subscribe to newsletter'
      };
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if email is already subscribed (optional feature)
   */
  static async checkSubscriptionStatus(email: string): Promise<boolean> {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      
      if (!apiUrl) {
        console.error('❌ Missing REACT_APP_API_URL environment variable');
        throw new Error('REACT_APP_API_URL is required in .env file');
      }
      const response = await fetch(`${apiUrl}/api/newsletter/status?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      return data.isSubscribed || false;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Send contact form message
   * Saves message to database and subscribes email to newsletter
   */
  static async sendContactMessage({ name, email, message }: { name: string; email: string; message: string }): Promise<{ success: boolean; message: string }> {
    try {
      // Validate inputs
      if (!name || !email || !message) {
        return {
          success: false,
          message: 'Please fill out all fields'
        };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          success: false,
          message: 'Please enter a valid email address'
        };
      }

      const apiUrl = process.env.REACT_APP_API_URL;
      
      if (!apiUrl) {
        console.error('❌ Missing REACT_APP_API_URL environment variable');
        throw new Error('REACT_APP_API_URL is required in .env file');
      }

      // Strip /graphql if present since this is for REST API calls
      const baseUrl = apiUrl.replace('/graphql', '').replace(/\/$/, '');
      
      const response = await fetch(`${baseUrl}/api/contact/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send message');
      }

      return data;
    } catch (error) {
      console.error('Contact message error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send message'
      };
    }
  }
}
