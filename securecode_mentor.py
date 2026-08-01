#!/usr/bin/env python3
"""
SecureCode Mentor - أداة تعليمية لفحص الثغرات الأمنية في الكود المصدري
تقدم توصيات ذكية وأمثلة تصحيحية لتعزيز الأمان
"""

import os
import re
import sys
import json
from datetime import datetime
from typing import Dict, List, Any

class SecureCodeMentor:
    def __init__(self):
        self.vulnerabilities = []
        self.recommendations = {}
        self.learning_resources = {
            "sql_injection": "استخدم Prepared Statements بدلاً من دمج النصوص مباشرة",
            "hardcoded_secrets": "استخدم متغيرات البيئة أو أدوات إدارة الأسرار مثل HashiCorp Vault",
            "command_injection": "تجنب استخدام os.system() واستخدم subprocess مع قائمة معاملات",
            "path_traversal": "تحقق من صحة المسارات واستخدم os.path.realpath()",
            "weak_crypto": "استخدم خوارزميات حديثة مثل AES-256 و bcrypt للهاش"
        }
    
    def scan_file(self, filepath: str) -> List[Dict[str, Any]]:
        """فحص ملف واحد بحثاً عن ثغرات أمنية شائعة"""
        if not os.path.exists(filepath):
            return [{"error": f"الملف غير موجود: {filepath}"}]
        
        findings = []
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')
            
            # فحص كلمات المرور المخزنة بشكل مباشر
            secret_patterns = [
                (r'password\s*=\s*["\'][^"\']+["\']', "hardcoded_password"),
                (r'api_key\s*=\s*["\'][^"\']+["\']', "hardcoded_api_key"),
                (r'secret\s*=\s*["\'][^"\']+["\']', "hardcoded_secret"),
                (r'token\s*=\s*["\'][^"\']+["\']', "hardcoded_token")
            ]
            
            for i, line in enumerate(lines, 1):
                for pattern, vuln_type in secret_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        findings.append({
                            "type": "hardcoded_secrets",
                            "file": filepath,
                            "line": i,
                            "content": line.strip(),
                            "severity": "HIGH",
                            "description": "تم العثور على بيانات حساسة مخزنة بشكل مباشر في الكود",
                            "recommendation": self.learning_resources["hardcoded_secrets"],
                            "example_fix": self._get_fix_example(vuln_type)
                        })
                
                # فحص ثغرات SQL Injection
                if re.search(r'execute\s*\(\s*["\'].*%s.*["\']|execute\s*\(\s*["\'].*\+.*["\']', line):
                    findings.append({
                        "type": "sql_injection",
                        "file": filepath,
                        "line": i,
                        "content": line.strip(),
                        "severity": "CRITICAL",
                        "description": "احتمالية وجود ثغرة SQL Injection بسبب دمج النصوص مباشرة",
                        "recommendation": self.learning_resources["sql_injection"],
                        "example_fix": "cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))"
                    })
                
                # فحص ثغرات Command Injection
                if re.search(r'os\.system\s*\(|subprocess\.call\s*\([^)]*\+|eval\s*\(|exec\s*\(', line):
                    findings.append({
                        "type": "command_injection",
                        "file": filepath,
                        "line": i,
                        "content": line.strip(),
                        "severity": "CRITICAL",
                        "description": "احتمالية وجود ثغرة Command Injection",
                        "recommendation": self.learning_resources["command_injection"],
                        "example_fix": "subprocess.run(['ls', '-l'], capture_output=True, text=True)"
                    })
                
                # فحص التشفير الضعيف
                if re.search(r'MD5|SHA1|DES|RC4', line, re.IGNORECASE):
                    if not re.search(r'#.*ignore|TODO|FIXME', line):
                        findings.append({
                            "type": "weak_crypto",
                            "file": filepath,
                            "line": i,
                            "content": line.strip(),
                            "severity": "MEDIUM",
                            "description": "استخدام خوارزمية تشفير قديمة أو ضعيفة",
                            "recommendation": self.learning_resources["weak_crypto"],
                            "example_fix": "من bcrypt import hashpw, gensalt\nhashed = hashpw(password.encode(), gensalt())"
                        })
        
        except Exception as e:
            findings.append({"error": f"خطأ في قراءة الملف {filepath}: {str(e)}"})
        
        return findings
    
    def _get_fix_example(self, vuln_type: str) -> str:
        """إرجاع مثال تصحيحي حسب نوع الثغرة"""
        examples = {
            "hardcoded_password": "import os\npassword = os.getenv('DB_PASSWORD')",
            "hardcoded_api_key": "import os\napi_key = os.getenv('API_KEY')",
            "hardcoded_secret": "import os\nsecret = os.getenv('APP_SECRET')",
            "hardcoded_token": "import os\ntoken = os.getenv('AUTH_TOKEN')"
        }
        return examples.get(vuln_type, "راجع التوصية المذكورة أعلاه")
    
    def scan_directory(self, dirpath: str, extensions: List[str] = None) -> List[Dict[str, Any]]:
        """فحص مجلد كامل يحتوي على ملفات برمجية"""
        if extensions is None:
            extensions = ['.py', '.js', '.php', '.java', '.cpp', '.c', '.rb', '.go']
        
        all_findings = []
        for root, _, files in os.walk(dirpath):
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    filepath = os.path.join(root, file)
                    findings = self.scan_file(filepath)
                    all_findings.extend(findings)
        
        return all_findings
    
    def generate_report(self, findings: List[Dict[str, Any]], output_format: str = "text") -> str:
        """إنشاء تقرير مفصل عن النتائج"""
        if not findings:
            return "✅ لم يتم العثور على أي ثغرات أمنية واضحة في الملفات المفحوصة."
        
        if output_format == "json":
            return json.dumps({
                "scan_date": datetime.now().isoformat(),
                "total_findings": len(findings),
                "findings": findings
            }, indent=2, ensure_ascii=False)
        
        # تقرير نصي مفصل
        report = "=" * 70 + "\n"
        report += "🔒 تقرير SecureCode Mentor الأمني\n"
        report += "=" * 70 + f"\nتاريخ الفحص: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        report += f"إجمالي الثغرات المكتشفة: {len(findings)}\n\n"
        
        # تجميع حسب الخطورة
        severity_count = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for finding in findings:
            if "severity" in finding:
                severity_count[finding["severity"]] = severity_count.get(finding["severity"], 0) + 1
        
        report += "📊 ملخص الخطورة:\n"
        for severity, count in severity_count.items():
            if count > 0:
                emoji = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}[severity]
                report += f"{emoji} {severity}: {count}\n"
        
        report += "\n" + "=" * 70 + "\n📋 التفاصيل:\n" + "=" * 70 + "\n\n"
        
        for i, finding in enumerate(findings, 1):
            if "error" in finding:
                report += f"❌ {finding['error']}\n\n"
                continue
            
            report += f"[{i}] نوع الثغرة: {finding['type'].upper()}\n"
            report += f"   الملف: {finding['file']}\n"
            report += f"   السطر: {finding['line']}\n"
            report += f"   الخطورة: {finding['severity']}\n"
            report += f"   الوصف: {finding['description']}\n"
            report += f"   💡 التوصية: {finding['recommendation']}\n"
            report += f"   🔧 مثال التصحيح:\n      {finding['example_fix']}\n\n"
        
        report += "=" * 70 + "\n"
        report += "🎓 موارد تعليمية إضافية:\n"
        report += "- OWASP Top 10: https://owasp.org/www-project-top-ten/\n"
        report += "- Secure Coding Practices: https://cheatsheetseries.owasp.org/\n"
        report += "=" * 70 + "\n"
        
        return report

def main():
    print("🚀 SecureCode Mentor - أداة تعليمية لفحص الثغرات الأمنية")
    print("=" * 60)
    
    if len(sys.argv) < 2:
        print("الاستخدام: python securecode_mentor.py <مسار_الملف_أو_المجلد>")
        print("مثال: python securecode_mentor.py ./my_app")
        sys.exit(1)
    
    target_path = sys.argv[1]
    mentor = SecureCodeMentor()
    
    if os.path.isfile(target_path):
        print(f"\n🔍 جاري فحص الملف: {target_path}")
        findings = mentor.scan_file(target_path)
    elif os.path.isdir(target_path):
        print(f"\n🔍 جاري فحص المجلد: {target_path}")
        findings = mentor.scan_directory(target_path)
    else:
        print(f"❌ المسار غير صحيح: {target_path}")
        sys.exit(1)
    
    report = mentor.generate_report(findings)
    print("\n" + report)
    
    # حفظ التقرير في ملف
    report_file = f"security_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"\n💾 تم حفظ التقرير في الملف: {report_file}")

if __name__ == "__main__":
    main()
