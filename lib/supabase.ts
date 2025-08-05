import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: string;
          created_at: string;
          kyc_status: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role?: string;
          created_at?: string;
          kyc_status?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: string;
          created_at?: string;
          kyc_status?: string;
        };
      };
      balances: {
        Row: {
          id: string;
          user_id: string;
          currency: string;
          amount: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          currency: string;
          amount: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          currency?: string;
          amount?: number;
          updated_at?: string;
        };
      };
      crypto_balances: {
        Row: {
          id: string;
          user_id: string;
          crypto: string;
          amount: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          crypto: string;
          amount: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          crypto?: string;
          amount?: number;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          currency: string;
          amount: number;
          to_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          currency: string;
          amount: number;
          to_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          currency?: string;
          amount?: number;
          to_user_id?: string | null;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          user_id: string;
          from_admin: boolean;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          from_admin?: boolean;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          from_admin?: boolean;
          message?: string;
          created_at?: string;
        };
      };
      taxes: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          amount: number;
          status: string;
          created_at: string;
          assessment_type: string;
          priority_level: string;
          assessment_period_from: string | null;
          assessment_period_to: string | null;
          employment_income: number;
          business_income: number;
          investment_income: number;
          other_income: number;
          standard_deduction: number;
          itemized_deductions: number;
          tax_credits: number;
          tax_rate: number;
          taxable_income: number;
          gross_income: number;
          prepared_by: string | null;
          review_date: string | null;
          assessment_notes: string | null;
          compliance_notes: string | null;
          filing_status: string | null;
          dependents: number;
          due_date: string | null;
          payment_date: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          amount: number;
          status?: string;
          created_at?: string;
          assessment_type?: string;
          priority_level?: string;
          assessment_period_from?: string | null;
          assessment_period_to?: string | null;
          employment_income?: number;
          business_income?: number;
          investment_income?: number;
          other_income?: number;
          standard_deduction?: number;
          itemized_deductions?: number;
          tax_credits?: number;
          tax_rate?: number;
          taxable_income?: number;
          gross_income?: number;
          prepared_by?: string | null;
          review_date?: string | null;
          assessment_notes?: string | null;
          compliance_notes?: string | null;
          filing_status?: string | null;
          dependents?: number;
          due_date?: string | null;
          payment_date?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          amount?: number;
          status?: string;
          created_at?: string;
          assessment_type?: string;
          priority_level?: string;
          assessment_period_from?: string | null;
          assessment_period_to?: string | null;
          employment_income?: number;
          business_income?: number;
          investment_income?: number;
          other_income?: number;
          standard_deduction?: number;
          itemized_deductions?: number;
          tax_credits?: number;
          tax_rate?: number;
          taxable_income?: number;
          gross_income?: number;
          prepared_by?: string | null;
          review_date?: string | null;
          assessment_notes?: string | null;
          compliance_notes?: string | null;
          filing_status?: string | null;
          dependents?: number;
          due_date?: string | null;
          payment_date?: string | null;
        };
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          issue: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          issue: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          issue?: string;
          status?: string;
          created_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          activity: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          activity: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          activity?: string;
          created_at?: string;
        };
      };
      kyc_documents: {
        Row: {
          id: string;
          user_id: string;
          document_type: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          mime_type: string | null;
          uploaded_at: string;
          status: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_type: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          mime_type?: string | null;
          uploaded_at?: string;
          status?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_type?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          mime_type?: string | null;
          uploaded_at?: string;
          status?: string;
        };
      };
    };
  };
};
