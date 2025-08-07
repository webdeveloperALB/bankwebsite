"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signOut } from "@/lib/auth";
import { logUserLogin, logUserLogout } from "@/lib/session-tracker";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CreditCard,
  ArrowUpDown,
  PiggyBank,
  Bitcoin,
  MessageSquare,
  FileText,
  HelpCircle,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Database } from "@/lib/supabase";
import Image from "next/image";

type User = Database["public"]["Tables"]["users"]["Row"];

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentSection?: string;
}

export default function DashboardLayout({
  children,
  currentSection = "dashboard",
}: DashboardLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push("/auth/login");
          return;
        }

        // Check KYC status for non-admin users
        if (
          currentUser.role !== "admin" &&
          currentUser.kyc_status !== "approved"
        ) {
          router.push("/kyc");
          return;
        }

        setUser(currentUser);

        // Log user login only once per session using sessionStorage
        const sessionKey = `login_logged_${currentUser.id}`;
        const alreadyLogged = sessionStorage.getItem(sessionKey);

        if (!alreadyLogged) {
          console.log(
            "📝 Logging login for user:",
            currentUser.name,
            "ID:",
            currentUser.id
          );
          try {
            await logUserLogin(currentUser.id);
            sessionStorage.setItem(sessionKey, "true");
            console.log("✅ Login logged successfully for:", currentUser.name);
          } catch (error) {
            console.error(
              "❌ Failed to log login for:",
              currentUser.name,
              error
            );
          }
        } else {
          console.log(
            "🔄 Login already logged for this session:",
            currentUser.name
          );
        }
      } catch (error) {
        console.error("❌ Error in loadUser:", error);
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Cleanup function for logout - only run on unmount
    return () => {
      if (user) {
        logUserLogout(user.id).catch(console.error);
        console.log("📝 User logout logged for:", user.name);
      }
    };
  }, [router]); // Remove handleUserLogoutCleanup from dependencies

  const handleSignOut = async () => {
    console.log("📝 User signing out - logging logout");
    if (user) {
      await logUserLogout(user.id);
    }
    await signOut();
    router.push("/auth/login");
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      id: "dashboard",
    },
    {
      name: "Balances",
      href: "/dashboard/balances",
      icon: CreditCard,
      id: "balances",
    },
    { name: "Crypto", href: "/dashboard/crypto", icon: Bitcoin, id: "crypto" },
    {
      name: "Transactions",
      href: "/dashboard/transactions",
      icon: ArrowUpDown,
      id: "transactions",
    },
    {
      name: "Deposits",
      href: "/dashboard/deposits",
      icon: PiggyBank,
      id: "deposits",
    },
    {
      name: "Messages",
      href: "/dashboard/messages",
      icon: MessageSquare,
      id: "messages",
    },
    { name: "Taxes", href: "/dashboard/taxes", icon: FileText, id: "taxes" },
    {
      name: "Support",
      href: "/dashboard/support",
      icon: HelpCircle,
      id: "support",
    },
    {
      name: "Activity",
      href: "/dashboard/activity",
      icon: Activity,
      id: "activity",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-24 px-6 border-b">
          <div className="flex items-center">
            <Image
              src="/anchor3.png"
              alt="Anchor Group Solutions"
              width={200} // adjust width as needed
              height={40} // adjust height as needed
              className="ml-0"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="mt-6 px-3">
          {navigation.map((item) => {
            const isActive = currentSection === item.id;
            return (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 mb-1 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </a>
            );
          })}
        </nav>

        {user?.role === "admin" && (
          <div className="mt-8 px-3">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Admin
            </div>
            <a
              href="/admin"
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900"
            >
              <Settings className="h-5 w-5 mr-3" />
              Admin Panel
            </a>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b h-16 flex items-center justify-between px-4">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Welcome back,{" "}
              <span className="font-medium text-gray-900">{user?.name}</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
