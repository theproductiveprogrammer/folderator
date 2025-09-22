#!/usr/bin/env node
"use strict";
//
// folderator
//
// Usage: folderator [folder-list-file]
//
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
class Folderator {
    constructor(foldersFile) {
        this.usedAliases = new Set();
        this.config = {
            foldersFile,
            currName: path.basename(foldersFile),
            lines: [],
            absPaths: [],
            aliasPairs: [],
        };
    }
    validateInput() {
        if (!this.config.foldersFile) {
            this.printUsage();
            process.exit(2);
        }
        try {
            if (!fs.existsSync(this.config.foldersFile)) {
                console.error(chalk_1.default.red.bold("❌ Folders list file not found:"), chalk_1.default.yellow(this.config.foldersFile));
                process.exit(2);
            }
        }
        catch (error) {
            console.error(chalk_1.default.red.bold("❌ Error checking file existence:"), chalk_1.default.red(error instanceof Error ? error.message : "Unknown error"));
            process.exit(2);
        }
    }
    printUsage() {
        console.log(chalk_1.default.blue.bold(`folderator: quickly work in a subset of folders`));
        console.log(chalk_1.default.yellow(`Usage: folderator <folder-list-file>`));
        console.log(chalk_1.default.gray(`    where folder-list-file : file containing list of folders (one per line)`));
        console.log();
        console.log(chalk_1.default.gray(`    Use "name: /path/to/folder" for custom alias names`));
        console.log();
    }
    loadFolders() {
        try {
            const content = fs.readFileSync(this.config.foldersFile, "utf8");
            this.config.lines = content
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean);
            if (this.config.lines.length === 0) {
                console.error(chalk_1.default.red.bold("❌ No folders found in"), chalk_1.default.yellow(this.config.foldersFile));
                process.exit(2);
            }
        }
        catch (error) {
            console.error(chalk_1.default.red.bold("❌ Error reading folders file:"), chalk_1.default.red(error instanceof Error ? error.message : "Unknown error"));
            process.exit(2);
        }
    }
    resolvePath(p) {
        try {
            return fs.realpathSync(path.resolve(process.cwd(), p));
        }
        catch {
            return path.resolve(process.cwd(), p);
        }
    }
    parseFolderLine(line) {
        const trimmedLine = line.trim();
        // Check if line has the "name:" format
        const colonIndex = trimmedLine.indexOf(":");
        if (colonIndex > 0) {
            const name = trimmedLine.substring(0, colonIndex).trim();
            const pathPart = trimmedLine.substring(colonIndex + 1).trim();
            if (!name) {
                throw new Error(`Invalid named line format: "${line}" - name is empty before ":"`);
            }
            if (!pathPart) {
                throw new Error(`Invalid named line format: "${line}" - path is empty after ":"`);
            }
            return { path: pathPart, name };
        }
        // Regular line - no custom name
        return { path: trimmedLine };
    }
    slugify(basename) {
        let s = basename.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
        if (/^[0-9]/.test(s))
            s = "_" + s;
        if (!s)
            s = "dir";
        return s;
    }
    makeAliasName(p, customName) {
        const base = customName || path.basename(p) || p.replace(/[\/\\]+/g, "_");
        let slug = this.slugify(base);
        let alias = `go-${slug}`;
        let i = 2;
        while (this.usedAliases.has(alias)) {
            alias = `go-${slug}-${i++}`;
        }
        this.usedAliases.add(alias);
        return alias;
    }
    generateAliases() {
        this.config.aliasPairs = this.config.lines.map((line) => {
            try {
                const { path: folderPath, name } = this.parseFolderLine(line);
                const resolvedPath = this.resolvePath(folderPath);
                const aliasPair = {
                    alias: this.makeAliasName(resolvedPath, name),
                    path: resolvedPath,
                };
                if (name) {
                    aliasPair.name = name;
                }
                return aliasPair;
            }
            catch (error) {
                console.error(chalk_1.default.red.bold("❌ Error parsing line:"), chalk_1.default.yellow(`"${line}"`), chalk_1.default.red(error instanceof Error ? error.message : "Unknown error"));
                process.exit(2);
            }
        });
    }
    escapePath(p) {
        return p.replace(/'/g, "'\"'\"'");
    }
    generateZshrc() {
        let zshrc = `# --- folderator generated .zshrc ---
# Generated: ${new Date().toISOString()}

__FOLDERATOR_DIRS=(\n`;
        for (const alias of this.config.aliasPairs) {
            zshrc += `  '${this.escapePath(alias.path)}'\n`;
        }
        zshrc += ")\n\n";
        // Aliases
        for (const alias of this.config.aliasPairs) {
            const esc = this.escapePath(alias.path);
            zshrc += `alias ${alias.alias}="cd '${esc}'"\n`;
        }
        zshrc += "\n";
        // iterate function
        zshrc += `
iterate() {
  OLD_FOLDERATOR_PROMPT="$FOLDERATOR_PROMPT"
  if (( $# == 0 )); then
    for d in "\${__FOLDERATOR_DIRS[@]}"; do
      export FOLDERATOR_PROMPT='$(itr)>'
      (cd "$d" && echo "\\033[1;34m📁 Iterating subshell in $d (exit to continue)\\033[0m" && $SHELL)
    done
  else
    local cmd="$*"
    for d in "\${__FOLDERATOR_DIRS[@]}"; do
      echo "\\033[1;34m=== $d ===\\033[0m"
      (cd "$d" && eval "$cmd")
    done
  fi
  FOLDERATOR_PROMPT="$OLD_FOLDERATOR_PROMPT"
}
`;
        // Source the existing ~/.zshrc
        zshrc += `

if [ -f "${process.env.HOME}/.zshrc" ]; then
  source "${process.env.HOME}/.zshrc"
fi
`;
        return zshrc;
    }
    createTempEnvironment() {
        try {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "folderator-"));
            const zshrcPath = path.join(tmpDir, ".zshrc");
            const zshrc = this.generateZshrc();
            fs.writeFileSync(zshrcPath, zshrc, { mode: 0o600 });
            return tmpDir;
        }
        catch (error) {
            console.error(chalk_1.default.red.bold("❌ Error creating temporary environment:"), chalk_1.default.red(error instanceof Error ? error.message : "Unknown error"));
            process.exit(2);
        }
    }
    printAvailableCommands() {
        console.log();
        console.log(chalk_1.default.blue.bold("📁"), chalk_1.default.blue.bold(this.config.currName));
        console.log(chalk_1.default.green.bold("✨ Commands available:"));
        for (const alias of this.config.aliasPairs) {
            const displayName = alias.name ? chalk_1.default.cyan(`(${alias.name})`) : "";
            console.log(chalk_1.default.gray("    "), chalk_1.default.blue(alias.alias), displayName, chalk_1.default.gray("→"), chalk_1.default.dim(alias.path));
        }
        console.log(chalk_1.default.gray("    "), chalk_1.default.magenta("iterate"), chalk_1.default.gray("→ run commands across all folders"));
        console.log();
    }
    spawnZsh(tmpDir) {
        return (0, child_process_1.spawn)("zsh", ["-i"], {
            stdio: "inherit",
            env: {
                ...process.env,
                ZDOTDIR: tmpDir,
                FOLDERATOR_PROMPT: `$>`,
            },
        });
    }
    cleanup(tmpDir) {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        catch (error) {
            console.error(chalk_1.default.yellow.bold("⚠️  Warning: Failed to cleanup temporary directory:"), chalk_1.default.yellow(error instanceof Error ? error.message : "Unknown error"));
        }
    }
    run() {
        this.validateInput();
        this.loadFolders();
        this.generateAliases();
        const tmpDir = this.createTempEnvironment();
        this.printAvailableCommands();
        const child = this.spawnZsh(tmpDir);
        child.on("exit", () => {
            this.cleanup(tmpDir);
        });
    }
}
// Main execution
const foldersFile = process.argv[2];
if (!foldersFile) {
    console.log(chalk_1.default.blue.bold("folderator: quickly work in a subset of folders"));
    console.log(chalk_1.default.yellow("Usage: folderator <folder-list-file>"));
    console.log(chalk_1.default.gray("    where folder-list-file : file containing list of folders (one per line)"));
    console.log();
    console.log(chalk_1.default.gray('    Use "name: /path/to/folder" for custom alias names'));
    console.log();
    process.exit(2);
}
const folderator = new Folderator(foldersFile);
folderator.run();
//# sourceMappingURL=folderator.js.map