#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SecureCode Mentor - مساعد ذكي لمراجعة الكود وتعزيز الأمن
هذا الأداة تفحص الملفات البرمجية بحثاً عن ممارسات غير آمنة وتقترح تحسينات.
"""

import os
import re
import json
from typing import List, Dict, Any
from dataclasses import dataclass
from pathlib import Path

@dataclass
class Vulnerability:
    type: str
    severity: str  # High, Medium, Low
    line_number: int
    code_snippet: str
    description: str
    recommendation: str
    file_path: str

class SecurityKnowledgeBase:
    """قاعدة معرفة تحتوي على أنماط الثغرات وطرق إصلاحها"""
    
    def __init__(self):
        self.patterns = [
            {
                "id": "HARDCODED_SECRET",
                "regex": r"(?i)(password|passwd|pwd|secret|api_key|token)\s*=\s*['\"][^'\"]{4,}['\"]",
                "severity": "High",
                "description": "تم العثور على بيانات اعتماد أو مفاتيح سرية مكتوبة مباشرة في الكود.",
                "recommendation": "لا تضع الأسرار في الكود المصدري. استخدم متغيرات البيئة (Environment Variables) أو أدوات إدارة الأسرار مثل HashiCorp Vault أو AWS Secrets Manager.",
                "example_bad": "password = 'super_secret_123'",
                "example_good": "import os; password = os.getenv('DB_PASSWORD')"
            },
            {
                "id": "SQL_INJECTION",
                "regex": r"(?i)(execute|cursor\.execute|query)\s*\(\s*['\"].*%s.*['\"]|(\+|\%).*input|f['\"].*{.*}.*select",
                "severity": "Critical",
                "description": "خطر محتمل لحقن SQL (SQL Injection). يتم دمج مدخلات المستخدم مباشرة في استعلامات قاعدة البيانات.",
                "recommendation": "استخدم الاستعلامات المُجهزة (Prepared Statements) أو المعلمات (Parameterized Queries) بدلاً من دمج النصوص يدوياً.",
                "example_bad": "cursor.execute(f\"SELECT * FROM users WHERE id = {user_id}\")",
                "example_good": "cursor.execute(\"SELECT * FROM users WHERE id = %s\", (user_id,))"
            },
            {
                "id": "COMMAND_INJECTION",
                "regex": r"(?i)(os\.system|subprocess\.call|subprocess\.run|eval|exec)\s*\([^)]*[\+\%,]",
                "severity": "Critical",
                "description": "خطر تنفيذ أوامر النظام (Command Injection). قد يسمح للمهاجم بتنفيذ أوامر خبيثة على الخادم.",
                "recommendation": "تجنب تمرير سلاسل نصية مركبة لأوامر النظام. استخدم قوائم الوسائط (Argument Lists) مع subprocess وتأكد من صحة المدخلات بدقة.",
                "example_bad": "os.system('ping ' + user_input)",
                "example_good": "subprocess.run(['ping', user_input], check=True)"
            },
            {
                "id": "INSECURE_RANDOM",
                "regex": r"(?i)import\s+random|random\.(randint|choice|random)",
                "severity": "Medium",
                "description": "استخدام مولد أرقام عشوائية غير آمن للأغراض криптографية (مثل توليد الرموز أو الجلسات).",
                "recommendation": "للأغراض الأمنية، استخدم مكتبة `secrets` بدلاً من `random`.",
                "example_bad": "token = random.randint(1000, 9999)",
                "example_good": "import secrets; token = secrets.token_hex(16)"
            },
            {
                "id": "DEBUG_MODE",
                "regex": r"(?i)(debug|app\.run)\s*=\s*True|app\.run\(.*debug\s*=\s*True",
                "severity": "High",
                "description": "وضع التصحيح (Debug Mode) مفعل. هذا يعرض معلومات حساسة عن التطبيق عند حدوث أخطاء.",
                "recommendation": "تأكد من تعطيل وضع التصحيح في بيئات الإنتاج (Production).",
                "example_bad": "app.run(debug=True)",
                "example_good": "app.run(debug=False)"
            }
        ]

    def scan_code(self, code: str, file_path: str) -> List[Vulnerability]:
        findings = []
        lines = code.split('\n')
        
        for pattern in self.patterns:
            regex = re.compile(pattern["regex"])
            for i, line in enumerate(lines, 1):
                if regex.search(line):
                    findings.append(Vulnerability(
                        type=pattern["id"],
                        severity=pattern["severity"],
                        line_number=i,
                        code_snippet=line.strip(),
                        description=pattern["description"],
                        recommendation=pattern["recommendation"],
                        file_path=file_path
                    ))
        return findings

class SecureCodeMentor:
    def __init__(self):
        self.kb = SecurityKnowledgeBase()
    
    def analyze_file(self, file_path: str) -> List[Vulnerability]:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            return self.kb.scan_code(content, file_path)
        except Exception as e:
            print(f"خطأ في قراءة الملف {file_path}: {e}")
            return []

    def analyze_directory(self, dir_path: str, extensions: List[str] = ['.py', '.js', '.php', '.java']) -> List[Vulnerability]:
        all_findings = []
        print(f"جاري فحص المجلد: {dir_path} ...")
        
        for root, _, files in os.walk(dir_path):
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    full_path = os.path.join(root, file)
                    findings = self.analyze_file(full_path)
                    all_findings.extend(findings)
        
        return all_findings

    def generate_report(self, findings: List[Vulnerability]) -> str:
        if not findings:
            return "🎉 مبروك! لم يتم العثور على ثغرات أمنية معروفة في الكود المفحوص."
        
        report = []
        report.append("="*60)
        report.append("تقرير مراجعة الأمن السيبراني")
        report.append("="*60)
        report.append(f"إجمالي الثغرات المكتشفة: {len(findings)}")
        report.append("")
        
        # ترتيب حسب الخطورة
        severity_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        sorted_findings = sorted(findings, key=lambda x: severity_order.get(x.severity, 4))
        
        for i, vuln in enumerate(sorted_findings, 1):
            report.append(f"[{i}] نوع الثغرة: {vuln.type}")
            report.append(f"    الخطورة: {vuln.severity}")
            report.append(f"    الملف: {vuln.file_path}:{vuln.line_number}")
            report.append(f"    الكود المشبوه: {vuln.code_snippet}")
            report.append(f"    الوصف: {vuln.description}")
            report.append(f"    💡 الحل المقترح: {vuln.recommendation}")
            report.append("-" * 40)
            
        return "\n".join(report)

def main():
    print("🛡️  مرحباً بك في SecureCode Mentor")
    print("أدخل مسار الملف أو المجلد الذي تريد فحصه:")
    target_path = input("> ").strip()
    
    if not os.path.exists(target_path):
        print("❌ المسار غير موجود!")
        return

    mentor = SecureCodeMentor()
    
    if os.path.isfile(target_path):
        findings = mentor.analyze_file(target_path)
    elif os.path.isdir(target_path):
        findings = mentor.analyze_directory(target_path)
    else:
        print("❌ يرجى إدخال مسار ملف أو مجلد صحيح.")
        return

    report = mentor.generate_report(findings)
    print("\n" + report)
    
    # حفظ التقرير في ملف
    if findings:
        save_option = input("\nهل تريد حفظ التقرير في ملف نصي؟ (y/n): ")
        if save_option.lower() == 'y':
            with open("security_report.txt", "w", encoding="utf-8") as f:
                f.write(report)
            print("✅ تم حفظ التقرير في security_report.txt")

if __name__ == "__main__":
    main()
