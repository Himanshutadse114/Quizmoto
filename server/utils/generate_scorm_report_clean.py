import json
import sys
from datetime import datetime, timezone

import generate_lmsgen_report as lmsgen


FINISHED = {'completed', 'passed', 'failed'}


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def status_label(registration):
    lesson = str(registration.get('lastLessonStatus') or registration.get('lessonStatus') or '').strip().lower()
    status = str(registration.get('status') or '').strip().lower()
    if lesson == 'passed':
        return 'Passed'
    if lesson == 'failed':
        return 'Failed'
    if lesson == 'completed' or status == 'completed':
        return 'Completed'
    if lesson in {'incomplete', 'browsed'} or status in {'active', 'launched', 'started', 'in_progress'}:
        return 'In progress'
    return 'Not started'


def is_completed(registration):
    lesson = str(registration.get('lastLessonStatus') or registration.get('lessonStatus') or '').strip().lower()
    return lesson in FINISHED or str(registration.get('status') or '').strip().lower() == 'completed'


def progress_label(registration):
    if registration.get('progressAvailable') is False:
        return '—'
    value = number(registration.get('progressPercent'))
    if value is None:
        return '100%' if is_completed(registration) else '—'
    value = max(0.0, min(100.0, value))
    return f'{value:.0f}%'


def score_label(registration):
    value = number(registration.get('lastScoreRaw'))
    if value is None:
        value = number(registration.get('score'))
    if value is None:
        return '—'
    if float(value).is_integer():
        return str(int(value))
    return f'{value:.1f}'.rstrip('0').rstrip('.')


def answer_summary(registration):
    summary = registration.get('answerSummary') or {}
    captured = int(number(summary.get('captured')) or 0)
    graded = int(number(summary.get('graded')) or 0)
    correct = int(number(summary.get('correct')) or 0)
    if not captured:
        interactions = registration.get('interactions') or []
        if isinstance(interactions, list):
            captured = len(interactions)
            graded = sum(1 for row in interactions if isinstance(row, dict) and row.get('result') not in (None, '', 'unknown'))
            correct = sum(1 for row in interactions if isinstance(row, dict) and str(row.get('result') or '').lower() == 'correct')
    return captured, graded, correct


def build_report(data):
    title = str(data.get('title') or 'Untitled course')
    package = data.get('package') or {}
    registrations = data.get('registrations') or []
    registrations = [row for row in registrations if isinstance(row, dict) and not row.get('isPreview') and not row.get('campaignId')]

    completed = sum(1 for row in registrations if is_completed(row))
    in_progress = sum(1 for row in registrations if status_label(row) == 'In progress')
    scores = []
    rows = []
    questions = 0
    graded_questions = 0
    correct_answers = 0

    for registration in registrations:
        score = number(registration.get('lastScoreRaw'))
        if score is None:
            score = number(registration.get('score'))
        if score is not None:
            scores.append(score)
        captured, graded, correct = answer_summary(registration)
        questions += captured
        graded_questions += graded
        correct_answers += correct
        rows.append({
            'learner': registration.get('learnerName') or 'Learner',
            'email': registration.get('learnerEmail') or '',
            'status': status_label(registration),
            'progress': progress_label(registration),
            'score': score_label(registration),
            'learningTime': registration.get('lastTotalTime') or registration.get('totalTime') or '—',
            'questions': captured if captured else '—',
            'correct': correct if graded else '—',
            'lastActivity': registration.get('lastCommitAt') or registration.get('lastActivityAt') or registration.get('updatedAt') or ''
        })

    rows.sort(key=lambda row: (str(row.get('email') or '').lower(), str(row.get('learner') or '').lower()))
    average_score = round(sum(scores) / len(scores), 1) if scores else '—'
    completion_rate = round((completed / len(registrations)) * 100, 1) if registrations else 0
    accuracy = round((correct_answers / graded_questions) * 100, 1) if graded_questions else '—'

    standard = package.get('standard') or 'SCORM'
    subtitle = f'Detailed learner evidence for {title} · {standard}'
    return {
        'schemaVersion': 'lmsgen-report-v2',
        'reportType': 'course',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'tenant': None,
        'title': f'Course Learning Report — {title}',
        'subtitle': subtitle,
        'summary': [
            {'label': 'Learners', 'value': len(registrations)},
            {'label': 'Completed', 'value': completed},
            {'label': 'In progress', 'value': in_progress},
            {'label': 'Completion', 'value': f'{completion_rate:g}%'},
            {'label': 'Average score', 'value': average_score}
        ],
        'columns': [
            {'key': 'learner', 'label': 'Learner'},
            {'key': 'email', 'label': 'Email'},
            {'key': 'status', 'label': 'Status'},
            {'key': 'progress', 'label': 'Progress'},
            {'key': 'score', 'label': 'Score'},
            {'key': 'learningTime', 'label': 'Learning time'},
            {'key': 'questions', 'label': 'Questions'},
            {'key': 'correct', 'label': 'Correct'},
            {'key': 'lastActivity', 'label': 'Last activity'}
        ],
        'rows': rows,
        'meta': {
            'courseStatus': data.get('status') or '',
            'packageTitle': package.get('title') or '',
            'standard': standard,
            'questionsCaptured': questions,
            'gradedQuestions': graded_questions,
            'answerAccuracy': accuracy
        }
    }


def main():
    if len(sys.argv) != 4:
        print('Usage: generate_scorm_report_clean.py <input.json> <output> <pdf|excel>', file=sys.stderr)
        return 2

    input_path, output_path, kind = sys.argv[1], sys.argv[2], sys.argv[3].lower()
    with open(input_path, 'r', encoding='utf-8') as handle:
        data = json.load(handle)

    report = build_report(data)
    if kind == 'pdf':
        lmsgen.generate_pdf(report, output_path)
    elif kind == 'excel':
        lmsgen.generate_excel(report, output_path)
    else:
        print(f'Unsupported format: {kind}', file=sys.stderr)
        return 2

    print(output_path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
