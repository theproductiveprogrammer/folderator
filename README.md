# Folderator

A TypeScript tool for quickly working in a subset of folders with generated shell aliases.

## Features

- Generate shell aliases for quick navigation to specific folders
- Interactive shell with custom prompt
- Iterate through folders with commands
- Beautiful colored output with emojis and visual indicators
- Clean TypeScript implementation with proper error handling

## Installation

1. Clone or download this repository
2. Install globally:
```bash
npm run deploy
```

This will build the TypeScript code and make `folderator` available.

To uninstall:
```bash
npm unlink -g folderator
```

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript code:
```bash
npm run build
```

## Usage

### Basic Usage

```bash
# Using the command (after installation)
folderator <folder-list-file>

# Or using the compiled JavaScript directly
node dist/folderator.js <folder-list-file>

# Or using ts-node for development
npm run dev <folder-list-file>
```

### Folder List File

Create a text file with one folder path per line. You can also use custom names for aliases:

```
/Users/username/projects/project1
/Users/username/projects/project2
/Users/username/documents/work
my-custom-name: ../../path
another-project: /Users/username/special-project
```

### Generated Commands

The tool generates:
- `go-<folder-name>` aliases for each folder
- `go-<custom-name>` aliases for named lines (e.g., `go-my-custom-name`)
- An `iterate` function to run commands across all folders

### Named Lines

Use the `name: path` format to specify custom alias names:

- `my-project: /path/to/folder` - Creates alias `go-my-project`
- `backend: ../../relative/path` - Creates alias `go-backend`
- Regular lines without `name:` use the folder basename automatically

### Example

```bash
# Create a folder list with named lines
echo "/Users/username/projects/app1
/Users/username/projects/app2
my-custom-name: ../../my-custom-folder
backend: /Users/username/special-project" > my-folders.txt

# Run folderator
folderator my-folders.txt

# In the generated shell:
go-app1              # Navigate to app1
go-app2              # Navigate to app2
go-my-custom-name    # Navigate to ../../my-custom-folder
go-backend           # Navigate to /Users/username/special-project
iterate              # Interactive iteration through all folders
iterate "git status" # Run git status in all folders
```

## Development

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run with ts-node for development
- `npm run clean` - Remove compiled files

## TypeScript Features

- Strict type checking
- Proper error handling
- Clean class-based architecture
- Interface definitions for type safety
- Beautiful colored output with chalk
- Emoji indicators for better UX
