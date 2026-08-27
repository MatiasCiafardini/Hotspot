import fs from "node:fs";

const file = ".env.staging.local";
if (!fs.existsSync(file)) throw new Error(`Falta ${file}. Ejecuta npm run staging:start.`);
const values = Object.fromEntries(
  fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
const urls = [values.VITE_SUPABASE_URL, values.SUPABASE_URL];
if (
  values.VITE_APP_ENV !== "staging" ||
  urls.some((url) => !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url ?? ""))
) {
  throw new Error("Inicio bloqueado: staging debe apuntar exclusivamente a Supabase local.");
}
console.log("Entorno staging verificado: Supabase local.");
