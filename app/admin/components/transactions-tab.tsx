'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ArrowUpDown, Plus, Trash2, ArrowUpRight, ArrowDownLeft, PiggyBank } from 'lucide-react'
import { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Transaction = Database['public']['Tables']['transactions']['Row'] & {
  users?: { name: string; email: string }
  to_users?: { name: string; email: string }
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF',]

export default function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  
  // Form state
  const [selectedUser, setSelectedUser] = useState('')
  const [transactionType, setTransactionType] = useState('deposit')
  const [currency, setCurrency] = useState('')
  const [amount, setAmount] = useState('')
  const [toUser, setToUser] = useState('')

  useEffect(() => {
    const loadData = async () => {
      // Load transactions with user info
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select(`
          *,
          users!transactions_user_id_fkey(name, email),
          to_users:users!transactions_to_user_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false })

      // Load users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .neq('role', 'admin')
        .order('name')

      setTransactions(transactionsData || [])
      setUsers(usersData || [])
      setLoading(false)
    }

    loadData()

    // Real-time subscription
    const channel = supabase
      .channel('admin_transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !transactionType || !currency || !amount) return

    try {
      const transactionData: any = {
        user_id: selectedUser,
        type: transactionType,
        currency: currency,
        amount: parseFloat(amount)
      }

      if (transactionType === 'transfer' && toUser) {
        transactionData.to_user_id = toUser
      }

      const { error } = await supabase
        .from('transactions')
        .insert(transactionData)

      if (error) throw error

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: selectedUser,
          activity: `Admin created ${transactionType} transaction: ${amount} ${currency}`
        })

      resetForm()
    } catch (error) {
      console.error('Error creating transaction:', error)
    }
  }

  const deleteTransaction = async (transaction: Transaction) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transaction.id)

    if (error) {
      console.error('Error deleting transaction:', error)
    } else {
      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: transaction.user_id,
          activity: `Admin deleted ${transaction.type} transaction: ${transaction.amount} ${transaction.currency}`
        })
    }
  }

  const resetForm = () => {
    setSelectedUser('')
    setTransactionType('deposit')
    setCurrency('')
    setAmount('')
    setToUser('')
    setDialogOpen(false)
  }

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === 'deposit') {
      return <ArrowDownLeft className="h-4 w-4 text-green-600" />
    } else if (transaction.type === 'transfer') {
      return <ArrowUpRight className="h-4 w-4 text-blue-600" />
    } else if (transaction.type === 'withdrawal') {
      return <ArrowUpRight className="h-4 w-4 text-red-600" />
    }
    return <ArrowUpDown className="h-4 w-4 text-gray-600" />
  }

  const totalTransactions = transactions.length
  const totalDeposits = transactions.filter(t => t.type === 'deposit').length
  const totalTransfers = transactions.filter(t => t.type === 'transfer').length
  const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal').length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Management</h1>
          <p className="text-gray-600">Manage all user transactions</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Transaction</DialogTitle>
              <DialogDescription>
                Add a new transaction for a user
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
                <Label>Transaction Type</Label>
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
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
                      <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                    ))}
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

              {transactionType === 'transfer' && (
                <div className="space-y-2">
                  <Label>Transfer To</Label>
                  <Select value={toUser} onValueChange={setToUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(u => u.id !== selectedUser).map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full">
                Create Transaction
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transaction Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deposits</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalDeposits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transfers</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalTransfers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Withdrawals</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalWithdrawals}</div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Complete transaction history across all users</CardDescription>
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
          ) : transactions.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      {getTransactionIcon(transaction)}
                    </div>
                    <div>
                      <h3 className="font-medium capitalize">{transaction.type}</h3>
                      <p className="text-sm text-gray-500">
                        {transaction.users?.name} ({transaction.users?.email})
                        {transaction.to_users && (
                          <span> → {transaction.to_users.name}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        {Number(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-gray-500">{transaction.currency}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteTransaction(transaction)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ArrowUpDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h3>
              <p className="text-gray-500">User transactions will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}