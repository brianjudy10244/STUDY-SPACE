#!/bin/zsh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "STUDYSPACE를 실행하려면 Node.js가 필요합니다."
  echo "https://nodejs.org 에서 Node.js LTS 버전을 설치한 뒤 다시 실행해 주세요."
  echo
  read -k 1 "?아무 키나 누르면 종료합니다."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "처음 실행에 필요한 패키지를 설치합니다..."
  npm install
fi

echo
echo "STUDYSPACE를 시작합니다."
echo "브라우저가 자동으로 열리며, 종료하려면 이 창에서 Control+C를 누르세요."
echo

npm run dev -- --open
