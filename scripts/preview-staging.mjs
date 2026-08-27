import fs from "node:fs";
import { spawn } from "node:child_process";

const vars = fs.readFileSync("dist/server/.dev.vars", "utf8");
if (!vars.includes("127.0.0.1:54321") || vars.includes("oivijyuwgszpybahpfob"))
  throw new Error("Preview bloqueado: el build no es de staging local.");
const env = Object.fromEntries(
  vars
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const vite = new URL("../node_modules/vite/bin/vite.js", import.meta.url).pathname.replace(
  /^\/(.:\/)/,
  "$1",
);
const child = spawn(process.execPath, [vite, "preview", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ...env },
});
child.on("exit", (code, signal) =>
  signal ? process.kill(process.pid, signal) : process.exit(code ?? 1),
);
