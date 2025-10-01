import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  // Auth Stack
  '(auth)/login': { message?: string };
  '(auth)/register': undefined;
  '(auth)/emailVerification': {
    email: string;
    driverId: string;
    token: string;
    firstName: string;
  };
  '(auth)/verificationProgress': {
    email: string;
    verificationCode: string;
    driverId?: string;
    token?: string;
    firstName?: string;
    isPending?: boolean;
  };
  
  // Main Tabs
  '(tabs)': NavigatorScreenParams<TabParamList>;
  
  // Other screens
  '+not-found': undefined;
};

type TabParamList = {
  home: undefined;
  // Add other tab params as needed
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
