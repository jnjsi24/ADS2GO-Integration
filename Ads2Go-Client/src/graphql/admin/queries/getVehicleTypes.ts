// src/graphql/queries/getVehicleTypes.ts
import { gql } from '@apollo/client';

export const GET_AVAILABLE_VEHICLE_TYPES = gql`
  query GetAvailableVehicleTypes {
    getAvailableVehicleTypes
  }
`;
