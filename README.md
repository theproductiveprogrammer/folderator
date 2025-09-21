# Folderator

A TypeScript tool for quickly working in a subset of folders with generated shell aliases.

## Features

- Generate shell aliases for quick navigation to specific folders
- Interactive shell with custom prompt
- Iterate through folders with commands
- Beautiful colored output with emojis and visual indicators
- Clean TypeScript implementation with proper error handling

## Installation

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
# Using the compiled JavaScript
node dist/folderator.js <folder-list-file>

# Or using ts-node for development
npm run dev <folder-list-file>
```

### Folder List File

Create a text file with one folder path per line:

```
/Users/username/projects/project1
/Users/username/projects/project2
/Users/username/documents/work
```

### Generated Commands

The tool generates:
- `go-<folder-name>` aliases for each folder
- An `iterate` function to run commands across all folders

### Example

```bash
# Create a folder list
echo "/Users/username/projects/app1
/Users/username/projects/app2" > my-folders.txt

# Run folderator
npm run dev my-folders.txt

# In the generated shell:
go-app1          # Navigate to app1
go-app2          # Navigate to app2
iterate          # Interactive iteration through all folders
iterate "git status"  # Run git status in all folders
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
