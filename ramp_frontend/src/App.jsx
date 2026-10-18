import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import PlacesList from "./pages/PlacesList";
import PlaceDetail from "./pages/PlaceDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AddPlace from "./pages/AddPlace";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  return user ? children : <Navigate to="/login" state={{ from: location }} replace />;
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!user.is_staff && user.user_type !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/places" element={<PlacesList />} />
        <Route path="/places/new" element={<RequireAuth><AddPlace /></RequireAuth>} />
        <Route path="/places/:id" element={<PlaceDetail />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
