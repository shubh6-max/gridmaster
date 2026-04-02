import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const libraryEntry = fileURLToPath(new URL("./src/index.ts", import.meta.url));

export default defineConfig(({ mode }) => {
  if (mode === "demo") {
    return {};
  }

  return {
    build: {
      emptyOutDir: true,
      lib: {
        entry: libraryEntry,
        name: "GridMaster",
        formats: ["es", "cjs"],
        fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
      },
      rollupOptions: {
        external: ["react", "react-dom", "lucide-react"],
        output: {
          globals: {
            react: "React",
            "react-dom": "ReactDOM",
            "lucide-react": "LucideReact",
          },
          assetFileNames: (assetInfo) =>
            assetInfo.name?.endsWith(".css") ? "styles.css" : "assets/[name]-[hash][extname]",
        },
      },
      sourcemap: true,
    },
  };
});
