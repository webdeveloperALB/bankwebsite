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
import { Textarea } from "@/components/ui/textarea";
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
import { MessageSquare, Send, Trash2, User, Shield, Plus } from "lucide-react";
import { Database } from "@/lib/supabase";

type User = Database["public"]["Tables"]["users"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  users?: { name: string; email: string };
};

export default function MessagesTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedUser, setSelectedUser] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageType, setMessageType] = useState("notification");

  useEffect(() => {
    const loadData = async () => {
      // Load messages with user info
      const { data: messagesData } = await supabase
        .from("messages")
        .select(
          `
          *,
          users!inner(name, email)
        `
        )
        .order("created_at", { ascending: false });

      // Load users for sending messages
      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .neq("role", "admin")
        .order("name");

      setMessages(messagesData || []);
      setUsers(usersData || []);
      setLoading(false);
    };

    loadData();

    // Real-time subscription
    const channel = supabase
      .channel("admin_messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !messageText.trim()) return;

    setSending(true);

    try {
      // Get message template based on type
      let finalMessage = messageText;
      if (messageType === "payment_reminder") {
        finalMessage = `🔔 Payment Reminder: ${messageText}`;
      } else if (messageType === "account_update") {
        finalMessage = `📋 Account Update: ${messageText}`;
      } else if (messageType === "security_alert") {
        finalMessage = `🔒 Security Alert: ${messageText}`;
      } else if (messageType === "promotion") {
        finalMessage = `🎉 Special Offer: ${messageText}`;
      }

      const { error } = await supabase.from("messages").insert({
        user_id: selectedUser,
        from_admin: true,
        message: finalMessage,
      });

      if (error) throw error;

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: selectedUser,
        activity: `Received admin message: ${messageType}`,
      });

      setSelectedUser("");
      setMessageText("");
      setMessageType("notification");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      console.error("Error deleting message:", error);
    }
  };

  const broadcastMessage = async () => {
    if (!messageText.trim()) return;

    setSending(true);

    try {
      // Send to all non-admin users
      const messagesToInsert = users.map((user) => ({
        user_id: user.id,
        from_admin: true,
        message: `📢 System Announcement: ${messageText}`,
      }));

      const { error } = await supabase
        .from("messages")
        .insert(messagesToInsert);

      if (error) throw error;

      // Log activities
      const activitiesToInsert = users.map((user) => ({
        user_id: user.id,
        activity: "Received system announcement",
      }));

      await supabase.from("activity_logs").insert(activitiesToInsert);

      setMessageText("");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error broadcasting message:", error);
    } finally {
      setSending(false);
    }
  };

  const messageTypes = [
    { value: "notification", label: "📢 General Notification" },
    { value: "payment_reminder", label: "💳 Payment Reminder" },
    { value: "account_update", label: "📋 Account Update" },
    { value: "security_alert", label: "🔒 Security Alert" },
    { value: "promotion", label: "🎉 Promotion/Offer" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Message Management
          </h1>
          <p className="text-gray-600">
            Send notifications and manage user communications
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send Message to Users</DialogTitle>
              <DialogDescription>
                Send notifications, reminders, or announcements
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={sendMessage} className="space-y-4">
              <div className="space-y-2">
                <Label>Message Type</Label>
                <Select value={messageType} onValueChange={setMessageType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {messageTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Recipient</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user or broadcast" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broadcast">
                      📢 Broadcast to All Users
                    </SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Enter your message..."
                  rows={4}
                  required
                />
              </div>

              <div className="flex space-x-2">
                {selectedUser === "broadcast" ? (
                  <Button
                    type="button"
                    onClick={broadcastMessage}
                    className="flex-1"
                    disabled={sending}
                  >
                    {sending ? "Broadcasting..." : "Broadcast to All"}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={sending || !selectedUser}
                  >
                    {sending ? "Sending..." : "Send Message"}
                  </Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Message Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Messages
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messages.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Admin Messages
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {messages.filter((m) => m.from_admin).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Messages</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {messages.filter((m) => !m.from_admin).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <CardTitle>All Messages</CardTitle>
          <CardDescription>
            Complete message history across all users
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
          ) : messages.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-4 border rounded-lg ${
                    message.from_admin
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {message.from_admin ? (
                          <Shield className="h-4 w-4 text-blue-600" />
                        ) : (
                          <User className="h-4 w-4 text-gray-600" />
                        )}
                        <span className="font-medium">
                          {message.from_admin ? "Admin" : message.users?.name}
                        </span>
                        <span className="text-sm text-gray-500">
                          to {message.users?.name} ({message.users?.email})
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mb-2">
                        {message.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMessage(message.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No messages yet
              </h3>
              <p className="text-gray-500">
                Start communicating with your users
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
