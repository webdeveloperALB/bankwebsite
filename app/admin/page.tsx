"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import AdminLayout from "./components/admin-layout"
import UsersTab from "./components/users-tab"
import MessagesTab from "./components/messages-tab"
import TaxesTab from "./components/taxes-tab"
import BalancesTab from "./components/balances-tab"
import type { Database } from "@/lib/supabase"
import KYCTab from "./components/kyc-tab"
import CryptoTab from "./components/crypto-tab"
import TransactionsTab from "./components/transactions-tab"
import SupportTab from "./components/support-tab"
import DepositsTab from "./components/deposits-tab"
import UserOverviewTab from "./components/user-overview-tab"

type User = Database["public"]["Tables"]["users"]["Row"]

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("user-overview")
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser || currentUser.role !== "admin") {
          router.push("/auth/login")
          return
        }
        setUser(currentUser)
      } catch (error) {
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "user-overview":
        return <UserOverviewTab />
      case "users":
        return <UsersTab />
      case "kyc":
        return <KYCTab />
      case "balances":
        return <BalancesTab />
      case "crypto":
        return <CryptoTab />
      case "transactions":
        return <TransactionsTab />
      case "deposits":
        return <DepositsTab />
      case "messages":
        return <MessagesTab activeTab={activeTab} onTabChange={setActiveTab} />
      case "taxes":
        return <TaxesTab />
      case "support":
        return <SupportTab />
      case "UserOverviewTab":
        return <UserOverviewTab />
    }
  }

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTabContent()}
    </AdminLayout>
  )
}
