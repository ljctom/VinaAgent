#!/usr/bin/env python3
"""2026-11-04：生成短剧剪辑器的本地双击资源包，不启动服务器或执行浏览器校验。

修改同目录 index.html 后运行本脚本，随完整 assets 文件夹一起分发 local-source.js。
只封装短剧专属静态 HTML，不读取 app.js 的全能画布工厂，不改写原页面结构和业务脚本。
页面运行时会把 base 替换为实际项目目录，并通过 srcdoc 继承首页来源。
"""
from pathlib import Path
import json

folder = Path(__file__).resolve().parent
source = (folder / "index.html").read_text(encoding="utf-8")
# 2026-11-04 修复逻辑：JSON 字符串保留原 HTML 的反斜杠、换行与内嵌模板；
# 使用普通经典脚本而非 fetch/module，允许浏览器在 file:// 下读取本地资源。
payload = json.dumps(source, ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
header = "// 2026-11-04 自动生成的短剧本地剪辑源码；源文件为同目录 index.html。\n"
header += "// 修改源页面后运行 build-local-source.py 重新生成；加载逻辑位于 ../episode-video-mode.js。\n"
(folder / "local-source.js").write_text(header + "window.__vinaEpisodeCanvasLocalHtml = " + payload + ";\n", encoding="utf-8")
