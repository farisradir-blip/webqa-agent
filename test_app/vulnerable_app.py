#!/usr/bin/env python3
"""
تطبيق تجريبي يحتوي على ثغرات أمنية متعمدة لأغراض التعليم
"""
import os
import sqlite3

# ثغرة: كلمة مرور مخزنة بشكل مباشر
password = "SuperSecret123!"
api_key = "sk-1234567890abcdef"
secret = "my_secret_token_xyz"

def get_user(username):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # ثغرة: SQL Injection - دمج النصوص مباشرة
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    cursor.execute(query)
    return cursor.fetchone()

def search_user(user_id):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # ثغرة أخرى: SQL Injection باستخدام %s
    query = "SELECT * FROM users WHERE id = %s" % user_id
    cursor.execute(query)
    return cursor.fetchone()

def run_command(cmd):
    # ثغرة: Command Injection - تنفيذ أوامر النظام بشكل غير آمن
    os.system("ls -l " + cmd)
    
    # ثغرة أخرى: استخدام eval
    result = eval("1 + 2")
    return result

def hash_password(pwd):
    # ثغرة: استخدام خوارزمية تشفير ضعيفة
    import hashlib
    return hashlib.md5(pwd.encode()).hexdigest()

def old_crypto():
    # ثغرة: ذكر خوارزميات قديمة
    # SHA1 و DES تعتبر غير آمنة الآن
    pass

if __name__ == "__main__":
    print("تطبيق تجريبي به ثغرات أمنية")
