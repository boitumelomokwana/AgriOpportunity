import os, sys
out_path = os.path.abspath('graphify-out/.graphify_python')
with open(out_path, 'w') as f:
    f.write(r'C:\Users\phiri\AppData\Roaming\uv\python\cpython-3.10.22-windows-x86_64-none\python.exe')
root_path = os.path.abspath('C:\\Users\\phiri\\source\\AgriOpportunity')
with open('graphify-out/.graphify_root', 'w') as f:
    f.write(root_path)
print('python:', sys.executable)
print('root:', root_path)