const { gql } = require('apollo-server-express');

module.exports = gql`
  type AdLengthMultipliers {
    seconds20: Float!
    seconds40: Float!
    seconds60: Float!
  }

  type DurationDiscountMultipliers {
    months1: Float!
    months2: Float!
    months3: Float!
    months4: Float!
    months5: Float!
    months6: Float!
  }

  type GlobalPricingMultipliers {
    id: ID!
    adLengthMultipliers: AdLengthMultipliers!
    durationDiscountMultipliers: DurationDiscountMultipliers!
    updatedBy: String!
    updatedAt: String!
  }

  input AdLengthMultipliersInput {
    seconds20: Float!
    seconds40: Float!
    seconds60: Float!
  }

  input DurationDiscountMultipliersInput {
    months1: Float!
    months2: Float!
    months3: Float!
    months4: Float!
    months5: Float!
    months6: Float!
  }

  input GlobalPricingMultipliersInput {
    # Note: adLengthMultipliers are hardcoded (20s=1.0x, 40s=2.0x, 60s=3.0x) and not configurable
    durationDiscountMultipliers: DurationDiscountMultipliersInput!
  }

  type Query {
    getGlobalPricingMultipliers: GlobalPricingMultipliers!
  }

  type Mutation {
    updateGlobalPricingMultipliers(input: GlobalPricingMultipliersInput!): GlobalPricingMultipliers!
  }
`;

