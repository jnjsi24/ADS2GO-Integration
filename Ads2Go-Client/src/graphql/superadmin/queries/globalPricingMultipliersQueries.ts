import { gql } from '@apollo/client';

export const GET_GLOBAL_PRICING_MULTIPLIERS = gql`
  query GetGlobalPricingMultipliers {
    getGlobalPricingMultipliers {
      id
      adLengthMultipliers {
        seconds20
        seconds40
        seconds60
      }
      durationDiscountMultipliers {
        months1
        months2
        months3
        months4
        months5
        months6
      }
      updatedBy
      updatedAt
    }
  }
`;

export interface AdLengthMultipliers {
  seconds20: number;
  seconds40: number;
  seconds60: number;
}

export interface DurationDiscountMultipliers {
  months1: number;
  months2: number;
  months3: number;
  months4: number;
  months5: number;
  months6: number;
}

export interface GlobalPricingMultipliers {
  id: string;
  adLengthMultipliers: AdLengthMultipliers;
  durationDiscountMultipliers: DurationDiscountMultipliers;
  updatedBy: string;
  updatedAt: string;
}

export interface GetGlobalPricingMultipliersResponse {
  getGlobalPricingMultipliers: GlobalPricingMultipliers;
}

export interface GlobalPricingMultipliersInput {
  adLengthMultipliers: AdLengthMultipliers;
  durationDiscountMultipliers: DurationDiscountMultipliers;
}

