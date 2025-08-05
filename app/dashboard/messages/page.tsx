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
import { MessageSquare, Send, User, Shield } from 'lucide-react'
import { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Message = Database['public']['Tables']['messages']['Row']

export default function MessagesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) return

        setUser(currentUser)

        // Load messages
        const { data: messagesData } = await supabase
          .from('messages')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: true })

        setMessages(messagesData || [])

        // Set up real-time subscription
        const channel = supabase
          .channel('messages')
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'messages', filter: `user_id=eq.${currentUser.id}` },
            () => {
              // Reload messages
              supabase
                .from('messages')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: true })
                .then(({ data }) => setMessages(data || []))
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }

      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newMessage.trim()) return

    setSending(true)

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          from_admin: false,
          message: newMessage.trim()
        })

      if (error) throw error

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user.id,
          activity: 'Sent message to support'
        })

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <DashboardLayout currentSection="messages">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600">Communicate with our support team</p>
        </div>

        {/* Message Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{messages.length}</div>
              <p className="text-xs text-muted-foreground">
                All conversations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Messages</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {messages.filter(m => !m.from_admin).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Messages sent by you
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Replies</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {messages.filter(m => m.from_admin).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Support responses
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message Thread */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                Your message history with support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((message) => (
                    <div key={message.id} className={`flex space-x-3 ${message.from_admin ? 'flex-row' : 'flex-row-reverse'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.from_admin ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        {message.from_admin ? (
                          <Shield className="h-4 w-4 text-blue-600" />
                        ) : (
                          <User className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                      <div className={`flex-1 max-w-xs ${message.from_admin ? 'text-left' : 'text-right'}`}>
                        <div className={`p-3 rounded-lg ${
                          message.from_admin 
                            ? 'bg-blue-100 text-blue-900' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="text-sm">{message.message}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
                    <p className="text-gray-500">
                      Start a conversation with our support team
                    </p>
                  </div>
                )}
              </div>

              {/* Send Message Form */}
              <form onSubmit={handleSendMessage} className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="message">Send Message</Label>
                  <Textarea
                    id="message"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message here..."
                    rows={3}
                    required
                  />
                </div>
                <Button type="submit" disabled={sending || !newMessage.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common support topics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setNewMessage('I need help with my account balance.')}
              >
                Account Balance Help
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setNewMessage('I have a question about a transaction.')}
              >
                Transaction Inquiry
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setNewMessage('I need to update my account information.')}
              >
                Account Update
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setNewMessage('I have a security concern.')}
              >
                Security Issue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}