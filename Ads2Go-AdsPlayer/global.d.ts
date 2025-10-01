// This file helps TypeScript understand our custom module paths
// and provides type definitions for modules that don't have them

declare module '@/components/*' {
  import { ReactNode } from 'react';
  const component: ReactNode;
  export default component;
}

declare module '@/contexts/*' {
  import { ReactNode } from 'react';
  const context: ReactNode;
  export default context;
}

declare module '@/hooks/*' {
  import { ReactNode } from 'react';
  const hook: ReactNode;
  export default hook;
}

declare module '@/assets/*' {
  const value: any;
  export default value;
}
