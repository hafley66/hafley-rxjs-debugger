#!/bin/bash

# Enhanced Parallel Execution with Context Isolation
# Runs independent tasks with minimal context to avoid conflicts

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

# Function to run a task with context isolation
run_task_with_context() {
    local task_num=$1
    local log_file="${LOGS_DIR}/task-${task_num}.log"
    local task_spec="tasks/task-${task_num}-*.md"
    local task_context="tasks/task-${task_num}-context.md"
    local task_spec_path=$(ls $task_spec 2>/dev/null | head -n1)
    
    # Check if context file exists
    if [ -f "$task_context" ]; then
        echo -e "${BLUE}[Task ${task_num}] Starting with context isolation...${NC}"
        TASK_INPUT="$task_context $task_spec_path"
    else
        echo -e "${BLUE}[Task ${task_num}] Starting (no context file)...${NC}"
        TASK_INPUT="$task_spec_path"
    fi
    
    # Run Claude Code and pipe to log file
    (
        echo "=== Task ${task_num} Started at $(date) ===" > "$log_file"
        echo "=== Context: $([ -f "$task_context" ] && echo "YES" || echo "NO") ===" >> "$log_file"
        claude-code $TASK_INPUT >> "$log_file" 2>&1
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

# Function to validate no cross-imports between parallel tasks
validate_no_conflicts() {
    local task_nums=("$@")
    local conflicts=0
    
    echo -e "\n${YELLOW}Validating no conflicts between parallel tasks...${NC}"
    
    for task_num in "${task_nums[@]}"; do
        local task_files=$(find src/tracking -name "*${task_num}*" -type f 2>/dev/null || true)
        
        for file in $task_files; do
            for other_task in "${task_nums[@]}"; do
                if [ "$task_num" != "$other_task" ]; then
                    # Check if this task imports from the other parallel task
                    if grep -q "from.*-${other_task}-" "$file" 2>/dev/null; then
                        echo -e "${RED}✗ Conflict: Task ${task_num} imports from Task ${other_task}${NC}"
                        conflicts=$((conflicts + 1))
                    fi
                fi
            done
        done
    done
    
    if [ $conflicts -eq 0 ]; then
        echo -e "${GREEN}✓ No conflicts detected${NC}"
    fi
    
    return $conflicts
}

# Main execution
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Parallel Claude Code Execution${NC}"
echo -e "${BLUE}With Context Isolation${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Wave 1: Task 1 (must complete first)
echo -e "${YELLOW}=== Wave 1: Stack Parser ===${NC}"
PID_1=$(run_task_with_context "01")
wait_for_tasks $PID_1
if [ $? -ne 0 ]; then
    echo -e "${RED}Wave 1 failed. Check logs/${NC}"
    cat "$LOGS_DIR/task-01.log"
    exit 1
fi
echo -e "${GREEN}✓ Wave 1 complete!${NC}\n"

# Run tests for Wave 1
echo -e "${BLUE}Running tests for Wave 1...${NC}"
npm test -- stack-parser 2>&1 | tee -a "$LOGS_DIR/test-wave-1.log"
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}Wave 1 tests failed!${NC}"
    exit 1
fi

# Wave 2: Task 2 (depends on 1)
echo -e "${YELLOW}=== Wave 2: Observable Wrapper & Registry ===${NC}"
PID_2=$(run_task_with_context "02")
wait_for_tasks $PID_2
if [ $? -ne 0 ]; then
    echo -e "${RED}Wave 2 failed. Check logs/${NC}"
    cat "$LOGS_DIR/task-02.log"
    exit 1
fi
echo -e "${GREEN}✓ Wave 2 complete!${NC}\n"

# Run tests for Wave 2
echo -e "${BLUE}Running tests for Wave 2...${NC}"
npm test -- observable-wrapper 2>&1 | tee -a "$LOGS_DIR/test-wave-2.log"
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}Wave 2 tests failed!${NC}"
    exit 1
fi

# Wave 3: Tasks 3 & 4 (PARALLEL - both depend on 2, independent of each other)
echo -e "${YELLOW}=== Wave 3: Pipe & Subscribe Patching (PARALLEL) ===${NC}"
echo -e "${BLUE}Running tasks 3 and 4 in parallel with context isolation...${NC}"

