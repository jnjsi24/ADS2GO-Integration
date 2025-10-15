import { gql } from '@apollo/client';

export const GET_ALL_DRIVER_SALARY_PRICING = gql`
  query GetAllDriverSalaryPricing {
    getAllDriverSalaryPricing {
      success
      message
      pricingList {
        id
        vehicleType
        category
        materialType
        distanceRate
        hoursRate
        isActive
        createdBy {
          id
          firstName
          lastName
          email
        }
        updatedBy {
          id
          firstName
          lastName
          email
        }
        notes
        displayName
        createdAt
        updatedAt
      }
      totalCount
    }
  }
`;

export const GET_DRIVER_SALARY_PRICING_BY_ID = gql`
  query GetDriverSalaryPricingById($id: ID!) {
    getDriverSalaryPricingById(id: $id) {
      id
      vehicleType
      category
      materialType
      distanceRate
      hoursRate
      isActive
      createdBy {
        id
        firstName
        lastName
        email
      }
      updatedBy {
        id
        firstName
        lastName
        email
      }
      notes
      displayName
      createdAt
      updatedAt
    }
  }
`;

export const GET_DRIVER_SALARY_PRICING_BY_CONFIG = gql`
  query GetDriverSalaryPricingByConfig($vehicleType: VehicleType!, $category: MaterialCategory!, $materialType: MaterialTypeEnum!) {
    getDriverSalaryPricingByConfig(vehicleType: $vehicleType, category: $category, materialType: $materialType) {
      id
      vehicleType
      category
      materialType
      distanceRate
      hoursRate
      isActive
      createdBy {
        id
        firstName
        lastName
        email
      }
      updatedBy {
        id
        firstName
        lastName
        email
      }
      notes
      displayName
      createdAt
      updatedAt
    }
  }
`;

export const GET_ALL_DRIVER_SALARY_CALCULATIONS = gql`
  query GetAllDriverSalaryCalculations($filter: DriverSalaryCalculationFilter) {
    getAllDriverSalaryCalculations(filter: $filter) {
      success
      message
      calculations {
        id
        driverId
        driverName
        driver {
          id
          driverId
          firstName
          lastName
          email
          vehicleType
        }
        materialId
        material {
          id
          materialId
          materialType
          category
          vehicleType
        }
        deviceId
        calculationPeriod {
          startDate
          endDate
          periodType
        }
        rawData {
          totalDistance
          totalHours
          daysWorked
        }
        pricingConfig {
          vehicleType
          category
          materialType
          distanceRate
          hoursRate
        }
        calculations {
          distanceComputation
          hoursComputation
          totalSalary
        }
        status
        approvedBy {
          id
          firstName
          lastName
          email
        }
        approvedAt
        paidAt
        paymentReference
        notes
        disputeReason
        periodDisplay
        isActive
        createdAt
        updatedAt
      }
      totalCount
    }
  }
`;

export const GET_DRIVER_SALARY_CALCULATION_BY_ID = gql`
  query GetDriverSalaryCalculationById($id: ID!) {
    getDriverSalaryCalculationById(id: $id) {
      id
      driverId
      driver {
        id
        driverId
        firstName
        lastName
        email
        vehicleType
      }
      materialId
      material {
        id
        materialId
        materialType
        category
        vehicleType
      }
      calculationPeriod {
        startDate
        endDate
        periodType
      }
      rawData {
        totalDistance
        totalHours
        daysWorked
      }
      pricingConfig {
        vehicleType
        category
        materialType
        distanceRate
        hoursRate
      }
      calculations {
        distanceComputation
        hoursComputation
        totalSalary
      }
      status
      approvedBy {
        id
        firstName
        lastName
        email
      }
      approvedAt
      paidAt
      paymentReference
      notes
      disputeReason
      periodDisplay
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const GET_DRIVER_SALARY_CALCULATIONS_BY_DRIVER = gql`
  query GetDriverSalaryCalculationsByDriver($driverId: String!) {
    getDriverSalaryCalculationsByDriver(driverId: $driverId) {
      success
      message
      calculations {
        id
        driverId
        driverName
        driver {
          id
          driverId
          firstName
          lastName
          email
          vehicleType
        }
        materialId
        material {
          id
          materialId
          materialType
          category
          vehicleType
        }
        deviceId
        calculationPeriod {
          startDate
          endDate
          periodType
        }
        rawData {
          totalDistance
          totalHours
          daysWorked
        }
        pricingConfig {
          vehicleType
          category
          materialType
          distanceRate
          hoursRate
        }
        calculations {
          distanceComputation
          hoursComputation
          totalSalary
        }
        status
        approvedBy {
          id
          firstName
          lastName
          email
        }
        approvedAt
        paidAt
        paymentReference
        notes
        disputeReason
        periodDisplay
        isActive
        createdAt
        updatedAt
      }
      totalCount
    }
  }
