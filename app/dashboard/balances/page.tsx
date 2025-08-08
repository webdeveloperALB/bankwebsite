"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, RefreshCw, Wallet, Globe } from "lucide-react";
import { Database } from "@/lib/supabase";
import {
  convertCurrency,
  subscribeToRateUpdates,
  getCurrencyRate,
  forceRateUpdate,
} from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type Balance = Database["public"]["Tables"]["balances"]["Row"];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF"];

const CURRENCY_FLAGS = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  JPY: "🇯🇵",
  CHF: "🇨🇭",
};

export default function BalancesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addingBalance, setAddingBalance] = useState(false);
  const [newCurrency, setNewCurrency] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Force re-render when exchange rates change
  const forceRerender = () => {
    setRefreshKey((prev) => prev + 1);
    console.log("🔄 Forcing UI re-render due to rate changes");
  };

  useEffect(() => {
    let exchangeRateUnsubscribe: (() => void) | null = null;
    let supabaseChannel: any = null;

    const loadData = async () => {
      try {
        console.log("📊 Loading balances data...");

        // Subscribe to real-time exchange rate updates
        exchangeRateUnsubscribe = subscribeToRateUpdates(forceRerender);
        console.log("📡 Subscribed to exchange rate updates");

        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUser(currentUser);

        // Load balances
        const { data: balancesData } = await supabase
          .from("balances")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("currency");

        console.log("💰 Loaded balances:", balancesData);
        setBalances(balancesData || []);

        // Set up real-time subscription for balance changes
        supabaseChannel = supabase
          .channel("balances")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "balances",
              filter: `user_id=eq.${currentUser.id}`,
            },
            (payload) => {
              console.log("🔄 Balance change detected:", payload);
              // Reload balances
              supabase
                .from("balances")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("currency")
                .then(({ data }) => {
                  console.log("💰 Reloaded balances:", data);
                  setBalances(data || []);
                });
            }
          )
          .subscribe();
      } catch (error) {
        console.error("❌ Error loading balances:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Cleanup function
    return () => {
      if (exchangeRateUnsubscribe) {
        exchangeRateUnsubscribe();
        console.log("📡 Unsubscribed from exchange rate updates");
      }
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
        console.log("📡 Removed Supabase channel");
      }
    };
  }, []);

  const handleAddBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCurrency || !newAmount) return;

    setAddingBalance(true);

    try {
      console.log(`💰 Adding ${newAmount} ${newCurrency} to balance`);

      // Check if currency already exists
      const existingBalance = balances.find((b) => b.currency === newCurrency);

      if (existingBalance) {
        // Update existing balance
        const newTotal = Number(existingBalance.amount) + Number(newAmount);
        console.log(
          `💰 Updating existing ${newCurrency} balance: ${existingBalance.amount} + ${newAmount} = ${newTotal}`
        );

        const { error } = await supabase
          .from("balances")
          .update({
            amount: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingBalance.id);

        if (error) throw error;
      } else {
        // Create new balance
        console.log(`💰 Creating new ${newCurrency} balance: ${newAmount}`);

        const { error } = await supabase.from("balances").insert({
          user_id: user.id,
          currency: newCurrency,
          amount: Number(newAmount),
        });

        if (error) throw error;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: `Added ${newAmount} ${newCurrency} to balance`,
      });

      setNewCurrency("");
      setNewAmount("");
      setDialogOpen(false);

      // Force rate update to ensure fresh calculations
      forceRateUpdate();
    } catch (error) {
      console.error("❌ Error adding balance:", error);
    } finally {
      setAddingBalance(false);
    }
  };

  return (
    <DashboardLayout currentSection="balances">
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
        {/* Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#F26623] via-[#E55A1F] to-[#D94E1A] rounded-2xl p-6 sm:p-8 mb-8 shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>

          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                  <Wallet className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                    Currency Balances
                  </h1>
                  <p className="text-orange-100 text-sm sm:text-base lg:text-lg font-medium">
                    Multi-currency portfolio with live exchange rates
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    forceRateUpdate();
                    forceRerender();
                  }}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white backdrop-blur-sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Refresh Rates</span>
                  <span className="sm:hidden">Refresh</span>
                </Button>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-white text-[#F26623] hover:bg-gray-100 font-semibold shadow-lg">
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Add Balance</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-[#F26623] text-xl font-bold">
                        Add Currency Balance
                      </DialogTitle>
                      <DialogDescription className="text-gray-600">
                        Add funds to your account in any supported currency
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddBalance} className="space-y-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="currency"
                          className="text-gray-700 font-semibold"
                        >
                          Currency
                        </Label>
                        <Select
                          value={newCurrency}
                          onValueChange={setNewCurrency}
                        >
                          <SelectTrigger className="border-[#F26623]/30 focus:border-[#F26623] focus:ring-[#F26623]/20">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((currency) => (
                              <SelectItem key={currency} value={currency}>
                                <div className="flex items-center space-x-2">
                                  <span>
                                    {
                                      CURRENCY_FLAGS[
                                        currency as keyof typeof CURRENCY_FLAGS
                                      ]
                                    }
                                  </span>
                                  <span>{currency}</span>
                                  <span className="text-gray-500 text-sm">
                                    (Rate:{" "}
                                    {getCurrencyRate(currency).toFixed(4)})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="amount"
                          className="text-gray-700 font-semibold"
                        >
                          Amount
                        </Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={newAmount}
                          onChange={(e) => setNewAmount(e.target.value)}
                          placeholder="0.00"
                          required
                          className="border-[#F26623]/30 focus:border-[#F26623] focus:ring-[#F26623]/20"
                        />
                        {newAmount && newCurrency && newCurrency !== "USD" && (
                          <div className="bg-[#F26623]/5 border border-[#F26623]/20 rounded-lg p-3">
                            <p className="text-sm text-[#F26623] font-semibold">
                              ≈ $
                              {convertCurrency(
                                Number(newAmount),
                                newCurrency,
                                "USD"
                              ).toFixed(2)}{" "}
                              USD
                            </p>
                          </div>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D94E1A] text-white font-semibold py-3"
                        disabled={addingBalance}
                      >
                        {addingBalance ? "Adding..." : "Add Balance"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>

        {/* Individual Currency Balance Cards */}
        {balances.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  Your Currency Holdings
                </h2>
                <div className="w-24 h-1 bg-gradient-to-r from-[#F26623] to-[#E55A1F] rounded-full"></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {balances.map((balance) => {
                const usdValue = convertCurrency(
                  Number(balance.amount),
                  balance.currency,
                  "USD"
                );
                const rate = getCurrencyRate(balance.currency);

                return (
                  <Card
                    key={balance.id}
                    className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

                    <div className="relative p-4 sm:p-6">
                      <CardHeader className="p-0 mb-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-3 shadow-lg">
                            <span className="text-white font-bold text-lg">
                              {
                                CURRENCY_FLAGS[
                                  balance.currency as keyof typeof CURRENCY_FLAGS
                                ]
                              }
                            </span>
                          </div>
                          <div className="text-right">
                            <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">
                              {balance.currency}
                            </CardTitle>
                            <p className="text-[#F26623] font-semibold text-sm">
                              Currency
                            </p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-0 space-y-4">
                        <div>
                          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                            {Number(balance.amount).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-gray-600 font-medium">
                            {balance.currency}
                          </p>
                        </div>

                        <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white px-4 py-2 rounded-full">
                          <span className="text-sm font-semibold">
                            ≈ $
                            {usdValue.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            USD
                          </span>
                        </div>

                        <div className="bg-[#F26623]/5 rounded-xl p-4 border border-[#F26623]/20">
                          <p className="text-sm text-gray-600 mb-1">
                            Exchange Rate
                          </p>
                          <p className="text-[#F26623] font-bold text-sm">
                            1 USD = {rate.toFixed(4)} {balance.currency}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            Updated{" "}
                            {new Date(balance.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Exchange Rates */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
          <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 rounded-full p-3">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  Current Exchange Rates
                </h3>
                <p className="text-orange-100">
                  Live rates updated every 2 minutes (1 USD = X)
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {CURRENCIES.filter((c) => c !== "USD").map((currency) => (
                <div
                  key={currency}
                  className="bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10 border-2 border-[#F26623]/20 rounded-xl p-4 hover:border-[#F26623]/40 transition-all duration-300"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">
                      {CURRENCY_FLAGS[currency as keyof typeof CURRENCY_FLAGS]}
                    </span>
                    <div className="font-bold text-gray-900">{currency}</div>
                  </div>
                  <div className="text-[#F26623] font-bold text-lg">
                    {getCurrencyRate(currency).toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">per USD</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Empty State */}
        {balances.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="bg-gradient-to-br from-[#F26623]/10 to-[#E55A1F]/20 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-8">
              <Wallet className="h-16 w-16 text-[#F26623]" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              No Currency Balances Yet
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start building your multi-currency portfolio by adding your first
              balance
            </p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D94E1A] text-white font-semibold px-8 py-4 text-lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Add Your First Balance
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
