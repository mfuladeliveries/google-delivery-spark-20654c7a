import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import OrderNotifications from "@/components/OrderNotifications";
// The customer home is the default landing screen, so it stays in the main
// bundle. Everything else is code-split so a first visit downloads only what
// it needs — this is the difference between a 2s and a 15s cold start on a
// slow mobile connection.
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import RouteAwareInstallPrompt from "@/components/RouteAwareInstallPrompt";
import SplashScreen from "@/components/SplashScreen";
import ActiveOrderBanner from "@/components/ActiveOrderBanner";
import RoleGuard from "@/components/RoleGuard";
import { queryClient, queryPersister } from "@/lib/queryPersister";

const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const PaymentResult = lazy(() => import("./pages/PaymentResult"));
const YocoPayment = lazy(() => import("./pages/YocoPayment"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const RestaurantMenu = lazy(() => import("./pages/RestaurantMenu"));
const RestaurantDashboard = lazy(() => import("./pages/RestaurantDashboard"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const DriverAuth = lazy(() => import("./pages/DriverAuth"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminDiagnostics = lazy(() => import("./pages/AdminDiagnostics"));
const AdminDispatchMonitor = lazy(() => import("./pages/AdminDispatchMonitor"));
const AdminIncidents = lazy(() => import("./pages/AdminIncidents"));
const AdminYocoFailures = lazy(() => import("./pages/AdminYocoFailures"));
const AdminDailyReport = lazy(() => import("./pages/AdminDailyReport"));
const AdminSupport = lazy(() => import("./pages/AdminSupport"));
const DriverPerformance = lazy(() => import("./pages/DriverPerformance"));
const Profile = lazy(() => import("./pages/Profile"));
const Search = lazy(() => import("./pages/Search"));
const Install = lazy(() => import("./pages/Install"));
const GetApp = lazy(() => import("./pages/GetApp"));
const About = lazy(() => import("./pages/About"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const DeliveryPolicy = lazy(() => import("./pages/DeliveryPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));

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
          <Suspense fallback={<AuthLoadingScreen />}>
            <Routes>
              <Route
                path="/"
                element={
                  <RoleGuard allow={["customer", "admin"]}>
                    <Index />
                  </RoleGuard>
                }
              />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/orders"
                element={
                  <RoleGuard allow={["customer", "admin"]}>
                    <Orders />
                  </RoleGuard>
                }
              />
              <Route
                path="/order-confirmation"
                element={
                  <RoleGuard allow={["customer", "admin"]}>
                    <OrderConfirmation />
                  </RoleGuard>
                }
              />
              <Route path="/payment/result" element={<PaymentResult />} />
              <Route
                path="/pay/yoco"
                element={
                  <RoleGuard allow={["customer", "admin"]} requireAuth redirectUnauthedTo="/auth">
                    <YocoPayment />
                  </RoleGuard>
                }
              />
              {/* Legacy PayFast path — keep old links/bookmarks working */}
              <Route
                path="/pay/payfast"
                element={
                  <RoleGuard allow={["customer", "admin"]} requireAuth redirectUnauthedTo="/auth">
                    <YocoPayment />
                  </RoleGuard>
                }
              />
              <Route
                path="/restaurant/dashboard"
                element={
                  <RoleGuard
                    allow={["restaurant", "admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading restaurant dashboard…"
                  >
                    <RestaurantDashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="/restaurant/:id"
                element={
                  <RoleGuard allow={["customer", "admin"]}>
                    <RestaurantMenu />
                  </RoleGuard>
                }
              />
              <Route
                path="/restaurant/orders"
                element={
                  <RoleGuard
                    allow={["restaurant", "admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading restaurant dashboard…"
                  >
                    <RestaurantDashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="/restaurant/menu"
                element={
                  <RoleGuard
                    allow={["restaurant", "admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading restaurant dashboard…"
                  >
                    <RestaurantDashboard />
                  </RoleGuard>
                }
              />
              <Route path="/driver/auth" element={<DriverAuth />} />
              <Route path="/driver/login" element={<DriverAuth />} />
              <Route path="/driver/signup" element={<DriverAuth />} />
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
                path="/driver/performance"
                element={
                  <RoleGuard
                    allow={["driver", "admin"]}
                    requireAuth
                    redirectUnauthedTo="/driver/auth"
                    loadingLabel="Loading driver performance…"
                  >
                    <DriverPerformance />
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
                  <RoleGuard
                    allow={["admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading admin dashboard…"
                  >
                    <AdminDashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/diagnostics"
                element={
                  <RoleGuard
                    allow={["admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading diagnostics…"
                  >
                    <AdminDiagnostics />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/dispatch"
                element={
                  <RoleGuard
                    allow={["admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading dispatch monitor…"
                  >
                    <AdminDispatchMonitor />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/incidents"
                element={
                  <RoleGuard
                    allow={["admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading incidents…"
                  >
                    <AdminIncidents />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/yoco-failures"
                element={
                  <RoleGuard
                    allow={["admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading webhook failures…"
                  >
                    <AdminYocoFailures />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/report"
                element={
                  <RoleGuard
                    allow={["admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading daily report…"
                  >
                    <AdminDailyReport />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/support"
                element={
                  <RoleGuard
                    allow={["admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading support…"
                  >
                    <AdminSupport />
                  </RoleGuard>
                }
              />
              <Route
                path="/profile"
                element={
                  <RoleGuard
                    allow={["customer", "driver", "restaurant", "admin"]}
                    requireAuth
                    redirectUnauthedTo="/auth"
                    loadingLabel="Loading profile…"
                  >
                    <Profile />
                  </RoleGuard>
                }
              />
              <Route
                path="/search"
                element={
                  <RoleGuard allow={["customer", "admin"]}>
                    <Search />
                  </RoleGuard>
                }
              />
              <Route path="/install" element={<Install />} />
              <Route path="/install/:variant" element={<Install />} />
              <Route path="/get-app" element={<GetApp />} />
              <Route path="/about" element={<About />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
              <Route path="/delivery-policy" element={<DeliveryPolicy />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryProvider>
);

export default App;
