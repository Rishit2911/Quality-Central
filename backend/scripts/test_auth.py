import sys
import os
import asyncio
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from fastapi import Request
from backend.core.auth import get_current_user

class DummyRequest:
    def __init__(self, token):
        self.cookies = {"session_token": token}

req = DummyRequest("5-qUOuRPopQ1cWmlCTJrzo49Dr0GkVJZRmRba97MUR0")
try:
    user = get_current_user(req)
    print("User roles:", user['role'])
    print("Deploy module access:", user['permissions'].get('module.deploy.access'))
    print("Has deploy.employees.view_list:", user['permissions'].get('deploy.employees.view_list'))
except Exception as e:
    print("Error:", e)
