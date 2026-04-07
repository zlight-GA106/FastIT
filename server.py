import http.server
import socketserver
import base64
import os
import sys
from socketserver import ThreadingMixIn

# 设置监听端口
PORT = 8010

class CloudHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        # 你可以根据需求修改这个路由名称
        if self.path == '/upload':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                
                # 假设上传的是 Base64 格式的数据
                # data:image/png;base64,xxxx...
                data_str = post_data.decode('utf-8')
                if ',' in data_str:
                    img_data = data_str.split(',')[1]
                else:
                    img_data = data_str
                
                # 设置保存路径
                save_path = os.path.abspath("uploaded_file.png")
                
                with open(save_path, "wb") as f:
                    f.write(base64.b64decode(img_data))
                
                print(f">>> 文件已成功保存至: {save_path}")
                
                self.send_response(200)
                self.send_header('Content-type', 'text/plain')
                self.send_header('Access-Control-Allow-Origin', '*') # 方便跨域调试
                self.end_headers()
                self.wfile.write(b"Upload Success")
                
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Error: {str(e)}".encode('utf-8'))
                print(f">>> 处理失败: {str(e)}")
        else:
            self.send_response(404)
            self.end_headers()

    # 如果需要处理跨域预检请求 (CORS)
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

# --- 多线程 TCP 服务器配置 ---
class ThreadedTCPServer(ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True  # 端口重用，防止重启时 Address already in use
    daemon_threads = True       # 守护线程，主进程退出时自动清理

if __name__ == "__main__":
    # 监听 0.0.0.0 以允许外部公网访问
    with ThreadedTCPServer(("0.0.0.0", PORT), CloudHandler) as httpd:
        print(f"=========================================")
        print(f"云端处理模块已启动")
        print(f"监听端口: {PORT}")
        print(f"接口地址: http://服务器公网IP:{PORT}/upload")
        print(f"=========================================")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n>>> 服务已安全关闭。")
            httpd.shutdown()