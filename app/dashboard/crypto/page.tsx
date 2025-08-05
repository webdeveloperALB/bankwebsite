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
import { Plus, Bitcoin, TrendingUp, Coins, RefreshCw } from "lucide-react";
import { Database } from "@/lib/supabase";
import {
  getCryptoPrice,
  subscribeToRateUpdates,
  forceRateUpdate,
} from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type CryptoBalance = Database["public"]["Tables"]["crypto_balances"]["Row"];

const CRYPTOCURRENCIES = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "BNB", name: "Binance Coin" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "LTC", name: "Litecoin" },
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

  // Calculate total value in USD with current crypto prices
  const totalValue = cryptoBalances.reduce((sum, crypto) => {
    const price = getCryptoPrice(crypto.crypto);
    const value = Number(crypto.amount) * price;
    console.log(
      `🪙 ${crypto.crypto}: ${crypto.amount} × $${price} = $${value.toFixed(2)}`
    );
    return sum + value;
  }, 0);

  console.log(`🪙 Total crypto portfolio value: $${totalValue.toFixed(2)}`);

  return (
    <DashboardLayout currentSection="crypto">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Crypto Portfolio
            </h1>
            <p className="text-gray-600">
              Manage your cryptocurrency holdings with live prices
            </p>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                forceRateUpdate();
                forceRerender();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh REAL Prices
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Crypto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Cryptocurrency</DialogTitle>
                  <DialogDescription>
                    Add cryptocurrency to your portfolio
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddCrypto} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="crypto">Cryptocurrency</Label>
                    <Select value={newCrypto} onValueChange={setNewCrypto}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select cryptocurrency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CRYPTOCURRENCIES.map((crypto) => (
                          <SelectItem key={crypto.symbol} value={crypto.symbol}>
                            {crypto.symbol} - {crypto.name} ($
                            {getCryptoPrice(crypto.symbol).toLocaleString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.00000001"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="0.00000000"
                      required
                    />
                    {newAmount && newCrypto && (
                      <p className="text-sm text-gray-600">
                        ≈ $
                        {(
                          Number(newAmount) * getCryptoPrice(newCrypto)
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        USD
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={addingCrypto}
                  >
                    {addingCrypto ? "Adding..." : "Add Crypto"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Individual Crypto Holdings Cards */}
        {cryptoBalances.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Your Cryptocurrency Portfolio
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cryptoBalances.map((crypto) => {
                const price = getCryptoPrice(crypto.crypto);
                const value = Number(crypto.amount) * price;
                const cryptoName =
                  CRYPTOCURRENCIES.find((c) => c.symbol === crypto.crypto)
                    ?.name || crypto.crypto;

                return (
                  <Card
                    key={crypto.id}
                    className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                            <Bitcoin className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">
                              {crypto.crypto}
                            </CardTitle>
                            <p className="text-sm text-gray-500">
                              {cryptoName}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {Number(crypto.amount).toLocaleString("en-US", {
                              minimumFractionDigits: 8,
                              maximumFractionDigits: 8,
                            })}
                          </p>
                          <p className="text-sm text-gray-500">
                            {crypto.crypto}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-lg font-semibold text-green-600">
                            $
                            {value.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-xs text-gray-500">USD value</p>
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Current Price:</span>
                            <br />$
                            {price.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Updated{" "}
                            {new Date(crypto.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Crypto Prices */}
        <Card>
          <CardHeader>
            <CardTitle>Current Crypto Prices</CardTitle>
            <CardDescription>
              REAL prices from CoinGecko API updated every 2 minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {CRYPTOCURRENCIES.map((crypto) => (
                <div key={crypto.symbol} className="p-3 border rounded-lg">
                  <div className="font-medium">{crypto.symbol}</div>
                  <div className="text-sm text-gray-600">
                    $
                    {getCryptoPrice(crypto.symbol).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
