#!/usr/bin/env node
//
// folderator.js
//
// Usage: ./folderator [folders-file]
//
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const foldersFile = process.argv[2];
if (!foldersFile) {
  console.error("Specify folder list file");
  process.exit(2);
}
if (!fs.existsSync(foldersFile)) {
  console.error(`Folders list file not found: ${foldersFile}`);
  process.exit(2);
}

const lines = fs
  .readFileSync(foldersFile, "utf8")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

if (lines.length === 0) {
  console.error("No folders found in", foldersFile);
  process.exit(2);
}

function resolvePath(p) {
  try {
    return fs.realpathSync(path.resolve(process.cwd(), p));
  } catch {
    return path.resolve(process.cwd(), p);
  }
}
const absPaths = lines.map(resolvePath);

const used = new Set();
function slugify(basename) {
  let s = basename.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (/^[0-9]/.test(s)) s = "_" + s;
  if (!s) s = "dir";
  return s;
}
function makeAliasName(p) {
  const base = path.basename(p) || p.replace(/[\/\\]+/g, "_");
  let slug = slugify(base);
  let alias = `go-${slug}`;
  let i = 2;
  while (used.has(alias)) {
    alias = `go-${slug}-${i++}`;
  }
  used.add(alias);
  return alias;
}
const aliasPairs = absPaths.map((p) => ({ alias: makeAliasName(p), path: p }));

// Build .zshrc snippet
let zshrc = `# --- folderator generated .zshrc ---
# Generated: ${new Date().toISOString()}

__FOLDERATOR_DIRS=(\n`;
for (const a of aliasPairs) {
  zshrc += `  '${a.path.replace(/'/g, "'\"'\"'")}'\n`;
}
zshrc += ")\n\n";

// Aliases
for (const a of aliasPairs) {
  const esc = a.path.replace(/'/g, "'\"'\"'");
  zshrc += `alias ${a.alias}="cd '${esc}'"\n`;
}
zshrc += "\n";

// iterate function
zshrc += `
iterate() {
  if (( $# == 0 )); then
    for d in "\${__FOLDERATOR_DIRS[@]}"; do
      echo "=== $d ==="
      if command -v tmux >/dev/null 2>&1; then
        tmux new-window -c "$d" "$SHELL"
      elif command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal --working-directory="$d" &
      elif command -v osascript >/dev/null 2>&1 && [[ "$(uname)" == "Darwin" ]]; then
        osascript -e "tell application \\"Terminal\\" to do script \\"cd '$d'; exec $SHELL\\"" >/dev/null 2>&1 &
      else
        (cd "$d" && echo "Subshell in $d (exit to continue)" && $SHELL) &
      fi
    done
    wait
  else
    local cmd="$*"
    for d in "\${__FOLDERATOR_DIRS[@]}"; do
      echo "=== $d ==="
      (cd "$d" && eval "$cmd")
    done
  fi
}
`;

// Source the normal ~/.zshrc
zshrc += `

if [ -f "${process.env.HOME}/.zshrc" ]; then
  source "${process.env.HOME}/.zshrc"
fi
`;

// Write temp zshrc and spawn zsh
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "folderator-"));
const zshrcPath = path.join(tmpDir, ".zshrc");
fs.writeFileSync(zshrcPath, zshrc, { mode: 0o600 });

const child = spawn("zsh", ["-i"], {
  stdio: "inherit",
  env: { ...process.env, ZDOTDIR: tmpDir, PROMPT_CHAR: `$${foldersFile}>` },
});

child.on("exit", () => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
