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
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  ArrowUpDown,
} from "lucide-react";
import { Database } from "@/lib/supabase";
import {
  exchangeRateManager,
  convertCurrency,
  subscribeToRateUpdates,
} from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type Balance = Database["public"]["Tables"]["balances"]["Row"] & {
  users?: { name: string; email: string };
};

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY"];

export default function BalancesTab() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>(
    {}
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState<Balance | null>(null);

  // Form state
  const [selectedUser, setSelectedUser] = useState("");
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [operation, setOperation] = useState("set"); // set, add, deduct

  // Transfer state
  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferUser, setTransferUser] = useState("");

  // Force re-render when REAL exchange rates change from APIs
  const forceRerender = () => {
    setRefreshKey((prev: number) => prev + 1);
    console.log("🔄 Admin forcing UI re-render due to REAL API rate changes");
  };

  useEffect(() => {
    // Subscribe to REAL-TIME exchange rate updates from APIs
    const unsubscribe = subscribeToRateUpdates(forceRerender);

    // Get initial REAL rates from APIs
    setExchangeRates(exchangeRateManager.getAllRates());

    const loadData = async () => {
      // Load balances with user info
      const { data: balancesData } = await supabase
        .from("balances")
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

      setBalances(balancesData || []);
      setUsers(usersData || []);
      setLoading(false);
    };

    loadData();

    // Real-time subscription
    const channel = supabase
      .channel("admin_balances")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balances" },
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
    if (!selectedUser || !currency || !amount) return;

    try {
      const numAmount = parseFloat(amount);

      // Find existing balance
      const existingBalance = balances.find(
        (b) => b.user_id === selectedUser && b.currency === currency
      );

      let finalAmount = numAmount;
      if (existingBalance && operation !== "set") {
        const currentAmount = Number(existingBalance.amount);
        if (operation === "add") {
          finalAmount = currentAmount + numAmount;
        } else if (operation === "deduct") {
          finalAmount = Math.max(0, currentAmount - numAmount); // Don't allow negative
        }
      }

      if (existingBalance) {
        // Update existing balance
        const { error } = await supabase
          .from("balances")
          .update({
            amount: finalAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingBalance.id);

        if (error) throw error;
      } else {
        // Create new balance
        const { error } = await supabase.from("balances").insert({
          user_id: selectedUser,
          currency: currency,
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
        activity: `Admin ${operationText} ${currency} balance: ${numAmount}`,
      });

      resetForm();
    } catch (error) {
      console.error("Error updating balance:", error);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferUser || !fromCurrency || !toCurrency || !transferAmount)
      return;

    try {
      const amount = parseFloat(transferAmount);

      // Find source balance
      const sourceBalance = balances.find(
        (b) => b.user_id === transferUser && b.currency === fromCurrency
      );

      if (!sourceBalance || Number(sourceBalance.amount) < amount) {
        alert("Insufficient balance for transfer");
        return;
      }

      // Calculate converted amount
      const convertedAmount = convertCurrency(amount, fromCurrency, toCurrency);

      // Update source balance
      const { error: sourceError } = await supabase
        .from("balances")
        .update({
          amount: Number(sourceBalance.amount) - amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sourceBalance.id);

      if (sourceError) throw sourceError;

      // Find or create destination balance
      const destBalance = balances.find(
        (b) => b.user_id === transferUser && b.currency === toCurrency
      );

      if (destBalance) {
        // Update existing destination balance
        const { error: destError } = await supabase
          .from("balances")
          .update({
            amount: Number(destBalance.amount) + convertedAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", destBalance.id);

        if (destError) throw destError;
      } else {
        // Create new destination balance
        const { error: createError } = await supabase.from("balances").insert({
          user_id: transferUser,
          currency: toCurrency,
          amount: convertedAmount,
        });

        if (createError) throw createError;
      }

      // Create transaction record
      await supabase.from("transactions").insert({
        user_id: transferUser,
        type: "transfer",
        currency: fromCurrency,
        amount: amount,
      });

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: transferUser,
        activity: `Admin converted ${amount} ${fromCurrency} to ${convertedAmount.toFixed(
          2
        )} ${toCurrency}`,
      });

      setTransferDialogOpen(false);
      setTransferUser("");
      setFromCurrency("");
      setToCurrency("");
      setTransferAmount("");
    } catch (error) {
      console.error("Error processing transfer:", error);
    }
  };

  const deleteBalance = async (balance: Balance) => {
    if (!confirm(`Delete ${balance.currency} balance for this user?`)) return;

    const { error } = await supabase
      .from("balances")
      .delete()
      .eq("id", balance.id);

    if (error) {
      console.error("Error deleting balance:", error);
    } else {
      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: balance.user_id,
        activity: `Admin deleted ${balance.currency} balance`,
      });
    }
  };

  const resetForm = () => {
    setSelectedUser("");
    setCurrency("");
    setAmount("");
    setOperation("set");
    setEditingBalance(null);
    setDialogOpen(false);
  };

  const totalValue = balances.reduce((sum, balance) => {
    const usdAmount = convertCurrency(
      Number(balance.amount),
      balance.currency,
      "USD"
    );
    return sum + usdAmount;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Balance Management
          </h1>
          <p className="text-gray-600">
            Manage user balances across all currencies
          </p>
        </div>

        <div className="flex space-x-2">
          <Dialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Currency Transfer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Currency Transfer</DialogTitle>
                <DialogDescription>
                  Convert between currencies with real-time exchange rates
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select value={transferUser} onValueChange={setTransferUser}>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Currency</Label>
                    <Select
                      value={fromCurrency}
                      onValueChange={setFromCurrency}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="From" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr} value={curr}>
                            {curr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>To Currency</Label>
                    <Select value={toCurrency} onValueChange={setToCurrency}>
                      <SelectTrigger>
                        <SelectValue placeholder="To" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr} value={curr}>
                            {curr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Amount to Convert</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                  {fromCurrency && toCurrency && transferAmount && (
                    <p className="text-sm text-gray-600">
                      {transferAmount} {fromCurrency} ={" "}
                      {convertCurrency(
                        parseFloat(transferAmount),
                        fromCurrency,
                        toCurrency
                      ).toFixed(4)}{" "}
                      {toCurrency}
                      <br />
                      <span className="text-xs text-gray-500">
                        Rate: 1 {fromCurrency} ={" "}
                        {convertCurrency(1, fromCurrency, toCurrency).toFixed(
                          4
                        )}{" "}
                        {toCurrency}
                      </span>
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full">
                  Convert Currency
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Manage Balance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage User Balance</DialogTitle>
                <DialogDescription>
                  Set, add, or deduct from user balances
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
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                          {curr}
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
                      <SelectItem value="deduct">
                        Deduct from Balance
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
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
      </div>

      {/* Balance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Balances
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{balances.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Value (USD)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Currencies</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(balances.map((b) => b.currency)).size}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(balances.map((b) => b.user_id)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balances List */}
      <Card>
        <CardHeader>
          <CardTitle>All User Balances</CardTitle>
          <CardDescription>
            Complete overview of all user balances
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
          ) : balances.length > 0 ? (
            <div className="space-y-4">
              {balances.map((balance) => (
                <div
                  key={balance.id}
                  className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <h3 className="font-medium">{balance.users?.name}</h3>
                    <p className="text-sm text-gray-500">
                      {balance.users?.email}
                    </p>
                    <p className="text-sm text-gray-600">
                      {balance.currency}:{" "}
                      {Number(balance.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-gray-400">
                      Updated{" "}
                      {new Date(balance.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBalance(balance)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No balances yet
              </h3>
              <p className="text-gray-500">User balances will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
