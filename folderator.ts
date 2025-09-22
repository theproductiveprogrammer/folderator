#!/usr/bin/env node
//
// folderator
//
// Usage: folderator [folder-list-file]
//

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";
import chalk from "chalk";

interface AliasPair {
	alias: string;
	path: string;
	name?: string; // Optional custom name for the alias
}

interface FolderatorConfig {
	foldersFile: string;
	currName: string;
	lines: string[];
	absPaths: string[];
	aliasPairs: AliasPair[];
}

class Folderator {
	private config: FolderatorConfig;
	private usedAliases = new Set<string>();

	constructor(foldersFile: string) {
		this.config = {
			foldersFile,
			currName: path.basename(foldersFile),
			lines: [],
			absPaths: [],
			aliasPairs: [],
		};
	}

	private validateInput(): void {
		if (!this.config.foldersFile) {
			this.printUsage();
			process.exit(2);
		}

		try {
			if (!fs.existsSync(this.config.foldersFile)) {
				console.error(
					chalk.red.bold("❌ Folders list file not found:"),
					chalk.yellow(this.config.foldersFile)
				);
				process.exit(2);
			}
		} catch (error) {
			console.error(
				chalk.red.bold("❌ Error checking file existence:"),
				chalk.red(error instanceof Error ? error.message : "Unknown error")
			);
			process.exit(2);
		}
	}

	private printUsage(): void {
		console.log(
			chalk.blue.bold(`folderator: quickly work in a subset of folders`)
		);
		console.log(chalk.yellow(`Usage: folderator <folder-list-file>`));
		console.log(
			chalk.gray(
				`    where folder-list-file : file containing list of folders (one per line)`
			)
		);
		console.log();
		console.log(
			chalk.gray(`    Use "name: /path/to/folder" for custom alias names`)
		);
		console.log();
	}

	private loadFolders(): void {
		try {
			const content = fs.readFileSync(this.config.foldersFile, "utf8");
			this.config.lines = content
				.split(/\r?\n/)
				.map((s: string) => s.trim())
				.filter(Boolean);

			if (this.config.lines.length === 0) {
				console.error(
					chalk.red.bold("❌ No folders found in"),
					chalk.yellow(this.config.foldersFile)
				);
				process.exit(2);
			}
		} catch (error) {
			console.error(
				chalk.red.bold("❌ Error reading folders file:"),
				chalk.red(error instanceof Error ? error.message : "Unknown error")
			);
			process.exit(2);
		}
	}

	private resolvePath(p: string): string {
		try {
			return fs.realpathSync(path.resolve(process.cwd(), p));
		} catch {
			return path.resolve(process.cwd(), p);
		}
	}

	private parseFolderLine(line: string): { path: string; name?: string } {
		const trimmedLine = line.trim();

		// Check if line has the "name:" format
		const colonIndex = trimmedLine.indexOf(":");
		if (colonIndex > 0) {
			const name = trimmedLine.substring(0, colonIndex).trim();
			const pathPart = trimmedLine.substring(colonIndex + 1).trim();

			if (!name) {
				throw new Error(
					`Invalid named line format: "${line}" - name is empty before ":"`
				);
			}
			if (!pathPart) {
				throw new Error(
					`Invalid named line format: "${line}" - path is empty after ":"`
				);
			}

			return { path: pathPart, name };
		}

		// Regular line - no custom name
		return { path: trimmedLine };
	}

	private slugify(basename: string): string {
		let s = basename.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
		if (/^[0-9]/.test(s)) s = "_" + s;
		if (!s) s = "dir";
		return s;
	}

	private makeAliasName(p: string, customName?: string): string {
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

	private generateAliases(): void {
		this.config.aliasPairs = this.config.lines.map((line: string) => {
			try {
				const { path: folderPath, name } = this.parseFolderLine(line);
				const resolvedPath = this.resolvePath(folderPath);
				const aliasPair: AliasPair = {
					alias: this.makeAliasName(resolvedPath, name),
					path: resolvedPath,
				};
				if (name) {
					aliasPair.name = name;
				}
				return aliasPair;
			} catch (error) {
				console.error(
					chalk.red.bold("❌ Error parsing line:"),
					chalk.yellow(`"${line}"`),
					chalk.red(error instanceof Error ? error.message : "Unknown error")
				);
				process.exit(2);
			}
		});
	}

	private escapePath(p: string): string {
		return p.replace(/'/g, "'\"'\"'");
	}

	private generateZshrc(): string {
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
  OLD_PROMPT_CHAR="$PROMPT_CHAR"
  if (( $# == 0 )); then
    for d in "\${__FOLDERATOR_DIRS[@]}"; do
      export PROMPT_CHAR='$${this.config.currName}-(itr)>'
      (cd "$d" && echo "\\033[1;34m📁 Iterating subshell in $d (exit to continue)\\033[0m" && $SHELL)
    done
  else
    local cmd="$*"
    for d in "\${__FOLDERATOR_DIRS[@]}"; do
      echo "\\033[1;34m=== $d ===\\033[0m"
      (cd "$d" && eval "$cmd")
    done
  fi
  PROMPT_CHAR="$OLD_PROMPT_CHAR"
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

	private createTempEnvironment(): string {
		try {
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "folderator-"));
			const zshrcPath = path.join(tmpDir, ".zshrc");
			const zshrc = this.generateZshrc();

			fs.writeFileSync(zshrcPath, zshrc, { mode: 0o600 });
			return tmpDir;
		} catch (error) {
			console.error(
				chalk.red.bold("❌ Error creating temporary environment:"),
				chalk.red(error instanceof Error ? error.message : "Unknown error")
			);
			process.exit(2);
		}
	}

	private printAvailableCommands(): void {
		console.log();
		console.log(chalk.blue.bold("📁"), chalk.blue.bold(this.config.currName));
		console.log(chalk.green.bold("✨ Commands available:"));
		for (const alias of this.config.aliasPairs) {
			const displayName = alias.name ? chalk.cyan(`(${alias.name})`) : "";
			console.log(
				chalk.gray("    "),
				chalk.blue(alias.alias),
				displayName,
				chalk.gray("→"),
				chalk.dim(alias.path)
			);
		}
		console.log(
			chalk.gray("    "),
			chalk.magenta("iterate"),
			chalk.gray("→ run commands across all folders")
		);
		console.log();
	}

	private spawnZsh(tmpDir: string): ChildProcess {
		return spawn("zsh", ["-i"], {
			stdio: "inherit",
			env: {
				...process.env,
				ZDOTDIR: tmpDir,
				PROMPT_CHAR: `$${this.config.currName}>`,
			},
		});
	}

	private cleanup(tmpDir: string): void {
		try {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		} catch (error) {
			console.error(
				chalk.yellow.bold(
					"⚠️  Warning: Failed to cleanup temporary directory:"
				),
				chalk.yellow(error instanceof Error ? error.message : "Unknown error")
			);
		}
	}

	public run(): void {
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
	console.log(
		chalk.blue.bold("folderator: quickly work in a subset of folders")
	);
	console.log(chalk.yellow("Usage: folderator <folder-list-file>"));
	console.log(
		chalk.gray(
			"    where folder-list-file : file containing list of folders (one per line)"
		)
	);
	console.log();
	console.log(
		chalk.gray('    Use "name: /path/to/folder" for custom alias names')
	);
	console.log();
	process.exit(2);
}
const folderator = new Folderator(foldersFile);
folderator.run();
