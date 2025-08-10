"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import Image from "next/image"
import DashboardLayout from "@/components/dashboard-layout"
import { Bitcoin, ArrowUpDown, DollarSign, MessageSquare, Mail, MailOpen } from "lucide-react"
import type { Database } from "@/lib/supabase"
import {
  convertCurrency,
  getCryptoPrice,
  getCurrencyRate,
  subscribeToRateUpdates,
  forceRateUpdate,
} from "@/lib/exchange-rates"

type User = Database["public"]["Tables"]["users"]["Row"]
type Balance = Database["public"]["Tables"]["balances"]["Row"]
type CryptoBalance = Database["public"]["Tables"]["crypto_balances"]["Row"]
type Transaction = Database["public"]["Tables"]["transactions"]["Row"]
type Message = Database["public"]["Tables"]["messages"]["Row"]
type MessageReadStatus = Database["public"]["Tables"]["message_read_status"]["Row"]

function CurrencyIcon({ currency }: { currency: string }) {
  const [hasError, setHasError] = useState(false)

  const currencyLogos: { [key: string]: string } = {
    USD: "/icons/dollar.svg",
    EUR: "/icons/euro.svg",
    GBP: "/icons/pound.svg",
  }

  if (hasError) {
    return <DollarSign className="h-6 w-6 text-green-600" />
  }

  return (
    <Image
      src={currencyLogos[currency] || "/placeholder.svg"}
      alt={`${currency} logo`}
      width={32}
      height={32}
      className="w-8 h-8 object-contain"
      onError={() => setHasError(true)}
    />
  )
}

