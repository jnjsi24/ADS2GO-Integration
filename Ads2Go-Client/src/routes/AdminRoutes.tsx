import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../contexts/AdminAuthContext"; // Adjust path if needed

const AdminRoutes = ({ children }: { children: React.ReactNode }) => {
  const { admin } = useAdminAuth(); // Fetch admin from context

  console.log("AdminRoutes Check:", admin); // Debug log

  if (!admin) {
    console.log("🔴 No admin found, redirecting to admin login...");
    return <Navigate to="/admin-login" replace />;
  }

  // Normalize role casing to avoid mismatches
  if (admin.role.toUpperCase() !== "ADMIN") {
    console.log("🚨 Unauthorized: Redirecting to admin login...");
    return <Navigate to="/admin-login" replace />;
  }
  

  return <>{children}</>;
};

export default AdminRoutes;
