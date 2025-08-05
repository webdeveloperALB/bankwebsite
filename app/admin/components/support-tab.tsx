'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { HelpCircle, Eye, Trash2, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type SupportTicket = Database['public']['Tables']['support_tickets']['Row'] & {
  users?: { name: string; email: string }
}

export default function SupportTab() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)

  useEffect(() => {
    const loadData = async () => {
      // Load support tickets with user info
      const { data: ticketsData } = await supabase
        .from('support_tickets')
        .select(`
          *,
          users!inner(name, email)
        `)
        .order('created_at', { ascending: false })

      // Load users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .neq('role', 'admin')
        .order('name')

      setTickets(ticketsData || [])
      setUsers(usersData || [])
      setLoading(false)
    }

    loadData()

    // Real-time subscription
    const channel = supabase
      .channel('admin_support')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const updateTicketStatus = async (ticketId: string, newStatus: string, userId: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: newStatus })
      .eq('id', ticketId)

    if (error) {
      console.error('Error updating ticket status:', error)
    } else {
      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          activity: `Support ticket status updated to: ${newStatus}`
        })
    }
  }

  const deleteTicket = async (ticket: SupportTicket) => {
    if (!confirm('Are you sure you want to delete this support ticket?')) return

    const { error } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', ticket.id)

    if (error) {
      console.error('Error deleting ticket:', error)
    } else {
      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: ticket.user_id,
          activity: 'Support ticket deleted by admin'
        })
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
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />
      default:
        return <HelpCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Support Management</h1>
        <p className="text-gray-600">Manage user support tickets and requests</p>
      </div>

      {/* Support Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Support Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>All user support requests and their status</CardDescription>
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
          ) : tickets.length > 0 ? (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium">{ticket.users?.name}</h3>
                      <p className="text-sm text-gray-500">{ticket.users?.email}</p>
                      <p className="text-sm text-gray-900 mt-2">
                        {ticket.issue.length > 150 
                          ? `${ticket.issue.substring(0, 150)}...` 
                          : ticket.issue
                        }
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Created {new Date(ticket.created_at).toLocaleDateString()} | 
                        #{ticket.id.substring(0, 8)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Select
                        value={ticket.status}
                        onValueChange={(value) => updateTicketStatus(ticket.id, value, ticket.user_id)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Badge className={`${getStatusColor(ticket.status)} flex items-center space-x-1`}>
                        {getStatusIcon(ticket.status)}
                        <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                      </Badge>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedTicket(ticket)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Support Ticket Details</DialogTitle>
                            <DialogDescription>
                              Ticket from {selectedTicket?.users?.name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h4 className="font-medium mb-2">Issue Description:</h4>
                              <p className="text-sm text-gray-700">{selectedTicket?.issue}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">User:</span> {selectedTicket?.users?.name}
                              </div>
                              <div>
                                <span className="font-medium">Email:</span> {selectedTicket?.users?.email}
                              </div>
                              <div>
                                <span className="font-medium">Status:</span> 
                                <Badge className={`ml-2 ${getStatusColor(selectedTicket?.status || '')}`}>
                                  {selectedTicket?.status}
                                </Badge>
                              </div>
                              <div>
                                <span className="font-medium">Created:</span> {new Date(selectedTicket?.created_at || '').toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button variant="ghost" size="sm" onClick={() => deleteTicket(ticket)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No support tickets yet</h3>
              <p className="text-gray-500">User support requests will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}