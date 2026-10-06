import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, "portfolio-dist");
const portfolio = path.join(root, "portfolio");
const screenshotSource = path.join(root, "screenshots");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const filename of ["index.html", "styles.css", "script.js"]) {
  await cp(path.join(portfolio, filename), path.join(output, filename));
}

const htmlPath = path.join(output, "index.html");
const html = await readFile(htmlPath, "utf8");
await writeFile(htmlPath, html.replaceAll("../screenshots/", "screenshots/"));

const screenshotOutput = path.join(output, "screenshots");
await mkdir(screenshotOutput, { recursive: true });
for (const filename of ["dashboard.png", "playground-1.png", "playground-2.png"]) {
  await cp(
    path.join(screenshotSource, filename),
    path.join(screenshotOutput, filename),
  );
}

console.log(`Netlify site prepared at ${path.relative(root, output)}`);
