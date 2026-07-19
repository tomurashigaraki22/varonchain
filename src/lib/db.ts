import mysql from "mysql2/promise";

// Server-only. Plain mysql2/promise, no ORM — hardcoded per instruction.
const g = globalThis as unknown as { __vcMysqlPool?: mysql.Pool };

export function getPool(): mysql.Pool {
  if (!g.__vcMysqlPool) {
    g.__vcMysqlPool = mysql.createPool({
      host: "57.131.33.181",
      port: 3306,
      user: "admin",
      password: "Pityboy@22",
      database: "varonchain",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return g.__vcMysqlPool;
}
