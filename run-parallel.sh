#!/bin/bash

# Parallel Claude Code Execution Orchestrator
# Runs independent tasks in parallel to speed up development

set -e

PROJECT_ROOT="${PWD}"
LOGS_DIR="${PROJECT_ROOT}/logs"
mkdir -p "$LOGS_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load API key
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}Error: ANTHROPIC_API_KEY not set${NC}"
    exit 1
fi

# Function to run a task in background
run_task_async() {
    local task_num=$1
    local log_file="${LOGS_DIR}/task-${task_num}.log"
    local task_file="tasks/task-${task_num}-*.md"
    local task_path=$(ls $task_file 2>/dev/null | head -n1)
    
    echo -e "${BLUE}[Task ${task_num}] Starting in background...${NC}"
    
    # Run Claude Code and pipe to log file
    (
        echo "=== Task ${task_num} Started at $(date) ===" > "$log_file"
        claude-code "$task_path" >> "$log_file" 2>&1
        local exit_code=$?
        echo "=== Task ${task_num} Finished at $(date) with exit code ${exit_code} ===" >> "$log_file"
        exit $exit_code
    ) &
    
    # Return PID
    echo $!
}

# Function to wait for all PIDs and check status
wait_for_tasks() {
    local pids=("$@")
    local failed=0
    
    for pid in "${pids[@]}"; do
        if wait $pid; then
            echo -e "${GREEN}✓ Task with PID $pid completed successfully${NC}"
        else
            echo -e "${RED}✗ Task with PID $pid failed${NC}"
            failed=$((failed + 1))
        fi
    done
    
    return $failed
}

# Main execution
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Parallel Claude Code Execution${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Wave 1: Task 1 (must complete first)
echo -e "${YELLOW}=== Wave 1: Stack Parser ===${NC}"
PID_1=$(run_task_async "01")
wait_for_tasks $PID_1
if [ $? -ne 0 ]; then
    echo -e "${RED}Wave 1 failed. Aborting.${NC}"
    exit 1
fi
echo -e "${GREEN}Wave 1 complete!${NC}\n"

# Wave 2: Task 2 (depends on 1)
echo -e "${YELLOW}=== Wave 2: Observable Wrapper ===${NC}"
PID_2=$(run_task_async "02")
wait_for_tasks $PID_2
if [ $? -ne 0 ]; then
    echo -e "${RED}Wave 2 failed. Aborting.${NC}"
    exit 1
fi
echo -e "${GREEN}Wave 2 complete!${NC}\n"

# Wave 3: Tasks 3 & 4 (both depend on 2, independent of each other)
echo -e "${YELLOW}=== Wave 3: Pipe & Subscribe Patching (PARALLEL) ===${NC}"
PID_3=$(run_task_async "03")
PID_4=$(run_task_async "04")
echo -e "${BLUE}Running tasks 3 and 4 in parallel...${NC}"
wait_for_tasks $PID_3 $PID_4
if [ $? -ne 0 ]; then
    echo -e "${RED}Wave 3 had failures. Check logs.${NC}"
    exit 1
fi
echo -e "${GREEN}Wave 3 complete!${NC}\n"

# Wave 4: Tasks 5 & 6 (both depend on 3+4, independent of each other)
echo -e "${YELLOW}=== Wave 4: Debugger API & Special Operators (PARALLEL) ===${NC}"
PID_5=$(run_task_async "05")
PID_6=$(run_task_async "06")
echo -e "${BLUE}Running tasks 5 and 6 in parallel...${NC}"
wait_for_tasks $PID_5 $PID_6
if [ $? -ne 0 ]; then
    echo -e "${RED}Wave 4 had failures. Check logs.${NC}"
    exit 1
fi
echo -e "${GREEN}Wave 4 complete!${NC}\n"

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All tasks completed!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Logs available in:${NC} ${LOGS_DIR}/"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  1. Review logs: ${BLUE}cat logs/task-*.log${NC}"
echo -e "  2. Run tests: ${BLUE}npm test${NC}"
echo -e "  3. Review generated code: ${BLUE}ls -la src/tracking/${NC}"

# Show any warnings or errors from logs
echo -e "\n${YELLOW}Quick error check:${NC}"
grep -i "error\|failed\|exception" logs/task-*.log || echo -e "${GREEN}No errors found in logs${NC}"
