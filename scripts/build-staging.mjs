import fs from "node:fs";
import { spawn } from "node:child_process";

const stagingEnv = Object.fromEntries(
  fs
    .readFileSync(".env.staging.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
if (
  stagingEnv.VITE_APP_ENV !== "staging" ||
  !stagingEnv.SUPABASE_URL?.startsWith("http://127.0.0.1:54321")
) {
  throw new Error("Build bloqueado: staging no apunta a Supabase local.");
}
const vite = new URL("../node_modules/vite/bin/vite.js", import.meta.url).pathname.replace(
  /^\/(.:\/)/,
  "$1",
);
const child = spawn(process.execPath, [vite, "build"], {
  stdio: "inherit",
  env: { ...process.env, ...stagingEnv },
});
await new Promise((resolve, reject) =>
  child.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`Vite termino con codigo ${code}.`)),
  ),
);
await import("./ensure-preview-server.mjs");
const serverVars = Object.entries(stagingEnv)
  .filter(([key]) => !key.startsWith("VITE_APP_ENV"))
  .map(([key, value]) => `${key}=${value}`)
  .join("\n");
fs.writeFileSync("dist/server/.dev.vars", `${serverVars}\n`);
console.log("Build staging creado y servidor fijado a Supabase local.");
