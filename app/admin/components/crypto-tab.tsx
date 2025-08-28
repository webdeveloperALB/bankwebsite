"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
  Bitcoin,
  Plus,
  Trash2,
  Coins,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import type { Database } from "@/lib/supabase";
import {
  exchangeRateManager,
  getCryptoPrice,
  subscribeToRateUpdates,
} from "@/lib/exchange-rates";
import { Alert, AlertDescription } from "@/components/ui/alert";

type User = Database["public"]["Tables"]["users"]["Row"];
type CryptoBalance = Database["public"]["Tables"]["crypto_balances"]["Row"] & {
  users?: { name: string; email: string };
};

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

export default function CryptoTab() {
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [cryptoPrices, setCryptoPrices] = useState<{ [key: string]: number }>(
    {}
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCrypto, setEditingCrypto] = useState<CryptoBalance | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedUser, setSelectedUser] = useState("");
  const [crypto, setCrypto] = useState("");
  const [amount, setAmount] = useState("");
  const [operation, setOperation] = useState("set"); // set, add, deduct

  // User search state
  const [userSearch, setUserSearch] = useState("");

  // Filter users based on search
  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Force re-render when REAL crypto prices change from APIs
  const forceRerender = () => {
    setRefreshKey((prev: number) => prev + 1);
    console.log(
      "🔄 Admin crypto forcing UI re-render due to REAL API price changes"
    );
  };

  useEffect(() => {
    // Subscribe to REAL-TIME crypto price updates from APIs
    const unsubscribe = subscribeToRateUpdates(forceRerender);

    // Get initial REAL prices from APIs
    setCryptoPrices(exchangeRateManager.getAllCryptoPrices());

    const loadData = async () => {
      try {
        // Load crypto balances with user info
        const { data: cryptoData, error: cryptoError } = await supabase
          .from("crypto_balances")
          .select(
            `
            *,
            users!inner(name, email)
          `
          )
          .order("updated_at", { ascending: false });

        if (cryptoError) {
          console.error("Error loading crypto balances:", cryptoError);
          setError("Failed to load crypto balances");
        }

        // Load users
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("*")
          .neq("role", "admin")
          .order("name");

        if (usersError) {
          console.error("Error loading users:", usersError);
          setError("Failed to load users");
        }

        setCryptoBalances(cryptoData || []);
        setUsers(usersData || []);
        setLoading(false);
      } catch (error) {
        console.error("Error in loadData:", error);
        setError("Failed to load data");
        setLoading(false);
      }
    };

    loadData();

    // Real-time subscription
    const channel = supabase
      .channel("admin_crypto")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crypto_balances" },
        (payload) => {
          console.log("Real-time crypto balance change:", payload);
          loadData(); // Reload all data to ensure consistency
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !crypto || !amount) return;

    setSubmitting(true);
    setError(null);

    try {
      const numAmount = Number.parseFloat(amount);

      if (isNaN(numAmount) || numAmount < 0) {
        throw new Error("Please enter a valid positive number");
      }

      console.log(
        `🔄 Processing ${operation} operation for ${crypto}: ${numAmount}`
      );

      // Find existing crypto balance with explicit matching
      const existingCrypto = cryptoBalances.find(
        (c) => c.user_id === selectedUser && c.crypto === crypto
      );

      console.log("Existing crypto found:", existingCrypto);

      let finalAmount = numAmount;
      if (existingCrypto && operation !== "set") {
        const currentAmount = Number(existingCrypto.amount);
        if (operation === "add") {
          finalAmount = currentAmount + numAmount;
        } else if (operation === "deduct") {
          finalAmount = Math.max(0, currentAmount - numAmount);
        }
      }

      console.log(`Final amount will be: ${finalAmount}`);

      if (existingCrypto) {
        // Update existing crypto balance
        console.log(
          `Updating existing crypto balance ID: ${existingCrypto.id}`
        );

        const { data, error } = await supabase
          .from("crypto_balances")
          .update({
            amount: finalAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCrypto.id)
          .eq("user_id", selectedUser) // Double check to prevent wrong updates
          .eq("crypto", crypto)
          .select();

        if (error) {
          console.error("Update error:", error);
          throw error;
        }

        console.log("Update successful:", data);
      } else {
        // Create new crypto balance only if none exists
        console.log(`Creating new crypto balance for user ${selectedUser}`);

        // Double-check no existing record exists before creating
        const { data: doubleCheck } = await supabase
          .from("crypto_balances")
          .select("id")
          .eq("user_id", selectedUser)
          .eq("crypto", crypto)
          .single();

        if (doubleCheck) {
          throw new Error(
            "A balance for this cryptocurrency already exists. Please refresh and try again."
          );
        }

        const { data, error } = await supabase
          .from("crypto_balances")
          .insert({
            user_id: selectedUser,
            crypto: crypto,
            amount: finalAmount,
          })
          .select();

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }

        console.log("Insert successful:", data);
      }

      // Log activity
      const operationText =
        operation === "set"
          ? "set to"
          : operation === "add"
          ? "increased by"
          : "decreased by";
      await supabase.from("activity_logs").insert({
        user_id: selectedUser,
        activity: `Admin ${operationText} ${crypto} balance: ${numAmount}`,
      });

      resetForm();
    } catch (error) {
      console.error("Error updating crypto balance:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update crypto balance"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCrypto = async (cryptoBalance: CryptoBalance) => {
    if (!confirm(`Delete ${cryptoBalance.crypto} balance for this user?`))
      return;

    try {
      const { error } = await supabase
        .from("crypto_balances")
        .delete()
        .eq("id", cryptoBalance.id);

      if (error) {
        console.error("Error deleting crypto balance:", error);
        setError("Failed to delete crypto balance");
      } else {
        // Log activity
        await supabase.from("activity_logs").insert({
          user_id: cryptoBalance.user_id,
          activity: `Admin deleted ${cryptoBalance.crypto} balance`,
        });
      }
    } catch (error) {
      console.error("Error in deleteCrypto:", error);
      setError("Failed to delete crypto balance");
    }
  };

  const resetForm = () => {
    setSelectedUser("");
    setCrypto("");
    setAmount("");
    setOperation("set");
    setEditingCrypto(null);
    setDialogOpen(false);
    setError(null);
    setUserSearch("");
  };

  const totalValue = cryptoBalances.reduce((sum, crypto) => {
    const price = getCryptoPrice(crypto.crypto);
    return sum + Number(crypto.amount) * price;
  }, 0);

  // Get current balance for selected user and crypto
  const getCurrentBalance = () => {
    if (!selectedUser || !crypto) return null;
    const existing = cryptoBalances.find(
      (c) => c.user_id === selectedUser && c.crypto === crypto
    );
    return existing ? Number(existing.amount) : 0;
  };

  const currentBalance = getCurrentBalance();

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Crypto Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Manage user cryptocurrency holdings
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => resetForm()}
              className="bg-[#F26623] hover:bg-[#E55A1F] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Manage Crypto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Crypto Balance</DialogTitle>
              <DialogDescription>
                Set, add, or deduct from user crypto holdings
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Search User</Label>
                <Input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cryptocurrency</Label>
                <Select value={crypto} onValueChange={setCrypto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cryptocurrency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRYPTOCURRENCIES.map((c) => (
                      <SelectItem key={c.symbol} value={c.symbol}>
                        {c.symbol} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentBalance !== null && selectedUser && crypto && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Current Balance:</strong>{" "}
                    {currentBalance.toLocaleString("en-US", {
                      minimumFractionDigits: 8,
                      maximumFractionDigits: 8,
                    })}{" "}
                    {crypto}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Operation</Label>
                <Select value={operation} onValueChange={setOperation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">Set Exact Amount</SelectItem>
                    <SelectItem value="add">Add to Balance</SelectItem>
                    <SelectItem value="deduct">Deduct from Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.00000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00000000"
                  required
                />
                {amount && currentBalance !== null && operation !== "set" && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-sm text-gray-700">
                      <strong>Result:</strong>{" "}
                      {operation === "add"
                        ? (currentBalance + Number(amount)).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 8,
                              maximumFractionDigits: 8,
                            }
                          )
                        : Math.max(
                            0,
                            currentBalance - Number(amount)
                          ).toLocaleString("en-US", {
                            minimumFractionDigits: 8,
                            maximumFractionDigits: 8,
                          })}{" "}
                      {crypto}
                    </p>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#F26623] hover:bg-[#E55A1F] text-white"
                disabled={submitting}
              >
                {submitting
                  ? "Processing..."
                  : operation === "set"
                  ? "Set Balance"
                  : operation === "add"
                  ? "Add to Balance"
                  : "Deduct from Balance"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Crypto Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
        <Card className="border-l-4 border-l-[#F26623]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Total Holdings
            </CardTitle>
            <Bitcoin className="h-4 w-4 text-[#F26623]" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-900">
              {cryptoBalances.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#F26623]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Total Value (USD)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-[#F26623]" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-900">
              $
              {totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#F26623]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Cryptocurrencies
            </CardTitle>
            <Coins className="h-4 w-4 text-[#F26623]" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-900">
              {new Set(cryptoBalances.map((c) => c.crypto)).size}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#F26623]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Active Users
            </CardTitle>
            <Bitcoin className="h-4 w-4 text-[#F26623]" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-900">
              {new Set(cryptoBalances.map((c) => c.user_id)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Crypto Holdings List */}
      <Card className="shadow-sm border-t-4 border-t-[#F26623]">
        <CardHeader className="bg-gray-50 border-b">
          <CardTitle className="text-lg sm:text-xl text-gray-900">
            All Crypto Holdings
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Complete overview of all user crypto balances
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-4 p-4 sm:p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse p-4 border rounded-lg">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : cryptoBalances.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {cryptoBalances.map((cryptoBalance) => {
                const price = getCryptoPrice(cryptoBalance.crypto);
                const value = Number(cryptoBalance.amount) * price;

                return (
                  <div
                    key={cryptoBalance.id}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 sm:p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {cryptoBalance.users?.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        {cryptoBalance.users?.email}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs sm:text-sm font-medium text-gray-800">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#F26623] bg-opacity-10 text-[#F26623] mr-2">
                            {cryptoBalance.crypto}
                          </span>
                          {Number(cryptoBalance.amount).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 8,
                              maximumFractionDigits: 8,
                            }
                          )}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs text-gray-500 space-y-1 sm:space-y-0">
                          <span>
                            Value:{" "}
                            <span className="font-medium text-gray-700">
                              $
                              {value.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </span>
                          <span>
                            Price:{" "}
                            <span className="font-medium text-gray-700">
                              $
                              {price.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </span>
                          <span>
                            Updated{" "}
                            {new Date(
                              cryptoBalance.updated_at
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end mt-3 sm:mt-0 sm:ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCrypto(cryptoBalance)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Bitcoin className="h-12 w-12 text-[#F26623] mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                No crypto holdings yet
              </h3>
              <p className="text-sm sm:text-base text-gray-500">
                User crypto balances will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
