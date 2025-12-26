#!/bin/bash
# Helper script to run Claude Code tasks

set -e

# Load API key from .env if it exists
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

TASK_NUM=$1

if [ -z "$TASK_NUM" ]; then
    echo "Usage: ./run-task.sh <task-number>"
    echo "Example: ./run-task.sh 01"
    echo ""
    echo "Available tasks:"
    ls -1 tasks/task-*.md | sed 's/tasks\/task-/  /' | sed 's/.md//'
    exit 1
fi

TASK_FILE="tasks/task-${TASK_NUM}-*.md"

# Find the task file
TASK_PATH=$(ls $TASK_FILE 2>/dev/null | head -n1)

if [ -z "$TASK_PATH" ]; then
    echo "Error: Task $TASK_NUM not found"
    echo "Available tasks:"
    ls -1 tasks/task-*.md | sed 's/tasks\/task-/  /' | sed 's/.md//'
    exit 1
fi

echo "Running Claude Code on: $(basename $TASK_PATH)"
echo "================================"
echo ""

# Run Claude Code with the task file
# --network flag for manual approval mode if you want it
claude "$TASK_PATH"

echo ""
echo "================================"
echo "Task completed. Review the generated code and run tests."
