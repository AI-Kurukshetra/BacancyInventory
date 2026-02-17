import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const SCHEMA_SUMMARY = `
PostgreSQL schema (public):
- organizations (id, name, gstin, country, address, settings, created_at)
- organization_users (id, organization_id, user_id, role, status, created_at)
- customers (id, organization_id, name, email, phone, billing_address, gstin, created_at)
- vendors (id, organization_id, name, email, phone, address, gstin, created_at)
- product_categories (id, organization_id, name, parent_id, created_at)
- products (id, organization_id, name, sku, sales_price, purchase_price, tax_rate, uom, category_id, reorder_level, created_at)
- warehouses (id, organization_id, name, code, is_default, created_at)
- invoices (id, organization_id, invoice_number, customer_id, invoice_date, status, subtotal, total_tax, total_amount, created_by, created_at)
- invoice_items (id, invoice_id, product_id, quantity, unit_price, tax_rate, line_total)
- bills (id, organization_id, bill_number, vendor_id, bill_date, status, subtotal, total_tax, total_amount, created_by, created_at)
- bill_items (id, bill_id, product_id, quantity, unit_price, line_total)
- stock_ledger (id, organization_id, product_id, warehouse_id, qty_change, unit_cost, reference_type, created_at)
All monetary amounts are in INR (numeric). Use only SELECT. Limit to 50 rows if not specified.
`;

export function getSupabaseAgentClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or key for DB agent");
  return createClient(url, key);
}

export function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");
  return new Groq({ apiKey });
}

/** Minimal type for Supabase client with custom execute_sql RPC (not in generated types). */
type SupabaseClientForRpc = {
  rpc: (name: string, params: { query: string }) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Run a read-only SQL query via Supabase RPC.
 * Requires execute_sql_rpc.sql to be run once in Supabase SQL Editor.
 */
export async function runQuery(supabase: SupabaseClientForRpc, sql: string): Promise<unknown[]> {
  const { data, error } = await supabase.rpc("execute_sql", { query: sql });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data as unknown[];
}

/**
 * Turn a natural language question into SQL using Groq, then execute and return results.
 */
export async function askAgent(prompt: string): Promise<{ answer: string; data: unknown[]; sql?: string }> {
  const groq = getGroqClient();
  const supabase = getSupabaseAgentClient();

  const sqlPrompt = `You are a SQL expert. Given the following schema, write a single PostgreSQL SELECT query for the user question. Return ONLY the SQL, no markdown, no explanation.

${SCHEMA_SUMMARY}

User question: ${prompt}`;

  const sqlCompletion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: sqlPrompt }],
    temperature: 0,
    max_tokens: 500,
  });

  const rawSql = sqlCompletion.choices[0]?.message?.content?.trim();
  if (!rawSql) throw new Error("No SQL generated");

  // Strip markdown code block if present and trailing semicolon (RPC allows only one statement)
  const sql = rawSql
    .replace(/^```\w*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim()
    .replace(/;\s*$/, "");

  const data = await runQuery(supabase, sql);

  // Optional: summarize in natural language
  const summaryPrompt = `The user asked: "${prompt}"\n\nThe query returned ${data.length} row(s). Summarize the result in 1-3 short sentences. If empty, say no data was found.`;
  const summaryCompletion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: summaryPrompt }],
    temperature: 0,
    max_tokens: 200,
  });
  const answer = summaryCompletion.choices[0]?.message?.content?.trim() ?? "No summary generated.";

  return { answer, data, sql };
}
