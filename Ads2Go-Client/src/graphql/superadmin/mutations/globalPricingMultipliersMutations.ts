import { gql } from '@apollo/client';

export const UPDATE_GLOBAL_PRICING_MULTIPLIERS = gql`
  mutation UpdateGlobalPricingMultipliers($input: GlobalPricingMultipliersInput!) {
    updateGlobalPricingMultipliers(input: $input) {
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

export interface AdLengthMultipliersInput {
  seconds20: number;
  seconds40: number;
  seconds60: number;
}

export interface DurationDiscountMultipliersInput {
  months1: number;
  months2: number;
  months3: number;
  months4: number;
  months5: number;
  months6: number;
}

export interface GlobalPricingMultipliersInput {
  // Note: adLengthMultipliers are hardcoded (20s=1.0x, 40s=2.0x, 60s=3.0x) and not configurable
  durationDiscountMultipliers: DurationDiscountMultipliersInput;
}

export interface UpdateGlobalPricingMultipliersResponse {
  updateGlobalPricingMultipliers: {
    id: string;
    adLengthMultipliers: {
      seconds20: number;
      seconds40: number;
      seconds60: number;
    };
    durationDiscountMultipliers: {
      months1: number;
      months2: number;
      months3: number;
      months4: number;
      months5: number;
      months6: number;
    };
    updatedBy: string;
    updatedAt: string;
  };
}