`;

export const GET_DRIVER_SALARY_SUMMARY = gql`
  query GetDriverSalarySummary($driverId: String!) {
    getDriverSalarySummary(driverId: $driverId) {
      success
      message
      summary {
        driverId
        driver {
          id
          driverId
          firstName
          lastName
          email
          vehicleType
        }
        totalCalculations
        totalSalary
        averageMonthlySalary
        lastCalculationDate
        currentStatus
      }
    }
  }
`;

// Driver queries (for driver mobile app)
export const GET_MY_SALARY_CALCULATIONS = gql`
  query GetMySalaryCalculations {
    getMySalaryCalculations {
      success
      message
      calculations {
        id
        driverId
        materialId
        material {
          id
          materialId
          materialType
          category
          vehicleType
        }
        calculationPeriod {
          startDate
          endDate
          periodType
        }
        rawData {
          totalDistance
          totalHours
          daysWorked
        }
        pricingConfig {
          vehicleType
          category
          materialType
          distanceRate
          hoursRate
        }
        calculations {
          distanceComputation
          hoursComputation
          totalSalary
        }
        status
        approvedAt
        paidAt
        paymentReference
        notes
        periodDisplay
        createdAt
        updatedAt
      }
      totalCount
    }
  }
`;

export const GET_MY_SALARY_SUMMARY = gql`
  query GetMySalarySummary {
    getMySalarySummary {
      success
      message
      summary {
        driverId
        driver {
          id
          driverId
          firstName
          lastName
          email
          vehicleType
        }
        totalCalculations
        totalSalary
        averageMonthlySalary
        lastCalculationDate
        currentStatus
      }
    }
  }
`;

// Type definitions
export interface DriverSalaryPricing {
  id: string;
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  category: 'DIGITAL' | 'NON_DIGITAL';
  materialType: 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS' | 'POSTER';
  distanceRate: number;
  hoursRate: number;
  isActive: boolean;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  notes?: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryCalculationPeriod {
  startDate: string;
  endDate: string;
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
}

export interface SalaryRawData {
  totalDistance: number;
  totalHours: number;
  daysWorked: number;
}

export interface SalaryPricingConfig {
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  category: 'DIGITAL' | 'NON_DIGITAL';
  materialType: 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS' | 'POSTER';
  distanceRate: number;
  hoursRate: number;
}

export interface SalaryCalculations {
  distanceComputation: number;
  hoursComputation: number;
  totalSalary: number;
}

export interface DriverSalaryCalculation {
  id: string;
  driverId: string;
  driverName: string;
  driver?: {
    id: string;
    driverId: string;
    firstName: string;
    lastName: string;
    email: string;
    vehicleType: string;
  };
  materialId: string;
  material?: {
    id: string;
    materialId: string;
    materialType: string;
    category: string;
    vehicleType: string;
  };
  deviceId: string;
  calculationPeriod: SalaryCalculationPeriod;
  rawData: SalaryRawData;
  pricingConfig: SalaryPricingConfig;
  calculations: SalaryCalculations;
  status: 'PENDING' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'DISPUTED';
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  disputeReason?: string;
  periodDisplay: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DriverSalarySummary {
  driverId: string;
  driver?: {
    id: string;
    driverId: string;
    firstName: string;
    lastName: string;
    email: string;
    vehicleType: string;
  };
  totalCalculations: number;
  totalSalary: number;
  averageMonthlySalary: number;
  lastCalculationDate?: string;
  currentStatus?: 'PENDING' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'DISPUTED';
}
