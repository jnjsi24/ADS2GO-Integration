import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext"; // Adjust path if needed

const AdminRoutes = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth(); // Fetch user from context

  console.log("AdminRoutes Check:", user); // Debug log

  if (!user) {
    console.log("🔴 No user found, redirecting to login...");
    return <Navigate to="/login" replace />;
  }

  // Normalize role casing to avoid mismatches
  if (user.role.toUpperCase() !== "ADMIN") {
    console.log("🚨 Unauthorized: Redirecting to User Homepage...");
    return <Navigate to="/user-homepage" replace />;
  }
  

  return <>{children}</>;
};

export default AdminRoutes;
