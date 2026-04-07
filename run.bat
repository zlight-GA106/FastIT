@echo off
chcp 65001 >nul
echo 正在启动小票服务端引擎...
echo 请确保本机已连接 58mm 打印机并设为了“默认打印机”。
python server.py
pause