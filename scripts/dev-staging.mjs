import fs from "node:fs";
import { spawn } from "node:child_process";

const file = ".env.staging.local";
if (!fs.existsSync(file)) throw new Error(`Falta ${file}.`);
const stagingEnv = Object.fromEntries(
  fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
if (
  stagingEnv.VITE_APP_ENV !== "staging" ||
  !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(stagingEnv.VITE_SUPABASE_URL ?? "")
) {
  throw new Error("Inicio bloqueado: staging no apunta a Supabase local.");
}
console.log("Entorno staging verificado: Supabase local.");
const vite = new URL("../node_modules/vite/bin/vite.js", import.meta.url).pathname.replace(
  /^\/(.:\/)/,
  "$1",
);
const child = spawn(
  process.execPath,
  [vite, "dev", "--mode", "staging", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, ...stagingEnv },
  },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