function CryptoIcon({ crypto }: { crypto: string }) {
  const [hasError, setHasError] = useState(false)

  const cryptoLogos: { [key: string]: string } = {
    BTC: "/cdn/bitcoin.png",
    ETH: "/cdn/etherium.svg",
    USDT: "/cdn/usdt.svg",
  }

  if (hasError) {
    return <Bitcoin className="h-6 w-6 text-orange-600" />
  }

  return (
    <Image
      src={cryptoLogos[crypto] || "/placeholder.svg"}
      alt={`${crypto} logo`}
      width={32}
      height={32}
      className="w-8 h-8 object-contain"
      onError={() => setHasError(true)}
    />
  )
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [balances, setBalances] = useState<Balance[]>([])
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [latestMessages, setLatestMessages] = useState<Message[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [latestMessageRead, setLatestMessageRead] = useState(false)
  const [markingAsRead, setMarkingAsRead] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rateRefreshKey, setRateRefreshKey] = useState(0)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  // Force re-render when REAL exchange rates change
  const forceRerender = () => {
    setRateRefreshKey((prev) => prev + 1)
    console.log("🔄 Dashboard re-rendering due to REAL rate changes")
  }
  useEffect(() => {
    // Subscribe to REAL-TIME exchange rate updates
    const unsubscribeRates = subscribeToRateUpdates(forceRerender)

    // Force initial rate update
    forceRateUpdate()

    const loadDashboardData = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) return

        setUser(currentUser)

        // Load balances
        const { data: balancesData } = await supabase.from("balances").select("*").eq("user_id", currentUser.id)

        setBalances(balancesData || [])

        // Load crypto balances
        const { data: cryptoData } = await supabase.from("crypto_balances").select("*").eq("user_id", currentUser.id)

        setCryptoBalances(cryptoData || [])

        // Load recent transactions
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("*")
          .or(`user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
          .order("created_at", { ascending: false })
          .limit(3)

        setRecentTransactions(transactionsData || [])

        // Load latest messages (get 3 instead of 1)
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(3)

        if (messagesData && messagesData.length > 0) {
          setLatestMessages(messagesData)
        }

        // Count unread messages (admin messages not in read status)
        const { data: unreadData } = await supabase
          .from("messages")
          .select(
            `
            id,
            from_admin,
            message_read_status!left(id)
          `,
          )
          .eq("user_id", currentUser.id)
          .eq("from_admin", true)
          .is("message_read_status.id", null)

        setUnreadMessages(unreadData?.length || 0)

        // Check if latest message is read (only check the first/most recent one)
        if (messagesData && messagesData.length > 0 && messagesData[0].from_admin) {
          const { data: readStatus } = await supabase
            .from("message_read_status")
            .select("id")
            .eq("user_id", currentUser.id)
            .eq("message_id", messagesData[0].id)
            .single()

          setLatestMessageRead(!!readStatus)
        } else {
          setLatestMessageRead(true)
        }

        // Set up real-time subscriptions
        const balancesChannel = supabase
          .channel("balances")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "balances",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              // Reload balances
              supabase
                .from("balances")
                .select("*")
                .eq("user_id", currentUser.id)
                .then(({ data }) => setBalances(data || []))
            },
          )
          .subscribe()

        const cryptoChannel = supabase
          .channel("crypto_balances")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "crypto_balances",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              // Reload crypto balances
              supabase
                .from("crypto_balances")
                .select("*")
                .eq("user_id", currentUser.id)
                .then(({ data }) => setCryptoBalances(data || []))
            },
          )
          .subscribe()

        const transactionsChannel = supabase
          .channel("transactions")
          .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
            // Reload transactions
            supabase
              .from("transactions")
              .select("*")
              .or(`user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
              .order("created_at", { ascending: false })
              .limit(3)
              .then(({ data }) => setRecentTransactions(data || []))
          })
          .subscribe()

        const messagesChannel = supabase
          .channel("messages")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              // Reload latest messages (get 3)
              supabase
                .from("messages")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false })
                .limit(3)
                .then(({ data }) => {
                  if (data && data.length > 0) {
                    setLatestMessages(data)
                  }
                })

              // Update unread count
              supabase
                .from("messages")
                .select(
                  `
                  id,
                  from_admin,
                  message_read_status!left(id)
                `,
                )
                .eq("user_id", currentUser.id)
                .eq("from_admin", true)
                .is("message_read_status.id", null)
                .then(({ data }) => {
                  setUnreadMessages(data?.length || 0)
                })
            },
          )
          .subscribe()

        const readStatusChannel = supabase
          .channel("message_read_status")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "message_read_status",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              // Update unread count when read status changes
              supabase
                .from("messages")
                .select(
                  `
                  id,
                  from_admin,
                  message_read_status!left(id)
                `,
                )
                .eq("user_id", currentUser.id)
                .eq("from_admin", true)
                .is("message_read_status.id", null)
                .then(({ data }) => {
                  setUnreadMessages(data?.length || 0)
                })

              // Update latest message read status (check first message)
              if (latestMessages.length > 0 && latestMessages[0].from_admin) {
                supabase
                  .from("message_read_status")
                  .select("id")
                  .eq("user_id", currentUser.id)
                  .eq("message_id", latestMessages[0].id)
                  .single()
                  .then(({ data }) => {
                    setLatestMessageRead(!!data)
                  })
              }
            },
          )
          .subscribe()

        return () => {
          unsubscribeRates()
          supabase.removeChannel(balancesChannel)
          supabase.removeChannel(cryptoChannel)
          supabase.removeChannel(transactionsChannel)
          supabase.removeChannel(messagesChannel)
          supabase.removeChannel(readStatusChannel)
        }
      } catch (error) {
        console.error("Error loading dashboard:", error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [latestMessages])

  // Add automatic refresh every second as backup to real-time subscriptions
  useEffect(() => {
    if (!user) return

    const refreshData = async () => {
      try {
        // Refresh balances
        const { data: balancesData } = await supabase.from("balances").select("*").eq("user_id", user.id)
        setBalances(balancesData || [])

        // Refresh crypto balances
        const { data: cryptoData } = await supabase.from("crypto_balances").select("*").eq("user_id", user.id)
        setCryptoBalances(cryptoData || [])

        // Refresh recent transactions
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("*")
          .or(`user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(3)
        setRecentTransactions(transactionsData || [])

        // Refresh latest messages
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3)
        if (messagesData && messagesData.length > 0) {
          setLatestMessages(messagesData)
        }

        // Refresh unread messages count
        const { data: unreadData } = await supabase
          .from("messages")
          .select(`
          id,
          from_admin,
          message_read_status!left(id)
        `)
          .eq("user_id", user.id)
          .eq("from_admin", true)
          .is("message_read_status.id", null)
        setUnreadMessages(unreadData?.length || 0)

        // Check latest message read status
        if (messagesData && messagesData.length > 0 && messagesData[0].from_admin) {
          const { data: readStatus } = await supabase
            .from("message_read_status")
            .select("id")
            .eq("user_id", user.id)
            .eq("message_id", messagesData[0].id)
            .single()
          setLatestMessageRead(!!readStatus)
        }

        // Force exchange rate refresh
        forceRateUpdate()
      } catch (error) {
        console.error("Error refreshing dashboard data:", error)
      }
    }

    // Set up interval to refresh every second
    const interval = setInterval(refreshData, 1000)

    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [user]) // Only depend on user to avoid recreating interval unnecessarily

  // Calculate REAL USD values using API exchange rates
  const totalFiatBalance = balances.reduce((sum, balance) => {
    const usdValue = convertCurrency(Number(balance.amount), balance.currency, "USD")
    return sum + usdValue
  }, 0)

  const totalCryptoValue = cryptoBalances.reduce((sum, crypto) => {
    const price = getCryptoPrice(crypto.crypto)
    return sum + Number(crypto.amount) * price
  }, 0)

  const markMessageAsRead = async (messageId: string) => {
    if (!user) return

    setMarkingAsRead(true)

    try {
      // Insert or update read status
      const { error } = await supabase.from("message_read_status").upsert(
        {
          user_id: user.id,
          message_id: messageId,
          read_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,message_id",
        },
      )

      if (error) throw error

      // Update local state immediately
      setLatestMessageRead(true)

      // Refresh unread count
      const { data: unreadData } = await supabase
        .from("messages")
        .select(
          `
          id,
          from_admin,
          message_read_status!left(id)
        `,
        )
        .eq("user_id", user.id)
        .eq("from_admin", true)
        .is("message_read_status.id", null)

      setUnreadMessages(unreadData?.length || 0)

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: "Marked message as read",
      })
    } catch (error) {
      console.error("Error marking message as read:", error)
    } finally {
      setMarkingAsRead(false)
    }
  }

  const isMessageRead = async (messageId: string): Promise<boolean> => {
    if (!user) return false

    const { data } = await supabase
      .from("message_read_status")
      .select("id")
      .eq("user_id", user.id)
      .eq("message_id", messageId)
      .single()

    return !!data
  }

  const toggleMessageExpansion = (messageId: string) => {
    setExpandedMessages((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  return (
    <DashboardLayout currentSection="dashboard">
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
        {/* Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#F26623] via-[#E55A1F] to-[#D94E1A] rounded-2xl mb-8 shadow-2xl">
          {/* overlays */}
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />

          {/* logo pinned to the true top-right corner */}
          <Image
            src="/anchor3_white.svg"
            alt="Anchor Group Investments Logo"
            width={64}
            height={64}
            className="absolute top-2 right-2 h-24 w-auto hidden xs:block" // adjust top/right as needed
            priority
          />

          {/* content gets the padding */}
          <div className="relative z-10 p-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">
                Welcome back, {user?.name || "Valued Client"}
              </h1>
            </div>
          </div>
        </div>

        {/* Currency Accounts Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">Currency Accounts</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-[#F26623] to-[#E55A1F] rounded-full"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {["USD", "EUR", "GBP"].map((currency) => {
              const balance = balances.find((b) => b.currency === currency)
              const amount = balance ? Number(balance.amount) : 0

              return (
                <div
                  key={currency}
                  className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

                  <div className="relative p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-4 shadow-lg">
                        <CurrencyIcon currency={currency} />
                      </div>
                      <div className="text-right">
                        <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{currency}</h3>
                        <p className="text-[#F26623] font-semibold text-sm">Account</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">
                          {amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white px-4 py-2 rounded-full inline-block">
                          <span className="text-sm font-semibold">
                            ≈ $
                            {convertCurrency(amount, currency, "USD").toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            USD
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#F26623]/5 rounded-xl p-4 border border-[#F26623]/20">
                        <p className="text-sm text-gray-600 mb-1">Exchange Rate</p>
                        <p className="text-[#F26623] font-bold">
                          1 {currency} = ${(1 / getCurrencyRate(currency)).toFixed(6)} USD
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {balances.length > 3 && (
            <div className="mt-8 text-center">
              <a
                href="/dashboard/balances"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white font-bold rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                View All {balances.length} Accounts →
              </a>
            </div>
          )}
        </div>

        {/* Digital Assets Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">Digital Assets Portfolio</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-[#F26623] to-[#E55A1F] rounded-full"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {["BTC", "ETH", "USDT"].map((cryptoSymbol) => {
              const crypto = cryptoBalances.find((c) => c.crypto === cryptoSymbol)
              const amount = crypto ? Number(crypto.amount) : 0
              const price = getCryptoPrice(cryptoSymbol)
              const usdValue = amount * price

              return (
                <div
                  key={cryptoSymbol}
                  className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

                  <div className="relative p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="bg-transparent rounded-2xl p-4 shadow-lg">
                        <CryptoIcon crypto={cryptoSymbol} />
                      </div>
                      <div className="text-right">
                        <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{cryptoSymbol}</h3>
                        <p className="text-[#F26623] font-semibold text-sm">Crypto</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">
                          {amount.toLocaleString("en-US", {
                            minimumFractionDigits: 8,
                            maximumFractionDigits: 8,
                          })}
                        </p>
                        <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white px-4 py-2 rounded-full inline-block">
                          <span className="text-sm font-semibold">
                            ≈ $
                            {usdValue.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            USD
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#F26623]/5 rounded-xl p-4 border border-[#F26623]/20">
                        <p className="text-sm text-gray-600 mb-1">Market Price</p>
                        <p className="text-[#F26623] font-bold">
                          $
                          {getCryptoPrice(cryptoSymbol).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 8,
                          })}{" "}
                          per {cryptoSymbol}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {cryptoBalances.length > 3 && (
            <div className="mt-8 text-center">
              <a
                href="/dashboard/crypto"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white font-bold rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                View All {cryptoBalances.length} Digital Assets →
              </a>
            </div>
          )}
        </div>

        {/* Communications & Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Communications Card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
            <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 rounded-full p-3">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">Communications</h3>
                    <p className="text-orange-100">Stay connected with support</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8">
              {loading ? (
                <div className="animate-pulse space-y-6">
                  <div className="h-6 bg-[#F26623]/20 rounded-lg w-3/4"></div>
                  <div className="h-4 bg-[#F26623]/10 rounded w-1/2"></div>
                </div>
              ) : latestMessages.length > 0 ? (
                <div className="space-y-6">
                  <div className="max-h-96 overflow-y-auto space-y-4">
                    {latestMessages.map((message, index) => (
                      <div
                        key={message.id}
                        className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-full p-2 flex-shrink-0">
                          {message.from_admin ? (
                            <Mail className="h-4 w-4 text-white" />
                          ) : (
                            <MailOpen className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-bold text-gray-900">{message.from_admin ? "Support Team" : "You"}</p>
                            <div className="bg-[#F26623]/10 text-[#F26623] px-2 py-1 rounded-full text-xs font-semibold">
                              {new Date(message.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-gray-700 text-sm leading-relaxed break-words overflow-wrap-anywhere">
                            <p>
                              {message.message.length > 100 && !expandedMessages.has(message.id)
                                ? `${message.message.substring(0, 100)}...`
                                : message.message}
                            </p>
                            {message.message.length > 100 && (
                              <button
                                onClick={() => toggleMessageExpansion(message.id)}
                                className="text-[#F26623] hover:text-[#E55A1F] font-semibold text-xs mt-1 hover:underline transition-colors"
                              >
                                {expandedMessages.has(message.id) ? "Show less" : "Show more"}
                              </button>
                            )}
                          </div>
                          {index === 0 && message.from_admin && (
                            <div className="mt-2">
                              {!latestMessageRead ? (
                                <button
                                  onClick={() => markMessageAsRead(message.id)}
                                  disabled={markingAsRead}
                                  className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 rounded-full text-xs font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                                >
                                  {markingAsRead ? "Marking..." : "Mark as Read"}
                                </button>
                              ) : (
                                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold inline-block">
                                  ✓ Read
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t-2 border-[#F26623]/10 text-center">
                    <a
                      href="/dashboard/messages"
                      className="text-[#F26623] hover:text-[#E55A1F] font-bold hover:underline transition-colors text-lg"
                    >
                      View All Messages →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-[#F26623]/10 to-[#E55A1F]/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <MessageSquare className="h-12 w-12 text-[#F26623]" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Messages Yet</h4>
                  <p className="text-gray-600 mb-6">Start a conversation with our support team</p>
                  <a
                    href="/dashboard/messages"
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white font-bold rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    Start Conversation
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
            <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 rounded-full p-3">
                  <ArrowUpDown className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">Recent Activity</h3>
                  <p className="text-orange-100">Your latest transactions</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-[#F26623]/10 rounded-xl p-6">
                      <div className="h-4 bg-[#F26623]/20 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-[#F26623]/10 rounded w-20"></div>
                    </div>
                  ))}
                </div>
              ) : recentTransactions.length > 0 ? (
                <div className="space-y-4">
                  {recentTransactions.map((transaction, index) => {
                    const formattedType = transaction.type
                      .split(" ")
                      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(" ")
                    return (
                      <div
                        key={transaction.id}
                        className="bg-gradient-to-r from-[#F26623]/5 to-[#E55A1F]/10 rounded-xl p-6 border-2 border-[#F26623]/10 hover:border-[#F26623]/30 transition-all duration-300 hover:shadow-lg"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                            <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-full w-12 h-12 flex items-center justify-center text-white font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm sm:text-lg">{formattedType}</p>
                              <div className="bg-[#F26623]/10 text-[#F26623] px-3 py-1 rounded-full text-xs font-semibold inline-block mt-1">
                                {new Date(transaction.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg sm:text-2xl font-bold text-gray-900">
                              {transaction.amount} {transaction.currency}
                            </p>
                            <p className="text-[#F26623] font-bold">{formattedType}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  <div className="pt-6 border-t-2 border-[#F26623]/10 text-center">
                    <a
                      href="/dashboard/transactions"
                      className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white font-bold rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      View All Transactions →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-[#F26623]/10 to-[#E55A1F]/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <ArrowUpDown className="h-12 w-12 text-[#F26623]" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Transactions Yet</h4>
                  <p className="text-gray-600 mb-2">Your transaction history will appear here</p>
                  <p className="text-[#F26623] font-semibold">Ready to get started?</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
