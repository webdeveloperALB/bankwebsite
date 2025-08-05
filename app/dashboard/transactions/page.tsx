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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpDown,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
} from "lucide-react";
import { Database } from "@/lib/supabase";
import { convertCurrency, getCurrencyRate } from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Balance = Database["public"]["Tables"]["balances"]["Row"];

export default function TransactionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Transfer form state
  const [transferAmount, setTransferAmount] = useState("");
  const [transferCurrency, setTransferCurrency] = useState("");
  const [transferToUser, setTransferToUser] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUser(currentUser);

        // Load transactions
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("*")
          .or(`user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
          .order("created_at", { ascending: false });

        setTransactions(transactionsData || []);

        // Load user balances
        const { data: balancesData } = await supabase
          .from("balances")
          .select("*")
          .eq("user_id", currentUser.id);

        setBalances(balancesData || []);

        // Load other users for transfers
        const { data: usersData } = await supabase
          .from("users")
          .select("*")
          .neq("id", currentUser.id);

        // Set up real-time subscription
        const channel = supabase
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
                .then(({ data }) => setTransactions(data || []));
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error("Error loading transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !transferAmount || !transferCurrency || !transferToUser)
      return;

    setSending(true);

    try {
      const amount = Number(transferAmount);

      // Check if user has sufficient balance
      const userBalance = balances.find((b) => b.currency === transferCurrency);
      if (!userBalance || Number(userBalance.amount) < amount) {
        alert("Insufficient balance");
        return;
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "transfer",
          currency: transferCurrency,
          amount: amount,
          to_user_id: transferToUser,
        });

      if (transactionError) throw transactionError;

      // Update sender balance
      const { error: senderError } = await supabase
        .from("balances")
        .update({
          amount: Number(userBalance.amount) - amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userBalance.id);

      if (senderError) throw senderError;

      // Update or create receiver balance
      const { data: receiverBalance } = await supabase
        .from("balances")
        .select("*")
        .eq("user_id", transferToUser)
        .eq("currency", transferCurrency)
        .single();

      if (receiverBalance) {
        // Update existing balance
        const { error: receiverError } = await supabase
          .from("balances")
          .update({
            amount: Number(receiverBalance.amount) + amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", receiverBalance.id);

        if (receiverError) throw receiverError;
      } else {
        // Create new balance
        const { error: newBalanceError } = await supabase
          .from("balances")
          .insert({
            user_id: transferToUser,
            currency: transferCurrency,
            amount: amount,
          });

        if (newBalanceError) throw newBalanceError;
      }

      // Log activities
      await supabase.from("activity_logs").insert([
        {
          user_id: user.id,
          activity: `Sent ${amount} ${transferCurrency} to another user`,
        },
        {
          user_id: transferToUser,
          activity: `Received ${amount} ${transferCurrency} from another user`,
        },
      ]);

      // Reload balances
      const { data: updatedBalances } = await supabase
        .from("balances")
        .select("*")
        .eq("user_id", user.id);

      setBalances(updatedBalances || []);

      setTransferAmount("");
      setTransferCurrency("");
      setTransferToUser("");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error sending transfer:", error);
      alert("Transfer failed. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === "deposit") {
      return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
    } else if (transaction.type === "transfer") {
      if (transaction.user_id === user?.id) {
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      } else {
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      }
    }
    return <ArrowUpDown className="h-4 w-4 text-gray-600" />;
  };

  const getTransactionDescription = (transaction: Transaction) => {
    if (transaction.type === "deposit") {
      return "Deposit";
    } else if (transaction.type === "transfer") {
      if (transaction.user_id === user?.id) {
        return "Sent to user";
      } else {
        return "Received from user";
      }
    }
    return transaction.type;
  };

  return (
    <DashboardLayout currentSection="transactions">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
            <p className="text-gray-600">
              View and manage your transaction history
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="h-4 w-4 mr-2" />
                Send Money
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Money</DialogTitle>
                <DialogDescription>
                  Transfer funds to another user
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient</Label>
                  <Select
                    value={transferToUser}
                    onValueChange={setTransferToUser}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={transferCurrency}
                    onValueChange={setTransferCurrency}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {balances.map((balance) => (
                        <SelectItem key={balance.id} value={balance.currency}>
                          {balance.currency} (Available:{" "}
                          {Number(balance.amount).toFixed(2)})
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
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? "Sending..." : "Send Money"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Transaction Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Transactions
              </CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.length}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  transactions.filter(
                    (t) => t.user_id === user?.id && t.type === "transfer"
                  ).length
                }
              </div>
              <p className="text-xs text-muted-foreground">
                Outgoing transfers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Received</CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {transactions.filter((t) => t.to_user_id === user?.id).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Incoming transfers
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your complete transaction history</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                        <div className="h-3 bg-gray-200 rounded w-32"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        {getTransactionIcon(transaction)}
                      </div>
                      <div>
                        <p className="font-medium">
                          {getTransactionDescription(transaction)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(transaction.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-semibold ${
                          transaction.type === "deposit" ||
                          transaction.to_user_id === user?.id
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "deposit" ||
                        transaction.to_user_id === user?.id
                          ? "+"
                          : "-"}
                        {Number(transaction.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {transaction.currency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ArrowUpDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No transactions yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Your transaction history will appear here
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Money
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
