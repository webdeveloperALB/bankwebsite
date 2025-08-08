"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Phone,
  Mail,
  MessageCircle,
  Clock,
  Shield,
  CreditCard,
  Users,
  HelpCircle,
} from "lucide-react";
import { Database } from "@/lib/supabase";

type User = Database["public"]["Tables"]["users"]["Row"];

export default function SupportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const supportOptions = [
    {
      icon: Phone,
      title: "Phone Support",
      description: "Speak directly with our banking specialists",
      contact: "1-800-BANK-HELP",
      hours: "24/7 Available",
      color: "text-[#F26623]",
    },
    {
      icon: Mail,
      title: "Email Support",
      description: "Send us your questions and we'll respond within 24 hours",
      contact: "support@yourbank.com",
      hours: "Response within 24hrs",
      color: "text-[#F26623]",
    },
    {
      icon: MessageCircle,
      title: "Live Chat",
      description: "Get instant help through our secure chat system",
      contact: "Start Chat",
      hours: "Mon-Fri 8AM-8PM",
      color: "text-[#F26623]",
    },
  ];

  const quickHelp = [
    {
      icon: CreditCard,
      title: "Account & Cards",
      description: "Balance inquiries, card activation, transaction disputes",
    },
    {
      icon: Shield,
      title: "Security & Fraud",
      description:
        "Report suspicious activity, security alerts, account protection",
    },
    {
      icon: Users,
      title: "Loans & Mortgages",
      description:
        "Application status, payment information, refinancing options",
    },
    {
      icon: HelpCircle,
      title: "General Banking",
      description: "Branch locations, fees, services, and general questions",
    },
  ];

  return (
    <DashboardLayout currentSection="support">
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            Customer Support
          </h1>
          <p className="text-sm md:text-base text-gray-600 max-w-2xl">
            We&apos;re here to help you with all your banking needs. Choose the
            support option that works best for you.
          </p>
        </div>

        {/* Contact Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {supportOptions.map((option, index) => (
            <Card
              key={index}
              className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-[#F26623]"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#F26623]/10 rounded-lg">
                    <option.icon
                      className={`h-5 w-5 md:h-6 md:w-6 ${option.color}`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base md:text-lg text-gray-900">
                      {option.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs md:text-sm text-gray-600 mb-3 leading-relaxed">
                  {option.description}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm md:text-base font-semibold text-[#F26623]">
                      {option.contact}
                    </span>
                  </div>
                  <div className="flex items-center text-xs md:text-sm text-gray-500">
                    <Clock className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                    {option.hours}
                  </div>
                </div>
                <Button
                  className="w-full mt-4 bg-[#F26623] hover:bg-[#E55A1F] text-white text-sm md:text-base"
                  size="sm"
                >
                  Contact Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Help Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-gray-900">
              Quick Help Categories
            </CardTitle>
            <CardDescription className="text-sm md:text-base">
              Find answers to common questions in these categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {quickHelp.map((item, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-[#F26623]/10 rounded-lg group-hover:bg-[#F26623]/20 transition-colors">
                      <item.icon className="h-5 w-5 md:h-6 md:w-6 text-[#F26623]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl text-gray-900">
              Send us a Message
            </CardTitle>
            <CardDescription className="text-sm md:text-base">
              Can&apos;t find what you&apos;re looking for? Send us a detailed message and
              we&apos;ll get back to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm md:text-base">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    className="text-sm md:text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm md:text-base">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="text-sm md:text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm md:text-base">
                  Subject
                </Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your inquiry"
                  className="text-sm md:text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm md:text-base">
                  Message
                </Label>
                <Textarea
                  id="message"
                  placeholder="Please provide detailed information about your inquiry..."
                  rows={4}
                  className="text-sm md:text-base resize-none"
                />
              </div>

              <Button
                type="submit"
                className="w-full md:w-auto bg-[#F26623] hover:bg-[#E55A1F] text-white text-sm md:text-base px-8"
              >
                Send Message
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
