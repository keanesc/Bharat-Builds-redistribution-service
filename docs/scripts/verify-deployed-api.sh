#!/usr/bin/env bash

# Verify the deployed RescueRadius API without using AWS credentials in the API
# calls. Set API_URL or pass the API URL as the first argument. If AWS_PROFILE
# names an available AWS CLI profile, the optional CloudWatch log-group check is
# also performed read-only.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: API_URL=https://... ./scripts/verify-deployed-api.sh
   or: ./scripts/verify-deployed-api.sh https://...

Optional environment:
  AWS_PROFILE       Existing AWS CLI profile for the read-only log-group check
  AWS_REGION        Region for that check (defaults to the profile's region,
                    then ap-south-1)
USAGE
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

warn() {
  printf 'WARN: %s\n' "$*" >&2
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

api_url="${1:-${API_URL:-}}"
[[ -n "$api_url" ]] || { usage >&2; fail "API_URL is required"; }
[[ "$api_url" =~ ^https?:// ]] || fail "API_URL must begin with http:// or https://"
api_url="${api_url%/}"

for dependency in curl jq; do
  command -v "$dependency" >/dev/null 2>&1 || fail "required command not found: $dependency"
done

run_dir="$(mktemp -d)"
cleanup() {
  rm -r -- "$run_dir"
}
trap cleanup EXIT

# CloudWatch timestamps are epoch milliseconds. Capture this before the first
# API call so later log activity can be tied to this smoke-test run.
script_start_epoch_ms="$(( $(date -u +%s) * 1000 ))"

request_number=0
last_response=""
last_status=""

print_response_failure() {
  local description=$1
  printf '  %s response body:\n' "$description" >&2
  if [[ -s "$last_response" ]]; then
    sed -n '1,80p' "$last_response" >&2
  else
    printf '  <empty>\n' >&2
  fi
}

# Perform one request and retain both the HTTP status and body for assertions.
# No curl --fail is used because the expected losing claim is a 409 response.
request() {
  local method=$1
  local path=$2
  local actor=${3:-}
  local request_body=${4:-}
  local retry=${5:-0}
  local response_file
  local -a curl_args

  request_number=$((request_number + 1))
  response_file="$run_dir/response-${request_number}.json"
  curl_args=(
    --silent --show-error --location
    --connect-timeout 10 --max-time 30
    --output "$response_file" --write-out '%{http_code}'
    --request "$method" "${api_url}${path}"
    --header 'Accept: application/json'
  )
  [[ -n "$actor" ]] && curl_args+=(--header "X-Demo-Actor: ${actor}")
  if [[ -n "$request_body" ]]; then
    curl_args+=(--header 'Content-Type: application/json' --data "$request_body")
  fi
  [[ "$retry" == "1" ]] && curl_args+=(--retry 2 --retry-delay 1)

  if ! last_status="$(curl "${curl_args[@]}")"; then
    fail "curl failed for ${method} ${path}"
  fi
  last_response="$response_file"
}

expect_status() {
  local expected=$1
  local description=$2
  if [[ "$last_status" != "$expected" ]]; then
    print_response_failure "$description (expected HTTP ${expected}, got ${last_status})"
    fail "$description returned HTTP ${last_status}; expected ${expected}"
  fi
}

expect_json() {
  local expression=$1
  local description=$2
  if ! jq -e "$expression" "$last_response" >/dev/null 2>&1; then
    print_response_failure "$description"
    fail "JSON assertion failed: ${description}"
  fi
}

iso_utc() {
  local epoch=$1
  if date -u -d "@${epoch}" '+%Y-%m-%dT%H:%M:%S.000Z' 2>/dev/null; then
    return 0
  fi
  date -u -r "$epoch" '+%Y-%m-%dT%H:%M:%S.000Z'
}

printf 'Verifying RescueRadius API: %s\n' "$api_url"

printf '[1/6] GET /health\n'
request GET /health '' '' 1
expect_status 200 'health check'
expect_json '.ok == true and .service == "rescue-radius-api"' 'health response is healthy'

printf '[2/6] GET /listings with coordinate/category/quantity filters\n'
request GET '/listings?latitude=12.9352&longitude=77.6245&radiusKm=10&foodCategory=VEG&minQuantity=1' '' '' 1
expect_status 200 'filtered listings check'
expect_json '(.listings | type) == "array" and (.listings | length) > 0' 'filtered listings contain at least one seeded record'
expect_json 'all(.listings[]; .status == "AVAILABLE" and .foodCategory == "VEG" and .quantityMeals >= 1)' 'filtered listings satisfy requested filters'

printf '[3/6] POST /listings with a unique future-dated listing\n'
now_epoch="$(date -u +%s)"
packed_at="$(iso_utc $((now_epoch - 60)))"
pickup_deadline="$(iso_utc $((now_epoch + 3600)))"
unique_suffix="$(date -u +%Y%m%dT%H%M%SZ)-$$-${RANDOM}"
create_body="$(jq -cn \
  --arg restaurant_id 'restaurant-001' \
  --arg restaurant_name 'RescueRadius smoke test' \
  --arg food_description "Smoke test listing ${unique_suffix}" \
  --arg packed_at "$packed_at" \
  --arg pickup_deadline "$pickup_deadline" \
  '{restaurantId:$restaurant_id,restaurantName:$restaurant_name,foodDescription:$food_description,quantityMeals:2,foodCategory:"PACKAGED",latitude:12.9352,longitude:77.6245,packedAt:$packed_at,pickupDeadline:$pickup_deadline}')"
request POST /listings restaurant-001 "$create_body"
expect_status 201 'listing creation'
expect_json '.id | type == "string" and length > 0' 'created listing has an id'
expect_json '.status == "AVAILABLE" and .quantityMeals == 2 and .foodCategory == "PACKAGED"' 'created listing has the expected shape'
if ! listing_id="$(jq -er '.id | select(type == "string" and length > 0)' "$last_response")"; then
  print_response_failure 'created listing id'
  fail 'could not read created listing id'
fi
printf '  created listing: %s\n' "$listing_id"

printf '[4/6] Concurrent claims: one 200 and one 409\n'
claim_one_body="$run_dir/claim-responder-001.json"
claim_two_body="$run_dir/claim-responder-002.json"
claim_one_status="$run_dir/claim-responder-001.status"
claim_two_status="$run_dir/claim-responder-002.status"

claim_once() {
  local actor=$1
  local body_file=$2
  local status_file=$3
  local status
  if status="$(curl --silent --show-error --location \
      --connect-timeout 10 --max-time 30 \
      --output "$body_file" --write-out '%{http_code}' \
      --request POST "${api_url}/listings/${listing_id}/claim" \
      --header 'Accept: application/json' \
      --header "X-Demo-Actor: ${actor}")"; then
    :
  else
    status=000
  fi
  printf '%s\n' "$status" > "$status_file"
}

claim_once responder-001 "$claim_one_body" "$claim_one_status" & claim_one_pid=$!
claim_once responder-002 "$claim_two_body" "$claim_two_status" & claim_two_pid=$!
wait "$claim_one_pid"
wait "$claim_two_pid"
claim_one_status_value="$(<"$claim_one_status")"
claim_two_status_value="$(<"$claim_two_status")"

if [[ "$claim_one_status_value" == 200 && "$claim_two_status_value" == 409 ]]; then
  winning_actor=responder-001
  losing_body=$claim_two_body
elif [[ "$claim_one_status_value" == 409 && "$claim_two_status_value" == 200 ]]; then
  winning_actor=responder-002
  losing_body=$claim_one_body
else
  printf '  responder-001 HTTP %s:\n' "$claim_one_status_value" >&2
  sed -n '1,80p' "$claim_one_body" >&2
  printf '  responder-002 HTTP %s:\n' "$claim_two_status_value" >&2
  sed -n '1,80p' "$claim_two_body" >&2
  fail 'concurrent claim did not produce exactly one 200 and one 409'
fi

winning_body="$run_dir/claim-winning.json"
if [[ "$winning_actor" == responder-001 ]]; then
  cp -- "$claim_one_body" "$winning_body"
else
  cp -- "$claim_two_body" "$winning_body"
fi
if ! jq -e --arg actor "$winning_actor" '.status == "CLAIMED" and .claimedBy == $actor' "$winning_body" >/dev/null; then
  sed -n '1,80p' "$winning_body" >&2
  fail 'winning claim response did not identify the winning actor'
fi
if ! jq -e '.error == "CLAIM_CONFLICT"' "$losing_body" >/dev/null; then
  sed -n '1,80p' "$losing_body" >&2
  fail 'losing claim did not return CLAIM_CONFLICT'
fi
printf '  winner: %s; loser: 409 CLAIM_CONFLICT\n' "$winning_actor"

printf '[5/6] Pickup and deliver by the winning actor\n'
request POST "/listings/${listing_id}/pickup" "$winning_actor"
expect_status 200 'pickup transition'
if ! jq -e --arg actor "$winning_actor" '.status == "PICKED_UP" and .claimedBy == $actor' "$last_response" >/dev/null 2>&1; then
  print_response_failure 'pickup transition state'
  fail 'JSON assertion failed: pickup transition state'
fi

request POST "/listings/${listing_id}/deliver" "$winning_actor"
expect_status 200 'delivery transition'
if ! jq -e --arg actor "$winning_actor" '.status == "DELIVERED" and .claimedBy == $actor' "$last_response" >/dev/null 2>&1; then
  print_response_failure 'delivery transition state'
  fail 'JSON assertion failed: delivery transition state'
fi

printf '[6/6] Fresh listing cancellation and dashboard\n'
cancel_now_epoch="$(date -u +%s)"
cancel_packed_at="$(iso_utc $((cancel_now_epoch - 60)))"
cancel_deadline="$(iso_utc $((cancel_now_epoch + 3600)))"
cancel_suffix="$(date -u +%Y%m%dT%H%M%SZ)-$$-${RANDOM}"
cancel_body="$(jq -cn \
  --arg restaurant_id 'restaurant-001' \
  --arg restaurant_name 'RescueRadius cancellation smoke test' \
  --arg food_description "Cancellation smoke test listing ${cancel_suffix}" \
  --arg packed_at "$cancel_packed_at" \
  --arg pickup_deadline "$cancel_deadline" \
  '{restaurantId:$restaurant_id,restaurantName:$restaurant_name,foodDescription:$food_description,quantityMeals:1,foodCategory:"PACKAGED",latitude:12.9352,longitude:77.6245,packedAt:$packed_at,pickupDeadline:$pickup_deadline}')"
request POST /listings restaurant-001 "$cancel_body"
expect_status 201 'cancellation listing creation'
if ! cancellation_listing_id="$(jq -er '.id | select(type == "string" and length > 0)' "$last_response")"; then
  print_response_failure 'cancellation listing id'
  fail 'could not read cancellation listing id'
fi

request POST "/listings/${cancellation_listing_id}/claim" responder-001
expect_status 200 'cancellation listing claim'
expect_json '.status == "CLAIMED" and .claimedBy == "responder-001"' 'cancellation listing claim state'

request POST "/listings/${cancellation_listing_id}/cancel" responder-001
expect_status 200 'cancellation transition'
expect_json '.status == "CANCELLED" and (.statusHistory | length) >= 3 and (.statusHistory[-1].from == "CLAIMED") and (.statusHistory[-1].to == "CANCELLED") and (.statusHistory[-1].actorId == "responder-001")' 'cancellation appends actor history'
printf '  cancelled listing: %s\n' "$cancellation_listing_id"

request GET /dashboard/impact '' '' 1
expect_status 200 'dashboard check'
expect_json '(.totalMealsListed | type) == "number" and (.mealsClaimed | type) == "number" and (.mealsPickedUp | type) == "number" and (.mealsDelivered | type) == "number" and (.expiredListings | type) == "number" and (.averageTimeToClaimMinutes | type) == "number" and (.pickupSuccessRate | type) == "number"' 'dashboard exposes numeric impact metrics'
expect_json '.mealsDelivered >= 1' 'dashboard reflects the delivered smoke-test listing'

if [[ -n "${AWS_PROFILE:-}" ]] && command -v aws >/dev/null 2>&1; then
  profile_list="$(aws configure list-profiles 2>/dev/null || true)"
  if printf '%s\n' "$profile_list" | grep -Fxq -- "$AWS_PROFILE"; then
    aws_region="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
    if [[ -z "$aws_region" ]]; then
      aws_region="$(aws configure get region --profile "$AWS_PROFILE" 2>/dev/null || true)"
    fi
    aws_region="${aws_region:-ap-south-1}"
    printf 'CloudWatch log-group check (profile %s, region %s)\n' "$AWS_PROFILE" "$aws_region"
    if ! log_groups_json="$(aws logs describe-log-groups \
      --log-group-name-prefix /aws/lambda/rescue-radius- \
      --query 'logGroups[].logGroupName' --output json \
      --profile "$AWS_PROFILE" --region "$aws_region")"; then
      fail "CloudWatch log-group lookup failed for profile ${AWS_PROFILE}"
    fi
    expected_log_groups=(
      /aws/lambda/rescue-radius-health
      /aws/lambda/rescue-radius-listings
      /aws/lambda/rescue-radius-claims
      /aws/lambda/rescue-radius-status
      /aws/lambda/rescue-radius-dashboard
      /aws/lambda/rescue-radius-profiles
      /aws/lambda/rescue-radius-notifications
    )
    for expected_log_group in "${expected_log_groups[@]}"; do
      if ! jq -e --arg name "$expected_log_group" 'index($name) != null' <<<"$log_groups_json" >/dev/null; then
        fail "expected CloudWatch log group not found: ${expected_log_group}"
      fi
    done
    printf '  verified %s Lambda log groups\n' "${#expected_log_groups[@]}"

    # Lambda log delivery is asynchronous. Poll the groups invoked above for a
    # stream whose last event belongs to this run, while keeping AWS calls
    # read-only and bounded. Status is required; the other invoked groups are
    # useful diagnostics but may lag independently in CloudWatch ingestion.
    query_log_stream_after_start() {
      local group_name=$1
      local stream_json
      if ! stream_json="$(aws logs describe-log-streams \
        --log-group-name "$group_name" \
        --order-by LastEventTime --descending --max-items 20 \
        --query 'logStreams[].[logStreamName,lastEventTimestamp]' --output json \
        --profile "$AWS_PROFILE" --region "$aws_region" \
        --cli-connect-timeout 3 --cli-read-timeout 5 \
        2>"$run_dir/cloudwatch-stream-error")"; then
        cloudwatch_query_failed=1
        return 1
      fi
      jq -e --argjson started "$script_start_epoch_ms" \
        'any(.[]?; (.[1] // 0) >= $started)' <<<"$stream_json" >/dev/null 2>&1
    }

    pending_log_groups=(
      /aws/lambda/rescue-radius-status
      /aws/lambda/rescue-radius-health
      /aws/lambda/rescue-radius-listings
      /aws/lambda/rescue-radius-claims
      /aws/lambda/rescue-radius-dashboard
    )
    cloudwatch_query_failed=0
    log_poll_deadline=$(( $(date -u +%s) + 20 ))
    while ((${#pending_log_groups[@]} > 0 && $(date -u +%s) < log_poll_deadline)); do
      next_pending_log_groups=()
      for log_group in "${pending_log_groups[@]}"; do
        if query_log_stream_after_start "$log_group"; then
          printf '  recent log stream: %s\n' "$log_group"
        else
          next_pending_log_groups+=("$log_group")
        fi
      done
      pending_log_groups=("${next_pending_log_groups[@]}")
      ((${#pending_log_groups[@]} == 0)) && break
      sleep 2
    done

    for log_group in "${pending_log_groups[@]}"; do
      if [[ "$log_group" == /aws/lambda/rescue-radius-status ]]; then
        if [[ "$cloudwatch_query_failed" == 1 && -s "$run_dir/cloudwatch-stream-error" ]]; then
          printf '  CloudWatch stream query diagnostic:\n' >&2
          sed -n '1,20p' "$run_dir/cloudwatch-stream-error" >&2
        fi
        fail "no post-start log stream found in required group: ${log_group}"
      fi
      warn "no post-start log stream observed yet in ${log_group} (CloudWatch ingestion may lag)"
    done
  else
    warn "AWS_PROFILE=${AWS_PROFILE} is not configured; skipping CloudWatch check"
  fi
elif [[ -n "${AWS_PROFILE:-}" ]]; then
  warn 'AWS_PROFILE is set but aws CLI is unavailable; skipping CloudWatch check'
else
  printf 'CloudWatch log-group check skipped (set AWS_PROFILE to enable the read-only check)\n'
fi

printf 'PASS: deployed API smoke checks completed for listing %s\n' "$listing_id"
