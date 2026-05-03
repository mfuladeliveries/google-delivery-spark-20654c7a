import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import OrderNotifications from "@/components/OrderNotifications";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import Orders from "./pages/Orders";
import OrderConfirmation from "./pages/OrderConfirmation";
import PaymentResult from "./pages/PaymentResult";
import PayFastRedirect from "./pages/PayFastRedirect";
import NotFound from "./pages/NotFound";
import RestaurantMenu from "./pages/RestaurantMenu";
import RestaurantDashboard from "./pages/RestaurantDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import DriverAuth from "./pages/DriverAuth";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import Install from "./pages/Install";
import About from "./pages/About";
import RouteAwareInstallPrompt from "@/components/RouteAwareInstallPrompt";
import SplashScreen from "@/components/SplashScreen";
import ActiveOrderBanner from "@/components/ActiveOrderBanner";
import RoleGuard from "@/components/RoleGuard";
import { queryClient, queryPersister } from "@/lib/queryPersister";

// Use the persistent provider when localStorage is available so the cache
// survives reloads/relaunches; fall back to the regular provider otherwise.
const QueryProvider = ({ children }: { children: React.ReactNode }) =>
  queryPersister ? (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      {children}
    </PersistQueryClientProvider>
  ) : (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

const App = () => (
  <QueryProvider>
    <AuthProvider>
      <TooltipProvider>
        <SplashScreen />
        <Toaster />
        <Sonner />
        <OrderNotifications />
        <BrowserRouter>
          <RouteAwareInstallPrompt />
          <ActiveOrderBanner />
          <Routes>
            <Route
              path="/"
              element={
                <RoleGuard allow={["customer"]}>
                  <Index />
                </RoleGuard>
              }
            />
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/order-confirmation" element={<OrderConfirmation />} />
            <Route path="/payment/result" element={<PaymentResult />} />
            <Route
              path="/pay/payfast"
              element={
                <RoleGuard allow={["customer", "admin"]} requireAuth redirectUnauthedTo="/auth">
                  <PayFastRedirect />
                </RoleGuard>
              }
            />
            <Route
              path="/restaurant/dashboard"
              element={
                <RoleGuard allow={["restaurant", "admin"]} requireAuth redirectUnauthedTo="/auth" loadingLabel="Loading restaurant dashboard…">
                  <RestaurantDashboard />
                </RoleGuard>
              }
            />
            <Route path="/restaurant/:id" element={<RestaurantMenu />} />
            <Route
              path="/restaurant/orders"
              element={
                <RoleGuard allow={["restaurant", "admin"]} requireAuth redirectUnauthedTo="/auth" loadingLabel="Loading restaurant dashboard…">
                  <RestaurantDashboard />
                </RoleGuard>
              }
            />
            <Route
              path="/restaurant/menu"
              element={
                <RoleGuard allow={["restaurant", "admin"]} requireAuth redirectUnauthedTo="/auth" loadingLabel="Loading restaurant dashboard…">
                  <RestaurantDashboard />
                </RoleGuard>
              }
            />
            <Route path="/driver/auth" element={<DriverAuth />} />
            <Route
              path="/driver"
              element={
                <RoleGuard
                  allow={["driver", "admin"]}
                  requireAuth
                  redirectUnauthedTo="/driver/auth"
                  loadingLabel="Loading driver dashboard…"
                >
                  <DriverDashboard />
                </RoleGuard>
              }
            />
            <Route
              path="/driver/*"
              element={
                <RoleGuard
                  allow={["driver", "admin"]}
                  requireAuth
                  redirectUnauthedTo="/driver/auth"
                  loadingLabel="Loading driver dashboard…"
                >
                  <DriverDashboard />
                </RoleGuard>
              }
            />
            <Route
              path="/admin"
              element={
                <RoleGuard allow={["admin"]} requireAuth redirectUnauthedTo="/auth" loadingLabel="Loading admin dashboard…">
                  <AdminDashboard />
                </RoleGuard>
              }
            />
            <Route
              path="/profile"
              element={
                <RoleGuard allow={["customer", "driver", "restaurant", "admin"]} requireAuth redirectUnauthedTo="/auth" loadingLabel="Loading profile…">
                  <Profile />
                </RoleGuard>
              }
            />
            <Route path="/search" element={<Search />} />
            <Route path="/install" element={<Install />} />
            <Route path="/install/:variant" element={<Install />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryProvider>
);

export default App;
