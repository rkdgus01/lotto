@echo off
cd /d %~dp0
rem GitHub Actions collects new draws weekly - pull them first (data file is regenerable)
git checkout -q -- public/data/draws.json 2>nul
git pull -q 2>nul
start http://localhost:5173
npm run dev

