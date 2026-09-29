import re

path = r'C:\Users\arpit\Desktop\main orca\orca new - Copy antg\orca\backend\src\app.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('const aiHealthUrl = "https://orca-ai-service-b0fx.onrender.com/health";', 'const aiHealthUrl = `${env.AI_SERVICE_URL}/health`;')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("patched")
