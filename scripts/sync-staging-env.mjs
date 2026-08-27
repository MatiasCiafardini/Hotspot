import fs from "node:fs";
import { execFileSync } from "node:child_process";

const command = process.platform === "win32" ? "cmd.exe" : "npx";
const args =
  process.platform === "win32"
    ? ["/d", "/s", "/c", "npx supabase status -o json"]
    : ["supabase", "status", "-o", "json"];
const rawStatus = execFileSync(command, args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
const status = JSON.parse(rawStatus);

if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(status.API_URL ?? "")) {
  throw new Error("Configuracion insegura: Supabase CLI no devolvio la API local esperada.");
}

const contents = [
  "# Generado automaticamente. No usar en produccion.",
  "VITE_APP_ENV=staging",
  `VITE_SUPABASE_URL=${status.API_URL}`,
  `VITE_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}`,
  `SUPABASE_URL=${status.API_URL}`,
  `SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}`,
  `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
  "CUSTOMER_SESSION_SECRET=local-staging-secret-only-not-for-production",
  "",
].join("\n");

fs.writeFileSync(".env.staging.local", contents);
console.log("Credenciales de staging sincronizadas con la instancia local activa.");
