# Claude Code + Docker Setup Guide

## Option 1: Quick Start (Use Existing Docker/Ubuntu)

If you're already in a Docker Ubuntu environment:

```bash
# 1. Download and run setup script
curl -O <your-setup-script-url>/setup-claude-code.sh
chmod +x setup-claude-code.sh
./setup-claude-code.sh

# 2. Follow prompts to enter API key

# 3. Start working
cd rxjs-devtools
npm install
./run-task.sh 01
```

## Option 2: Fresh Docker Environment

### Step 1: Get Your API Key

1. Go to https://console.anthropic.com/settings/keys
2. Create a new API key
3. Copy it (you'll need it in a moment)

### Step 2: Setup Project Directory

```bash
# Create project directory on your host machine
mkdir rxjs-devtools-project
cd rxjs-devtools-project

# Copy all the files you downloaded:
# - setup-claude-code.sh
# - Dockerfile
# - docker-compose.yml
# - All task-*.md files
# - rxjs-devtools-spec.md
```

### Step 3: Create .env File

```bash
# Create .env file with your API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env
```

### Step 4: Build and Run

```bash
# Build the Docker image
docker-compose build

# Start the container
docker-compose up -d

# Enter the container
docker exec -it rxjs-devtools-claude bash

# Inside container, run setup
./setup.sh
```

## Option 3: Manual Docker Setup

```bash
# Build image
docker build -t claude-code-dev .

# Run container with mounted volume
docker run -it \
  -v $(pwd)/rxjs-devtools:/workspace/rxjs-devtools \
  -e ANTHROPIC_API_KEY=sk-ant-your-key-here \
  claude-code-dev

# Inside container
cd /workspace
./setup.sh
```

## Authentication Methods

### Method 1: Environment Variable (Recommended for Docker)

```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

### Method 2: .env File

```bash
# Create .env in project root
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# Claude Code will automatically load it
```

### Method 3: Interactive Prompt

```bash
# Just run setup script without setting API key
./setup-claude-code.sh
# It will prompt you for the key
```

## Running Tasks

### Using the Helper Script

```bash
./run-task.sh 01  # Stack parser
./run-task.sh 02  # Observable wrapper
./run-task.sh 03  # Pipe patching
# etc...
```

### Manual Invocation

```bash
# Basic usage
claude-code tasks/task-01-stack-parser.md

# With specific model
claude-code --model claude-sonnet-4-5-20250929 tasks/task-01-stack-parser.md

# With network restrictions (manual approval)
claude-code --network-mode manual tasks/task-01-stack-parser.md

# No network at all
claude-code --no-network tasks/task-01-stack-parser.md
```

## Workflow

1. **Run a task:**
   ```bash
   ./run-task.sh 01
   ```

2. **Review generated code:**
   ```bash
   cat src/tracking/stack-parser.ts
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

4. **If good, move to next task:**
   ```bash
   ./run-task.sh 02
   ```

5. **If needs fixes, edit the task file and re-run:**
   ```bash
   vim tasks/task-01-stack-parser.md
   ./run-task.sh 01
   ```

## Network Approval Mode

For sandbox environments where you want to manually approve web searches:

```bash
# In docker-compose.yml, set:
# network_mode: none

# Then Claude Code will ask before any network access
claude-code --network-mode manual tasks/task-01-stack-parser.md

# You'll see prompts like:
# "Claude Code wants to access: https://npmjs.com"
# Approve (y/n)?
```

## Troubleshooting

### API Key Not Working

```bash
# Check if key is set
echo $ANTHROPIC_API_KEY

# Check .env file
cat .env

# Test with curl
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Claude Code Not Found

```bash
# Reinstall globally
npm install -g @anthropic-ai/claude-code

# Check installation
which claude-code
claude-code --version
```

### Permission Errors

```bash
# Make scripts executable
chmod +x setup-claude-code.sh
chmod +x run-task.sh

# Fix npm permissions if needed
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Docker Volume Issues

```bash
# Check mounts
docker inspect rxjs-devtools-claude | grep Mounts -A 20

# Recreate container
docker-compose down
docker-compose up -d
```

## Advanced Usage

### Custom Claude Code Options

```bash
# Use specific model
claude-code --model claude-opus-4-1-20241129 tasks/task-01-stack-parser.md

# Increase token limit
claude-code --max-tokens 8000 tasks/task-01-stack-parser.md

# Temperature control
claude-code --temperature 0.3 tasks/task-01-stack-parser.md

# Save conversation
claude-code --save-conversation task-01.json tasks/task-01-stack-parser.md
```

### Batch Processing

```bash
# Run all tasks sequentially
for i in {01..06}; do
  echo "Running task $i..."
  ./run-task.sh $i
  npm test
  read -p "Continue to next task? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    break
  fi
done
```

### Integration with CI/CD

```bash
# Run Claude Code in CI (non-interactive)
claude-code --non-interactive --no-confirm tasks/task-01-stack-parser.md
```

## Tips

1. **Start Small**: Begin with task 01, test thoroughly before moving on
2. **Review Code**: Always review generated code before committing
3. **Test Each Task**: Run tests after each task to catch issues early
4. **Iterate**: If output isn't perfect, refine the task spec and re-run
5. **Save Progress**: Commit after each successful task completion
6. **Use Manual Network**: For sandbox security, use manual network approval mode

## What Gets Generated

After running all tasks, you'll have:

```
rxjs-devtools/
├── src/tracking/
│   ├── stack-parser.ts           ✓ Task 01
│   ├── observable-wrapper.ts     ✓ Task 02
│   ├── registry.ts               ✓ Task 02
│   ├── types.ts                  ✓ Task 02
│   ├── pipe-patch.ts             ✓ Task 03
│   ├── subscribe-patch.ts        ✓ Task 04
│   ├── debugger-api.ts           ✓ Task 05
│   ├── special-operators.ts      ✓ Task 06
│   └── __tests__/
│       ├── stack-parser.test.ts
│       ├── observable-wrapper.test.ts
│       ├── pipe-patch.test.ts
│       ├── subscribe-patch.test.ts
│       ├── debugger-api.test.ts
│       └── special-operators.test.ts
└── index.ts  (optional - exports all APIs)
```

## Next Steps After Completion

1. Create a React DevTools UI (not covered in these tasks)
2. Add more operators beyond top 20
3. Implement oxc/rolldown plugin for better naming
4. Add performance profiling
5. Create marble diagram visualization
6. Time-travel debugging features

Happy coding! 🚀
