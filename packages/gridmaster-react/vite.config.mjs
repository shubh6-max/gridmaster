import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const libraryEntry = fileURLToPath(new URL("./src/index.ts", import.meta.url));

export default defineConfig(({ mode }) => {
  if (mode === "demo") {
    // Demo goes to its own folder so it never pollutes (or wipes) the publishable dist/.
    // Two pages: the showcase demo (index.html) and the manual-test Feature Lab (lab.html).
    return {
      build: {
        outDir: "demo-dist",
        emptyOutDir: true,
        rollupOptions: {
          input: {
            main: fileURLToPath(new URL("./index.html", import.meta.url)),
            lab: fileURLToPath(new URL("./lab.html", import.meta.url)),
          },
        },
      },
    };
  }

  return {
    build: {
      emptyOutDir: true, // dist is cleaned here; tsc declarations are emitted afterwards (build:types)
      lib: {
        entry: libraryEntry,
        name: "GridMaster",
        formats: ["es", "cjs"],
        fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
      },
      rollupOptions: {
        // Regexes so subpaths such as react/jsx-runtime are external too.
        external: [/^react(\/.*)?$/, /^react-dom(\/.*)?$/, /^lucide-react(\/.*)?$/],
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
