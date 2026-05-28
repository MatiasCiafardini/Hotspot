import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverDir = join(root, "dist", "server");
const serverFile = join(serverDir, "server.js");

mkdirSync(serverDir, { recursive: true });
writeFileSync(serverFile, "export { default } from './index.js'\n");
