import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

// Configuração otimizada com timeout adequado
const client = postgres(process.env.DATABASE_URL!, {
  max: 10,                  // Máximo de conexões
  idle_timeout: 20,         // Timeout para conexões idle (segundos)
  connect_timeout: 10,      // Timeout de conexão (segundos)
  max_lifetime: 60 * 30,    // Tempo de vida máximo da conexão (30 min)
});

export const db = drizzle(client);