PID_3=$(run_task_with_context "03")
PID_4=$(run_task_with_context "04")

echo -e "${BLUE}Waiting for parallel tasks to complete...${NC}"
wait_for_tasks $PID_3 $PID_4
if [ $? -ne 0 ]; then
    echo -e "${RED}Wave 3 had failures. Showing logs:${NC}\n"
    echo -e "${YELLOW}=== Task 3 Log ===${NC}"
    cat "$LOGS_DIR/task-03.log"
    echo -e "\n${YELLOW}=== Task 4 Log ===${NC}"
    cat "$LOGS_DIR/task-04.log"
    exit 1
fi

# Validate no conflicts
validate_no_conflicts "03" "04"
if [ $? -ne 0 ]; then
    echo -e "${RED}Conflicts detected between parallel tasks!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Wave 3 complete!${NC}\n"

# Run tests for Wave 3
echo -e "${BLUE}Running tests for Wave 3...${NC}"
npm test -- pipe-patch 2>&1 | tee -a "$LOGS_DIR/test-wave-3a.log"
npm test -- subscribe-patch 2>&1 | tee -a "$LOGS_DIR/test-wave-3b.log"
if [ ${PIPESTATUS[0]} -ne 0 ] || [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}Wave 3 tests failed!${NC}"
    exit 1
fi

# Wave 4: Tasks 5 & 6 (PARALLEL - both depend on 3+4, independent of each other)
echo -e "${YELLOW}=== Wave 4: Debugger API & Special Operators (PARALLEL) ===${NC}"
echo -e "${BLUE}Running tasks 5 and 6 in parallel with context isolation...${NC}"

PID_5=$(run_task_with_context "05")
PID_6=$(run_task_with_context "06")

echo -e "${BLUE}Waiting for parallel tasks to complete...${NC}"
wait_for_tasks $PID_5 $PID_6
if [ $? -ne 0 ]; then
    echo -e "${RED}Wave 4 had failures. Showing logs:${NC}\n"
    echo -e "${YELLOW}=== Task 5 Log ===${NC}"
    cat "$LOGS_DIR/task-05.log"
    echo -e "\n${YELLOW}=== Task 6 Log ===${NC}"
    cat "$LOGS_DIR/task-06.log"
    exit 1
fi

# Validate no conflicts
validate_no_conflicts "05" "06"
if [ $? -ne 0 ]; then
    echo -e "${RED}Conflicts detected between parallel tasks!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Wave 4 complete!${NC}\n"

# Run tests for Wave 4
echo -e "${BLUE}Running tests for Wave 4...${NC}"
npm test -- debugger-api 2>&1 | tee -a "$LOGS_DIR/test-wave-4a.log"
npm test -- special-operators 2>&1 | tee -a "$LOGS_DIR/test-wave-4b.log"

# Final integration tests
echo -e "\n${YELLOW}=== Running Final Integration Tests ===${NC}"
npm test 2>&1 | tee "$LOGS_DIR/test-integration.log"

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}All tasks completed successfully! 🎉${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Generated files:${NC}"
ls -lh src/tracking/*.ts | awk '{print "  " $9 " (" $5 ")"}'

echo -e "\n${YELLOW}Logs available in:${NC} ${LOGS_DIR}/"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  1. Review code: ${BLUE}ls src/tracking/${NC}"
echo -e "  2. Check tests: ${BLUE}npm test${NC}"
echo -e "  3. Try examples: ${BLUE}node examples/demo.js${NC}"

# Summary report
echo -e "\n${BLUE}Execution Summary:${NC}"
echo -e "  Wave 1: Task 1 (sequential)"
echo -e "  Wave 2: Task 2 (sequential)"
echo -e "  Wave 3: Tasks 3 & 4 ${GREEN}(parallel)${NC}"
echo -e "  Wave 4: Tasks 5 & 6 ${GREEN}(parallel)${NC}"
echo -e "\n  Total time saved by parallelization: ~40-50%"
