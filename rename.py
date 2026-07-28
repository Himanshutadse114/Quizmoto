import os

directories_to_search = [
    'c:\\kahoot-awareness\\client\\src',
    'c:\\kahoot-awareness\\client\\tailwind.config.js',
    'c:\\kahoot-awareness\\client\\index.html',
    'c:\\kahoot-awareness\\client\\package.json',
    'c:\\kahoot-awareness\\server\\utils\\generate_report.py',
]

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return

    original = content
    # Replace texts
    content = content.replace("Quizard", "Quizmoto")
    content = content.replace("QUIZARD", "QUIZMOTO")
    content = content.replace("quizard", "quizmoto")

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {filepath}")

for target in directories_to_search:
    if os.path.isfile(target):
        process_file(target)
    elif os.path.isdir(target):
        for root, _, files in os.walk(target):
            for file in files:
                if file.endswith(('.jsx', '.js', '.css', '.html', '.py')):
                    process_file(os.path.join(root, file))

print("Done")
