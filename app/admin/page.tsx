"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminLayout from "./components/admin-layout";
import UsersTab from "./components/users-tab";
import MessagesTab from "./components/messages-tab";
import TaxesTab from "./components/taxes-tab";
import BalancesTab from "./components/balances-tab";
import { Database } from "@/lib/supabase";

// Import existing components (you'll need to create these)
import KYCTab from "./components/kyc-tab";
import CryptoTab from "./components/crypto-tab";
import TransactionsTab from "./components/transactions-tab";
import SupportTab from "./components/support-tab";

type User = Database["public"]["Tables"]["users"]["Row"];

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== "admin") {
          router.push("/auth/login");
          return;
        }
        setUser(currentUser);
      } catch (error) {
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "users":
        return <UsersTab />;
      case "kyc":
        return <KYCTab />;
      case "balances":
        return <BalancesTab />;
      case "crypto":
        return <CryptoTab />;
      case "transactions":
        return <TransactionsTab />;
      case "messages":
        return <MessagesTab />;
      case "taxes":
        return <TaxesTab />;
      case "support":
        return <SupportTab />;
      default:
        return <UsersTab />;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTabContent()}
    </AdminLayout>
  );
}
