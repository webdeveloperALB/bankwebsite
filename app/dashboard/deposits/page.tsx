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
import { PiggyBank, CreditCard, Banknote, TrendingUp } from "lucide-react";
import { Database } from "@/lib/supabase";
import { convertCurrency, getCurrencyRate } from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type Balance = Database["public"]["Tables"]["balances"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF"];

export default function DepositsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [deposits, setDeposits] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("");

  useEffect(() => {
    const loadData = async () => {
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

        // Load deposit history
        const { data: depositsData } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", currentUser.id)
          .eq("type", "deposit")
          .order("created_at", { ascending: false });

        setDeposits(depositsData || []);

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
              supabase
                .from("balances")
                .select("*")
                .eq("user_id", currentUser.id)
                .then(({ data }) => setBalances(data || []));
            }
          )
          .subscribe();

        const transactionsChannel = supabase
          .channel("transactions")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "transactions",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              supabase
                .from("transactions")
                .select("*")
                .eq("user_id", currentUser.id)
                .eq("type", "deposit")
                .order("created_at", { ascending: false })
                .then(({ data }) => setDeposits(data || []));
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(balancesChannel);
          supabase.removeChannel(transactionsChannel);
        };
      } catch (error) {
        console.error("Error loading deposits data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !depositAmount || !depositCurrency) return;

    setDepositing(true);

    try {
      const amount = Number(depositAmount);

      // Create transaction record
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "deposit",
          currency: depositCurrency,
          amount: amount,
        });

      if (transactionError) throw transactionError;

      // Update or create balance
      const existingBalance = balances.find(
        (b) => b.currency === depositCurrency
      );

      if (existingBalance) {
        // Update existing balance
        const { error: updateError } = await supabase
          .from("balances")
          .update({
            amount: Number(existingBalance.amount) + amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingBalance.id);

        if (updateError) throw updateError;
      } else {
        // Create new balance
        const { error: insertError } = await supabase.from("balances").insert({
          user_id: user.id,
          currency: depositCurrency,
          amount: amount,
        });

        if (insertError) throw insertError;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: `Deposited ${amount} ${depositCurrency}`,
      });

      setDepositAmount("");
      setDepositCurrency("");
    } catch (error) {
      console.error("Error processing deposit:", error);
      alert("Deposit failed. Please try again.");
    } finally {
      setDepositing(false);
    }
  };

  const totalDeposited = deposits.reduce(
    (sum, deposit) => sum + Number(deposit.amount),
    0
  );

  return (
    <DashboardLayout currentSection="deposits">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deposits</h1>
          <p className="text-gray-600">Add funds to your account</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Balances by Currency */}
          {balances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Current Balances</CardTitle>
                <CardDescription>
                  Your available funds by currency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {balances.map((balance) => (
                    <div
                      key={balance.id}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">
                            {balance.currency.substring(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{balance.currency}</p>
                          <p className="text-sm text-gray-500">Available</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {Number(balance.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-sm text-gray-500">
                          ≈ $
                          {convertCurrency(
                            Number(balance.amount),
                            balance.currency,
                            "USD"
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deposit Form */}
          <Card>
            <CardHeader>
              <CardTitle>Make a Deposit</CardTitle>
              <CardDescription>
                Add funds to your account in any supported currency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDeposit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={depositCurrency}
                    onValueChange={setDepositCurrency}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
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
                    min="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Payment Method
                    </span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Deposits are processed instantly. In a real banking app,
                    this would integrate with payment processors like Stripe.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={depositing}>
                  {depositing ? "Processing..." : "Deposit Funds"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Deposit History */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Deposits</CardTitle>
              <CardDescription>Your deposit history</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                        <div className="h-3 bg-gray-200 rounded w-32"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : deposits.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {deposits.map((deposit) => (
                    <div
                      key={deposit.id}
                      className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-green-600">
                          +
                          {Number(deposit.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          {deposit.currency}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(deposit.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <PiggyBank className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PiggyBank className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No deposits yet
                  </h3>
                  <p className="text-gray-500">
                    Make your first deposit to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
