"use client";

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
import { Bitcoin, Plus, Edit, Trash2, Coins, TrendingUp } from "lucide-react";
import { Database } from "@/lib/supabase";
import {
  exchangeRateManager,
  getCryptoPrice,
  subscribeToRateUpdates,
} from "@/lib/exchange-rates";

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

  // Form state
  const [selectedUser, setSelectedUser] = useState("");
  const [crypto, setCrypto] = useState("");
  const [amount, setAmount] = useState("");
  const [operation, setOperation] = useState("set"); // set, add, deduct

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
      // Load crypto balances with user info
      const { data: cryptoData } = await supabase
        .from("crypto_balances")
        .select(
          `
          *,
          users!inner(name, email)
        `
        )
        .order("updated_at", { ascending: false });

      // Load users
      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .neq("role", "admin")
        .order("name");

      setCryptoBalances(cryptoData || []);
      setUsers(usersData || []);
      setLoading(false);
    };

    loadData();

    // Real-time subscription
    const channel = supabase
      .channel("admin_crypto")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crypto_balances" },
        () => {
          loadData();
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

    try {
      const numAmount = parseFloat(amount);

      // Find existing crypto balance
      const existingCrypto = cryptoBalances.find(
        (c) => c.user_id === selectedUser && c.crypto === crypto
      );

      let finalAmount = numAmount;
      if (existingCrypto && operation !== "set") {
        const currentAmount = Number(existingCrypto.amount);
        if (operation === "add") {
          finalAmount = currentAmount + numAmount;
        } else if (operation === "deduct") {
          finalAmount = Math.max(0, currentAmount - numAmount);
        }
      }

      if (existingCrypto) {
        // Update existing crypto balance
        const { error } = await supabase
          .from("crypto_balances")
          .update({
            amount: finalAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCrypto.id);

        if (error) throw error;
      } else {
        // Create new crypto balance
        const { error } = await supabase.from("crypto_balances").insert({
          user_id: selectedUser,
          crypto: crypto,
          amount: finalAmount,
        });

        if (error) throw error;
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
    }
  };

  const deleteCrypto = async (cryptoBalance: CryptoBalance) => {
    if (!confirm(`Delete ${cryptoBalance.crypto} balance for this user?`))
      return;

    const { error } = await supabase
      .from("crypto_balances")
      .delete()
      .eq("id", cryptoBalance.id);

    if (error) {
      console.error("Error deleting crypto balance:", error);
    } else {
      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: cryptoBalance.user_id,
        activity: `Admin deleted ${cryptoBalance.crypto} balance`,
      });
    }
  };

  const resetForm = () => {
    setSelectedUser("");
    setCrypto("");
    setAmount("");
    setOperation("set");
    setEditingCrypto(null);
    setDialogOpen(false);
  };

  const totalValue = cryptoBalances.reduce((sum, crypto) => {
    const price = getCryptoPrice(crypto.crypto);
    return sum + Number(crypto.amount) * price;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Crypto Management
          </h1>
          <p className="text-gray-600">Manage user cryptocurrency holdings</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
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
              </div>

              <Button type="submit" className="w-full">
                {operation === "set"
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Holdings
            </CardTitle>
            <Bitcoin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cryptoBalances.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Value (USD)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cryptocurrencies
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(cryptoBalances.map((c) => c.crypto)).size}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Bitcoin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(cryptoBalances.map((c) => c.user_id)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Crypto Holdings List */}
      <Card>
        <CardHeader>
          <CardTitle>All Crypto Holdings</CardTitle>
          <CardDescription>
            Complete overview of all user crypto balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse p-4 border rounded-lg">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : cryptoBalances.length > 0 ? (
            <div className="space-y-4">
              {cryptoBalances.map((cryptoBalance) => {
                const price = getCryptoPrice(cryptoBalance.crypto);
                const value = Number(cryptoBalance.amount) * price;

                return (
                  <div
                    key={cryptoBalance.id}
                    className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <h3 className="font-medium">
                        {cryptoBalance.users?.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {cryptoBalance.users?.email}
                      </p>
                      <p className="text-sm text-gray-600">
                        {cryptoBalance.crypto}:{" "}
                        {Number(cryptoBalance.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 8,
                          maximumFractionDigits: 8,
                        })}
                      </p>
                      <p className="text-xs text-gray-400">
                        Value: $
                        {value.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        | Price: $
                        {price.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        | Updated{" "}
                        {new Date(
                          cryptoBalance.updated_at
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCrypto(cryptoBalance)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bitcoin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No crypto holdings yet
              </h3>
              <p className="text-gray-500">
                User crypto balances will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
