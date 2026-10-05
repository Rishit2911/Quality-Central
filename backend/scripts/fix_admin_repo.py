import re

with open('/Users/cluxssy/Code/phygitron360/backend/modules/admin/repositories/admin_repo.py', 'r') as f:
    content = f.read()

# We need to add: cur.execute(f'SET search_path TO "{self.tenant_id}"')
# right after: cur = conn.cursor(...) for tenant-specific methods.

# Let's list the methods that need it.
methods_to_fix = [
    'get_all_users',
    'get_user_by_id',
    'log_action',
    'get_logs',
    'get_role_permissions',
    'get_templates',
    'create_template',
    'delete_template',
    'update_role_permissions',
    'update_employee_code',
    'update_role'
]

lines = content.split('\n')
new_lines = []
in_method = None

for line in lines:
    new_lines.append(line)
    
    match = re.match(r'^\s+def\s+([a-zA-Z0-9_]+)\(', line)
    if match:
        in_method = match.group(1)
        continue
        
    if in_method in methods_to_fix:
        if 'cur = conn.cursor(' in line:
            indent = line[:len(line) - len(line.lstrip())]
            new_lines.append(indent + "cur.execute(f'SET search_path TO \"{self.tenant_id}\"')")
            in_method = None # Only insert once per method

with open('/Users/cluxssy/Code/phygitron360/backend/modules/admin/repositories/admin_repo.py', 'w') as f:
    f.write('\n'.join(new_lines))
