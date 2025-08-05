'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import DashboardLayout from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { HelpCircle, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type SupportTicket = Database['public']['Tables']['support_tickets']['Row']

export default function SupportPage() {
  const [user, setUser] = useState<User | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newIssue, setNewIssue] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) return

        setUser(currentUser)

        // Load support tickets
        const { data: ticketsData } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })

        setTickets(ticketsData || [])

        // Set up real-time subscription
        const channel = supabase
          .channel('support_tickets')
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${currentUser.id}` },
            () => {
              // Reload tickets
              supabase
                .from('support_tickets')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .then(({ data }) => setTickets(data || []))
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }

      } catch (error) {
        console.error('Error loading support tickets:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newIssue.trim()) return

    setCreating(true)

    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          issue: newIssue.trim(),
          status: 'open'
        })

      if (error) throw error

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user.id,
          activity: 'Created support ticket'
        })

      setNewIssue('')
      setDialogOpen(false)
    } catch (error) {
      console.error('Error creating ticket:', error)
      alert('Failed to create ticket. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4" />
      case 'closed':
        return <CheckCircle className="h-4 w-4" />
      case 'in_progress':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <HelpCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800'
      case 'closed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <DashboardLayout currentSection="support">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Support</h1>
            <p className="text-gray-600">Get help with your banking needs</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Support Ticket</DialogTitle>
                <DialogDescription>
                  Describe your issue and our support team will help you
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="issue">Issue Description</Label>
                  <Textarea
                    id="issue"
                    value={newIssue}
                    onChange={(e) => setNewIssue(e.target.value)}
                    placeholder="Please describe your issue in detail..."
                    rows={4}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Ticket'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Support Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tickets.length}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tickets.filter(t => t.status === 'open').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tickets.filter(t => t.status === 'in_progress').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Being worked on
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tickets.filter(t => t.status === 'closed').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Completed tickets
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Support Tickets */}
        <Card>
          <CardHeader>
            <CardTitle>Your Support Tickets</CardTitle>
            <CardDescription>
              Track the status of your support requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : tickets.length > 0 ? (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900 flex-1 mr-4">
                        {ticket.issue.length > 100 
                          ? `${ticket.issue.substring(0, 100)}...` 
                          : ticket.issue
                        }
                      </h3>
                      <Badge className={`${getStatusColor(ticket.status)} flex items-center space-x-1`}>
                        {getStatusIcon(ticket.status)}
                        <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                      <span>#{ticket.id.substring(0, 8)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No support tickets yet</h3>
                <p className="text-gray-500 mb-4">
                  Create a ticket if you need help with anything
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Ticket
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}