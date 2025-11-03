import { gql } from '@apollo/client';

export const GET_ALL_DRIVER_REPORTS = gql`
  query GetAllDriverReports($filters: DriverReportFiltersInput, $limit: Int, $offset: Int) {
    getAllDriverReports(filters: $filters, limit: $limit, offset: $offset) {
      success
      message
      reports {
        id
        driverId
        driver {
          driverId
          firstName
          lastName
          email
          contactNumber
          vehiclePlateNumber
        }
        title
        description
        reportType
        status
        attachments
        adminNotes
        adminNotesUpdatedAt
        adminNotesBy {
          adminId
          adminName
          adminEmail
        }
        createdAt
        updatedAt
        resolvedAt
        isArchived
        archivedAt
        scheduledDeletionDate
      }
      totalCount
    }
  }
`;

export const GET_DRIVER_REPORT_BY_ID = gql`
  query GetDriverReportById($id: ID!) {
    getDriverReportByIdAdmin(id: $id) {
      id
      driverId
      driver {
        driverId
        firstName
        lastName
        email
        contactNumber
        vehiclePlateNumber
      }
      title
      description
      reportType
      status
      attachments
      adminNotes
      adminNotesUpdatedAt
      adminNotesBy {
        adminId
        adminName
        adminEmail
      }
      createdAt
      updatedAt
      resolvedAt
      isArchived
      archivedAt
      scheduledDeletionDate
    }
  }
`;

