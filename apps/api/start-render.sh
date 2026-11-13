#!/bin/sh
set -eu

# Dừng ngay nếu migration hoặc seed thất bại; chỉ mở API sau khi chuẩn bị xong.
node dist/database/prepare-production.js
exec node dist/main.js
