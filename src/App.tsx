import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import OrderNotifications from "@/components/OrderNotifications";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Orders from "./pages/Orders";
import NotFound from "./pages/NotFound";
import RestaurantMenu from "./pages/RestaurantMenu";
import RestaurantDashboard from "./pages/RestaurantDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import DriverAuth from "./pages/DriverAuth";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import Install from "./pages/Install";
import RouteAwareInstallPrompt from "@/components/RouteAwareInstallPrompt";
import SplashScreen from "@/components/SplashScreen";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <SplashScreen />
        <Toaster />
        <Sonner />
        <OrderNotifications />
        <BrowserRouter>
          <RouteAwareInstallPrompt />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/restaurant/dashboard" element={<RestaurantDashboard />} />
            <Route path="/restaurant/:id" element={<RestaurantMenu />} />
            <Route path="/restaurant/orders" element={<RestaurantDashboard />} />
            <Route path="/restaurant/menu" element={<RestaurantDashboard />} />
            <Route path="/driver/auth" element={<DriverAuth />} />
            <Route path="/driver" element={<DriverDashboard />} />
            <Route path="/driver/*" element={<DriverDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/search" element={<Search />} />
            <Route path="/install" element={<Install />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
