"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import Image from "next/image";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CreditCard,
  Bitcoin,
  ArrowUpDown,
  TrendingUp,
  Users,
  DollarSign,
  MessageSquare,
  Mail,
  MailOpen,
} from "lucide-react";
import { Database } from "@/lib/supabase";
import {
  convertCurrency,
  getCryptoPrice,
  getCurrencyRate,
} from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type Balance = Database["public"]["Tables"]["balances"]["Row"];
type CryptoBalance = Database["public"]["Tables"]["crypto_balances"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type MessageReadStatus =
  Database["public"]["Tables"]["message_read_status"]["Row"];

function CurrencyIcon({ currency }: { currency: string }) {
  const [hasError, setHasError] = useState(false);

  const currencyLogos: { [key: string]: string } = {
    USD: "/icons/usd.svg",
    EUR: "/icons/eur.svg",
    GBP: "/icons/gbp.svg",
  };

  if (hasError) {
    return <DollarSign className="h-6 w-6 text-green-600" />;
  }

  return (
    <Image
      src={currencyLogos[currency]}
      alt={`${currency} logo`}
      width={32}
      height={32}
      className="w-8 h-8 object-contain"
      onError={() => setHasError(true)}
    />
  );
}

function CryptoIcon({ crypto }: { crypto: string }) {
  const [hasError, setHasError] = useState(false);

  const cryptoLogos: { [key: string]: string } = {
    BTC: "/cdn/bitcoin.png",
    ETH: "/cdn/etherium.svg",
    USDT: "/cdn/usdt.svg",
  };

  if (hasError) {
    return <Bitcoin className="h-6 w-6 text-orange-600" />;
  }

  return (
    <Image
      src={cryptoLogos[crypto]}
      alt={`${crypto} logo`}
      width={32}
      height={32}
      className="w-8 h-8 object-contain"
      onError={() => setHasError(true)}
    />
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );
  const [latestMessage, setLatestMessage] = useState<Message | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUser(currentUser);

        // Load balances
        const { data: balancesData } = await supabase
          .from("balances")
          .select("*")
          .eq("user_id", currentUser.id);

        setBalances(balancesData || []);

        // Load crypto balances
        const { data: cryptoData } = await supabase
          .from("crypto_balances")
          .select("*")
          .eq("user_id", currentUser.id);

        setCryptoBalances(cryptoData || []);

        // Load recent transactions
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("*")
          .or(`user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
          .order("created_at", { ascending: false })
          .limit(5);

        setRecentTransactions(transactionsData || []);

        // Load latest message and unread count
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (messagesData && messagesData.length > 0) {
          setLatestMessage(messagesData[0]);
        }

        // Count unread messages (admin messages not in read status)
        const { data: unreadData } = await supabase
          .from("messages")
          .select(
            `
            id,
            from_admin,
            message_read_status!left(id)
          `
          )
          .eq("user_id", currentUser.id)
          .eq("from_admin", true)
          .is("message_read_status.id", null);

        setUnreadMessages(unreadData?.length || 0);

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
                .then(({ data }) => setBalances(data || []));
            }
          )
          .subscribe();

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
                .then(({ data }) => setCryptoBalances(data || []));
            }
          )
          .subscribe();

        const transactionsChannel = supabase
          .channel("transactions")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "transactions" },
            () => {
              // Reload transactions
              supabase
                .from("transactions")
                .select("*")
                .or(
                  `user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`
                )
                .order("created_at", { ascending: false })
                .limit(5)
                .then(({ data }) => setRecentTransactions(data || []));
            }
          )
          .subscribe();

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
              // Reload latest message
              supabase
                .from("messages")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .then(({ data }) => {
                  if (data && data.length > 0) {
                    setLatestMessage(data[0]);
                  }
                });

              // Update unread count
              supabase
                .from("messages")
                .select(
                  `
                  id,
                  from_admin,
                  message_read_status!left(id)
                `
                )
                .eq("user_id", currentUser.id)
                .eq("from_admin", true)
                .is("message_read_status.id", null)
                .then(({ data }) => {
                  setUnreadMessages(data?.length || 0);
                });
            }
          )
          .subscribe();

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
                `
                )
                .eq("user_id", currentUser.id)
                .eq("from_admin", true)
                .is("message_read_status.id", null)
                .then(({ data }) => {
                  setUnreadMessages(data?.length || 0);
                });
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(balancesChannel);
          supabase.removeChannel(cryptoChannel);
          supabase.removeChannel(transactionsChannel);
          supabase.removeChannel(messagesChannel);
          supabase.removeChannel(readStatusChannel);
        };
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Calculate REAL USD values using API exchange rates
  const totalFiatBalance = balances.reduce((sum, balance) => {
    const usdValue = convertCurrency(
      Number(balance.amount),
      balance.currency,
      "USD"
    );
    return sum + usdValue;
  }, 0);

  const totalCryptoValue = cryptoBalances.reduce((sum, crypto) => {
    const price = getCryptoPrice(crypto.crypto);
    return sum + Number(crypto.amount) * price;
  }, 0);

  const markMessageAsRead = async (messageId: string) => {
    if (!user) return;

    setMarkingAsRead(true);

    try {
      // Insert read status (will be ignored if already exists due to UNIQUE constraint)
      const { error } = await supabase.from("message_read_status").upsert(
        {
          user_id: user.id,
          message_id: messageId,
        },
        {
          onConflict: "user_id,message_id",
        }
      );

      if (error) throw error;

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: "Marked message as read",
      });
    } catch (error) {
      console.error("Error marking message as read:", error);
    } finally {
      setMarkingAsRead(false);
    }
  };

  const isMessageRead = async (messageId: string): Promise<boolean> => {
    if (!user) return false;

    const { data } = await supabase
      .from("message_read_status")
      .select("id")
      .eq("user_id", user.id)
      .eq("message_id", messageId)
      .single();

    return !!data;
  };

  return (
    <DashboardLayout currentSection="dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}</p>
        </div>

        {/* Individual Currency Cards */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Primary Currency Balances
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {["USD", "EUR", "GBP"].map((currency) => {
              const balance = balances.find((b) => b.currency === currency);
              const amount = balance ? Number(balance.amount) : 0;
              const usdValue = balance
                ? convertCurrency(
                    Number(balance.amount),
                    balance.currency,
                    "USD"
                  )
                : 0;

              return (
                <Card
                  key={currency}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium">
                      {currency}
                    </CardTitle>
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border-2 border-gray-200 overflow-hidden">
                      <CurrencyIcon currency={currency} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      ≈ $
                      {convertCurrency(amount, currency, "USD").toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                        }
                      )}{" "}
                      USD
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Rate: 1 USD = {getCurrencyRate(currency).toFixed(4)}{" "}
                      {currency}
                    </p>
                    {amount === 0 && (
                      <p className="text-xs text-amber-600 mt-1 font-medium">
                        No balance - Add funds in Deposits
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {balances.length > 3 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                View all {balances.length} currency balances in the{" "}
                <a
                  href="/dashboard/balances"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Balances section
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Individual Crypto Cards */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Primary Cryptocurrency Holdings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {["BTC", "ETH", "USDT"].map((cryptoSymbol) => {
              const crypto = cryptoBalances.find(
                (c) => c.crypto === cryptoSymbol
              );
              const amount = crypto ? Number(crypto.amount) : 0;
              const price = getCryptoPrice(cryptoSymbol);
              const usdValue = amount * price;

              return (
                <Card
                  key={cryptoSymbol}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium">
                      {cryptoSymbol}
                    </CardTitle>
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border-2 border-gray-200 overflow-hidden">
                      <CryptoIcon crypto={cryptoSymbol} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {amount.toLocaleString("en-US", {
                        minimumFractionDigits: 8,
                        maximumFractionDigits: 8,
                      })}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      ≈ $
                      {usdValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      USD
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      $
                      {getCryptoPrice(cryptoSymbol).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      per {cryptoSymbol}
                    </p>
                    {amount === 0 && (
                      <p className="text-xs text-amber-600 mt-1 font-medium">
                        No holdings - Add crypto in Admin Panel
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {cryptoBalances.length > 3 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                View all {cryptoBalances.length} cryptocurrency holdings in the{" "}
                <a
                  href="/dashboard/crypto"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Crypto section
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Messages and Transactions Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latest Message Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Latest Message</CardTitle>
              </div>
              {unreadMessages > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {unreadMessages} unread
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ) : latestMessage ? (
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {latestMessage.from_admin ? (
                        <Mail className="h-4 w-4 text-blue-600" />
                      ) : (
                        <MailOpen className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {latestMessage.from_admin ? "Support Team" : "You"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(
                            latestMessage.created_at
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {latestMessage.message.length > 100
                          ? `${latestMessage.message.substring(0, 100)}...`
                          : latestMessage.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <a
                      href="/dashboard/messages"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View all messages
                    </a>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      {latestMessage.from_admin ? (
                        <span className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          Unread
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <MailOpen className="h-3 w-3 mr-1" />
                          Sent
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-2">No messages yet</p>
                  <a
                    href="/dashboard/messages"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Start a conversation
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center space-x-2">
                <ArrowUpDown className="h-5 w-5 text-green-600" />
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>Your latest financial activity</CardDescription>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex justify-between">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </div>
                  ))}
                </div>
              ) : recentTransactions.length > 0 ? (
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex justify-between items-center"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {transaction.type}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(
                            transaction.created_at
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {transaction.amount} {transaction.currency}
                        </p>
                        <p className="text-xs text-gray-500">
                          {transaction.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <ArrowUpDown className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No transactions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
