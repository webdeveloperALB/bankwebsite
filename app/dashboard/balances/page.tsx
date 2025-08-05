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
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { Database } from "@/lib/supabase";
import {
  convertCurrency,
  subscribeToRateUpdates,
  getCurrencyRate,
  forceRateUpdate,
} from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type Balance = Database["public"]["Tables"]["balances"]["Row"];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY"];

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

  // Calculate total value in USD with current exchange rates
  const totalValue = balances.reduce((sum, balance) => {
    const usdAmount = convertCurrency(
      Number(balance.amount),
      balance.currency,
      "USD"
    );
    console.log(
      `💱 Converting ${balance.amount} ${
        balance.currency
      } to USD: ${usdAmount.toFixed(2)}`
    );
    return sum + usdAmount;
  }, 0);

  console.log(`💰 Total portfolio value: $${totalValue.toFixed(2)}`);

  return (
    <DashboardLayout currentSection="balances">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Currency Balances
            </h1>
            <p className="text-gray-600">
              Manage your multi-currency holdings with live exchange rates
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
              Refresh REAL Rates
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Balance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Currency Balance</DialogTitle>
                  <DialogDescription>
                    Add funds to your account in any supported currency
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddBalance} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={newCurrency} onValueChange={setNewCurrency}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency} (Rate:{" "}
                            {getCurrencyRate(currency).toFixed(4)})
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
                      step="0.01"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                    {newAmount && newCurrency && newCurrency !== "USD" && (
                      <p className="text-sm text-gray-600">
                        ≈ $
                        {convertCurrency(
                          Number(newAmount),
                          newCurrency,
                          "USD"
                        ).toFixed(2)}{" "}
                        USD
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={addingBalance}
                  >
                    {addingBalance ? "Adding..." : "Add Balance"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Individual Currency Balance Cards */}
        {balances.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Your Currency Holdings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                    className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {balance.currency.substring(0, 2)}
                            </span>
                          </div>
                          <div>
                            <CardTitle className="text-xl">
                              {balance.currency}
                            </CardTitle>
                            <p className="text-sm text-gray-500">Currency</p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <p className="text-3xl font-bold text-gray-900">
                            {Number(balance.amount).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-sm text-gray-500">
                            {balance.currency}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-lg font-semibold text-green-600">
                            $
                            {usdValue.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-xs text-gray-500">
                            USD equivalent
                          </p>
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Exchange Rate:</span>
                            <br />1 USD = {rate.toFixed(4)} {balance.currency}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Updated{" "}
                            {new Date(balance.updated_at).toLocaleDateString()}
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

        {/* Current Exchange Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Current Exchange Rates</CardTitle>
            <CardDescription>
              REAL rates from ExchangeRate-API updated every 2 minutes (1 USD =
              X)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {CURRENCIES.filter((c) => c !== "USD").map((currency) => (
                <div key={currency} className="p-3 border rounded-lg">
                  <div className="font-medium">{currency}</div>
                  <div className="text-sm text-gray-600">
                    {getCurrencyRate(currency).toFixed(4)}
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
