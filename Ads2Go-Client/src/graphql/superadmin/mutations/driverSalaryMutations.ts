import { gql } from '@apollo/client';

export const CREATE_DRIVER_SALARY_PRICING = gql`
  mutation CreateDriverSalaryPricing($input: CreateDriverSalaryPricingInput!) {
    createDriverSalaryPricing(input: $input) {
      success
      message
      pricing {
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
        notes
        displayName
        createdAt
        updatedAt
      }
    }
  }
`;

export const UPDATE_DRIVER_SALARY_PRICING = gql`
  mutation UpdateDriverSalaryPricing($id: ID!, $input: UpdateDriverSalaryPricingInput!) {
    updateDriverSalaryPricing(id: $id, input: $input) {
      success
      message
      pricing {
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
  }
`;

export const DELETE_DRIVER_SALARY_PRICING = gql`
  mutation DeleteDriverSalaryPricing($id: ID!) {
    deleteDriverSalaryPricing(id: $id) {
      success
      message
      pricing {
        id
        vehicleType
        category
        materialType
        distanceRate
        hoursRate
        isActive
        displayName
      }
    }
  }
`;

export const CREATE_DRIVER_SALARY_CALCULATION = gql`
  mutation CreateDriverSalaryCalculation($input: CreateDriverSalaryCalculationInput!) {
    createDriverSalaryCalculation(input: $input) {
      success
      message
      calculation {
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
        notes
        periodDisplay
        createdAt
        updatedAt
      }
    }
  }
`;

export const UPDATE_DRIVER_SALARY_CALCULATION = gql`
  mutation UpdateDriverSalaryCalculation($id: ID!, $input: UpdateDriverSalaryCalculationInput!) {
    updateDriverSalaryCalculation(id: $id, input: $input) {
      success
      message
      calculation {
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
        createdAt
        updatedAt
      }
    }
  }
`;

export const APPROVE_DRIVER_SALARY_CALCULATION = gql`
  mutation ApproveDriverSalaryCalculation($id: ID!) {
    approveDriverSalaryCalculation(id: $id) {
      success
      message
      calculation {
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
        notes
        periodDisplay
        createdAt
        updatedAt
      }
    }
  }
`;

export const MARK_DRIVER_SALARY_AS_PAID = gql`
  mutation MarkDriverSalaryAsPaid($id: ID!, $paymentReference: String!) {
    markDriverSalaryAsPaid(id: $id, paymentReference: $paymentReference) {
      success
      message
      calculation {
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
        periodDisplay
        createdAt
        updatedAt
      }
    }
  }
`;

export const GENERATE_MONTHLY_SALARY_CALCULATIONS = gql`
  mutation GenerateMonthlySalaryCalculations($month: String!, $year: Int!) {
    generateMonthlySalaryCalculations(month: $month, year: $year) {
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
        notes
        periodDisplay
        createdAt
        updatedAt
      }
      totalCount
    }
  }
`;

export const RECALCULATE_DRIVER_SALARY = gql`
  mutation RecalculateDriverSalary($id: ID!) {
    recalculateDriverSalary(id: $id) {
      success
      message
      calculation {
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
        createdAt
        updatedAt
      }
    }
  }
`;

// Input type definitions
export interface CreateDriverSalaryPricingInput {
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  category: 'DIGITAL' | 'NON_DIGITAL';
  materialType: 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS' | 'POSTER';
  distanceRate: number;
  hoursRate: number;
  notes?: string;
}

export interface UpdateDriverSalaryPricingInput {
  distanceRate?: number;
  hoursRate?: number;
  isActive?: boolean;
  notes?: string;
}

export interface SalaryCalculationPeriodInput {
  startDate: string;
  endDate: string;
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
}

export interface SalaryRawDataInput {
  totalDistance: number;
  totalHours: number;
  daysWorked: number;
}

export interface SalaryPricingConfigInput {
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  category: 'DIGITAL' | 'NON_DIGITAL';
  materialType: 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS' | 'POSTER';
  distanceRate: number;
  hoursRate: number;
}

export interface CreateDriverSalaryCalculationInput {
  driverId: string;
  driverName: string;
  materialId: string;
  deviceId: string;
  calculationPeriod: SalaryCalculationPeriodInput;
  rawData: SalaryRawDataInput;
  pricingConfig: SalaryPricingConfigInput;
  notes?: string;
}

export interface UpdateDriverSalaryCalculationInput {
  status?: 'PENDING' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'DISPUTED';
  notes?: string;
  disputeReason?: string;
  paymentReference?: string;
}

export interface DriverSalaryCalculationFilter {
  driverId?: string;
  materialId?: string;
  status?: 'PENDING' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'DISPUTED';
  startDate?: string;
  endDate?: string;
  periodType?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
}
