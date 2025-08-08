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
  Building2,
  Shield,
  TrendingUp,
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
  }, [router]);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          {/* Image replaces spinner */}
          <div className="relative">
            <Image
              src="/anchor3.svg"
              alt="Loading"
              width={250}
              height={0}
              className="mx-auto"
              priority
            />
          </div>

          <div className="mt-6">
            <p className="text-[#F26623] font-semibold text-xl">
              Loading your banking dashboard...
            </p>
            <p className="text-gray-600 text-lg mt-0">
              Please wait while we secure your session
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-white shadow-2xl transform transition-all duration-300 ease-in-out lg:translate-x-0 border-r-2 border-[#F26623]/10 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header - Fixed */}
        <div className="relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#F26623] to-[#E55A1F]"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>

          <div className="relative z-10 flex items-center justify-between h-16 sm:h-20 px-4 sm:px-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-1.5 sm:p-2">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-white font-bold text-sm sm:text-base">
                  Anchor Bank
                </h1>
                <p className="text-orange-100 text-xs">Professional Banking</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-white hover:bg-white/20"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation - Scrollable */}
        <nav
          className="flex-1 overflow-y-auto no-scrollbar px-3 sm:px-4 py-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = currentSection === item.id;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white shadow-lg"
                      : "text-gray-700 hover:bg-[#F26623]/10 hover:text-[#F26623]"
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg mr-3 transition-colors ${
                      isActive
                        ? "bg-white/20"
                        : "bg-gray-100 group-hover:bg-[#F26623]/20"
                    }`}
                  >
                    <item.icon
                      className={`h-4 w-4 ${
                        isActive
                          ? "text-white"
                          : "text-gray-600 group-hover:text-[#F26623]"
                      }`}
                    />
                  </div>
                  <span className="font-medium text-sm">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </a>
              );
            })}
          </div>

          {/* Admin Section - Inside scrollable area */}
          {user?.role === "admin" && (
            <div className="mt-6 pt-4 border-t border-[#F26623]/20">
              <div className="px-2 py-1 text-xs font-bold text-[#F26623] uppercase tracking-wider">
                <div className="flex items-center">
                  <Shield className="h-3 w-3 mr-2" />
                  Administration
                </div>
              </div>
              <div className="mt-2">
                <a
                  href="/admin"
                  className="group flex items-center px-3 py-2 text-sm font-semibold text-gray-700 rounded-lg hover:bg-[#F26623]/10 hover:text-[#F26623] transition-all duration-200"
                >
                  <div className="p-1.5 rounded-lg mr-3 bg-gray-100 group-hover:bg-[#F26623]/20 transition-colors">
                    <Settings className="h-4 w-4 text-gray-600 group-hover:text-[#F26623]" />
                  </div>
                  <span className="font-medium text-sm">Admin Panel</span>
                </a>
              </div>
            </div>
          )}
        </nav>

        {/* User Profile Section - Fixed at bottom */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t border-[#F26623]/10">
          <div className="bg-gradient-to-r from-[#F26623]/5 to-[#E55A1F]/10 rounded-xl p-3 border border-[#F26623]/20">
            <div className="flex items-center mb-3">
              <div className="relative">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#F26623] to-[#E55A1F] rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-sm sm:text-base font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-600 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-[#F26623]/30 text-[#F26623] hover:bg-[#F26623] hover:text-white hover:border-[#F26623] transition-all duration-200 font-semibold text-xs"
              onClick={handleSignOut}
            >
              <LogOut className="h-3 w-3 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 xl:pl-72">
        {/* Top Navigation Bar */}
        <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b-2 border-[#F26623]/10 h-14 sm:h-16 lg:h-20 flex items-center justify-between px-3 sm:px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-[#F26623] hover:bg-[#F26623]/10 p-1.5 sm:p-2"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Mobile: Show only icon and abbreviated title */}
            <div className="flex md:hidden items-center space-x-2">
              <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] rounded-full p-1.5">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Dashboard</h2>
              </div>
            </div>

            {/* Desktop: Show full title */}
            <div className="hidden md:flex items-center space-x-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  Banking Dashboard
                </h2>
                <p className="text-xs sm:text-sm text-gray-600">
                  Secure Financial Management
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-6">
            {/* Mobile: Show date and time stacked */}
            <div className="block sm:hidden text-right">
              <p className="text-xs text-gray-600">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="font-bold text-[#F26623] text-sm">
                {new Date().toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {/* Tablet: Show date and time stacked */}
            <div className="hidden sm:block md:hidden text-right">
              <p className="text-xs text-gray-600">
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="font-bold text-[#F26623] text-sm">
                {new Date().toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {/* Desktop: Show date and time horizontal */}
            <div className="hidden md:block">
              <div className="flex items-center space-x-3 text-right">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="w-px h-6 bg-gray-300"></div>
                <div>
                  <p className="font-bold text-[#F26623] text-sm sm:text-base">
                    {new Date().toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Connection Status - Responsive */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-green-600 hidden lg:inline">
                Secure Connection
              </span>
              <span className="text-xs font-medium text-green-600 hidden sm:inline lg:hidden">
                Secure
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
