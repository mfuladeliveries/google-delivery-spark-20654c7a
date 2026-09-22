
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "customer" | "restaurant" | "driver";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  roles: AppRole[];
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  roles: [],
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to load user roles:", error);
      setRole(null);
      setRoles([]);
      return;
    }

    const allRoles = (data ?? []).map((r) => r.role as AppRole);

    const priority: AppRole[] = [
      "admin",
      "restaurant",
      "driver",
      "customer",
    ];

    const best = priority.find((p) => allRoles.includes(p)) ?? null;

    setRole(best);
    setRoles(allRoles);
  };

  useEffect(() => {
    let mounted = true;

    // Watchdog: on a flaky mobile connection the session/role lookup can hang
    // indefinitely, which used to leave the app stuck on the loading screen.
    // After 8s we stop blocking and render whatever we know; the auth state
    // listener still fills in the session when the network recovers.
    const watchdog = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchRole(session.user.id);
      } else {
        setRole(null);
        setRoles([]);
      }

      if (mounted) setLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchRole(session.user.id);
      } else {
        setRole(null);
        setRoles([]);
      }

      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      window.clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        roles,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
