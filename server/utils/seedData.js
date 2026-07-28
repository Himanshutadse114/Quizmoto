const defaultQuizzes = [
    {
        title: "🛡️ Phishing Awareness Challenge",
        questions: [
            {
                questionText: "Which of the following is a common sign of a phishing email?",
                options: ["Urgent or threatening language", "Correct spelling and grammar", "Expected sender address", "High-quality images"],
                correctIndex: 0,
                timer: 20
            },
            {
                questionText: "What is the safest way to check a link in a suspicious email?",
                options: ["Click it quickly", "Hover your mouse over it (without clicking)", "Paste it into your browser", "Ask a colleague to click it"],
                correctIndex: 1,
                timer: 20
            },
            {
                questionText: "What is 'Spear Phishing'?",
                options: ["Phishing with a physical spear", "A broad attack on millions", "A targeted attack on a specific individual", "A type of firewall"],
                correctIndex: 2,
                timer: 20
            },
            {
                questionText: "What is 'Smishing'?",
                options: ["Phishing via Social Media", "Phishing via SMS (text messages)", "A type of computer virus", "A secure way to send emails"],
                correctIndex: 1,
                timer: 20
            },
            {
                questionText: "An email from 'IT Support' has a weird sender address like 'support@free-it-help.com'. What should you do?",
                options: ["Trust it (it says IT Support)", "Reply and ask for their ID", "Treat it as a phishing attempt and report it", "Forward it to all your colleagues"],
                correctIndex: 2,
                timer: 20
            }
        ]
    },
    {
        title: "🔑 Password & Account Security",
        questions: [
            {
                questionText: "What does MFA stand for in security?",
                options: ["Multiple Facebook Accounts", "Multi-Factor Authentication", "My First Algorithm", "Many Files Access"],
                correctIndex: 1,
                timer: 15
            },
            {
                questionText: "Which is considered a 'Strong' password practice?",
                options: ["Using 'Password123'", "Using your birthdate", "A combination of random words and symbols", "Using the same password for all sites"],
                correctIndex: 2,
                timer: 15
            },
            {
                questionText: "How often should you reuse passwords across different platforms?",
                options: ["Always (it's easy to remember)", "Only for social media", "Never", "Once a year"],
                correctIndex: 2,
                timer: 15
            },
            {
                questionText: "Why is using a 'Password Manager' recommended?",
                options: ["It makes passwords easier to guess", "It generates and stores unique, complex passwords", "It sends your passwords to the cloud for everyone", "It disables your computer's firewall"],
                correctIndex: 1,
                timer: 20
            }
        ]
    },
    {
        title: "🌐 Remote Work & Public Wi-Fi",
        questions: [
            {
                questionText: "When using free public Wi-Fi (e.g., at a cafe), which tool provides the best security?",
                options: ["A screen protector", "A VPN (Virtual Private Network)", "A fast charger", "A wireless mouse"],
                correctIndex: 1,
                timer: 20
            },
            {
                questionText: "Is it safe to leave your laptop unlocked in a public space for 'just a minute'?",
                options: ["Yes, if people look friendly", "No, anyone could steal data or install malware", "Yes, if you have a password", "Only if the Wi-Fi is secure"],
                correctIndex: 1,
                timer: 15
            }
        ]
    },
    {
        title: "🏢 Office & Social Engineering",
        questions: [
            {
                questionText: "What is 'Tailgating' in physical security?",
                options: ["Following someone through a secure door", "A party in the parking lot", "Locking your computer screen", "Reporting a lost ID badge"],
                correctIndex: 0,
                timer: 20
            },
            {
                questionText: "A caller claims to be from IT and asks for your password. What should you do?",
                options: ["Give it to them (they need it to help)", "Ask for their name first", "Hang up and report it to the real IT department", "Write it on a sticky note for them"],
                correctIndex: 2,
                timer: 20
            }
        ]
    }
];

module.exports = defaultQuizzes;
