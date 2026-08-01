import os

replacements = [
    ("client/src/pages/Player/PlayerRegister.jsx", 
     [("const res = await fetch('/api/player/register'", "const res = await fetch(apiUrl('/api/player/register')")],
     "import { apiUrl } from '../../config';"),
    ("client/src/pages/Player/PlayerLogin.jsx",
     [("const res = await fetch('/api/player/login'", "const res = await fetch(apiUrl('/api/player/login')")],
     "import { apiUrl } from '../../config';"),
    ("client/src/pages/Player/PlayerDashboard.jsx",
     [
         ("fetch('/api/player/profile'", "fetch(apiUrl('/api/player/profile')"),
         ("fetch('/api/player/history'", "fetch(apiUrl('/api/player/history')"),
         ("fetch('/api/player/avatar'", "fetch(apiUrl('/api/player/avatar')")
     ],
     "import { apiUrl } from '../../config';"),
    ("client/src/pages/Host/Reports.jsx",
     [
         ("const API_URL = `/api/quizzes/reports/all`;", "const API_URL = apiUrl('/api/quizzes/reports/all');"),
         ("axios.get(`/api/quizzes/reports/${session.id}/export?format=${format}`", "axios.get(apiUrl(`/api/quizzes/reports/${session.id}/export?format=${format}`))")
     ],
     "import { apiUrl } from '../../config';"),
    ("client/src/pages/Host/EditQuiz.jsx",
     [("const API_URL = `/api/quizzes`;", "const API_URL = apiUrl('/api/quizzes');")],
     "import { apiUrl } from '../../config';"),
    ("client/src/pages/Host/Dashboard.jsx",
     [("const API_BASE_URL = `/api/quizzes`;", "const API_BASE_URL = apiUrl('/api/quizzes');")],
     "import { apiUrl } from '../../config';"),
    ("client/src/pages/Host/CreateQuiz.jsx",
     [
         ("const GEN_API_URL = `/api/quizzes/generate-ai`;", "const GEN_API_URL = apiUrl('/api/quizzes/generate-ai');"),
         ("const API_URL = `/api/quizzes`;", "const API_URL = apiUrl('/api/quizzes');")
     ],
     "import { apiUrl } from '../../config';"),
    ("client/src/context/AuthContext.jsx",
     [("const API_URL = '/api/auth';", "const API_URL = apiUrl('/api/auth');")],
     "import { apiUrl } from '../config';")
]

for file_path, reps, import_stmt in replacements:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "import { apiUrl }" not in content:
        lines = content.split('\n')
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import_idx = i
        lines.insert(last_import_idx + 1, import_stmt)
        content = '\n'.join(lines)
        
    for old, new in reps:
        content = content.replace(old, new)
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Replacement complete")
