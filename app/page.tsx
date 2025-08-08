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
import { Shield, Zap, Globe, Clock } from "lucide-react";
import Image from "next/image";

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center space-x-3">
              <Image
                src="/anchor3.svg"
                alt="SecureBank Logo"
                width={160}
                height={140}
                className="h-50 w-50"
              />
            </div>
            <div className="flex space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push("/auth/login")}
                className="text-gray-700 hover:text-[#F26623]"
              >
                Sign In
              </Button>
              <Button
                onClick={() => router.push("/auth/register")}
                className="bg-[#F26623] hover:bg-[#E55A1F] text-white"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <div className="flex items-center mb-6">
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2">
                    Anchor Group Investments
                  </h1>
                </div>
              </div>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Experience next-generation banking with real-time transactions,
                comprehensive security, and personalized financial solutions.
                Built for individuals and businesses who demand excellence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={() => router.push("/auth/register")}
                  className="bg-[#F26623] hover:bg-[#E55A1F] text-white px-8 py-3 text-lg"
                >
                  Open Account
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push("/auth/login")}
                  className="border-[#F26623] text-[#F26623] hover:bg-[#F26623] hover:text-white px-8 py-3 text-lg"
                >
                  Access Banking
                </Button>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">
                  Why Choose AGI?
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <Shield className="h-5 w-5 mr-3" />
                    Bank-grade security & encryption
                  </li>
                  <li className="flex items-center">
                    <Zap className="h-5 w-5 mr-3" />
                    Instant real-time transactions
                  </li>
                  <li className="flex items-center">
                    <Globe className="h-5 w-5 mr-3" />
                    Global multi-currency support
                  </li>
                  <li className="flex items-center">
                    <Clock className="h-5 w-5 mr-3" />
                    24/7 customer support
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Professional Banking Solutions
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive financial services designed for modern banking
              needs, backed by cutting-edge technology and unwavering security
              standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow border-t-4 border-t-[#F26623]">
              <CardHeader className="pb-4">
                <div className="flex justify-center mb-4">
                  <div className="bg-[#F26623] bg-opacity-10 p-3 rounded-full">
                    <Zap className="h-8 w-8 text-[#F26623]" />
                  </div>
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Real-Time Processing
                </CardTitle>
                <CardDescription className="text-gray-600 mt-2">
                  Lightning-fast transactions with instant balance updates and
                  real-time notifications
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow border-t-4 border-t-[#F26623]">
              <CardHeader className="pb-4">
                <div className="flex justify-center mb-4">
                  <div className="bg-[#F26623] bg-opacity-10 p-3 rounded-full">
                    <Globe className="h-8 w-8 text-[#F26623]" />
                  </div>
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Global Banking
                </CardTitle>
                <CardDescription className="text-gray-600 mt-2">
                  Multi-currency accounts with competitive exchange rates and
                  international transfers
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow border-t-4 border-t-[#F26623]">
              <CardHeader className="pb-4">
                <div className="flex justify-center mb-4">
                  <div className="bg-[#F26623] bg-opacity-10 p-3 rounded-full">
                    <Shield className="h-8 w-8 text-[#F26623]" />
                  </div>
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Advanced Security
                </CardTitle>
                <CardDescription className="text-gray-600 mt-2">
                  Military-grade encryption, biometric authentication, and fraud
                  protection systems
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow border-t-4 border-t-[#F26623]">
              <CardHeader className="pb-4">
                <div className="flex justify-center mb-4">
                  <div className="bg-[#F26623] bg-opacity-10 p-3 rounded-full">
                    <Clock className="h-8 w-8 text-[#F26623]" />
                  </div>
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  24/7 Support
                </CardTitle>
                <CardDescription className="text-gray-600 mt-2">
                  Round-the-clock customer service with dedicated relationship
                  managers
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* Trust Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Trusted by Financial Professionals
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="text-3xl font-bold text-[#F26623] mb-2">
                500K+
              </div>
              <div className="text-gray-600">Active Customers</div>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="text-3xl font-bold text-[#F26623] mb-2">
                $2.5B+
              </div>
              <div className="text-gray-600">Assets Under Management</div>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="text-3xl font-bold text-[#F26623] mb-2">
                99.9%
              </div>
              <div className="text-gray-600">Uptime Guarantee</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 lg:py-24 bg-gradient-to-r from-[#F26623] to-[#E55A1F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to Experience Professional Banking?
          </h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who have chosen SecureBank for
            their financial success. Start your journey today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => router.push("/auth/register")}
              className="bg-white text-[#F26623] hover:bg-gray-100 px-8 py-3 text-lg font-semibold"
            >
              Open Your Account
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/auth/login")}
              className="border-white text-[#F26623] hover:bg-white hover:text-[#F26623] px-8 py-3 text-lg"
            >
              Existing Customer
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <Image
                src="/anchor2_white.svg"
                alt="SecureBank"
                width={50}
                height={50}
                className="h-44 w-64"
              />
            </div>
            <div className="text-gray-400 text-sm">
              © 2025 Anchor Group Investments. All rights reserved. | Licensed Financial
              Institution
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
