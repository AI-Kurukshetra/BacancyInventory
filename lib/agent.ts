import { ChatGroq } from "@langchain/groq";
import { DataSource } from "typeorm";
import { SqlDatabase } from "@langchain/classic/sql_db";
import { SqlToolkit, createSqlAgent } from "@langchain/classic/agents/toolkits/sql";

export async function createAgent() {
  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY!,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });

  const datasource = new DataSource({
    type: "postgres",
    url: process.env.SUPABASE_DB_URL!,
  });

  await datasource.initialize();

  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
    sampleRowsInTableInfo: 3,
  });

  const toolkit = new SqlToolkit(db, llm);

  const agent = await createSqlAgent(llm, toolkit, {
    prefix: `You are a helpful data assistant for an inventory and sales database.
Only generate SELECT queries. Never use INSERT, UPDATE, DELETE, DROP, or any query that modifies the database.
Always limit results to 50 rows unless the user asks for a different limit.
Use the schema and table info provided to write correct PostgreSQL.`,
  });

  return agent;
}
