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
import {
  Plus,
  Bitcoin,
  TrendingUp,
  Coins,
  RefreshCw,
  BarChart3,
  PieChart,
  Shield,
  Globe,
} from "lucide-react";
import { Database } from "@/lib/supabase";
import {
  getCryptoPrice,
  subscribeToRateUpdates,
  forceRateUpdate,
} from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type CryptoBalance = Database["public"]["Tables"]["crypto_balances"]["Row"];

const CRYPTOCURRENCIES = [
  { symbol: "BTC", name: "Bitcoin", icon: "₿" },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ" },
  { symbol: "USDT", name: "Tether", icon: "₮" },
  { symbol: "BNB", name: "Binance Coin", icon: "BNB" },
  { symbol: "ADA", name: "Cardano", icon: "₳" },
  { symbol: "DOT", name: "Polkadot", icon: "●" },
  { symbol: "LINK", name: "Chainlink", icon: "⬢" },
  { symbol: "LTC", name: "Litecoin", icon: "Ł" },
];

export default function CryptoPage() {
  const [user, setUser] = useState<User | null>(null);
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addingCrypto, setAddingCrypto] = useState(false);
  const [newCrypto, setNewCrypto] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Force re-render when crypto prices change
  const forceRerender = () => {
    setRefreshKey((prev) => prev + 1);
    console.log("🔄 Forcing crypto UI re-render due to price changes");
  };

  useEffect(() => {
    let exchangeRateUnsubscribe: (() => void) | null = null;
    let supabaseChannel: any = null;

    const loadData = async () => {
      try {
        console.log("🪙 Loading crypto data...");

        // Subscribe to real-time crypto price updates
        exchangeRateUnsubscribe = subscribeToRateUpdates(forceRerender);
        console.log("📡 Subscribed to crypto price updates");

        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUser(currentUser);

        // Load crypto balances
        const { data: cryptoData } = await supabase
          .from("crypto_balances")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("crypto");

        console.log("🪙 Loaded crypto balances:", cryptoData);
        setCryptoBalances(cryptoData || []);

        // Set up real-time subscription for crypto balance changes
        supabaseChannel = supabase
          .channel("crypto_balances")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "crypto_balances",
              filter: `user_id=eq.${currentUser.id}`,
            },
            (payload) => {
              console.log("🔄 Crypto balance change detected:", payload);
              // Reload crypto balances
              supabase
                .from("crypto_balances")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("crypto")
                .then(({ data }) => {
                  console.log("🪙 Reloaded crypto balances:", data);
                  setCryptoBalances(data || []);
                });
            }
          )
          .subscribe();
      } catch (error) {
        console.error("❌ Error loading crypto balances:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Cleanup function
    return () => {
      if (exchangeRateUnsubscribe) {
        exchangeRateUnsubscribe();
        console.log("📡 Unsubscribed from crypto price updates");
      }
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
        console.log("📡 Removed crypto Supabase channel");
      }
    };
  }, []);

  const handleAddCrypto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCrypto || !newAmount) return;

    setAddingCrypto(true);

    try {
      console.log(`🪙 Adding ${newAmount} ${newCrypto} to portfolio`);

      // Check if crypto already exists
      const existingCrypto = cryptoBalances.find((c) => c.crypto === newCrypto);

      if (existingCrypto) {
        // Update existing balance
        const newTotal = Number(existingCrypto.amount) + Number(newAmount);
        console.log(
          `🪙 Updating existing ${newCrypto} balance: ${existingCrypto.amount} + ${newAmount} = ${newTotal}`
        );

        const { error } = await supabase
          .from("crypto_balances")
          .update({
            amount: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCrypto.id);

        if (error) throw error;
      } else {
        // Create new crypto balance
        console.log(`🪙 Creating new ${newCrypto} balance: ${newAmount}`);

        const { error } = await supabase.from("crypto_balances").insert({
          user_id: user.id,
          crypto: newCrypto,
          amount: Number(newAmount),
        });

        if (error) throw error;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: `Added ${newAmount} ${newCrypto} to crypto portfolio`,
      });

      setNewCrypto("");
      setNewAmount("");
      setDialogOpen(false);

      // Force price update to ensure fresh calculations
      forceRateUpdate();
    } catch (error) {
      console.error("❌ Error adding crypto:", error);
    } finally {
      setAddingCrypto(false);
    }
  };

  return (
    <DashboardLayout currentSection="crypto">
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
        {/* Hero Header - Professional Banking Style */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#F26623] via-[#E55A1F] to-[#D94E1A] rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 right-0 w-32 sm:w-48 md:w-64 h-32 sm:h-48 md:h-64 bg-white/10 rounded-full -translate-y-16 sm:-translate-y-24 md:-translate-y-32 translate-x-16 sm:translate-x-24 md:translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-24 sm:w-36 md:w-48 h-24 sm:h-36 md:h-48 bg-white/5 rounded-full translate-y-12 sm:translate-y-18 md:translate-y-24 -translate-x-12 sm:-translate-x-18 md:-translate-x-24"></div>

          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6 mb-6">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 sm:p-4">
                  <Bitcoin className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                    Digital Assets Portfolio
                  </h1>
                  <p className="text-xs sm:text-base lg:text-lg font-medium">
                    <span className="hidden sm:inline">
                      Professional cryptocurrency management with real-time
                      market data
                    </span>
                    <span className="sm:hidden">
                      Crypto portfolio management
                    </span>
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
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white backdrop-blur-sm font-semibold"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Refresh Prices</span>
                  <span className="sm:hidden">Refresh</span>
                </Button>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <form onSubmit={handleAddCrypto} className="space-y-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="crypto"
                          className="text-gray-700 font-semibold"
                        >
                          Digital Asset
                        </Label>
                        <Select value={newCrypto} onValueChange={setNewCrypto}>
                          <SelectTrigger className="border-[#F26623]/30 focus:border-[#F26623] focus:ring-[#F26623]/20">
                            <SelectValue placeholder="Select digital asset" />
                          </SelectTrigger>
                          <SelectContent>
                            {CRYPTOCURRENCIES.map((crypto) => (
                              <SelectItem
                                key={crypto.symbol}
                                value={crypto.symbol}
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="text-lg font-bold text-[#F26623]">
                                    {crypto.icon}
                                  </span>
                                  <div>
                                    <span className="font-semibold">
                                      {crypto.symbol}
                                    </span>
                                    <span className="text-gray-500 ml-2">
                                      {crypto.name}
                                    </span>
                                  </div>
                                  <span className="text-sm text-gray-500 ml-auto">
                                    $
                                    {getCryptoPrice(
                                      crypto.symbol
                                    ).toLocaleString()}
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
                          step="0.00000001"
                          value={newAmount}
                          onChange={(e) => setNewAmount(e.target.value)}
                          placeholder="0.00000000"
                          required
                          className="border-[#F26623]/30 focus:border-[#F26623] focus:ring-[#F26623]/20"
                        />
                        {newAmount && newCrypto && (
                          <div className="bg-[#F26623]/5 border border-[#F26623]/20 rounded-lg p-3">
                            <p className="text-sm text-[#F26623] font-semibold">
                              ≈ $
                              {(
                                Number(newAmount) * getCryptoPrice(newCrypto)
                              ).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              USD
                            </p>
                          </div>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D94E1A] text-white font-semibold py-3"
                        disabled={addingCrypto}
                      >
                        {addingCrypto ? "Adding Asset..." : "Add to Portfolio"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Portfolio Summary - Professional Stats */}
            {cryptoBalances.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 rounded-full p-2">
                      <PieChart className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white/80 text-sm font-medium">
                        Active Assets
                      </p>
                      <p className="text-white text-lg sm:text-2xl font-bold">
                        {cryptoBalances.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 rounded-full p-2">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white/80 text-sm font-medium">
                        Market Status
                      </p>
                      <p className="text-white text-lg sm:text-2xl font-bold">
                        Live
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 rounded-full p-2">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white/80 text-sm font-medium">
                        Security Level
                      </p>
                      <p className="text-white text-lg sm:text-2xl font-bold">
                        Bank Grade
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Individual Crypto Holdings Cards - Professional Design */}
        {cryptoBalances.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">
                  Your Digital Asset Holdings
                </h2>
                <div className="w-24 h-1 bg-gradient-to-r from-[#F26623] to-[#E55A1F] rounded-full"></div>
              </div>
              <div className="bg-[#F26623] text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                {cryptoBalances.length} Active{" "}
                {cryptoBalances.length === 1 ? "Asset" : "Assets"}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {cryptoBalances.map((crypto) => {
                const price = getCryptoPrice(crypto.crypto);
                const value = Number(crypto.amount) * price;
                const cryptoInfo = CRYPTOCURRENCIES.find(
                  (c) => c.symbol === crypto.crypto
                );
                const cryptoName = cryptoInfo?.name || crypto.crypto;
                const cryptoIcon = cryptoInfo?.icon || "₿";

                return (
                  <Card
                    key={crypto.id}
                    className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

                    <div className="relative p-6">
                      <CardHeader className="p-0 mb-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-4 shadow-lg">
                            <span className="text-white font-bold text-2xl">
                              {cryptoIcon}
                            </span>
                          </div>
                          <div className="text-right">
                            <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">
                              {crypto.crypto}
                            </CardTitle>
                            <p className="text-[#F26623] font-semibold text-sm">
                              {cryptoName}
                            </p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-0 space-y-4">
                        <div>
                          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                            {Number(crypto.amount).toLocaleString("en-US", {
                              minimumFractionDigits: 8,
                              maximumFractionDigits: 8,
                            })}
                          </p>
                          <p className="text-gray-600 font-medium">
                            {crypto.crypto}
                          </p>
                        </div>

                        <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white px-4 py-3 rounded-full">
                          <span className="text-sm font-semibold">
                            ≈ $
                            {value.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            USD
                          </span>
                        </div>

                        <div className="bg-[#F26623]/5 rounded-xl p-4 border border-[#F26623]/20">
                          <p className="text-sm text-gray-600 mb-1">
                            Current Market Price
                          </p>
                          <p className="text-base sm:text-lg text-[#F26623] font-bold">
                            $
                            {price.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-xs text-gray-400 mt-2 flex items-center">
                            <Globe className="h-3 w-3 mr-1" />
                            Live market data
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#F26623]/10">
                          <p className="text-xs text-gray-500">
                            Last updated:{" "}
                            {new Date(crypto.updated_at).toLocaleDateString()}
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

        {/* Current Crypto Prices - Professional Market Data */}
        <Card className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
          <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 rounded-full p-3">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-2xl font-bold text-white">
                  Live Market Prices
                </CardTitle>
                <CardDescription className="text-orange-100">
                  <span className="hidden sm:inline">
                    Real-time cryptocurrency prices updated every 2 minutes
                  </span>
                  <span className="sm:hidden">Live crypto prices</span>
                </CardDescription>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CRYPTOCURRENCIES.map((crypto) => {
                const price = getCryptoPrice(crypto.symbol);
                return (
                  <div
                    key={crypto.symbol}
                    className="bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10 border-2 border-[#F26623]/20 rounded-xl p-4 hover:border-[#F26623]/40 transition-all duration-300"
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-full w-10 h-10 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {crypto.icon}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">
                          {crypto.symbol}
                        </div>
                        <div className="text-xs text-gray-500">
                          {crypto.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl text-[#F26623] font-bold">
                      $
                      {price.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      Live price
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Empty State - Professional Banking Style */}
        {cryptoBalances.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="bg-gradient-to-br from-[#F26623]/10 to-[#E55A1F]/20 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-8">
              <Bitcoin className="h-16 w-16 text-[#F26623]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
              Start Your Digital Asset Journey
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Build a diversified cryptocurrency portfolio with
              institutional-grade security and real-time market data
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
