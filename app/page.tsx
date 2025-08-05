"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Banknote, Shield, Zap, Globe } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          // Check KYC status before redirect
          if (user.role === "admin") {
            router.push("/admin");
          } else if (user.kyc_status !== "approved") {
            router.push("/kyc");
          } else {
            router.push("/dashboard");
          }
        }
      } catch (error) {
        // User not authenticated, stay on landing page
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex items-center justify-center mb-8">
              <Banknote className="h-16 w-16 text-blue-600" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              SecureBank
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Experience the future of banking with real-time transactions,
              multi-currency support, and enterprise-grade security. Your
              financial partner for the digital age.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => router.push("/auth/register")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Get Started
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push("/auth/login")}
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose SecureBank?
            </h2>
            <p className="text-xl text-gray-600">
              Built for the modern world with cutting-edge technology
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <Zap className="h-12 w-12 text-blue-600" />
                </div>
                <CardTitle>Real-Time Banking</CardTitle>
                <CardDescription>
                  Instant transactions and live balance updates
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <Globe className="h-12 w-12 text-green-600" />
                </div>
                <CardTitle>Multi-Currency</CardTitle>
                <CardDescription>
                  Support for major fiat currencies and cryptocurrencies
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <Shield className="h-12 w-12 text-purple-600" />
                </div>
                <CardTitle>Bank-Grade Security</CardTitle>
                <CardDescription>
                  Enterprise-level encryption and data protection
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <Banknote className="h-12 w-12 text-orange-600" />
                </div>
                <CardTitle>24/7 Support</CardTitle>
                <CardDescription>
                  Round-the-clock customer service and assistance
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Banking Differently?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of users who trust SecureBank for their financial
            needs
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => router.push("/auth/register")}
          >
            Create Your Account Today
          </Button>
        </div>
      </div>
    </div>
  );
}
