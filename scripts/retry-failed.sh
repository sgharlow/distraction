#!/bin/bash
# Re-run failed weeks from backfill with delays to avoid GDELT rate limits
FAILED_WEEKS=(
  "2025-01-18"
  "2025-05-17"
  "2025-05-24"
  "2025-10-17"
  "2025-10-24"
  "2025-12-05"
  "2025-12-19"
  "2025-12-26"
  "2026-01-30"
)

TOTAL=${#FAILED_WEEKS[@]}
IDX=0

for WEEK in "${FAILED_WEEKS[@]}"; do
  IDX=$((IDX + 1))
  echo ""
  echo "============================================================"
  echo "RETRY $IDX/$TOTAL: Week $WEEK"
  echo "============================================================"
  npx tsx scripts/backfill.ts --week "$WEEK" 2>&1
  
  if [ $IDX -lt $TOTAL ]; then
    echo "  Waiting 90 seconds before next week (GDELT rate limit)..."
    sleep 90
  fi
done

echo ""
echo "============================================================"
echo "ALL RETRIES COMPLETE"
echo "============================================================"
