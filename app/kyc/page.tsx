"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Upload,
  FileText,
  Banknote,
  CheckCircle,
} from "lucide-react";
import { Database } from "@/lib/supabase";

type User = Database["public"]["Tables"]["users"]["Row"];

export default function KYCPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [occupation, setOccupation] = useState("");
  const [sourceOfFunds, setSourceOfFunds] = useState("");

  // Document uploads
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [proofOfAddress, setProofOfAddress] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push("/auth/login");
          return;
        }

        // Check if KYC already approved
        if (currentUser.kyc_status === "approved") {
          router.push("/dashboard");
          return;
        }

        // Check if KYC already submitted or rejected
        if (
          currentUser.kyc_status === "submitted" ||
          currentUser.kyc_status === "rejected"
        ) {
          setSuccess(true);
        }

        setUser(currentUser);
      } catch (error) {
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router]);

  const uploadFile = async (file: File, folder: string) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${user!.id}/${folder}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .upload(fileName, file);

    if (error) throw error;
    return data.path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError("");

    try {
      // Upload documents
      const idDocumentPath = idDocument
        ? await uploadFile(idDocument, "id-documents")
        : null;
      const proofOfAddressPath = proofOfAddress
        ? await uploadFile(proofOfAddress, "proof-of-address")
        : null;
      const selfiePath = selfie ? await uploadFile(selfie, "selfies") : null;

      // Save KYC documents
      const documents = [];

      if (idDocumentPath) {
        documents.push({
          user_id: user.id,
          document_type: "id_document",
          file_name: idDocument!.name,
          file_path: idDocumentPath,
          file_size: idDocument!.size,
          mime_type: idDocument!.type,
        });
      }

      if (proofOfAddressPath) {
        documents.push({
          user_id: user.id,
          document_type: "proof_of_address",
          file_name: proofOfAddress!.name,
          file_path: proofOfAddressPath,
          file_size: proofOfAddress!.size,
          mime_type: proofOfAddress!.type,
        });
      }

      if (selfiePath) {
        documents.push({
          user_id: user.id,
          document_type: "selfie",
          file_name: selfie!.name,
          file_path: selfiePath,
          file_size: selfie!.size,
          mime_type: selfie!.type,
        });
      }

      if (documents.length > 0) {
        const { error: docError } = await supabase
          .from("kyc_documents")
          .insert(documents);

        if (docError) throw docError;
      }

      // Update user KYC status
      const { error: updateError } = await supabase
        .from("users")
        .update({
          kyc_status: "submitted",
          name: `${firstName} ${lastName}`,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: "KYC application submitted",
      });

      setSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Banknote className="h-12 w-12 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">SecureBank</h1>
          </div>

          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              <CardTitle>KYC Application Submitted</CardTitle>
              <CardDescription>
                Your application is under review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-700">
                  {user?.kyc_status === "rejected"
                    ? "Your KYC application was rejected. Please contact support for more information or resubmit with correct documents."
                    : "Thank you for submitting your KYC application. Our team will review your documents and verify your information. You will receive an email notification once your application is approved."}
                </p>
              </div>
              <div className="text-center">
                <Button
                  onClick={() => router.push("/auth/login")}
                  variant="outline"
                >
                  Back to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Banknote className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            SecureBank KYC Verification
          </h1>
          <p className="text-gray-600">
            Complete your identity verification to access banking services
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Know Your Customer (KYC) Application</CardTitle>
            <CardDescription>
              Please provide accurate information and upload required documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality *</Label>
                    <Input
                      id="nationality"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation *</Label>
                    <Input
                      id="occupation"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Street Address *</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code *</Label>
                    <Input
                      id="postalCode"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Financial Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Financial Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="sourceOfFunds">Source of Funds *</Label>
                  <Select
                    value={sourceOfFunds}
                    onValueChange={setSourceOfFunds}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source of funds" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employment">
                        Employment/Salary
                      </SelectItem>
                      <SelectItem value="business">Business Income</SelectItem>
                      <SelectItem value="investments">Investments</SelectItem>
                      <SelectItem value="inheritance">Inheritance</SelectItem>
                      <SelectItem value="savings">Personal Savings</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Document Upload */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Document Upload</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="idDocument">Government ID *</Label>
                    <Input
                      id="idDocument"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) =>
                        setIdDocument(e.target.files?.[0] || null)
                      }
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Passport, Driver&rsquo;s License, or National ID
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proofOfAddress">Proof of Address *</Label>
                    <Input
                      id="proofOfAddress"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) =>
                        setProofOfAddress(e.target.files?.[0] || null)
                      }
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Utility bill or bank statement
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="selfie">Selfie with ID *</Label>
                    <Input
                      id="selfie"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelfie(e.target.files?.[0] || null)}
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Clear photo holding your ID
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Important:</strong> All information must be accurate
                  and match your official documents. False information may
                  result in account suspension.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? "Submitting Application..."
                  : "Submit KYC Application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
