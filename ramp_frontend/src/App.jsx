import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import PlacesList from "./pages/PlacesList";
import PlaceDetail from "./pages/PlaceDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AddPlace from "./pages/AddPlace";
import IndoorNav from "./pages/IndoorNav";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
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
        <Route path="/places/:id/navigate" element={<IndoorNav />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
