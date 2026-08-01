import os
import zipfile
import xml.etree.ElementTree as ET
from flask import Flask, render_template_string, request, jsonify
import re

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
ANALYSIS_RESULTS = {}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- HTML Template for the Interface ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>معلم الهاكر الأخلاقي - محلل XAPK</title>
    <style>
        :root { --primary: #00ff88; --bg: #0d1117; --card: #161b22; --text: #c9d1d9; --danger: #ff5555; --warn: #ffaa00; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { color: var(--primary); text-align: center; }
        .upload-box { border: 2px dashed var(--primary); padding: 40px; text-align: center; border-radius: 10px; background: var(--card); cursor: pointer; transition: 0.3s; }
        .upload-box:hover { background: #1f2937; }
        input[type="file"] { display: none; }
        .btn { background: var(--primary); color: #000; padding: 10px 20px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; }
        .results { margin-top: 30px; display: none; }
        .card { background: var(--card); padding: 20px; border-radius: 8px; margin-bottom: 20px; border-right: 4px solid var(--primary); }
        .vuln-high { border-color: var(--danger); }
        .vuln-med { border-color: var(--warn); }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .bg-high { background: var(--danger); color: white; }
        .bg-med { background: var(--warn); color: black; }
        .code-block { background: #000; padding: 10px; border-radius: 5px; overflow-x: auto; color: #a5d6ff; font-family: monospace; direction: ltr; text-align: left; }
        .lesson { background: #1f2937; padding: 15px; border-radius: 5px; margin-top: 10px; }
        .loader { display: none; text-align: center; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ معلم الهاكر الأخلاقي</h1>
        <p style="text-align: center;">ارفع ملف XAPK لتحليله هندسياً واكتشاف الثغرات وتعلم الإصلاح.</p>
        
        <label class="upload-box">
            <input type="file" id="fileInput" accept=".xapk,.apk">
            <div id="dropText">اضغط هنا أو اسحب ملف XAPK/APK للإفلات</div>
        </label>
        <div style="text-align: center; margin-top: 20px;">
            <button class="btn" onclick="analyzeFile()">بدء التحليل الذكي</button>
        </div>

        <div class="loader" id="loader">جاري فك الضغط والتحليل الهندسي... يرجى الانتظار</div>

        <div id="resultsArea" class="results">
            <h2>📊 نتائج التحليل الهندسي</h2>
            <div id="cardsContainer"></div>
        </div>
    </div>

    <script>
        async function analyzeFile() {
            const fileInput = document.getElementById('fileInput');
            if (fileInput.files.length === 0) { alert('الرجاء اختيار ملف أولاً'); return; }
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            document.getElementById('loader').style.display = 'block';
            document.getElementById('resultsArea').style.display = 'none';

            try {
                const response = await fetch('/analyze', { method: 'POST', body: formData });
                const data = await response.json();
                renderResults(data);
            } catch (error) {
                alert('حدث خطأ أثناء التحليل: ' + error);
            } finally {
                document.getElementById('loader').style.display = 'none';
            }
        }

        function renderResults(data) {
            const container = document.getElementById('cardsContainer');
            container.innerHTML = '';
            
            if (data.error) {
                container.innerHTML = `<div class="card vuln-high"><h3>خطأ</h3><p>${data.error}</p></div>`;
                document.getElementById('resultsArea').style.display = 'block';
                return;
            }

            // App Info
            let html = `<div class="card">
                <h3>📱 معلومات التطبيق: ${data.app_name || 'غير معروف'}</h3>
                <p><strong>الحزمة:</strong> ${data.package_name}</p>
                <p><strong>الإصدار:</strong> ${data.version}</p>
            </div>`;

            // Vulnerabilities & Lessons
            if (data.findings && data.findings.length > 0) {
                data.findings.forEach((f, index) => {
                    const severityClass = f.severity === 'high' ? 'vuln-high' : 'vuln-med';
                    const badgeClass = f.severity === 'high' ? 'bg-high' : 'bg-med';
                    const severityText = f.severity === 'high' ? 'حرجة' : 'متوسطة';
                    
                    html += `<div class="card ${severityClass}">
                        <h4>⚠️ ${f.title} <span class="badge ${badgeClass}">${severityText}</span></h4>
                        <p><strong>الوصف:</strong> ${f.description}</p>
                        <div class="code-block">${f.evidence}</div>
                        <div class="lesson">
                            <strong>🎓 درس الهندسة العكسية والإصلاح:</strong><br>
                            ${f.lesson}
                        </div>
                    </div>`;
                });
            } else {
                html += `<div class="card"><h3>✅ لم يتم العثور على ثغرات واضحة في الـ Manifest.</h3><p>هذا لا يعني أن التطبيق آمن 100%، فقد تكون الثغرات داخل الكود البرمجي (Classes.dex) الذي يحتاج لأدوات متقدمة مثل JADX.</p></div>`;
            }

            container.innerHTML = html;
            document.getElementById('resultsArea').style.display = 'block';
        }
    </script>
</body>
</html>
"""

def analyze_manifest(manifest_path):
    findings = []
    try:
        tree = ET.parse(manifest_path)
        root = tree.getroot()
        
        # Namespace handling for Android XML
        ns = {'android': 'http://schemas.android.com/apk/res/android'}
        
        package_name = root.get('package', 'Unknown')
        version_name = root.get('{http://schemas.android.com/apk/res/android}versionName', 'Unknown')
        app_name_label = root.find('.//application', ns)
        app_name = app_name_label.get('{http://schemas.android.com/apk/res/android}label', 'Unknown App') if app_name_label is not None else 'Unknown App'

        # 1. Check Dangerous Permissions
        dangerous_perms = [
            ('SEND_SMS', 'إرسال رسائل SMS'),
            ('READ_CONTACTS', 'قراءة جهات الاتصال'),
            ('RECORD_AUDIO', 'تسجيل الصوت'),
            ('CAMERA', 'الوصول للكاميرا'),
            ('READ_EXTERNAL_STORAGE', 'قراءة التخزين'),
            ('ACCESS_FINE_LOCATION', 'الموقع الدقيق'),
            ('SYSTEM_ALERT_WINDOW', 'الرسم فوق التطبيقات الأخرى')
        ]
        
        for perm_code, perm_desc in dangerous_perms:
            full_perm = f"android.permission.{perm_code}"
            for p in root.findall('.//uses-permission'):
                if p.get('{http://schemas.android.com/apk/res/android}name') == full_perm:
                    findings.append({
                        'title': f'إذن خطير: {perm_desc}',
                        'severity': 'high' if perm_code in ['SEND_SMS', 'SYSTEM_ALERT_WINDOW'] else 'medium',
                        'description': f'التطبيق يطلب إذن {perm_desc} والذي قد يُستغل لسرقة البيانات أو المراقبة.',
                        'evidence': f'<uses-permission android:name="{full_perm}" />',
                        'lesson': f'<strong>كيف يعمل؟</strong> المهاجم قد يستخدم هذا الإذن لإرسال رسائل مدفوعة أو التجسس.<br><strong>الإصلاح:</strong> قم بإزالة هذا السطر من AndroidManifest.xml إذا لم يكن ضرورياً جداً، أو استخدم صلاحيات وقت التشغيل (Runtime Permissions) في الكود.'
                    })

        # 2. Check Exported Components (Security Risk)
        for activity in root.findall('.//activity', ns):
            exported = activity.get('{http://schemas.android.com/apk/res/android}exported')
            name = activity.get('{http://schemas.android.com/apk/res/android}name')
            if exported == 'true':
                findings.append({
                    'title': 'نشاط مكشوف (Exported Activity)',
                    'severity': 'medium',
                    'description': f'النشاط {name} متاح للتطبيقات الأخرى، مما قد يسمح بتشغيل أجزاء من التطبيق عن بعد.',
                    'evidence': f'<activity android:name="{name}" android:exported="true" ... />',
                    'lesson': '<strong>الخطر:</strong> قد يستغل تطبيق خبيث هذا النشاط لتنفيذ أفعال غير مصرح بها.<br><strong>الإصلاح:</strong> غيّر القيمة إلى <code>android:exported="false"</code> إلا إذا كان ضرورياً جداً (مثل نقطة الدخول الرئيسية).'
                })

        # 3. Check Cleartext Traffic
        application_node = root.find('.//application', ns)
        if application_node is not None:
            cleartext = application_node.get('{http://schemas.android.com/apk/res/android}usesCleartextTraffic')
            if cleartext == 'true':
                findings.append({
                    'title': 'حركة مرور غير مشفرة (Cleartext Traffic)',
                    'severity': 'high',
                    'description': 'التطبيق يسمح باتصالات HTTP غير مشفرة، مما يعرض البيانات للاعتراض.',
                    'evidence': '<application android:usesCleartextTraffic="true" ... >',
                    'lesson': '<strong>الخطر:</strong> أي شخص على نفس الشبكة يمكنه رؤية كلمات المرور والبيانات.<br><strong>الإصلاح:</strong> غيّر القيمة إلى <code>false</code> واستخدم HTTPS لجميع الاتصالات.'
                })

        return {
            'app_name': app_name,
            'package_name': package_name,
            'version': version_name,
            'findings': findings
        }

    except Exception as e:
        return {'error': str(e)}

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'file' not in request.files:
        return jsonify({'error': 'لم يتم رفع أي ملف'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'اسم الملف فارغ'}), 400

    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    temp_extract_dir = os.path.join(UPLOAD_FOLDER, 'temp_extract')
    os.makedirs(temp_extract_dir, exist_ok=True)

    try:
        # XAPK is just a zip file
        with zipfile.ZipFile(filepath, 'r') as zip_ref:
            zip_ref.extractall(temp_extract_dir)
        
        # Look for AndroidManifest.xml
        manifest_path = None
        for root, dirs, files in os.walk(temp_extract_dir):
            for file in files:
                if file == 'AndroidManifest.xml':
                    manifest_path = os.path.join(root, file)
                    break
        
        if manifest_path:
            result = analyze_manifest(manifest_path)
            return jsonify(result)
        else:
            # Try to look inside base.apk if it exists (nested apk in xapk)
            base_apk = os.path.join(temp_extract_dir, 'base.apk')
            if os.path.exists(base_apk):
                 with zipfile.ZipFile(base_apk, 'r') as zip_ref:
                    zip_ref.extract('AndroidManifest.xml', temp_extract_dir)
                    manifest_path = os.path.join(temp_extract_dir, 'AndroidManifest.xml')
                    result = analyze_manifest(manifest_path)
                    return jsonify(result)

            return jsonify({'error': 'لم يتم العثور على ملف AndroidManifest.xml. قد يكون الملف تالفاً أو مشفراً.'})

    except zipfile.BadZipFile:
        return jsonify({'error': 'الملف ليس بصيغة XAPK/APK صالحة أو تالف.'})
    except Exception as e:
        return jsonify({'error': f'حدث خطأ غير متوقع: {str(e)}'}), 500
    finally:
        # Cleanup (optional in production, good for dev)
        # You might want to add logic to delete files after analysis
        pass

if __name__ == '__main__':
    print("🚀 جاري تشغيل نظام Ethical Hacker Mentor...")
    print("🌐 افتح المتصفح على: http://127.0.0.1:5000")
    app.run(debug=True, port=5000)