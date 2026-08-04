import JSZip from "jszip";
import { PolicyAnalysis } from "./geminiService";

function escapeXML(str: string): string {
    return str.replace(/[<>&"']/g, (m) => {
        switch (m) {
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "&": return "&amp;";
            case "\"": return "&quot;";
            case "'": return "&apos;";
            default: return m;
        }
    });
}

function formatContent(content: string): string {
    const hasCapsHeadings = /[A-Z][A-Z\s\/&']{3,}:/.test(content);
    if (!hasCapsHeadings) return content;

    const parts = content.split(/(?=[A-Z][A-Z\s\/&']{3,}:)/);
    return parts
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .map(part => {
            const colonIdx = part.indexOf(':');
            if (colonIdx > 0) {
                const heading = part.substring(0, colonIdx).trim();
                const body = part.substring(colonIdx + 1).trim();
                if (/^[A-Z][A-Z\s\/&']{2,}$/.test(heading) && heading.length < 60) {
                    return '<strong style="color:#0f172a;">' + heading + ':</strong> ' + body;
                }
            }
            return part;
        })
        .join('<br><br>');
}

const TEMPLATES = {
    1: { primary: '#f97316', primaryDark: '#ea580c', accent: '#fdba74', bg: '#0f172a', surface: '#ffffff', text: '#1e293b', headerText: '#ffffff', secondaryBg: '#f8fafc', font: "'Inter', sans-serif" },
    3: { primary: '#b45309', primaryDark: '#92400e', accent: '#fde68a', bg: '#451a03', surface: '#fffbeb', text: '#451a03', headerText: '#ffffff', secondaryBg: '#fef3c7', font: "'Playfair Display', serif" },
    4: { primary: '#059669', primaryDark: '#047857', accent: '#6ee7b7', bg: '#064e3b', surface: '#f0fdf4', text: '#064e3b', headerText: '#ffffff', secondaryBg: '#d1fae5', font: "'Outfit', sans-serif" },
    5: { primary: '#db2777', primaryDark: '#be185d', accent: '#fca5a5', bg: '#4c0519', surface: '#fff1f2', text: '#4c0519', headerText: '#ffffff', secondaryBg: '#ffe4e6', font: "'Inter', sans-serif" }
};

export async function generateScormPackage(
    analysis: PolicyAnalysis,
    logoDataUrl?: string,
    templateId: number = 1
): Promise<Blob> {
    const zip = new JSZip();
    const escapedTitle = escapeXML(analysis.title);
    const theme = TEMPLATES[templateId as keyof typeof TEMPLATES] || TEMPLATES[1];

    let logoFileName = '';
    if (logoDataUrl) {
        const matches = logoDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const ext = mimeType.split('/')[1].split('+')[0];
            logoFileName = `logo.${ext}`;
            zip.file(logoFileName, base64Data, { base64: true });
        }
    }

    const logoHtml = logoFileName
        ? `<img src="${logoFileName}" alt="Logo" style="height:100%;max-height:45px;max-width:120px;object-fit:contain;border-radius:6px;flex-shrink:0;" />`
        : '';

    const logoFileEntry = logoFileName ? `\n      <file href="${logoFileName}"/>` : '';

    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-${Date.now()}" version="1.1"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="B0">
    <organization identifier="B0">
      <title>${escapedTitle}</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>${escapedTitle}</title>
        <adlcp:masteryscore>70</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="scorm_api_wrapper.js"/>${logoFileEntry}
    </resource>
  </resources>
</manifest>`;

    // --- Standard SCORM 1.2 Schema Files (XSDs) ---
    const adlcpXsd = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
            targetNamespace="http://www.adlnet.org/xsd/adlcp_rootv1p2"
            elementFormDefault="qualified"
            attributeFormDefault="unqualified">
   <xsd:element name="location" type="xsd:string"/>
   <xsd:element name="prerequisites" type="adlcp:prerequisitesType"/>
   <xsd:element name="maxtimeallowed" type="xsd:string"/>
   <xsd:element name="timelimitaction" type="adlcp:timelimitactionType"/>
   <xsd:element name="datafromlms" type="xsd:string"/>
   <xsd:element name="masteryscore" type="xsd:string"/>
   <xsd:attribute name="scormtype">
      <xsd:simpleType>
         <xsd:restriction base="xsd:NMTOKEN">
            <xsd:enumeration value="sco"/>
            <xsd:enumeration value="asset"/>
         </xsd:restriction>
      </xsd:simpleType>
   </xsd:attribute>
   <xsd:simpleType name="timelimitactionType">
      <xsd:restriction base="xsd:NMTOKEN">
         <xsd:enumeration value="exit,no message"/>
         <xsd:enumeration value="exit,message"/>
         <xsd:enumeration value="continue,no message"/>
         <xsd:enumeration value="continue,message"/>
      </xsd:restriction>
   </xsd:simpleType>
   <xsd:complexType name="prerequisitesType">
      <xsd:simpleContent>
         <xsd:extension base="xsd:string">
            <xsd:attribute name="type" type="xsd:string" use="required" fixed="aicc_script"/>
         </xsd:extension>
      </xsd:simpleContent>
   </xsd:complexType>
</xsd:schema>`;

    const imsxmlXsd = `<?xml version = "1.0" encoding = "UTF-8"?>
<xs:schema targetNamespace = "http://www.w3.org/XML/1998/namespace" 
           xmlns:xs = "http://www.w3.org/2001/XMLSchema" 
           xml:lang = "en"
           elementFormDefault = "qualified">
  <xs:attribute name = "lang" type = "xs:language"/>
  <xs:attribute name = "base" type = "xs:anyURI"/>
  <xs:attribute name = "id" type = "xs:ID"/>
  <xs:attributeGroup name = "specialAttrs">
    <xs:attribute ref = "xml:base"/>
    <xs:attribute ref = "xml:lang"/>
  </xs:attributeGroup>
</xs:schema>`;

    const imscpXsd = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
            targetNamespace="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
            xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            elementFormDefault="qualified">
  <xsd:import namespace="http://www.w3.org/XML/1998/namespace" schemaLocation="ims_xml.xsd"/>
  <xsd:element name="manifest" type="manifestType"/>
  <xsd:complexType name="manifestType">
    <xsd:sequence>
      <xsd:element name="metadata" minOccurs="0" type="metadataType"/>
      <xsd:element name="organizations" type="organizationsType"/>
      <xsd:element name="resources" type="resourcesType"/>
    </xsd:sequence>
    <xsd:attribute name="identifier" type="xsd:ID" use="required"/>
    <xsd:attribute name="version" type="xsd:string"/>
  </xsd:complexType>
  <xsd:complexType name="metadataType">
    <xsd:sequence>
      <xsd:element name="schema" minOccurs="0" type="xsd:string"/>
      <xsd:element name="schemaversion" minOccurs="0" type="xsd:string"/>
      <xsd:any namespace="##other" processContents="lax" minOccurs="0" maxOccurs="unbounded"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:complexType name="organizationsType">
    <xsd:sequence>
      <xsd:element name="organization" maxOccurs="unbounded" type="organizationType"/>
    </xsd:sequence>
    <xsd:attribute name="default" type="xsd:IDREF" use="required"/>
  </xsd:complexType>
  <xsd:complexType name="organizationType">
    <xsd:sequence>
      <xsd:element name="title" type="xsd:string"/>
      <xsd:element name="item" maxOccurs="unbounded" type="itemType"/>
    </xsd:sequence>
    <xsd:attribute name="identifier" type="xsd:ID" use="required"/>
    <xsd:attribute name="structure" type="xsd:string" fixed="hierarchical"/>
  </xsd:complexType>
  <xsd:complexType name="itemType">
    <xsd:sequence>
      <xsd:element name="title" type="xsd:string"/>
      <xsd:element name="item" minOccurs="0" maxOccurs="unbounded" type="itemType"/>
    </xsd:sequence>
    <xsd:attribute name="identifier" type="xsd:ID" use="required"/>
    <xsd:attribute name="identifierref" type="xsd:IDREF"/>
    <xsd:attribute name="isvisible" type="xsd:boolean"/>
  </xsd:complexType>
  <xsd:complexType name="resourcesType">
    <xsd:sequence>
      <xsd:element name="resource" maxOccurs="unbounded" type="resourceType"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:complexType name="resourceType">
    <xsd:sequence>
      <xsd:element name="file" minOccurs="0" maxOccurs="unbounded">
        <xsd:complexType>
          <xsd:attribute name="href" type="xsd:string" use="required"/>
        </xsd:complexType>
      </xsd:element>
      <xsd:any namespace="##other" processContents="lax" minOccurs="0" maxOccurs="unbounded"/>
    </xsd:sequence>
    <xsd:attribute name="identifier" type="xsd:ID" use="required"/>
    <xsd:attribute name="type" type="xsd:string" use="required"/>
    <xsd:attribute name="href" type="xsd:string"/>
  </xsd:complexType>
</xsd:schema>`;

    // --- Create index.html (The Player) ---
    // EMBEDDING analysis directly as a JSON string to avoid fetch issues in restricted environments.
    const playerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedTitle}</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <script src="scorm_api_wrapper.js"><\/script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@700;900&family=Outfit:wght@400;600;800&display=swap');
        :root { 
            --primary: ${theme.primary}; 
            --primary-dark: ${theme.primaryDark}; 
            --accent: ${theme.accent}; 
            --bg: ${theme.bg};
            --surface: ${theme.surface};
            --text: ${theme.text};
            --secondary-bg: ${theme.secondaryBg};
        }
        * { box-sizing: border-box; }
        body, html {
            margin: 0; padding: 0;
            width: 100%; height: 100%;
            overflow: hidden;
            font-family: ${theme.font};
            background: var(--bg);
            color: var(--text);
        }
        #app {
            width: 100%; height: 100%;
            display: flex; flex-direction: column;
            background: var(--surface);
            position: relative;
        }
        header {
            height: 70px;
            background: var(--primary);
            color: ${theme.headerText};
            display: flex; align-items: center;
            padding: 0 1.5rem;
            flex-shrink: 0;
            gap: 1rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10;
        }
        main {
            flex-grow: 1;
            position: relative;
            background: var(--surface);
            overflow: hidden;
        }
        footer {
            height: 70px;
            background: var(--secondary-bg);
            border-top: 1px solid rgba(0,0,0,0.05);
            display: flex; align-items: center;
            padding: 0 1.5rem;
            justify-content: space-between;
            flex-shrink: 0;
        }
        .slide {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            display: none;
            padding: 2rem;
            overflow-y: auto;
        }
        .slide.active { display: flex; flex-direction: column; }
        
        .slide.enter-right { animation: slideInRight 0.4s ease-out forwards; }
        .slide.enter-left { animation: slideInLeft 0.4s ease-out forwards; }
        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-50px); }
            to { opacity: 1; transform: translateX(0); }
        }

        .content-grid {
            display: grid;
            grid-template-columns: 1.3fr 0.7fr;
            gap: 2.5rem;
            height: 100%;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
        }
        @media (max-width: 1024px) {
            .content-grid { grid-template-columns: 1fr; gap: 1.5rem; }
        }
        
        #progress-bar {
            height: 8px; background: rgba(255,255,255,0.2);
            border-radius: 4px; flex-grow: 1; overflow: hidden;
        }
        #progress-fill {
            height: 100%; background: var(--accent); width: 0%;
            transition: width 0.4s ease;
        }
        .btn {
            padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 800;
            font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em;
            transition: all 0.2s; cursor: pointer; border: none;
            display: flex; align-items: center; gap: 0.5rem;
        }
        .btn-primary { background: var(--primary); color: white; }
        .btn-secondary { background: white; border: 1px solid #e2e8f0; color: #64748b; }
        .btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .quiz-option {
            background: white; border: 2px solid #f1f5f9;
            border-radius: 1rem; padding: 1.25rem;
            text-align: left; transition: all 0.2s;
            cursor: pointer; width: 100%; font-weight: 600;
            display: flex; align-items: center; justify-content: space-between;
        }
        .quiz-option:hover:not(:disabled) { border-color: var(--primary); background: #fffcf0; }
        .quiz-option.correct { background: #f0fdf4; border-color: #22c55e; color: #166534; }
        .quiz-option.incorrect { background: #fef2f2; border-color: #ef4444; color: #991b1b; }
    </style>
</head>
<body>
<div id="app">
    <header>
        ${logoHtml}
        <h1 style="font-size:1.1rem;font-weight:900;flex-grow:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapedTitle}</h1>
        <div id="progress-bar"><div id="progress-fill"></div></div>
        <span id="progress-text" style="font-size:0.8rem;font-weight:900;margin-left:0.5rem;">0%</span>
    </header>
    <main id="content-area"></main>
    <footer>
        <button id="prev-btn" class="btn btn-secondary" onclick="moveSlide(-1)">← Previous</button>
        <div id="slide-number" style="font-size:0.75rem;font-weight:900;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">...</div>
        <button id="next-btn" class="btn btn-primary" onclick="moveSlide(1)">Next →</button>
    </footer>
</div>

<script>
    // Embedded Data
    const data = ${JSON.stringify(analysis)};
    let currentSlide = 0;
    let score = 0;
    let quizResults = [];
    let completed = false;

    function formatText(t) {
        if (!t) return "";
        const hasHeads = /[A-Z][A-Z\\s\\/&']{3,}:/.test(t);
        if (!hasHeads) return t;
        return t.split(/(?=[A-Z][A-Z\\s\\/&']{3,}:)/)
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .map(p => {
                const cIdx = p.indexOf(':');
                if (cIdx > 0) {
                    const h = p.substring(0, cIdx).trim();
                    const b = p.substring(cIdx+1).trim();
                    if (/^[A-Z][A-Z\\s\\/&']{2,}$/.test(h) && h.length < 60) {
                        return '<strong style="color:var(--primary-dark);display:block;margin-bottom:0.25rem;">' + h + ':</strong>' + b;
                    }
                }
                return p;
            }).join('<br><br>');
    }

    function render() {
        const area = document.getElementById('content-area');
        area.innerHTML = '';

        // 1. Welcome
        const intro = document.createElement('div');
        intro.className = 'slide active justify-center items-center text-center';
        intro.innerHTML = \`
            <div style="max-width:800px;padding:2rem;">
                <div style="font-size:4rem;margin-bottom:1rem;">🚀</div>
                <h2 style="font-size:3rem;font-weight:900;line-height:1;margin-bottom:1.5rem;">Welcome</h2>
                <div style="background:var(--secondary-bg);padding:2rem;border-radius:2rem;border:2px solid var(--accent);">
                    <p style="font-size:1.25rem;font-weight:600;font-style:italic;color:var(--primary-dark);">"\${data.summary}"</p>
                </div>
                <p style="margin-top:2rem;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.2em;">Click 'Next' to start</p>
            </div>
        \`;
        area.appendChild(intro);

        // 2. Content
        data.slides.forEach((s, i) => {
            const el = document.createElement('div');
            el.className = 'slide';
            const kps = s.keyPoints.map(p => \`
                <div style="display:flex;gap:0.75rem;padding:1rem;background:white;border-radius:1rem;border:1px solid #f1f5f9;box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                    <div style="color:var(--primary);font-weight:900;">•</div>
                    <p style="font-size:0.95rem;font-weight:700;margin:0;color:#1e293b;line-height:1.4;">\${p}</p>
                </div>
            \`).join('');

            el.innerHTML = \`
                <div class="content-grid">
                    <div style="display:flex;flex-direction:column;gap:1rem;overflow-y:auto;padding-right:1rem;">
                        <span style="font-size:0.75rem;font-weight:900;text-transform:uppercase;color:var(--primary);letter-spacing:0.25em;">Section \${i+1}</span>
                        <h2 style="font-size:2.5rem;font-weight:900;line-height:1.1;margin:0;letter-spacing:-0.01em;">\${s.title}</h2>
                        <div style="background:var(--secondary-bg);padding:2rem;border-radius:2.5rem;border-left:8px solid var(--primary);">
                            <p style="font-size:1.15rem;line-height:1.6;margin:0;font-weight:500;">\${formatText(s.content)}</p>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:1.5rem;overflow-y:auto;">
                        <div style="display:flex;flex-direction:column;gap:1.25rem;">
                            <h3 style="font-size:0.75rem;font-weight:900;text-transform:uppercase;letter-spacing:0.3em;color:var(--primary);margin:0;display:flex;align-items:center;gap:0.5rem;">
                                <span>Key Insights</span>
                                <div style="flex-grow:1;height:1px;background:var(--primary);opacity:0.2;"></div>
                            </h3>
                            <div style="display:flex;flex-direction:column;gap:1rem;">\${kps}</div>
                        </div>
                    </div>
                </div>
            \`;
            area.appendChild(el);
        });

        // 3. Quiz
        data.quiz.forEach((q, i) => {
            const el = document.createElement('div');
            el.className = 'slide';
            const opts = q.options.map((o, oi) => \`
                <button class="quiz-option" id="q-\${i}-o-\${oi}" onclick="answer(\${i},\${oi})">
                    <span>\${o}</span>
                    <div style="width:24px;height:24px;border:2px solid #cbd5e1;border-radius:50%;"></div>
                </button>
            \`).join('');

            el.innerHTML = \`
                <div style="max-width:900px;margin:auto;display:flex;flex-direction:column;gap:2rem;width:100%;">
                    <div style="text-align:center;">
                        <span style="font-size:0.75rem;font-weight:900;color:var(--primary);text-transform:uppercase;letter-spacing:0.3em;">Knowledge Check</span>
                        <h2 style="font-size:2.5rem;font-weight:900;margin:1rem 0;">\${q.question}</h2>
                    </div>
                    <div id="opts-\${i}" style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">\${opts}</div>
                    <div id="fb-\${i}" style="display:none;padding:1.5rem;border-radius:1.5rem;text-align:center;font-weight:800;font-size:1.2rem;"></div>
                </div>
            \`;
            area.appendChild(el);
        });

        // 4. Final
        const final = document.createElement('div');
        final.className = 'slide justify-center items-center text-center';
        final.innerHTML = \`
            <div style="max-width:600px;padding:2rem;">
                <div style="font-size:5rem;margin-bottom:1rem;">🎯</div>
                <h2 style="font-size:3rem;font-weight:900;margin:0;">Completed!</h2>
                <div style="background:var(--primary);color:white;padding:3rem;border-radius:2.5rem;margin:2rem 0;box-shadow:0 20px 40px rgba(0,0,0,0.15);">
                    <p style="font-size:0.75rem;font-weight:900;text-transform:uppercase;letter-spacing:0.3em;color:var(--accent);margin-bottom:0.5rem;">Final Evaluation</p>
                    <p id="final-res" style="font-size:5rem;font-weight:900;margin:0;">--%</p>
                </div>
                <button class="btn btn-primary" style="margin:auto;padding:1.25rem 3rem;font-size:1.1rem;" onclick="exitSco()">Finish Course</button>
            </div>
        \`;
        area.appendChild(final);
        
        updateNav();
    }

    function moveSlide(n) {
        const slides = document.querySelectorAll('.slide');
        const dir = n > 0 ? 'right' : 'left';
        
        if (currentSlide + n >= 0 && currentSlide + n < slides.length) {
            slides[currentSlide].classList.remove('active');
            currentSlide += n;
            slides[currentSlide].classList.add('active');
            slides[currentSlide].classList.add('enter-' + dir);
            setTimeout(() => slides[currentSlide].classList.remove('enter-' + dir), 500);
            updateNav();
        }
    }

    function updateNav() {
        const slides = document.querySelectorAll('.slide');
        document.getElementById('prev-btn').disabled = (currentSlide === 0);
        const next = document.getElementById('next-btn');
        
        if (currentSlide === slides.length - 1) {
            next.style.display = 'none';
            calcScore();
        } else {
            next.style.display = 'flex';
            next.innerHTML = (currentSlide === slides.length - 2) ? 'Finish →' : 'Next →';
        }
        
        const total = slides.length;
        document.getElementById('slide-number').innerText = 'Part ' + (currentSlide + 1) + ' of ' + total;
        const p = Math.round((currentSlide / (total - 1)) * 100);
        document.getElementById('progress-fill').style.width = p + '%';
        document.getElementById('progress-text').innerText = p + '%';
    }

    function answer(qi, oi) {
        if (quizResults[qi] !== undefined) return;
        quizResults[qi] = oi;
        const correct = data.quiz[qi].correctAnswer;
        const container = document.getElementById('opts-' + qi);
        const btns = container.querySelectorAll('button');
        
        btns.forEach((b, i) => {
            b.disabled = true;
            if (i === correct) b.classList.add('correct');
            else if (i === oi) b.classList.add('incorrect');
        });
        
        const fb = document.getElementById('fb-' + qi);
        fb.style.display = 'block';
        if (oi === correct) {
            fb.innerText = "Excellent! You got it.";
            fb.style.background = '#f0fdf4';
            fb.style.color = '#166534';
        } else {
            fb.innerText = "Not quite. The correct one is highlighted.";
            fb.style.background = '#fef2f2';
            fb.style.color = '#991b1b';
        }
    }

    function calcScore() {
        let hits = 0;
        data.quiz.forEach((q, i) => { if (quizResults[i] === q.correctAnswer) hits++; });
        score = Math.round((hits / data.quiz.length) * 100);
        const el = document.getElementById('final-res');
        if (el) el.innerText = score + '%';
    }

    function exitSco() {
        if (completed) return;
        if (typeof doLMSSetValue === 'function') {
            doLMSSetValue("cmi.core.score.raw", score);
            // Ensure status shows as done. In SCORM 1.2, 'passed' implies completion.
            // If they didn't pass, we use 'completed' so they still get credit for finishing.
            doLMSSetValue("cmi.core.lesson_status", score >= 70 ? "passed" : "completed");
            doLMSCommit();
            doLMSFinish();
        }
        completed = true;
        alert("Training complete! Your score: " + score + "%. You can close this window.");
    }

    window.onload = function() {
        console.log("SCORM Player Initialized with Course Data:", data);
        render();
        if (typeof doLMSInitialize === 'function') {
            doLMSInitialize();
            doLMSSetValue("cmi.core.score.min", "0");
            doLMSSetValue("cmi.core.score.max", "100");
            doLMSSetValue("cmi.core.lesson_status", "incomplete");
            doLMSCommit();
        }
    };
<\/script>
</body>
</html>`;

    // --- Create scorm_api_wrapper.js ---
    const scormWrapper = `
var findAPITries = 0;
function findAPI(win) {
   while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
      findAPITries++;
      if (findAPITries > 500) return null;
      win = win.parent;
   }
   return win.API;
}
function getAPI() {
   var theAPI = findAPI(window);
   if ((theAPI == null) && (window.opener != null)) { theAPI = findAPI(window.opener); }
   return theAPI;
}
var API = getAPI();
function doLMSInitialize() { if (!API) return "false"; return API.LMSInitialize(""); }
function doLMSFinish() { if (!API) return "false"; return API.LMSFinish(""); }
function doLMSGetValue(n) { if (!API) return ""; return API.LMSGetValue(n); }
function doLMSSetValue(n, v) { if (!API) return "false"; return API.LMSSetValue(n, v); }
function doLMSCommit() { if (!API) return "false"; return API.LMSCommit(""); }
`;

    // Add all files to ZIP
    zip.file("imsmanifest.xml", manifest);
    zip.file("index.html", playerHtml);
    zip.file("scorm_api_wrapper.js", scormWrapper);
    zip.file("content.json", JSON.stringify(analysis, null, 2));
    
    // Add Schema Files
    zip.file("adlcp_rootv1p2.xsd", adlcpXsd);
    zip.file("ims_xml.xsd", imsxmlXsd);
    zip.file("imscp_rootv1p1p2.xsd", imscpXsd);

    return await zip.generateAsync({ type: "blob" });
}
