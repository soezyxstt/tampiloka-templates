#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
work=$(mktemp -d "${TMPDIR:-/tmp}/attendance-transport.XXXXXX")
pg="attendance-pg-$RANDOM-$$"
s3="attendance-s3-$RANDOM-$$"
cleanup() { docker rm -f "$pg" "$s3" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT
password=$(openssl rand -hex 16)
secret=$(openssl rand -hex 24)
cat > "$work/s3.json" <<CONFIG
{"identities":[{"name":"attendance-test","credentials":[{"accessKey":"attendance-test-key","secretKey":"$secret"}],"actions":["Admin","Read","Write","List","Tagging"]}]}
CONFIG
chmod 644 "$work/s3.json"
docker run -d --name "$pg" --memory=512m --cpus=1 -e POSTGRES_PASSWORD="$password" -p 127.0.0.1:25439:5432 postgres:17-alpine >/dev/null
docker run -d --name "$s3" --memory=512m --cpus=1 -p 127.0.0.1:28333:8333 -v "$work/s3.json:/etc/seaweedfs/s3.json:ro" chrislusf/seaweedfs:3.80 server -ip=127.0.0.1 -ip.bind=0.0.0.0 -dir=/tmp -volume.max=2 -master.volumeSizeLimitMB=32 -s3 -s3.config=/etc/seaweedfs/s3.json >/dev/null
export ATTENDANCE_TEST_DATABASE_URL="postgresql://postgres:$password@127.0.0.1:25439/postgres"
export ATTENDANCE_TEST_S3_ENDPOINT=http://127.0.0.1:28333 ATTENDANCE_TEST_S3_BUCKET=attendance-test-bucket ATTENDANCE_TEST_S3_REGION=us-east-1 ATTENDANCE_TEST_S3_ACCESS_KEY=attendance-test-key ATTENDANCE_TEST_S3_SECRET_KEY="$secret"
for i in {1..30}; do docker exec "$pg" pg_isready -U postgres >/dev/null 2>&1 && curl -s -o /dev/null "$ATTENDANCE_TEST_S3_ENDPOINT" && break; sleep 1; done
uv pip install --quiet --python /usr/bin/python3 --target "$work/boto" boto3==1.44.0
PYTHONPATH="$work/boto" /usr/bin/python3 - <<'PY'
import boto3, os
from botocore.config import Config
client=boto3.client('s3',endpoint_url=os.environ['ATTENDANCE_TEST_S3_ENDPOINT'],region_name=os.environ['ATTENDANCE_TEST_S3_REGION'],aws_access_key_id=os.environ['ATTENDANCE_TEST_S3_ACCESS_KEY'],aws_secret_access_key=os.environ['ATTENDANCE_TEST_S3_SECRET_KEY'],config=Config(signature_version='s3v4',s3={'addressing_style':'path'}))
client.create_bucket(Bucket=os.environ['ATTENDANCE_TEST_S3_BUCKET'])
PY
cd "$root"
pnpm --filter @tampiloka/template-cafe exec node --experimental-strip-types --test src/plugins/attendance/engine.integration.test.ts
